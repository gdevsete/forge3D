import React, { useEffect, useState } from 'react';
import {
  createRoot,
} from 'react-dom/client';
import {
  BrowserRouter,
  Routes,
  Route,
  useLocation,
} from 'react-router-dom';

import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Catalog } from './pages/Catalog';
import { Product as ProductPage } from './pages/Product';
import { Cart } from './pages/Cart';
import { Checkout } from './pages/Checkout';
import { About } from './pages/About';
import { Success } from './pages/Success';
import { AdminGate } from './pages/Admin';

import {
  initMetaPixel,
  setupGlobalInteractionTracking,
  setupFormInteractionTracking,
  setupScrollTracking,
  trackPageView,
  getAttribution,
} from './lib/analytics';

import {
  getCartQuantity,
  type CartItem,
  type PurchaseType,
} from './lib/cart';

import type { Product } from './lib/catalog';

import './styles.css';

function Analytics() {
  const location = useLocation();

  useEffect(() => {
    getAttribution();

    const pixelId =
      import.meta.env.VITE_META_PIXEL_ID || '';

    initMetaPixel(pixelId);

    const cleanupGlobal =
      setupGlobalInteractionTracking();

    const cleanupForms =
      setupFormInteractionTracking();

    const cleanupScroll =
      setupScrollTracking();

    return () => {
      cleanupGlobal();
      cleanupForms();
      cleanupScroll();
    };
  }, []);

  useEffect(() => {
    trackPageView(
      location.pathname + location.search,
    );
  }, [
    location.pathname,
    location.search,
  ]);

  return null;
}

function App() {
  const [items, setItems] =
    useState<CartItem[]>([]);

  const [cartOpen, setCartOpen] =
    useState(false);

  function add(
    product: Product,
    quantity = 1,
    purchaseType: PurchaseType = product.type,
  ) {
    const safeQuantity = Math.max(
      1,
      Math.min(quantity, 100),
    );

    setItems((current) => {
      const existing = current.find(
        (item) =>
          item.product.id === product.id &&
          item.purchaseType === purchaseType,
      );

      if (!existing) {
        return [
          ...current,
          {
            product,
            quantity: safeQuantity,
            purchaseType,
            variantId: null,
          },
        ];
      }

      return current.map((item) => {
        if (
          item.product.id !== product.id ||
          item.purchaseType !== purchaseType
        ) {
          return item;
        }

        return {
          ...item,
          quantity: Math.min(
            100,
            item.quantity + safeQuantity,
          ),
        };
      });
    });

    setCartOpen(true);
  }

  function remove(
    productId: string,
    purchaseType?: PurchaseType,
  ) {
    setItems((current) =>
      current.filter((item) => {
        if (item.product.id !== productId) {
          return true;
        }

        if (!purchaseType) {
          return false;
        }

        return item.purchaseType !== purchaseType;
      }),
    );
  }

  function changeQuantity(
    productId: string,
    quantity: number,
    purchaseType?: PurchaseType,
  ) {
    if (quantity <= 0) {
      remove(productId, purchaseType);
      return;
    }

    setItems((current) =>
      current.map((item) => {
        const matches =
          item.product.id === productId &&
          (!purchaseType ||
            item.purchaseType === purchaseType);

        if (!matches) {
          return item;
        }

        return {
          ...item,
          quantity: Math.min(
            quantity,
            100,
          ),
        };
      }),
    );
  }

  useEffect(() => {
    function openCart() {
      setCartOpen(true);
    }

    window.addEventListener(
      'forge3d:open-cart',
      openCart,
    );

    return () => {
      window.removeEventListener(
        'forge3d:open-cart',
        openCart,
      );
    };
  }, []);

  return (
    <>
      <Analytics />

      <Routes>
        <Route
          path="/admin"
          element={<AdminGate />}
        />

        <Route
          element={
            <Layout
              cartCount={getCartQuantity(items)}
              cartItems={items}
              cartOpen={cartOpen}
              onCloseCart={() =>
                setCartOpen(false)
              }
              onRemoveFromCart={remove}
            />
          }
        >
          <Route
            path="/"
            element={
              <Home
                onAdd={add}
              />
            }
          />

          <Route
            path="/stl"
            element={
              <Catalog
                type="stl"
                onAdd={add}
              />
            }
          />

          <Route
            path="/impressao-3d"
            element={
              <Catalog
                type="physical"
                onAdd={add}
              />
            }
          />

          <Route
            path="/produto/:slug"
            element={
              <ProductPage
                onAdd={add}
              />
            }
          />

          <Route
            path="/carrinho"
            element={
              <Cart
                items={items}
                onRemove={remove}
                onAdd={add}
                onChangeQuantity={
                  changeQuantity
                }
              />
            }
          />

          <Route
            path="/checkout"
            element={
              <Checkout
                items={items}
              />
            }
          />

          <Route
            path="/sobre"
            element={
              <About />
            }
          />

          <Route
            path="/sucesso"
            element={
              <Success />
            }
          />
        </Route>
      </Routes>
    </>
  );
}

createRoot(
  document.getElementById('root')!,
).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
