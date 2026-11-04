create table public.inventions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  pathway text not null check (pathway in ('achieve','easier','both')),
  ambition text not null default '',
  friction text not null default '',
  working_style text not null default '',
  answers jsonb not null default '[]'::jsonb,
  discovery jsonb,
  rejected jsonb not null default '[]'::jsonb,
  selected jsonb,
  customization jsonb,
  rationale jsonb,
  approved_details jsonb,
  blueprint jsonb,
  feedback jsonb,
  revision jsonb,
  source text not null default 'meta_live',
  model text,
  saved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant all on public.inventions to service_role;
create index inventions_workspace_idx on public.inventions(workspace_id, created_at desc);
alter table public.inventions enable row level security;