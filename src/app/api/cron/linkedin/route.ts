import { recupererOffres } from "@/lib/recuperer";

// Passages LinkedIn de la journée (voir vercel.json) : lit les recherches terminées, les note, relance les suivantes.
// Une offre publiée dans la journée arrive dans le Radar quelques heures après, au lieu de 2 à 4 jours.
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Non autorisé", { status: 401 });
  }
  const resultat = await recupererOffres("cron", true);
  return Response.json(resultat);
}
