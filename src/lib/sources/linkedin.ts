import type { RechercheLinkedIn } from "@/lib/profil";
import { db, type NouvelleOffre } from "@/lib/supabase";

// LinkedIn en direct via l'acteur Apify valig/linkedin-jobs-scraper : la même recherche que sur linkedin.com/jobs,
// contrairement à « All Jobs Scraper » qui ne cherche que dans sa propre base (200 offres max par lancement).
// Prix (octobre 2026) : 0,40 $ / 1 000 offres + 0,001 $ par lancement. Pas de plafond d'offres de notre côté :
// la seule limite est le budget mensuel du compte Apify.
// Une recherche par famille de métiers (les « OR » LinkedIn ramènent n'importe quoi), filtrée sur le titre : les offres
// écartées par `titleInclude` / `titleExclude` ne sont pas facturées (essai du 19/10 : 6 offres facturées, Déluj trouvée).
//
// Une recherche dure 2 à 5 min, plus qu'un passage du Radar (fonction Vercel de 300 s), et le compte Apify gratuit
// n'accepte que 5 exécutions à la fois. Donc on n'attend pas : chaque passage lit les recherches terminées depuis
// le passage précédent, puis lance les familles les plus anciennes dans les places libres. Une famille qui n'a pas
// tourné depuis plus de 22 h cherche sur 7 jours au lieu de 24 h : rien n'est perdu quand elle attend son tour,
// et `skipJobId` évite de repayer les offres déjà en base.

const ACTEUR = "valig~linkedin-jobs-scraper";
const LIMITE_ACTEUR = 1000; // maximum accepté par l'acteur pour une recherche
const JOURS = 7; // offres déjà en base sautées sur cette durée (fenêtre max de recherche)
const TIMEOUT_RUN_S = 900; // 300 s par défaut : plusieurs recherches étaient coupées avant la fin
const PLACES_COMPTE = Number(process.env.APIFY_MAX_RUNS) || 5; // exécutions simultanées permises par le plan Apify
const LUES_SUR_JOURS = 3; // résultats relus sur cette durée (la base écarte les doublons)
const ETATS_LISIBLES = ["SUCCEEDED", "TIMED-OUT"]; // une exécution coupée garde les offres déjà trouvées
const ETATS_EN_COURS = ["READY", "RUNNING"];

type Run = { id: string; status: string; defaultDatasetId: string; defaultKeyValueStoreId: string; startedAt: string };
type Ligne = {
  id?: string | number;
  title?: string;
  companyName?: string;
  location?: string;
  workType?: string;
  contractType?: string;
  experienceLevel?: string;
  salary?: string;
  postedDate?: string;
  url?: string;
  description?: string;
  recruiterName?: string;
  recruiterUrl?: string;
};

