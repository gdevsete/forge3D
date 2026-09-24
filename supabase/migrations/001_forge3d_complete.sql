-- ============================================================
-- FORGE3D
-- BANCO DE DADOS COMPLETO
-- Supabase / PostgreSQL
--
-- Inclui:
-- - Leads
-- - Profiles / usuários
-- - Categorias
-- - Produtos
-- - Imagens
-- - Arquivos STL
-- - Variantes
-- - Endereços
-- - Carrinhos
-- - Pedidos
-- - Itens dos pedidos
-- - Pagamentos / StreetPay
-- - Downloads
-- - Favoritos
-- - Avaliações
-- - Cupons
-- - Produção
-- - Atribuição de marketing
-- ============================================================


-- ============================================================
-- EXTENSÕES
-- ============================================================

create extension if not exists pgcrypto;


-- ============================================================
-- LEADS
-- ============================================================

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

create index if not exists leads_created_at_idx
  on public.leads(created_at desc);

create index if not exists leads_state_idx
  on public.leads(state);

create index if not exists leads_source_idx
  on public.leads(source);

create index if not exists leads_campaign_idx
  on public.leads(campaign);

create index if not exists leads_email_idx
  on public.leads(email);


-- ============================================================
-- PROFILES
-- ============================================================

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null unique
    references auth.users(id)
    on delete cascade,

  full_name text,
  phone text,
  cpf_cnpj text,
  avatar_url text,

  role text not null default 'customer'
    check (role in ('customer', 'admin')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_user_id_idx
  on public.profiles(user_id);

create index if not exists profiles_role_idx
  on public.profiles(role);


-- ============================================================
-- CATEGORIES
-- ============================================================

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),

  name text not null,
  slug text not null unique,

  description text,
  image_url text,

  active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists categories_active_idx
  on public.categories(active);


-- ============================================================
-- PRODUCTS
-- ============================================================

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),

  category_id uuid
    references public.categories(id)
    on delete set null,

  name text not null,
  slug text not null unique,

  description text not null default '',

  product_type text not null
    check (product_type in ('stl', 'physical')),

  price numeric(12,2) not null default 0
    check (price >= 0),

  compare_price numeric(12,2)
    check (compare_price is null or compare_price >= 0),

  thumbnail_url text,

  active boolean not null default true,
  featured boolean not null default false,
  is_new boolean not null default false,
  is_best_seller boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_category_id_idx
  on public.products(category_id);

create index if not exists products_type_idx
  on public.products(product_type);

create index if not exists products_active_idx
  on public.products(active);

create index if not exists products_featured_idx
  on public.products(featured);

create index if not exists products_best_seller_idx
  on public.products(is_best_seller);


-- ============================================================
-- PRODUCT IMAGES
-- ============================================================

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),

  product_id uuid not null
    references public.products(id)
    on delete cascade,

  image_url text,
  storage_path text,

  sort_order integer not null default 0,

  created_at timestamptz not null default now()
);

create index if not exists product_images_product_id_idx
  on public.product_images(product_id);

create index if not exists product_images_sort_order_idx
  on public.product_images(product_id, sort_order);


-- ============================================================
-- PRODUCT FILES
-- ============================================================

create table if not exists public.product_files (
  id uuid primary key default gen_random_uuid(),

  product_id uuid not null
    references public.products(id)
    on delete cascade,

  file_name text not null,
  storage_path text not null,

  file_size bigint,
  file_format text,

  created_at timestamptz not null default now()
);

create index if not exists product_files_product_id_idx
  on public.product_files(product_id);


-- ============================================================
-- PRODUCT VARIANTS
-- ============================================================

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),

  product_id uuid not null
    references public.products(id)
    on delete cascade,

  name text not null,

  material text,
  color text,
  size text,

  price_modifier numeric(12,2) not null default 0,

  stock integer,

  active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists product_variants_product_id_idx
  on public.product_variants(product_id);

create index if not exists product_variants_active_idx
  on public.product_variants(active);


