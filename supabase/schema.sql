-- Radar emploi : schéma Supabase
-- À coller dans Supabase → SQL Editor → Run (une seule fois).

create table if not exists public.offres (
  id               uuid primary key default gen_random_uuid(),
  source           text not null check (source in ('france_travail', 'adzuna', 'linkedin', 'wttj', 'autre')),
  external_id      text not null,              -- id chez la source (ou l'URL pour les ajouts manuels)
  dedup_key        text not null,              -- entreprise|poste normalisés, pour repérer les doublons entre sources
  url              text,
  poste            text not null,
  entreprise       text,
  lieu             text,
  contrat          text,
  salaire          text,
  description      text,
  publiee_le       timestamptz,
  mot_cle          text,                       -- le mot-clé qui a trouvé l'offre
  plateforme       text,                       -- site d'origine quand l'offre vient d'Apify

  -- notation IA
  niveau           text check (niveau in ('A', 'B', 'X')),   -- X = écarter
  raison           text,
  message          text,                       -- les 3 lignes de candidature
  cv_variante      text,
  note_le          timestamptz,

  -- suivi
  etape            text not null default 'nouvelle'
                   check (etape in ('nouvelle', 'a_postuler', 'postulee', 'relancee', 'entretien', 'refus', 'ecartee')),
  contact          text,
  postulee_le      date,
  prochaine_action text,
  prochaine_date   date,
  notes            text,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (source, external_id)
);

create index if not exists offres_dedup_key_idx on public.offres (dedup_key);
create index if not exists offres_etape_idx on public.offres (etape);
create index if not exists offres_created_at_idx on public.offres (created_at desc);

create or replace function public.offres_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists offres_touch_updated_at on public.offres;
create trigger offres_touch_updated_at
  before update on public.offres
  for each row execute function public.offres_touch_updated_at();

-- Journal des récupérations (pour voir si le cron tourne).
create table if not exists public.recuperations (
  id          bigint generated always as identity primary key,
  lancee_le   timestamptz not null default now(),
  declencheur text not null,                   -- 'cron' ou 'manuel'
  trouvees    int not null default 0,
  nouvelles   int not null default 0,
  notees      int not null default 0,
  erreurs     text
);

-- Sécurité : RLS activé et AUCUNE policy → la clé publique (anon) ne lit rien.
-- Seul le serveur du site, avec la clé service_role, accède aux données.
alter table public.offres enable row level security;
alter table public.recuperations enable row level security;
