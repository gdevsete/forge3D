import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Box,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CreditCard,
  Download,
  Gem,
  GraduationCap,
  LockKeyhole,
  PackageCheck,
  Play,
  Printer,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Truck,
  Trophy,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

import {
  useProducts,
  type Product,
  type ProductMedia,
  type LandingBenefit,
} from '../lib/catalog';
import {
  trackAddToCart,
  trackInitiateCheckout,
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

  return Math.round(((compare - current) / compare) * 100);
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

function cleanLandingText(value: string): string {
  return value
    .replace(/#{1,6}\s*/g, '')
    .replace(/[*_`~]/g, '')
    .replace(
      /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu,
      '',
    )
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.!?;:])/g, '$1')
    .trim();
}

function getShortLandingDescription(
  description: string,
): string {
  const cleaned = cleanLandingText(description);

  if (!cleaned) {
    return 'Conheça o produto, veja os detalhes e escolha como receber.';
  }

  if (cleaned.length <= 220) {
    return cleaned;
  }

  const shortened = cleaned.slice(0, 217);
  const lastSpace = shortened.lastIndexOf(' ');

  return `${(lastSpace > 150 ? shortened.slice(0, lastSpace) : shortened).trim()}...`;
}

const genericFaqs = [
  {
    question: 'Como recebo o arquivo STL?',
    answer:
      'Após a confirmação do pagamento, a entrega digital é preparada para o e-mail informado no checkout.',
  },
  {
    question: 'Posso imprimir quantas vezes quiser?',
    answer:
      'O arquivo fica disponível para uso próprio dentro das condições apresentadas na oferta e no checkout.',
  },
  {
    question: 'Não tenho impressora 3D, posso comprar?',
    answer:
      'Sim. Quando a modalidade impressa estiver disponível, você pode receber o modelo produzido pela Forge3D.',
  },
  {
    question: 'O pagamento é seguro?',
    answer:
      'O checkout registra seu pedido e direciona o pagamento para o PIX. Após a confirmação, o pedido avança para a próxima etapa.',
  },
  {
    question: 'As peças já vêm montadas?',
    answer:
      'Isso depende do produto e da modalidade escolhida. As informações específicas aparecem nesta oferta antes da compra.',
  },
  {
    question: 'Vocês têm suporte se eu tiver dúvidas?',
    answer:
      'Sim. A Forge3D mantém os detalhes da oferta e do pedido registrados para facilitar o suporte ao cliente.',
  },
];

const turboFaqs = [
  {
    question: 'Como recebo o arquivo STL?',
    answer:
      'Depois da confirmação do pagamento, a entrega digital é preparada para o e-mail informado no checkout.',
  },
  {
    question: 'Posso imprimir quantas vezes quiser?',
    answer:
      'O arquivo é entregue para uso próprio conforme as condições da oferta. Você pode imprimir suas próprias peças quantas vezes fizer sentido para seu projeto.',
  },
  {
    question: 'Não tenho impressora 3D, posso comprar?',
    answer:
      'Sim. Nesta oferta você pode escolher entre o arquivo STL e o modelo impresso, quando essa modalidade estiver disponível.',
  },
  {
    question: 'O pagamento é seguro?',
    answer:
      'Seu pedido é registrado no checkout e o pagamento é realizado via PIX. A confirmação do pagamento libera a próxima etapa do pedido.',
  },
  {
    question: 'As peças já vêm montadas?',
    answer:
      'O kit foi pensado para montagem e estudo. Consulte a modalidade impressa e as informações exibidas na oferta para saber como o pedido será entregue.',
  },
  {
    question: 'Vocês têm suporte se eu tiver dúvidas?',
    answer:
      'Sim. As informações da oferta ficam registradas para facilitar o suporte e o acompanhamento do pedido.',
  },
];

function splitTitle(title: string) {
  const words = title.trim().split(/\s+/);

  if (words.length <= 1) {
    return { first: title, second: '' };
  }

  if (words.length === 2) {
    return { first: words[0], second: words[1] };
  }

  const secondWordCount = Math.min(2, words.length - 1);
  return {
    first: words.slice(0, words.length - secondWordCount).join(' '),
    second: words.slice(-secondWordCount).join(' '),
  };
}

export function LandingPage({
  onAdd,
}: LandingPageProps) {
  const { slug } = useParams();
  const navigate = useNavigate();

  const { products, loading, error } = useProducts();

  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(null);
  const [activePurchaseType, setActivePurchaseType] =
    useState<PurchaseType>('stl');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false);

  const thumbsRef = useRef<HTMLDivElement | null>(null);
  const pricingRef = useRef<HTMLDivElement | null>(null);

  const product = useMemo(
    () => products.find((item) => item.slug === slug),
    [products, slug],
  );

  const media = useMemo(
    () => (product ? normalizeMedia(product) : []),
    [product],
  );

  const selectedMedia = useMemo(() => {
    if (!media.length) {
      return null;
    }

    return (
      media.find((item) => item.id === selectedMediaId) || media[0]
    );
  }, [media, selectedMediaId]);

  const imageMedia = useMemo(
    () => media.filter((item) => item.mediaType === 'image'),
    [media],
  );

  const stlPrice = product?.stlPrice ?? 0;
  const printedPrice = product?.printedPrice ?? 0;
  const stlCompare = product?.compareStlPrice ?? null;
  const printedCompare = product?.comparePrintedPrice ?? null;
  const stlDiscount = getDiscountPercent(stlPrice, stlCompare);
  const printedDiscount = getDiscountPercent(printedPrice, printedCompare);

  const isTurbo = product?.landingTemplate === 'turbo';

  const title = useMemo(
    () =>
      splitTitle(
        product?.landingTitle ||
          (isTurbo ? 'Kit Turbo Funcional' : product?.name || ''),
      ),
    [isTurbo, product?.landingTitle, product?.name],
  );

  const landingFaq = product?.landingFaq ?? [];

  const faqs =
    landingFaq.length > 0
      ? landingFaq
      : isTurbo
        ? turboFaqs
        : genericFaqs;

  const heroSubtitle =
    product?.landingSubtitle ||
    (isTurbo
      ? 'Monte, entenda e veja na prática como um turbocompressor funciona.'
      : 'Conheça o produto, veja os detalhes e escolha como receber.');

  const heroDescription =
    product?.landingDescription
      ? cleanLandingText(product.landingDescription)
      : isTurbo
        ? 'Um modelo 3D altamente detalhado, projetado para ser impresso e montado por você. Perfeito para entusiastas, estudantes e apaixonados por engenharia.'
        : getShortLandingDescription(product?.description || '');

  const landingBenefits = product?.landingBenefits ?? [];

  const benefits: LandingBenefit[] =
    landingBenefits.length > 0
      ? landingBenefits
      : isTurbo
        ? [
            {
              title: 'Modelo realista e funcional',
              text: 'Baseado em turbocompressores reais, com detalhes internos precisos.',
            },
            {
              title: 'Peças encaixáveis',
              text: 'Peças pensadas para facilitar a montagem e o entendimento do conjunto.',
            },
            {
              title: 'Ideal para estudo',
              text: 'Uma forma visual de explorar mecânica, impressão 3D e engenharia.',
            },
            {
              title: 'Peça de destaque',
              text: 'Excelente para exposição, decoração de oficina e coleção.',
            },
          ]
        : [
            {
              title: 'Produto bem apresentado',
              text: 'Imagens e informações organizadas para você entender o que está comprando.',
            },
            {
              title: 'Escolha a modalidade',
              text: 'Selecione a forma de receber que faz sentido para o seu projeto.',
            },
            {
              title: 'Compra simples',
              text: 'Você confere o pedido e segue para o checkout sem complicação.',
            },
            {
              title: 'Pagamento via PIX',
              text: 'Pagamento direto pelo checkout, com registro do pedido.',
            },
          ];

  const heroBullets = benefits
    .slice(0, 4)
    .map((benefit, index) => {
      const icons = [
        <Settings size={20} />,
        <Wrench size={20} />,
        <Box size={20} />,
        <BookOpen size={20} />,
      ];

      return {
        icon: icons[index] || <CircleCheck size={20} />,
        text: benefit.title,
      };
    });

  const landingStlPoints = product?.landingStlPoints ?? [];

  const stlPoints =
    landingStlPoints.length > 0
      ? landingStlPoints
      : [
          'Arquivo digital completo',
          'Entrega preparada para o e-mail do pedido',
          'Informações claras antes da compra',
          'Compra via PIX',
        ];

  const landingPrintedPoints = product?.landingPrintedPoints ?? [];

  const printedPoints =
    landingPrintedPoints.length > 0
      ? landingPrintedPoints
      : [
          'Modelo produzido pela Forge3D',
          'Acabamento de qualidade',
          'Embalagem segura',
          'Envio para todo o Brasil',
        ];

  const detailTitle =
    product?.landingDetailTitle ||
    (isTurbo
      ? 'Cada componente foi pensado para entregar presença.'
      : 'Veja os detalhes do produto.');

  const detailDescription =
    product?.landingDetailDescription ||
    (isTurbo
      ? 'Visualize os detalhes do modelo e escolha a modalidade que combina com o seu projeto.'
      : 'Veja imagens do produto e confira todos os detalhes antes de comprar.');

  const finalTitle =
    product?.landingFinalTitle ||
    (isTurbo
      ? 'Kit Turbo Funcional'
      : product?.name || 'Produto');

  const finalDescription =
    product?.landingFinalDescription ||
    (isTurbo
      ? 'Um projeto incrível para imprimir, montar e aprender.'
      : 'Escolha a modalidade, finalize pelo PIX e receba seu pedido.');

  useEffect(() => {
    if (!lightboxOpen) {
      document.body.style.overflow = '';
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setLightboxOpen(false);
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [lightboxOpen]);

  useEffect(() => {
    if (!product) {
      return;
    }

    trackViewContent({
      content_ids: [product.id],
      content_name: product.name,
      content_type: 'landing_page',
      value: stlPrice || printedPrice,
      currency: 'BRL',
    });
  }, [product?.id]);

  useEffect(() => {
    setSelectedMediaId(null);
    setOpenFaq(null);
    setActivePurchaseType(
      product?.stlEnabled
        ? 'stl'
        : 'physical',
    );
    setLightboxOpen(false);
  }, [product?.id]);

  async function goToCheckout(
    purchaseType: PurchaseType,
  ) {
    if (
      !product ||
      checkoutSubmitting
    ) {
      return;
    }

    const enabled =
      purchaseType === 'stl'
        ? product.stlEnabled && stlPrice > 0
        : product.printedEnabled &&
          printedPrice > 0;

    if (!enabled) {
      return;
    }

    setCheckoutSubmitting(true);

    const price =
      purchaseType === 'stl'
        ? stlPrice
        : printedPrice;

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

    trackInitiateCheckout({
      content_ids: [product.id],
      value: price,
      currency: 'BRL',
      num_items: 1,
    });

    navigate('/checkout');
  }

  function openSelectedMedia() {
    if (!selectedMedia) {
      return;
    }

    setLightboxOpen(true);
  }

  function selectMediaAndOpen(id: string) {
    setSelectedMediaId(id);
    setLightboxOpen(true);
  }

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }

  function scrollThumbs(direction: 'left' | 'right') {
    thumbsRef.current?.scrollBy({
      left: direction === 'left' ? -360 : 360,
      behavior: 'smooth',
    });
  }

  function scrollToPricing() {
    pricingRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }

  if (loading) {
    return (
      <main className="forge-offer forge-offer-loading-screen">
        <div className="forge-offer-loading">
          <div className="forge-offer-spinner" />
          <span>Carregando oferta...</span>
        </div>
      </main>
    );
  }

  if (error || !product) {
    return (
      <main className="forge-offer forge-offer-error-screen">
        <div className="forge-offer-error">
          <span className="forge-offer-eyebrow">OFERTA</span>
          <h1>Produto não encontrado.</h1>
          <p>{error || 'Este produto não está disponível nesta oferta.'}</p>
          <button
            type="button"
            className="forge-offer-button forge-offer-button-orange"
            onClick={() => navigate('/')}
          >
            VOLTAR
            <ArrowRight size={18} />
          </button>
        </div>
      </main>
    );
  }

  const badgeText =
    product.landingBadge ||
    product.badge ||
    (isTurbo ? 'LANÇAMENTO' : 'OFERTA ESPECIAL');
  const stlActive = activePurchaseType === 'stl';

  return (
    <>
      <main className="forge-offer">
        <header className="forge-offer-header">
          <div className="forge-offer-header-inner">
            <div className="forge-offer-brand-lockup" aria-label="Forge3D">
              <div className="forge-offer-brand-wordmark">
                FORGE<span>3D</span>
              </div>
              <div className="forge-offer-brand-tagline">IDEIAS GANHAM FORMA</div>
            </div>

            <nav className="forge-offer-nav" aria-label="Navegação da oferta">
              <button type="button" onClick={() => scrollTo('forge-offer-product')}>
                Produtos
              </button>
              <button type="button" onClick={() => scrollTo('forge-offer-how')}>
                Como funciona
              </button>
              <button type="button" onClick={() => scrollTo('forge-offer-faq')}>
                Dúvidas
              </button>
              <button type="button" onClick={() => scrollTo('forge-offer-about')}>
                Sobre a Forge3D
              </button>
            </nav>

            <div className="forge-offer-header-actions">
              <span>
                <ShieldCheck size={16} />
                Compra segura
              </span>
              <span>
                <Truck size={16} />
                Envio para todo o Brasil
              </span>
              <button
                type="button"
                className="forge-offer-header-buy"
                onClick={scrollToPricing}
              >
                <ShoppingCart size={17} />
                Comprar agora
              </button>
            </div>
          </div>
        </header>

        <section id="forge-offer-product" className="forge-offer-hero">
          <div className="forge-offer-hero-backdrop" aria-hidden="true">
            <img src={product.image} alt="" />
          </div>
          <div className="forge-offer-hero-overlay" aria-hidden="true" />

          <div className="forge-offer-hero-inner">
            <div className="forge-offer-hero-copy">
              <span className="forge-offer-launch-badge">{badgeText}</span>

              <h1>
                {title.first}
                {title.second && (
                  <span>{title.second}</span>
                )}
              </h1>

              <p className="forge-offer-hero-lead">{heroSubtitle}</p>

              <p className="forge-offer-hero-description">
                {heroDescription}
              </p>

              <div className="forge-offer-hero-bullets">
                {heroBullets.map((bullet, index) => (
                  <div key={`${bullet.text}-${index}`}>
                    <span>{bullet.icon}</span>
                    <strong>{bullet.text}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="forge-offer-hero-visual">
              <div
                className="forge-offer-product-stage"
                role="button"
                tabIndex={0}
                onClick={(event) => {
                  if ((event.target as HTMLElement).closest('video')) {
                    return;
                  }
                  openSelectedMedia();
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openSelectedMedia();
                  }
                }}
                aria-label="Ampliar imagem do produto"
              >
                <div className="forge-offer-product-stage-glow" aria-hidden="true" />
                {selectedMedia?.mediaType === 'video' ? (
                  <video
                    src={selectedMedia.mediaUrl}
                    poster={selectedMedia.thumbnailUrl || product.image}
                    controls
                    playsInline
                    preload="metadata"
                  />
                ) : (
                  <img
                    src={selectedMedia?.mediaUrl || product.image}
                    alt={selectedMedia?.altText || product.name}
                  />
                )}
                <div className="forge-offer-stage-expand" aria-hidden="true">
                  <span>AMPLIAR</span>
                </div>
                <div className="forge-offer-stage-caption">
                  <span>FORGE3D</span>
                  <span>{isTurbo ? 'KIT TURBO' : product.category}</span>
                </div>
              </div>
            </div>

            <aside ref={pricingRef} className="forge-offer-price-card">
              <div className="forge-offer-price-tabs">
                <button
                  type="button"
                  className={stlActive ? 'active' : ''}
                  onClick={() => {
                    if (product.stlEnabled && stlPrice > 0) {
                      setActivePurchaseType('stl');
                    }
                  }}
                  disabled={
                    checkoutSubmitting ||
                    !product.stlEnabled ||
                    stlPrice <= 0
                  }
                >
                  ARQUIVO STL
                </button>
                <button
                  type="button"
                  className={!stlActive ? 'active' : ''}
                  onClick={() => {
                    if (
                      product.printedEnabled &&
                      printedPrice > 0
                    ) {
                      setActivePurchaseType('physical');
                    }
                  }}
                  disabled={
                    checkoutSubmitting ||
                    !product.printedEnabled ||
                    printedPrice <= 0
                  }
                >
                  MODELO IMPRESSO
                </button>
              </div>

              <div className="forge-offer-price-card-section">
                <div className="forge-offer-card-price">
                  {formatPrice(stlPrice)}
                </div>
                {stlCompare && (
                  <div className="forge-offer-card-compare">
                    De <del>{formatPrice(stlCompare)}</del>
                  </div>
                )}
                <ul>
                  {stlPoints.slice(0, 5).map((point) => (
                    <li key={point}>
                      <Check size={15} /> {point}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="forge-offer-card-button orange"
                  onClick={() => goToCheckout('stl')}
                  disabled={
                    checkoutSubmitting ||
                    !product.stlEnabled ||
                    stlPrice <= 0
                  }
                >
                  <ShoppingCart size={17} />
                  Comprar arquivo STL
                </button>
              </div>

              <div className="forge-offer-price-divider">
                <span>OU RECEBA EM CASA</span>
              </div>

              <div className="forge-offer-price-card-section printed">
                <div className="forge-offer-card-price">
                  {formatPrice(printedPrice)}
                </div>
                {printedCompare && (
                  <div className="forge-offer-card-compare">
                    De <del>{formatPrice(printedCompare)}</del>
                  </div>
                )}
                <ul>
                  {printedPoints.slice(0, 5).map((point) => (
                    <li key={point}>
                      <Check size={15} /> {point}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="forge-offer-card-button light"
                  onClick={() => goToCheckout('physical')}
                  disabled={
                    checkoutSubmitting ||
                    !product.printedEnabled ||
                    printedPrice <= 0
                  }
                >
                  <ShoppingCart size={17} />
                  Comprar modelo impresso
                </button>
              </div>

              <div className="forge-offer-card-trust">
                <span><ShieldCheck size={14} /> Compra segura</span>
                <span><LockKeyhole size={14} /> PIX</span>
                <span><PackageCheck size={14} /> Pedido registrado</span>
              </div>
            </aside>
          </div>

          <div className="forge-offer-gallery-rail-wrap">
            <button
              type="button"
              className="forge-offer-gallery-arrow"
              onClick={() => scrollThumbs('left')}
              aria-label="Mídia anterior"
            >
              <ChevronLeft size={20} />
            </button>

            <div ref={thumbsRef} className="forge-offer-gallery-rail">
              {media.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={item.id === selectedMedia?.id ? 'active' : ''}
                  onClick={() => setSelectedMediaId(item.id)}
                  aria-label={`Ver mídia ${item.sortOrder + 1}`}
                >
                  {item.mediaType === 'video' ? (
                    <span className="forge-offer-gallery-video-thumb">
                      <Play size={22} fill="currentColor" />
                    </span>
                  ) : (
                    <img
                      src={item.thumbnailUrl || item.mediaUrl}
                      alt=""
                    />
                  )}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="forge-offer-gallery-arrow"
              onClick={() => scrollThumbs('right')}
              aria-label="Próxima mídia"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </section>

        <section id="forge-offer-benefits" className="forge-offer-benefits">
          <div className="forge-offer-container forge-offer-benefits-grid">
            <div className="forge-offer-benefits-intro">
              <span className="forge-offer-orange-label">POR QUE ESSE MODELO É ESPECIAL?</span>
              <h2>
                {product.landingWhyTitle ||
                  (isTurbo
                    ? 'Mais do que uma peça: uma experiência de montagem, estudo e exposição.'
                    : 'Veja o produto com clareza antes de comprar.')}
              </h2>
              <p>
                {product.landingWhyDescription ||
                  (isTurbo
                    ? 'O Kit Turbo Funcional foi desenvolvido para oferecer uma experiência rica de montagem, com alto nível de detalhes e fidelidade ao modelo real. Você não está apenas imprimindo uma peça, mas vivenciando na prática o funcionamento de um turbocompressor.'
                    : getShortLandingDescription(product.description))}
              </p>
            </div>

            <div className="forge-offer-benefit-cards">
              {benefits.slice(0, 4).map((benefit, index) => {
                const icons = [
                  <Settings size={34} strokeWidth={1.8} />,
                  <Wrench size={34} strokeWidth={1.8} />,
                  <GraduationCap size={34} strokeWidth={1.8} />,
                  <Gem size={34} strokeWidth={1.8} />,
                ];

                return (
                  <article key={`${benefit.title}-${index}`}>
                    {icons[index] || <CircleCheck size={34} strokeWidth={1.8} />}
                    <strong>{benefit.title}</strong>
                    <p>
                      {benefit.text ||
                        'Informação apresentada diretamente na oferta para facilitar a decisão de compra.'}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="forge-offer-details-showcase">
          <div className="forge-offer-container forge-offer-details-layout">
            <div className="forge-offer-details-intro">
              <span className="forge-offer-orange-label">VEJA OS DETALHES DE PERTO</span>
              <h2>{detailTitle}</h2>
              <p>{detailDescription}</p>
              <span className="forge-offer-orange-line" />
            </div>

            <div className="forge-offer-details-gallery">
              {imageMedia.slice(0, 4).map((item) => (
                <button
                  type="button"
                  key={`detail-${item.id}`}
                  onClick={() => setSelectedMediaId(item.id)}
                  aria-label={`Ampliar ${item.altText || 'imagem do produto'}`}
                >
                  <img
                    src={item.mediaUrl}
                    alt={item.altText || product.name}
                  />
                </button>
              ))}
            </div>
          </div>
        </section>

        <section id="forge-offer-choice" className="forge-offer-choice">
          <div className="forge-offer-container forge-offer-choice-layout">
            <div className="forge-offer-choice-intro">
              <span className="forge-offer-orange-label">ESCOLHA COMO RECEBER</span>
              <h2>
                {product.stlEnabled && product.printedEnabled
                  ? 'Escolha como receber.'
                  : product.stlEnabled
                    ? 'Receba o arquivo digital.'
                    : 'Receba o modelo impresso.'}
              </h2>
              <p>
                {isTurbo
                  ? 'Você pode comprar apenas o arquivo STL e imprimir na sua própria impressora 3D, ou receber o modelo produzido pela Forge3D.'
                  : 'Escolha a modalidade disponível para este produto e finalize sua compra de forma simples e segura.'}
              </p>
            </div>

            <div className="forge-offer-choice-options">
              {product.stlEnabled && stlPrice > 0 && (
              <article className={activePurchaseType === 'stl' ? 'selected' : ''}>
                <div className="forge-offer-choice-icon orange">
                  <Box size={31} />
                </div>
                <span>ARQUIVO STL</span>
                <strong>{formatPrice(stlPrice)}</strong>
                <ul>
                  {stlPoints.slice(0, 4).map((point) => (
                    <li key={point}>
                      <Check size={15} /> {point}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => {
                    setActivePurchaseType('stl');
                    goToCheckout('stl');
                  }}
                  disabled={
                    checkoutSubmitting ||
                    !product.stlEnabled ||
                    stlPrice <= 0
                  }
                >
                  <ShoppingCart size={17} /> Quero o arquivo STL
                </button>
              </article>
              )}

              {product.printedEnabled && printedPrice > 0 && (
              <article className={activePurchaseType === 'physical' ? 'selected' : ''}>
                <div className="forge-offer-choice-icon dark">
                  <Printer size={31} />
                </div>
                <span>MODELO IMPRESSO</span>
                <strong>{formatPrice(printedPrice)}</strong>
                <ul>
                  {printedPoints.slice(0, 4).map((point) => (
                    <li key={point}>
                      <Check size={15} /> {point}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => {
                    setActivePurchaseType('physical');
                    goToCheckout('physical');
                  }}
                  disabled={
                  !product.printedEnabled ||
                  printedPrice <= 0
                }
                >
                  <ShoppingCart size={17} /> Quero o modelo impresso
                </button>
              </article>
              )}
            </div>
          </div>
        </section>

        <section id="forge-offer-how" className="forge-offer-how">
          <div className="forge-offer-container">
            <div className="forge-offer-dark-section-heading">
              <span className="forge-offer-orange-label">COMO FUNCIONA?</span>
              <h2>Três passos para comprar sem complicação.</h2>
            </div>

            <div className="forge-offer-steps">
              <article>
                <span>1</span>
                <ShoppingCart size={39} strokeWidth={1.7} />
                <div>
                  <strong>Escolha o produto</strong>
                  <p>Selecione entre o arquivo STL ou o modelo impresso.</p>
                </div>
              </article>
              <ArrowRight className="forge-offer-step-arrow" size={28} />
              <article>
                <span>2</span>
                <CreditCard size={39} strokeWidth={1.7} />
                <div>
                  <strong>Finalize a compra</strong>
                  <p>Pagamento via PIX de forma segura e rápida.</p>
                </div>
              </article>
              <ArrowRight className="forge-offer-step-arrow" size={28} />
              <article>
                <span>3</span>
                <PackageCheck size={39} strokeWidth={1.7} />
                <div>
                  <strong>Receba seu produto</strong>
                  <p>Entrega digital preparada para o e-mail ou envio da peça física.</p>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section id="forge-offer-about" className="forge-offer-about">
          <div className="forge-offer-container forge-offer-about-grid">
            <div className="forge-offer-about-copy">
              <div className="forge-offer-about-logo">
                FORGE<span>3D</span>
              </div>
              <div className="forge-offer-brand-tagline">IDEIAS GANHAM FORMA</div>
              <p>
                Na Forge3D, acreditamos no poder da criação. Transformamos ideias em modelos 3D de alta qualidade, para quem ama tecnologia, impressão 3D e projetos reais.
              </p>
            </div>

            <div className="forge-offer-about-points">
              <article>
                <Trophy size={31} strokeWidth={1.8} />
                <strong>Modelos exclusivos</strong>
                <p>Projetos únicos desenvolvidos com cuidado.</p>
              </article>
              <article>
                <Users size={31} strokeWidth={1.8} />
                <strong>Comunidade 3D</strong>
                <p>Feitos para entusiastas e apaixonados.</p>
              </article>
              <article>
                <ShieldCheck size={31} strokeWidth={1.8} />
                <strong>Qualidade e confiança</strong>
                <p>Suporte e atualização contínua dos modelos.</p>
              </article>
            </div>

            <div className="forge-offer-about-image">
              <img src={imageMedia[0]?.mediaUrl || product.image} alt={product.name} />
            </div>
          </div>
        </section>

        <section id="forge-offer-faq" className="forge-offer-faq">
          <div className="forge-offer-container forge-offer-faq-grid">
            <div className="forge-offer-faq-intro">
              <span className="forge-offer-orange-label">DÚVIDAS FREQUENTES</span>
              <h2>Tire suas dúvidas antes de comprar.</h2>
              <p>Respostas objetivas para você saber exatamente o que está levando.</p>
            </div>

            <div className="forge-offer-faq-list">
              {faqs.map((faq, index) => {
                const isOpen = openFaq === index;
                return (
                  <article key={faq.question} className={isOpen ? 'open' : ''}>
                    <button
                      type="button"
                      onClick={() => setOpenFaq(isOpen ? null : index)}
                      aria-expanded={isOpen}
                    >
                      <span>{faq.question}</span>
                      {isOpen ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                    </button>
                    {isOpen && <p>{faq.answer}</p>}
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="forge-offer-final-cta">
          <div className="forge-offer-final-background" aria-hidden="true">
            <img src={imageMedia[imageMedia.length > 1 ? imageMedia.length - 1 : 0]?.mediaUrl || product.image} alt="" />
          </div>
          <div className="forge-offer-final-overlay" aria-hidden="true" />
          <div className="forge-offer-container forge-offer-final-inner">
            <div>
              <span className="forge-offer-orange-label">PRONTO PARA COMPRAR?</span>
              <h2>
                Leve agora o seu
                <span>{finalTitle}</span>
              </h2>
              <p>{finalDescription}</p>
            </div>

            <div className="forge-offer-final-actions">
              <button
                type="button"
                className="orange"
                onClick={() => goToCheckout('stl')}
                disabled={!product.stlEnabled || stlPrice <= 0}
              >
                <ShoppingCart size={18} />
                Comprar STL
              </button>
              <button
                type="button"
                className="light"
                onClick={() => goToCheckout('physical')}
                disabled={!product.printedEnabled || printedPrice <= 0}
              >
                <ShoppingCart size={18} />
                Comprar impresso
              </button>
            </div>
          </div>

          <div className="forge-offer-final-trust">
            <span><ShieldCheck size={15} /> Compra 100% segura</span>
            <span><CreditCard size={15} /> Pagamento via PIX</span>
            <span><Truck size={15} /> Envio para todo o Brasil</span>
          </div>
        </section>
      </main>

      {lightboxOpen && selectedMedia && (
        <div
          className="forge-offer-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Visualização ampliada do produto"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setLightboxOpen(false);
            }
          }}
        >
          <div className="forge-offer-lightbox-toolbar">
            <span>VISUALIZAÇÃO DO PRODUTO</span>
            <button
              type="button"
              onClick={() => setLightboxOpen(false)}
              aria-label="Fechar visualização"
            >
              <X size={24} />
            </button>
          </div>

          <div className="forge-offer-lightbox-stage">
            {selectedMedia.mediaType === 'video' ? (
              <video
                src={selectedMedia.mediaUrl}
                poster={selectedMedia.thumbnailUrl || product.image}
                controls
                autoPlay
                playsInline
              />
            ) : (
              <img
                src={selectedMedia.mediaUrl}
                alt={selectedMedia.altText || product.name}
              />
            )}
          </div>

          <div className="forge-offer-lightbox-hint">
            Toque fora da imagem ou no X para fechar
          </div>
        </div>
      )}

      <style>{`
        :root {
          --forge-orange: #ff5a00;
          --forge-orange-2: #ff7518;
          --forge-black: #08090a;
          --forge-black-2: #111315;
          --forge-gray: #70747a;
          --forge-line: #dfe2e5;
          --forge-soft: #f3f4f2;
        }

        html,
        body,
        #root {
          margin: 0 !important;
          padding: 0 !important;
          width: 100%;
          min-width: 0;
        }

        html {
          background: #090a0b;
        }

        body {
          min-height: 100vh;
          background: #090a0b;
        }

        #root {
          min-height: 100vh;
        }

        .forge-offer {
          min-height: 100vh;
          width: 100%;
          max-width: none;
          margin: 0;
          padding: 0;
          background: #fff;
          color: #111;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          overflow-x: hidden;
        }

        .forge-offer,
        .forge-offer * {
          box-sizing: border-box;
        }

        .forge-offer button {
          font: inherit;
        }

        .forge-offer button:focus-visible {
          outline: 2px solid var(--forge-orange);
          outline-offset: 3px;
        }

        .forge-offer-container,
        .forge-offer-header-inner,
        .forge-offer-hero-inner {
          width: min(1400px, calc(100% - 76px));
          margin: 0 auto;
        }

        .forge-offer-header {
          position: relative;
          z-index: 20;
          background: #090a0b;
          color: #fff;
          border-bottom: 1px solid rgba(255,255,255,.11);
        }

        .forge-offer-header-inner {
          min-height: 64px;
          display: grid;
          grid-template-columns: 206px minmax(0, 1fr) auto;
          align-items: center;
          gap: 20px;
        }

        .forge-offer-brand-lockup {
          line-height: 1;
          min-width: 0;
        }

        .forge-offer-brand-wordmark,
        .forge-offer-about-logo {
          font-size: 28px;
          font-weight: 950;
          letter-spacing: -.075em;
        }

        .forge-offer-brand-wordmark span,
        .forge-offer-about-logo span {
          color: var(--forge-orange);
        }

        .forge-offer-brand-tagline {
          margin-top: 5px;
          font-size: 7px;
          font-weight: 900;
          letter-spacing: .32em;
          color: rgba(255,255,255,.7);
        }

        .forge-offer-about .forge-offer-brand-tagline {
          color: #777b80;
        }

        .forge-offer-nav {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 28px;
        }

        .forge-offer-nav button,
        .forge-offer-header-actions > span {
          border: 0;
          background: transparent;
          color: rgba(255,255,255,.87);
          font-size: 11px;
          font-weight: 700;
        }

        .forge-offer-nav button {
          padding: 8px 0;
          cursor: pointer;
        }

        .forge-offer-nav button:hover {
          color: #fff;
        }

        .forge-offer-header-actions {
          display: flex;
          align-items: center;
          gap: 17px;
        }

        .forge-offer-header-actions > span {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          white-space: nowrap;
          font-size: 10px;
        }

        .forge-offer-header-actions svg {
          color: #fff;
        }

        .forge-offer-header-buy {
          min-height: 40px;
          padding: 0 20px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: 0;
          border-radius: 7px;
          background: var(--forge-orange);
          color: #fff;
          font-size: 10px;
          font-weight: 900;
          cursor: pointer;
          text-transform: none;
        }

        .forge-offer-header-buy:hover {
          background: var(--forge-orange-2);
        }

        .forge-offer-hero {
          position: relative;
          min-height: 650px;
          padding: 48px 0 30px;
          background: #090b0d;
          color: #fff;
          overflow: hidden;
        }

        .forge-offer-hero-backdrop,
        .forge-offer-hero-overlay {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }

        .forge-offer-hero-backdrop img {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: cover;
          object-position: center;
          opacity: .16;
          filter: blur(11px) saturate(1.1) brightness(.65);
          transform: scale(1.09);
        }

        .forge-offer-hero-overlay {
          background:
            radial-gradient(circle at 43% 46%, rgba(255,90,0,.07), transparent 24%),
            linear-gradient(90deg, rgba(5,6,7,.94) 0%, rgba(5,6,7,.74) 36%, rgba(5,6,7,.33) 63%, rgba(5,6,7,.92) 100%),
            linear-gradient(180deg, rgba(5,6,7,.1), rgba(5,6,7,.9));
        }

        .forge-offer-hero-inner {
          position: relative;
          z-index: 2;
          display: grid;
          grid-template-columns: minmax(250px, .86fr) minmax(320px, 1fr) minmax(305px, .78fr);
          align-items: center;
          gap: 30px;
        }

        .forge-offer-hero-copy {
          align-self: center;
          padding: 8px 0 14px;
        }

        .forge-offer-launch-badge {
          display: inline-flex;
          align-items: center;
          min-height: 26px;
          padding: 0 12px;
          border-radius: 7px;
          background: var(--forge-orange);
          color: #fff;
          font-size: 8px;
          font-weight: 950;
          letter-spacing: .08em;
          text-transform: uppercase;
        }

        .forge-offer-hero-copy h1 {
          margin: 14px 0 10px;
          max-width: 520px;
          font-size: clamp(52px, 4.9vw, 80px);
          line-height: .88;
          letter-spacing: -.062em;
          font-weight: 950;
        }

        .forge-offer-hero-copy h1 span {
          display: block;
          color: var(--forge-orange);
        }

        .forge-offer-hero-lead {
          max-width: 470px;
          margin: 0;
          font-size: 17px;
          line-height: 1.18;
          font-weight: 700;
          color: rgba(255,255,255,.95);
        }

        .forge-offer-hero-description {
          max-width: 450px;
          margin: 18px 0 0;
          color: rgba(255,255,255,.74);
          font-size: 12px;
          line-height: 1.55;
        }

        .forge-offer-hero-bullets {
          margin-top: 22px;
          display: grid;
          gap: 14px;
        }

        .forge-offer-hero-bullets > div {
          display: flex;
          align-items: center;
          gap: 14px;
          color: #fff;
        }

        .forge-offer-hero-bullets span {
          width: 24px;
          height: 24px;
          display: grid;
          place-items: center;
          color: var(--forge-orange);
          flex: 0 0 auto;
        }

        .forge-offer-hero-bullets strong {
          font-size: 12px;
          line-height: 1.2;
          font-weight: 700;
        }

        .forge-offer-hero-visual {
          min-width: 0;
          align-self: stretch;
          display: grid;
          place-items: center;
        }

        .forge-offer-product-stage {
          position: relative;
          width: 100%;
          min-height: 530px;
          display: grid;
          place-items: center;
          isolation: isolate;
        }

        .forge-offer-product-stage::before {
          content: "";
          position: absolute;
          width: 72%;
          aspect-ratio: 1 / 1;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(255,91,0,.24), rgba(255,91,0,.06) 37%, transparent 71%);
          filter: blur(18px);
          z-index: -1;
        }

        .forge-offer-product-stage-glow {
          position: absolute;
          inset: 14% 8%;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(255,255,255,.10), transparent 58%);
          filter: blur(28px);
          z-index: -1;
        }

        .forge-offer-product-stage img,
        .forge-offer-product-stage video {
          width: 100%;
          height: 530px;
          display: block;
          object-fit: contain;
          object-position: center;
          filter: saturate(1.18) contrast(1.07) drop-shadow(0 25px 30px rgba(0,0,0,.35));
        }

        .forge-offer-stage-caption {
          position: absolute;
          left: 50%;
          bottom: 34px;
          transform: translateX(-50%);
          display: flex;
          gap: 8px;
          align-items: center;
          padding: 7px 11px;
          background: rgba(0,0,0,.56);
          border: 1px solid rgba(255,255,255,.14);
          border-radius: 7px;
          backdrop-filter: blur(8px);
          white-space: nowrap;
        }

        .forge-offer-stage-caption span:first-child {
          color: #fff;
          font-size: 10px;
          font-weight: 900;
        }

        .forge-offer-stage-caption span:last-child {
          color: var(--forge-orange);
          font-size: 8px;
          font-weight: 900;
          letter-spacing: .12em;
        }

        .forge-offer-price-card {
          width: 100%;
          align-self: center;
          padding: 14px;
          border: 1px solid rgba(255,255,255,.18);
          border-radius: 10px;
          background: rgba(8,9,10,.84);
          box-shadow: 0 26px 70px rgba(0,0,0,.3);
          backdrop-filter: blur(11px);
        }

        .forge-offer-price-tabs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1px;
          padding: 1px;
          border: 1px solid rgba(255,255,255,.16);
          border-radius: 7px;
          background: rgba(255,255,255,.06);
          overflow: hidden;
        }

        .forge-offer-price-tabs button {
          min-height: 38px;
          border: 0;
          background: transparent;
          color: rgba(255,255,255,.82);
          font-size: 9px;
          font-weight: 950;
          cursor: pointer;
        }

        .forge-offer-price-tabs button.active {
          background: var(--forge-orange);
          color: #fff;
        }

        .forge-offer-price-card-section {
          padding: 17px 6px 5px;
        }

        .forge-offer-price-card-section.printed {
          padding-top: 6px;
          padding-bottom: 7px;
        }

        .forge-offer-card-price {
          color: #fff;
          font-size: clamp(29px, 2.6vw, 42px);
          line-height: 1;
          font-weight: 950;
          letter-spacing: -.055em;
        }

        .forge-offer-card-compare {
          margin-top: 6px;
          color: rgba(255,255,255,.48);
          font-size: 9px;
        }

        .forge-offer-price-card-section ul,
        .forge-offer-choice-options ul {
          list-style: none;
          padding: 0;
          margin: 13px 0 14px;
          display: grid;
          gap: 7px;
        }

        .forge-offer-price-card-section li,
        .forge-offer-choice-options li {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          color: rgba(255,255,255,.82);
          font-size: 10px;
          line-height: 1.3;
        }

        .forge-offer-price-card-section li svg,
        .forge-offer-choice-options li svg {
          flex: 0 0 auto;
          color: var(--forge-orange);
        }

        .forge-offer-card-button {
          width: 100%;
          min-height: 40px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border-radius: 7px;
          font-size: 9px;
          font-weight: 950;
          cursor: pointer;
        }

        .forge-offer-card-button.orange {
          border: 1px solid var(--forge-orange);
          background: var(--forge-orange);
          color: #fff;
        }

        .forge-offer-card-button.light {
          border: 1px solid #e5e7e9;
          background: #fff;
          color: #111;
        }

        .forge-offer-card-button:hover:not(:disabled) {
          transform: translateY(-1px);
        }

        .forge-offer-card-button:disabled,
        .forge-offer-choice-options article button:disabled,
        .forge-offer-final-actions button:disabled {
          opacity: .45;
          cursor: not-allowed;
        }

        .forge-offer-price-divider {
          display: flex;
          align-items: center;
          gap: 9px;
          margin: 7px 6px;
          color: rgba(255,255,255,.4);
          font-size: 7px;
          font-weight: 900;
          letter-spacing: .16em;
        }

        .forge-offer-price-divider::before,
        .forge-offer-price-divider::after {
          content: "";
          flex: 1;
          height: 1px;
          background: rgba(255,255,255,.15);
        }

        .forge-offer-card-trust {
          margin-top: 8px;
          padding-top: 11px;
          border-top: 1px solid rgba(255,255,255,.12);
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 6px;
        }

        .forge-offer-card-trust span {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          color: rgba(255,255,255,.6);
          font-size: 7px;
          text-align: center;
          line-height: 1.25;
        }

        .forge-offer-card-trust svg {
          color: #fff;
        }

        .forge-offer-gallery-rail-wrap {
          position: relative;
          z-index: 3;
          width: min(1400px, calc(100% - 76px));
          margin: 10px auto 0;
          display: grid;
          grid-template-columns: 36px minmax(0, 1fr) 36px;
          align-items: center;
          gap: 12px;
        }

        .forge-offer-gallery-rail {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          scrollbar-width: none;
          padding: 2px 0 7px;
        }

        .forge-offer-gallery-rail::-webkit-scrollbar {
          display: none;
        }

        .forge-offer-gallery-rail button {
          flex: 0 0 118px;
          height: 73px;
          padding: 0;
          border: 1px solid rgba(255,255,255,.32);
          border-radius: 6px;
          overflow: hidden;
          background: #111;
          cursor: pointer;
        }

        .forge-offer-gallery-rail button.active {
          border: 2px solid var(--forge-orange);
        }

        .forge-offer-gallery-rail img,
        .forge-offer-gallery-video-thumb {
          width: 100%;
          height: 100%;
          display: grid;
          place-items: center;
          object-fit: cover;
        }

        .forge-offer-gallery-video-thumb {
          color: #fff;
          background: #16181a;
        }

        .forge-offer-gallery-arrow {
          width: 36px;
          height: 36px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(255,255,255,.48);
          border-radius: 50%;
          background: rgba(0,0,0,.34);
          color: #fff;
          cursor: pointer;
        }

        .forge-offer-benefits {
          padding: 58px 0 62px;
          background: #fff;
        }

        .forge-offer-benefits-grid {
          display: grid;
          grid-template-columns: .85fr 1.55fr;
          gap: 52px;
          align-items: stretch;
        }

        .forge-offer-orange-label {
          color: var(--forge-orange);
          font-size: 9px;
          font-weight: 950;
          letter-spacing: .12em;
        }

        .forge-offer-benefits-intro h2,
        .forge-offer-choice-intro h2,
        .forge-offer-faq-intro h2,
        .forge-offer-dark-section-heading h2,
        .forge-offer-details-intro h2 {
          margin: 10px 0 12px;
          font-size: clamp(30px, 3.2vw, 48px);
          line-height: .98;
          letter-spacing: -.045em;
          font-weight: 950;
        }

        .forge-offer-benefits-intro p,
        .forge-offer-choice-intro p,
        .forge-offer-faq-intro p,
        .forge-offer-details-intro p,
        .forge-offer-about-copy p {
          margin: 0;
          color: #656b71;
          font-size: 13px;
          line-height: 1.7;
        }

        .forge-offer-benefit-cards {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
        }

        .forge-offer-benefit-cards article {
          padding: 5px 22px;
          border-left: 1px solid #dfe2e5;
        }

        .forge-offer-benefit-cards article:first-child {
          border-left: 0;
        }

        .forge-offer-benefit-cards svg {
          color: #111;
          margin-bottom: 14px;
        }

        .forge-offer-benefit-cards strong {
          display: block;
          font-size: 13px;
          line-height: 1.25;
        }

        .forge-offer-benefit-cards p {
          margin: 8px 0 0;
          color: #73777c;
          font-size: 10px;
          line-height: 1.6;
        }

        .forge-offer-details-showcase {
          padding: 34px 0;
          background: #0f1112;
          color: #fff;
        }

        .forge-offer-details-layout {
          display: grid;
          grid-template-columns: .75fr 1.55fr;
          gap: 38px;
          align-items: center;
        }

        .forge-offer-details-intro p {
          color: rgba(255,255,255,.74);
        }

        .forge-offer-orange-line {
          display: block;
          width: 42px;
          height: 3px;
          margin-top: 16px;
          background: var(--forge-orange);
        }

        .forge-offer-details-gallery {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
        }

        .forge-offer-details-gallery button {
          padding: 0;
          height: 154px;
          border: 1px solid rgba(255,255,255,.28);
          border-radius: 7px;
          overflow: hidden;
          background: #17191b;
          cursor: pointer;
        }

        .forge-offer-details-gallery img {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: cover;
        }

        .forge-offer-choice {
          padding: 52px 0;
          background: #fff;
        }

        .forge-offer-choice-layout {
          display: grid;
          grid-template-columns: .76fr 1.5fr;
          gap: 46px;
          align-items: center;
        }

        .forge-offer-choice-options {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .forge-offer-choice-options article {
          padding: 19px 20px;
          border: 1px solid #d6dadd;
          border-radius: 8px;
          background: #fff;
          box-shadow: 0 10px 30px rgba(17,17,17,.04);
        }

        .forge-offer-choice-options article.selected {
          border-color: var(--forge-orange);
          box-shadow: 0 12px 34px rgba(255,90,0,.10);
        }

        .forge-offer-choice-icon {
          width: 40px;
          height: 40px;
          display: grid;
          place-items: center;
          margin-bottom: 14px;
        }

        .forge-offer-choice-icon.orange {
          color: var(--forge-orange);
        }

        .forge-offer-choice-icon.dark {
          color: #111;
        }

        .forge-offer-choice-options article > span {
          display: block;
          color: #777c80;
          font-size: 8px;
          font-weight: 950;
          letter-spacing: .1em;
        }

        .forge-offer-choice-options article > strong {
          display: block;
          margin-top: 6px;
          font-size: 26px;
          letter-spacing: -.045em;
        }

        .forge-offer-choice-options ul {
          margin-top: 13px;
          margin-bottom: 14px;
        }

        .forge-offer-choice-options li {
          color: #4f565d;
          font-size: 9px;
        }

        .forge-offer-choice-options article button {
          width: 100%;
          min-height: 39px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: 0;
          border-radius: 6px;
          background: var(--forge-orange);
          color: #fff;
          font-size: 9px;
          font-weight: 950;
          cursor: pointer;
        }

        .forge-offer-choice-options article:nth-child(2) button {
          background: #f8f8f8;
          color: #111;
          border: 1px solid #d5d8db;
        }

        .forge-offer-how {
          padding: 40px 0;
          background: #101214;
          color: #fff;
        }

        .forge-offer-dark-section-heading {
          margin-bottom: 30px;
        }

        .forge-offer-dark-section-heading h2 {
          margin-bottom: 0;
        }

        .forge-offer-steps {
          display: grid;
          grid-template-columns: 1fr 32px 1fr 32px 1fr;
          align-items: center;
        }

        .forge-offer-steps article {
          display: grid;
          grid-template-columns: auto auto 1fr;
          align-items: center;
          gap: 15px;
          min-width: 0;
        }

        .forge-offer-steps article > span {
          width: 31px;
          height: 31px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: var(--forge-orange);
          color: #fff;
          font-size: 13px;
          font-weight: 950;
        }

        .forge-offer-steps article > svg {
          color: #fff;
        }

        .forge-offer-steps strong {
          display: block;
          font-size: 12px;
        }

        .forge-offer-steps p {
          margin: 5px 0 0;
          color: rgba(255,255,255,.61);
          font-size: 9px;
          line-height: 1.5;
        }

        .forge-offer-step-arrow {
          color: rgba(255,255,255,.55);
          justify-self: center;
        }

        .forge-offer-about {
          padding: 24px 0;
          background: #fff;
        }

        .forge-offer-about-grid {
          display: grid;
          grid-template-columns: .9fr 1.35fr 240px;
          align-items: center;
          gap: 30px;
        }

        .forge-offer-about-copy p {
          margin-top: 16px;
          max-width: 430px;
          font-size: 12px;
        }

        .forge-offer-about-logo {
          color: #111;
        }

        .forge-offer-about-points {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
        }

        .forge-offer-about-points article {
          padding: 0 18px;
          border-left: 1px solid #dfe2e5;
        }

        .forge-offer-about-points svg {
          color: #111;
          margin-bottom: 10px;
        }

        .forge-offer-about-points strong {
          display: block;
          font-size: 11px;
        }

        .forge-offer-about-points p {
          margin: 5px 0 0;
          color: #71767b;
          font-size: 9px;
          line-height: 1.55;
        }

        .forge-offer-about-image {
          height: 150px;
          overflow: hidden;
          border-radius: 5px;
          background: #111;
        }

        .forge-offer-about-image img {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: cover;
        }

        .forge-offer-faq {
          padding: 36px 0 20px;
          background: #101214;
          color: #fff;
        }

        .forge-offer-faq-grid {
          display: grid;
          grid-template-columns: .68fr 1.5fr;
          gap: 36px;
          align-items: start;
        }

        .forge-offer-faq-intro p {
          color: rgba(255,255,255,.65);
          max-width: 320px;
        }

        .forge-offer-faq-list {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 7px 12px;
        }

        .forge-offer-faq-list article {
          border: 1px solid rgba(255,255,255,.16);
          border-radius: 5px;
          background: rgba(255,255,255,.015);
          overflow: hidden;
        }

        .forge-offer-faq-list article.open {
          border-color: rgba(255,90,0,.52);
        }

        .forge-offer-faq-list button {
          width: 100%;
          min-height: 42px;
          padding: 0 12px;
          border: 0;
          background: transparent;
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          text-align: left;
          cursor: pointer;
          font-size: 10px;
          font-weight: 700;
        }

        .forge-offer-faq-list button svg {
          color: #fff;
          flex: 0 0 auto;
        }

        .forge-offer-faq-list p {
          margin: 0;
          padding: 0 12px 13px;
          color: rgba(255,255,255,.63);
          font-size: 9px;
          line-height: 1.6;
        }

        .forge-offer-final-cta {
          position: relative;
          min-height: 240px;
          padding: 42px 0 28px;
          background: #08090a;
          color: #fff;
          overflow: hidden;
        }

        .forge-offer-final-background,
        .forge-offer-final-overlay {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }

        .forge-offer-final-background img {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: cover;
          opacity: .12;
          filter: saturate(1.2) brightness(.55);
          transform: scale(1.07);
        }

        .forge-offer-final-overlay {
          background: linear-gradient(90deg, rgba(7,8,9,.95) 0%, rgba(7,8,9,.73) 40%, rgba(7,8,9,.88) 100%);
        }

        .forge-offer-final-inner {
          position: relative;
          z-index: 2;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 35px;
        }

        .forge-offer-final-inner h2 {
          margin: 8px 0 10px;
          max-width: 620px;
          font-size: clamp(34px, 4vw, 56px);
          line-height: .94;
          letter-spacing: -.05em;
          font-weight: 950;
        }

        .forge-offer-final-inner h2 span {
          display: block;
          color: var(--forge-orange);
        }

        .forge-offer-final-inner p {
          margin: 0;
          color: rgba(255,255,255,.68);
          font-size: 12px;
        }

        .forge-offer-final-actions {
          width: min(400px, 100%);
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .forge-offer-final-actions button {
          min-height: 48px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border-radius: 7px;
          font-size: 9px;
          font-weight: 950;
          cursor: pointer;
        }

        .forge-offer-final-actions button.orange {
          border: 1px solid var(--forge-orange);
          background: var(--forge-orange);
          color: #fff;
        }

        .forge-offer-final-actions button.light {
          border: 1px solid #eceef0;
          background: #fff;
          color: #111;
        }

        .forge-offer-final-trust {
          position: relative;
          z-index: 2;
          width: min(1020px, calc(100% - 76px));
          margin: 27px auto 0;
          padding-top: 14px;
          border-top: 1px solid rgba(255,255,255,.11);
          display: flex;
          justify-content: center;
          flex-wrap: wrap;
          gap: 26px;
        }

        .forge-offer-final-trust span {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          color: rgba(255,255,255,.65);
          font-size: 8px;
        }

        .forge-offer-final-trust svg {
          color: #fff;
        }

        .forge-offer-loading-screen,
        .forge-offer-error-screen {
          min-height: 100vh;
          display: grid;
          place-items: center;
          background: #101214;
        }

        .forge-offer-loading,
        .forge-offer-error {
          width: min(720px, calc(100% - 40px));
          padding: 60px 30px;
          text-align: center;
          color: #fff;
        }

        .forge-offer-spinner {
          width: 42px;
          height: 42px;
          margin: 0 auto;
          border: 3px solid rgba(255,255,255,.15);
          border-top-color: var(--forge-orange);
          border-radius: 50%;
          animation: forgeOfferSpin .8s linear infinite;
        }

        .forge-offer-loading span {
          display: block;
          margin-top: 14px;
          color: rgba(255,255,255,.7);
          font-size: 12px;
        }

        .forge-offer-error h1 {
          margin: 10px 0;
          font-size: 46px;
          line-height: 1;
          letter-spacing: -.055em;
        }

        .forge-offer-error p {
          margin: 0 auto 20px;
          max-width: 520px;
          color: rgba(255,255,255,.66);
          line-height: 1.6;
        }

        .forge-offer-button {
          min-height: 46px;
          padding: 0 18px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: 0;
          border-radius: 7px;
          font-size: 9px;
          font-weight: 950;
          cursor: pointer;
        }

        .forge-offer-button-orange {
          background: var(--forge-orange);
          color: #fff;
        }

        @keyframes forgeOfferSpin {
          to { transform: rotate(360deg); }
        }

        @media (max-width: 1240px) {
          .forge-offer-header-inner,
          .forge-offer-container,
          .forge-offer-hero-inner,
          .forge-offer-gallery-rail-wrap {
            width: min(100% - 44px, 1180px);
          }

          .forge-offer-header-inner {
            grid-template-columns: 180px minmax(0, 1fr) auto;
          }

          .forge-offer-nav {
            gap: 18px;
          }

          .forge-offer-header-actions > span:nth-child(2) {
            display: none;
          }

          .forge-offer-hero-inner {
            grid-template-columns: .88fr 1fr .78fr;
            gap: 18px;
          }

          .forge-offer-product-stage,
          .forge-offer-product-stage img,
          .forge-offer-product-stage video {
            min-height: 500px;
            height: 500px;
          }
        }

        @media (max-width: 980px) {
          .forge-offer-header-inner {
            grid-template-columns: 1fr auto;
          }

          .forge-offer-nav {
            display: none;
          }

          .forge-offer-header-actions > span {
            display: none;
          }

          .forge-offer-hero {
            padding-top: 34px;
          }

          .forge-offer-hero-inner {
            grid-template-columns: 1fr 1fr;
            gap: 22px;
          }

          .forge-offer-hero-copy {
            grid-column: 1;
          }

          .forge-offer-hero-visual {
            grid-column: 2;
            grid-row: 1 / span 2;
          }

          .forge-offer-price-card {
            grid-column: 1 / -1;
            grid-row: 2;
          }

          .forge-offer-product-stage,
          .forge-offer-product-stage img,
          .forge-offer-product-stage video {
            min-height: 430px;
            height: 430px;
          }

          .forge-offer-benefits-grid,
          .forge-offer-choice-layout,
          .forge-offer-details-layout,
          .forge-offer-about-grid,
          .forge-offer-faq-grid {
            grid-template-columns: 1fr;
          }

          .forge-offer-benefit-cards {
            margin-top: 22px;
          }

          .forge-offer-about-points {
            order: 1;
          }

          .forge-offer-about-image {
            max-width: 360px;
          }

          .forge-offer-final-inner {
            flex-direction: column;
            align-items: flex-start;
          }

          .forge-offer-final-actions {
            width: min(520px, 100%);
          }
        }

        @media (max-width: 720px) {
          .forge-offer-header-inner,
          .forge-offer-container,
          .forge-offer-hero-inner,
          .forge-offer-gallery-rail-wrap,
          .forge-offer-final-trust {
            width: calc(100% - 24px);
          }

          .forge-offer-header-inner {
            min-height: 58px;
          }

          .forge-offer-brand-wordmark {
            font-size: 24px;
          }

          .forge-offer-brand-tagline {
            font-size: 6px;
          }

          .forge-offer-header-buy {
            min-height: 37px;
            padding: 0 13px;
            font-size: 8px;
          }

          .forge-offer-hero-inner {
            grid-template-columns: 1fr;
            gap: 18px;
          }

          .forge-offer-hero-copy,
          .forge-offer-hero-visual,
          .forge-offer-price-card {
            grid-column: 1;
            grid-row: auto;
          }

          .forge-offer-hero-copy h1 {
            font-size: clamp(45px, 14vw, 66px);
          }

          .forge-offer-hero-lead {
            font-size: 15px;
          }

          .forge-offer-hero-description {
            font-size: 11px;
          }

          .forge-offer-product-stage,
          .forge-offer-product-stage img,
          .forge-offer-product-stage video {
            min-height: 320px;
            height: 320px;
          }

          .forge-offer-price-card {
            margin-top: 4px;
          }

          .forge-offer-gallery-rail button {
            flex-basis: 90px;
            height: 62px;
          }

          .forge-offer-gallery-rail-wrap {
            grid-template-columns: 30px minmax(0, 1fr) 30px;
            gap: 6px;
          }

          .forge-offer-gallery-arrow {
            width: 30px;
            height: 30px;
          }

          .forge-offer-benefits,
          .forge-offer-choice,
          .forge-offer-how,
          .forge-offer-faq,
          .forge-offer-final-cta {
            padding-top: 38px;
            padding-bottom: 38px;
          }

          .forge-offer-benefit-cards,
          .forge-offer-choice-options,
          .forge-offer-about-points,
          .forge-offer-faq-list,
          .forge-offer-final-actions {
            grid-template-columns: 1fr;
          }

          .forge-offer-benefit-cards article,
          .forge-offer-about-points article {
            border-left: 0;
            border-top: 1px solid #dfe2e5;
            padding: 18px 0;
          }

          .forge-offer-benefit-cards article:first-child,
          .forge-offer-about-points article:first-child {
            border-top: 0;
          }

          .forge-offer-details-gallery {
            grid-template-columns: 1fr 1fr;
          }

          .forge-offer-details-gallery button {
            height: 130px;
          }

          .forge-offer-steps {
            grid-template-columns: 1fr;
            gap: 12px;
          }

          .forge-offer-step-arrow {
            transform: rotate(90deg);
          }

          .forge-offer-about-image {
            max-width: none;
          }

          .forge-offer-final-trust {
            justify-content: flex-start;
            gap: 14px;
          }
        }



        /* Refinamento responsivo mobile: mais densidade, menos espaço desperdiçado e CTA mais acessível. */
        @media (max-width: 720px) {
          .forge-offer {
            width: 100%;
            overflow-x: clip;
          }

          .forge-offer-container,
          .forge-offer-header-inner,
          .forge-offer-hero-inner,
          .forge-offer-gallery-rail-wrap,
          .forge-offer-final-trust {
            width: calc(100% - 28px);
          }

          .forge-offer-header-inner {
            min-height: 54px;
            grid-template-columns: minmax(0, 1fr) auto;
            gap: 10px;
          }

          .forge-offer-brand-wordmark {
            font-size: 22px;
            letter-spacing: -.07em;
          }

          .forge-offer-brand-tagline {
            margin-top: 3px;
            font-size: 5px;
            letter-spacing: .27em;
          }

          .forge-offer-header-buy {
            min-height: 34px;
            padding: 0 11px;
            border-radius: 6px;
            font-size: 8px;
          }

          .forge-offer-header-buy svg {
            width: 14px;
            height: 14px;
          }

          .forge-offer-hero {
            min-height: 0;
            padding: 28px 0 18px;
          }

          .forge-offer-hero-overlay {
            background:
              radial-gradient(circle at 50% 36%, rgba(255,90,0,.09), transparent 29%),
              linear-gradient(180deg, rgba(5,6,7,.91) 0%, rgba(5,6,7,.76) 48%, rgba(5,6,7,.98) 100%);
          }

          .forge-offer-hero-inner {
            grid-template-columns: 1fr;
            gap: 14px;
          }

          .forge-offer-hero-copy {
            order: 1;
            padding: 0;
          }

          .forge-offer-launch-badge {
            min-height: 24px;
            padding: 0 10px;
            border-radius: 6px;
            font-size: 7px;
          }

          .forge-offer-hero-copy h1 {
            max-width: 100%;
            margin: 11px 0 9px;
            font-size: clamp(42px, 14vw, 58px);
            line-height: .86;
            letter-spacing: -.065em;
          }

          .forge-offer-hero-lead {
            max-width: 330px;
            font-size: 14px;
            line-height: 1.15;
          }

          .forge-offer-hero-description {
            max-width: 340px;
            margin-top: 12px;
            font-size: 10px;
            line-height: 1.48;
          }

          .forge-offer-hero-bullets {
            margin-top: 15px;
            gap: 9px;
          }

          .forge-offer-hero-bullets > div {
            gap: 9px;
          }

          .forge-offer-hero-bullets span {
            width: 19px;
            height: 19px;
          }

          .forge-offer-hero-bullets span svg {
            width: 17px;
            height: 17px;
          }

          .forge-offer-hero-bullets strong {
            font-size: 10px;
          }

          .forge-offer-hero-visual {
            order: 2;
            min-height: 0;
          }

          .forge-offer-product-stage {
            min-height: 245px;
            height: 245px;
            margin: -1px 0 -2px;
          }

          .forge-offer-product-stage img,
          .forge-offer-product-stage video {
            width: 100%;
            height: 245px;
            object-fit: contain;
          }

          .forge-offer-product-stage::before {
            width: 85%;
            filter: blur(15px);
          }

          .forge-offer-product-stage-glow {
            inset: 10% 3%;
            filter: blur(20px);
          }

          .forge-offer-stage-caption {
            bottom: 13px;
            padding: 5px 8px;
            gap: 5px;
            border-radius: 6px;
          }

          .forge-offer-stage-caption span:first-child {
            font-size: 8px;
          }

          .forge-offer-stage-caption span:last-child {
            font-size: 6px;
          }

          .forge-offer-price-card {
            order: 3;
            padding: 10px;
            border-radius: 8px;
            box-shadow: 0 18px 40px rgba(0,0,0,.24);
          }

          .forge-offer-price-tabs button {
            min-height: 34px;
            font-size: 8px;
          }

          .forge-offer-price-card-section {
            padding: 13px 4px 4px;
          }

          .forge-offer-price-card-section.printed {
            padding-top: 5px;
            padding-bottom: 4px;
          }

          .forge-offer-card-price {
            font-size: 30px;
          }

          .forge-offer-card-compare {
            margin-top: 4px;
            font-size: 8px;
          }

          .forge-offer-price-card-section ul {
            margin: 9px 0 10px;
            gap: 5px;
          }

          .forge-offer-price-card-section li {
            gap: 6px;
            font-size: 9px;
          }

          .forge-offer-price-card-section li svg {
            width: 13px;
            height: 13px;
          }

          .forge-offer-card-button {
            min-height: 38px;
            border-radius: 6px;
            font-size: 8px;
          }

          .forge-offer-price-divider {
            margin: 5px 4px;
            gap: 7px;
            font-size: 6px;
          }

          .forge-offer-card-trust {
            margin-top: 6px;
            padding-top: 8px;
            gap: 4px;
          }

          .forge-offer-card-trust span {
            gap: 4px;
            font-size: 6px;
          }

          .forge-offer-card-trust svg {
            width: 12px;
            height: 12px;
          }

          .forge-offer-gallery-rail-wrap {
            margin-top: 7px;
            grid-template-columns: 28px minmax(0, 1fr) 28px;
            gap: 5px;
          }

          .forge-offer-gallery-rail {
            gap: 6px;
            padding: 1px 0 4px;
          }

          .forge-offer-gallery-rail button {
            flex-basis: 83px;
            height: 56px;
            border-radius: 5px;
          }

          .forge-offer-gallery-arrow {
            width: 28px;
            height: 28px;
          }

          /* BENEFÍCIOS: duas colunas no celular evitam a sensação de vazio e reduzem bastante a rolagem. */
          .forge-offer-benefits {
            padding: 27px 0 31px;
          }

          .forge-offer-benefits-grid {
            grid-template-columns: 1fr;
            gap: 27px;
            align-items: start;
          }

          .forge-offer-orange-label {
            font-size: 7px;
            letter-spacing: .1em;
          }

          .forge-offer-benefits-intro h2,
          .forge-offer-choice-intro h2,
          .forge-offer-faq-intro h2,
          .forge-offer-dark-section-heading h2,
          .forge-offer-details-intro h2 {
            margin: 8px 0 10px;
            font-size: clamp(30px, 8.9vw, 39px);
            line-height: .94;
            letter-spacing: -.055em;
          }

          .forge-offer-benefits-intro p,
          .forge-offer-choice-intro p,
          .forge-offer-faq-intro p,
          .forge-offer-details-intro p,
          .forge-offer-about-copy p {
            font-size: 11px;
            line-height: 1.6;
          }

          .forge-offer-benefit-cards {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            column-gap: 0;
            row-gap: 0;
            border-top: 1px solid #dfe2e5;
            border-bottom: 1px solid #dfe2e5;
          }

          .forge-offer-benefit-cards article,
          .forge-offer-benefit-cards article:first-child {
            min-width: 0;
            padding: 14px 13px 15px;
            border: 0;
            border-left: 1px solid #dfe2e5;
            border-top: 1px solid #dfe2e5;
          }

          .forge-offer-benefit-cards article:nth-child(-n + 2) {
            border-top: 0;
          }

          .forge-offer-benefit-cards article:nth-child(odd) {
            border-left: 0;
          }

          .forge-offer-benefit-cards svg {
            width: 27px;
            height: 27px;
            margin-bottom: 10px;
          }

          .forge-offer-benefit-cards strong {
            font-size: 10px;
            line-height: 1.2;
          }

          .forge-offer-benefit-cards p {
            margin-top: 6px;
            font-size: 8px;
            line-height: 1.5;
          }

          .forge-offer-details-showcase {
            padding: 28px 0 25px;
          }

          .forge-offer-details-layout {
            grid-template-columns: 1fr;
            gap: 18px;
          }

          .forge-offer-details-gallery {
            grid-template-columns: 1fr 1fr;
            gap: 6px;
          }

          .forge-offer-details-gallery button {
            height: 105px;
            border-radius: 6px;
          }

          .forge-offer-choice {
            padding: 31px 0;
          }

          .forge-offer-choice-layout {
            grid-template-columns: 1fr;
            gap: 22px;
          }

          .forge-offer-choice-options {
            grid-template-columns: 1fr;
            gap: 9px;
          }

          .forge-offer-choice-options article {
            padding: 15px 15px 14px;
            border-radius: 7px;
          }

          .forge-offer-choice-icon {
            width: 34px;
            height: 34px;
            margin-bottom: 10px;
          }

          .forge-offer-choice-options article > strong {
            margin-top: 5px;
            font-size: 24px;
          }

          .forge-offer-choice-options ul {
            margin: 10px 0 12px;
            gap: 5px;
          }

          .forge-offer-choice-options li {
            font-size: 8px;
          }

          .forge-offer-choice-options article button {
            min-height: 38px;
            font-size: 8px;
          }

          .forge-offer-how {
            padding: 30px 0;
          }

          .forge-offer-dark-section-heading {
            margin-bottom: 18px;
          }

          .forge-offer-steps {
            grid-template-columns: 1fr;
            gap: 9px;
          }

          .forge-offer-steps article {
            grid-template-columns: auto auto 1fr;
            gap: 10px;
            padding: 10px 0;
            border-top: 1px solid rgba(255,255,255,.08);
          }

          .forge-offer-steps article:first-child {
            border-top: 0;
          }

          .forge-offer-steps article > span {
            width: 27px;
            height: 27px;
            font-size: 11px;
          }

          .forge-offer-steps article > svg {
            width: 28px;
            height: 28px;
          }

          .forge-offer-steps strong {
            font-size: 10px;
          }

          .forge-offer-steps p {
            margin-top: 3px;
            font-size: 8px;
          }

          .forge-offer-step-arrow {
            display: none;
          }

          .forge-offer-about {
            padding: 24px 0;
          }

          .forge-offer-about-grid {
            grid-template-columns: 1fr;
            gap: 18px;
          }

          .forge-offer-about-points {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .forge-offer-about-points article,
          .forge-offer-about-points article:first-child {
            padding: 14px 12px;
            border-top: 1px solid #dfe2e5;
          }

          .forge-offer-about-points article:nth-child(-n + 2) {
            border-top: 0;
          }

          .forge-offer-about-points article:nth-child(odd) {
            border-left: 0;
          }

          .forge-offer-about-points svg {
            width: 27px;
            height: 27px;
            margin-bottom: 8px;
          }

          .forge-offer-about-points strong {
            font-size: 9px;
          }

          .forge-offer-about-points p {
            font-size: 7px;
          }

          .forge-offer-about-image {
            height: 126px;
            border-radius: 6px;
          }

          .forge-offer-faq {
            padding: 29px 0 22px;
          }

          .forge-offer-faq-grid {
            grid-template-columns: 1fr;
            gap: 18px;
          }

          .forge-offer-faq-list {
            grid-template-columns: 1fr;
            gap: 6px;
          }

          .forge-offer-faq-list button {
            min-height: 44px;
            padding: 0 11px;
            font-size: 9px;
          }

          .forge-offer-faq-list p {
            padding: 0 11px 11px;
            font-size: 8px;
          }

          .forge-offer-final-cta {
            min-height: 0;
            padding: 31px 0 23px;
          }

          .forge-offer-final-inner {
            flex-direction: column;
            align-items: stretch;
            gap: 20px;
          }

          .forge-offer-final-inner h2 {
            margin: 8px 0 8px;
            font-size: clamp(33px, 10vw, 46px);
          }

          .forge-offer-final-inner p {
            font-size: 10px;
            line-height: 1.5;
          }

          .forge-offer-final-actions {
            width: 100%;
            grid-template-columns: 1fr;
            gap: 8px;
          }

          .forge-offer-final-actions button {
            min-height: 44px;
            border-radius: 6px;
            font-size: 8px;
          }

          .forge-offer-final-trust {
            margin-top: 17px;
            padding-top: 11px;
            justify-content: space-between;
            gap: 8px;
          }

          .forge-offer-final-trust span {
            font-size: 7px;
          }

          .forge-offer-final-trust svg {
            width: 12px;
            height: 12px;
          }
        }

        /* Ajuste final de tipografia e densidade no mobile:
           leitura maior, cards mais confortáveis e menos sensação de conteúdo "miúdo". */
        @media (max-width: 720px) {
          .forge-offer-container,
          .forge-offer-header-inner,
          .forge-offer-hero-inner,
          .forge-offer-gallery-rail-wrap,
          .forge-offer-final-trust {
            width: calc(100% - 22px);
          }

          .forge-offer-hero {
            padding: 24px 0 16px;
          }

          .forge-offer-hero-copy h1 {
            font-size: clamp(44px, 14.5vw, 60px);
          }

          .forge-offer-hero-lead {
            max-width: 100%;
            font-size: 16px;
            line-height: 1.2;
          }

          .forge-offer-hero-description {
            max-width: 100%;
            margin-top: 13px;
            font-size: 12px;
            line-height: 1.55;
          }

          .forge-offer-hero-bullets {
            margin-top: 16px;
            gap: 10px;
          }

          .forge-offer-hero-bullets > div {
            gap: 10px;
          }

          .forge-offer-hero-bullets span {
            width: 21px;
            height: 21px;
          }

          .forge-offer-hero-bullets span svg {
            width: 18px;
            height: 18px;
          }

          .forge-offer-hero-bullets strong {
            font-size: 11px;
            line-height: 1.3;
          }

          .forge-offer-product-stage {
            min-height: 255px;
            height: 255px;
          }

          .forge-offer-product-stage img,
          .forge-offer-product-stage video {
            height: 255px;
          }

          .forge-offer-price-card {
            padding: 11px;
          }

          .forge-offer-price-tabs button {
            min-height: 37px;
            font-size: 9px;
          }

          .forge-offer-price-card-section {
            padding: 14px 5px 5px;
          }

          .forge-offer-card-price {
            font-size: 33px;
          }

          .forge-offer-card-compare {
            font-size: 8.5px;
          }

          .forge-offer-price-card-section ul {
            margin: 10px 0 12px;
            gap: 6px;
          }

          .forge-offer-price-card-section li {
            gap: 7px;
            font-size: 10px;
            line-height: 1.35;
          }

          .forge-offer-price-card-section li svg {
            width: 14px;
            height: 14px;
          }

          .forge-offer-card-button {
            min-height: 42px;
            font-size: 9.5px;
          }

          .forge-offer-price-divider {
            margin: 7px 5px;
            font-size: 6.5px;
          }

          .forge-offer-card-trust {
            margin-top: 7px;
            padding-top: 9px;
            gap: 5px;
          }

          .forge-offer-card-trust span {
            gap: 4px;
            font-size: 7px;
            line-height: 1.3;
          }

          .forge-offer-gallery-rail-wrap {
            margin-top: 8px;
          }

          .forge-offer-gallery-rail button {
            flex-basis: 87px;
            height: 59px;
          }

          .forge-offer-benefits {
            padding: 30px 0 33px;
          }

          .forge-offer-benefits-grid {
            gap: 22px;
          }

          .forge-offer-orange-label {
            font-size: 8px;
          }

          .forge-offer-benefits-intro h2,
          .forge-offer-choice-intro h2,
          .forge-offer-faq-intro h2,
          .forge-offer-dark-section-heading h2,
          .forge-offer-details-intro h2 {
            margin: 7px 0 11px;
            font-size: clamp(31px, 9.2vw, 40px);
            line-height: .96;
          }

          .forge-offer-benefits-intro p,
          .forge-offer-choice-intro p,
          .forge-offer-faq-intro p,
          .forge-offer-details-intro p,
          .forge-offer-about-copy p {
            font-size: 12px;
            line-height: 1.62;
          }

          .forge-offer-benefit-cards article,
          .forge-offer-benefit-cards article:first-child {
            padding: 17px 14px 18px;
          }

          .forge-offer-benefit-cards svg {
            width: 28px;
            height: 28px;
            margin-bottom: 10px;
          }

          .forge-offer-benefit-cards strong {
            font-size: 11px;
            line-height: 1.25;
          }

          .forge-offer-benefit-cards p {
            margin-top: 7px;
            font-size: 9.5px;
            line-height: 1.52;
          }

          .forge-offer-details-showcase {
            padding: 30px 0 27px;
          }

          .forge-offer-details-layout {
            gap: 16px;
          }

          .forge-offer-details-gallery button {
            height: 110px;
          }

          .forge-offer-choice {
            padding: 34px 0;
          }

          .forge-offer-choice-layout {
            gap: 20px;
          }

          .forge-offer-choice-options {
            gap: 10px;
          }

          .forge-offer-choice-options article {
            padding: 16px 16px 15px;
          }

          .forge-offer-choice-options article > span {
            font-size: 8.5px;
          }

          .forge-offer-choice-options article > strong {
            font-size: 27px;
          }

          .forge-offer-choice-options ul {
            margin: 11px 0 13px;
            gap: 6px;
          }

          .forge-offer-choice-options li {
            font-size: 9.5px;
            line-height: 1.35;
          }

          .forge-offer-choice-options article button {
            min-height: 42px;
            font-size: 9.5px;
          }

          .forge-offer-how {
            padding: 32px 0;
          }

          .forge-offer-dark-section-heading {
            margin-bottom: 17px;
          }

          .forge-offer-steps {
            gap: 7px;
          }

          .forge-offer-steps article {
            gap: 11px;
            padding: 12px 0;
          }

          .forge-offer-steps article > span {
            width: 29px;
            height: 29px;
            font-size: 12px;
          }

          .forge-offer-steps article > svg {
            width: 30px;
            height: 30px;
          }

          .forge-offer-steps strong {
            font-size: 11px;
          }

          .forge-offer-steps p {
            margin-top: 4px;
            font-size: 9.5px;
            line-height: 1.5;
          }

          .forge-offer-about {
            padding: 27px 0;
          }

          .forge-offer-about-grid {
            gap: 16px;
          }

          .forge-offer-about-points article,
          .forge-offer-about-points article:first-child {
            padding: 16px 13px;
          }

          .forge-offer-about-points svg {
            width: 28px;
            height: 28px;
            margin-bottom: 8px;
          }

          .forge-offer-about-points strong {
            font-size: 10px;
          }

          .forge-offer-about-points p {
            margin-top: 5px;
            font-size: 9px;
            line-height: 1.5;
          }

          .forge-offer-about-image {
            height: 132px;
          }

          .forge-offer-faq {
            padding: 31px 0 24px;
          }

          .forge-offer-faq-grid {
            gap: 17px;
          }

          .forge-offer-faq-list {
            gap: 7px;
          }

          .forge-offer-faq-list button {
            min-height: 47px;
            padding: 0 12px;
            font-size: 10px;
          }

          .forge-offer-faq-list p {
            padding: 0 12px 13px;
            font-size: 9px;
            line-height: 1.58;
          }

          .forge-offer-final-cta {
            padding: 33px 0 25px;
          }

          .forge-offer-final-inner {
            gap: 18px;
          }

          .forge-offer-final-inner h2 {
            margin: 8px 0 9px;
            font-size: clamp(34px, 10.5vw, 47px);
          }

          .forge-offer-final-inner p {
            font-size: 11px;
            line-height: 1.52;
          }

          .forge-offer-final-actions {
            gap: 9px;
          }

          .forge-offer-final-actions button {
            min-height: 47px;
            font-size: 9.5px;
          }

          .forge-offer-final-trust {
            margin-top: 18px;
            padding-top: 12px;
          }

          .forge-offer-final-trust span {
            font-size: 7.5px;
          }
        }


        /* Ajuste final de legibilidade mobile:
           tipografia maior para leitura confortável sem transformar a página
           em uma sequência de blocos excessivamente altos. */
        @media (max-width: 720px) {
          .forge-offer {
            -webkit-text-size-adjust: 100%;
            text-size-adjust: 100%;
          }

          .forge-offer-hero-copy h1 {
            font-size: clamp(45px, 14.8vw, 61px);
            line-height: .88;
          }

          .forge-offer-hero-lead {
            font-size: 17px;
            line-height: 1.22;
          }

          .forge-offer-hero-description {
            font-size: 13px;
            line-height: 1.58;
          }

          .forge-offer-hero-bullets {
            gap: 11px;
            margin-top: 17px;
          }

          .forge-offer-hero-bullets strong {
            font-size: 12px;
            line-height: 1.32;
          }

          .forge-offer-card-price {
            font-size: 35px;
          }

          .forge-offer-price-card-section li {
            font-size: 11px;
            line-height: 1.38;
          }

          .forge-offer-card-button {
            min-height: 44px;
            font-size: 11px;
          }

          .forge-offer-card-compare {
            font-size: 9px;
          }

          .forge-offer-card-trust span {
            font-size: 8px;
          }

          .forge-offer-benefits {
            padding: 28px 0 30px;
          }

          .forge-offer-benefits-grid {
            gap: 19px;
          }

          .forge-offer-orange-label {
            font-size: 8.5px;
            letter-spacing: .08em;
          }

          .forge-offer-benefits-intro h2,
          .forge-offer-choice-intro h2,
          .forge-offer-faq-intro h2,
          .forge-offer-dark-section-heading h2,
          .forge-offer-details-intro h2 {
            font-size: clamp(32px, 9.5vw, 42px);
            line-height: .96;
          }

          .forge-offer-benefits-intro p,
          .forge-offer-choice-intro p,
          .forge-offer-faq-intro p,
          .forge-offer-details-intro p,
          .forge-offer-about-copy p {
            font-size: 13px;
            line-height: 1.62;
          }

          .forge-offer-benefit-cards article,
          .forge-offer-benefit-cards article:first-child {
            padding: 16px 14px 17px;
          }

          .forge-offer-benefit-cards svg {
            width: 29px;
            height: 29px;
            margin-bottom: 9px;
          }

          .forge-offer-benefit-cards strong {
            font-size: 12px;
            line-height: 1.28;
          }

          .forge-offer-benefit-cards p {
            margin-top: 7px;
            font-size: 10.5px;
            line-height: 1.55;
          }

          .forge-offer-details-showcase {
            padding: 28px 0 25px;
          }

          .forge-offer-details-intro p {
            font-size: 13px;
          }

          .forge-offer-choice {
            padding: 31px 0;
          }

          .forge-offer-choice-layout {
            gap: 18px;
          }

          .forge-offer-choice-options article {
            padding: 16px 16px 15px;
          }

          .forge-offer-choice-options article > span {
            font-size: 9.5px;
          }

          .forge-offer-choice-options article > strong {
            font-size: 29px;
          }

          .forge-offer-choice-options li {
            font-size: 11px;
            line-height: 1.4;
          }

          .forge-offer-choice-options article button {
            min-height: 44px;
            font-size: 11px;
          }

          .forge-offer-how {
            padding: 29px 0;
          }

          .forge-offer-dark-section-heading {
            margin-bottom: 15px;
          }

          .forge-offer-steps article {
            gap: 11px;
            padding: 11px 0;
          }

          .forge-offer-steps article > span {
            width: 30px;
            height: 30px;
            font-size: 12px;
          }

          .forge-offer-steps article > svg {
            width: 31px;
            height: 31px;
          }

          .forge-offer-steps strong {
            font-size: 12.5px;
            line-height: 1.3;
          }

          .forge-offer-steps p {
            margin-top: 4px;
            font-size: 10.5px;
            line-height: 1.55;
          }

          .forge-offer-about {
            padding: 25px 0;
          }

          .forge-offer-about-copy p {
            font-size: 13px;
          }

          .forge-offer-about-points article,
          .forge-offer-about-points article:first-child {
            padding: 15px 13px;
          }

          .forge-offer-about-points strong {
            font-size: 11.5px;
            line-height: 1.3;
          }

          .forge-offer-about-points p {
            font-size: 10.5px;
            line-height: 1.5;
          }

          .forge-offer-faq {
            padding: 29px 0 22px;
          }

          .forge-offer-faq-grid {
            gap: 16px;
          }

          .forge-offer-faq-list button {
            min-height: 50px;
            padding: 0 13px;
            font-size: 12px;
            line-height: 1.35;
          }

          .forge-offer-faq-list p {
            padding: 0 13px 13px;
            font-size: 11px;
            line-height: 1.6;
          }

          .forge-offer-final-cta {
            padding: 30px 0 23px;
          }

          .forge-offer-final-inner {
            gap: 17px;
          }

          .forge-offer-final-inner h2 {
            font-size: clamp(35px, 10.8vw, 49px);
            line-height: .95;
          }

          .forge-offer-final-inner p {
            font-size: 12px;
            line-height: 1.55;
          }

          .forge-offer-final-actions button {
            min-height: 49px;
            font-size: 11px;
          }

          .forge-offer-final-trust span {
            font-size: 8.5px;
            line-height: 1.35;
          }

          .forge-offer-button {
            font-size: 11px;
          }
        }

        /* Galeria mobile: imagem inteira, sem sobreposição do card de compra. */
        .forge-offer-product-stage {
          cursor: zoom-in;
        }

        .forge-offer-product-stage img,
        .forge-offer-product-stage video {
          user-select: none;
        }

        .forge-offer-stage-expand {
          position: absolute;
          top: 14px;
          right: 14px;
          display: inline-flex;
          align-items: center;
          padding: 6px 9px;
          border: 1px solid rgba(255,255,255,.28);
          border-radius: 999px;
          background: rgba(0,0,0,.48);
          color: rgba(255,255,255,.9);
          font-size: 8px;
          font-weight: 900;
          letter-spacing: .12em;
          backdrop-filter: blur(10px);
          pointer-events: none;
        }

        .forge-offer-lightbox {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: grid;
          grid-template-rows: auto minmax(0, 1fr) auto;
          padding: 18px;
          background: rgba(4,5,6,.86);
          backdrop-filter: blur(16px) saturate(.9);
          -webkit-backdrop-filter: blur(16px) saturate(.9);
        }

        .forge-offer-lightbox-toolbar {
          width: min(1180px, 100%);
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          color: rgba(255,255,255,.82);
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .14em;
        }

        .forge-offer-lightbox-toolbar button {
          width: 42px;
          height: 42px;
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          border: 1px solid rgba(255,255,255,.22);
          border-radius: 50%;
          background: rgba(255,255,255,.07);
          color: #fff;
          cursor: pointer;
        }

        .forge-offer-lightbox-stage {
          min-height: 0;
          width: min(1180px, 100%);
          margin: 14px auto;
          display: grid;
          place-items: center;
          overflow: hidden;
        }

        .forge-offer-lightbox-stage img,
        .forge-offer-lightbox-stage video {
          display: block;
          width: auto;
          max-width: 100%;
          height: auto;
          max-height: 100%;
          object-fit: contain;
          border-radius: 10px;
          box-shadow: 0 30px 90px rgba(0,0,0,.48);
        }

        .forge-offer-lightbox-stage img {
          background: #fff;
        }

        .forge-offer-lightbox-hint {
          text-align: center;
          color: rgba(255,255,255,.54);
          font-size: 10px;
          line-height: 1.4;
        }

        @media (max-width: 720px) {
          .forge-offer-hero {
            padding-bottom: 8px;
          }

          .forge-offer-hero-inner {
            gap: 12px;
          }

          .forge-offer-product-stage {
            width: 100%;
            min-height: 0;
            height: auto;
            margin: 0;
            padding: 0;
            overflow: visible;
          }

          .forge-offer-product-stage img,
          .forge-offer-product-stage video {
            width: 100%;
            height: auto;
            min-height: 0;
            max-height: none;
            aspect-ratio: 1 / 1;
            object-fit: contain;
            object-position: center;
            border-radius: 0;
          }

          .forge-offer-product-stage::before {
            width: 74%;
            filter: blur(18px);
          }

          .forge-offer-product-stage-glow {
            inset: 11% 5%;
            filter: blur(22px);
          }

          .forge-offer-stage-expand {
            top: 11px;
            right: 11px;
            padding: 6px 8px;
            font-size: 8px;
          }

          .forge-offer-stage-caption {
            bottom: 10px;
          }

          .forge-offer-price-card {
            margin-top: 2px;
          }

          .forge-offer-gallery-rail-wrap {
            margin-top: 10px;
          }

          .forge-offer-lightbox {
            padding: 12px;
          }

          .forge-offer-lightbox-toolbar {
            font-size: 8px;
          }

          .forge-offer-lightbox-toolbar button {
            width: 40px;
            height: 40px;
          }

          .forge-offer-lightbox-stage {
            margin: 10px auto;
          }

          .forge-offer-lightbox-stage img,
          .forge-offer-lightbox-stage video {
            width: 100%;
            max-width: 100%;
            max-height: 78vh;
            border-radius: 7px;
          }

          .forge-offer-lightbox-hint {
            font-size: 9px;
            padding-bottom: 5px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .forge-offer-spinner {
            animation: none;
          }

          .forge-offer * {
            scroll-behavior: auto !important;
            transition: none !important;
          }
        }
      `}</style>
    </>
  );
}
