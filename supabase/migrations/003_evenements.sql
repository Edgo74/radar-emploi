-- Radar emploi : migration 003 (événements France Travail)
-- À coller dans Supabase → SQL Editor → Run.
-- Événements de l'API « Mes Évènements Emploi » (POEI, POEC, job datings, réunions d'information…),
-- présélectionnés par mots-clés puis notés par l'IA.

create table if not exists public.evenements (
  id              bigint primary key,            -- id France Travail de l'événement
  titre           text not null,
  type            text,                          -- « Réunion d'information », « Job dating »…
  date_evenement  timestamptz,
  ville           text,
  code_postal     text,
  modalites       text[],                        -- « en physique », « à distance »
  organisateur    text,
  url             text,
  description     text,
  formation       boolean not null default false, -- POEI / POEC / formation financée mentionnée

  -- notation IA
  niveau          text check (niveau in ('A', 'B', 'X')),
  raison          text,
  note_le         timestamptz,

  -- suivi
  statut          text not null default 'nouveau' check (statut in ('nouveau', 'interesse', 'inscrit', 'ecarte')),
  created_at      timestamptz not null default now()
);

create index if not exists evenements_date_idx on public.evenements (date_evenement);

-- Même règle que les offres : RLS sans policy, seul le serveur (service_role) lit et écrit.
alter table public.evenements enable row level security;
