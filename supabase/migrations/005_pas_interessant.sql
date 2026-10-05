-- Radar emploi : migration 005 (étape « Pas intéressant »)
-- À coller dans Supabase → SQL Editor → Run.
-- Tri rapide : l'offre quitte « À trier » tout de suite et attend dans son onglet,
-- d'où elle peut être écartée plus tard ou remise à trier.

alter table public.offres drop constraint if exists offres_etape_check;
alter table public.offres add constraint offres_etape_check
  check (etape in ('nouvelle', 'a_postuler', 'postulee', 'relancee', 'entretien', 'refus', 'ecartee', 'pas_interessant'));
