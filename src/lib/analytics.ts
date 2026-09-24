let pixelInitialized = false;
let lastPath = '';

type Fbq = ((
  ...args: unknown[]
) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[];
  loaded?: boolean;
  version?: string;
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
};

function safeWindow() {
  return typeof window !== 'undefined';
}

function getFbq(): Fbq | undefined {
  if (!safeWindow()) return undefined;

  return (window as unknown as {
    fbq?: Fbq;
  }).fbq;
}

function safeLocalStorageGet(
  key: string
): string | null {
  if (!safeWindow()) return null;

  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeLocalStorageSet(
  key: string,
  value: string
) {
  if (!safeWindow()) return;

  try {
    window.localStorage.setItem(
      key,
      value
    );
  } catch {
    // Não interrompe o funcionamento
    // caso o localStorage esteja indisponível.
  }
}

function safeSessionStorageGet(
  key: string
): string | null {
  if (!safeWindow()) return null;

  try {
    return window.sessionStorage.getItem(
      key
    );
  } catch {
    return null;
  }
}

function safeSessionStorageSet(
  key: string,
  value: string
) {
  if (!safeWindow()) return;

  try {
    window.sessionStorage.setItem(
      key,
      value
    );
  } catch {
    // Ignora falhas de sessionStorage.
  }
}

function generateEventId(
  prefix = 'forge3d'
) {
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
      window.location.search
    );

  let existing: Partial<Attribution> =
    {};

  try {
    existing = JSON.parse(
      safeLocalStorageGet(
        'forge3d_attribution'
      ) || '{}'
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
    JSON.stringify(current)
  );

  return current;
}

export function initMetaPixel(
  pixelId: string
) {
  if (
    !safeWindow() ||
    !pixelId ||
    pixelInitialized
  ) {
    return;
  }

  const w = window as unknown as {
    fbq?: Fbq;
    _fbq?: Fbq;
  };

  if (w.fbq) {
    pixelInitialized = true;
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

  f.callMethod = undefined;
  f.queue = [];
  f.loaded = true;
  f.version = '2.0';

  w.fbq = f;
  w._fbq = f;

  const script =
    document.createElement(
      'script'
    );

  script.async = true;

  script.src =
    'https://connect.facebook.net/en_US/fbevents.js';

  document.head.appendChild(
    script
  );

  f('init', pixelId);

  pixelInitialized = true;
}

export function trackPageView(
  path: string
) {
  if (!safeWindow()) return;

  if (path === lastPath) {
    return;
  }

  lastPath = path;

  getFbq()?.(
    'track',
    'PageView'
  );

  pushEvent(
    'PageView',
    {
      path,
    }
  );
}

export function trackEvent(
  event: string,
  payload: Record<
    string,
    unknown
  > = {},
  eventId?: string
) {
  if (!safeWindow()) return;

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
      }
    );
  }

  pushEvent(
    event,
    {
      ...payload,
      event_id: id,
    }
  );

  return id;
}

/**
 * Visualização de produto.
 *
 * Proteção contra duplicação imediata,
 * especialmente durante React StrictMode
 * em desenvolvimento.
 */
export function trackViewContent(
  payload: {
    content_ids?: string[];
    content_name?: string;
    content_type?: string;
    value?: number;
    currency?: string;
  }
) {
  const productId =
    payload.content_ids?.[0] ||
    payload.content_name ||
    'unknown';

  const storageKey =
    `forge3d_viewcontent_${productId}`;

  /*
   * Se este produto já foi registrado
   * nesta sessão, não dispara novamente.
   */
  if (
    safeSessionStorageGet(
      storageKey
    )
  ) {
    return;
  }

  safeSessionStorageSet(
    storageKey,
    '1'
  );

  return trackEvent(
    'ViewContent',
    {
      content_type:
        'product',

      currency:
        'BRL',

      ...payload,
    }
  );
}

export function trackSearch(
  payload: {
    search_string: string;
    content_category?: string;
  }
) {
  return trackEvent(
    'Search',
    {
      ...payload,
    }
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
  }
) {
  return trackEvent(
    'AddToCart',
    {
      content_type:
        'product',

      currency:
        'BRL',

      ...payload,
    }
  );
}

export function trackAddToWishlist(
  payload: {
    content_ids?: string[];
    content_name?: string;
    content_type?: string;
    value?: number;
    currency?: string;
  }
) {
  return trackEvent(
    'AddToWishlist',
    {
      content_type:
        'product',

      currency:
        'BRL',

      ...payload,
    }
  );
}

