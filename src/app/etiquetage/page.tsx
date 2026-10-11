import Link from "next/link";
import { annulerDerniere, etiqueter } from "@/app/etiquetage/actions";
import { BoutonEnvoi } from "@/components/BoutonEnvoi";
import { db, type Niveau, type Offre } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// Jeu de test : 40 offres réparties selon la note de l'IA, pour voir à la fois
// les A/B qu'elle donne en trop et les X qu'elle écarte à tort.
const CIBLES: Record<Niveau, number> = { A: 13, B: 15, X: 12 };
const TOTAL = CIBLES.A + CIBLES.B + CIBLES.X;
const NIVEAUX: Niveau[] = ["A", "B", "X"];

type Candidate = { id: string; niveau: Niveau; raison: string | null; poste: string };

// Empreinte d'un uuid : mélange les offres sans hasard (le rendu reste reproductible).
const melange = (id: string) => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);

export default async function Etiquetage({ searchParams }: PageProps<"/etiquetage">) {
  const sp = await searchParams;
  const resultats = sp.vue === "resultats";
  const supabase = db();

  // Les offres écartées par la regex ne passent pas par l'IA : on ne les mesure pas.
  const [{ data: candidates, error }, { data: etiquettes }] = await Promise.all([
    supabase
      .from("offres")
      .select("id, niveau, raison, poste")
      .not("niveau", "is", null)
      .not("description", "is", null)
      .not("raison", "like", "Écartée automatiquement%")
      .limit(5000),
    supabase.from("etiquettes").select("offre_id, niveau"),
  ]);

  const parId = new Map((candidates as Candidate[] | null)?.map((c) => [c.id, c]));
  const miennes = new Map((etiquettes ?? []).map((e) => [e.offre_id as string, e.niveau as Niveau]));
  const faites = [...miennes.keys()].filter((id) => parId.has(id));

  // Prochaine offre : celle demandée (après « Annuler »), sinon une offre au hasard
  // dans le niveau IA le moins couvert par rapport à sa cible.
  let suivante: Offre | null = null;
  if (!resultats) {
    let id = typeof sp.offre === "string" && !miennes.has(sp.offre) ? sp.offre : null;
    if (!id && faites.length < TOTAL) {
      const restant = NIVEAUX.map((n) => ({ n, manque: CIBLES[n] - faites.filter((f) => parId.get(f)?.niveau === n).length }))
        .filter((r) => r.manque > 0)
        .sort((a, b) => b.manque - a.manque);
      // Ordre mélangé mais stable (par empreinte de l'id) ; « Passer » avance d'un cran.
      const saut = Number(sp.saut) || 0;
      for (const { n } of restant) {
        const pool = (candidates as Candidate[]).filter((c) => c.niveau === n && !miennes.has(c.id)).sort((a, b) => melange(a.id) - melange(b.id));
        if (pool.length) {
          id = pool[saut % pool.length].id;
          break;
        }
      }
    }
    if (id) suivante = (await supabase.from("offres").select("*").eq("id", id).single()).data as Offre | null;
  }

  // Mesure : la note de l'IA (lignes) contre la tienne (colonnes).
  const paires = faites.map((id) => ({ ia: parId.get(id)!.niveau, moi: miennes.get(id)!, offre: parId.get(id)! }));
  const matrice = NIVEAUX.map((ia) => NIVEAUX.map((moi) => paires.filter((p) => p.ia === ia && p.moi === moi).length));
  const accord = paires.filter((p) => p.ia === p.moi).length;
  const gardeesIA = paires.filter((p) => p.ia !== "X");
  const enTrop = gardeesIA.filter((p) => p.moi === "X").length;
  const ecarteesIA = paires.filter((p) => p.ia === "X");
  const manquees = ecarteesIA.filter((p) => p.moi !== "X").length;
  const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)} %` : "–");
  const desaccords = paires.filter((p) => p.ia !== p.moi);

  return (
    <main className="page">
      <header className="entete">
        <div>
          <h1>Jeu de test</h1>
          <p className="sous-titre">
            {faites.length} / {TOTAL} offres notées par toi · la note de l&apos;IA est cachée pour ne pas t&apos;influencer
          </p>
          {error && <p className="erreur">Base de données : {error.message}</p>}
        </div>
        <Link href="/" className="bouton secondaire">
          Retour au radar
        </Link>
      </header>

      <nav className="onglets">
        <Link href="/etiquetage" className={resultats ? "onglet" : "onglet actif"}>
          Noter
        </Link>
        <Link href="/etiquetage?vue=resultats" className={resultats ? "onglet actif" : "onglet"}>
          Résultats <span className="compte">{faites.length}</span>
        </Link>
      </nav>

      {!resultats && (
        <>
          <p className="raison">
            <strong>A</strong> : tu coches presque tout, l&apos;employeur te prendrait. <strong>B</strong> : l&apos;essentiel colle, il manque une ou deux
            choses. <strong>X</strong> : autre métier, ou écart trop grand. Note ce que tu penses vraiment, pas ce que l&apos;IA dirait.
          </p>

          {!suivante && faites.length >= TOTAL && (
            <p className="vide">
              C&apos;est fini : les {TOTAL} offres sont notées. <Link href="/etiquetage?vue=resultats">Voir les résultats</Link>
            </p>
          )}
          {!suivante && faites.length < TOTAL && <p className="vide">Plus d&apos;offre disponible à noter.</p>}

          {suivante && (
            <article className="carte">
              <div className="carte-haut">
                <div className="carte-titre">
                  <h2>{suivante.url ? <a href={suivante.url} target="_blank" rel="noreferrer">{suivante.poste}</a> : suivante.poste}</h2>
                  <p className="meta">{[suivante.entreprise, suivante.lieu, suivante.contrat, suivante.salaire].filter(Boolean).join(" · ")}</p>
                </div>
              </div>
              <div className="actions">
                {NIVEAUX.map((n) => (
                  <form key={n} action={etiqueter.bind(null, suivante.id, n)}>
                    <BoutonEnvoi className={n === "X" ? "bouton secondaire" : "bouton principal"} enCours="…">
                      {n}
                    </BoutonEnvoi>
                  </form>
                ))}
                <Link href={`/etiquetage?saut=${(Number(sp.saut) || 0) + 1}`} className="bouton discret">
                  Passer
                </Link>
                {faites.length > 0 && (
                  <form action={annulerDerniere}>
                    <BoutonEnvoi className="bouton discret" enCours="…">
                      Annuler la dernière
                    </BoutonEnvoi>
                  </form>
                )}
              </div>
              <p className="description" style={{ whiteSpace: "pre-wrap" }}>
                {suivante.description}
              </p>
            </article>
          )}
        </>
      )}

      {resultats && (
        <>
          {paires.length === 0 && <p className="vide">Note quelques offres d&apos;abord.</p>}
          {paires.length > 0 && (
            <>
              <ul className="liste">
                <li className="carte">
                  <h2>Accord avec toi : {pct(accord, paires.length)}</h2>
                  <p className="meta">
                    {accord} offres sur {paires.length} ont la même note que la tienne.
                  </p>
                </li>
                <li className="carte">
                  <h2>Gardées à tort : {pct(enTrop, gardeesIA.length)}</h2>
                  <p className="meta">
                    {enTrop} offres sur {gardeesIA.length} que l&apos;IA met en A ou B, alors que toi tu les écartes. C&apos;est le bruit dans « À trier ».
                  </p>
                </li>
                <li className="carte">
                  <h2>Écartées à tort : {pct(manquees, ecarteesIA.length)}</h2>
                  <p className="meta">
                    {manquees} offres sur {ecarteesIA.length} que l&apos;IA écarte, alors que toi tu les gardes. Ce sont des pistes perdues.
                  </p>
                </li>
              </ul>

              <table className="carte" style={{ width: "100%", textAlign: "center" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>IA ↓ / toi →</th>
                    {NIVEAUX.map((n) => (
                      <th key={n}>{n}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {NIVEAUX.map((ia, i) => (
                    <tr key={ia}>
                      <th style={{ textAlign: "left" }}>{ia}</th>
                      {matrice[i].map((n, j) => (
                        <td key={j} style={{ fontWeight: i === j ? 700 : 400 }}>
                          {n}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>

              {desaccords.length > 0 && (
                <>
                  <h2>Désaccords ({desaccords.length})</h2>
                  <ul className="liste">
                    {desaccords.map((p) => (
                      <li key={p.offre.id} className="carte">
                        <h2>
                          IA {p.ia} · toi {p.moi} — {p.offre.poste}
                        </h2>
                        {p.offre.raison && <p className="raison">{p.offre.raison}</p>}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </>
      )}
    </main>
  );
}
