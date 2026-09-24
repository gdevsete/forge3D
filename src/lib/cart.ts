import type { Product } from './catalog';

export type PurchaseType = 'stl' | 'physical';

export interface CartItem {
  product: Product;
  quantity: number;

  /**
   * Identifica como o cliente está comprando o produto.
   *
   * O mesmo produto pode ser comprado:
   * - como arquivo STL
   * - como modelo impresso
   *
   * Isso é separado de product.type porque o produto cadastrado
   * no catálogo representa o modelo base.
   */
  purchaseType: PurchaseType;

  /**
   * Reservado para quando as variantes forem carregadas do catálogo.
   * O backend já aceita esse identificador ao criar o pagamento.
   */
  variantId?: string | null;
}

export function getCartQuantity(items: CartItem[]) {
  return items.reduce(
    (total, item) => total + item.quantity,
    0,
  );
}

export function getCartItemPrice(item: CartItem): number {
  return item.purchaseType === 'stl'
    ? item.product.stlPrice
    : item.product.printedPrice;
}

export function getCartTotal(items: CartItem[]) {
  return items.reduce(
    (total, item) =>
      total +
      getCartItemPrice(item) * item.quantity,
    0,
  );
}
