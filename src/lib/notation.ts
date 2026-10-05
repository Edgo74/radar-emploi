import "server-only";
import { PROFIL } from "@/lib/profil";
import type { Niveau, Offre } from "@/lib/supabase";

export type Notation = { niveau: Niveau; raison: string; message: string; cv_variante: string };

// Écarte sans appeler l'IA ce qui ne correspond jamais (économise des tokens).
const EXCLUS = /\b(stage|stagiaire|alternance|alternant|apprenti|apprentissage|intern(ship)?|senior|sr\.?|principal|staff|head of|directeur|director|vp)\b/i;

export function filtreRapide(poste: string): Notation | null {
  const m = poste.match(EXCLUS);
  if (!m) return null;
  return { niveau: "X", raison: `Écartée automatiquement : « ${m[0]} » dans l'intitulé.`, message: "", cv_variante: "" };
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["niveau", "raison", "message", "cv_variante"],
  properties: {
    niveau: { type: "string", enum: ["A", "B", "X"] },
    raison: { type: "string", description: "1 à 2 phrases : pourquoi ce niveau (poste, lieu, salaire, séniorité)." },
    message: {
      type: "string",
      description: "Si A ou B : 3 lignes de candidature en français, ton direct, à la première personne, qui relient un projet réel du candidat au besoin de l'offre. Pas de formule creuse. Si X : chaîne vide.",
    },
    cv_variante: { type: "string", description: "Si A ou B : l'angle du CV à mettre en avant en quelques mots (ex. « GTM / automatisation »). Si X : chaîne vide." },
  },
} as const;

export async function noterOffre(o: Pick<Offre, "poste" | "entreprise" | "lieu" | "contrat" | "salaire" | "description">): Promise<Notation> {
  const rapide = filtreRapide(o.poste);
  if (rapide) return rapide;

  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY manquant");

  const offreTexte = [
    `Poste : ${o.poste}`,
    `Entreprise : ${o.entreprise ?? "inconnue"}`,
    `Lieu : ${o.lieu ?? "inconnu"}`,
    `Contrat : ${o.contrat ?? "inconnu"}`,
    `Salaire : ${o.salaire ?? "non indiqué"}`,
    `Description :\n${(o.description ?? "(aucune)").slice(0, 6000)}`,
  ].join("\n");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
      messages: [
        {
          role: "system",
          content: `Tu tries des offres d'emploi pour un candidat. Note A (poste idéal), B (ça colle bien) ou X (à écarter), selon ce profil et cette stratégie. Écarte (X) ce qui est clairement hors cible (autre métier, séniorité, lieu). Si l'intitulé fait partie des postes A ou B visés et que le lieu convient, ne l'écarte pas faute de détails : mets au moins B. Les 3 lignes sont à la première personne et n'utilisent que les faits du profil (pas d'outil, de chiffre ou de mission inventés). N'invente aucun fait sur le candidat.\n\n${PROFIL}`,
        },
        { role: "user", content: offreTexte },
      ],
      response_format: { type: "json_schema", json_schema: { name: "notation", strict: true, schema: SCHEMA } },
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`OpenAI : erreur ${res.status}`);
  const data = (await res.json()) as { choices: { message: { content: string } }[] };
  return JSON.parse(data.choices[0].message.content) as Notation;
}

// ── Événements France Travail ──────────────────────────────────────────────

export type NotationEvenement = { niveau: Niveau; raison: string };

const SCHEMA_EVENEMENT = {
  type: "object",
  additionalProperties: false,
  required: ["niveau", "raison"],
  properties: {
    niveau: { type: "string", enum: ["A", "B", "X"] },
    raison: { type: "string", description: "1 phrase : pourquoi ce niveau, et ce que le candidat y gagnerait." },
  },
} as const;

export async function noterEvenement(e: { titre: string; type: string | null; organisateur: string | null; modalites: string[] | null; description: string | null }): Promise<NotationEvenement> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY manquant");

  const texte = [
    `Titre : ${e.titre}`,
    `Type : ${e.type ?? "inconnu"}`,
    `Organisateur : ${e.organisateur ?? "inconnu"}`,
    `Modalités : ${e.modalites?.join(", ") || "inconnues"}`,
    `Description :\n${(e.description ?? "(aucune)").slice(0, 4000)}`,
  ].join("\n");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
      messages: [
        {
          role: "system",
          content: `Tu tries des événements emploi France Travail (Île-de-France) pour un candidat. Note :
- A : POEI ou POEC (formation financée avant embauche) ou recrutement sur un métier du profil (growth, marketing digital, GTM, automatisation, IA appliquée, développement web, sales B2B tech, chef de projet digital) ; ou job dating / forum avec des startups ou entreprises tech qui recrutent ces profils.
- B : utile mais indirect : rencontre avec des recruteurs tech, présentation d'une formation numérique de niveau bac+3 ou plus, réseau cadres (APEC, NQT) avec un angle numérique.
- X : tout le reste : autres métiers (industrie, logistique, sécurité, armée, restauration, aide à la personne, BTP…), ateliers génériques (CV, LinkedIn, « l'IA pour chercher un emploi », bureautique, initiation au numérique), création d'entreprise, programmes seniors, événements réservés à un public que le candidat n'est pas.
Une POEI ou POEC sur un métier du numérique est une vraie piste pour ce candidat.

${PROFIL}`,
        },
        { role: "user", content: texte },
      ],
      response_format: { type: "json_schema", json_schema: { name: "notation_evenement", strict: true, schema: SCHEMA_EVENEMENT } },
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`OpenAI : erreur ${res.status}`);
  const data = (await res.json()) as { choices: { message: { content: string } }[] };
  return JSON.parse(data.choices[0].message.content) as NotationEvenement;
}
