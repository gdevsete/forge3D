
import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export type ProductType = 'stl' | 'physical';

export type ProductMediaType = 'image' | 'video';

export interface ProductMedia {
  id: string;
  productId: string;
  mediaType: ProductMediaType;
  mediaUrl: string;
  thumbnailUrl: string | null;
  altText: string;
  sortOrder: number;
  isPrimary: boolean;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  type: ProductType;
  category: string;
  categoryId: string | null;

  stlPrice: number;
  compareStlPrice: number | null;
  printedPrice: number;
  comparePrintedPrice: number | null;

  // Campos legados mantidos para compatibilidade.
  price: number;
  oldPrice: number | null;

  image: string;
  description: string;

  rating: number;
  reviews: number;

  badge: string | null;

  active: boolean;
  featured: boolean;
  isNew: boolean;
  isBestSeller: boolean;

  details: string[];

  media: ProductMedia[];
}

interface SupabaseCategory {
  id: string;
  name: string;
  slug: string;
}

interface SupabaseProduct {
  id: string;
  category_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  product_type: ProductType;
  price: number | string;
  compare_price: number | string | null;
  stl_price: number | string;
  printed_price: number | string;
  compare_stl_price: number | string | null;
  compare_printed_price: number | string | null;
  thumbnail_url: string | null;
  active: boolean;
  featured: boolean;
  is_new: boolean;
  is_best_seller: boolean;
  created_at: string;

  categories:
    | SupabaseCategory
    | SupabaseCategory[]
    | null;
}

interface SupabaseProductMedia {
  id: string;
  product_id: string;
  media_type: ProductMediaType;
  media_url: string;
  thumbnail_url: string | null;
  alt_text: string | null;
  sort_order: number;
  is_primary: boolean;
}

function normalizeCategory(
  category: SupabaseProduct['categories'],
): string {
  if (!category) {
    return 'Sem categoria';
  }

  if (Array.isArray(category)) {
    return category[0]?.name ?? 'Sem categoria';
  }

  return category.name;
}

function normalizeProductMedia(
  media: SupabaseProductMedia[],
): ProductMedia[] {
  return [...media]
    .sort((a, b) => {
      if (a.is_primary !== b.is_primary) {
        return a.is_primary ? -1 : 1;
      }

      return a.sort_order - b.sort_order;
    })
    .map((item) => ({
      id: item.id,
      productId: item.product_id,
      mediaType: item.media_type,
      mediaUrl: item.media_url,
      thumbnailUrl: item.thumbnail_url,
      altText: item.alt_text || 'Mídia do produto',
      sortOrder: item.sort_order,
      isPrimary: item.is_primary,
    }));
}

function normalizeProduct(
  product: SupabaseProduct,
  media: SupabaseProductMedia[],
): Product {
  const productMedia = normalizeProductMedia(media);

  const primaryImage =
    productMedia.find(
      (item) =>
        item.mediaType === 'image' &&
        item.isPrimary,
    ) ??
    productMedia.find(
      (item) => item.mediaType === 'image',
    );

  const fallbackImage =
    product.thumbnail_url ||
    'https://placehold.co/1000x1000/f4f4f4/222222?text=Forge3D';

  const stlPrice = Number(product.stl_price) || Number(product.price) || 0;
  const printedPrice = Number(product.printed_price) || stlPrice;

  const compareStlPrice =
    product.compare_stl_price !== null &&
    Number(product.compare_stl_price) > 0
      ? Number(product.compare_stl_price)
      : product.compare_price !== null && Number(product.compare_price) > 0
        ? Number(product.compare_price)
        : null;

  const comparePrintedPrice =
    product.compare_printed_price !== null &&
    Number(product.compare_printed_price) > 0
      ? Number(product.compare_printed_price)
      : null;

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,

    type: product.product_type,

    category: normalizeCategory(product.categories),
    categoryId: product.category_id,

    stlPrice,
    compareStlPrice,
    printedPrice,
    comparePrintedPrice,

    // Compatibilidade com componentes que ainda usam o preço legado.
    price: stlPrice,
    oldPrice: compareStlPrice,

    image: primaryImage?.mediaUrl || fallbackImage,

    description:
      product.description ||
      'Produto desenvolvido pela Forge3D.',

    rating: 0,
    reviews: 0,

    badge: product.is_new
      ? 'NOVO'
      : product.is_best_seller
        ? 'MAIS VENDIDO'
        : null,

    active: product.active,
    featured: product.featured,
    isNew: product.is_new,
    isBestSeller: product.is_best_seller,

    details:
      product.product_type === 'stl'
        ? [
            'Arquivo digital STL',
            'Modelo pronto para impressão 3D',
            'Download após confirmação do pagamento',
          ]
        : [
            'Produto físico impresso em 3D',
            'Produção sob demanda',
            'Prazo informado no pedido',
          ],

    media: productMedia,
  };
}

export async function getProducts(): Promise<Product[]> {
  const {
    data: productsData,
    error: productsError,
  } = await supabase
    .from('products')
    .select(`
      id,
      category_id,
      name,
      slug,
      description,
      product_type,
      price,
      compare_price,
      stl_price,
      printed_price,
      compare_stl_price,
      compare_printed_price,
      thumbnail_url,
      active,
      featured,
      is_new,
      is_best_seller,
      created_at,
      categories (
        id,
        name,
        slug
      )
    `)
    .eq('active', true)
    .order('created_at', {
      ascending: false,
    });

  if (productsError) {
    throw new Error(
      `Erro ao carregar produtos: ${productsError.message}`,
    );
  }

  const products = (productsData || []) as SupabaseProduct[];

  if (products.length === 0) {
    return [];
  }

  const productIds = products.map(
    (product) => product.id,
  );

  const {
    data: mediaData,
    error: mediaError,
  } = await supabase
    .from('product_media')
    .select(`
      id,
      product_id,
      media_type,
      media_url,
      thumbnail_url,
      alt_text,
      sort_order,
      is_primary
    `)
    .in('product_id', productIds)
    .order('sort_order', {
      ascending: true,
    });

  if (mediaError) {
    throw new Error(
      `Erro ao carregar mídias: ${mediaError.message}`,
    );
  }

  const media = (mediaData ||
    []) as SupabaseProductMedia[];

  return products.map((product) => {
    const productMedia = media.filter(
      (item) => item.product_id === product.id,
    );

    return normalizeProduct(
      product,
      productMedia,
    );
  });
}

export function useProducts() {
  const [products, setProducts] = useState<Product[]>(
    [],
  );

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(
    null,
  );

  useEffect(() => {
    let mounted = true;

    async function loadProducts() {
      try {
        setLoading(true);
        setError(null);

        const result = await getProducts();

        if (mounted) {
          setProducts(result);
        }
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Erro desconhecido ao carregar produtos.';

        if (mounted) {
          setError(message);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadProducts();

    return () => {
      mounted = false;
    };
  }, []);

  return {
    products,
    loading,
    error,
  };
}
