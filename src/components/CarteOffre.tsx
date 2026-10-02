import { changerEtape, enregistrerSuivi } from "@/app/actions";
import { BoutonCopier } from "@/components/BoutonCopier";
import { BoutonEnvoi } from "@/components/BoutonEnvoi";
import type { Etape, Offre } from "@/lib/supabase";

const NOM_SOURCE: Record<Offre["source"], string> = {
  france_travail: "France Travail",
  adzuna: "Adzuna",
  linkedin: "LinkedIn",
  wttj: "WTTJ",
  autre: "Autre",
};

const ETAPES: { id: Etape; titre: string }[] = [
  { id: "nouvelle", titre: "À trier" },
  { id: "a_postuler", titre: "À postuler" },
  { id: "postulee", titre: "Postulée" },
  { id: "relancee", titre: "Relancée" },
  { id: "entretien", titre: "Entretien" },
  { id: "refus", titre: "Refus" },
  { id: "ecartee", titre: "Écartée" },
];

const date = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "Europe/Paris" }) : null;

export function CarteOffre({ offre: o }: { offre: Offre }) {
  const details = [o.entreprise, o.lieu, o.contrat, o.salaire].filter(Boolean).join(" · ");
  const bouton = (etape: Etape, titre: string, style = "secondaire") => (
    <form action={changerEtape.bind(null, o.id, etape)}>
      <BoutonEnvoi className={`bouton ${style}`} enCours="…">
        {titre}
      </BoutonEnvoi>
    </form>
  );

  return (
    <article className="carte" data-niveau={o.niveau ?? "attente"}>
      <div className="carte-haut">
        <span className="niveau" title={o.niveau === "X" ? "À écarter" : o.niveau ? `Niveau ${o.niveau}` : "Pas encore notée"}>
          {o.niveau ?? "…"}
        </span>
        <div className="carte-titre">
          <h2>{o.url ? <a href={o.url} target="_blank" rel="noreferrer">{o.poste}</a> : o.poste}</h2>
          {details && <p className="meta">{details}</p>}
        </div>
        <div className="carte-coin">
          <span className="source">{o.plateforme && o.source === "autre" ? o.plateforme : NOM_SOURCE[o.source]}</span>
          <span className="date">{date(o.publiee_le ?? o.created_at)}</span>
        </div>
      </div>

      {o.raison && <p className="raison">{o.raison}</p>}
      {o.prochaine_action && (
        <p className="prochaine">
          Prochaine action{o.prochaine_date ? ` (${date(o.prochaine_date)})` : ""} : {o.prochaine_action}
        </p>
      )}

      <div className="actions">
        {o.url && (
          <a className="bouton secondaire" href={o.url} target="_blank" rel="noreferrer">
            Voir l&apos;offre ↗
          </a>
        )}
        {o.etape === "nouvelle" && bouton("a_postuler", "À postuler", "principal")}
        {o.etape === "a_postuler" && bouton("postulee", "J'ai postulé", "principal")}
        {o.etape !== "ecartee" && o.etape !== "refus" && bouton("ecartee", "Écarter")}
        {(o.etape === "ecartee" || o.etape === "refus") && bouton("nouvelle", "Remettre à trier")}
      </div>

      <details className="plus">
        <summary>Message, description et suivi</summary>
        <form action={enregistrerSuivi} className="formulaire">
          <input type="hidden" name="id" value={o.id} />
          <label className="pleine">
            <span className="libelle-ligne">
              Les 3 lignes {o.cv_variante && <em>· angle du CV : {o.cv_variante}</em>}
              {o.message && <BoutonCopier texte={o.message} />}
            </span>
            <textarea name="message" rows={4} defaultValue={o.message ?? ""} />
          </label>
          <label>
            Étape
            <select name="etape" defaultValue={o.etape}>
              {ETAPES.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.titre}
                </option>
              ))}
            </select>
          </label>
          <label>
            Contact
            <input name="contact" defaultValue={o.contact ?? ""} placeholder="Nom, rôle, email" />
          </label>
          <label>
            Postulée le
            <input name="postulee_le" type="date" defaultValue={o.postulee_le ?? ""} />
          </label>
          <label>
            Prochaine action
            <input name="prochaine_action" defaultValue={o.prochaine_action ?? ""} placeholder="Relancer par message" />
          </label>
          <label>
            Pour le
            <input name="prochaine_date" type="date" defaultValue={o.prochaine_date ?? ""} />
          </label>
          <label className="pleine">
            Notes
            <textarea name="notes" rows={2} defaultValue={o.notes ?? ""} />
          </label>
          <div className="pleine">
            <BoutonEnvoi className="bouton principal" enCours="Enregistrement…">
              Enregistrer
            </BoutonEnvoi>
          </div>
        </form>
        {o.description && <div className="description">{o.description}</div>}
      </details>
    </article>
  );
}
