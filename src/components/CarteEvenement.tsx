import { changerStatutEvenement } from "@/app/actions";
import { BoutonEnvoi } from "@/components/BoutonEnvoi";
import type { Evenement, StatutEvenement } from "@/lib/supabase";

const quand = (d: string | null) =>
  d
    ? new Date(d).toLocaleString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" })
    : null;

export function CarteEvenement({ evenement: e }: { evenement: Evenement }) {
  const details = [quand(e.date_evenement), e.ville && `${e.ville}${e.code_postal ? ` (${e.code_postal.slice(0, 2)})` : ""}`, e.modalites?.join(", "), e.organisateur]
    .filter(Boolean)
    .join(" · ");
  const bouton = (statut: StatutEvenement, titre: string, style = "secondaire") => (
    <form action={changerStatutEvenement.bind(null, e.id, statut)}>
      <BoutonEnvoi className={`bouton ${style}`} enCours="…">
        {titre}
      </BoutonEnvoi>
    </form>
  );

  return (
    <article className="carte" data-niveau={e.niveau ?? "attente"}>
      <div className="carte-haut">
        <span className="niveau" title={e.niveau === "X" ? "À écarter" : e.niveau ? `Niveau ${e.niveau}` : "Pas encore noté"}>
          {e.niveau ?? "…"}
        </span>
        <div className="carte-titre">
          <h2>{e.url ? <a href={e.url} target="_blank" rel="noreferrer">{e.titre}</a> : e.titre}</h2>
          {details && <p className="meta">{details}</p>}
        </div>
        <div className="carte-coin">
          <span className="source">{e.formation ? "POEI / POEC" : e.type}</span>
          {e.formation && <span className="date">{e.type}</span>}
        </div>
      </div>

      {e.raison && <p className="raison">{e.raison}</p>}

      <div className="actions">
        {e.url && (
          <a className="bouton secondaire" href={e.url} target="_blank" rel="noreferrer">
            Voir et s&apos;inscrire ↗
          </a>
        )}
        {e.statut === "nouveau" && bouton("interesse", "Intéressé", "principal")}
        {e.statut === "interesse" && bouton("inscrit", "Je suis inscrit", "principal")}
        {e.statut !== "ecarte" && bouton("ecarte", "Écarter")}
        {e.statut === "ecarte" && bouton("nouveau", "Remettre")}
      </div>

      {e.description && (
        <details className="plus">
          <summary>Description</summary>
          <div className="description">{e.description}</div>
        </details>
      )}
    </article>
  );
}
