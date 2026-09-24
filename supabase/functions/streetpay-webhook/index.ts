import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type StreetPayStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'PAID'
  | 'REFUSED'
  | 'REFUNDED'
  | 'MED'
  | 'CHARGEDBACK';

interface StreetPayWebhookPayload {
  id?: string;
  amount?: number;
  method?: string;
  currency?: string;
  status?: string;
  description?: string;
  externalRef?: string;
  notificationUrl?: string;
  metadata?: Record<string, unknown>;
  paidAt?: string | null;
  createdAt?: string;
  updatedAt?: string;

  payer?: {
    name?: string;
    taxId?: string;
    email?: string;
    phone?: string;
  };

  data?: {
    method?: string;
    copypaste?: string;
    copyPaste?: string;
    copy_paste?: string;
    e2e?: string;
    qrCode?: string;
    qr_code?: string;
  };

  items?: Array<{
    quantity?: number;
    name?: string;
    price?: number;
    type?: string;
  }>;

  delivery?: Record<string, unknown>;

  [key: string]: unknown;
}

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
): Response {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    },
  );
}

function normalizeStatus(
  status: unknown,
): StreetPayStatus | null {
  if (typeof status !== 'string') {
    return null;
  }

  const normalized = status
    .trim()
    .toUpperCase();

  const allowed: StreetPayStatus[] = [
    'PENDING',
    'PROCESSING',
    'PAID',
    'REFUSED',
    'REFUNDED',
    'MED',
    'CHARGEDBACK',
  ];

  if (
    allowed.includes(
      normalized as StreetPayStatus,
    )
  ) {
    return normalized as StreetPayStatus;
  }

  return null;
}

function isPaidStatus(
  status: StreetPayStatus | null,
): boolean {
  return status === 'PAID';
}

function isFinalNegativeStatus(
  status: StreetPayStatus | null,
): boolean {
  return (
    status === 'REFUSED' ||
    status === 'REFUNDED' ||
    status === 'MED' ||
    status === 'CHARGEDBACK'
  );
}

function getExternalReference(
  payload: StreetPayWebhookPayload,
): string {
  if (
    typeof payload.externalRef === 'string' &&
    payload.externalRef.trim()
  ) {
    return payload.externalRef.trim();
  }

  if (
    payload.metadata &&
    typeof payload.metadata.orderId === 'string'
  ) {
    return payload.metadata.orderId;
  }

  if (
    payload.metadata &&
    typeof payload.metadata.externalRef === 'string'
  ) {
    return payload.metadata.externalRef;
  }

  return '';
}

function normalizeAmountFromStreetPay(
  amount: unknown,
): number | null {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    return null;
  }

  /*
   * A StreetPay envia o valor monetário em centavos.
   * Ex.: R$ 5,00 => 500.
   * Internamente, a Forge3D armazena valores em reais.
   */
  return Math.round(amount) / 100;
}

function getCopyPaste(
  payload: StreetPayWebhookPayload,
): string {
  return (
    payload.data?.copypaste ||
    payload.data?.copyPaste ||
    payload.data?.copy_paste ||
    ''
  );
}

function getQrCode(
  payload: StreetPayWebhookPayload,
): string {
  return (
    payload.data?.qrCode ||
    payload.data?.qr_code ||
    ''
  );
}

function timingSafeEqual(
  a: Uint8Array,
  b: Uint8Array,
): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;

  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }

  return result === 0;
}

async function generateHmacSha256(
  body: string,
  secret: string,
): Promise<string> {
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    {
      name: 'HMAC',
      hash: 'SHA-256',
    },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(body),
  );

  const bytes = new Uint8Array(signature);

  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

async function validateSignature(
  rawBody: string,
  signature: string | null,
): Promise<{
  valid: boolean;
  checked: boolean;
}> {
  const webhookSecret =
    Deno.env.get(
      'STREETPAY_WEBHOOK_SECRET',
    ) || '';

  /*
   * Enquanto o segredo do webhook ainda não estiver
   * configurado, aceitamos o evento.
   *
   * Assim que STREETPAY_WEBHOOK_SECRET existir,
   * a assinatura X-Signature passa a ser obrigatória.
   */
  if (!webhookSecret) {
    return {
      valid: true,
      checked: false,
    };
  }

  if (!signature) {
    return {
      valid: false,
      checked: true,
    };
  }

  const expected =
    await generateHmacSha256(
      rawBody,
      webhookSecret,
    );

  const expectedBytes =
    new TextEncoder().encode(expected);

  const receivedBytes =
    new TextEncoder().encode(
      signature.trim(),
    );

  return {
    valid: timingSafeEqual(
      expectedBytes,
      receivedBytes,
    ),
    checked: true,
  };
}

