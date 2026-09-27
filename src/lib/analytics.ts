let pixelInitialized = false;
let initializedPixelId = '';
let lastPath = '';

type Fbq = ((
  ...args: unknown[]
) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[];
  loaded?: boolean;
  version?: string;
  forge3d?: boolean;
  disablePushState?: boolean;
};

type Attribution = {
  firstLandingPage: string;
  firstReferrer: string;
  firstVisitAt: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  utm_term: string;
  fbclid: string;
};

type PurchasePayload = {
  value: number;
  currency?: string;
  content_ids?: string[];
  content_name?: string;
  content_type?: string;
  num_items?: number;
  event_id?: string;
  order_id?: string;
};

type StandardEvent =
  | 'PageView'
  | 'ViewContent'
  | 'Search'
  | 'AddToCart'
  | 'AddToWishlist'
  | 'InitiateCheckout'
  | 'AddPaymentInfo'
  | 'Lead'
  | 'Contact'
  | 'Purchase';

const META_STANDARD_EVENTS = new Set<StandardEvent>([
  'PageView',
  'ViewContent',
  'Search',
  'AddToCart',
  'AddToWishlist',
  'InitiateCheckout',
  'AddPaymentInfo',
  'Lead',
  'Contact',
  'Purchase',
]);

function safeWindow(): boolean {
  return typeof window !== 'undefined';
}

function getFbq(): Fbq | undefined {
  if (!safeWindow()) {
    return undefined;
  }

  return (
    window as unknown as {
      fbq?: Fbq;
    }
  ).fbq;
}

