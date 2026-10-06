import Link from "next/link";
import { ajouterOffre, lancerRecuperation } from "@/app/actions";
import { BoutonEnvoi } from "@/components/BoutonEnvoi";
import { CarteEvenement } from "@/components/CarteEvenement";
import { CarteOffre } from "@/components/CarteOffre";
import { Masquable } from "@/components/Masquable";
import { db, type Etape, type Evenement, type Offre } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // « Récupérer maintenant » peut prendre quelques minutes

// L'onglet Favoris montre les offres étoilées quelle que soit leur étape.
const VUES: { id: string; titre: string; etapes: Etape[]; favoris?: true }[] = [
  { id: "trier", titre: "À trier", etapes: ["nouvelle"] },
  { id: "favoris", titre: "★ Favoris", etapes: [], favoris: true },
  { id: "postuler", titre: "À postuler", etapes: ["a_postuler"] },
  { id: "suivi", titre: "En cours", etapes: ["postulee", "relancee", "entretien"] },
  { id: "pas-interessant", titre: "Pas intéressant", etapes: ["pas_interessant"] },
  { id: "archives", titre: "Écartées et refus", etapes: ["ecartee", "refus"] },
];

// « Dernier passage » = ajoutées depuis le passage précédent, donc par le plus récent.
const PERIODES = [
  { id: "", titre: "Toutes" },
  { id: "passage", titre: "Dernier passage" },
  { id: "24h", titre: "24 h" },
  { id: "7j", titre: "7 jours" },
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
  const depuis = typeof sp.depuis === "string" ? sp.depuis : "";
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

  const { data: passages } = await supabase.from("recuperations").select("*").order("lancee_le", { ascending: false }).limit(2);
  const derniere = passages?.[0] ?? null;
  // Les offres d'un passage sont ajoutées avant que la ligne du passage soit écrite :
  // celles du dernier passage ont donc été créées après la ligne du passage précédent.
  const debutDernier = passages?.[1]?.lancee_le ?? null;
  const seuil =
    depuis === "passage" ? debutDernier
    : depuis === "24h" ? new Date(new Date(maintenant).getTime() - 86_400_000).toISOString()
    : depuis === "7j" ? new Date(new Date(maintenant).getTime() - 7 * 86_400_000).toISOString()
    : null;

  let requete = supabase.from("offres").select("*").limit(300);
  requete = vue.favoris ? requete.eq("favori", true) : requete.in("etape", vue.etapes);
  if (source) requete = requete.eq("source", source);
  if (seuil) requete = requete.gt("created_at", seuil);
  requete =
    vue.id === "suivi"
      ? requete.order("prochaine_date", { ascending: true, nullsFirst: false })
      : requete.order("niveau", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false });
  // Des dizaines d'offres partagent la même heure d'ajout (insérées d'un bloc) : l'id départage,
  // sinon l'ordre change à chaque rechargement.
  requete = requete.order("id", { ascending: true });

  const [
    { data: offres, error },
    { data: etapes },
    { data: evenements, error: erreurEvenements },
    { count: nbEvenements },
  ] = await Promise.all([
    enEvenements ? Promise.resolve({ data: [] as Offre[], error: null }) : requete,
    supabase.from("offres").select("etape, favori"),
    enEvenements ? reqEvenements : Promise.resolve({ data: [] as Evenement[], error: null }),
    supabase.from("evenements").select("id", { count: "exact", head: true }).gte("date_evenement", maintenant).neq("statut", "ecarte"),
  ]);

  const compte = (v: (typeof VUES)[number]) => etapes?.filter((e) => (v.favoris ? e.favori : v.etapes.includes(e.etape))).length ?? 0;
  const lien = (params: Record<string, string>) => {
    const q = new URLSearchParams({ vue: vue.id, source, depuis, ...params });
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
            <span className="filtre-titre">Ajoutées</span>
            {PERIODES.map((p) => (
              <Link key={p.id} href={lien({ depuis: p.id })} className={p.id === depuis ? "puce active" : "puce"}>
                {p.titre}
              </Link>
            ))}
          </div>
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
                {/* Dans Favoris, changer d'étape ne fait pas sortir l'offre de l'onglet : on ne la cache pas. */}
                <Masquable actif={!vue.favoris}>
                  <CarteOffre offre={o} nouvelle={!!debutDernier && o.created_at > debutDernier} />
                </Masquable>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
