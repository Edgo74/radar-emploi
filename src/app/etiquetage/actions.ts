"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, type Niveau } from "@/lib/supabase";

export async function etiqueter(offreId: string, niveau: Niveau) {
  const { error } = await db().from("etiquettes").upsert({ offre_id: offreId, niveau }, { onConflict: "offre_id" });
  if (error) throw new Error(error.message);
  revalidatePath("/etiquetage");
  redirect("/etiquetage");
}

export async function annulerDerniere() {
  const supabase = db();
  const { data } = await supabase.from("etiquettes").select("offre_id").order("cree_le", { ascending: false }).limit(1);
  if (!data?.[0]) return;
  const { error } = await supabase.from("etiquettes").delete().eq("offre_id", data[0].offre_id);
  if (error) throw new Error(error.message);
  revalidatePath("/etiquetage");
  // On ré-affiche l'offre annulée pour la noter à nouveau.
  redirect(`/etiquetage?offre=${data[0].offre_id}`);
}
