-- Radar emploi : migration 002 (Apify)
-- À coller dans Supabase → SQL Editor → Run.
-- Ajoute le site d'origine de l'offre (ex. « ycombinator », « remotive ») quand elle vient d'Apify.

alter table public.offres add column if not exists plateforme text;
