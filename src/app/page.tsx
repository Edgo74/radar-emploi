import Link from "next/link";
import { ajouterOffre, lancerRecuperation } from "@/app/actions";
import { BoutonEnvoi } from "@/components/BoutonEnvoi";
import { CarteEvenement } from "@/components/CarteEvenement";
import { CarteOffre } from "@/components/CarteOffre";
import { db, type Etape, type Evenement, type Offre } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // « Récupérer maintenant » peut prendre quelques minutes

const VUES: { id: string; titre: string; etapes: Etape[] }[] = [
  { id: "trier", titre: "À trier", etapes: ["nouvelle"] },
  { id: "postuler", titre: "À postuler", etapes: ["a_postuler"] },
  { id: "suivi", titre: "En cours", etapes: ["postulee", "relancee", "entretien"] },
  { id: "archives", titre: "Écartées et refus", etapes: ["ecartee", "refus"] },
];

const SOURCES = [
  { id: "", titre: "Toutes sources" },
  { id: "france_travail", titre: "France Travail" },
  { id: "adzuna", titre: "Adzuna" },
  { id: "linkedin", titre: "LinkedIn" },
  { id: "wttj", titre: "WTTJ" },
  { id: "autre", titre: "Autre" },
];

export default async function Page({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const enEvenements = sp.vue === "evenements";
  const vue = VUES.find((v) => v.id === sp.vue) ?? VUES[0];
  const source = typeof sp.source === "string" ? sp.source : "";
  const ecartes = sp.ev === "ecartes";
  const supabase = db();
  const maintenant = new Date().toISOString();

  // Événements à venir : notés A ou B (pas encore notés inclus), ou écartés selon le filtre.
  let reqEvenements = supabase
    .from("evenements")
    .select("*")
    .gte("date_evenement", maintenant)
    .order("date_evenement", { ascending: true })
    .limit(300);
  reqEvenements = ecartes ? reqEvenements.eq("statut", "ecarte") : reqEvenements.neq("statut", "ecarte");

  let requete = supabase.from("offres").select("*").in("etape", vue.etapes).limit(300);
  if (source) requete = requete.eq("source", source);
  requete =
    vue.id === "suivi"
      ? requete.order("prochaine_date", { ascending: true, nullsFirst: false })
      : requete.order("niveau", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false });

  const [
    { data: offres, error },
    { data: etapes },
    { data: derniere },
    { data: evenements, error: erreurEvenements },
    { count: nbEvenements },
  ] = await Promise.all([
    enEvenements ? Promise.resolve({ data: [] as Offre[], error: null }) : requete,
    supabase.from("offres").select("etape"),
    supabase.from("recuperations").select("*").order("lancee_le", { ascending: false }).limit(1).maybeSingle(),
    enEvenements ? reqEvenements : Promise.resolve({ data: [] as Evenement[], error: null }),
    supabase.from("evenements").select("id", { count: "exact", head: true }).gte("date_evenement", maintenant).neq("statut", "ecarte"),
  ]);

  const compte = (v: (typeof VUES)[number]) => etapes?.filter((e) => v.etapes.includes(e.etape)).length ?? 0;
  const lien = (params: Record<string, string>) => {
    const q = new URLSearchParams({ vue: vue.id, source, ...params });
    for (const [k, v] of [...q]) if (!v) q.delete(k);
    return `/?${q}`;
  };

  return (
    <main className="page">
      <header className="entete">
        <div>
          <h1>Radar emploi</h1>
          <p className="sous-titre">
            {derniere
              ? `Dernier passage : ${new Date(derniere.lancee_le).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" })} · ${derniere.nouvelles} nouvelles sur ${derniere.trouvees} trouvées · ${derniere.notees} notées`
              : "Aucun passage pour l'instant. Le cron tourne chaque matin vers 7 h."}
          </p>
          {derniere?.erreurs && <p className="erreur">{derniere.erreurs}</p>}
        </div>
        <form action={lancerRecuperation}>
          <BoutonEnvoi className="bouton secondaire" enCours="Récupération…">
            Récupérer maintenant
          </BoutonEnvoi>
        </form>
      </header>

      <details className="ajout">
        <summary className="bouton principal">Ajouter une offre</summary>
        <form action={ajouterOffre} className="formulaire">
          <label>
            Source
            <select name="source" defaultValue="linkedin">
              <option value="linkedin">LinkedIn</option>
              <option value="wttj">Welcome to the Jungle</option>
              <option value="autre">Autre</option>
            </select>
          </label>
          <label className="large">
            Lien de l&apos;offre
            <input name="url" type="url" placeholder="https://www.linkedin.com/jobs/view/…" />
          </label>
          <label>
            Poste *
            <input name="poste" required placeholder="GTM Engineer" />
          </label>
          <label>
            Entreprise
            <input name="entreprise" />
          </label>
          <label>
            Lieu
            <input name="lieu" placeholder="Paris · hybride" />
          </label>
          <label>
            Contrat
            <input name="contrat" placeholder="CDI" />
          </label>
          <label>
            Salaire
            <input name="salaire" placeholder="40–45 k€" />
          </label>
          <label className="pleine">
            Description (colle le texte de l&apos;offre : l&apos;IA s&apos;en sert pour noter et écrire les 3 lignes)
            <textarea name="description" rows={8} />
          </label>
          <div className="pleine">
            <BoutonEnvoi className="bouton principal" enCours="Notation en cours…">
              Ajouter et noter
            </BoutonEnvoi>
          </div>
        </form>
      </details>

      <nav className="onglets" aria-label="Étapes">
        {VUES.map((v) => (
          <Link key={v.id} href={lien({ vue: v.id })} className={!enEvenements && v.id === vue.id ? "onglet actif" : "onglet"}>
            {v.titre} <span className="compte">{compte(v)}</span>
          </Link>
        ))}
        <Link href="/?vue=evenements" className={enEvenements ? "onglet actif" : "onglet"}>
          Événements <span className="compte">{nbEvenements ?? 0}</span>
        </Link>
      </nav>

      {enEvenements && (
        <>
          <div className="filtres">
            <Link href="/?vue=evenements" className={ecartes ? "puce" : "puce active"}>
              À venir (A et B)
            </Link>
            <Link href="/?vue=evenements&ev=ecartes" className={ecartes ? "puce active" : "puce"}>
              Écartés
            </Link>
          </div>
          {erreurEvenements && <p className="erreur">Base de données : {erreurEvenements.message}</p>}
          {evenements?.length === 0 && <p className="vide">Aucun événement pour l&apos;instant. Ils arrivent avec le prochain passage.</p>}
          <ul className="liste">
            {(evenements as Evenement[] | null)?.map((e) => (
              <li key={e.id}>
                <CarteEvenement evenement={e} />
              </li>
            ))}
          </ul>
        </>
      )}

      {!enEvenements && (
        <>
          <div className="filtres">
            {SOURCES.map((s) => (
              <Link key={s.id} href={lien({ source: s.id })} className={s.id === source ? "puce active" : "puce"}>
                {s.titre}
              </Link>
            ))}
          </div>

          {error && <p className="erreur">Base de données : {error.message}</p>}
          {offres?.length === 0 && <p className="vide">Rien ici pour l&apos;instant.</p>}

          <ul className="liste">
            {(offres as Offre[] | null)?.map((o) => (
              <li key={o.id}>
                <CarteOffre offre={o} />
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
