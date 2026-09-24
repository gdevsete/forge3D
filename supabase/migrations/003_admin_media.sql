-- Administrative access, product media and secure lead reporting.
-- This migration complements the existing catalog schema; it does not alter
-- products, categories or leads columns created by prior migrations.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where user_id = auth.uid()
      and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create table if not exists public.product_media (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null
    references public.products(id)
    on delete cascade,
  media_type text not null
    check (media_type in ('image', 'video')),
  media_url text not null,
  thumbnail_url text,
  alt_text text,
  sort_order integer not null default 0
    check (sort_order >= 0),
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists product_media_product_id_idx
  on public.product_media(product_id);

create index if not exists product_media_sort_order_idx
  on public.product_media(product_id, sort_order);

create unique index if not exists product_media_one_primary_image_idx
  on public.product_media(product_id)
  where is_primary = true
    and media_type = 'image';

alter table public.product_media enable row level security;

drop policy if exists "public active product media" on public.product_media;
create policy "public active product media"
on public.product_media
for select
to anon, authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.products
    where products.id = product_media.product_id
      and products.active = true
  )
);

drop policy if exists "admins manage product media" on public.product_media;
create policy "admins manage product media"
on public.product_media
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admins manage products" on public.products;
create policy "admins manage products"
on public.products
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admins manage categories" on public.categories;
create policy "admins manage categories"
on public.categories
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admins manage product variants" on public.product_variants;
create policy "admins manage product variants"
on public.product_variants
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'product-media',
  'product-media',
  true,
  104857600,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/avif',
    'video/mp4',
    'video/webm',
    'video/quicktime'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public read product media files" on storage.objects;
create policy "public read product media files"
on storage.objects
for select
to public
using (bucket_id = 'product-media');

drop policy if exists "admins upload product media files" on storage.objects;
create policy "admins upload product media files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'product-media'
  and public.is_admin()
);

drop policy if exists "admins update product media files" on storage.objects;
create policy "admins update product media files"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'product-media'
  and public.is_admin()
)
with check (
  bucket_id = 'product-media'
  and public.is_admin()
);

drop policy if exists "admins delete product media files" on storage.objects;
create policy "admins delete product media files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'product-media'
  and public.is_admin()
);

create or replace function public.get_admin_leads()
returns table (
  id uuid,
  created_at timestamptz,
  name text,
  email text,
  phone text,
  city text,
  state text,
  source text,
  medium text,
  campaign text,
  content text,
  referrer text,
  landing_page text,
  event_name text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'ADMIN_ACCESS_REQUIRED'
      using errcode = '42501';
  end if;

  return query
  select
    leads.id,
    leads.created_at,
    leads.name,
    leads.email,
    leads.phone,
    leads.city,
    leads.state,
    leads.source,
    leads.medium,
    leads.campaign,
    leads.content,
    leads.referrer,
    leads.landing_page,
    leads.event_name
  from public.leads
  order by leads.created_at desc;
end;
$$;

revoke all on function public.get_admin_leads() from public;
grant execute on function public.get_admin_leads() to authenticated;
