// Diagnostic en lecture seule : volumes LinkedIn par jour et présence de Déluj.
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^"|"$/g, "")]),
);
const h = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` };
const get = async (q) => {
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/${q}`, { headers: h });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
};

const recups = await get("recuperations?select=lancee_le,declencheur,trouvees,nouvelles,erreurs&order=lancee_le.desc&limit=8");
console.log("Dernières récupérations :");
for (const r of recups) console.log(` ${r.lancee_le.slice(0, 16)} ${r.declencheur} trouvées=${r.trouvees} nouvelles=${r.nouvelles}${r.erreurs ? " | " + r.erreurs.split("\n")[0].slice(0, 120) : ""}`);

const depuis = new Date(Date.now() - 8 * 864e5).toISOString();
const offres = await get(`offres?select=created_at,source,plateforme&created_at=gte.${depuis}&limit=5000`);
const parJour = {};
for (const o of offres) {
  const j = o.created_at.slice(0, 10);
  const p = o.plateforme ?? o.source;
  parJour[j] ??= {};
  parJour[j][p] = (parJour[j][p] ?? 0) + 1;
}
console.log("\nOffres ajoutées par jour et plateforme :");
for (const [j, p] of Object.entries(parJour).sort()) console.log(` ${j}`, JSON.stringify(p));

const deluj = await get("offres?select=poste,entreprise,plateforme,niveau,created_at&or=(entreprise.ilike.*luj*,poste.ilike.*go-to-market*,poste.ilike.*go%20to%20market*)");
console.log("\nDéluj / Go-To-Market :", deluj.length ? deluj : "aucune");
