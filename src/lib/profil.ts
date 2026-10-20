// Mots-clés de recherche et profil du candidat pour la notation IA.

// Mots-clés par défaut. Une autre copie du Radar (un autre candidat) les remplace
// par la variable MOTS_CLES : un mot-clé par ligne, ou séparés par « ; ».
const MOTS_CLES_DEFAUT = [
  "GTM Engineer",
  "Go-To-Market",
  "GTM",
  "Growth Engineer",
  "Growth Ops",
  "RevOps",
  "Automation Engineer",
  "automatisation n8n",
  "Make n8n",
  "ingénieur automatisation",
  "AI builder",
  "chef de projet IA",
  "consultant IA junior",
  "no-code",
  "Clay",
  "Growth Marketing",
  "Growth Hacker",
  "Marketing Automation",
  "Sales Ops",
  "outbound",
  "lead generation",
  "prospection automatisée",
  "automatisation IA",
  "marketing IA",
  "alternance growth",
  "stage growth automatisation",
  "alternance automatisation IA",
];

const motsClesEnv = (process.env.MOTS_CLES ?? "")
  .split(/[\n;]/)
  .map((m) => m.trim())
  .filter(Boolean);

export const MOTS_CLES = motsClesEnv.length ? motsClesEnv : MOTS_CLES_DEFAUT;

// Recherche LinkedIn en direct : une recherche par famille de métiers. Chacune ne garde (et ne paie) que les offres
// dont le TITRE contient tous les mots d'une de ses expressions `titres`. Les familles ne se recoupent presque pas :
// une même offre n'est donc pas payée plusieurs fois (essai du 19/10 avec un filtre commun : 166 offres, 1 126 payées).
export type RechercheLinkedIn = { keywords: string; titres: string[]; exclus?: string[] };

const RECHERCHES_LINKEDIN_DEFAUT: RechercheLinkedIn[] = [
  { keywords: "Go-To-Market", titres: ["gtm", "go to market"] },
  { keywords: "growth", titres: ["growth"] },
  { keywords: "RevOps", titres: ["revops", "rev ops", "revenue operations", "revenue systems", "revenue ops"] },
  { keywords: "Sales Ops", titres: ["sales ops", "sales operations", "marketing ops", "marketing operations", "business ops"] },
  { keywords: "automatisation", titres: ["automatisation", "automatisations", "automation"], exclus: ["test", "tests", "qa", "industriel", "industrielle", "automate", "automatisme", "électrique", "plc"] },
  { keywords: "no-code", titres: ["no code", "nocode", "low code", "lowcode", "n8n", "make", "zapier", "clay"] },
  { keywords: "IA", titres: ["ai builder", "product builder", "chef de projet ia", "cheffe de projet ia", "consultant ia", "consultante ia", "adoption ia", "ia générative", "marketing ia", "ai marketing", "ai go to market", "ai operations", "ai ops"] },
  { keywords: "outbound", titres: ["outbound", "lead generation", "lead gen", "prospection", "demand generation"] },
  { keywords: "marketing automation", titres: ["marketing automation", "crm", "lifecycle"] },
];

// Postes seniors écartés avant facturation, pour toutes les recherches.
const EXCLUS_COMMUNS = ["senior", "sr", "head", "director", "directeur", "directrice", "vp", "chief", "cmo", "cto", "principal", "staff"];

// Une autre copie du Radar (variable MOTS_CLES) : une recherche par mot-clé, titre contenant ce mot-clé.
export const RECHERCHES_LINKEDIN: RechercheLinkedIn[] = (
  motsClesEnv.length
    ? // « alternance » / « stage » restent dans la recherche, mais pas dans le filtre du titre (rarement écrits dans le titre).
      motsClesEnv.map((m): RechercheLinkedIn => ({ keywords: m, titres: [m.replace(/\b(alternance|alternant|stage|stagiaire)\b/gi, " ").replace(/\s+/g, " ").trim() || m] }))
    : RECHERCHES_LINKEDIN_DEFAUT
).map((r) => ({ ...r, exclus: [...EXCLUS_COMMUNS, ...(r.exclus ?? [])] }));

// Le vrai profil (salaire, lieu, limites) reste privé : variable PROFIL_CANDIDAT dans .env.local / Vercel.
// Ce texte d'exemple sert seulement si elle est absente.
const PROFIL_EXEMPLE = `
Candidat : profil junior Growth / automatisation, Île-de-France.
- Formation commerce et acquisition numérique + développement web.
- Expérience : outils internes, prospection automatisée (scraping, enrichissement, import CRM), intégrations API.
- Outils : n8n, Make, Apollo, Supabase, Next.js, Claude Code.

Postes visés :
- A : GTM Engineer, Growth Engineer, Growth Ops, RevOps, AI Automation Engineer.
- B : chef de projet IA ou digital, consultant IA junior.
- « Automatisation » veut dire automatisation des processus métier (workflows n8n / Make, CRM, prospection, agents IA), PAS l'automatisation de tests logiciels ni l'automatisme industriel.
- À écarter : QA, automatisme industriel, DevOps pur, postes de manager, postes seniors, commerciaux purs.
- Stages, alternances et freelances acceptés si le métier colle parfaitement.

Conditions :
- Lieu : Paris et petite couronne, ou remote / hybride. Toutes tailles d'entreprise. Tous types de contrat.
`.trim();

export const PROFIL = process.env.PROFIL_CANDIDAT?.trim() || PROFIL_EXEMPLE;
