"use server";

import { revalidatePath } from "next/cache";
import { noterUne, recupererOffres } from "@/lib/recuperer";
import { db, dedupKey, type Etape, type Source } from "@/lib/supabase";

const texte = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? "").trim();
  return v === "" ? null : v;
};

export async function ajouterOffre(f: FormData) {
  const poste = texte(f, "poste");
  if (!poste) return;
  const url = texte(f, "url");
  const entreprise = texte(f, "entreprise");
  const ligne = {
    source: (texte(f, "source") ?? "autre") as Source,
    external_id: url ?? crypto.randomUUID(),
    dedup_key: dedupKey(entreprise, poste),
    url,
    poste,
    entreprise,
    lieu: texte(f, "lieu"),
    contrat: texte(f, "contrat"),
    salaire: texte(f, "salaire"),
    description: texte(f, "description"),
    publiee_le: new Date().toISOString(),
  };
  const { data, error } = await db().from("offres").upsert(ligne, { onConflict: "source,external_id" }).select("*").single();
  if (error) throw new Error(error.message);
  // Une offre ajoutée à la main est notée tout de suite, mais reste visible même si l'IA l'écarte.
  await noterUne(data);
  await db().from("offres").update({ etape: "nouvelle" }).eq("id", data.id);
  revalidatePath("/");
}

export async function changerEtape(id: string, etape: Etape) {
  const maj: Record<string, unknown> = { etape };
  if (etape === "postulee") maj.postulee_le = new Date().toISOString().slice(0, 10);
  const { error } = await db().from("offres").update(maj).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/");
}

export async function enregistrerSuivi(f: FormData) {
  const id = texte(f, "id");
  if (!id) return;
  const { error } = await db()
    .from("offres")
    .update({
      etape: texte(f, "etape") ?? "nouvelle",
      contact: texte(f, "contact"),
      postulee_le: texte(f, "postulee_le"),
      prochaine_action: texte(f, "prochaine_action"),
      prochaine_date: texte(f, "prochaine_date"),
      notes: texte(f, "notes"),
      message: texte(f, "message"),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/");
}

export async function lancerRecuperation() {
  await recupererOffres("manuel");
  revalidatePath("/");
}