-- ============================================================
-- ADDRESSES
-- ============================================================

create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  name text,

  cpf_cnpj text,

  zip_code text,
  street text,
  number text,
  complement text,
  neighborhood text,

  city text,
  state text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists addresses_user_id_idx
  on public.addresses(user_id);


-- ============================================================
-- ORDERS
-- ============================================================

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),

  user_id uuid
    references auth.users(id)
    on delete set null,

  -- Dados do cliente no momento da compra
  customer_name text,
  customer_email text,
  customer_phone text,
  customer_cpf_cnpj text,

  -- Status geral do pedido
  status text not null default 'pending_payment',

  -- Status específico do pagamento
  payment_status text not null default 'pending',

  payment_method text,

  subtotal numeric(12,2) not null default 0
    check (subtotal >= 0),

  discount numeric(12,2) not null default 0
    check (discount >= 0),

  shipping numeric(12,2) not null default 0
    check (shipping >= 0),

  total numeric(12,2) not null default 0
    check (total >= 0),

  shipping_address_id uuid
    references public.addresses(id)
    on delete set null,

  -- ==========================================================
  -- ATRIBUIÇÃO / MARKETING
  -- ==========================================================

  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,

  fbclid text,

  referrer text,
  landing_page text,

  -- ==========================================================
  -- DATAS
  -- ==========================================================

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_user_id_idx
  on public.orders(user_id);

create index if not exists orders_created_at_idx
  on public.orders(created_at desc);

create index if not exists orders_status_idx
  on public.orders(status);

create index if not exists orders_payment_status_idx
  on public.orders(payment_status);

create index if not exists orders_customer_email_idx
  on public.orders(customer_email);

create index if not exists orders_utm_source_idx
  on public.orders(utm_source);

create index if not exists orders_utm_medium_idx
  on public.orders(utm_medium);

create index if not exists orders_utm_campaign_idx
  on public.orders(utm_campaign);

create index if not exists orders_state_idx
  on public.orders(shipping_address_id);


-- ============================================================
-- ORDER ITEMS
-- ============================================================

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),

  order_id uuid not null
    references public.orders(id)
    on delete cascade,

  product_id uuid not null
    references public.products(id),

  variant_id uuid
    references public.product_variants(id)
    on delete set null,

  quantity integer not null
    check (quantity > 0),

  -- Preço congelado no momento da compra
  unit_price numeric(12,2) not null
    check (unit_price >= 0),

  total_price numeric(12,2) not null
    check (total_price >= 0),

  product_type text not null
    check (product_type in ('stl', 'physical')),

  created_at timestamptz not null default now()
);

create index if not exists order_items_order_id_idx
  on public.order_items(order_id);

create index if not exists order_items_product_id_idx
  on public.order_items(product_id);


-- ============================================================
-- PAYMENTS
-- ============================================================

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),

  order_id uuid not null
    references public.orders(id)
    on delete cascade,

  provider text not null default 'streetpay',

  -- ID retornado pela StreetPay
  external_payment_id text,

  -- Nossa referência enviada para a StreetPay
  external_reference text,

  status text not null default 'pending',

  amount numeric(12,2) not null default 0
    check (amount >= 0),

  payment_method text,

  -- Dados da resposta da gateway
  raw_response jsonb,

  paid_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payments_order_id_idx
  on public.payments(order_id);

create index if not exists payments_status_idx
  on public.payments(status);

create index if not exists payments_provider_idx
  on public.payments(provider);

create unique index if not exists payments_external_payment_id_unique
  on public.payments(external_payment_id)
  where external_payment_id is not null;

create unique index if not exists payments_external_reference_unique
  on public.payments(external_reference)
  where external_reference is not null;


-- ============================================================
-- DOWNLOADS
-- ============================================================

create table if not exists public.downloads (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  order_item_id uuid not null
    references public.order_items(id)
    on delete cascade,

  product_file_id uuid not null
    references public.product_files(id)
    on delete cascade,

  downloaded_at timestamptz not null default now(),

  ip_hash text,
  user_agent text
);

