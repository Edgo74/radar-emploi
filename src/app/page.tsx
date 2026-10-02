import Link from "next/link";
import { ajouterOffre, lancerRecuperation } from "@/app/actions";
import { BoutonEnvoi } from "@/components/BoutonEnvoi";
import { CarteOffre } from "@/components/CarteOffre";
import { db, type Etape, type Offre } from "@/lib/supabase";

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
  const vue = VUES.find((v) => v.id === sp.vue) ?? VUES[0];
  const source = typeof sp.source === "string" ? sp.source : "";
  const supabase = db();

  let requete = supabase.from("offres").select("*").in("etape", vue.etapes).limit(300);
  if (source) requete = requete.eq("source", source);
  requete =
    vue.id === "suivi"
      ? requete.order("prochaine_date", { ascending: true, nullsFirst: false })
      : requete.order("niveau", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false });

  const [{ data: offres, error }, { data: etapes }, { data: derniere }] = await Promise.all([
    requete,
    supabase.from("offres").select("etape"),
    supabase.from("recuperations").select("*").order("lancee_le", { ascending: false }).limit(1).maybeSingle(),
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
          <Link key={v.id} href={lien({ vue: v.id })} className={v.id === vue.id ? "onglet actif" : "onglet"}>
            {v.titre} <span className="compte">{compte(v)}</span>
          </Link>
        ))}
      </nav>

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
    </main>
  );
}
