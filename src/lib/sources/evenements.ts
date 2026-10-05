import { token } from "@/lib/sources/france-travail";

// API officielle « Mes Évènements Emploi » de France Travail (francetravail.io).
// Même application et mêmes identifiants que les offres, autre scope.
// POST /mee/evenements, 100 événements par page au maximum ; seul le filtre « departements » sert ici.

const URL_EVENEMENTS = "https://api.francetravail.io/partenaire/evenements/v1/mee/evenements";
const DEPARTEMENTS = ["75", "77", "78", "91", "92", "93", "94", "95"]; // Île-de-France

type FtEvenement = {
  id: number;
  titre: string;
  type?: string;
  dateEvenement?: string;
  ville?: string;
  codePostal?: string;
  modalites?: string[];
  libelleOrganisateurPrincipal?: string;
  libelleEtablissement?: string;
  urlDetailEvenement?: string;
  description?: string;
  deroulement?: string;
  codesRome?: string[];
};

export type NouvelEvenement = {
  id: number;
  titre: string;
  type: string | null;
  date_evenement: string | null;
  ville: string | null;
  code_postal: string | null;
  modalites: string[] | null;
  organisateur: string | null;
  url: string | null;
  description: string | null;
  formation: boolean;
};

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Présélection large (le site n'a pas de recherche par mot-clé) ; l'IA fait le vrai tri ensuite.
const NUMERIQUE =
  /\b(numerique|digital|developpeu[rs]e?|developpement web|web|data|intelligence artificielle|ia|automatisation|no.?code|growth|marketing|community manager|informatique|tech|startup|start-up|saas|product manager|business develop\w*|sales|customer success|chef de projet digital|cyber\w*|cloud|logiciel)\b/;
// Codes ROME : informatique (M18), communication / médias (E11, E12), marketing et commerce B2B (M17…).
const ROME = /^(M18|E11|E12|M17|M1403|M1705|M1707)/;
const FORMATION = /\b(poei|poec|preparation operationnelle|formation financee)\b/;

export async function rechercherEvenements(): Promise<NouvelEvenement[]> {
  const jeton = await token("api_evenementsv1 evenements");
  const trouves: FtEvenement[] = [];

  for (let page = 0; page < 50; page++) {
    const res = await fetch(`${URL_EVENEMENTS}?page=${page}&size=100`, {
      method: "POST",
      headers: { Authorization: `Bearer ${jeton}`, Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ departements: DEPARTEMENTS }),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`page ${page} : erreur ${res.status}`);
    const { content = [] } = (await res.json()) as { content?: FtEvenement[] };
    trouves.push(...content);
    if (content.length < 100) break;
    await new Promise((r) => setTimeout(r, 150)); // limite : 10 appels par seconde
  }

  return trouves
    .filter((e) => NUMERIQUE.test(norm(`${e.titre} ${e.description ?? ""}`)) || (e.codesRome ?? []).some((c) => ROME.test(c)))
    .map((e) => {
      const description = [e.description, e.deroulement].filter(Boolean).join("\n\n");
      return {
        id: e.id,
        titre: e.titre.trim(),
        type: e.type ?? null,
        date_evenement: e.dateEvenement ?? null,
        ville: e.ville ?? null,
        code_postal: e.codePostal ?? null,
        modalites: e.modalites ?? null,
        organisateur: e.libelleEtablissement ?? e.libelleOrganisateurPrincipal ?? null,
        url: e.urlDetailEvenement ?? `https://mesevenementsemploi.francetravail.fr/mes-evenements-emploi/evenement/${e.id}`,
        description: description.slice(0, 4000) || null,
        formation: FORMATION.test(norm(`${e.titre} ${description}`)),
      };
    });
}
