# Radar emploi

Outil personnel de recherche d'emploi :
- chaque matin, il récupère les offres France Travail et Adzuna (qui agrège Indeed) sur mes mots-clés ;
- l'IA (OpenAI) note chaque offre A, B ou X (à écarter) et écrit 3 lignes de candidature ;
- j'ajoute à la main les offres LinkedIn et Welcome to the Jungle ;
- je suis chaque candidature : étape, contact, prochaine action.

**L'outil n'envoie rien tout seul.** C'est moi qui relis et qui postule.

Stack : Next.js 16, Supabase (région EU), Vercel Cron.

## Installation

1. **Supabase.** Crée un projet en région EU (Paris ou Francfort). Ouvre SQL Editor, colle le contenu de `supabase/schema.sql`, puis lance Run.
2. **Les clés.** Copie `.env.example` en `.env.local` et remplis chaque valeur toi-même.
3. **En local.**
   - Lance `npm run dev`, puis ouvre http://localhost:3000.
   - Le navigateur demande un mot de passe : mets n'importe quel identifiant et ton `SITE_PASSWORD`.
   - Clique sur « Récupérer maintenant ».
4. **Sur Vercel.**
   - Importe le dépôt et ajoute les mêmes variables d'environnement.
   - Le cron défini dans `vercel.json` lance `/api/cron/fetch-offers` tous les jours à 5 h UTC (7 h à Paris en été, 6 h en hiver).

## Fichiers

| Fichier | Rôle |
|---|---|
| `src/lib/profil.ts` | Les mots-clés et le profil utilisés pour la notation |
| `src/lib/sources/` | Les appels aux API France Travail et Adzuna |
| `src/lib/notation.ts` | Le filtre rapide et la notation IA |
| `src/lib/recuperer.ts` | La récupération, la déduplication, l'insertion et la notation |
| `src/proxy.ts` | Le mot de passe du site |
| `src/app/api/cron/fetch-offers/route.ts` | La route appelée par le cron (protégée par `CRON_SECRET`) |
