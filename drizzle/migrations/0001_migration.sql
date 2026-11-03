create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  capability text not null,
  title text not null,
  spec jsonb not null,
  source text not null,
  model text,
  created_at timestamptz not null default now()
);
create index challenges_workspace_idx on public.challenges(workspace_id, created_at desc);
alter table public.challenges enable row level security;
grant all on public.challenges to service_role;

alter table public.experiments add column challenge_id uuid references public.challenges(id) on delete set null;
alter table public.vision_boards add column from_photo boolean not null default false;