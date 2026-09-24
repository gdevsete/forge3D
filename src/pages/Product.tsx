
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Download,
  Heart,
  Minus,
  Plus,
  ShieldCheck,
  Star,
  Truck,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  useProducts,
  type Product as CatalogProduct,
  type ProductMedia,
} from '../lib/catalog';
import type { PurchaseType } from '../lib/cart';
import {
  trackAddToCart,
  trackAddToWishlist,
  trackViewContent,
} from '../lib/analytics';
interface ProductProps {
  onAdd: (
    product: CatalogProduct,
    quantity?: number,
    purchaseType?: PurchaseType,
  ) => void;
}
export function Product({
  onAdd,
}: ProductProps) {
  const { slug } = useParams();
  const {
    products,
    loading,
    error,
  } = useProducts();
  const [quantity, setQuantity] = useState(1);
  const [selectedMediaId, setSelectedMediaId] =
    useState<string | null>(null);
  const product = useMemo(() => {
    return products.find(
      (item) => item.slug === slug,
    );
  }, [products, slug]);
  const media = useMemo<ProductMedia[]>(() => {
    if (!product) {
      return [];
    }
    if (product.media.length > 0) {
      return product.media;
    }
    return [
      {
        id: `fallback-${product.id}`,
        productId: product.id,
        mediaType: 'image',
        mediaUrl: product.image,
        thumbnailUrl: product.image,
        altText: product.name,
        sortOrder: 0,
        isPrimary: true,
      },
    ];
  }, [product]);
  const selectedMedia = useMemo(() => {
    if (media.length === 0) {
      return null;
    }
    return (
      media.find(
        (item) => item.id === selectedMediaId,
      ) || media[0]
    );
  }, [media, selectedMediaId]);
  useEffect(() => {
    setQuantity(1);
    setSelectedMediaId(null);
  }, [product?.id]);
  useEffect(() => {
    if (!product) {
      return;
    }
    trackViewContent({
      content_ids: [product.id],
      content_name: product.name,
      content_type: 'product',
      value: product.stlPrice,
      currency: 'BRL',
    });
  }, [product?.id]);
  if (loading) {
    return (
      <div className="container not-found">
        <h1>Carregando produto...</h1>
        <p>
          Aguarde enquanto buscamos os detalhes
          do produto.
        </p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="container not-found">
        <h1>Erro ao carregar o produto.</h1>
        <p>{error}</p>
        <Link to="/stl">
          Voltar para os produtos
        </Link>
      </div>
    );
  }
  if (!product) {
    return (
      <div className="container not-found">
        <h1>Produto não encontrado.</h1>
        <p>
          Esse produto pode ter sido removido
          ou ainda não está disponível.
        </p>
        <Link to="/stl">
          Voltar para os produtos
        </Link>
      </div>
    );
  }
  const buy = (purchaseType: PurchaseType) => {
    const price =
      purchaseType === 'stl'
        ? product.stlPrice
        : product.printedPrice;

    onAdd(product, quantity, purchaseType);

    trackAddToCart({
      content_ids: [product.id],
      content_name: product.name,
      content_type: 'product',
      value: price * quantity,
      currency: 'BRL',
      num_items: quantity,
    });
  };

  const addToWishlist = () => {
    trackAddToWishlist({
      content_ids: [product.id],
      content_name: product.name,
      content_type: 'product',
      value: product.stlPrice,
      currency: 'BRL',
    });
  };

  const formattedStlPrice = product.stlPrice
    .toFixed(2)
    .replace('.', ',');

  const formattedPrintedPrice = product.printedPrice
    .toFixed(2)
    .replace('.', ',');

  const formattedCompareStlPrice =
    product.compareStlPrice !== null
      ? product.compareStlPrice
          .toFixed(2)
          .replace('.', ',')
      : null;

  const formattedComparePrintedPrice =
    product.comparePrintedPrice !== null
      ? product.comparePrintedPrice
          .toFixed(2)
          .replace('.', ',')
      : null;

  return (
    <section className="product-page">
      <div className="container">
        <div className="breadcrumbs">
          <Link to="/">Início</Link>
          <span>/</span>
          <Link
            to={
              product.type === 'stl'
                ? '/stl'
                : '/impressao-3d'
            }
          >
            {product.type === 'stl'
              ? 'Arquivos STL'
              : 'Impressão 3D'}
          </Link>
          <span>/</span>
          <strong>{product.name}</strong>
        </div>
        <div className="product-detail">
          <div className="product-gallery">
            <div className="main-product-image">
              {selectedMedia?.mediaType ===
              'video' ? (
                <video
                  src={selectedMedia.mediaUrl}
                  poster={
                    selectedMedia.thumbnailUrl ||
                    undefined
                  }
                  controls
                  playsInline
                  preload="metadata"
                  aria-label={
                    selectedMedia.altText
                  }
                />
              ) : (
                <img
                  src={
                    selectedMedia?.mediaUrl ||
                    product.image
                  }
                  alt={
                    selectedMedia?.altText ||
                    product.name
                  }
                />
              )}
              {product.badge && (
                <span>{product.badge}</span>
              )}
            </div>
            {media.length > 0 && (
              <div
                className="product-media-thumbnails"
                aria-label="Galeria do produto"
              >
                {media.map((item) => {
                  const isSelected =
                    item.id ===
                    selectedMedia?.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={
                        isSelected
                          ? 'media-thumbnail active'
                          : 'media-thumbnail'
                      }
                      onClick={() =>
                        setSelectedMediaId(
                          item.id,
                        )
                      }
                      aria-label={
                        item.mediaType ===
                        'video'
                          ? `Ver vídeo: ${item.altText}`
                          : `Ver imagem: ${item.altText}`
                      }
                    >
                      {item.mediaType ===
                      'video' ? (
                        <span className="video-thumbnail">
                          <video
                            src={item.mediaUrl}
                            poster={
                              item.thumbnailUrl ||
                              undefined
                            }
                            muted
                            preload="metadata"
                            playsInline
                            aria-hidden="true"
                          />
                          <span className="video-thumbnail-label">
                            ▶
                          </span>
                        </span>
                      ) : (
                        <img
                          src={item.mediaUrl}
                          alt={item.altText}
                          loading="lazy"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="gallery-caption">
              <span>
                <Download size={15} />
                {product.type === 'stl'
                  ? 'Arquivo digital'
                  : 'Peça física'}
              </span>
              <span>
                <ShieldCheck size={15} />
                Compra segura
              </span>
            </div>
          </div>
          <div className="product-buybox">
            <span className="product-type">
              {product.type === 'stl'
                ? 'ARQUIVO STL'
                : 'IMPRESSÃO 3D'}
              {' • '}
              {product.category}
            </span>
            <h1>{product.name}</h1>
            <div className="big-rating">
              <Star
                size={17}
                fill="currentColor"
              />
              <strong>
                {product.rating
                  .toFixed(1)
                  .replace('.', ',')}
              </strong>
              <span>
                ({product.reviews} avaliações)
              </span>
            </div>
            <p className="product-description">
              {product.description}
            </p>
            <div className="product-price-options">
              <div className="product-price-option">
                <span>COMPRAR STL</span>
                {formattedCompareStlPrice && (
                  <del>
                    R$ {formattedCompareStlPrice}
                  </del>
                )}
                <strong>
                  R$ {formattedStlPrice}
                </strong>
                {formattedCompareStlPrice && (
                  <small>OFERTA</small>
                )}
              </div>

              <div className="product-price-option product-price-option-printed">
                <span>MODELO IMPRESSO</span>
                {formattedComparePrintedPrice && (
                  <del>
                    R$ {formattedComparePrintedPrice}
                  </del>
                )}
                <strong>
                  R$ {formattedPrintedPrice}
                </strong>
                {formattedComparePrintedPrice && (
                  <small>OFERTA</small>
                )}
              </div>
            </div>

            {product.type === 'physical' && (
              <div className="variant-box">
                <label htmlFor="product-color">
                  Cor
                </label>
                <select
                  id="product-color"
                  defaultValue="Preto"
                >
                  <option value="Preto">
                    Preto
                  </option>
                  <option value="Branco">
                    Branco
                  </option>
                  <option value="Laranja">
                    Laranja
                  </option>
                </select>
              </div>
            )}
            <div className="variant-box">
              <label>Quantidade</label>
              <div className="quantity">
                <button
                  type="button"
                  aria-label="Diminuir quantidade"
                  onClick={() =>
                    setQuantity((current) =>
                      Math.max(1, current - 1),
                    )
                  }
                  disabled={quantity === 1}
                >
                  <Minus size={15} />
                </button>
                <strong>{quantity}</strong>
                <button
                  type="button"
                  aria-label="Aumentar quantidade"
                  onClick={() =>
                    setQuantity((current) =>
                      Math.min(100, current + 1),
                    )
                  }
                  disabled={quantity === 100}
                >
                  <Plus size={15} />
                </button>
              </div>
            </div>
            <div className="product-buy-options">
              <button
                type="button"
                className="main-buy"
                onClick={() => buy('stl')}
                data-track="buy-product"
                data-track-label={`${product.name} - STL`}
              >
                COMPRAR STL AGORA
                <ArrowRight size={19} />
              </button>

              <button
                type="button"
                className="main-buy product-buy-printed"
                onClick={() => buy('physical')}
                data-track="buy-product"
                data-track-label={`${product.name} - Modelo impresso`}
              >
                COMPRAR MODELO IMPRESSO
                <ArrowRight size={19} />
              </button>
            </div>

            <button
              type="button"
              className="wishlist"
              onClick={addToWishlist}
              data-track="add-to-wishlist"
              data-track-label={product.name}
            >
              <Heart size={18} />
              ADICIONAR AOS FAVORITOS
            </button>
            <div className="buy-trust">
              <div>
                <ShieldCheck size={18} />
                <span>
                  <strong>Compra segura</strong>
                  <small>
                    Pagamento protegido
                  </small>
                </span>
              </div>
              <div>
                <Download size={18} />
                <span>
                  <strong>Acesso digital</strong>
                  <small>
                    Arquivo STL após confirmação do pagamento
                  </small>
                </span>
              </div>

              <div>
                <Truck size={18} />
                <span>
                  <strong>Modelo impresso</strong>
                  <small>
                    Produção e envio após a confirmação do pagamento
                  </small>
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="product-info-block">
          <div>
            <span className="eyebrow">
              DETALHES
            </span>
            <h2>O que você recebe</h2>
            {product.details.map((detail) => (
              <div
                className="detail-line"
                key={detail}
              >
                <Check size={17} />
                <span>{detail}</span>
              </div>
            ))}
          </div>
          <div className="license-card">
            <strong>
              Informações do produto
            </strong>
            <p>
              As especificações técnicas e a
              licença de uso devem ser conferidas
              antes da compra. Cada modelo pode
              possuir regras próprias.
            </p>
            <Link to="/sobre">
              VER POLÍTICAS
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>
        <div className="product-faq">
          <span className="eyebrow">
            DÚVIDAS
          </span>
          <h2>
            Perguntas sobre este produto
          </h2>
          <details>
            <summary>
              Como recebo este produto?
            </summary>
            <p>
              Para a compra do STL, após o pagamento confirmado,
              o download ficará disponível conforme a implementação
              da área do cliente. Para o modelo impresso, depois do
              pagamento, o pedido entra no fluxo de produção e envio.
            </p>
          </details>
          <details>
            <summary>
              Posso tirar dúvidas antes de comprar?
            </summary>
            <p>
              Sim. Entre em contato com a
              Forge3D pelo canal de atendimento.
            </p>
          </details>
        </div>
        <Link
          to={
            product.type === 'stl'
              ? '/stl'
              : '/impressao-3d'
          }
          className="back-to-products"
        >
          <ArrowLeft size={16} />
          Voltar para os produtos
        </Link>
      </div>
    </section>
  );
}
