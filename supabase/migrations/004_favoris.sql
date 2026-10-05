-- Radar emploi : migration 004 (favoris)
-- À coller dans Supabase → SQL Editor → Run.
-- Une offre mise en favori reste dans l'onglet Favoris quelle que soit son étape
-- (ex. un stage ou une alternance à garder pour quand l'école sera trouvée).

alter table public.offres add column if not exists favori boolean not null default false;
create index if not exists offres_favori_idx on public.offres (favori) where favori;
