import "server-only";
import { createClient } from "@supabase/supabase-js";

// Client serveur uniquement : la clé service_role ne doit jamais partir au navigateur.
export function db() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant dans .env.local");
  return createClient(url, key, { auth: { persistSession: false } });
}

export type Source = "france_travail" | "adzuna" | "linkedin" | "wttj" | "autre";
export type Niveau = "A" | "B" | "X";
export type Etape = "nouvelle" | "a_postuler" | "postulee" | "relancee" | "entretien" | "refus" | "ecartee";

export type Offre = {
  id: string;
  source: Source;
  external_id: string;
  dedup_key: string;
  url: string | null;
  poste: string;
  entreprise: string | null;
  lieu: string | null;
  contrat: string | null;
  salaire: string | null;
  description: string | null;
  publiee_le: string | null;
  mot_cle: string | null;
  plateforme: string | null;
  niveau: Niveau | null;
  raison: string | null;
  message: string | null;
  cv_variante: string | null;
  note_le: string | null;
  etape: Etape;
  contact: string | null;
  postulee_le: string | null;
  prochaine_action: string | null;
  prochaine_date: string | null;
  notes: string | null;
  favori: boolean;
  created_at: string;
};

// Une offre telle que la renvoie une source, avant insertion.
export type NouvelleOffre = Pick<Offre, "source" | "external_id" | "poste"> &
  Partial<Pick<Offre, "url" | "entreprise" | "lieu" | "contrat" | "salaire" | "description" | "publiee_le" | "mot_cle" | "plateforme" | "contact">>;

export function dedupKey(entreprise: string | null | undefined, poste: string) {
  const norm = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\(.*?\)|[hf]\/[hf]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  // « Pennylane SAS » (Adzuna) et « Pennylane » (LinkedIn) doivent donner la même clé.
  const societe = norm(entreprise ?? "").replace(/\b(sas|sasu|sa|sarl|group|groupe|france)\b/g, "").replace(/\s+/g, " ").trim();
  return `${societe}|${norm(poste)}`;
}

export type StatutEvenement = "nouveau" | "interesse" | "inscrit" | "ecarte";

export type Evenement = {
  id: number;
  titre: string;
  type: string | null;
  date_evenement: string | null;
  ville: string | null;
  code_postal: string | null;
  modalites: string[] | null;
  organisateur: string | null;
  url: string | null;
  description: string | null;
  formation: boolean;
  niveau: Niveau | null;
  raison: string | null;
  note_le: string | null;
  statut: StatutEvenement;
  created_at: string;
};
