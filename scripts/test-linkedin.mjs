// Coût d'une journée de recherche LinkedIn (recherches de profil.ts, 24 h, filtres de titre). Usage : node scripts/test-linkedin.mjs
import { readFileSync, writeFileSync } from "node:fs";
import ts from "typescript";

const token = readFileSync(".env.local", "utf8").match(/^APIFY_TOKEN=(.*)$/m)[1].trim().replace(/^"|"$/g, "");
const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
const js = ts.transpileModule(readFileSync("src/lib/profil.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
writeFileSync("scripts/.profil.tmp.mjs", js);
const { RECHERCHES_LINKEDIN } = await import("./.profil.tmp.mjs");
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

async function lancer({ keywords, titres, exclus }) {
  let start;
  for (;;) {
    start = await fetch("https://api.apify.com/v2/acts/valig~linkedin-jobs-scraper/runs", { method: "POST", headers: h, body: JSON.stringify({ keywords, location: "France", datePosted: "r86400", limit: 1000, titleInclude: titres, titleExclude: exclus }) });
    if (start.ok) break;
    const t = await start.text();
    if (!t.includes("concurrent")) throw new Error(`${keywords}: ${start.status} ${t}`);
    await pause(10000);
  }
  let run = (await start.json()).data;
  const t0 = Date.now();
  while (["READY", "RUNNING"].includes(run.status)) {
    await pause(5000);
    run = (await (await fetch(`https://api.apify.com/v2/actor-runs/${run.id}`, { headers: h })).json()).data;
  }
  await pause(6000);
  run = (await (await fetch(`https://api.apify.com/v2/actor-runs/${run.id}`, { headers: h })).json()).data;
  const items = await (await fetch(`https://api.apify.com/v2/datasets/${run.defaultDatasetId}/items?clean=true&limit=1000`, { headers: h })).json();
  return { keywords, status: run.status, items, usd: run.usageTotalUsd ?? 0, s: Math.round((Date.now() - t0) / 1000) };
}

const t0 = Date.now();
const res = await Promise.all(RECHERCHES_LINKEDIN.map(lancer));
const uniques = new Map();
let total = 0, usd = 0;
for (const r of res) {
  total += r.items.length; usd += r.usd;
  r.items.forEach((x) => uniques.set(x.id, x));
  console.log(`${r.keywords.padEnd(22)} ${r.status.padEnd(9)} ${String(r.items.length).padStart(4)} offres  ${r.usd.toFixed(4)} $  ${r.s} s`);
}
console.log(`\nTOTAL ${total} offres payées (${uniques.size} uniques), ${usd.toFixed(3)} $, ${Math.round((Date.now() - t0) / 1000)} s`);
console.log("Exemples :\n  " + [...uniques.values()].slice(0, 30).map((x) => `${x.title} — ${x.companyName}`).join("\n  "));
