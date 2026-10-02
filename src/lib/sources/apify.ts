import type { NouvelleOffre } from "@/lib/supabase";

// Acteur Apify « All Jobs Scraper » (nomad-agent/all-jobs-scraper) : LinkedIn en direct,
// Welcome to the Jungle, YC Work at a Startup, Built In, sites remote, etc.
// Prix : 1,20 $ / 1 000 offres renvoyées. `dedupe` ne renvoie jamais deux fois la même offre.

const ACTEUR = "nomad-agent~all-jobs-scraper";

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

export async function rechercherApify(motsCles: string[]): Promise<NouvelleOffre[]> {
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
      maxItems: 100,
      maxItemsPerSource: 40,
      dedupe: { enabled: true, key: "radar-emploi" },
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
