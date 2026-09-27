import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { supabase } from '../lib/supabase';

type LinkHubTone =
  | 'orange'
  | 'red'
  | 'blue'
  | 'purple'
  | 'green'
  | 'yellow';

type LinkHubProduct = {
  id: string;
  name: string;
  slug: string;
  thumbnail_url: string | null;
  landing_badge: string | null;
  landing_title: string | null;
  landing_subtitle: string | null;
  active: boolean;
  created_at: string;
};

const TONES: LinkHubTone[] = [
  'orange',
  'red',
  'blue',
  'purple',
  'green',
  'yellow',
];

function toneForIndex(index: number): LinkHubTone {
  return TONES[index % TONES.length];
}

function cleanText(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function LinksPage() {
  const [products, setProducts] = useState<LinkHubProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadLinkHub() {
      try {
        setLoading(true);
        setError(null);

        const { data, error: productsError } = await supabase
          .from('products')
          .select(
            [
              'id',
              'name',
              'slug',
              'thumbnail_url',
              'landing_badge',
              'landing_title',
              'landing_subtitle',
              'active',
              'created_at',
            ].join(','),
          )
          .eq('active', true)
          .order('created_at', { ascending: false });

        if (productsError) {
          throw productsError;
        }

        // O projeto atual não expõe o schema completo do Supabase
        // ao TypeScript. A consulta funciona em runtime, então
        // tipamos explicitamente o retorno antes de transformá-lo.
        const rows = (data ?? []) as unknown as LinkHubProduct[];

        const validOffers = rows
          .filter(
            (item) =>
              typeof item.slug === 'string' &&
              item.slug.trim().length > 0,
          )
          .map((item) => ({
            id: String(item.id),
            name: String(item.name ?? ''),
            slug: String(item.slug).trim(),
            thumbnail_url:
              typeof item.thumbnail_url === 'string' &&
              item.thumbnail_url.trim()
                ? item.thumbnail_url.trim()
                : null,
            landing_badge:
              typeof item.landing_badge === 'string'
                ? item.landing_badge.trim()
                : null,
            landing_title:
              typeof item.landing_title === 'string'
                ? item.landing_title.trim()
                : null,
            landing_subtitle:
              typeof item.landing_subtitle === 'string'
                ? item.landing_subtitle.trim()
                : null,
            active: Boolean(item.active),
            created_at: String(item.created_at ?? ''),
          }));

        if (mounted) {
          setProducts(validOffers);
        }
      } catch (loadError) {
        console.error(
          '[Forge3D] Erro ao carregar central de ofertas:',
          loadError,
        );

        if (mounted) {
          setError(
            'Não foi possível carregar as ofertas da Forge3D.',
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void loadLinkHub();

    return () => {
      mounted = false;
    };
  }, []);

  const visibleProducts = useMemo(
    () => products.filter((product) => product.active),
    [products],
  );

  return (
    <main
      className="forge-links-page"
      aria-label="Central de ofertas Forge3D"
    >
      <div
        className="forge-links-phone"
        aria-label="Central de links Forge3D"
      >
        <div
          className="forge-links-topbar"
          aria-hidden="true"
        >
          <span />
          <span />
          <span />
        </div>

        <div className="forge-links-content">
          <div
            className="forge-links-brand"
            aria-label="Forge3D"
          >
            <span className="forge-links-mark">
              F
            </span>
            <span>
              FORGE<span>3D</span>
            </span>
          </div>

          <section className="forge-links-hero">
            <div
              className="forge-links-hero-art"
              aria-hidden="true"
            />

            <div className="forge-links-hero-copy">
              <h1>
                ARQUIVOS STL E
                <strong>PEÇAS IMPRESSAS EM 3D</strong>
              </h1>

              <p>
                PROJETOS EXCLUSIVOS&nbsp;&nbsp;•&nbsp;&nbsp;
                ALTA QUALIDADE&nbsp;&nbsp;•&nbsp;&nbsp;
                ENTREGA RÁPIDA
              </p>
            </div>
          </section>

          {loading ? (
            <p className="forge-links-status">
              CARREGANDO OFERTAS...
            </p>
          ) : null}

          {error ? (
            <p
              className="forge-links-status forge-links-status-error"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          {!loading && !error && visibleProducts.length === 0 ? (
            <div className="forge-links-empty">
              <strong>Nenhuma oferta disponível.</strong>
              <small>
                Cadastre um produto ativo no Admin para ele aparecer aqui
                automaticamente.
              </small>
            </div>
          ) : null}

          <nav
            className="forge-links-list"
            aria-label="Ofertas Forge3D"
          >
            {visibleProducts.map((product, index) => {
              const tone = toneForIndex(index);
              const title =
                cleanText(product.landing_title) ||
                cleanText(product.name);
              const subtitle =
                cleanText(product.landing_subtitle) ||
                cleanText(product.landing_badge) ||
                'Confira esta oferta da Forge3D';

              return (
                <Link
                  key={product.id}
                  to={`/oferta/${encodeURIComponent(product.slug)}`}
                  className={`forge-link-card forge-link-${tone}`}
                  aria-label={`${title}: ${subtitle}`}
                >
                  <span className="forge-link-thumb">
                    {product.thumbnail_url ? (
                      <img
                        src={product.thumbnail_url}
                        alt={title}
                        loading={index < 3 ? 'eager' : 'lazy'}
                      />
                    ) : (
                      <span
                        className="forge-link-thumb-empty"
                        aria-hidden="true"
                      />
                    )}
                  </span>

                  <span className="forge-link-copy">
                    <strong>{title.toUpperCase()}</strong>
                    <small>{subtitle}</small>
                  </span>

                  <span
                    className="forge-link-arrow"
                    aria-hidden="true"
                  >
                    →
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </main>
  );
}
