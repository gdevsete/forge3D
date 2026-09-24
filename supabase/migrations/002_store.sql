create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  cpf_cnpj text,
  avatar_url text,
  role text not null default 'customer' check (role in ('customer','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(), name text not null, slug text not null unique, description text, image_url text, active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(), category_id uuid references public.categories(id) on delete set null, name text not null, slug text not null unique, description text not null default '', product_type text not null check (product_type in ('stl','physical')), price numeric(12,2) not null check (price >= 0), compare_price numeric(12,2), thumbnail_url text, active boolean not null default true, featured boolean not null default false, is_new boolean not null default false, is_best_seller boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id) on delete cascade, image_url text, storage_path text, sort_order integer not null default 0, created_at timestamptz not null default now()
);

create table if not exists public.product_files (
  id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id) on delete cascade, file_name text not null, storage_path text not null, file_size bigint, file_format text, created_at timestamptz not null default now()
);

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id) on delete cascade, name text not null, material text, color text, size text, price_modifier numeric(12,2) not null default 0, stock integer, active boolean not null default true, created_at timestamptz not null default now()
);

create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, name text, cpf_cnpj text, zip_code text, street text, number text, complement text, neighborhood text, city text, state text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete set null, status text not null default 'pending_payment', payment_status text not null default 'pending', payment_method text, subtotal numeric(12,2) not null default 0, discount numeric(12,2) not null default 0, shipping numeric(12,2) not null default 0, total numeric(12,2) not null default 0, shipping_address_id uuid references public.addresses(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade, product_id uuid not null references public.products(id), variant_id uuid references public.product_variants(id) on delete set null, quantity integer not null check (quantity > 0), unit_price numeric(12,2) not null check (unit_price >= 0), total_price numeric(12,2) not null check (total_price >= 0), product_type text not null, created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade, provider text, external_payment_id text, status text not null default 'pending', amount numeric(12,2) not null default 0, payment_method text, paid_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.downloads (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, order_item_id uuid not null references public.order_items(id) on delete cascade, product_file_id uuid not null references public.product_files(id) on delete cascade, downloaded_at timestamptz not null default now(), ip_hash text, user_agent text
);

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, product_id uuid not null references public.products(id) on delete cascade, created_at timestamptz not null default now(), unique(user_id, product_id)
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, product_id uuid not null references public.products(id) on delete cascade, order_id uuid references public.orders(id) on delete set null, rating integer not null check (rating between 1 and 5), comment text, approved boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(), code text not null unique, discount_type text not null check (discount_type in ('percent','fixed')), discount_value numeric(12,2) not null check (discount_value >= 0), minimum_order_value numeric(12,2) not null default 0, max_uses integer, used_count integer not null default 0, starts_at timestamptz, expires_at timestamptz, active boolean not null default true, created_at timestamptz not null default now()
);

create table if not exists public.production_orders (
  id uuid primary key default gen_random_uuid(), order_id uuid not null unique references public.orders(id) on delete cascade, status text not null default 'pending', production_notes text, estimated_days integer, started_at timestamptz, completed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.carts (
  id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade, session_id text unique, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(), cart_id uuid not null references public.carts(id) on delete cascade, product_id uuid not null references public.products(id) on delete cascade, variant_id uuid references public.product_variants(id) on delete set null, quantity integer not null check (quantity > 0), created_at timestamptz not null default now(), unique(cart_id, product_id, variant_id)
);

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

-- Catálogo público somente de itens ativos.
drop policy if exists "public active products" on public.products;
create policy "public active products" on public.products for select using (active = true);
drop policy if exists "public active categories" on public.categories;
create policy "public active categories" on public.categories for select using (active = true);
drop policy if exists "public product images" on public.product_images;
create policy "public product images" on public.product_images for select using (exists(select 1 from public.products p where p.id=product_id and p.active=true));
drop policy if exists "public active variants" on public.product_variants;
create policy "public active variants" on public.product_variants for select using (active = true and exists(select 1 from public.products p where p.id=product_id and p.active=true));
drop policy if exists "approved reviews" on public.reviews;
create policy "approved reviews" on public.reviews for select using (approved = true);

-- O arquivo STL permanece privado: não criar política SELECT pública em product_files.
