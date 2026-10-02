import {
  supabase,
} from './supabase';

type PurchaseType =
  | 'stl'
  | 'physical';

type ShippingMethod =
  | 'free'
  | 'sedex10';

export interface PurinCashPaymentItem {
  productId: string;
  quantity: number;
  purchaseType: PurchaseType;
  variantId?: string | null;
}

export interface PurinCashCustomer {
  name: string;
  email: string;
  phone?: string;
  cpfCnpj?: string;
}

export interface PurinCashAttribution {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  fbclid?: string;
  referrer?: string;
  landing_page?: string;
}

export interface PurinCashDelivery {
  name?: string;
  zip?: string;
  address?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  country?: string;
}

export interface CreatePurinCashPaymentInput {
  items: PurinCashPaymentItem[];
  customer: PurinCashCustomer;
  attribution?: PurinCashAttribution;
  shipping?: number;
  shippingMethod?: ShippingMethod;
  shippingDays?: number;
  discount?: number;
  delivery?: PurinCashDelivery;
}

export interface PurinCashPaymentResult {
  status: string;
  orderId?: string;
  paymentId?: string;
  externalRef?: string;
  qrCode?: string;
  copyPaste?: string;
  checkoutUrl?: string;
  expiresAt?: string;
  amount?: number;
  currency?: string;
  shipping?: number;
  shippingMethod?: ShippingMethod | null;
  shippingDays?: number | null;
  shippingCarrier?: string | null;
}

function asRecord(
  value: unknown,
): Record<string, unknown> | null {
  if (
    typeof value !== 'object' ||
    value === null
  ) {
    return null;
  }

  return value as Record<string, unknown>;
}

function asOptionalString(
  value: unknown,
): string | undefined {
  return typeof value === 'string'
    ? value
    : undefined;
}

function asOptionalNumber(
  value: unknown,
): number | undefined {
  const numberValue = Number(value);

  return Number.isFinite(numberValue)
    ? numberValue
    : undefined;
}

export async function createPurinCashPayment(
  input: CreatePurinCashPaymentInput,
): Promise<PurinCashPaymentResult> {
  const {
    data,
    error,
  } = await supabase.functions.invoke(
    'purincash-create-payment',
    {
      body: input,
    },
  );

  if (error) {
    const response = (
      error as unknown as {
        context?: Response;
      }
    ).context;

    if (response) {
      try {
        const body =
          (await response.clone().json()) as unknown;
        const parsed =
          asRecord(body);
        const backendError =
          asOptionalString(
            parsed?.error,
          );

        if (backendError) {
          throw new Error(
            backendError,
          );
        }
      } catch (contextError) {
        if (
          contextError instanceof Error &&
          contextError.message &&
          contextError.message !==
            'Unexpected end of JSON input'
        ) {
          throw contextError;
        }
      }
    }

    throw new Error(
      error.message ||
        'PURINCASH_CREATE_PAYMENT_FAILED',
    );
  }

  const payload =
    asRecord(data);

  if (!payload) {
    throw new Error(
      'PURINCASH_EMPTY_RESPONSE',
    );
  }

  const backendError =
    asOptionalString(
      payload.error,
    );

  if (backendError) {
    throw new Error(
      backendError,
    );
  }

  const status =
    asOptionalString(
      payload.status,
    );

  if (!status) {
    throw new Error(
      'PURINCASH_INVALID_RESPONSE',
    );
  }

  return {
    status,
    orderId:
      asOptionalString(
        payload.orderId,
      ),
    paymentId:
      asOptionalString(
        payload.paymentId,
      ),
    externalRef:
      asOptionalString(
        payload.externalRef,
      ),
    qrCode:
      asOptionalString(
        payload.qrCode,
      ),
    copyPaste:
      asOptionalString(
        payload.copyPaste,
      ),
    checkoutUrl:
      asOptionalString(
        payload.checkoutUrl,
      ),
    expiresAt:
      asOptionalString(
        payload.expiresAt,
      ),
    amount:
      asOptionalNumber(
        payload.amount,
      ),
    currency:
      asOptionalString(
        payload.currency,
      ),
    shipping:
      asOptionalNumber(
        payload.shipping,
      ),
    shippingMethod:
      payload.shippingMethod ===
        'free' ||
      payload.shippingMethod ===
        'sedex10'
        ? payload.shippingMethod
        : null,
    shippingDays:
      asOptionalNumber(
        payload.shippingDays,
      ) ?? null,
    shippingCarrier:
      asOptionalString(
        payload.shippingCarrier,
      ) ?? null,
  };
}
