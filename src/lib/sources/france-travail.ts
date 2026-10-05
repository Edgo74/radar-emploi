import type { NouvelleOffre } from "@/lib/supabase";

// API officielle « Offres d'emploi v2 » de France Travail (francetravail.io).
// Authentification OAuth2 client_credentials, realm /partenaire.

const TOKEN_URL = "https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=%2Fpartenaire";
const SEARCH_URL = "https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search";

type FtOffre = {
  id: string;
  intitule: string;
  description?: string;
  dateCreation?: string;
  entreprise?: { nom?: string };
  lieuTravail?: { libelle?: string };
  typeContratLibelle?: string;
  salaire?: { libelle?: string };
  origineOffre?: { urlOrigine?: string };
};

export async function token(scope = "api_offresdemploiv2 o2dsoffre") {
  const id = process.env.FRANCE_TRAVAIL_CLIENT_ID;
  const secret = process.env.FRANCE_TRAVAIL_CLIENT_SECRET;
  if (!id || !secret) throw new Error("FRANCE_TRAVAIL_CLIENT_ID ou FRANCE_TRAVAIL_CLIENT_SECRET manquant");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: id,
      client_secret: secret,
      scope,
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`authentification refusée (${res.status})`);
  return ((await res.json()) as { access_token: string }).access_token;
}

export async function rechercherFranceTravail(motsCles: string[], joursMax: 1 | 3 | 7 = 3): Promise<NouvelleOffre[]> {
  const jeton = await token();
  const offres: NouvelleOffre[] = [];

  for (const motCle of motsCles) {
    const params = new URLSearchParams({ motsCles: motCle, publieeDepuis: String(joursMax), range: "0-49" });
    const res = await fetch(`${SEARCH_URL}?${params}`, {
      headers: { Authorization: `Bearer ${jeton}`, Accept: "application/json" },
      cache: "no-store",
    });
    if (res.status === 204) continue; // aucune offre
    if (!res.ok) throw new Error(`« ${motCle} » : erreur ${res.status}`);
    const { resultats = [] } = (await res.json()) as { resultats?: FtOffre[] };

    for (const o of resultats) {
      offres.push({
        source: "france_travail",
        external_id: o.id,
        poste: o.intitule,
        entreprise: o.entreprise?.nom ?? null,
        lieu: o.lieuTravail?.libelle ?? null,
        contrat: o.typeContratLibelle ?? null,
        salaire: o.salaire?.libelle ?? null,
        description: o.description ?? null,
        publiee_le: o.dateCreation ?? null,
        url: `https://candidat.francetravail.fr/offres/recherche/detail/${o.id}`,
        mot_cle: motCle,
      });
    }
    await new Promise((r) => setTimeout(r, 250)); // l'API limite le nombre d'appels par seconde
  }
  return offres;
}
