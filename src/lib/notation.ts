import "server-only";
import { PROFIL } from "@/lib/profil";
import type { Niveau, Offre } from "@/lib/supabase";

export type Notation = { niveau: Niveau; raison: string; message: string; cv_variante: string };

// Écarte sans appeler l'IA ce qui ne correspond jamais (économise des tokens).
// Stages, alternances et freelances ne sont plus exclus : l'IA les garde s'ils collent au profil.
const EXCLUS = /\b(senior|sr\.?|principal|staff|head of|directeur|director|vp)\b/i;

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
    raison: { type: "string", description: "1 à 2 phrases : ce que le candidat maîtrise déjà pour ce poste, ce qui lui manque, et le type de contrat." },
    message: {
      type: "string",
      description: "Si A ou B : 3 lignes de candidature en français, ton direct, à la première personne, qui relient un projet réel du candidat au besoin de l'offre. Pas de formule creuse. Si X : chaîne vide.",
    },
    cv_variante: { type: "string", description: "Si A ou B : l'angle du CV à mettre en avant en quelques mots (ex. « GTM / automatisation »). Si X : chaîne vide." },
  },
} as const;

// ── Appels OpenAI espacés ──────────────────────────────────────────────────
// Le compte a droit à 200 000 tokens par minute ; une offre en consomme environ 3 000.
// On estime chaque appel et on attend tant que la minute écoulée dépasserait 150 000 tokens.
const FENETRE_MS = 60_000;
const BUDGET_TOKENS = 150_000;
const consommes: { t: number; n: number }[] = [];
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function attendreBudget(n: number) {
  for (;;) {
    const maintenant = Date.now();
    while (consommes.length && maintenant - consommes[0].t > FENETRE_MS) consommes.shift();
    const total = consommes.reduce((s, c) => s + c.n, 0);
    if (total + n <= BUDGET_TOKENS) {
      consommes.push({ t: maintenant, n });
      return;
    }
    await pause(Math.max(250, FENETRE_MS - (maintenant - consommes[0].t)));
  }
}

// « 1.2s », « 120ms », « 1m30s » → millisecondes.
function enMs(v: string | null): number | null {
  if (!v) return null;
  if (/^\d+(\.\d+)?$/.test(v)) return Number(v) * 1000; // retry-after en secondes
  let ms = 0;
  for (const [, n, u] of v.matchAll(/(\d+(?:\.\d+)?)(ms|s|m|h)/g)) ms += Number(n) * { ms: 1, s: 1000, m: 60_000, h: 3_600_000 }[u as "ms"];
  return ms || null;
}

export class LimiteOpenAI extends Error {}

async function appelerOpenAI<T>(messages: { role: string; content: string }[], nom: string, schema: object): Promise<T> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY manquant");
  const estimation = Math.ceil(JSON.stringify(messages).length / 3) + 600;

  for (let essai = 0; ; essai++) {
    await attendreBudget(estimation);
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
        messages,
        response_format: { type: "json_schema", json_schema: { name: nom, strict: true, schema } },
      }),
      cache: "no-store",
    });
    if (res.status === 429) {
      if (essai >= 4) throw new LimiteOpenAI("OpenAI : limite atteinte");
      const attente = enMs(res.headers.get("retry-after")) ?? enMs(res.headers.get("x-ratelimit-reset-tokens")) ?? 2000 * 2 ** essai;
      await pause(Math.min(Math.max(attente, 1000), 20_000) + Math.random() * 500);
      continue;
    }
    if (!res.ok) throw new Error(`OpenAI : erreur ${res.status}`);
    const data = (await res.json()) as { choices: { message: { content: string } }[] };
    return JSON.parse(data.choices[0].message.content) as T;
  }
}

export async function noterOffre(o: Pick<Offre, "poste" | "entreprise" | "lieu" | "contrat" | "salaire" | "description">): Promise<Notation> {
  const rapide = filtreRapide(o.poste);
  if (rapide) return rapide;

  const offreTexte = [
    `Poste : ${o.poste}`,
    `Entreprise : ${o.entreprise ?? "inconnue"}`,
    `Lieu : ${o.lieu ?? "inconnu"}`,
    `Contrat : ${o.contrat ?? "inconnu"}`,
    `Salaire : ${o.salaire ?? "non indiqué"}`,
    `Description :\n${(o.description ?? "(aucune)").slice(0, 4500)}`,
  ].join("\n");

  return appelerOpenAI<Notation>(
      [
        {
          role: "system",
          content: `Tu tries des offres d'emploi pour un candidat. La seule question : en lisant son CV, l'employeur le prendrait-il ? Note selon l'adéquation entre les compétences et l'expérience réelles du candidat (profil ci-dessous) et ce que l'offre demande.
- A : le candidat maîtrise presque tout ce que le poste demande, il pourrait même être un peu surqualifié (tâches, outils, niveau, salaire). Au plus un petit manque facile à combler.
- B : il maîtrise l'essentiel ; il manque une ou deux choses (un outil précis, un peu d'anglais, une partie du métier).
- X : l'écart est trop grand : autre métier, compétences centrales qu'il n'a pas, ou lieu impossible.
Expérience : si l'offre exige explicitement 3 ans ou plus d'expérience sur le poste, c'est au mieux B (et X si 5 ans ou plus), même si les tâches collent.
La taille ou la notoriété de l'entreprise ne compte PAS : un grand groupe qui colle vaut A comme une startup.
Type de contrat : CDI, CDD, freelance, stage et alternance sont tous acceptés. Un stage ou une alternance qui colle vaut A ou B ; une exigence de statut étudiant ou d'école n'est pas une raison d'écarter (signale-la dans la raison).
Si l'intitulé fait partie des postes A ou B visés et que le lieu convient, ne l'écarte pas faute de détails : mets au moins B. Les 3 lignes sont à la première personne et n'utilisent que les faits du profil (pas d'outil, de chiffre ou de mission inventés). N'invente aucun fait sur le candidat.

${PROFIL}`,
        },
        { role: "user", content: offreTexte },
      ],
      "notation",
      SCHEMA,
  );
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
  const texte = [
    `Titre : ${e.titre}`,
    `Type : ${e.type ?? "inconnu"}`,
    `Organisateur : ${e.organisateur ?? "inconnu"}`,
    `Modalités : ${e.modalites?.join(", ") || "inconnues"}`,
    `Description :\n${(e.description ?? "(aucune)").slice(0, 4000)}`,
  ].join("\n");

  return appelerOpenAI<NotationEvenement>(
      [
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
      "notation_evenement",
      SCHEMA_EVENEMENT,
  );
}