Deno.serve(async (req: Request) => {
  /*
   * CORS preflight
   */
  if (req.method === 'OPTIONS') {
    return new Response(
      'ok',
      {
        status: 200,
        headers: corsHeaders,
      },
    );
  }

  /*
   * Webhook deve receber POST.
   */
  if (req.method !== 'POST') {
    return jsonResponse(
      {
        error: 'METHOD_NOT_ALLOWED',
        message: 'Use POST.',
      },
      405,
    );
  }

  try {
    /*
     * Precisamos do corpo bruto para validar
     * X-Signature corretamente.
     */
    const rawBody =
      await req.text();

    if (!rawBody) {
      return jsonResponse(
        {
          error: 'EMPTY_BODY',
          message:
            'Webhook body is empty.',
        },
        400,
      );
    }

    /*
     * Validação da assinatura.
     */
    const signature =
      req.headers.get(
        'x-signature',
      );

    const signatureResult =
      await validateSignature(
        rawBody,
        signature,
      );

    if (!signatureResult.valid) {
      console.error(
        'Invalid StreetPay webhook signature.',
      );

      return jsonResponse(
        {
          error:
            'INVALID_SIGNATURE',
        },
        401,
      );
    }

    /*
     * Parse do JSON enviado pela StreetPay.
     */
    let payload:
      StreetPayWebhookPayload;

    try {
      payload = JSON.parse(
        rawBody,
      );
    } catch {
      return jsonResponse(
        {
          error: 'INVALID_JSON',
          message:
            'Webhook body is not valid JSON.',
        },
        400,
      );
    }

    console.log(
      'StreetPay webhook received:',
      JSON.stringify({
        id: payload.id || null,
        status:
          payload.status || null,
        externalRef:
          payload.externalRef ||
          null,
        amount:
          payload.amount || null,
        currency:
          payload.currency ||
          null,
      }),
    );

    /*
     * Normaliza o status.
     */
    const status =
      normalizeStatus(
        payload.status,
      );

    if (!status) {
      console.error(
        'Unknown StreetPay status:',
        payload.status,
      );

      return jsonResponse(
        {
          error:
            'UNKNOWN_STATUS',
          status:
            payload.status ||
            null,
        },
        400,
      );
    }

    /*
     * Precisamos do externalRef para
     * localizar nosso pedido.
     */
    const externalReference =
      getExternalReference(
        payload,
      );

    if (!externalReference) {
      console.error(
        'StreetPay webhook without externalRef.',
      );

      return jsonResponse(
        {
          error:
            'MISSING_EXTERNAL_REFERENCE',
        },
        400,
      );
    }

    /*
     * Credenciais fornecidas automaticamente
     * pelo Supabase para a Edge Function.
     */
    const supabaseUrl =
      Deno.env.get(
        'SUPABASE_URL',
      );

    const serviceRoleKey =
      Deno.env.get(
        'SUPABASE_SERVICE_ROLE_KEY',
      );

    if (
      !supabaseUrl ||
      !serviceRoleKey
    ) {
      console.error(
        'Supabase environment variables are missing.',
      );

      return jsonResponse(
        {
          error:
            'SUPABASE_NOT_CONFIGURED',
        },
        500,
      );
    }

    const supabase =
      createClient(
        supabaseUrl,
        serviceRoleKey,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        },
      );

    /*
     * Primeiro tentamos localizar o pagamento
     * através do external_reference.
     */
    const {
      data: paymentByReference,
      error:
        paymentLookupError,
    } = await supabase
      .from('payments')
      .select(
        `
          id,
          order_id,
          external_payment_id,
          external_reference,
          status,
          amount,
          payment_method,
          paid_at
        `,
      )
      .eq(
        'external_reference',
        externalReference,
      )
      .maybeSingle();

    if (paymentLookupError) {
      console.error(
        'Payment lookup error:',
        paymentLookupError,
      );

      return jsonResponse(
        {
          error:
            'PAYMENT_LOOKUP_FAILED',
          message:
            paymentLookupError.message,
        },
        500,
      );
    }

    let payment =
      paymentByReference;

    /*
     * Fallback:
     * procura pelo ID da transação da StreetPay.
     */
    if (
      !payment &&
      payload.id &&
      typeof payload.id === 'string'
    ) {
      const {
        data:
          paymentByExternalId,
        error:
          paymentExternalIdError,
      } = await supabase
        .from('payments')
        .select(
          `
            id,
            order_id,
            external_payment_id,
            external_reference,
            status,
            amount,
            payment_method,
            paid_at
          `,
        )
        .eq(
          'external_payment_id',
          payload.id,
        )
        .maybeSingle();

      if (paymentExternalIdError) {
        console.error(
          'Payment external ID lookup error:',
          paymentExternalIdError,
        );

        return jsonResponse(
          {
            error:
              'PAYMENT_LOOKUP_FAILED',
            message:
              paymentExternalIdError.message,
          },
          500,
        );
      }

      payment =
        paymentByExternalId;
    }

    /*
     * Pedido/pagamento não encontrado.
     */
    if (!payment) {
      console.error(
        'Payment not found:',
        externalReference,
      );

      /*
       * Respondemos 200 para evitar uma cadeia
       * infinita de reenvios do webhook.
       */
      return jsonResponse(
        {
          received: true,
          processed: false,
          reason:
            'PAYMENT_NOT_FOUND',
          externalRef:
            externalReference,
          streetPayPaymentId:
            payload.id || null,
        },
        200,
      );
    }

    /*
     * Idempotência.
     *
     * Se o mesmo PAID chegar novamente,
     * não consideramos uma nova compra.
     */
    const currentPaymentStatus =
      typeof payment.status === 'string'
        ? payment.status.toUpperCase()
        : '';

    const alreadyPaid =
      currentPaymentStatus ===
        'PAID' &&
      isPaidStatus(status);

    /*
     * Atualização do pagamento.
     */
    const paymentUpdate:
      Record<string, unknown> =
      {
        status,
        raw_response:
          payload,
      };

    if (
      payload.id &&
      typeof payload.id === 'string'
    ) {
      paymentUpdate.external_payment_id =
        payload.id;
    }

    paymentUpdate.external_reference =
      externalReference;

    const normalizedAmount =
      normalizeAmountFromStreetPay(
        payload.amount,
      );

    if (normalizedAmount !== null) {
      paymentUpdate.amount =
        normalizedAmount;
    }

    if (
      typeof payload.method ===
      'string'
    ) {
      paymentUpdate.payment_method =
        payload.method;
    }

    if (
      isPaidStatus(status)
    ) {
      paymentUpdate.paid_at =
        payload.paidAt ||
        new Date().toISOString();
    }

    const {
      error:
        paymentUpdateError,
    } = await supabase
      .from('payments')
      .update(
        paymentUpdate,
      )
      .eq(
        'id',
        payment.id,
      );

    if (paymentUpdateError) {
      console.error(
        'Payment update error:',
        paymentUpdateError,
      );

      return jsonResponse(
        {
          error:
            'PAYMENT_UPDATE_FAILED',
          message:
            paymentUpdateError.message,
        },
        500,
      );
    }

    /*
     * Atualização do pedido.
     */
    const orderUpdate:
      Record<string, unknown> =
      {
        payment_status:
          isPaidStatus(status)
            ? 'paid'
            : status.toLowerCase(),
      };

    if (
      isPaidStatus(status)
    ) {
      orderUpdate.status =
        'paid';
    }

    if (
      isFinalNegativeStatus(
        status,
      )
    ) {
      orderUpdate.status =
        'cancelled';
    }

    const {
      error:
        orderUpdateError,
    } = await supabase
      .from('orders')
      .update(
        orderUpdate,
      )
      .eq(
        'id',
        payment.order_id,
      );

    if (orderUpdateError) {
      console.error(
        'Order update error:',
        orderUpdateError,
      );

      return jsonResponse(
        {
          error:
            'ORDER_UPDATE_FAILED',
          message:
            orderUpdateError.message,
        },
        500,
      );
    }

    /*
     * PAID confirmado.
     *
     * A liberação dos arquivos STL será feita
     * em uma etapa separada, usando Supabase Storage
     * privado e URLs assinadas.
     */
    if (
      isPaidStatus(status)
    ) {
      console.log(
        'PAYMENT CONFIRMED:',
        JSON.stringify({
          paymentId:
            payment.id,
          orderId:
            payment.order_id,
          externalReference,
          streetPayPaymentId:
            payload.id ||
            null,
          amount:
            payload.amount ||
            null,
          alreadyPaid,
        }),
      );
    }

    /*
     * Resposta final para a StreetPay.
     */
    return jsonResponse(
      {
        received: true,
        processed: true,
        alreadyProcessed:
          alreadyPaid,
        status,
        orderId:
          payment.order_id,
        paymentId:
          payment.id,
        externalRef:
          externalReference,
        streetPayPaymentId:
          payload.id || null,
        amount:
          payload.amount || null,
        currency:
          payload.currency ||
          'BRL',
        paidAt:
          payload.paidAt ||
          (
            isPaidStatus(status)
              ? new Date().toISOString()
              : null
          ),
        pix: {
          copyPaste:
            getCopyPaste(
              payload,
            ),
          qrCode:
            getQrCode(
              payload,
            ),
        },
        signatureChecked:
          signatureResult.checked,
      },
      200,
    );
  } catch (error) {
    console.error(
      'StreetPay webhook fatal error:',
      error,
    );

    return jsonResponse(
      {
        error:
          'INTERNAL_SERVER_ERROR',
        message:
          error instanceof Error
            ? error.message
            : 'Unexpected error.',
      },
      500,
    );
  }
});