export function trackInitiateCheckout(
  payload: {
    content_ids?: string[];
    value: number;
    currency?: string;
    num_items?: number;
  }
) {
  return trackEvent(
    'InitiateCheckout',
    {
      currency:
        'BRL',

      ...payload,
    }
  );
}

export function trackAddPaymentInfo(
  payload: {
    value?: number;
    currency?: string;
    content_ids?: string[];
  }
) {
  return trackEvent(
    'AddPaymentInfo',
    {
      currency:
        'BRL',

      ...payload,
    }
  );
}

export function trackLead(
  payload: {
    content_name?: string;
    value?: number;
    currency?: string;
  }
) {
  return trackEvent(
    'Lead',
    {
      ...payload,
    }
  );
}

export function trackContact(
  payload: {
    content_name?: string;
    content_category?: string;
  }
) {
  return trackEvent(
    'Contact',
    {
      ...payload,
    }
  );
}

/**
 * Purchase.
 *
 * IMPORTANTE:
 *
 * Esta função deve ser chamada somente
 * após confirmação real do pagamento.
 *
 * Nunca no simples clique do botão
 * de pagamento.
 */
export function trackPurchase(
  payload: PurchasePayload
) {
  const eventId =
    payload.event_id ||
    generateEventId(
      'purchase'
    );

  const {
    event_id: _eventId,
    ...purchaseData
  } = payload;

  return trackEvent(
    'Purchase',
    {
      currency:
        'BRL',

      ...purchaseData,
    },
    eventId
  );
}

export function trackCustom(
  event: string,
  payload: Record<
    string,
    unknown
  > = {},
  eventId?: string
) {
  if (!safeWindow()) return;

  const id =
    eventId ||
    generateEventId(event);

  const fb = getFbq();

  if (fb) {
    fb(
      'trackCustom',
      event,
      payload,
      {
        eventID: id,
      }
    );
  }

  pushEvent(
    event,
    {
      ...payload,
      event_id: id,
    }
  );

  return id;
}

function pushEvent(
  event: string,
  payload: Record<
    string,
    unknown
  >
) {
  if (!safeWindow()) return;

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
    existing = JSON.parse(
      safeLocalStorageGet(
        'forge3d_events'
      ) || '[]'
    );

    if (
      !Array.isArray(existing)
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
      existing.slice(-500)
    )
  );
}

export function setupGlobalInteractionTracking() {
  if (!safeWindow()) {
    return () => {};
  }

  const handler = (
    event: MouseEvent
  ) => {
    const target =
      event.target as HTMLElement | null;

    const element =
      target?.closest(
        '[data-track]'
      ) as HTMLElement | null;

    if (!element) {
      return;
    }

    trackCustom(
      'ForgeInteraction',
      {
        action:
          element.dataset.track ||
          '',

        label:
          element.dataset.trackLabel ||
          element.textContent
            ?.trim()
            .slice(0, 80) ||
          '',
      }
    );
  };

  document.addEventListener(
    'click',
    handler
  );

  return () =>
    document.removeEventListener(
      'click',
      handler
    );
}

export function setupFormInteractionTracking() {
  if (!safeWindow()) {
    return () => {};
  }

  const handler = (
    event: SubmitEvent
  ) => {
    const form =
      event.target as HTMLFormElement | null;

    if (
      !form?.dataset.trackForm
    ) {
      return;
    }

    trackCustom(
      'ForgeFormInteraction',
      {
        form:
          form.dataset.trackForm,
      }
    );
  };

  document.addEventListener(
    'submit',
    handler
  );

  return () =>
    document.removeEventListener(
      'submit',
      handler
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
        1
      );

    const depth =
      Math.round(
        (window.scrollY /
          total) *
          100
      );

    [
      25,
      50,
      75,
      90,
    ].forEach(
      (mark) => {
        if (
          depth >= mark &&
          !marks.has(mark)
        ) {
          marks.add(mark);

          trackCustom(
            'ScrollDepth',
            {
              percent:
                mark,
            }
          );
        }
      }
    );
  };

  window.addEventListener(
    'scroll',
    handler,
    {
      passive: true,
    }
  );

  return () =>
    window.removeEventListener(
      'scroll',
      handler
    );
}