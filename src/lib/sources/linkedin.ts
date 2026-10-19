import type { RechercheLinkedIn } from "@/lib/profil";
import { db, type NouvelleOffre } from "@/lib/supabase";

// LinkedIn en direct via l'acteur Apify valig/linkedin-jobs-scraper : la même recherche que sur linkedin.com/jobs,
// contrairement à « All Jobs Scraper » qui ne cherche que dans sa propre base (200 offres max par lancement).
// Prix (octobre 2026) : 0,40 $ / 1 000 offres + 0,001 $ par lancement. Pas de plafond d'offres de notre côté :
// la seule limite est le budget mensuel du compte Apify.
// Une recherche par famille de métiers (les « OR » LinkedIn ramènent n'importe quoi), filtrée sur le titre : les offres
// écartées par `titleInclude` / `titleExclude` ne sont pas facturées (essai du 19/10 : 6 offres facturées, Déluj trouvée).

const ACTEUR = "valig~linkedin-jobs-scraper";
const LIMITE_ACTEUR = 1000; // maximum accepté par l'acteur pour une recherche
const JOURS = 7; // offres déjà en base sautées sur cette durée (fenêtre max de recherche)
const ATTENTE_MAX_MS = 150_000;

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

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function rechercherLinkedIn(recherches: RechercheLinkedIn[], erreurs: string[]): Promise<NouvelleOffre[]> {
  const motsCles = recherches.map((r) => r.keywords);
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("APIFY_TOKEN manquant");
  const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const api = async <T>(chemin: string, init?: RequestInit) => {
    const r = await fetch(`https://api.apify.com/v2/${chemin}`, { ...init, headers: h, cache: "no-store" });
    if (!r.ok) throw new Error(`Apify ${r.status} ${(await r.text()).slice(0, 150)}`);
    return (await r.json()) as T;
  };

  // Offres LinkedIn déjà en base : l'acteur les saute, on ne les paie pas deux fois.
  const depuis = new Date(Date.now() - (JOURS + 1) * 864e5).toISOString();
  const { data: connues } = await db().from("offres").select("external_id").eq("source", "linkedin").gte("created_at", depuis).limit(10_000);
  const skipJobId = [...new Set((connues ?? []).map((o) => o.external_id.match(/(\d{6,})$/)?.[1]).filter(Boolean))];

  // 1. Une exécution par recherche, en parallèle, sur les offres des dernières 24 h (le cron passe chaque jour).
  // Si Apify refuse faute de place, on réessaie toutes les 10 s.
  const lancees: Run[] = [];
  await Promise.all(
    recherches.map(async ({ keywords, titres, exclus }) => {
      const input = { keywords, location: "France", datePosted: "r86400", limit: LIMITE_ACTEUR, titleInclude: titres, titleExclude: exclus, skipJobId };
      for (let essai = 0; essai < 8; essai++) {
        try {
          lancees.push((await api<{ data: Run }>(`acts/${ACTEUR}/runs`, { method: "POST", body: JSON.stringify(input) })).data);
          return;
        } catch (e) {
          if (!String(e).includes("concurrent") || essai === 7) {
            erreurs.push(`LinkedIn « ${keywords} » : ${e instanceof Error ? e.message : String(e)}`);
            return;
          }
          await pause(10_000);
        }
      }
    }),
  );

  // 2. Attendre la fin. Une exécution encore en cours n'est pas arrêtée : elle sera relue au prochain passage (étape 3).
  const fin = Date.now() + ATTENTE_MAX_MS;
  while (lancees.length && Date.now() < fin) {
    const statuts = await Promise.all(lancees.map((r) => api<{ data: Run }>(`actor-runs/${r.id}`).then((x) => x.data.status)));
    if (statuts.every((s) => !["READY", "RUNNING"].includes(s))) break;
    await pause(5000);
  }

  // 3. Relire les exécutions réussies des 2 derniers jours lancées par ce Radar (mêmes mots-clés) :
  // celles de ce passage, et celles d'un passage précédent qui n'avaient pas fini à temps. La base écarte les doublons.
  const { data: recentes } = await api<{ data: { items: Run[] } }>(`acts/${ACTEUR}/runs?desc=1&limit=100&status=SUCCEEDED`);
  const deuxJours = Date.now() - 2 * 864e5;
  const aLire: Run[] = [];
  for (const r of recentes.items.filter((r) => Date.parse(r.startedAt) > deuxJours)) {
    const input = await api<{ keywords?: string; location?: string }>(`key-value-stores/${r.defaultKeyValueStoreId}/records/INPUT`).catch(() => null);
    if (input?.location === "France" && input.keywords && motsCles.includes(input.keywords)) aLire.push(r);
  }

  const lignes: Ligne[] = [];
  for (const r of aLire) {
    for (let offset = 0; ; offset += 1000) {
      const page = await api<Ligne[]>(`datasets/${r.defaultDatasetId}/items?clean=true&offset=${offset}&limit=1000`);
      lignes.push(...page);
      if (page.length < 1000) break;
    }
  }
  const enCours = lancees.filter((l) => !aLire.some((r) => r.id === l.id)).length;
  if (enCours > 0) erreurs.push(`LinkedIn : ${enCours} recherche(s) pas finie(s) à temps, relue(s) au prochain passage.`);

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
