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
- À écarter : QA, automatisme industriel, DevOps pur, postes de manager, postes seniors, stages, alternances, commerciaux purs.

Conditions :
- Lieu : Paris et petite couronne, ou remote / hybride. CDI de préférence.
`.trim();

export const PROFIL = process.env.PROFIL_CANDIDAT?.trim() || PROFIL_EXEMPLE;
