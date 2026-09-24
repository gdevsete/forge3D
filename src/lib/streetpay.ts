import { supabase } from './supabase';

export interface StreetPayCustomer {
  name: string;
  email: string;
  phone?: string;
  cpfCnpj?: string;
}

export interface StreetPayItem {
  productId: string;
  quantity: number;
  variantId?: string | null;
}

export interface StreetPayAttribution {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  fbclid?: string;
  referrer?: string;
  landing_page?: string;
}

export type StreetPayShippingMethod =
  | 'free'
  | 'sedex10';

export interface StreetPayDelivery {
  name: string;
  zip: string;
  address: string;
  number: string;
  city: string;
  state: string;
  country?: string;
  complement?: string;
  neighborhood?: string;
}

export interface CreateStreetPayPaymentInput {
  items: StreetPayItem[];

  customer: StreetPayCustomer;

  attribution?: StreetPayAttribution;

  /*
   * Modalidade escolhida pelo cliente.
   *
   * free:
   *   Correios — Frete Grátis
   *
   * sedex10:
   *   Correios — SEDEX 10
   */
  shippingMethod?: StreetPayShippingMethod;

  /*
   * Prazo exato apresentado ao cliente.
   *
   * Exemplo:
   *   5 para Frete Grátis
   *   2 para SEDEX 10
   *
   * O backend continuará sendo responsável
   * por validar esse valor.
   */
  shippingDays?: number;

  delivery?: StreetPayDelivery;
}

export interface StreetPayPaymentResult {
  status:
    | 'pending'
    | 'processing'
    | 'paid'
    | 'refused'
    | 'refunded'
    | 'med'
    | 'chargedback'
    | 'error';

  orderId?: string;
  paymentId?: string;
  externalRef?: string;

  amount?: number;
  currency?: string;

  qrCode?: string;
  copyPaste?: string;
  checkoutUrl?: string;
  expiresAt?: string;

  message?: string;
  raw?: unknown;
}

export async function createStreetPayPayment(
  input: CreateStreetPayPaymentInput
): Promise<StreetPayPaymentResult> {
  if (
    !Array.isArray(input.items) ||
    input.items.length === 0
  ) {
    throw new Error(
      'STREETPAY_EMPTY_ITEMS'
    );
  }

  if (
    !input.customer.name ||
    !input.customer.email
  ) {
    throw new Error(
      'STREETPAY_INVALID_CUSTOMER'
    );
  }

  if (
    input.shippingMethod &&
    input.shippingMethod !== 'free' &&
    input.shippingMethod !== 'sedex10'
  ) {
    throw new Error(
      'STREETPAY_INVALID_SHIPPING_METHOD'
    );
  }

  if (
    input.shippingDays !== undefined &&
    (
      !Number.isInteger(
        input.shippingDays
      ) ||
      input.shippingDays <= 0
    )
  ) {
    throw new Error(
      'STREETPAY_INVALID_SHIPPING_DAYS'
    );
  }

  if (
    input.shippingMethod === 'free' &&
    input.shippingDays !== undefined &&
    input.shippingDays !== 5
  ) {
    throw new Error(
      'STREETPAY_INVALID_FREE_SHIPPING_DAYS'
    );
  }

  if (
    input.shippingMethod === 'sedex10' &&
    input.shippingDays !== undefined &&
    input.shippingDays !== 2
  ) {
    throw new Error(
      'STREETPAY_INVALID_SEDEX10_SHIPPING_DAYS'
    );
  }

  const {
    data,
    error,
  } = await supabase.functions.invoke(
    'streetpay-create-payment',
    {
      body: {
        items:
          input.items,

        customer:
          input.customer,

        attribution:
          input.attribution,

        shippingMethod:
          input.shippingMethod,

        shippingDays:
          input.shippingDays,

        delivery:
          input.delivery,
      },
    }
  );

  if (error) {
    console.error(
      '[StreetPay] Edge Function error:',
      error
    );

    throw new Error(
      error.message ||
        'STREETPAY_REQUEST_FAILED'
    );
  }

  if (!data) {
    throw new Error(
      'STREETPAY_EMPTY_RESPONSE'
    );
  }

  if (data.error) {
    throw new Error(
      String(
        data.error
      )
    );
  }

  return {
    status:
      data.status ??
      'error',

    orderId:
      data.orderId,

    paymentId:
      data.paymentId,

    externalRef:
      data.externalRef,

    amount:
      data.amount,

    currency:
      data.currency,

    qrCode:
      data.qrCode,

    copyPaste:
      data.copyPaste,

    checkoutUrl:
      data.checkoutUrl,

    expiresAt:
      data.expiresAt,

    message:
      data.message,

    raw:
      data.raw,
  };
}