// `placesReservees` : exécutions Apify lancées en même temps par une autre source (All Jobs Scraper).
export async function rechercherLinkedIn(recherches: RechercheLinkedIn[], erreurs: string[], placesReservees = 0): Promise<NouvelleOffre[]> {
  const motsCles = recherches.map((r) => r.keywords);
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("APIFY_TOKEN manquant");
  const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const api = async <T>(chemin: string, init?: RequestInit) => {
    const r = await fetch(`https://api.apify.com/v2/${chemin}`, { ...init, headers: h, cache: "no-store" });
    if (!r.ok) throw new Error(`Apify ${r.status} ${(await r.text()).slice(0, 150)}`);
    return (await r.json()) as T;
  };

  // 1. Les exécutions de la semaine lancées par ce Radar (même compte Apify, mêmes mots-clés).
  const { data: liste } = await api<{ data: { items: Run[] } }>(`acts/${ACTEUR}/runs?desc=1&limit=200`);
  const semaine = Date.now() - JOURS * 864e5;
  const recentes = await Promise.all(
    liste.items
      .filter((r) => Date.parse(r.startedAt) > semaine)
      .map(async (r) => {
        const input = await api<{ keywords?: string; location?: string }>(`key-value-stores/${r.defaultKeyValueStoreId}/records/INPUT`).catch(() => null);
        return { run: r, keywords: input?.location === "France" ? input.keywords : undefined };
      }),
  );
  const notres = recentes.filter((x) => x.keywords && motsCles.includes(x.keywords));

  // 2. Lire les exécutions terminées des derniers jours. La base écarte les offres déjà vues.
  const depuisLecture = Date.now() - LUES_SUR_JOURS * 864e5;
  const lignes: Ligne[] = [];
  for (const { run } of notres.filter((x) => ETATS_LISIBLES.includes(x.run.status) && Date.parse(x.run.startedAt) > depuisLecture)) {
    for (let offset = 0; ; offset += 1000) {
      const page = await api<Ligne[]>(`datasets/${run.defaultDatasetId}/items?clean=true&offset=${offset}&limit=1000`);
      lignes.push(...page);
      if (page.length < 1000) break;
    }
  }

  // 3. Lancer les familles qui attendent depuis le plus longtemps, dans les places libres du compte.
  const enCoursCompte = (
    await Promise.all(ETATS_EN_COURS.map((s) => api<{ data: { total: number } }>(`actor-runs?status=${s}&limit=1`).then((x) => x.data.total)))
  ).reduce((a, b) => a + b, 0);
  let places = PLACES_COMPTE - enCoursCompte - placesReservees;

  const dernierLancement = new Map<string, number>();
  for (const { run, keywords } of notres) {
    if (!["FAILED", "ABORTED"].includes(run.status)) dernierLancement.set(keywords!, Math.max(dernierLancement.get(keywords!) ?? 0, Date.parse(run.startedAt)));
  }
  const enCours = new Set(notres.filter((x) => ETATS_EN_COURS.includes(x.run.status)).map((x) => x.keywords));
  const aLancer = recherches
    .filter((r) => !enCours.has(r.keywords))
    .sort((a, b) => (dernierLancement.get(a.keywords) ?? 0) - (dernierLancement.get(b.keywords) ?? 0));

  // Offres LinkedIn déjà en base : l'acteur les saute, on ne les paie pas deux fois.
  const depuis = new Date(Date.now() - (JOURS + 1) * 864e5).toISOString();
  const { data: connues } = await db().from("offres").select("external_id").eq("source", "linkedin").gte("created_at", depuis).limit(10_000);
  const skipJobId = [...new Set((connues ?? []).map((o) => o.external_id.match(/(\d{6,})$/)?.[1]).filter(Boolean))];

  for (const { keywords, titres, exclus } of aLancer) {
    if (places <= 0) break;
    const recent = Date.now() - (dernierLancement.get(keywords) ?? 0) < 22 * 3600e3;
    const input = { keywords, location: "France", datePosted: recent ? "r86400" : "r604800", limit: LIMITE_ACTEUR, titleInclude: titres, titleExclude: exclus, skipJobId };
    try {
      await api(`acts/${ACTEUR}/runs?timeout=${TIMEOUT_RUN_S}`, { method: "POST", body: JSON.stringify(input) });
      places--;
    } catch (e) {
      if (String(e).includes("concurrent")) break; // compte plein : les suivantes attendront le prochain passage
      erreurs.push(`LinkedIn « ${keywords} » : ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return lignes
    .filter((l) => l.id && l.title)
    .map((l) => ({
      source: "linkedin" as const,
      plateforme: "linkedin",
      external_id: `linkedin:${l.id}`,
      poste: l.title!,
      entreprise: l.companyName || null,
      lieu: [l.location, l.workType].filter(Boolean).join(" · ") || null,
      contrat: [l.contractType, l.experienceLevel].filter(Boolean).join(" · ") || null,
      salaire: l.salary || null,
      description: l.description || null,
      publiee_le: l.postedDate || null,
      url: l.url || null,
      contact: [l.recruiterName, l.recruiterUrl].filter(Boolean).join(" — ") || null,
      mot_cle: null,
    }));
}
