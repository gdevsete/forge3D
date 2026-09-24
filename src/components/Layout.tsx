import { useState, type FormEvent, type ChangeEvent } from 'react';

import {

  Link,

  NavLink,

  Outlet,

  useNavigate,

} from 'react-router-dom';

import {

  Search,

  Heart,

  ShoppingBag,

  Menu,

  X,

  ArrowRight,

  Trash2,

} from 'lucide-react';

import { trackCustom } from '../lib/analytics';

import type {
  CartItem,
  PurchaseType,
} from '../lib/cart';
import { getCartItemPrice } from '../lib/cart';



interface LayoutProps {

  cartCount: number;

  cartItems: CartItem[];

  cartOpen: boolean;

  onCloseCart: () => void;

  onRemoveFromCart: (
    id: string,
    purchaseType?: PurchaseType,
  ) => void;

}



export function Layout({

  cartCount,

  cartItems,

  cartOpen,

  onCloseCart,

  onRemoveFromCart,

}: LayoutProps) {

  const [mobileOpen, setMobileOpen] = useState(false);

  const [search, setSearch] = useState('');



  const navigate = useNavigate();



const cartTotal = cartItems.reduce(
  (sum, item) =>
    sum +
    getCartItemPrice(item) * item.quantity,
  0,
);


  function formatCurrency(value: number) {

    return value.toLocaleString('pt-BR', {

      style: 'currency',

      currency: 'BRL',

    });

  }



  function submitSearch(e: FormEvent) {

    e.preventDefault();



    const q = search.trim();



    if (!q) return;



    trackCustom('Search', {

      search_string: q,

    });



    navigate(`/stl?search=${encodeURIComponent(q)}`);



    setMobileOpen(false);

  }



  function handleCheckout() {

    onCloseCart();



    navigate('/checkout');

  }



  function handleContinueShopping() {

    onCloseCart();



    navigate('/stl');

  }



  return (

    <div className="site-shell">

      <div className="announcement">

        FRETE GRÁTIS EM PEDIDOS FÍSICOS SELECIONADOS

        <span>•</span>

        COMPRA SEGURA

        <span>•</span>

        SUPORTE FORGE3D

      </div>



      <header className="header">

        <div className="header-inner">

          <button

            className="mobile-menu"

            onClick={() => setMobileOpen(true)}

            aria-label="Abrir menu"

          >

            <Menu size={23} />

          </button>



          <Link

            to="/"

            className="brand"

            aria-label="Forge3D início"

          >

            <span className="brand-mark">

              <i></i>

              <b></b>

            </span>



            <span>

              FORGE<span>3D</span>

            </span>

          </Link>



          <nav className="desktop-nav">

            <NavLink to="/stl">

              ARQUIVOS STL

            </NavLink>



            <NavLink to="/impressao-3d">

              IMPRESSÃO 3D

            </NavLink>



            <NavLink to="/stl">

              CATEGORIAS

            </NavLink>



            <NavLink to="/sobre">

              SOBRE

            </NavLink>

          </nav>



          <div className="header-actions">

            <form

              className="search-desktop"

              onSubmit={submitSearch}

            >

              <Search size={18} />



              <input

                value={search}

                onChange={(

                  e: ChangeEvent<HTMLInputElement>,

                ) => setSearch(e.target.value)}

                placeholder="Buscar modelos..."

                aria-label="Buscar modelos"

              />

            </form>



            <button

              aria-label="Favoritos"

              className="icon-btn"

              type="button"

            >

              <Heart size={20} />

            </button>



            <button

              type="button"

              className="cart-btn"

              aria-label="Abrir carrinho"

              onClick={() => {

                if (cartCount > 0) {

                  // O estado do carrinho é controlado pelo App.

                  // O evento é disparado pelo botão no componente pai.

                  window.dispatchEvent(

                    new CustomEvent('forge3d:open-cart'),

                  );

                } else {

                  navigate('/carrinho');

                }

              }}

            >

              <ShoppingBag size={20} />



              <span>{cartCount}</span>

            </button>

          </div>

        </div>



        <form

          className="search-mobile"

          onSubmit={submitSearch}

        >

          <Search size={18} />



          <input

            value={search}

            onChange={(

              e: ChangeEvent<HTMLInputElement>,

            ) => setSearch(e.target.value)}

            placeholder="O que você quer imprimir?"

            aria-label="Buscar modelos"

          />

        </form>

      </header>



      {mobileOpen && (

        <div

          className="mobile-drawer-backdrop"

          onClick={() => setMobileOpen(false)}

        >

          <aside

            className="mobile-drawer"

            onClick={(e) => e.stopPropagation()}

          >

            <div className="drawer-top">

              <Link

                to="/"

                className="brand"

                onClick={() => setMobileOpen(false)}

              >

                <span className="brand-mark">

                  <i></i>

                  <b></b>

                </span>



                <span>

                  FORGE<span>3D</span>

                </span>

              </Link>



              <button

                onClick={() => setMobileOpen(false)}

                aria-label="Fechar menu"

                type="button"

              >

                <X size={23} />

              </button>

            </div>



            <nav>

              <Link

                to="/stl"

                onClick={() => setMobileOpen(false)}

              >

                ARQUIVOS STL

                <ArrowRight size={17} />

              </Link>



              <Link

                to="/impressao-3d"

                onClick={() => setMobileOpen(false)}

              >

                IMPRESSÃO 3D

                <ArrowRight size={17} />

              </Link>



              <Link

                to="/stl"

                onClick={() => setMobileOpen(false)}

              >

                CATEGORIAS

                <ArrowRight size={17} />

              </Link>



              <Link

                to="/sobre"

                onClick={() => setMobileOpen(false)}

              >

                SOBRE A FORGE3D

                <ArrowRight size={17} />

              </Link>

            </nav>



            <div className="drawer-cta">

              <strong>Tem uma ideia?</strong>

              <span>Nós podemos produzir.</span>



              <Link

                to="/impressao-3d"

                onClick={() => setMobileOpen(false)}

              >

                VER IMPRESSÃO 3D

              </Link>

            </div>

          </aside>

        </div>

      )}



      <main>

        <Outlet />

      </main>



      <footer className="footer">

        <div className="container footer-grid">

          <div>

            <Link

              to="/"

              className="brand brand-footer"

            >

              <span className="brand-mark">

                <i></i>

                <b></b>

              </span>



              <span>

                FORGE<span>3D</span>

              </span>

            </Link>



            <p>

              Arquivos STL e impressão 3D sob demanda.

            </p>

          </div>



          <div>

            <h4>COMPRAR</h4>

            <Link to="/stl">Arquivos STL</Link>

            <Link to="/impressao-3d">

              Impressão 3D

            </Link>

            <Link to="/stl">Mais vendidos</Link>

          </div>



          <div>

            <h4>ATENDIMENTO</h4>

            <Link to="/sobre">Sobre a Forge3D</Link>



            <a href="mailto:contato@forge3d.com.br">

              Contato

            </a>



            <a

              href="https://wa.me/5500000000000"

              target="_blank"

              rel="noreferrer"

            >

              WhatsApp

            </a>

          </div>



          <div>

            <h4>SEGURANÇA</h4>

            <span>Compra segura</span>

            <span>Arquivos protegidos</span>

            <span>Suporte ao cliente</span>

          </div>

        </div>



        <div className="footer-bottom container">

          <span>

            © {new Date().getFullYear()} Forge3D.

            Todos os direitos reservados.

          </span>



          <span>IDEIAS GANHAM FORMA.</span>

        </div>

      </footer>



      {/* =====================================================

          CARRINHO LATERAL

          ===================================================== */}



      {cartOpen && (

        <div

          className="cart-drawer-backdrop"

          onClick={onCloseCart}

        >

          <aside

            className="cart-drawer"

            onClick={(e) => e.stopPropagation()}

            aria-label="Carrinho de compras"

          >

            <div className="cart-drawer-header">

              <div>

                <span className="cart-drawer-eyebrow">

                  SEU PEDIDO

                </span>



                <h2>

                  Seu carrinho

                </h2>

              </div>



              <button

                type="button"

                onClick={onCloseCart}

                aria-label="Fechar carrinho"

                className="cart-drawer-close"

              >

                <X size={22} />

              </button>

            </div>



            <div className="cart-drawer-content">

              {cartItems.length === 0 ? (

                <div className="cart-drawer-empty">

                  <ShoppingBag size={40} />



                  <h3>

                    Seu carrinho está vazio.

                  </h3>



                  <p>

                    Encontre um modelo para começar

                    seu próximo projeto.

                  </p>



                  <button

                    type="button"

                    className="btn btn-dark"

                    onClick={handleContinueShopping}

                  >

                    EXPLORAR STL

                    <ArrowRight size={17} />

                  </button>

                </div>

              ) : (

                <>

                  <div className="cart-drawer-items">

                    {cartItems.map((item) => {
                      const product = item.product;
                      const itemPrice = getCartItemPrice(item);
                      const purchaseLabel =
                        item.purchaseType === 'stl'
                          ? 'ARQUIVO STL'
                          : 'MODELO IMPRESSO';

                      return (
                        <article
                          className="cart-drawer-item"
                          key={`${product.id}-${item.purchaseType}`}
                        >
                          <img
                            src={product.image}
                            alt={product.name}
                          />

                          <div className="cart-drawer-item-info">
                            <span>{purchaseLabel}</span>

                            <h3>{product.name}</h3>

                            <strong>
                              {formatCurrency(
                                itemPrice * item.quantity,
                              )}
                            </strong>

                            <small>Quantidade: {item.quantity}</small>
                          </div>

                          <button
                            type="button"
                            className="cart-drawer-remove"
                            onClick={() =>
                              onRemoveFromCart(
                                product.id,
                                item.purchaseType,
                              )
                            }
                            aria-label={`Remover ${product.name} - ${purchaseLabel}`}
                          >
                            <Trash2 size={17} />
                          </button>
                        </article>
                      );
                    })}

                  </div>



                  <div className="cart-drawer-question">

                    <h3>

                      Deseja continuar?

                    </h3>



                    <p>

                      Você pode finalizar sua compra

                      agora ou escolher outros modelos

                      STL.

                    </p>

                  </div>

                </>

              )}

            </div>



            {cartItems.length > 0 && (

              <div className="cart-drawer-footer">

                <div className="cart-drawer-total">

                  <span>

                    Total

                  </span>



                  <strong>

                    {formatCurrency(cartTotal)}

                  </strong>

                </div>



                <button

                  type="button"

                  className="cart-drawer-checkout"

                  onClick={handleCheckout}

                >

                  FINALIZAR COMPRA

                  <ArrowRight size={18} />

                </button>



                <button

                  type="button"

                  className="cart-drawer-continue"

                  onClick={handleContinueShopping}

                >

                  CONTINUAR ESCOLHENDO STL

                </button>



                <small className="cart-drawer-secure">

                  🔒 Compra segura. Seus dados são protegidos.

                </small>

              </div>

            )}

          </aside>

        </div>

      )}

    </div>

  );

}
