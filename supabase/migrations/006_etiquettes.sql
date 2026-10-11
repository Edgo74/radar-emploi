-- Radar emploi : migration 006 (étiquettes de référence)
-- À coller dans Supabase → SQL Editor → Run.
-- Le jeu de test : tes propres notes A/B/X, posées à l'aveugle (sans voir la note de l'IA).
-- Sert à mesurer la notation actuelle puis la version multi-agents sur les mêmes offres.
-- Table à part : ne touche ni aux notes de l'IA ni au suivi des candidatures.

create table if not exists public.etiquettes (
  offre_id   uuid primary key references public.offres (id) on delete cascade,
  niveau     text not null check (niveau in ('A', 'B', 'X')),
  cree_le    timestamptz not null default now()
);

alter table public.etiquettes enable row level security;
