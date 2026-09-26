import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  LockKeyhole,
  PackageCheck,
  Printer,
  ShieldCheck,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

import {
  useProducts,
  type Product,
  type ProductMedia,
} from '../lib/catalog';
import {
  trackAddToCart,
  trackViewContent,
} from '../lib/analytics';
import type { PurchaseType } from '../lib/cart';

interface LandingPageProps {
  onAdd: (
    product: Product,
    quantity?: number,
    purchaseType?: PurchaseType,
  ) => void;
}

function formatPrice(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function getDiscountPercent(
  current: number,
  compare: number | null,
): number | null {
  if (!compare || compare <= current || current <= 0) {
    return null;
  }

  return Math.round(
    ((compare - current) / compare) * 100,
  );
}

function normalizeMedia(product: Product): ProductMedia[] {
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
}

function cleanText(value: string): string {
  return value
    .replace(
      /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu,
      '',
    )
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.!?;:])/g, '$1')
    .trim();
}

function buildDescriptionParagraphs(
  description: string,
): string[] {
  const cleaned = cleanText(description);

  if (!cleaned) {
    return [];
  }

  const blocks = cleaned
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  if (blocks.length > 1) {
    return blocks;
  }

  const sentences =
    cleaned.match(/[^.!?]+[.!?]+(?:\s|$)/g) || [
      cleaned,
    ];

  const paragraphs: string[] = [];
  let current: string[] = [];

  for (const sentence of sentences) {
    const normalized = sentence.trim();

    if (!normalized) {
      continue;
    }

    current.push(normalized);

    if (
      current.length === 2 ||
      current.join(' ').length > 250
    ) {
      paragraphs.push(
        current.join(' '),
      );
      current = [];
    }
  }

  if (current.length > 0) {
    paragraphs.push(current.join(' '));
  }

  return paragraphs.length > 0
    ? paragraphs
    : [cleaned];
}

function getHeroDescription(
  description: string,
): string {
  const paragraphs =
    buildDescriptionParagraphs(description);

  if (!paragraphs.length) {
    return 'Um modelo criado para quem quer imprimir, montar e aproveitar o projeto.';
  }

  const value = paragraphs[0];

  if (value.length <= 190) {
    return value;
  }

  return `${value.slice(0, 187).trimEnd()}...`;
}

const objections = [
  {
    question:
      'E se eu pagar e não receber?',
    answer:
      'O pagamento confirmado gera o registro do pedido. Na compra do STL, a entrega digital é preparada para o e-mail informado no checkout.',
    proof:
      'Pedido registrado após a confirmação',
  },
  {
    question:
      'Será que esse modelo é o que eu preciso?',
    answer:
      'A página mostra o produto, imagens, descrição e informações disponíveis antes da compra. Você consegue avaliar o modelo antes de finalizar.',
    proof:
      'Informações do produto antes do pagamento',
  },
  {
    question:
      'Não tenho impressora 3D.',
    answer:
      'Sem problema. Quando o produto estiver disponível na modalidade impressa, você pode escolher a peça pronta em vez do arquivo.',
    proof:
      'Escolha entre STL e peça impressa',
  },
  {
    question:
      'Como vou pagar?',
    answer:
      'O checkout apresenta o valor do pedido e o pagamento por PIX. Você confere os dados antes de confirmar.',
    proof:
      'PIX no checkout',
  },
];