create index if not exists downloads_user_id_idx
  on public.downloads(user_id);

create index if not exists downloads_order_item_id_idx
  on public.downloads(order_item_id);

create index if not exists downloads_product_file_id_idx
  on public.downloads(product_file_id);

create index if not exists downloads_downloaded_at_idx
  on public.downloads(downloaded_at desc);


-- ============================================================
-- FAVORITES
-- ============================================================

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  product_id uuid not null
    references public.products(id)
    on delete cascade,

  created_at timestamptz not null default now(),

  unique(user_id, product_id)
);

create index if not exists favorites_user_id_idx
  on public.favorites(user_id);

create index if not exists favorites_product_id_idx
  on public.favorites(product_id);


-- ============================================================
-- REVIEWS
-- ============================================================

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  product_id uuid not null
    references public.products(id)
    on delete cascade,

  order_id uuid
    references public.orders(id)
    on delete set null,

  rating integer not null
    check (rating between 1 and 5),

  comment text,

  approved boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reviews_product_id_idx
  on public.reviews(product_id);

create index if not exists reviews_user_id_idx
  on public.reviews(user_id);

create index if not exists reviews_approved_idx
  on public.reviews(approved);


-- ============================================================
-- COUPONS
-- ============================================================

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),

  code text not null unique,

  discount_type text not null
    check (discount_type in ('percent', 'fixed')),

  discount_value numeric(12,2) not null
    check (discount_value >= 0),

  minimum_order_value numeric(12,2) not null default 0
    check (minimum_order_value >= 0),

  max_uses integer,

  used_count integer not null default 0
    check (used_count >= 0),

  starts_at timestamptz,
  expires_at timestamptz,

  active boolean not null default true,

  created_at timestamptz not null default now()
);

create index if not exists coupons_active_idx
  on public.coupons(active);

create index if not exists coupons_expires_at_idx
  on public.coupons(expires_at);


-- ============================================================
-- PRODUCTION ORDERS
-- ============================================================

create table if not exists public.production_orders (
  id uuid primary key default gen_random_uuid(),

  order_id uuid not null unique
    references public.orders(id)
    on delete cascade,

  status text not null default 'pending',

  production_notes text,

  estimated_days integer,

  started_at timestamptz,
  completed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists production_orders_status_idx
  on public.production_orders(status);


-- ============================================================
-- CARTS
-- ============================================================

create table if not exists public.carts (
  id uuid primary key default gen_random_uuid(),

  user_id uuid
    references auth.users(id)
    on delete cascade,

  session_id text unique,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists carts_user_id_idx
  on public.carts(user_id);

create index if not exists carts_session_id_idx
  on public.carts(session_id);


-- ============================================================
-- CART ITEMS
-- ============================================================

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),

  cart_id uuid not null
    references public.carts(id)
    on delete cascade,

  product_id uuid not null
    references public.products(id)
    on delete cascade,

  variant_id uuid
    references public.product_variants(id)
    on delete set null,

  quantity integer not null
    check (quantity > 0),

  created_at timestamptz not null default now(),

  unique(cart_id, product_id, variant_id)
);

create index if not exists cart_items_cart_id_idx
  on public.cart_items(cart_id);

create index if not exists cart_items_product_id_idx
  on public.cart_items(product_id);


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.leads enable row level security;
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_files enable row level security;
alter table public.product_variants enable row level security;
alter table public.addresses enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.downloads enable row level security;
alter table public.favorites enable row level security;
alter table public.reviews enable row level security;
alter table public.coupons enable row level security;
alter table public.production_orders enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;


-- ============================================================
-- LEADS POLICIES
-- ============================================================

drop policy if exists "public insert leads"
on public.leads;

create policy "public insert leads"
on public.leads
for insert
to anon, authenticated
with check (true);


-- ============================================================
-- CATALOG POLICIES
-- ============================================================

drop policy if exists "public active products"
on public.products;

