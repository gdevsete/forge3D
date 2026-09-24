import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const STREETPAY_API_URL =
  'https://api.streetpays.com.br/v1/payment';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':
    'POST, OPTIONS',
};

type ProductType = 'stl' | 'physical';
type PurchaseType = 'stl' | 'physical';

type ShippingMethod = 'free' | 'sedex10';

const FREE_SHIPPING_DAYS = 5;
const SEDEX10_SHIPPING_DAYS = 2;
const SEDEX10_PRICE = 29.99;

interface RequestItem {
  productId: string;
  quantity: number;
  purchaseType: PurchaseType;
  variantId?: string | null;
}

interface Customer {
  name: string;
  email: string;
  phone?: string;
  cpfCnpj?: string;
}

interface Attribution {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  fbclid?: string;
  referrer?: string;
  landing_page?: string;
}

interface DeliveryAddress {
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

interface RequestBody {
  items: RequestItem[];
  customer: Customer;
  attribution?: Attribution;

  /*
   * Modalidade de envio escolhida pelo cliente.
   *
   * O valor do frete NÃO vem do frontend.
   * O backend define:
   *
   * free    => R$ 0,00
   * sedex10 => R$ 29,99
   */
  shippingMethod?: ShippingMethod;

  /*
   * Prazo exibido ao cliente.
   *
   * O backend não confia nesse número para calcular
   * o pedido. Ele valida contra a modalidade escolhida
   * e usa o prazo oficial definido acima.
   */
  shippingDays?: number;

  /*
   * Desconto não é confiado ao frontend.
   * Mantido apenas para compatibilidade.
   */
  discount?: number;

