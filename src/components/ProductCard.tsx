import { Link } from 'react-router-dom';
import {
  Heart,
  ArrowUpRight,
  Star,
} from 'lucide-react';

import type { Product } from '../lib/catalog';
import type { PurchaseType } from '../lib/cart';

import { trackEvent } from '../lib/analytics';

interface ProductCardProps {
  p: Product;

  onAdd: (
    p: Product,
    quantity?: number,
    purchaseType?: PurchaseType,
  ) => void;
}

function formatPrice(value: number): string {
  return value.toFixed(2).replace('.', ',');
}

export function ProductCard({
  p,
  onAdd,
}: ProductCardProps) {
  function handleAdd(
    purchaseType: PurchaseType,
  ) {
    const price =
      purchaseType === 'stl'
        ? p.stlPrice
        : p.printedPrice;

    onAdd(
      p,
      1,
      purchaseType,
    );

    trackEvent(
      'AddToCart',
      {
        content_ids: [p.id],
        content_name: p.name,
        content_type: purchaseType,
        value: price,
        currency: 'BRL',
        num_items: 1,
      },
    );
  }

  return (
    <article className="product-card">
      <Link
        to={`/produto/${p.slug}`}
        className="product-media"
        onClick={() =>
          trackEvent(
            'ViewContent',
            {
              content_ids: [p.id],
              content_name: p.name,
              content_type: 'product',
              value: p.stlPrice,
              currency: 'BRL',
            },
          )
        }
      >
        <img
          src={p.image}
          alt={p.name}
          loading="lazy"
        />

        {p.badge && (
          <span className="product-badge">
            {p.badge}
          </span>
        )}

        <button
          type="button"
          className="favorite-button"
          aria-label={`Adicionar ${p.name} aos favoritos`}
          data-track="add_to_wishlist"
          data-track-label={p.name}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();

            trackEvent(
              'AddToWishlist',
              {
                content_ids: [p.id],
                content_name: p.name,
                value: p.stlPrice,
                currency: 'BRL',
              },
            );
          }}
        >
          <Heart size={18} />
        </button>
      </Link>

      <div className="product-info">
        <div className="product-type">
          {p.type === 'stl'
            ? 'ARQUIVO STL'
            : 'IMPRESSÃO 3D'}

          <span>•</span>

          {p.category}
        </div>

        <Link
          to={`/produto/${p.slug}`}
          className="product-name"
        >
          {p.name}
        </Link>

        <div
          className="product-rating"
          aria-label={`${p.rating} de 5 estrelas, ${p.reviews} avaliações`}
        >
          <Star
            size={15}
            fill="currentColor"
          />

          <strong>
            {p.rating
              .toFixed(1)
              .replace('.', ',')}
          </strong>

          <span>
            ({p.reviews})
          </span>
        </div>

        <div className="product-price-options">
          <div className="product-price-option">
            <span>STL</span>

            {p.compareStlPrice !== null &&
              p.compareStlPrice > p.stlPrice && (
                <del>
                  R$ {formatPrice(p.compareStlPrice)}
                </del>
              )}

            <strong>
              R$ {formatPrice(p.stlPrice)}
            </strong>
          </div>

          <div className="product-price-option">
            <span>MODELO IMPRESSO</span>

            {p.comparePrintedPrice !== null &&
              p.comparePrintedPrice > p.printedPrice && (
                <del>
                  R$ {formatPrice(p.comparePrintedPrice)}
                </del>
              )}

            <strong>
              R$ {formatPrice(p.printedPrice)}
            </strong>
          </div>
        </div>

        <div className="product-bottom">
          <div className="product-buy-actions">
            <button
              type="button"
              className="product-buy"
              data-track="add_to_cart"
              data-track-label={`${p.name} - STL`}
              onClick={() =>
                handleAdd('stl')
              }
            >
              COMPRAR STL

              <span>
                R$ {formatPrice(p.stlPrice)}
              </span>

              <ArrowUpRight
                size={16}
              />
            </button>

            <button
              type="button"
              className="product-buy product-buy-printed"
              data-track="add_to_cart"
              data-track-label={`${p.name} - Modelo impresso`}
              onClick={() =>
                handleAdd(
                  'physical',
                )
              }
            >
              COMPRAR MODELO IMPRESSO

              <span>
                R$ {formatPrice(p.printedPrice)}
              </span>

              <ArrowUpRight
                size={16}
              />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
