import type { NouvelleOffre } from "@/lib/supabase";

// API Adzuna (developer.adzuna.com) : agrège Indeed et d'autres sites d'emploi.
// Offre gratuite : environ 25 appels/minute et 250/jour, largement assez pour un passage par jour.

type AdzunaOffre = {
  id: string;
  title: string;
  description?: string;
  created?: string;
  redirect_url?: string;
  company?: { display_name?: string };
  location?: { display_name?: string };
  contract_type?: string;
  salary_min?: number;
  salary_max?: number;
};

const propre = (s: string) => s.replace(/<\/?strong>/g, "");

// Adzuna renvoie parfois un 503 passager : on réessaie deux fois, puis on saute ce mot-clé
// (noté dans `erreurs`) sans perdre les offres des autres.
async function chercher(url: string) {
  for (let essai = 0; ; essai++) {
    const res = await fetch(url, { cache: "no-store" });
    if (res.ok || essai >= 2 || (res.status < 500 && res.status !== 429)) return res;
    await new Promise((r) => setTimeout(r, 2000 * (essai + 1)));
  }
}

export async function rechercherAdzuna(motsCles: string[], erreurs: string[] = [], joursMax = 3): Promise<NouvelleOffre[]> {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) throw new Error("ADZUNA_APP_ID ou ADZUNA_APP_KEY manquant");
  const offres: NouvelleOffre[] = [];

  for (const motCle of motsCles) {
    const params = new URLSearchParams({
      app_id: appId,
      app_key: appKey,
      what_phrase: motCle,
      max_days_old: String(joursMax),
      results_per_page: "50",
      sort_by: "date",
    });
    const res = await chercher(`https://api.adzuna.com/v1/api/jobs/fr/search/1?${params}`);
    if (!res.ok) {
      erreurs.push(`Adzuna : « ${motCle} » sauté (erreur ${res.status}), les autres mots-clés sont passés.`);
      continue;
    }
    const { results = [] } = (await res.json()) as { results?: AdzunaOffre[] };

    for (const o of results) {
      const salaire =
        o.salary_min && o.salary_max ? `${Math.round(o.salary_min / 1000)}–${Math.round(o.salary_max / 1000)} k€ (estimé)` : null;
      offres.push({
        source: "adzuna",
        external_id: String(o.id),
        poste: propre(o.title),
        entreprise: o.company?.display_name ?? null,
        lieu: o.location?.display_name ?? null,
        contrat: o.contract_type ?? null,
        salaire,
        description: o.description ? propre(o.description) : null, // extrait de ~500 caractères seulement
        publiee_le: o.created ?? null,
        url: o.redirect_url ?? null,
        mot_cle: motCle,
      });
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return offres;
}
