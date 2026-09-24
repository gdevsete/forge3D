# Forge3D

E-commerce de arquivos STL e impressão 3D, com foco em conversão, mobile e aquisição.

## Stack

- React + TypeScript + Vite
- Tailwind-ready architecture (UI atual em CSS modular)
- Supabase: PostgreSQL, Auth, Storage e RLS
- Vercel para deploy
- Meta Pixel preparado
- Adapter da StreetPay preparado para integração server-side

## Rodar localmente

```bash
npm install
npm run dev
```

Abra a URL informada pelo Vite, normalmente `http://localhost:5173/`.

Não abra `index.html` pelo Live Server.

## Build

```bash
npm run build
```

## Variáveis

Copie `.env.example` para `.env.local`.

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_META_PIXEL_ID`

O fallback de admin local existe somente para prototipagem. Em produção, usar Supabase Auth + role admin e remover `VITE_ADMIN_PASSWORD`.

## Meta Pixel

Eventos preparados:

- PageView
- ViewContent
- Search
- AddToWishlist
- AddToCart
- InitiateCheckout
- Lead
- Contact/custom interactions
- ScrollDepth

O evento `Purchase` deve ser disparado somente depois da confirmação real de pagamento pelo webhook da StreetPay. A implementação da gateway deve acontecer server-side.

## StreetPay

`src/lib/streetpay.ts` é o adapter. As keys nunca devem entrar no frontend. Quando as credenciais forem fornecidas, criar uma Vercel Function ou Supabase Edge Function para criar o pagamento e receber o webhook.

## Supabase

A pasta `supabase/migrations` contém as migrations iniciais. Produtos STL pagos devem usar bucket privado e signed URLs. RLS deve ser habilitado antes do uso em produção.

## Admin

Localmente, o painel está em `/admin`. O login de desenvolvimento é configurável pelo `.env.local`. Antes de publicar, substituir por Supabase Auth.
