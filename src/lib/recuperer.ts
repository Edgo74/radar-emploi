import "server-only";
import { MOTS_CLES } from "@/lib/profil";
import { noterOffre } from "@/lib/notation";
import { rechercherAdzuna } from "@/lib/sources/adzuna";
import { rechercherApify } from "@/lib/sources/apify";
import { rechercherFranceTravail } from "@/lib/sources/france-travail";
import { db, dedupKey, type NouvelleOffre, type Offre } from "@/lib/supabase";

const LOT = 60;
const DUREE_MAX_MS = 270_000; // on s'arrête avant la limite de 300 s d'une fonction Vercel

// Récupère les offres des deux API, ajoute les nouvelles, puis note celles qui ne le sont pas.
export async function recupererOffres(declencheur: "cron" | "manuel") {
  const debut = Date.now();
  const erreurs: string[] = [];
  const trouvees: NouvelleOffre[] = [];

  // Apify en premier : en cas de doublon entre sources, sa version (description complète) est gardée.
  const sources = [
    { nom: "Apify", run: () => rechercherApify(MOTS_CLES) },
    { nom: "France Travail", run: () => rechercherFranceTravail(MOTS_CLES) },
    { nom: "Adzuna", run: () => rechercherAdzuna(MOTS_CLES) },
  ];
  const resultats = await Promise.allSettled(sources.map((s) => s.run()));
  resultats.forEach((r, i) => {
    if (r.status === "fulfilled") trouvees.push(...r.value);
    else erreurs.push(`${sources[i].nom} : ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`);
  });

  // Une même offre peut sortir sur plusieurs mots-clés ou plusieurs sources : on garde la première.
  const vues = new Set<string>();
  const lignes = [];
  for (const o of trouvees) {
    const cle = dedupKey(o.entreprise, o.poste);
    if (vues.has(cle)) continue;
    vues.add(cle);
    lignes.push({ ...o, dedup_key: cle });
  }

  const supabase = db();
  const dejaLa = new Set<string>();
  for (let i = 0; i < lignes.length; i += 200) {
    const { data } = await supabase.from("offres").select("dedup_key").in("dedup_key", lignes.slice(i, i + 200).map((l) => l.dedup_key));
    data?.forEach((d) => dejaLa.add(d.dedup_key));
  }
  const aInserer = lignes.filter((l) => !dejaLa.has(l.dedup_key));
  if (aInserer.length) {
    const { error } = await supabase.from("offres").upsert(aInserer, { onConflict: "source,external_id", ignoreDuplicates: true });
    if (error) erreurs.push(`Insertion : ${error.message}`);
  }

  const notees = await noterEnAttente(erreurs, debut + DUREE_MAX_MS);

  await supabase.from("recuperations").insert({
    declencheur,
    trouvees: trouvees.length,
    nouvelles: aInserer.length,
    notees,
    erreurs: erreurs.length ? erreurs.join("\n") : null,
  });
  return { trouvees: trouvees.length, nouvelles: aInserer.length, notees, erreurs };
}

export async function noterEnAttente(erreurs: string[] = [], finAvant = Date.now() + DUREE_MAX_MS) {
  const supabase = db();
  const echecs = new Set<string>();
  let notees = 0;

  // Par lots de 60, 6 notations en parallèle, tant qu'il reste du temps.
  while (Date.now() < finAvant - 20_000) {
    const { data: attente } = await supabase
      .from("offres")
      .select("id, poste, entreprise, lieu, contrat, salaire, description")
      .is("niveau", null)
      .order("created_at", { ascending: false })
      .limit(LOT + echecs.size);
    const file = (attente ?? []).filter((o) => !echecs.has(o.id)).slice(0, LOT);
    if (!file.length) break;

    await Promise.all(
      Array.from({ length: 6 }, async () => {
        for (let o = file.shift(); o; o = file.shift()) {
          try {
            await noterUne(o as Offre);
            notees++;
          } catch (e) {
            echecs.add(o.id);
            erreurs.push(`Notation « ${o.poste} » : ${e instanceof Error ? e.message : String(e)}`);
          }
        }
      }),
    );
  }
  return notees;
}

export async function noterUne(o: Pick<Offre, "id" | "poste" | "entreprise" | "lieu" | "contrat" | "salaire" | "description">) {
  const n = await noterOffre(o);
  const { error } = await db()
    .from("offres")
    .update({ ...n, note_le: new Date().toISOString(), ...(n.niveau === "X" ? { etape: "ecartee" } : {}) })
    .eq("id", o.id);
  if (error) throw new Error(error.message);
}
