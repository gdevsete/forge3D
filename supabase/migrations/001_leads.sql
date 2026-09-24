create extension if not exists pgcrypto;

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  cpf_cnpj text,
  city text,
  state text,
  source text,
  medium text,
  campaign text,
  content text,
  term text,
  fbclid text,
  referrer text,
  landing_page text,
  event_name text not null default 'Lead',
  created_at timestamptz not null default now()
);

create index if not exists leads_created_at_idx on public.leads(created_at desc);
create index if not exists leads_state_idx on public.leads(state);
create index if not exists leads_source_idx on public.leads(source);
create index if not exists leads_campaign_idx on public.leads(campaign);

alter table public.leads enable row level security;

-- O cliente pode inserir o próprio lead, mas não pode ler a tabela.
drop policy if exists "public insert leads" on public.leads;
create policy "public insert leads" on public.leads for insert to anon, authenticated with check (true);

-- Nenhuma política SELECT pública. A leitura do admin deve ocorrer por uma função/server-side
-- autenticada com uma role administrativa, evitando expor todos os leads ao navegador.