create policy "public active products"
on public.products
for select
using (active = true);


drop policy if exists "public active categories"
on public.categories;

create policy "public active categories"
on public.categories
for select
using (active = true);


drop policy if exists "public product images"
on public.product_images;

create policy "public product images"
on public.product_images
for select
using (
  exists (
    select 1
    from public.products p
    where p.id = product_id
      and p.active = true
  )
);


drop policy if exists "public active variants"
on public.product_variants;

create policy "public active variants"
on public.product_variants
for select
using (
  active = true
  and exists (
    select 1
    from public.products p
    where p.id = product_id
      and p.active = true
  )
);


-- ============================================================
-- REVIEWS PÚBLICAS APROVADAS
-- ============================================================

drop policy if exists "approved reviews"
on public.reviews;

create policy "approved reviews"
on public.reviews
for select
using (approved = true);


-- ============================================================
-- IMPORTANTE:
--
-- product_files NÃO possui SELECT público.
--
-- Os arquivos STL devem permanecer privados.
-- O acesso será liberado pelo backend após pagamento confirmado.
-- ============================================================


-- ============================================================
-- FUNÇÃO PARA ATUALIZAR updated_at
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ============================================================
-- TRIGGERS updated_at
-- ============================================================

drop trigger if exists profiles_updated_at
on public.profiles;

create trigger profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();


drop trigger if exists categories_updated_at
on public.categories;

create trigger categories_updated_at
before update on public.categories
for each row
execute function public.set_updated_at();


drop trigger if exists products_updated_at
on public.products;

create trigger products_updated_at
before update on public.products
for each row
execute function public.set_updated_at();


drop trigger if exists product_variants_updated_at
on public.product_variants;

create trigger product_variants_updated_at
before update on public.product_variants
for each row
execute function public.set_updated_at();


drop trigger if exists addresses_updated_at
on public.addresses;

create trigger addresses_updated_at
before update on public.addresses
for each row
execute function public.set_updated_at();


drop trigger if exists orders_updated_at
on public.orders;

create trigger orders_updated_at
before update on public.orders
for each row
execute function public.set_updated_at();


drop trigger if exists payments_updated_at
on public.payments;

create trigger payments_updated_at
before update on public.payments
for each row
execute function public.set_updated_at();


drop trigger if exists reviews_updated_at
on public.reviews;

create trigger reviews_updated_at
before update on public.reviews
for each row
execute function public.set_updated_at();


drop trigger if exists production_orders_updated_at
on public.production_orders;

create trigger production_orders_updated_at
before update on public.production_orders
for each row
execute function public.set_updated_at();


drop trigger if exists carts_updated_at
on public.carts;

create trigger carts_updated_at
before update on public.carts
for each row
execute function public.set_updated_at();


-- ============================================================
-- FUNÇÃO PARA CRIAR PROFILE AUTOMATICAMENTE
-- QUANDO UM USUÁRIO SE CADASTRA
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin

  insert into public.profiles (
    user_id,
    full_name,
    role
  )
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      ''
    ),
    'customer'
  )
  on conflict (user_id) do nothing;

  return new;

end;
$$;


drop trigger if exists on_auth_user_created
on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();


-- ============================================================
-- VIEW PARA ADMIN / RELATÓRIOS
--
-- NÃO libera acesso público.
-- Será utilizada posteriormente pelas funções administrativas.
-- ============================================================

create or replace view public.admin_order_summary
with (security_invoker = true)
as
select
  o.id,
  o.user_id,

  o.customer_name,
  o.customer_email,
  o.customer_phone,

  o.status,
  o.payment_status,
  o.payment_method,

  o.subtotal,
  o.discount,
  o.shipping,
  o.total,

  o.utm_source,
  o.utm_medium,
  o.utm_campaign,
  o.utm_content,
  o.utm_term,
  o.fbclid,

  o.referrer,
  o.landing_page,

  o.created_at,
  o.updated_at

from public.orders o;


-- ============================================================
-- FIM
-- ============================================================