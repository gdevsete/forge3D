import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':
    'POST, OPTIONS',
};

type PublicPaymentStatus =
  | 'pending'
  | 'processing'
  | 'paid'
  | 'refused'
  | 'refunded'
  | 'med'
  | 'chargedback'
  | 'unknown';

interface RequestBody {
  orderId?: unknown;
}

interface OrderRow {
  id: string;
  status: string | null;
  payment_status: string | null;
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

function normalizeUuid(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const uuid = value.trim();

  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  return uuidPattern.test(uuid) ? uuid : null;
}

function normalizeStatus(
  paymentStatus: string | null,
  orderStatus: string | null,
): PublicPaymentStatus {
  const payment = String(
    paymentStatus ?? '',
  )
    .trim()
    .toLowerCase();

  const order = String(
    orderStatus ?? '',
  )
    .trim()
    .toLowerCase();

  if (
    payment === 'paid' ||
    order === 'paid'
  ) {
    return 'paid';
  }

  if (
    payment === 'processing' ||
    order === 'processing'
  ) {
    return 'processing';
  }

  if (
    payment === 'refused' ||
    order === 'refused'
  ) {
    return 'refused';
  }

  if (
    payment === 'refunded' ||
    order === 'refunded'
  ) {
    return 'refunded';
  }

  if (
    payment === 'med' ||
    order === 'med'
  ) {
    return 'med';
  }

  if (
    payment === 'chargedback' ||
    order === 'chargedback'
  ) {
    return 'chargedback';
  }

  if (
    payment === 'pending' ||
    order === 'pending_payment' ||
    order === 'pending'
  ) {
    return 'pending';
  }

  return 'unknown';
}

async function getSupabaseAdmin() {
  const supabaseUrl =
    Deno.env.get('SUPABASE_URL');

  const serviceRoleKey =
    Deno.env.get(
      'SUPABASE_SERVICE_ROLE_KEY',
    );

  if (!supabaseUrl) {
    throw new Error(
      'SUPABASE_URL_NOT_CONFIGURED',
    );
  }

  if (!serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY_NOT_CONFIGURED',
    );
  }

  return createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

Deno.serve(
  async (
    request: Request,
  ) => {
    if (
      request.method === 'OPTIONS'
    ) {
      return new Response(
        'ok',
        {
          status: 200,
          headers: corsHeaders,
        },
      );
    }

    if (
      request.method !== 'POST'
    ) {
      return jsonResponse(
        {
          error:
            'METHOD_NOT_ALLOWED',
          message:
            'Use POST.',
        },
        405,
      );
    }

    try {
      const body =
        (await request.json()) as RequestBody;

      const orderId =
        normalizeUuid(
          body?.orderId,
        );

      if (!orderId) {
        return jsonResponse(
          {
            error:
              'INVALID_ORDER_ID',
          },
          400,
        );
      }

      const supabase =
        await getSupabaseAdmin();

      /*
       * Consulta somente os dados mínimos
       * necessários para o checkout saber se
       * o pagamento já foi confirmado.
       */
      const {
        data: order,
        error: orderError,
      } = await supabase
        .from('orders')
        .select(
          'id,status,payment_status',
        )
        .eq('id', orderId)
        .maybeSingle<OrderRow>();

      if (orderError) {
        console.error(
          '[Forge3D] Payment status lookup error:',
          orderError,
        );

        return jsonResponse(
          {
            error:
              'PAYMENT_STATUS_LOOKUP_FAILED',
          },
          500,
        );
      }

      if (!order) {
        /*
         * Não expomos detalhes sobre pedidos
         * inexistentes. O checkout pode tratar
         * isso como estado desconhecido.
         */
        return jsonResponse(
          {
            error:
              'ORDER_NOT_FOUND',
            status:
              'unknown',
          },
          404,
        );
      }

      const status =
        normalizeStatus(
          order.payment_status,
          order.status,
        );

      console.log(
        '[Forge3D] Payment status checked:',
        {
          orderId: order.id,
          status,
        },
      );

      return jsonResponse(
        {
          status,
          orderId: order.id,
        },
        200,
      );
    } catch (error) {
      console.error(
        '[Forge3D] Payment status function error:',
        error,
      );

      return jsonResponse(
        {
          error:
            error instanceof Error
              ? error.message
              : 'INTERNAL_SERVER_ERROR',
        },
        500,
      );
    }
  },
);
