
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Box,
  Download,
  Printer,
  ShieldCheck,
  Star,
  Zap,
} from 'lucide-react';

import { ProductCard } from '../components/ProductCard';
import { trackEvent } from '../lib/analytics';
import { useProducts, type Product } from '../lib/catalog';

export function Home({
  onAdd,
}: {
  onAdd: (p: Product) => void;
}) {
  const {
    products,
    loading,
    error,
  } = useProducts();

  const best = products
    .filter((product) => product.isBestSeller || product.featured)
    .slice(0, 4);

  const fallbackBest = products.slice(0, 4);

  const featuredProducts =
    best.length > 0 ? best : fallbackBest;

  const physical = products.filter(
    (product) => product.type === 'physical'
  );

  const mainPhysical = physical[0];
  const secondPhysical = physical[1] || physical[0];

  if (loading) {
    return (
      <section className="section">
        <div className="container">
          <div className="empty-state">
            <h3>Carregando produtos...</h3>
            <p>Buscando o catálogo atualizado da Forge3D.</p>
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="section">
        <div className="container">
          <div className="empty-state">
            <h3>Não foi possível carregar os produtos.</h3>
            <p>
              Verifique a conexão com o Supabase e tente novamente.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <span className="eyebrow">
              ARQUIVOS STL + IMPRESSÃO 3D
            </span>

            <h1>
              Modelos que você <em>quer imprimir.</em>
            </h1>

            <p>
              Encontre arquivos STL prontos para sua impressora
              ou peça para a Forge3D produzir e enviar até você.
            </p>

            <div className="hero-actions">
              <Link
                to="/stl"
                className="btn btn-dark"
                data-track="hero_stl"
                onClick={() =>
                  trackEvent('HeroClick', {
                    destination: 'stl',
                  })
                }
              >
                EXPLORAR STL
                <ArrowRight size={18} />
              </Link>

              <Link
                to="/impressao-3d"
                className="btn btn-light"
                data-track="hero_print"
                onClick={() =>
                  trackEvent('HeroClick', {
                    destination: 'impressao-3d',
                  })
                }
              >
                QUERO IMPRIMIR
                <Printer size={18} />
              </Link>
            </div>

            <div className="trust-row">
              <span>
                <ShieldCheck size={16} />
                Compra segura
              </span>

              <span>
                <Download size={16} />
                Download digital
              </span>

              <span>
                <Printer size={16} />
                Produção sob demanda
              </span>
            </div>
          </div>

          <div className="hero-visual">
            {featuredProducts[0] && (
              <div className="hero-image-main">
                <img
                  src={featuredProducts[0].image}
                  alt={featuredProducts[0].name}
                />
              </div>
            )}

            <div className="hero-note">
              <strong>+ MODELOS</strong>
              <span>prontos para imprimir</span>
            </div>

            {featuredProducts[1] && (
              <div className="hero-mini">
                <img
                  src={featuredProducts[1].image}
                  alt={featuredProducts[1].name}
                />

                <span>DO DIGITAL AO REAL</span>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="benefit-strip">
        <div className="container benefit-grid">
          <div>
            <Zap size={19} />

            <div>
              <strong>RÁPIDO</strong>
              <span>
                Compra simples e acesso ao seu produto.
              </span>
            </div>
          </div>

          <div>
            <ShieldCheck size={19} />

            <div>
              <strong>SEGURO</strong>
              <span>
                Seus dados e arquivos protegidos.
              </span>
            </div>
          </div>

          <div>
            <Printer size={19} />

            <div>
              <strong>IMPRESSÃO 3D</strong>
              <span>
                Produção sob demanda.
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="section products-section">
        <div className="container">
          <div className="section-heading">
            <div>
              <span className="eyebrow">
                O QUE ESTÁ SAINDO MAIS
              </span>

              <h2>Mais procurados</h2>

              <p>
                Modelos escolhidos por quem já está colocando
                a mão na massa.
              </p>
            </div>

            <Link to="/stl" className="text-link">
              VER TODOS
              <ArrowRight size={16} />
            </Link>
          </div>

          {featuredProducts.length > 0 ? (
            <div className="product-grid">
              {featuredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  p={product}
                  onAdd={onAdd}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <h3>Nenhum produto cadastrado ainda.</h3>
              <p>
                Cadastre seu primeiro produto pelo painel
                administrativo.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="category-section">
        <div className="container">
          <div className="section-heading">
            <div>
              <span className="eyebrow">
                ENCONTRE PELO SEU PROJETO
              </span>

              <h2>Explore por categoria</h2>
            </div>
          </div>

          <div className="category-grid">
            <Link to="/stl?category=Peças%20Mecânicas">
              <Box />
              <strong>Peças mecânicas</strong>
              <span>Engrenagens, peças e projetos</span>
            </Link>

            <Link to="/stl?category=Games">
              <Box />
              <strong>Games</strong>
              <span>Suportes e acessórios</span>
            </Link>

            <Link to="/stl?category=Utilidades">
              <Box />
              <strong>Utilidades</strong>
              <span>Para facilitar o dia a dia</span>
            </Link>

            <Link to="/stl?category=Organização">
              <Box />
              <strong>Organização</strong>
              <span>Mais espaço e praticidade</span>
            </Link>
          </div>
        </div>
      </section>

      <section className="print-cta">
        <div className="container print-grid">
          <div>
            <span className="eyebrow">
              VOCÊ TEM O MODELO. NÓS FAZEMOS A PEÇA.
            </span>

            <h2>
              Não tem impressora?
              <br />
              <em>Deixa com a Forge3D.</em>
            </h2>

            <p>
              Escolha uma peça do catálogo ou fale com a
              gente para produzir seu próprio modelo.
            </p>

            <Link
              to="/impressao-3d"
              className="btn btn-orange"
            >
              VER IMPRESSÕES 3D
              <ArrowRight size={18} />
            </Link>
          </div>

          <div className="print-collage">
            {mainPhysical && (
              <img
                src={mainPhysical.image}
                alt={mainPhysical.name}
              />
            )}

            {secondPhysical && (
              <img
                src={secondPhysical.image}
                alt={secondPhysical.name}
              />
            )}
          </div>
        </div>
      </section>

      <SalesObjectionCarousel />

      <section className="faq-section">
        <div className="container faq-grid">
          <div>
            <span className="eyebrow">
              ANTES DE COMPRAR
            </span>

            <h2>Tem alguma dúvida?</h2>

            <p>
              A resposta que você procura pode estar aqui.
            </p>
          </div>

          <div className="faq-list">
            <details>
              <summary>
                Como recebo um arquivo STL?
              </summary>

              <p>
                Depois da confirmação do pagamento, seu pedido é registrado e a
                entrega digital é preparada para o e-mail informado no checkout.
              </p>
            </details>

            <details>
              <summary>
                Vocês também fazem a impressão?
              </summary>

              <p>
                Sim. A Forge3D trabalha com impressão 3D
                sob demanda para os produtos físicos disponíveis.
              </p>
            </details>

            <details>
              <summary>
                Posso imprimir o arquivo em qualquer impressora?
              </summary>

              <p>
                A compatibilidade depende do modelo e das
                configurações de impressão. Cada produto terá
                suas recomendações técnicas.
              </p>
            </details>
          </div>
        </div>
      </section>
    </>
  );
}

function SalesObjectionCarousel() {
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const cards = [
    {
      eyebrow: 'MEDO DE COMPRAR ONLINE',
      title: '“E se eu pagar e não receber?”',
      text:
        'O pedido fica registrado no sistema assim que o pagamento é confirmado. Na compra de STL, a entrega é preparada para o e-mail informado no checkout.',
      proof: 'Pagamento confirmado + pedido registrado',
    },
    {
      eyebrow: 'AINDA ESTÁ EM DÚVIDA',
      title: '“Será que esse modelo serve para o que eu preciso?”',
      text:
        'Você pode conferir as imagens, descrição e informações do produto antes de finalizar. A ideia é você comprar sabendo exatamente o que está levando.',
      proof: 'Informações do produto antes da compra',
    },
    {
      eyebrow: 'NÃO TEM IMPRESSORA',
      title: '“Eu gostei do modelo, mas não tenho impressora 3D.”',
      text:
        'Você não precisa ter uma impressora. Nos produtos com impressão disponível, você pode escolher o modelo impresso e receber a peça pronta.',
      proof: 'STL ou modelo impresso',
    },
    {
      eyebrow: 'QUER FLEXIBILIDADE',
      title: '“Posso comprar o STL agora e depois a peça?”',
      text:
        'Sim. O mesmo produto pode ser comprado como arquivo STL ou como modelo impresso. As duas modalidades têm preços separados no catálogo.',
      proof: 'Escolha a modalidade que faz sentido para você',
    },
    {
      eyebrow: 'PAGAMENTO',
      title: '“Como eu pago?”',
      text:
        'O checkout trabalha com PIX e mostra os dados para pagamento antes da confirmação. Depois que o pagamento é aprovado, o pedido avança automaticamente.',
      proof: 'PIX no checkout',
    },
    {
      eyebrow: 'MODELO IMPRESSO',
      title: '“E o frete da peça física?”',
      text:
        'Para modelos impressos, o checkout apresenta as opções de envio disponíveis. O frete gratuito usa Correios e o SEDEX 10 adiciona R$ 29,99.',
      proof: 'Frete mostrado antes de pagar',
    },
    {
      eyebrow: 'COMPRA DIGITAL',
      title: '“Vou precisar esperar para receber meu STL?”',
      text:
        'Não existe transportadora nem frete para o arquivo. Depois da confirmação, a entrega digital é preparada para o e-mail cadastrado no pedido.',
      proof: 'Sem frete para STL',
    },
    {
      eyebrow: 'COMECE AGORA',
      title: '“Quero só encontrar um modelo e comprar rápido.”',
      text:
        'É justamente essa a proposta da Forge3D: escolher o modelo, selecionar STL ou impresso, finalizar no PIX e acompanhar o pedido sem complicação.',
      proof: 'Compra simples e direta',
    },
  ];

  useEffect(() => {
    const carousel = carouselRef.current;

    if (!carousel) {
      return;
    }

    const timer = window.setInterval(() => {
      const nextIndex =
        (activeIndex + 1) % cards.length;

      const child = carousel.children.item(nextIndex) as HTMLElement | null;

      if (child) {
        child.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center',
        });
      }

      setActiveIndex(nextIndex);
    }, 5200);

    return () => window.clearInterval(timer);
  }, [activeIndex, cards.length]);

  function scrollTo(index: number) {
    const carousel = carouselRef.current;

    if (!carousel) {
      return;
    }

    const safeIndex =
      (index + cards.length) % cards.length;

    const child = carousel.children.item(safeIndex) as HTMLElement | null;

    if (!child) {
      return;
    }

    child.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    });

    setActiveIndex(safeIndex);
  }

  return (
    <>
      <section className="section reviews-section sales-objection-section">
        <div className="container">
          <div className="section-heading sales-objection-heading">
            <div>
              <span className="eyebrow">
                ANTES DE COMPRAR
              </span>

              <h2>As dúvidas que todo comprador tem.</h2>

              <p>
                A Forge3D foi pensada para deixar a compra simples,
                clara e sem surpresa no checkout.
              </p>
            </div>

            <div className="rating-summary">
              <Star size={18} fill="currentColor" />
              <strong>COMPRA DIRETA</strong>
              <span>
                Veja como funciona antes de finalizar
              </span>
            </div>
          </div>

          <div className="sales-objection-shell">
            <button
              type="button"
              className="sales-objection-arrow sales-objection-arrow-left"
              onClick={() => scrollTo(activeIndex - 1)}
              aria-label="Ver objeção anterior"
            >
              <ArrowLeft size={19} />
            </button>

            <div
              ref={carouselRef}
              className="sales-objection-carousel"
              onScroll={(event) => {
                const element = event.currentTarget;
                const first = element.children.item(0) as HTMLElement | null;

                if (!first) {
                  return;
                }

                const cardWidth = first.getBoundingClientRect().width;
                const gap = 16;
                const next = Math.round(
                  element.scrollLeft / Math.max(cardWidth + gap, 1),
                );

                setActiveIndex(
                  Math.min(Math.max(next, 0), cards.length - 1),
                );
              }}
            >
              {cards.map((card, index) => (
                <article
                  className={`sales-objection-card ${
                    index === activeIndex ? 'active' : ''
                  }`}
                  key={card.title}
                  aria-label={`Objeção ${index + 1}: ${card.title}`}
                >
                  <div className="sales-objection-stars" aria-hidden="true">
                    ★★★★★
                  </div>

                  <span className="sales-objection-eyebrow">
                    {card.eyebrow}
                  </span>

                  <h3>{card.title}</h3>

                  <p>{card.text}</p>

                  <div className="sales-objection-proof">
                    <ShieldCheck size={16} />
                    <span>{card.proof}</span>
                  </div>
                </article>
              ))}
            </div>

            <button
              type="button"
              className="sales-objection-arrow sales-objection-arrow-right"
              onClick={() => scrollTo(activeIndex + 1)}
              aria-label="Ver próxima objeção"
            >
              <ArrowRight size={19} />
            </button>
          </div>

          <div className="sales-objection-controls">
            <div className="sales-objection-dots" aria-label="Navegação do carrossel">
              {cards.map((card, index) => (
                <button
                  key={card.title}
                  type="button"
                  className={index === activeIndex ? 'active' : ''}
                  onClick={() => scrollTo(index)}
                  aria-label={`Ir para a opção ${index + 1}`}
                />
              ))}
            </div>

            <p>
              Escolha seu modelo, selecione a modalidade e finalize com PIX.
            </p>
          </div>

          <div className="sales-objection-cta">
            <div>
              <span className="eyebrow">
                PRONTO PARA COMEÇAR?
              </span>
              <strong>
                Escolha um modelo e veja o preço agora.
              </strong>
            </div>

            <Link to="/stl" className="btn btn-dark">
              EXPLORAR MODELOS
              <ArrowRight size={17} />
            </Link>
          </div>
        </div>
      </section>

      <style>{`
        .sales-objection-heading {
          align-items: end;
        }

        .sales-objection-heading p {
          max-width: 620px;
          margin-top: 10px;
        }

        .sales-objection-shell {
          position: relative;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .sales-objection-carousel {
          width: 100%;
          min-width: 0;
          display: flex;
          align-items: stretch;
          gap: 16px;
          overflow-x: auto;
          scroll-snap-type: x mandatory;
          overscroll-behavior-x: contain;
          scrollbar-width: none;
          padding: 8px 4px 14px;
          scroll-behavior: smooth;
        }

        .sales-objection-carousel::-webkit-scrollbar {
          display: none;
        }

        .sales-objection-card {
          flex: 0 0 calc((100% - 32px) / 3);
          min-width: 0;
          min-height: 300px;
          display: flex;
          flex-direction: column;
          padding: 28px 24px 22px;
          border: 1px solid var(--line);
          border-radius: 20px;
          background: #fff;
          scroll-snap-align: center;
          box-shadow: 0 10px 30px rgba(16, 16, 16, .06);
          transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease;
          box-sizing: border-box;
        }

        .sales-objection-card.active {
          border-color: rgba(255, 90, 31, .38);
          box-shadow: 0 20px 45px rgba(16, 16, 16, .10);
        }

        .sales-objection-card:hover {
          transform: translateY(-3px);
        }

        .sales-objection-stars {
          color: #ff9f00;
          font-size: 14px;
          letter-spacing: .12em;
          line-height: 1;
          margin-bottom: 18px;
        }

        .sales-objection-eyebrow {
          color: #ff5a1f;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: .14em;
          line-height: 1.3;
          text-transform: uppercase;
        }

        .sales-objection-card h3 {
          margin: 10px 0 12px;
          font-size: 22px;
          line-height: 1.1;
          letter-spacing: -.02em;
        }

        .sales-objection-card p {
          margin: 0;
          color: #6b6b65;
          font-size: 13px;
          line-height: 1.7;
        }

        .sales-objection-proof {
          margin-top: auto;
          padding-top: 18px;
          display: flex;
          align-items: center;
          gap: 8px;
          color: #111;
          font-size: 10px;
          font-weight: 800;
          line-height: 1.35;
        }

        .sales-objection-proof svg {
          color: #ff5a1f;
          flex: 0 0 auto;
        }

        .sales-objection-arrow {
          width: 44px;
          height: 44px;
          flex: 0 0 44px;
          display: grid;
          place-items: center;
          border: 1px solid var(--line);
          border-radius: 50%;
          background: #fff;
          color: #111;
          cursor: pointer;
          box-shadow: 0 8px 24px rgba(16, 16, 16, .08);
          transition: background .18s ease, color .18s ease, transform .18s ease;
        }

        .sales-objection-arrow:hover {
          background: #111;
          color: #fff;
          transform: scale(1.04);
        }

        .sales-objection-controls {
          margin-top: 4px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
        }

        .sales-objection-dots {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .sales-objection-dots button {
          width: 7px;
          height: 7px;
          padding: 0;
          border: 0;
          border-radius: 999px;
          background: #d4d4ce;
          cursor: pointer;
          transition: width .2s ease, background .2s ease;
        }

        .sales-objection-dots button.active {
          width: 24px;
          background: #ff5a1f;
        }

        .sales-objection-controls p {
          margin: 0;
          color: #8a8a84;
          font-size: 10px;
          text-align: right;
        }

        .sales-objection-cta {
          margin-top: 22px;
          padding: 18px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          border: 1px solid var(--line);
          border-radius: 18px;
          background: #f7f7f4;
        }

        .sales-objection-cta strong {
          display: block;
          margin-top: 4px;
          font-size: 17px;
          line-height: 1.15;
        }

        @media (max-width: 760px) {
          .sales-objection-heading {
            align-items: start;
          }

          .sales-objection-heading .rating-summary {
            display: none;
          }

          .sales-objection-shell {
            gap: 7px;
          }

          .sales-objection-arrow {
            width: 38px;
            height: 38px;
            flex-basis: 38px;
          }

          .sales-objection-carousel {
            gap: 12px;
          }

          .sales-objection-card {
            flex-basis: 88%;
          }

          .sales-objection-card {
            min-height: 315px;
            padding: 23px 19px 19px;
          }

          .sales-objection-card h3 {
            font-size: 20px;
          }

          .sales-objection-cta {
            flex-direction: column;
            align-items: stretch;
          }

          .sales-objection-cta .btn {
            width: 100%;
          }

          .sales-objection-controls {
            align-items: start;
            flex-direction: column;
            gap: 10px;
          }

          .sales-objection-controls p {
            text-align: left;
          }
        }

        @media (max-width: 390px) {
          .sales-objection-arrow {
            display: none;
          }

          .sales-objection-card {
            flex-basis: 94%;
            min-height: 300px;
          }
        }
      `}</style>
    </>
  );
}
