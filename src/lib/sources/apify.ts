import type { NouvelleOffre } from "@/lib/supabase";

// Acteur Apify « All Jobs Scraper » (nomad-agent/all-jobs-scraper) : LinkedIn en direct,
// Welcome to the Jungle, YC Work at a Startup, Built In, sites remote, etc.
// Prix (octobre 2026) : 0,20 $ / 1 000 offres renvoyées + 0,05 $ / 1 000 lancements. `dedupe` ne renvoie jamais deux fois la même offre.

const ACTEUR = "nomad-agent~all-jobs-scraper";

// Deux copies du Radar sur le même compte Apify doivent avoir des clés différentes :
// avec la même clé, l'une ne recevrait jamais les offres déjà renvoyées à l'autre.
const CLE_DEDUPE = process.env.APIFY_DEDUPE_KEY?.trim() || "radar-emploi";
const MAX_OFFRES = Number(process.env.APIFY_MAX_ITEMS) || 300;

type ApifyLigne = {
  source: string;
  id: string;
  url: string | null;
  title: string;
  company: string | null;
  locations: string[];
  postedAt: string | null;
  description: string | null;
  workType: string | null;
  salary: string | null;
  employmentTypes: string[] | null;
  hiringContacts: { name: string; title: string | null; url: string | null }[];
};

// Le filtre « France » de l'acteur laisse passer des offres sans lieu (souvent Pologne, Espagne…).
const EN_FRANCE = /france|paris|île-de-france|ile-de-france/i;

function source(s: string): NouvelleOffre["source"] {
  if (/linkedin/i.test(s)) return "linkedin";
  if (/jungle|wttj/i.test(s)) return "wttj";
  return "autre";
}

// L'acteur refuse plus de 20 mots-clés par lancement : au-delà, plusieurs lancements en parallèle.
// Chaque lot a sa propre clé `dedupe` : deux exécutions simultanées sur la même clé, l'acteur tue la seconde
// (« InventoryScopeBusy », essai du 20/10). Le 1er lot garde la clé d'origine, donc son historique.
const MAX_REQUETES = 20;
export const lancementsApify = (motsCles: string[]) => Math.ceil(motsCles.length / MAX_REQUETES);

export async function rechercherApify(motsCles: string[], erreurs: string[] = []): Promise<NouvelleOffre[]> {
  const lots = Array.from({ length: lancementsApify(motsCles) }, (_, i) => motsCles.slice(i * MAX_REQUETES, (i + 1) * MAX_REQUETES));
  const cle = (i: number) => (i === 0 ? CLE_DEDUPE : `${CLE_DEDUPE}-${i + 1}`);
  const resultats = await Promise.allSettled(lots.map((lot, i) => rechercherLot(lot, cle(i))));
  // Un lot refusé (clé encore occupée, compte plein…) est relancé une fois, seul, après les autres.
  for (const [i, r] of resultats.entries()) {
    if (r.status === "rejected") resultats[i] = await rechercherLot(lots[i], cle(i)).then((value) => ({ status: "fulfilled", value }) as const, (reason) => ({ status: "rejected", reason }) as const);
  }
  const echecs = resultats.filter((r) => r.status === "rejected");
  if (echecs.length === lots.length) throw echecs[0].reason;
  echecs.forEach((r) => erreurs.push(`Apify (un lot de mots-clés) : ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`));
  return resultats.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}

async function rechercherLot(motsCles: string[], cleDedupe: string): Promise<NouvelleOffre[]> {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("APIFY_TOKEN manquant");

  const res = await fetch(`https://api.apify.com/v2/acts/${ACTEUR}/run-sync-get-dataset-items?timeout=170`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      schemaVersion: "nomad-agent-simple-inventory-search-v2",
      queries: motsCles,
      locations: ["France"],
      locationTypes: [],
      employmentTypes: [],
      postedWithin: "3d",
      maxItems: MAX_OFFRES,
      maxItemsPerSource: 80,
      dedupe: { enabled: true, key: cleDedupe },
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`erreur ${res.status} ${(await res.text()).slice(0, 120)}`);
  const lignes = (await res.json()) as ApifyLigne[];

  return lignes
    .filter((l) => l.locations.some((lieu) => EN_FRANCE.test(lieu)))
    .map((l) => ({
      source: source(l.source),
      plateforme: l.source,
      external_id: `${l.source}:${l.id}`,
      poste: l.title,
      entreprise: l.company,
      lieu: [l.locations.join(" / "), l.workType].filter(Boolean).join(" · ") || null,
      contrat: l.employmentTypes?.join(", ") ?? null,
      salaire: l.salary,
      description: l.description,
      publiee_le: l.postedAt,
      url: l.url,
      contact: l.hiringContacts.map((c) => [c.name, c.title, c.url].filter(Boolean).join(" — ")).join("\n") || null,
      mot_cle: null,
    }));
}