  /*
   * Endereço somente para pedidos físicos.
   */
  delivery?: DeliveryAddress;
}

interface ProductRow {
  id: string;
  name: string;
  product_type: ProductType;
  price: number | string;
  stl_price: number | string;
  printed_price: number | string;
  active: boolean;
}

interface VariantRow {
  id: string;
  product_id: string;
  name: string;
  price_modifier: number | string;
  active: boolean;
}

interface CreatedOrder {
  id: string;
}

function json(
  body: unknown,
  status = 200,
) {
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

function normalizeString(
  value: unknown,
): string | undefined {
  if (
    typeof value !== 'string' ||
    !value.trim()
  ) {
    return undefined;
  }

  return value.trim();
}

function toMoney(
  value: number,
): number {
  return Math.round(
    value * 100,
  ) / 100;
}

function toCents(
  value: number,
): number {
  return Math.round(
    value * 100,
  );
}

function normalizeStreetPayStatus(
  status: unknown,
) {
  const value = String(
    status ?? '',
  ).toUpperCase();

  switch (value) {
    case 'PAID':
      return 'paid';

    case 'PROCESSING':
      return 'processing';

    case 'REFUSED':
      return 'refused';

    case 'REFUNDED':
      return 'refunded';

    case 'MED':
      return 'med';

    case 'CHARGEDBACK':
      return 'chargedback';

    case 'PENDING':
    default:
      return 'pending';
  }
}

function extractPixData(
  data: any,
) {
  const pixData =
    data?.data ??
    data?.payment?.data ??
    data?.pix ??
    {};

  const copyPaste =
    pixData?.copypaste ??
    pixData?.copyPaste ??
    pixData?.copy_paste ??
    data?.copypaste ??
    data?.copyPaste ??
    data?.copy_paste ??
    undefined;

  const qrCode =
    pixData?.qrcode ??
    pixData?.qrCode ??
    pixData?.qr_code ??
    data?.qrcode ??
    data?.qrCode ??
    data?.qr_code ??
    undefined;

  const checkoutUrl =
    data?.checkoutUrl ??
    data?.checkout_url ??
    data?.url ??
    data?.paymentUrl ??
    data?.payment_url ??
    undefined;

  const expiresAt =
    pixData?.expiresAt ??
    pixData?.expires_at ??
    data?.expiresAt ??
    data?.expires_at ??
    undefined;

  return {
    copyPaste,
    qrCode,
    checkoutUrl,
    expiresAt,
  };
}

async function getSupabaseAdmin() {
  const supabaseUrl =
    Deno.env.get(
      'SUPABASE_URL',
    );

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

function validateDelivery(
  delivery: DeliveryAddress | undefined,
) {
  if (!delivery) {
    throw new Error(
      'DELIVERY_REQUIRED',
    );
  }

  const requiredFields = [
    'name',
    'zip',
    'address',
    'number',
    'city',
    'state',
  ] as const;

  for (const field of requiredFields) {
    if (
      !normalizeString(
        delivery[field],
      )
    ) {
      throw new Error(
        `DELIVERY_${field.toUpperCase()}_REQUIRED`,
      );
    }
  }

  const normalizedZip =
    delivery.zip!.replace(
      /\D/g,
      '',
    );

  if (normalizedZip.length !== 8) {
    throw new Error(
      'DELIVERY_INVALID_ZIP',
    );
  }

  return {
    name: normalizeString(
      delivery.name,
    )!,
    zip: normalizeString(
      delivery.zip,
    )!,
    address: normalizeString(
      delivery.address,
    )!,
    number: normalizeString(
      delivery.number,
    )!,
    complement: normalizeString(
      delivery.complement,
    ),
    neighborhood: normalizeString(
      delivery.neighborhood,
    ),
    city: normalizeString(
      delivery.city,
    )!,
    state: normalizeString(
      delivery.state,
    )!,
    country:
      normalizeString(
        delivery.country,
      ) || 'BR',
  };
}

async function main(
  body: RequestBody,
) {
  const supabase =
    await getSupabaseAdmin();

  const streetPayApiKey =
    Deno.env.get(
      'STREETPAY_API_KEY',
    );

  if (!streetPayApiKey) {
    throw new Error(
      'STREETPAY_NOT_CONFIGURED',
    );
  }

  if (
    !body ||
    !Array.isArray(body.items) ||
    body.items.length === 0
  ) {
    throw new Error(
      'EMPTY_ORDER',
    );
  }

  if (
    !body.customer ||
    !normalizeString(
      body.customer.name,
    ) ||
    !normalizeString(
      body.customer.email,
    )
  ) {
    throw new Error(
      'INVALID_CUSTOMER',
    );
  }

  const email =
    normalizeString(
      body.customer.email,
    )!;

  const name =
    normalizeString(
      body.customer.name,
    )!;

  const phone =
    normalizeString(
      body.customer.phone,
    );

  const cpfCnpj =
    normalizeString(
      body.customer.cpfCnpj,
    );

  /*
   * ==========================================================
   * 1. NORMALIZA E VALIDA OS ITENS
   * ==========================================================
   */

  const requestedItems =
    body.items.map(
      (item) => {
        const quantity =
          Number(
            item.quantity,
          );

        if (
          !item.productId ||
          (item.purchaseType !== 'stl' &&
            item.purchaseType !== 'physical') ||
          !Number.isInteger(
            quantity,
          ) ||
          quantity <= 0 ||
          quantity > 100
        ) {
          throw new Error(
            'INVALID_ORDER_ITEM',
          );
        }

        return {
          productId:
            item.productId,

          quantity,

          purchaseType:
            item.purchaseType,

          variantId:
            item.variantId ??
            null,
        };
      },
    );

  const productIds = [
    ...new Set(
      requestedItems.map(
        (item) =>
          item.productId,
      ),
    ),
  ];

  /*
   * ==========================================================
   * 2. BUSCA OS PRODUTOS DIRETAMENTE NO BANCO
   *
   * O preço enviado pelo navegador NÃO é utilizado.
   * ==========================================================
   */

  const {
    data: products,
    error:
      productsError,
  } = await supabase
    .from('products')
    .select(
      'id,name,product_type,price,stl_price,printed_price,active',
    )
    .in(
      'id',
      productIds,
    );

  if (productsError) {
    console.error(
      '[Forge3D] Products error:',
      productsError,
    );

    throw new Error(
      'PRODUCTS_FETCH_FAILED',
    );
  }

  if (
    !products ||
    products.length !==
      productIds.length
  ) {
    throw new Error(
      'PRODUCT_NOT_FOUND',
    );
  }

  const productMap =
    new Map<string, ProductRow>();

  for (
    const product of products
  ) {
    if (!product.active) {
      throw new Error(
        'PRODUCT_INACTIVE',
      );
    }

    if (
      product.product_type !==
        'stl' &&
      product.product_type !==
        'physical'
    ) {
      throw new Error(
        'INVALID_PRODUCT_TYPE',
      );
    }

    productMap.set(
      product.id,
      product,
    );
  }

  /*
   * ==========================================================
   * 3. BUSCA VARIANTES, SE EXISTIREM
   * ==========================================================
   */

  const variantIds = [
    ...new Set(
      requestedItems
        .map(
          (item) =>
            item.variantId,
        )
        .filter(
          (
            id,
          ): id is string =>
            Boolean(id),
        ),
    ),
  ];

  const variantMap =
    new Map<
      string,
      VariantRow
    >();

  if (
    variantIds.length > 0
  ) {
    const {
      data: variants,
      error:
        variantsError,
    } = await supabase
      .from(
        'product_variants',
      )
      .select(
        'id,product_id,name,price_modifier,active',
      )
      .in(
        'id',
        variantIds,
      );

    if (variantsError) {
      console.error(
        '[Forge3D] Variants error:',
        variantsError,
      );

      throw new Error(
        'VARIANTS_FETCH_FAILED',
      );
    }

    for (
      const variant of
        variants ?? []
    ) {
      if (!variant.active) {
        throw new Error(
          'VARIANT_INACTIVE',
        );
      }

      variantMap.set(
        variant.id,
        variant,
      );
    }
  }

  /*
   * ==========================================================
   * 4. CALCULA O PEDIDO
   * ==========================================================
   */

  const calculatedItems =
    requestedItems.map(
      (item) => {
        const product =
          productMap.get(
            item.productId,
          );

        if (!product) {
          throw new Error(
            'PRODUCT_NOT_FOUND',
          );
        }

        let unitPrice =
          item.purchaseType === 'stl'
            ? Number(
                product.stl_price,
              )
            : Number(
                product.printed_price,
              );

        const variant =
          item.variantId
            ? variantMap.get(
                item.variantId,
              )
            : null;

        if (
          item.variantId &&
          !variant
        ) {
          throw new Error(
            'VARIANT_NOT_FOUND',
          );
        }

        if (
          variant &&
          variant.product_id !==
            product.id
        ) {
          throw new Error(
            'VARIANT_PRODUCT_MISMATCH',
          );
        }

        if (variant) {
          unitPrice +=
            Number(
              variant.price_modifier,
            );
        }

        unitPrice =
          toMoney(
            unitPrice,
          );

        const totalPrice =
          toMoney(
            unitPrice *
              item.quantity,
          );

        return {
          product,
          variant,
          quantity:
            item.quantity,
          purchaseType:
            item.purchaseType,
          unitPrice,
          totalPrice,
        };
      },
    );

  const subtotal =
    toMoney(
      calculatedItems.reduce(
        (
          total,
          item,
        ) =>
          total +
          item.totalPrice,
        0,
      ),
    );

  /*
   * Desconto não é aceito do frontend.
   */
  const discount = 0;

  /*
   * ==========================================================
   * 5. IDENTIFICA SE EXISTE PRODUTO FÍSICO
   * ==========================================================
   */

  const hasPhysical =
    calculatedItems.some(
      (item) =>
        item.purchaseType ===
        'physical',
    );

  /*
   * ==========================================================
   * 6. ENDEREÇO
   *
   * STL:
   * - não precisa
   * - não envia delivery para StreetPay
   *
   * FÍSICO:
   * - endereço obrigatório
   * ==========================================================
   */

  const delivery =
    hasPhysical
      ? validateDelivery(
          body.delivery,
        )
      : undefined;

  /*
   * ==========================================================
   * 7. FRETE
   * ==========================================================
   *
   * O frontend informa SOMENTE a modalidade.
   *
   * O backend define o preço.
   *
   * free:
   *   Correios
   *   R$ 0,00
   *   5 dias úteis
   *
   * sedex10:
   *   Correios
   *   R$ 29,99
   *   2 dias úteis
   *
   * O prazo é persistido por cliente + CEP + modalidade.
   * Assim, a mesma pessoa continua vendo o mesmo prazo
   * para a mesma combinação mesmo em outro dia.
   */

  let shipping = 0;
  let shippingMethod: ShippingMethod | null = null;
  let shippingDays: number | null = null;
  let shippingCarrier: string | null = null;

  if (hasPhysical) {
    if (
      body.shippingMethod !== 'free' &&
      body.shippingMethod !== 'sedex10'
    ) {
      throw new Error(
        'SHIPPING_METHOD_REQUIRED',
      );
    }

    shippingMethod =
      body.shippingMethod;

    shippingCarrier =
      'Correios';

    const customerEmailKey =
      email.toLowerCase();

    const customerZipKey =
      delivery!.zip.replace(
        /\D/g,
        '',
      );

    /*
     * Primeiro tentamos recuperar um prazo já salvo.
     */
    const {
      data: existingEstimate,
      error: existingEstimateError,
    } = await supabase
      .from('shipping_estimates')
      .select(
        'shipping_days,shipping_method,shipping_carrier',
      )
      .eq(
        'customer_email',
        customerEmailKey,
      )
      .eq(
        'zip_code',
        customerZipKey,
      )
      .eq(
        'shipping_method',
        shippingMethod,
      )
      .maybeSingle();

    if (existingEstimateError) {
      console.error(
        '[Forge3D] Shipping estimate lookup error:',
        existingEstimateError,
      );

      throw new Error(
        'SHIPPING_ESTIMATE_LOOKUP_FAILED',
      );
    }

    if (existingEstimate) {
      shippingDays =
        Number(
          existingEstimate.shipping_days,
        );

      shippingCarrier =
        existingEstimate.shipping_carrier ||
        'Correios';
    } else {
      /*
       * Primeiro pedido dessa combinação:
       * criamos uma estimativa fixa.
       *
       * A constraint do banco também protege
       * os valores permitidos.
       */
      const fixedShippingDays =
        shippingMethod === 'free'
          ? FREE_SHIPPING_DAYS
          : SEDEX10_SHIPPING_DAYS;

      const {
        error: shippingEstimateInsertError,
      } = await supabase
        .from('shipping_estimates')
        .insert({
          customer_email:
            customerEmailKey,

          customer_phone:
            phone ?? null,

          zip_code:
            customerZipKey,

          shipping_method:
            shippingMethod,

          shipping_carrier:
            'Correios',

          shipping_days:
            fixedShippingDays,
        });

      /*
       * Concorrência: outro checkout pode ter criado
       * a mesma combinação entre o SELECT e o INSERT.
       * Nesse caso, buscamos novamente a linha existente.
       */
      if (shippingEstimateInsertError) {
        const {
          data: concurrentEstimate,
          error: concurrentEstimateError,
        } = await supabase
          .from('shipping_estimates')
          .select(
            'shipping_days,shipping_method,shipping_carrier',
          )
          .eq(
            'customer_email',
            customerEmailKey,
          )
          .eq(
            'zip_code',
            customerZipKey,
          )
          .eq(
            'shipping_method',
            shippingMethod,
          )
          .maybeSingle();

        if (
          concurrentEstimateError ||
          !concurrentEstimate
        ) {
          console.error(
            '[Forge3D] Shipping estimate insert error:',
            shippingEstimateInsertError,
          );

          throw new Error(
            'SHIPPING_ESTIMATE_SAVE_FAILED',
          );
        }

        shippingDays =
          Number(
            concurrentEstimate.shipping_days,
          );

        shippingCarrier =
          concurrentEstimate.shipping_carrier ||
          'Correios';
      } else {
        shippingDays =
          fixedShippingDays;
      }
    }

    if (
      shippingMethod === 'free'
    ) {
      shipping = 0;
    } else {
      shipping =
        SEDEX10_PRICE;
    }

    /*
     * O prazo enviado pelo frontend é apenas uma confirmação
     * de consistência. A fonte de verdade é o backend/banco.
     */
    if (
      body.shippingDays !== undefined &&
      Number(body.shippingDays) !== shippingDays
    ) {
      throw new Error(
        'SHIPPING_DAYS_MISMATCH',
      );
    }
  }

  const total =
    toMoney(
      subtotal -
        discount +
        shipping,
    );

  if (total <= 0) {
    throw new Error(
      'INVALID_ORDER_TOTAL',
    );
  }

  /*
   * ==========================================================
   * 8. CRIA O PEDIDO
   * ==========================================================
   */

  const attribution =
    body.attribution ??
    {};

  const {
    data: order,
    error:
      orderError,
  } = await supabase
    .from('orders')
    .insert({
      customer_name:
        name,

      customer_email:
        email,

      customer_phone:
        phone ?? null,

      customer_cpf_cnpj:
        cpfCnpj ?? null,

      status:
        'pending_payment',

      payment_status:
        'pending',

      payment_method:
        'PIX',

      subtotal,

      discount,

      shipping,

      shipping_carrier:
        shippingCarrier,

      shipping_method:
        shippingMethod,

      shipping_days:
        shippingDays,

      shipping_name:
        delivery?.name ??
        null,

      shipping_zip:
        delivery?.zip ??
        null,

      shipping_street:
        delivery?.address ??
        null,

      shipping_number:
        delivery?.number ??
        null,

      shipping_complement:
        delivery?.complement ??
        null,

      shipping_neighborhood:
        delivery?.neighborhood ??
        null,

      shipping_city:
        delivery?.city ??
        null,

      shipping_state:
        delivery?.state ??
        null,

      shipping_country:
        delivery?.country ??
        'BR',

      total,

      utm_source:
        attribution.utm_source ??
        null,

      utm_medium:
        attribution.utm_medium ??
        null,

      utm_campaign:
        attribution.utm_campaign ??
        null,

      utm_content:
        attribution.utm_content ??
        null,

      utm_term:
        attribution.utm_term ??
        null,

      fbclid:
        attribution.fbclid ??
        null,

      referrer:
        attribution.referrer ??
        null,

      landing_page:
        attribution.landing_page ??
        null,
    })
    .select('id')
    .single<CreatedOrder>();

  if (
    orderError ||
    !order
  ) {
    console.error(
      '[Forge3D] Order creation error:',
      orderError,
    );

    throw new Error(
      'ORDER_CREATION_FAILED',
    );
  }

  /*
   * ==========================================================
   * 9. CRIA OS ITENS DO PEDIDO
   * ==========================================================
   */

  const orderItems =
    calculatedItems.map(
      (item) => ({
        order_id:
          order.id,

        product_id:
          item.product.id,

        variant_id:
          item.variant?.id ??
          null,

        quantity:
          item.quantity,

        unit_price:
          item.unitPrice,

        total_price:
          item.totalPrice,

        product_type:
          item.purchaseType ===
          'physical'
            ? 'physical'
            : 'stl',
      }),
    );

  const {
    error:
      orderItemsError,
  } = await supabase
    .from('order_items')
    .insert(
      orderItems,
    );

  if (
    orderItemsError
  ) {
    console.error(
      '[Forge3D] Order items error:',
      orderItemsError,
    );

    await supabase
      .from('orders')
      .delete()
      .eq(
        'id',
        order.id,
      );

    throw new Error(
      'ORDER_ITEMS_CREATION_FAILED',
    );
  }

  /*
   * ==========================================================
   * 10. CRIA REGISTRO DO PAGAMENTO
   * ==========================================================
   */

  const {
    data: payment,
    error:
      paymentInsertError,
  } = await supabase
    .from('payments')
    .insert({
      order_id:
        order.id,

      provider:
        'streetpay',

      external_reference:
        order.id,

      status:
        'pending',

      amount:
        total,

      payment_method:
        'PIX',
    })
    .select('id')
    .single();

  if (
    paymentInsertError ||
    !payment
  ) {
    console.error(
      '[Forge3D] Payment creation error:',
      paymentInsertError,
    );

    await supabase
      .from('orders')
      .delete()
      .eq(
        'id',
        order.id,
      );

    throw new Error(
      'PAYMENT_RECORD_CREATION_FAILED',
    );
  }

  /*
   * ==========================================================
   * 11. MONTA OS ITENS PARA A GATEWAY
   * ==========================================================
   *
   * A Forge3D decidiu que a gateway deve receber
   * TODOS os pedidos como DIGITAL.
   *
   * A logística do modelo impresso fica sob
   * responsabilidade da Forge3D.
   * ==========================================================
   */

  const streetPayItems =
    calculatedItems.map(
      (item) => ({
        quantity:
          item.quantity,

        name:
          `${item.product.name} - ${
            item.purchaseType ===
            'stl'
              ? 'STL'
              : 'Modelo impresso'
          }${
            item.variant
              ? ` - ${item.variant.name}`
              : ''
          }`,

        price:
          toCents(
            item.unitPrice,
          ),

        type:
          'DIGITAL',
      }),
    );

  /*
   * ==========================================================
   * 12. WEBHOOK
   * ==========================================================
   */

  const webhookUrl =
    Deno.env.get(
      'STREETPAY_WEBHOOK_URL',
    );

  if (!webhookUrl) {
    throw new Error(
      'STREETPAY_WEBHOOK_URL_NOT_CONFIGURED',
    );
  }

  /*
   * ==========================================================
   * 13. MONTA PAYLOAD STREETPAY
   * ==========================================================
   */

  const streetPayPayload: Record<
    string,
    unknown
  > = {
    amount:
      toCents(
        total,
      ),

    currency:
      'BRL',

    method:
      'PIX',

    description:
      `Pedido Forge3D ${order.id}`,

    externalRef:
      order.id,

    notificationUrl:
      webhookUrl,

    payer: {
      name,

      ...(cpfCnpj
        ? {
            taxId:
              cpfCnpj,
          }
        : {}),

      email,

      ...(phone
        ? {
            phone,
          }
        : {}),
    },

    items:
      streetPayItems,
  };

  /*
   * ==========================================================
   * 14. ENTREGA
   * ==========================================================
   *
   * O endereço é tratado pela Forge3D para cumprir a
   * entrega do modelo impresso.
   *
   * A gateway recebe o pedido como DIGITAL, portanto
   * não enviamos endereço/logística no payload dela.
   *
   * O endereço validado continua disponível em `delivery`
   * para ser persistido na estrutura interna da Forge3D
   * na próxima etapa do banco.
   */

  /*
   * ==========================================================
   * 15. LOG SEGURO
   *
   * Não exibimos API KEY nem dados sensíveis.
   * ==========================================================
   */

  console.log(
    '[StreetPay] Creating payment:',
    {
      orderId:
        order.id,

      amount:
        streetPayPayload.amount,

      externalRef:
        streetPayPayload.externalRef,

      hasPhysical,

      shippingMethod,

      shippingDays,

      shipping,

      shippingCarrier,

      itemTypes:
        calculatedItems.map(
          (item) =>
            item.purchaseType,
        ),

      gatewayItemTypes:
        streetPayItems.map(
          (item) =>
            item.type,
        ),

      hasDelivery:
        Boolean(
          delivery,
        ),
    },
  );

  /*
   * ==========================================================
   * 16. ENVIA PARA STREETPAY
   * ==========================================================
   */

  const streetPayResponse =
    await fetch(
      STREETPAY_API_URL,
      {
        method:
          'POST',

        headers: {
          Authorization:
            `Bearer ${streetPayApiKey}`,

          'Content-Type':
            'application/json',

          Accept:
            'application/json',
        },

        body:
          JSON.stringify(
            streetPayPayload,
          ),
      },
    );

  const responseText =
    await streetPayResponse.text();

  let streetPayData: any;

  try {
    streetPayData =
      responseText
        ? JSON.parse(
            responseText,
          )
        : {};
  } catch {
    streetPayData = {
      raw:
        responseText,
    };
  }

  /*
   * ==========================================================
   * 17. TRATA ERRO DA STREETPAY
   * ==========================================================
   */

  if (
    !streetPayResponse.ok
  ) {
    console.error(
      '[StreetPay] API error:',
      {
        status:
          streetPayResponse.status,

        response:
          streetPayData,
      },
    );

    await supabase
      .from('payments')
      .update({
        status:
          'error',

        raw_response:
          streetPayData,
      })
      .eq(
        'id',
        payment.id,
      );

    await supabase
      .from('orders')
      .update({
        status:
          'payment_error',

        payment_status:
          'error',
      })
      .eq(
        'id',
        order.id,
      );

    throw new Error(
      'STREETPAY_API_ERROR',
    );
  }

  /*
   * ==========================================================
   * 18. EXTRAI DADOS DO PIX
   * ==========================================================
   */

  const pix =
    extractPixData(
      streetPayData,
    );

  const paymentId =
    streetPayData?.id ??
    streetPayData?.paymentId ??
    streetPayData?.payment?.id ??
    null;

  const externalRef =
    streetPayData?.externalRef ??
    streetPayData?.external_reference ??
    order.id;

  const paymentStatus =
    normalizeStreetPayStatus(
      streetPayData?.status,
    );

  /*
   * ==========================================================
   * 19. ATUALIZA PAYMENT
   * ==========================================================
   */

  await supabase
    .from('payments')
    .update({
      external_payment_id:
        paymentId,

      external_reference:
        externalRef,

      status:
        paymentStatus,

      amount:
        total,

      payment_method:
        'PIX',

      raw_response:
        streetPayData,

      paid_at:
        paymentStatus ===
        'paid'
          ? new Date().toISOString()
          : null,
    })
    .eq(
      'id',
      payment.id,
    );

  /*
   * ==========================================================
   * 20. SE A STREETPAY JÁ DEVOLVER PAID
   * ==========================================================
   */

  if (
    paymentStatus ===
    'paid'
  ) {
    await supabase
      .from('orders')
      .update({
        status:
          'paid',

        payment_status:
          'paid',
      })
      .eq(
        'id',
        order.id,
      );
  }

  /*
   * ==========================================================
   * 21. RETORNO PARA O FRONTEND
   * ==========================================================
   */

  return {
    status:
      paymentStatus,

    orderId:
      order.id,

    paymentId,

    externalRef,

    qrCode:
      pix.qrCode,

    copyPaste:
      pix.copyPaste,

    checkoutUrl:
      pix.checkoutUrl,

    expiresAt:
      pix.expiresAt,

    amount:
      total,

    currency:
      'BRL',

    shipping:
      shipping,

    shippingMethod:
      shippingMethod,

    shippingDays:
      shippingDays,

    shippingCarrier:
      shippingCarrier,
  };
}

serve(
  async (
    request: Request,
  ) => {
    if (
      request.method ===
      'OPTIONS'
    ) {
      return new Response(
        'ok',
        {
          headers:
            corsHeaders,
        },
      );
    }

    if (
      request.method !==
      'POST'
    ) {
      return json(
        {
          error:
            'METHOD_NOT_ALLOWED',
        },
        405,
      );
    }

    try {
      const body =
        await request.json();

      const result =
        await main(
          body,
        );

      return json(
        result,
        200,
      );
    } catch (
      error
    ) {
      console.error(
        '[Forge3D] StreetPay function error:',
        error,
      );

      const message =
        error instanceof Error
          ? error.message
          : 'UNKNOWN_ERROR';

      return json(
        {
          error:
            message,
        },
        400,
      );
    }
  },
);