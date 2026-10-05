// Mots-clés de recherche et profil du candidat pour la notation IA.

export const MOTS_CLES = [
  "GTM Engineer",
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
  "alternance growth",
  "stage growth automatisation",
  "alternance automatisation IA",
];

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
- À écarter : QA, automatisme industriel, DevOps pur, postes de manager, postes seniors, commerciaux purs, grands groupes et scale-ups très connues.
- Stages, alternances et freelances acceptés si le métier colle parfaitement.

Conditions :
- Lieu : Paris et petite couronne, ou remote / hybride. Petites startups et PME. Tous types de contrat.
`.trim();

export const PROFIL = process.env.PROFIL_CANDIDAT?.trim() || PROFIL_EXEMPLE;