export function LandingPage({
  onAdd,
}: LandingPageProps) {
  const { slug } = useParams();
  const navigate = useNavigate();

  const {
    products,
    loading,
    error,
  } = useProducts();

  const [selectedMediaId, setSelectedMediaId] =
    useState<string | null>(null);
  const [activeObjection, setActiveObjection] =
    useState(0);

  const product = useMemo(
    () =>
      products.find(
        (item) => item.slug === slug,
      ),
    [products, slug],
  );

  const media = useMemo(
    () =>
      product
        ? normalizeMedia(product)
        : [],
    [product],
  );

  const selectedMedia = useMemo(() => {
    if (!media.length) {
      return null;
    }

    return (
      media.find(
        (item) =>
          item.id === selectedMediaId,
      ) || media[0]
    );
  }, [media, selectedMediaId]);

  const descriptionParagraphs = useMemo(
    () =>
      product
        ? buildDescriptionParagraphs(
            product.description,
          )
        : [],
    [product],
  );

  const heroDescription = useMemo(
    () =>
      product
        ? getHeroDescription(
            product.description,
          )
        : '',
    [product],
  );

  useEffect(() => {
    if (!product) {
      return;
    }

    trackViewContent({
      content_ids: [product.id],
      content_name: product.name,
      content_type: 'product',
      value:
        product.stlPrice ||
        product.printedPrice,
      currency: 'BRL',
    });
  }, [product?.id]);

  useEffect(() => {
    setSelectedMediaId(null);
    setActiveObjection(0);
  }, [product?.id]);

  function buy(
    purchaseType: PurchaseType,
  ) {
    if (!product) {
      return;
    }

    const price =
      purchaseType === 'stl'
        ? product.stlPrice
        : product.printedPrice;

    if (price <= 0) {
      return;
    }

    onAdd(
      product,
      1,
      purchaseType,
    );

    trackAddToCart({
      content_ids: [product.id],
      content_name: product.name,
      content_type: purchaseType,
      value: price,
      currency: 'BRL',
      num_items: 1,
    });

    navigate('/checkout');
  }

  function previousObjection() {
    setActiveObjection(
      (current) =>
        current === 0
          ? objections.length - 1
          : current - 1,
    );
  }

  function nextObjection() {
    setActiveObjection(
      (current) =>
        current ===
        objections.length - 1
          ? 0
          : current + 1,
    );
  }

  if (loading) {
    return (
      <main className="forge-landing">
        <div className="forge-landing-loading">
          <div className="forge-landing-spinner" />
          <span>Carregando produto...</span>
        </div>
      </main>
    );
  }

  if (error || !product) {
    return (
      <main className="forge-landing">
        <section className="forge-landing-error">
          <span className="forge-landing-label">
            FORGE3D
          </span>
          <h1>
            Este produto não está
            disponível.
          </h1>
          <p>
            {error ||
              'A oferta que você tentou abrir não está disponível no momento.'}
          </p>
          <button
            type="button"
            className="forge-landing-button dark"
            onClick={() => navigate('/stl')}
          >
            VER CATÁLOGO
            <ArrowRight size={18} />
          </button>
        </section>
      </main>
    );
  }

  const stlDiscount =
    getDiscountPercent(
      product.stlPrice,
      product.compareStlPrice,
    );

  const printedDiscount =
    getDiscountPercent(
      product.printedPrice,
      product.comparePrintedPrice,
    );

  return (
    <main className="forge-landing">
      <div className="forge-landing-trustbar">
        <div className="forge-landing-wrap trustbar-inner">
          <span>
            COMPRA SEGURA
          </span>
          <i />
          <span>
            PAGAMENTO VIA PIX
          </span>
          <i />
          <span>
            PEDIDO REGISTRADO APÓS O PAGAMENTO
          </span>
        </div>
      </div>

      <header className="forge-landing-header">
        <div className="forge-landing-wrap header-inner">
          <button
            type="button"
            className="forge-landing-logo"
            onClick={() => navigate('/')}
            aria-label="Forge3D"
          >
            <span className="logo-mark">
              F
            </span>
            <span className="logo-word">
              FORGE<span>3D</span>
            </span>
          </button>

          <button
            type="button"
            className="forge-landing-catalog-link"
            onClick={() =>
              navigate('/stl')
            }
          >
            VER CATÁLOGO
            <ArrowRight size={15} />
          </button>
        </div>
      </header>

      <section className="forge-landing-hero">
        <div className="forge-landing-wrap hero-grid">
          <div className="hero-copy">
            <span className="forge-landing-label">
              {product.category.toUpperCase()}
            </span>

            <h1>{product.name}</h1>

            <p className="hero-description">
              {heroDescription}
            </p>

            <div className="hero-assurance">
              <span>
                <Check size={14} />
                Informações antes da compra
              </span>
              <span>
                <Check size={14} />
                PIX no checkout
              </span>
              <span>
                <Check size={14} />
                Compra direta
              </span>
            </div>

            <div className="hero-price-area">
              <span className="buy-title">
                ESCOLHA COMO VOCÊ QUER RECEBER
              </span>

              <button
                type="button"
                className="buy-option primary"
                onClick={() =>
                  buy('stl')
                }
                disabled={
                  product.stlPrice <= 0
                }
              >
                <span className="buy-option-main">
                  <span className="buy-option-label">
                    ARQUIVO STL
                  </span>
                  <strong>
                    {formatPrice(
                      product.stlPrice,
                    )}
                  </strong>
                  {product.compareStlPrice && (
                    <del>
                      {formatPrice(
                        product.compareStlPrice,
                      )}
                    </del>
                  )}
                </span>

                <span className="buy-option-action">
                  COMPRAR
                  <ArrowRight
                    size={17}
                  />
                </span>
              </button>

              <button
                type="button"
                className="buy-option secondary"
                onClick={() =>
                  buy('physical')
                }
                disabled={
                  product.printedPrice <=
                  0
                }
              >
                <span className="buy-option-main">
                  <span className="buy-option-label">
                    MODELO IMPRESSO
                  </span>
                  <strong>
                    {formatPrice(
                      product.printedPrice,
                    )}
                  </strong>
                  {product.comparePrintedPrice && (
                    <del>
                      {formatPrice(
                        product.comparePrintedPrice,
                      )}
                    </del>
                  )}
                </span>

                <span className="buy-option-action">
                  COMPRAR
                  <Printer size={17} />
                </span>
              </button>

              {(stlDiscount ||
                printedDiscount) && (
                <div className="discount-note">
                  {stlDiscount && (
                    <span>
                      {stlDiscount}% OFF NO STL
                    </span>
                  )}
                  {printedDiscount && (
                    <span>
                      {printedDiscount}% OFF NO IMPRESSO
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="hero-gallery">
            <div className="hero-image">
              {selectedMedia?.mediaType ===
              'video' ? (
                <video
                  src={
                    selectedMedia.mediaUrl
                  }
                  poster={
                    selectedMedia.thumbnailUrl ||
                    product.image
                  }
                  controls
                  playsInline
                  preload="metadata"
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
                <span className="product-tag">
                  {product.badge}
                </span>
              )}
            </div>

            {media.length > 1 && (
              <div className="hero-thumbnails">
                {media.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={
                      item.id ===
                      selectedMedia?.id
                        ? 'active'
                        : ''
                    }
                    onClick={() =>
                      setSelectedMediaId(
                        item.id,
                      )
                    }
                    aria-label={`Ver mídia ${item.sortOrder + 1}`}
                  >
                    {item.mediaType ===
                    'video' ? (
                      <span className="video-thumb">
                        ▶
                      </span>
                    ) : (
                      <img
                        src={
                          item.thumbnailUrl ||
                          item.mediaUrl
                        }
                        alt=""
                      />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="forge-landing-choice">
        <div className="forge-landing-wrap">
          <div className="section-intro">
            <span className="forge-landing-label">
              DUAS FORMAS DE COMPRAR
            </span>
            <h2>
              Você escolhe o formato.
            </h2>
            <p>
              O mesmo modelo pode ser
              adquirido como arquivo digital
              ou, quando disponível, como peça
              impressa.
            </p>
          </div>

          <div className="choice-grid">
            <article className="choice-block">
              <div className="choice-number">
                01
              </div>
              <div>
                <h3>Arquivo STL</h3>
                <p>
                  Para quem tem impressora 3D
                  e quer produzir o modelo por
                  conta própria.
                </p>
              </div>
              <div className="choice-price">
                {formatPrice(
                  product.stlPrice,
                )}
              </div>
              <button
                type="button"
                onClick={() =>
                  buy('stl')
                }
                disabled={
                  product.stlPrice <= 0
                }
              >
                COMPRAR STL
                <ArrowRight size={17} />
              </button>
            </article>

            <article className="choice-block">
              <div className="choice-number">
                02
              </div>
              <div>
                <h3>
                  Modelo impresso
                </h3>
                <p>
                  Para quem prefere receber a
                  peça produzida pela Forge3D,
                  quando essa modalidade
                  estiver disponível.
                </p>
              </div>
              <div className="choice-price">
                {formatPrice(
                  product.printedPrice,
                )}
              </div>
              <button
                type="button"
                onClick={() =>
                  buy('physical')
                }
                disabled={
                  product.printedPrice <=
                  0
                }
              >
                COMPRAR IMPRESSO
                <ArrowRight size={17} />
              </button>
            </article>
          </div>
        </div>
      </section>

      <section className="forge-landing-description">
        <div className="forge-landing-wrap description-grid">
          <div className="description-title">
            <span className="forge-landing-label">
              SOBRE ESTE MODELO
            </span>
            <h2>
              Veja os detalhes antes de
              comprar.
            </h2>
          </div>

          <div className="description-content">
            {descriptionParagraphs.length >
            0 ? (
              descriptionParagraphs.map(
                (paragraph) => (
                  <p key={paragraph}>
                    {paragraph}
                  </p>
                ),
              )
            ) : (
              <p>
                Produto desenvolvido pela
                Forge3D.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="forge-landing-details">
        <div className="forge-landing-wrap">
          <div className="section-intro">
            <span className="forge-landing-label">
              O QUE VOCÊ RECEBE
            </span>
            <h2>
              Informações do produto em um
              só lugar.
            </h2>
          </div>

          <div className="detail-list">
            {product.details
              .slice(0, 6)
              .map((detail, index) => (
                <div
                  className="detail-row"
                  key={`${detail}-${index}`}
                >
                  <span className="detail-check">
                    <Check size={15} />
                  </span>
                  <span>{detail}</span>
                </div>
              ))}
          </div>
        </div>
      </section>

      <section className="forge-landing-objections">
        <div className="forge-landing-wrap">
          <div className="section-intro">
            <span className="forge-landing-label">
              ANTES DE COMPRAR
            </span>
            <h2>
              Ainda está em dúvida?
            </h2>
            <p>
              Aqui estão as perguntas que
              costumam travar uma compra.
            </p>
          </div>

          <div className="objection-layout">
            <div className="objection-counter">
              <strong>
                {String(
                  activeObjection + 1,
                ).padStart(2, '0')}
              </strong>
              <span>
                / {String(
                  objections.length,
                ).padStart(2, '0')}
              </span>
            </div>

            <div className="objection-content">
              <span className="objection-label">
                DÚVIDA DE COMPRA
              </span>

              <h3>
                {
                  objections[
                    activeObjection
                  ].question
                }
              </h3>

              <p>
                {
                  objections[
                    activeObjection
                  ].answer
                }
              </p>

              <div className="objection-proof">
                <ShieldCheck size={16} />
                {
                  objections[
                    activeObjection
                  ].proof
                }
              </div>
            </div>

            <div className="objection-controls">
              <button
                type="button"
                onClick={
                  previousObjection
                }
                aria-label="Dúvida anterior"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                type="button"
                onClick={
                  nextObjection
                }
                aria-label="Próxima dúvida"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>

          <div className="objection-dots">
            {objections.map(
              (_, index) => (
                <button
                  type="button"
                  key={index}
                  className={
                    index ===
                    activeObjection
                      ? 'active'
                      : ''
                  }
                  onClick={() =>
                    setActiveObjection(
                      index,
                    )
                  }
                  aria-label={`Ir para dúvida ${index + 1}`}
                />
              ),
            )}
          </div>
        </div>
      </section>

      <section className="forge-landing-how">
        <div className="forge-landing-wrap">
          <div className="section-intro center">
            <span className="forge-landing-label">
              COMO FUNCIONA
            </span>
            <h2>
              Compra simples, do começo ao
              fim.
            </h2>
          </div>

          <div className="how-grid">
            <article>
              <span>01</span>
              <h3>
                Escolha o formato
              </h3>
              <p>
                STL para imprimir por conta
                própria ou modelo impresso
                quando disponível.
              </p>
            </article>

            <article>
              <span>02</span>
              <h3>
                Finalize no checkout
              </h3>
              <p>
                Confira seus dados e veja o
                valor antes de realizar o PIX.
              </p>
            </article>

            <article>
              <span>03</span>
              <h3>
                Receba sua entrega
              </h3>
              <p>
                O pedido avança após a
                confirmação do pagamento.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="forge-landing-final">
        <div className="forge-landing-wrap final-grid">
          <div>
            <span className="forge-landing-label">
              PRONTO PARA COMPRAR?
            </span>
            <h2>
              {product.name}
            </h2>
            <p>
              Escolha sua modalidade e
              finalize pelo checkout.
            </p>
          </div>

          <div className="final-buttons">
            <button
              type="button"
              className="forge-landing-button light"
              onClick={() =>
                buy('stl')
              }
              disabled={
                product.stlPrice <= 0
              }
            >
              COMPRAR STL
              <span>
                {formatPrice(
                  product.stlPrice,
                )}
              </span>
            </button>

            <button
              type="button"
              className="forge-landing-button orange"
              onClick={() =>
                buy('physical')
              }
              disabled={
                product.printedPrice <=
                0
              }
            >
              COMPRAR IMPRESSO
              <span>
                {formatPrice(
                  product.printedPrice,
                )}
              </span>
            </button>
          </div>
        </div>

        <div className="forge-landing-footer-note">
          <ShieldCheck size={14} />
          Compra segura • PIX • Pedido
          registrado após confirmação
        </div>
      </section>

      <style>{`
        .forge-landing {
          min-height: 100vh;
          background: #fff;
          color: #111;
          font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          overflow-x: hidden;
        }

        .forge-landing * {
          box-sizing: border-box;
        }

        .forge-landing button {
          font: inherit;
        }

        .forge-landing-wrap {
          width: min(1160px, calc(100% - 48px));
          margin: 0 auto;
        }

        .forge-landing-trustbar {
          background: #111;
          color: #fff;
        }

        .trustbar-inner {
          min-height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 18px;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: .13em;
        }

        .trustbar-inner i {
          width: 3px;
          height: 3px;
          border-radius: 50%;
          background: #ff5a1f;
          flex: 0 0 auto;
        }

        .forge-landing-header {
          background: #fff;
          border-bottom: 1px solid #e9e9e3;
        }

        .header-inner {
          min-height: 72px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .forge-landing-logo {
          display: inline-flex;
          align-items: center;
          gap: 9px;
          padding: 0;
          border: 0;
          background: transparent;
          color: #111;
          cursor: pointer;
        }

        .logo-mark {
          width: 28px;
          height: 28px;
          display: grid;
          place-items: center;
          background: #111;
          color: #ff5a1f;
          border-radius: 4px;
          font-size: 17px;
          line-height: 1;
          font-weight: 900;
        }

        .logo-word {
          font-size: 18px;
          font-weight: 900;
          letter-spacing: -.04em;
        }

        .logo-word span {
          color: #ff5a1f;
        }

        .forge-landing-catalog-link {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 10px 0;
          border: 0;
          background: transparent;
          color: #222;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: .13em;
          cursor: pointer;
        }

        .forge-landing-label {
          display: inline-block;
          color: #ff5a1f;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: .17em;
          line-height: 1.25;
        }

        .forge-landing-hero {
          padding: 64px 0 76px;
          background: #f7f7f4;
          border-bottom: 1px solid #e7e7e1;
        }

        .hero-grid {
          display: grid;
          grid-template-columns: minmax(0, .85fr) minmax(0, 1.15fr);
          gap: 58px;
          align-items: center;
        }

        .hero-copy {
          min-width: 0;
        }

        .hero-copy h1 {
          max-width: 620px;
          margin: 12px 0 16px;
          font-size: clamp(48px, 6vw, 78px);
          line-height: .93;
          letter-spacing: -.055em;
          font-weight: 900;
        }

        .hero-description {
          max-width: 570px;
          margin: 0;
          color: #60605b;
          font-size: 15px;
          line-height: 1.75;
        }

        .hero-assurance {
          margin-top: 21px;
          display: flex;
          flex-wrap: wrap;
          gap: 8px 16px;
        }

        .hero-assurance span {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: #32322f;
          font-size: 10px;
          font-weight: 800;
        }

        .hero-assurance svg {
          color: #ff5a1f;
        }

        .hero-price-area {
          margin-top: 27px;
          max-width: 620px;
        }

        .buy-title {
          display: block;
          margin-bottom: 9px;
          color: #777771;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: .13em;
        }

        .buy-option {
          width: 100%;
          min-height: 78px;
          margin-top: 8px;
          padding: 14px 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          text-align: left;
          border-radius: 8px;
          cursor: pointer;
          transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease;
        }

        .buy-option:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 12px 30px rgba(17, 17, 17, .08);
        }

        .buy-option:disabled {
          opacity: .45;
          cursor: not-allowed;
        }

        .buy-option.primary {
          border: 1px solid #111;
          background: #111;
          color: #fff;
        }

        .buy-option.secondary {
          border: 1px solid #d9d9d2;
          background: #fff;
          color: #111;
        }

        .buy-option-main {
          min-width: 0;
          display: flex;
          align-items: baseline;
          gap: 9px;
          flex-wrap: wrap;
        }

        .buy-option-label {
          width: 100%;
          margin-bottom: 2px;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: .13em;
        }

        .buy-option strong {
          font-size: 24px;
          line-height: 1;
          letter-spacing: -.04em;
        }

        .buy-option del {
          font-size: 10px;
          opacity: .55;
        }

        .buy-option-action {
          flex: 0 0 auto;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: .11em;
        }

        .discount-note {
          margin-top: 8px;
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
        }

        .discount-note span {
          padding: 5px 7px;
          border-radius: 3px;
          background: #ffe8dd;
          color: #cf4311;
          font-size: 8px;
          font-weight: 900;
          letter-spacing: .09em;
        }

        .hero-gallery {
          min-width: 0;
        }

        .hero-image {
          position: relative;
          width: 100%;
          overflow: hidden;
          background: #fff;
          border: 1px solid #deded7;
          border-radius: 12px;
        }

        .hero-image img,
        .hero-image video {
          display: block;
          width: 100%;
          aspect-ratio: 1.08 / 1;
          object-fit: cover;
        }

        .product-tag {
          position: absolute;
          top: 15px;
          left: 15px;
          padding: 6px 8px;
          background: #111;
          color: #fff;
          border-radius: 3px;
          font-size: 8px;
          font-weight: 900;
          letter-spacing: .11em;
        }

        .hero-thumbnails {
          margin-top: 9px;
          display: flex;
          gap: 7px;
          overflow-x: auto;
          scrollbar-width: none;
        }

        .hero-thumbnails::-webkit-scrollbar {
          display: none;
        }

        .hero-thumbnails button {
          width: 64px;
          height: 64px;
          flex: 0 0 64px;
          padding: 0;
          border: 1px solid #dcdcd5;
          background: #fff;
          border-radius: 5px;
          overflow: hidden;
          cursor: pointer;
        }

        .hero-thumbnails button.active {
          border: 2px solid #ff5a1f;
        }

        .hero-thumbnails img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .video-thumb {
          width: 100%;
          height: 100%;
          display: grid;
          place-items: center;
          background: #111;
          color: #fff;
          font-size: 15px;
        }

        .forge-landing-choice {
          padding: 88px 0;
          background: #fff;
        }

        .section-intro {
          max-width: 680px;
        }

        .section-intro.center {
          margin: 0 auto;
          text-align: center;
        }

        .section-intro h2 {
          margin: 10px 0 0;
          font-size: clamp(34px, 4vw, 54px);
          line-height: .98;
          letter-spacing: -.045em;
          font-weight: 900;
        }

        .section-intro p {
          margin: 14px 0 0;
          color: #70706a;
          font-size: 13px;
          line-height: 1.75;
        }

        .choice-grid {
          margin-top: 40px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          border-top: 1px solid #dcdcd5;
          border-bottom: 1px solid #dcdcd5;
        }

        .choice-block {
          padding: 27px 24px 24px;
          min-height: 315px;
        }

        .choice-block + .choice-block {
          border-left: 1px solid #dcdcd5;
        }

        .choice-number {
          color: #ff5a1f;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .11em;
        }

        .choice-block h3 {
          margin: 24px 0 7px;
          font-size: 24px;
          letter-spacing: -.025em;
        }

        .choice-block p {
          max-width: 450px;
          min-height: 55px;
          margin: 0;
          color: #71716a;
          font-size: 12px;
          line-height: 1.7;
        }

        .choice-price {
          margin-top: 22px;
          font-size: 26px;
          font-weight: 900;
          letter-spacing: -.04em;
        }

        .choice-block button {
          margin-top: 17px;
          min-height: 45px;
          padding: 0 15px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: 1px solid #111;
          border-radius: 4px;
          background: #111;
          color: #fff;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: .1em;
          cursor: pointer;
        }

        .choice-block button:disabled {
          opacity: .45;
          cursor: not-allowed;
        }

        .forge-landing-description {
          padding: 88px 0;
          background: #f4f4f0;
          border-top: 1px solid #e3e3dc;
          border-bottom: 1px solid #e3e3dc;
        }

        .description-grid {
          display: grid;
          grid-template-columns: minmax(270px, .8fr) minmax(0, 1.2fr);
          gap: 90px;
        }

        .description-title h2 {
          margin: 10px 0 0;
          max-width: 470px;
          font-size: clamp(34px, 4vw, 50px);
          line-height: 1;
          letter-spacing: -.045em;
        }

        .description-content {
          max-width: 690px;
        }

        .description-content p {
          margin: 0 0 17px;
          color: #555550;
          font-size: 13px;
          line-height: 1.85;
        }

        .description-content p:last-child {
          margin-bottom: 0;
        }

        .forge-landing-details {
          padding: 88px 0;
          background: #fff;
        }

        .detail-list {
          margin-top: 36px;
          border-top: 1px solid #dcdcd5;
        }

        .detail-row {
          min-height: 64px;
          padding: 14px 0;
          display: flex;
          align-items: center;
          gap: 14px;
          border-bottom: 1px solid #dcdcd5;
          color: #272724;
          font-size: 13px;
          line-height: 1.5;
        }

        .detail-check {
          width: 28px;
          height: 28px;
          display: grid;
          place-items: center;
          flex: 0 0 28px;
          border: 1px solid #dcdcd5;
          border-radius: 50%;
          color: #ff5a1f;
        }

        .forge-landing-objections {
          padding: 88px 0;
          background: #f4f4f0;
          border-top: 1px solid #e3e3dc;
          border-bottom: 1px solid #e3e3dc;
        }

        .objection-layout {
          margin-top: 38px;
          display: grid;
          grid-template-columns: 110px minmax(0, 1fr) 104px;
          gap: 34px;
          align-items: center;
          min-height: 280px;
          border-top: 1px solid #dcdcd5;
          border-bottom: 1px solid #dcdcd5;
        }

        .objection-counter {
          align-self: stretch;
          padding-top: 28px;
          display: flex;
          flex-direction: column;
          border-right: 1px solid #dcdcd5;
        }

        .objection-counter strong {
          font-size: 35px;
          line-height: 1;
          letter-spacing: -.04em;
        }

        .objection-counter span {
          margin-top: 4px;
          color: #8a8a83;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .1em;
        }

        .objection-content {
          max-width: 760px;
        }

        .objection-label {
          color: #ff5a1f;
          font-size: 8px;
          font-weight: 900;
          letter-spacing: .14em;
        }

        .objection-content h3 {
          margin: 9px 0 12px;
          font-size: clamp(25px, 3vw, 39px);
          line-height: 1.02;
          letter-spacing: -.04em;
        }

        .objection-content p {
          max-width: 700px;
          margin: 0;
          color: #62625c;
          font-size: 13px;
          line-height: 1.8;
        }

        .objection-proof {
          margin-top: 17px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: #2e2e2a;
          font-size: 10px;
          font-weight: 900;
        }

        .objection-proof svg {
          color: #ff5a1f;
        }

        .objection-controls {
          display: flex;
          justify-content: flex-end;
          gap: 7px;
        }

        .objection-controls button {
          width: 42px;
          height: 42px;
          display: grid;
          place-items: center;
          border: 1px solid #d3d3cb;
          border-radius: 50%;
          background: #fff;
          color: #111;
          cursor: pointer;
        }

        .objection-controls button:hover {
          background: #111;
          color: #fff;
        }

        .objection-dots {
          margin-top: 13px;
          display: flex;
          gap: 6px;
        }

        .objection-dots button {
          width: 6px;
          height: 6px;
          padding: 0;
          border: 0;
          border-radius: 50%;
          background: #cecec7;
          cursor: pointer;
        }

        .objection-dots button.active {
          width: 20px;
          border-radius: 999px;
          background: #ff5a1f;
        }

        .forge-landing-how {
          padding: 88px 0;
          background: #fff;
        }

        .how-grid {
          margin-top: 40px;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          border-top: 1px solid #dcdcd5;
          border-bottom: 1px solid #dcdcd5;
        }

        .how-grid article {
          min-height: 215px;
          padding: 26px 22px;
          border-right: 1px solid #dcdcd5;
        }

        .how-grid article:last-child {
          border-right: 0;
        }

        .how-grid article > span {
          color: #ff5a1f;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .12em;
        }

        .how-grid h3 {
          margin: 28px 0 8px;
          font-size: 20px;
          line-height: 1.05;
          letter-spacing: -.025em;
        }

        .how-grid p {
          margin: 0;
          color: #71716a;
          font-size: 12px;
          line-height: 1.7;
        }

        .forge-landing-final {
          padding: 64px 0 26px;
          background: #111;
          color: #fff;
        }

        .final-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 390px;
          gap: 50px;
          align-items: center;
        }

        .forge-landing-final h2 {
          max-width: 680px;
          margin: 9px 0 0;
          font-size: clamp(35px, 4vw, 52px);
          line-height: 1;
          letter-spacing: -.045em;
        }

        .forge-landing-final p {
          margin: 12px 0 0;
          color: rgba(255,255,255,.58);
          font-size: 13px;
        }

        .final-buttons {
          display: grid;
          gap: 8px;
        }

        .forge-landing-button {
          min-height: 55px;
          padding: 0 17px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 17px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .11em;
          cursor: pointer;
        }

        .forge-landing-button span {
          margin-left: auto;
          font-size: 13px;
          letter-spacing: -.02em;
        }

        .forge-landing-button.light {
          border: 1px solid #fff;
          background: #fff;
          color: #111;
        }

        .forge-landing-button.orange {
          border: 1px solid #ff5a1f;
          background: #ff5a1f;
          color: #fff;
        }

        .forge-landing-button:disabled {
          opacity: .45;
          cursor: not-allowed;
        }

        .forge-landing-footer-note {
          width: min(1160px, calc(100% - 48px));
          margin: 45px auto 0;
          padding-top: 15px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          border-top: 1px solid rgba(255,255,255,.12);
          color: rgba(255,255,255,.44);
          font-size: 9px;
          letter-spacing: .08em;
          text-align: center;
        }

        .forge-landing-footer-note svg {
          color: #ff5a1f;
        }

        .forge-landing-loading,
        .forge-landing-error {
          width: min(700px, calc(100% - 48px));
          min-height: 70vh;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
        }

        .forge-landing-spinner {
          width: 32px;
          height: 32px;
          border: 3px solid #dfdfd8;
          border-top-color: #ff5a1f;
          border-radius: 50%;
          animation: forgeLandingSpin .8s linear infinite;
        }

        .forge-landing-loading span {
          margin-top: 13px;
          color: #70706a;
          font-size: 11px;
        }

        .forge-landing-error h1 {
          margin: 10px 0;
          font-size: 45px;
          line-height: 1;
          letter-spacing: -.045em;
        }

        .forge-landing-error p {
          max-width: 510px;
          margin: 0 0 20px;
          color: #6b6b65;
          font-size: 13px;
          line-height: 1.7;
        }

        .forge-landing-button.dark {
          width: auto;
          border: 0;
          background: #111;
          color: #fff;
          justify-content: center;
          gap: 10px;
        }

        @keyframes forgeLandingSpin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 1000px) {
          .hero-grid {
            grid-template-columns: 1fr;
            gap: 42px;
          }

          .hero-copy h1 {
            max-width: 800px;
          }

          .description-grid {
            gap: 46px;
          }

          .final-grid {
            grid-template-columns: 1fr 330px;
          }
        }

        @media (max-width: 760px) {
          .forge-landing-wrap {
            width: min(100% - 24px, 680px);
          }

          .trustbar-inner {
            min-height: 30px;
            gap: 10px;
            justify-content: flex-start;
            overflow: hidden;
            white-space: nowrap;
            font-size: 7px;
          }

          .trustbar-inner i {
            display: none;
          }

          .trustbar-inner span:nth-child(5) {
            display: none;
          }

          .header-inner {
            min-height: 62px;
          }

          .logo-mark {
            width: 25px;
            height: 25px;
            font-size: 15px;
          }

          .logo-word {
            font-size: 16px;
          }

          .forge-landing-catalog-link {
            font-size: 8px;
          }

          .forge-landing-hero {
            padding: 40px 0 44px;
          }

          .hero-grid {
            gap: 32px;
          }

          .hero-copy h1 {
            font-size: clamp(40px, 12vw, 62px);
          }

          .hero-description {
            font-size: 14px;
            line-height: 1.7;
          }

          .hero-assurance {
            gap: 7px 12px;
          }

          .hero-assurance span {
            font-size: 9px;
          }

          .buy-option {
            min-height: 74px;
          }

          .buy-option strong {
            font-size: 22px;
          }

          .hero-image img,
          .hero-image video {
            aspect-ratio: 1 / 1;
          }

          .forge-landing-choice,
          .forge-landing-description,
          .forge-landing-details,
          .forge-landing-objections,
          .forge-landing-how {
            padding: 64px 0;
          }

          .section-intro h2,
          .description-title h2 {
            font-size: 36px;
          }

          .choice-grid {
            grid-template-columns: 1fr;
          }

          .choice-block {
            min-height: 0;
            padding: 25px 20px 23px;
          }

          .choice-block + .choice-block {
            border-left: 0;
            border-top: 1px solid #dcdcd5;
          }

          .description-grid {
            grid-template-columns: 1fr;
            gap: 30px;
          }

          .objection-layout {
            grid-template-columns: 55px minmax(0, 1fr);
            gap: 18px;
            min-height: 320px;
          }

          .objection-counter {
            padding-top: 23px;
          }

          .objection-controls {
            grid-column: 2;
            justify-content: flex-start;
            padding-bottom: 22px;
          }

          .how-grid {
            grid-template-columns: 1fr;
          }

          .how-grid article {
            min-height: 0;
            padding: 24px 20px;
            border-right: 0;
            border-bottom: 1px solid #dcdcd5;
          }

          .how-grid article:last-child {
            border-bottom: 0;
          }

          .final-grid {
            grid-template-columns: 1fr;
            gap: 30px;
          }

          .forge-landing-final {
            padding-top: 55px;
          }

          .forge-landing-footer-note {
            width: min(100% - 24px, 680px);
            margin-top: 35px;
            font-size: 8px;
          }
        }

        @media (max-width: 430px) {
          .forge-landing-catalog-link {
            font-size: 7px;
          }

          .hero-assurance span:nth-child(3) {
            display: none;
          }

          .buy-option {
            padding: 13px 14px;
          }

          .buy-option-action {
            font-size: 8px;
          }

          .hero-thumbnails button {
            width: 58px;
            height: 58px;
            flex-basis: 58px;
          }

          .objection-layout {
            grid-template-columns: 43px minmax(0, 1fr);
            gap: 14px;
          }

          .objection-content h3 {
            font-size: 27px;
          }

          .objection-controls button {
            width: 39px;
            height: 39px;
          }

          .forge-landing-button {
            font-size: 9px;
          }

          .forge-landing-button span {
            font-size: 11px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .forge-landing-spinner {
            animation: none;
          }

          .forge-landing *,
          .forge-landing *::before,
          .forge-landing *::after {
            transition: none !important;
          }
        }
      `}</style>
    </main>
  );
}