function safeLocalStorageGet(
  key: string,
): string | null {
  if (!safeWindow()) {
    return null;
  }

  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeLocalStorageSet(
  key: string,
  value: string,
): void {
  if (!safeWindow()) {
    return;
  }

  try {
    window.localStorage.setItem(
      key,
      value,
    );
  } catch {
    // Storage indisponível não pode quebrar o checkout.
  }
}

function safeSessionStorageGet(
  key: string,
): string | null {
  if (!safeWindow()) {
    return null;
  }

  try {
    return window.sessionStorage.getItem(
      key,
    );
  } catch {
    return null;
  }
}

function safeSessionStorageSet(
  key: string,
  value: string,
): void {
  if (!safeWindow()) {
    return;
  }

  try {
    window.sessionStorage.setItem(
      key,
      value,
    );
  } catch {
    // Storage indisponível não pode quebrar o checkout.
  }
}

function generateEventId(
  prefix = 'forge3d',
): string {
  if (
    safeWindow() &&
    typeof window.crypto !==
      'undefined' &&
    typeof window.crypto.randomUUID ===
      'function'
  ) {
    return `${prefix}_${window.crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 12)}`;
}

function stablePayloadKey(
  payload: Record<string, unknown>,
): string {
  return JSON.stringify(
    Object.keys(payload)
      .sort()
      .reduce<Record<string, unknown>>(
        (result, key) => {
          result[key] = payload[key];
          return result;
        },
        {},
      ),
  );
}

function recentEventWasSent(
  key: string,
  windowMs: number,
): boolean {
  const storageKey = `forge3d_event_dedupe_${key}`;
  const existing =
    safeSessionStorageGet(storageKey);

  if (!existing) {
    safeSessionStorageSet(
      storageKey,
      String(Date.now()),
    );
    return false;
  }

  const timestamp =
    Number(existing);

  if (
    !Number.isFinite(timestamp) ||
    Date.now() - timestamp > windowMs
  ) {
    safeSessionStorageSet(
      storageKey,
      String(Date.now()),
    );
    return false;
  }

  return true;
}

export function getAttribution(): Attribution {
  if (!safeWindow()) {
    return {
      firstLandingPage: '',
      firstReferrer: '',
      firstVisitAt: '',
      utm_source: '',
      utm_medium: '',
      utm_campaign: '',
      utm_content: '',
      utm_term: '',
      fbclid: '',
    };
  }

  const params =
    new URLSearchParams(
      window.location.search,
    );

  let existing: Partial<Attribution> =
    {};

  try {
    existing = JSON.parse(
      safeLocalStorageGet(
        'forge3d_attribution',
      ) || '{}',
    );
  } catch {
    existing = {};
  }

  const current: Attribution = {
    firstLandingPage:
      existing.firstLandingPage ||
      window.location.pathname,

    firstReferrer:
      existing.firstReferrer ||
      document.referrer ||
      '',

    firstVisitAt:
      existing.firstVisitAt ||
      new Date().toISOString(),

    utm_source:
      existing.utm_source ||
      params.get('utm_source') ||
      '',

    utm_medium:
      existing.utm_medium ||
      params.get('utm_medium') ||
      '',

    utm_campaign:
      existing.utm_campaign ||
      params.get('utm_campaign') ||
      '',

    utm_content:
      existing.utm_content ||
      params.get('utm_content') ||
      '',

    utm_term:
      existing.utm_term ||
      params.get('utm_term') ||
      '',

    fbclid:
      existing.fbclid ||
      params.get('fbclid') ||
      '',
  };

  safeLocalStorageSet(
    'forge3d_attribution',
    JSON.stringify(current),
  );

  return current;
}

export function initMetaPixel(
  pixelId: string,
): void {
  if (
    !safeWindow() ||
    !pixelId
  ) {
    return;
  }

  if (
    pixelInitialized &&
    initializedPixelId === pixelId
  ) {
    return;
  }

  const w =
    window as unknown as {
      fbq?: Fbq;
      _fbq?: Fbq;
    };

  // Não cria uma segunda instância caso outro script já tenha
  // inicializado o pixel na mesma página.
  if (w.fbq) {
    if (
      w.fbq.forge3d &&
      initializedPixelId === pixelId
    ) {
      pixelInitialized = true;
      return;
    }

    console.warn(
      '[Forge3D] Meta Pixel já existe na página. Verifique se há outro snippet/integração carregando o Pixel.',
    );

    pixelInitialized = true;
    initializedPixelId =
      pixelId;
    return;
  }

  const f = ((
    ...args: unknown[]
  ) => {
    if (f.callMethod) {
      f.callMethod(...args);
    } else {
      f.queue?.push(args);
    }
  }) as Fbq;

  f.callMethod =
    undefined;
  f.queue = [];
  f.loaded = true;
  f.version = '2.0';
  f.forge3d = true;

  w.fbq = f;
  w._fbq = f;

  const script =
    document.createElement(
      'script',
    );

  script.async = true;
  script.src =
    'https://connect.facebook.net/en_US/fbevents.js';

  document.head.appendChild(
    script,
  );

  /*
   * Controle deliberadamente manual.
   *
   * A Meta documenta que a configuração automática pode detectar
   * interações/cliques. Aqui optamos por desligá-la para que o
   * funil comercial tenha somente os eventos que o código define.
   */
  f(
    'set',
    'autoConfig',
    false,
    pixelId,
  );

  /*
   * O React Router já controla as mudanças de URL e o projeto
   * envia PageView manualmente. O Meta Pixel espera esta
   * configuração como propriedade da função fbq, não como
   * um comando `set` com valor booleano.
   */
  f.disablePushState = true;

  f(
    'init',
    pixelId,
  );

  pixelInitialized = true;
  initializedPixelId =
    pixelId;
}

export function trackPageView(
  path: string,
): void {
  if (!safeWindow()) {
    return;
  }

  if (path === lastPath) {
    return;
  }

  lastPath = path;

  getFbq()?.(
    'track',
    'PageView',
  );

  recordEvent(
    'PageView',
    { path },
  );
}

export function trackEvent(
  event: string,
  payload: Record<string, unknown> = {},
  eventId?: string,
): string | undefined {
  if (!safeWindow()) {
    return undefined;
  }

  // Somente eventos padrão são enviados para o Pixel por esta API.
  // Eventos auxiliares permanecem no log local.
  if (
    !META_STANDARD_EVENTS.has(
      event as StandardEvent,
    )
  ) {
    console.warn(
      `[Forge3D] Evento "${event}" não é padrão e não será enviado ao Meta Pixel por trackEvent().`,
    );

    recordEvent(
      event,
      {
        ...payload,
        event_id:
          eventId ||
          generateEventId(
            event,
          ),
      },
    );

    return undefined;
  }

  const id =
    eventId ||
    generateEventId(event);

  const fb = getFbq();

  if (fb) {
    fb(
      'track',
      event,
      payload,
      {
        eventID: id,
      },
    );
  }

  recordEvent(
    event,
    {
      ...payload,
      event_id: id,
    },
  );

  return id;
}

export function trackViewContent(
  payload: {
    content_ids?: string[];
    content_name?: string;
    content_type?: string;
    value?: number;
    currency?: string;
  },
): string | undefined {
  const productId =
    payload.content_ids?.[0] ||
    payload.content_name ||
    'unknown';

  const path =
    safeWindow()
      ? window.location.pathname
      : '';

  const dedupeKey =
    `viewcontent_${path}_${productId}`;

  if (
    recentEventWasSent(
      dedupeKey,
      1500,
    )
  ) {
    return undefined;
  }

  return trackEvent(
    'ViewContent',
    {
      content_type:
        'product',

      currency:
        'BRL',

      ...payload,
    },
  );
}

export function trackSearch(
  payload: {
    search_string: string;
    content_category?: string;
  },
): string | undefined {
  return trackEvent(
    'Search',
    {
      ...payload,
    },
  );
}

export function trackAddToCart(
  payload: {
    content_ids?: string[];
    content_name?: string;
    content_type?: string;
    value: number;
    currency?: string;
    num_items?: number;
  },
): string | undefined {
  const key =
    `addtocart_${stablePayloadKey(
      {
        content_ids:
          payload.content_ids,
        content_type:
          payload.content_type,
        value:
          payload.value,
        num_items:
          payload.num_items,
      },
    )}`;

  if (
    recentEventWasSent(
      key,
      1200,
    )
  ) {
    return undefined;
  }

  return trackEvent(
    'AddToCart',
    {
      content_type:
        'product',
      currency:
        'BRL',
      ...payload,
    },
  );
}

export function trackAddToWishlist(
  payload: {
    content_ids?: string[];
    content_name?: string;
    content_type?: string;
    value?: number;
    currency?: string;
  },
): string | undefined {
  return trackEvent(
    'AddToWishlist',
    {
      content_type:
        'product',
      currency:
        'BRL',
      ...payload,
    },
  );
}

export function trackInitiateCheckout(
  payload: {
    content_ids?: string[];
    value: number;
    currency?: string;
    num_items?: number;
  },
): string | undefined {
  const key =
    `initcheckout_${stablePayloadKey(
      {
        content_ids:
          payload.content_ids,
        value:
          payload.value,
        num_items:
          payload.num_items,
      },
    )}`;

  if (
    recentEventWasSent(
      key,
      2500,
    )
  ) {
    return undefined;
  }

  return trackEvent(
    'InitiateCheckout',
    {
      currency:
        'BRL',
      ...payload,
    },
  );
}

export function trackAddPaymentInfo(
  payload: {
    value?: number;
    currency?: string;
    content_ids?: string[];
  },
): string | undefined {
  const key =
    `addpaymentinfo_${stablePayloadKey(
      {
        content_ids:
          payload.content_ids,
        value:
          payload.value,
      },
    )}`;

  if (
    recentEventWasSent(
      key,
      5000,
    )
  ) {
    return undefined;
  }

  return trackEvent(
    'AddPaymentInfo',
    {
      currency:
        'BRL',
      ...payload,
    },
  );
}

export function trackLead(
  payload: {
    content_name?: string;
    value?: number;
    currency?: string;
    event_id?: string;
  },
): string | undefined {
  const key =
    `lead_${stablePayloadKey(
      {
        content_name:
          payload.content_name,
        value:
          payload.value,
        event_id:
          payload.event_id,
      },
    )}`;

  if (
    recentEventWasSent(
      key,
      5000,
    )
  ) {
    return undefined;
  }

  return trackEvent(
    'Lead',
    {
      ...payload,
    },
    payload.event_id,
  );
}

export function trackContact(
  payload: {
    content_name?: string;
    content_category?: string;
  },
): string | undefined {
  return trackEvent(
    'Contact',
    {
      ...payload,
    },
  );
}

export function trackPurchase(
  payload: PurchasePayload,
): string | undefined {
  const eventId =
    payload.event_id ||
    (payload.order_id
      ? `purchase_${payload.order_id}`
      : generateEventId('purchase'));

  return trackEvent(
    'Purchase',
    {
      currency:
        'BRL',
      ...payload,
    },
    eventId,
  );
}

export function trackPurchaseOnce(
  payload: PurchasePayload & {
    order_id: string;
  },
): string | undefined {
  const orderId =
    payload.order_id.trim();

  if (!orderId) {
    console.error(
      '[Forge3D] Purchase sem order_id não foi enviado.',
    );
    return undefined;
  }

  const storageKey =
    `forge3d_purchase_sent_${orderId}`;

  if (
    safeLocalStorageGet(
      storageKey,
    )
  ) {
    return undefined;
  }

  /*
   * Se o Pixel ainda não foi inicializado, não marcamos a compra
   * como enviada. Assim, uma falha de configuração/carregamento
   * não "queima" a tentativa para sempre.
   */
  if (!getFbq()) {
    console.warn(
      '[Forge3D] Purchase aguardando Pixel inicializado.',
    );
    return undefined;
  }

  const eventId =
    payload.event_id ||
    `purchase_${orderId}`;

  const result =
    trackPurchase({
      ...payload,
      order_id:
        orderId,
      event_id:
        eventId,
    });

  /*
   * Marca somente depois de entregar o evento ao fbq.
   */
  safeLocalStorageSet(
    storageKey,
    new Date().toISOString(),
  );

  return result;
}

/**
 * Mantida para compatibilidade com partes antigas.
 * Não envia eventos customizados para o Meta Pixel.
 * Registra apenas localmente para diagnóstico.
 */
export function trackCustom(
  event: string,
  payload: Record<string, unknown> = {},
  eventId?: string,
): string | undefined {
  const id =
    eventId ||
    generateEventId(event);

  recordEvent(
    event,
    {
      ...payload,
      event_id: id,
    },
  );

  return id;
}

function recordEvent(
  event: string,
  payload: Record<string, unknown>,
): void {
  if (!safeWindow()) {
    return;
  }

  const attribution =
    getAttribution();

  const item = {
    event,
    payload: {
      ...payload,
      attribution,
      timestamp:
        new Date().toISOString(),
    },
  };

  let existing: unknown[] =
    [];

  try {
    existing =
      JSON.parse(
        safeLocalStorageGet(
          'forge3d_events',
        ) || '[]',
      );

    if (
      !Array.isArray(
        existing,
      )
    ) {
      existing = [];
    }
  } catch {
    existing = [];
  }

  existing.push(item);

  safeLocalStorageSet(
    'forge3d_events',
    JSON.stringify(
      existing.slice(-500),
    ),
  );
}

/*
 * Os três trackers abaixo permanecem compatíveis com main.tsx,
 * mas são apenas diagnóstico local. Eles não mandam eventos
 * customizados para o Meta Pixel.
 */
export function setupGlobalInteractionTracking() {
  if (!safeWindow()) {
    return () => {};
  }

  const handler = (
    event: MouseEvent,
  ) => {
    const target =
      event.target as
        | HTMLElement
        | null;

    const element =
      target?.closest(
        '[data-track]',
      ) as
        | HTMLElement
        | null;

    if (!element) {
      return;
    }

    trackCustom(
      'ForgeInteraction',
      {
        action:
          element.dataset
            .track || '',
        label:
          element.dataset
            .trackLabel ||
          element.textContent
            ?.trim()
            .slice(0, 80) ||
          '',
      },
    );
  };

  document.addEventListener(
    'click',
    handler,
  );

  return () =>
    document.removeEventListener(
      'click',
      handler,
    );
}

export function setupFormInteractionTracking() {
  if (!safeWindow()) {
    return () => {};
  }

  const handler = (
    event: SubmitEvent,
  ) => {
    const form =
      event.target as
        | HTMLFormElement
        | null;

    if (
      !form?.dataset
        .trackForm
    ) {
      return;
    }

    trackCustom(
      'ForgeFormInteraction',
      {
        form:
          form.dataset
            .trackForm,
      },
    );
  };

  document.addEventListener(
    'submit',
    handler,
  );

  return () =>
    document.removeEventListener(
      'submit',
      handler,
    );
}

export function setupScrollTracking() {
  if (!safeWindow()) {
    return () => {};
  }

  const marks =
    new Set<number>();

  const handler = () => {
    const doc =
      document.documentElement;

    const total =
      Math.max(
        doc.scrollHeight -
          window.innerHeight,
        1,
      );

    const depth =
      Math.round(
        (window.scrollY /
          total) *
          100,
      );

    [25, 50, 75, 90].forEach(
      (mark) => {
        if (
          depth >= mark &&
          !marks.has(mark)
        ) {
          marks.add(mark);

          trackCustom(
            'ScrollDepth',
            {
              percent: mark,
            },
          );
        }
      },
    );
  };

  window.addEventListener(
    'scroll',
    handler,
    {
      passive: true,
    },
  );

  return () =>
    window.removeEventListener(
      'scroll',
      handler,
    );
}
