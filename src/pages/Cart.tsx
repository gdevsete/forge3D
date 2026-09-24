import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
} from 'lucide-react';
import type { Product } from '../lib/catalog';
import type {
  CartItem,
  PurchaseType,
} from '../lib/cart';
import {
  getCartItemPrice,
  getCartQuantity,
  getCartTotal,
} from '../lib/cart';
import { trackInitiateCheckout } from '../lib/analytics';

interface CartProps {
  items: CartItem[];
  onRemove: (
    id: string,
    purchaseType?: PurchaseType,
  ) => void;
  onAdd: (
    product: Product,
    quantity?: number,
    purchaseType?: PurchaseType,
  ) => void;
  onChangeQuantity: (
    productId: string,
    quantity: number,
    purchaseType?: PurchaseType,
  ) => void;
}

function formatPrice(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

function getPurchaseTypeLabel(purchaseType: PurchaseType): string {
  return purchaseType === 'stl'
    ? 'ARQUIVO STL'
    : 'MODELO IMPRESSO';
}

export function Cart({
  items,
  onRemove,
  onAdd,
  onChangeQuantity,
}: CartProps) {
  const navigate = useNavigate();
  const total = getCartTotal(items);
  const itemCount = getCartQuantity(items);

  if (!items.length) {
    return (
      <div className="container empty-cart">
        <ShoppingBag size={42} />
        <h1>Seu carrinho está vazio.</h1>
        <p>
          Encontre um modelo e comece seu próximo projeto.
        </p>
        <Link to="/stl" className="btn btn-dark">
          EXPLORAR STL
          <ArrowRight size={18} />
        </Link>
      </div>
    );
  }

  const handleCheckout = () => {
    trackInitiateCheckout({
      content_ids: items.map(
        (item) => item.product.id,
      ),
      value: total,
      currency: 'BRL',
      num_items: itemCount,
    });

    navigate('/checkout');
  };

  return (
    <section className="cart-page">
      <div className="container">
        <div className="page-title">
          <span className="eyebrow">SEU PEDIDO</span>
          <h1>Carrinho</h1>
        </div>

        <div className="cart-layout">
          <div className="cart-list">
            {items.map(
              ({
                product,
                quantity,
                purchaseType,
              }) => {
                const itemPrice = getCartItemPrice({
                  product,
                  quantity,
                  purchaseType,
                });

                return (
                  <article
                    className="cart-item"
                    key={`${product.id}-${purchaseType}`}
                  >
                    <img
                      src={product.image}
                      alt={product.name}
                    />

                    <div className="cart-item-main">
                      <span>
                        {getPurchaseTypeLabel(purchaseType)}
                      </span>

                      <h3>{product.name}</h3>

                      <strong>
                        {formatPrice(itemPrice)}
                      </strong>

                      <div className="qty">
                        <button
                          type="button"
                          onClick={() =>
                            onChangeQuantity(
                              product.id,
                              quantity - 1,
                              purchaseType,
                            )
                          }
                          aria-label={
                            'Diminuir quantidade de ' +
                            product.name
                          }
                        >
                          <Minus size={14} />
                        </button>

                        <b>{quantity}</b>

                        <button
                          type="button"
                          onClick={() =>
                            onAdd(
                              product,
                              1,
                              purchaseType,
                            )
                          }
                          aria-label={
                            'Aumentar quantidade de ' +
                            product.name
                          }
                          disabled={quantity === 100}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="remove"
                      onClick={() =>
                        onRemove(
                          product.id,
                          purchaseType,
                        )
                      }
                      aria-label={
                        'Remover ' +
                        product.name +
                        ' do carrinho'
                      }
                    >
                      <Trash2 size={18} />
                    </button>
                  </article>
                );
              },
            )}
          </div>

          <aside className="summary">
            <h2>Resumo</h2>

            <div>
              <span>Subtotal</span>
              <strong>{formatPrice(total)}</strong>
            </div>

            <div>
              <span>Frete</span>
              <strong>
                {items.every(
                  (item) =>
                    item.purchaseType === 'stl',
                )
                  ? 'Grátis'
                  : 'Calculado no checkout'}
              </strong>
            </div>

            <hr />

            <div className="summary-total">
              <span>Total</span>
              <strong>{formatPrice(total)}</strong>
            </div>

            <button
              type="button"
              className="main-buy"
              onClick={handleCheckout}
              data-track="initiate-checkout"
              data-track-label="Ir para o pagamento"
            >
              IR PARA O PAGAMENTO
              <ArrowRight size={18} />
            </button>

            <p className="secure-note">
              🔒 Compra segura. Seus dados são protegidos.
            </p>
          </aside>
        </div>
      </div>
    </section>
  );
}
