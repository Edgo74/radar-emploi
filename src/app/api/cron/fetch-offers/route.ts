import { recupererOffres } from "@/lib/recuperer";

// Appelée chaque matin par Vercel Cron (voir vercel.json).
// Vercel envoie automatiquement « Authorization: Bearer <CRON_SECRET> ».
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Non autorisé", { status: 401 });
  }
  const resultat = await recupererOffres("cron");
  return Response.json(resultat);
}
