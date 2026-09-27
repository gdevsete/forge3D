
import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export type ProductType = 'stl' | 'physical';

export type ProductMediaType = 'image' | 'video';

export type LandingTemplate = 'product' | 'turbo';

export interface LandingFaq {
  question: string;
  answer: string;
}

export interface LandingBenefit {
  title: string;
  text: string;
}

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

  stlEnabled: boolean;
  printedEnabled: boolean;

  landingTemplate: LandingTemplate;
  landingBadge: string | null;
  landingTitle: string | null;
  landingSubtitle: string | null;
  landingDescription: string | null;
  landingWhyTitle: string | null;
  landingWhyDescription: string | null;
  landingBenefits: LandingBenefit[];
  landingStlPoints: string[];
  landingPrintedPoints: string[];
  landingDetailTitle: string | null;
  landingDetailDescription: string | null;
  landingFaq: LandingFaq[];
  landingFinalTitle: string | null;
  landingFinalDescription: string | null;

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

  stl_enabled: boolean | null;
  printed_enabled: boolean | null;

  landing_template: LandingTemplate | null;
  landing_badge: string | null;
  landing_title: string | null;
  landing_subtitle: string | null;
  landing_description: string | null;
  landing_why_title: string | null;
  landing_why_description: string | null;
  landing_benefits: unknown;
  landing_stl_points: unknown;
  landing_printed_points: unknown;
  landing_detail_title: string | null;
  landing_detail_description: string | null;
  landing_faq: unknown;
  landing_final_title: string | null;
  landing_final_description: string | null;

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

function normalizeLandingBenefits(
  value: unknown,
): LandingBenefit[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (
        typeof item === 'object' &&
        item !== null
      ) {
        const candidate =
          item as Record<string, unknown>;

        return {
          title:
            typeof candidate.title === 'string'
              ? candidate.title.trim()
              : '',
          text:
            typeof candidate.text === 'string'
              ? candidate.text.trim()
              : '',
        };
      }

      if (typeof item === 'string') {
        return {
          title: item.trim(),
          text: '',
        };
      }

      return {
        title: '',
        text: '',
      };
    })
    .filter((item) => item.title);
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeLandingFaq(value: unknown): LandingFaq[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (item): item is Record<string, unknown> =>
        typeof item === 'object' &&
        item !== null,
    )
    .map((item) => ({
      question:
        typeof item.question === 'string'
          ? item.question.trim()
          : '',
      answer:
        typeof item.answer === 'string'
          ? item.answer.trim()
          : '',
    }))
    .filter((item) => item.question && item.answer);
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

    stlEnabled:
      product.stl_enabled ?? stlPrice > 0,
    printedEnabled:
      product.printed_enabled ?? printedPrice > 0,

    landingTemplate:
      product.landing_template === 'turbo'
        ? 'turbo'
        : 'product',
    landingBadge: product.landing_badge,
    landingTitle: product.landing_title,
    landingSubtitle: product.landing_subtitle,
    landingDescription: product.landing_description,
    landingWhyTitle:
      product.landing_why_title,
    landingWhyDescription:
      product.landing_why_description,
    landingBenefits:
      normalizeLandingBenefits(
        product.landing_benefits,
      ),
    landingStlPoints: normalizeStringArray(
      product.landing_stl_points,
    ),
    landingPrintedPoints: normalizeStringArray(
      product.landing_printed_points,
    ),
    landingDetailTitle: product.landing_detail_title,
    landingDetailDescription:
      product.landing_detail_description,
    landingFaq: normalizeLandingFaq(
      product.landing_faq,
    ),
    landingFinalTitle: product.landing_final_title,
    landingFinalDescription:
      product.landing_final_description,

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
      stl_enabled,
      printed_enabled,
      landing_template,
      landing_badge,
      landing_title,
      landing_subtitle,
      landing_description,
      landing_why_title,
      landing_why_description,
      landing_benefits,
      landing_stl_points,
      landing_printed_points,
      landing_detail_title,
      landing_detail_description,
      landing_faq,
      landing_final_title,
      landing_final_description,
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
