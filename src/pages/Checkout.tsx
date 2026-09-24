import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import type {
  FormEvent,
} from 'react';

import {
  Link,
} from 'react-router-dom';

import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Copy,
  LockKeyhole,
  QrCode,
  ShieldCheck,
} from 'lucide-react';

import {
  QRCodeSVG,
} from 'qrcode.react';

import type {
  CartItem,
} from '../lib/cart';

import {
  getCartQuantity,
  getCartTotal,
} from '../lib/cart';

import {
  getAttribution,
  trackEvent,
} from '../lib/analytics';

import {
  createStreetPayPayment,
} from '../lib/streetpay';

import {
  saveLead,
} from '../lib/leads';

import {
  supabase,
} from '../lib/supabase';

interface CheckoutForm {
  name: string;
  email: string;
  phone: string;
  cpf: string;
  zip: string;
  address: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
}

type CheckoutStatus =
  | 'idle'
  | 'loading'
  | 'payment-created'
  | 'delivery-preparing'
  | 'not-configured'
  | 'error';

interface PixPayment {
  orderId?: string;
  paymentId?: string;
  amount?: number;
  qrCode?: string;
  copyPaste?: string;
  checkoutUrl?: string;
  expiresAt?: string;
}

type ShippingMethod =
  | 'free'
  | 'sedex10';

/*
 * Prazo fixo exibido para o Frete Grátis.
 *
 * O cliente sempre verá este número exato.
 * Não usamos faixa nem "aproximadamente".
 *
 * Quando o prazo comercial definitivo for definido,
 * basta alterar este único valor.
 */
const FREE_SHIPPING_DAYS = 5;

const SEDEX10_DAYS = 2;
const SEDEX10_PRICE = 29.99;

function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

function formatCep(value: string): string {
  const digits = onlyDigits(value).slice(0, 8);

  if (digits.length <= 5) {
    return digits;
  }

  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function Checkout({
  items,
}: {
  items: CartItem[];
}) {
  const total = useMemo(
    () => getCartTotal(items),
    [items],
  );

  const [form, setForm] =
    useState<CheckoutForm>({
      name: '',
      email: '',
      phone: '',
      cpf: '',
      zip: '',
      address: '',
      number: '',
      complement: '',
      neighborhood: '',
      city: '',
      state: '',
    });

  const [shippingMethod, setShippingMethod] =
    useState<ShippingMethod>('free');

  const [zipLoading, setZipLoading] =
    useState(false);

  const [zipError, setZipError] =
    useState('');

  const [status, setStatus] =
    useState<CheckoutStatus>(
      'idle',
    );

  const [pixPayment, setPixPayment] =
    useState<PixPayment | null>(
      null,
    );

  const [copied, setCopied] =
    useState(false);

  const physical = items.some(
    (item) =>
      item.purchaseType === 'physical',
  );

  const shippingCost =
    physical && shippingMethod === 'sedex10'
      ? SEDEX10_PRICE
      : 0;

  const shippingDays =
    physical && shippingMethod === 'sedex10'
      ? SEDEX10_DAYS
      : FREE_SHIPPING_DAYS;

  const checkoutTotal =
    Number(
      (
        total +
        shippingCost
      ).toFixed(2),
    );

  /*
   * ============================================================
   * CONFIRMAÇÃO AUTOMÁTICA DO PAGAMENTO
   * ============================================================
   *
   * Depois que o PIX é criado, o cliente continua nesta tela.
   * Enquanto isso, consultamos o backend a cada 4 segundos.
   *
   * O Edge Function usa o orderId para ler o status real do
   * pedido no Supabase, já atualizado pelo webhook da StreetPay.
   *
   * Quando o status chega em "paid", trocamos automaticamente
   * para a tela de entrega digital / preparação do pedido.
   */
  useEffect(() => {
    if (
      status !== 'payment-created' ||
      !pixPayment?.orderId
    ) {
      return;
    }

    const orderId = pixPayment.orderId;

    let cancelled = false;
    let checking = false;

    async function checkPaymentStatus() {
      if (cancelled || checking) {
        return;
      }

      checking = true;

      try {
        const {
          data,
          error,
        } = await supabase.functions.invoke(
          'check-payment-status',
          {
            body: {
              orderId,
            },
          },
        );

        if (error) {
          throw error;
        }

        const responseStatus =
          data &&
          typeof data === 'object'
            ? (data as {
                status?: unknown;
              }).status
            : undefined;

        if (
          !cancelled &&
          responseStatus === 'paid'
        ) {
          setStatus(
            'delivery-preparing',
          );
        }
      } catch (error) {
        /*
         * Falha de uma consulta não deve interromper
         * o pagamento nem tirar o cliente da tela do PIX.
         * A próxima tentativa continuará normalmente.
         */
        console.error(
          '[Forge3D] Erro ao consultar status do pagamento:',
          error,
        );
      } finally {
        checking = false;
      }
    }

    void checkPaymentStatus();

    const intervalId =
      window.setInterval(
        () => {
          void checkPaymentStatus();
        },
        4000,
      );

    return () => {
      cancelled = true;
      window.clearInterval(
        intervalId,
      );
    };
  }, [
    status,
    pixPayment?.orderId,
  ]);

  if (!items.length) {
    return (
      <div className="container empty-cart">
        <h1>
          Seu carrinho está vazio.
        </h1>

        <Link to="/stl">
          Voltar aos produtos
        </Link>
      </div>
    );
  }

  function update(
    key: keyof CheckoutForm,
  ) {
    return (
      e: React.ChangeEvent<HTMLInputElement>,
    ) => {
      const value =
        key === 'zip'
          ? formatCep(
              e.target.value,
            )
          : e.target.value;

      setForm(
        (current) => ({
          ...current,
          [key]:
            value,
        }),
      );

      if (key === 'zip') {
        setZipError('');
      }
    };
  }

  async function lookupCep() {
    const cep =
      onlyDigits(form.zip);

    if (cep.length !== 8) {
      setZipError(
        'Digite um CEP válido com 8 números.',
      );
      return;
    }

    setZipLoading(true);
    setZipError('');

    try {
      const response =
        await fetch(
          `https://viacep.com.br/ws/${cep}/json/`,
        );

      if (!response.ok) {
        throw new Error(
          'CEP_REQUEST_FAILED',
        );
      }

      const data =
        await response.json();

      if (data?.erro) {
        throw new Error(
          'CEP_NOT_FOUND',
        );
      }

      setForm(
        (current) => ({
          ...current,

          zip:
            formatCep(cep),

          address:
            data?.logradouro ??
            current.address,

          neighborhood:
            data?.bairro ??
            current.neighborhood,

          city:
            data?.localidade ??
            current.city,

          state:
            data?.uf ??
            current.state,
        }),
      );
    } catch (error) {
      console.error(
        '[Forge3D] CEP lookup error:',
        error,
      );

      setZipError(
        'Não foi possível localizar este CEP. Confira os números e tente novamente.',
      );
    } finally {
      setZipLoading(false);
    }
  }

  async function copyPixCode() {
    if (
      !pixPayment?.copyPaste
    ) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        pixPayment.copyPaste,
      );

      setCopied(true);

      window.setTimeout(
        () => {
          setCopied(false);
        },
        2000,
      );
    } catch (error) {
      console.error(
        '[Forge3D] Não foi possível copiar o PIX:',
        error,
      );

      setCopied(false);
    }
  }

  async function submit(
    e: FormEvent,
  ) {
    e.preventDefault();

    if (
      !form.name.trim() ||
      !form.email.trim()
    ) {
      return;
    }

    if (physical) {
      const hasAddress =
        onlyDigits(form.zip).length === 8 &&
        form.address.trim() &&
        form.number.trim() &&
        form.city.trim() &&
        form.state.trim();

      if (!hasAddress) {
        setZipError(
          'Preencha o endereço de entrega completo antes de continuar.',
        );
        return;
      }
    }

    setStatus('loading');

    /*
     * ==========================================================
     * 1. ATRIBUIÇÃO
     * ==========================================================
     */

    const attribution =
      getAttribution();

    /*
     * ==========================================================
     * 2. LEAD
     * ==========================================================
     */

    trackEvent(
      'Lead',
      {
        content_name:
          'Checkout Forge3D',

        value:
          checkoutTotal,

        currency:
          'BRL',

        shipping_method:
          physical
            ? shippingMethod
            : 'digital',

        shipping:
          shippingCost,
      },
    );

    try {
      await saveLead({
        name:
          form.name,

        email:
          form.email,

        phone:
          form.phone,

        cpfCnpj:
          form.cpf,

        city:
          form.city,

        state:
          form.state,

        event:
          'Lead',
      });
    } catch (error) {
      /*
       * O lead não deve impedir
       * a criação do pagamento.
       */

      console.error(
        '[Forge3D] Lead save error:',
        error,
      );
    }

    /*
     * ==========================================================
     * 3. ADD PAYMENT INFO
     * ==========================================================
     */

    trackEvent(
      'AddPaymentInfo',
      {
        value:
          checkoutTotal,

        currency:
          'BRL',

        content_ids:
          items.map(
            (item) => item.product.id,
          ),

        num_items:
          getCartQuantity(items),

        shipping_method:
          physical
            ? shippingMethod
            : 'digital',

        shipping:
          shippingCost,
      },
    );

    /*
     * ==========================================================
     * 4. CRIA PAGAMENTO
     *
     * O frontend não envia preço.
     * O backend consulta o Supabase.
     * ==========================================================
     */

    try {
      const delivery =
        physical
          ? {
              name:
                form.name,

              zip:
                form.zip,

              address:
                form.address,

              number:
                form.number,

              complement:
                form.complement,

              neighborhood:
                form.neighborhood,

              city:
                form.city,

              state:
                form.state,

              shippingMethod,
              shippingDays,
            }
          : undefined;

      /*
       * O frontend informa somente a modalidade escolhida.
       *
       * O backend continuará sendo responsável por validar
       * o valor definitivo do frete e o total do pedido.
       */
      const paymentRequest = {
        items:
          items.map(
            (item) => ({
              productId:
                item.product.id,

              quantity:
                item.quantity,

              purchaseType:
                item.purchaseType,

              variantId:
                item.variantId ?? null,
            }),
          ),

        customer: {
          name:
            form.name,

          email:
            form.email,

          phone:
            form.phone,

          cpfCnpj:
            form.cpf,
        },

        attribution: {
          utm_source:
            attribution.utm_source,

          utm_medium:
            attribution.utm_medium,

          utm_campaign:
            attribution.utm_campaign,

          utm_content:
            attribution.utm_content,

          utm_term:
            attribution.utm_term,

          fbclid:
            attribution.fbclid,

          referrer:
            attribution.firstReferrer,

          landing_page:
            attribution.firstLandingPage,
        },

        shipping:
          shippingCost,

        shippingMethod,

        shippingDays,

        delivery,
      };

      const result =
        await createStreetPayPayment(
          paymentRequest,
        );

      /*
       * ========================================================
       * 5. PIX CRIADO
       *
       * PENDING / PROCESSING NÃO SIGNIFICA PAGO.
       * ========================================================
       */

      if (
        result.status ===
          'pending' ||
        result.status ===
          'processing'
      ) {
        const payment: PixPayment =
          {
            orderId:
              result.orderId,

            paymentId:
              result.paymentId,

            amount:
              result.amount,

            qrCode:
              result.qrCode,

            copyPaste:
              result.copyPaste,

            checkoutUrl:
              result.checkoutUrl,

            expiresAt:
              result.expiresAt,
          };

        setPixPayment(
          payment,
        );

        setStatus(
          'payment-created',
        );

        /*
         * Evento indicando que o PIX
         * foi efetivamente criado.
         */

        trackEvent(
          'PixGenerated',
          {
            value:
              result.amount ??
              checkoutTotal,

            currency:
              'BRL',

            content_ids:
              items.map(
                (item) => item.product.id,
              ),

            num_items:
              getCartQuantity(items),

            order_id:
              result.orderId,

            payment_id:
              result.paymentId,
          },
        );

        return;
      }

      /*
       * ========================================================
       * 6. CASO RARO: JÁ PAGO
       * ========================================================
       *
       * Ainda não disparamos Purchase aqui.
       * A confirmação definitiva deve vir do backend.
       */

      if (
        result.status ===
        'paid'
      ) {
        setPixPayment({
          orderId:
            result.orderId,

          paymentId:
            result.paymentId,

          amount:
            result.amount,

          qrCode:
            result.qrCode,

          copyPaste:
            result.copyPaste,

          checkoutUrl:
            result.checkoutUrl,

          expiresAt:
            result.expiresAt,
        });

        setStatus(
          'delivery-preparing',
        );

        return;
      }

      /*
       * ========================================================
       * 7. ERRO
       * ========================================================
       */

      setStatus(
        'error',
      );
    } catch (error) {
      console.error(
        '[Forge3D] Checkout error:',
        error,
      );

      if (
        error instanceof Error &&
        error.message ===
          'STREETPAY_NOT_CONFIGURED'
      ) {
        setStatus(
          'not-configured',
        );

        return;
      }

      setStatus(
        'error',
      );
    }
  }

  /*
   * ============================================================
   * ENTREGA EM PREPARAÇÃO
   * ============================================================
   *
   * Esta tela aparece somente quando o backend informa
   * que o pagamento já foi confirmado como "paid".
   *
   * O caso normal "pending/processing" continua mostrando
   * o PIX e aguardando a confirmação.
   */

  if (
    status ===
      'delivery-preparing' &&
    pixPayment
  ) {
    const hasDigitalItems = items.some(
      (item) => item.purchaseType === 'stl',
    );

    const digitalEmail = form.email.trim();

    return (
      <section className="checkout-page">
        <div
          className="container checkout-wrap"
          style={{ maxWidth: '920px' }}
        >
          <div
            className="checkout-head"
            style={{ marginBottom: '22px' }}
          >
            <div>
              <span className="eyebrow">
                PAGAMENTO CONFIRMADO
              </span>

              <h1>
                Tudo certo com seu pedido
              </h1>
            </div>

            <span>
              <LockKeyhole size={15} />
              Ambiente seguro
            </span>
          </div>

          <section
            style={{
              position: 'relative',
              overflow: 'hidden',
              padding: '50px 28px 44px',
              borderRadius: '24px',
              background:
                'linear-gradient(145deg, #101010 0%, #1a1a1a 58%, #252525 100%)',
              color: '#fff',
              textAlign: 'center',
              boxShadow:
                '0 22px 70px rgba(0, 0, 0, 0.18)',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: '-100px',
                left: '-80px',
                width: '260px',
                height: '260px',
                borderRadius: '50%',
                border:
                  '1px solid rgba(255,255,255,.08)',
              }}
            />

            <div
              style={{
                position: 'absolute',
                right: '-80px',
                bottom: '-120px',
                width: '280px',
                height: '280px',
                borderRadius: '50%',
                border:
                  '1px solid rgba(255,255,255,.06)',
              }}
            />

            <div
              style={{
                position: 'relative',
                zIndex: 1,
              }}
            >
              <div
                style={{
                  width: '86px',
                  height: '86px',
                  margin: '0 auto 22px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  background:
                    'rgba(255,255,255,.08)',
                  border:
                    '1px solid rgba(255,255,255,.18)',
                }}
              >
                <div
                  className="forge3d-delivery-spinner"
                  aria-label="Preparando entrega"
                  role="status"
                />
              </div>

              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 13px',
                  marginBottom: '16px',
                  borderRadius: '999px',
                  background:
                    'rgba(255,255,255,.08)',
                  border:
                    '1px solid rgba(255,255,255,.12)',
                  fontSize: '12px',
                  fontWeight: 700,
                  letterSpacing: '.08em',
                }}
              >
                <CheckCircle2 size={15} />
                PAGAMENTO APROVADO
              </div>

              <h2
                style={{
                  margin: 0,
                  fontSize: 'clamp(28px, 5vw, 44px)',
                  lineHeight: 1.05,
                  letterSpacing: '-.03em',
                }}
              >
                {hasDigitalItems
                  ? 'Estamos preparando sua entrega'
                  : 'Seu pedido está confirmado'}
              </h2>

              <p
                style={{
                  maxWidth: '650px',
                  margin: '18px auto 0',
                  color: 'rgba(255,255,255,.72)',
                  fontSize: '15px',
                  lineHeight: 1.7,
                }}
              >
                {hasDigitalItems
                  ? 'Seu pagamento foi confirmado e sua entrega digital está sendo preparada.'
                  : 'Seu pagamento foi confirmado e seu pedido já entrou no próximo estágio.'}
              </p>

              {hasDigitalItems && digitalEmail && (
                <div
                  style={{
                    maxWidth: '560px',
                    margin: '24px auto 0',
                    padding: '16px 18px',
                    borderRadius: '16px',
                    background:
                      'rgba(255,255,255,.06)',
                    border:
                      '1px solid rgba(255,255,255,.10)',
                  }}
                >
                  <span
                    style={{
                      display: 'block',
                      marginBottom: '5px',
                      color:
                        'rgba(255,255,255,.54)',
                      fontSize: '12px',
                      letterSpacing: '.05em',
                      textTransform: 'uppercase',
                    }}
                  >
                    Entrega digital
                  </span>

                  <strong
                    style={{
                      display: 'block',
                      fontSize: '15px',
                      wordBreak: 'break-word',
                    }}
                  >
                    {digitalEmail}
                  </strong>

                  <small
                    style={{
                      display: 'block',
                      marginTop: '6px',
                      color:
                        'rgba(255,255,255,.62)',
                      lineHeight: 1.5,
                    }}
                  >
                    O arquivo será enviado para este e-mail cadastrado.
                  </small>
                </div>
              )}
            </div>
          </section>

          <section
            style={{
              marginTop: '18px',
              padding: '26px',
              borderRadius: '20px',
              background: '#fff',
              border: '1px solid #e8e8e8',
            }}
          >
            <div
              style={{
                display: 'grid',
                gap: '0',
              }}
            >
              {[
                {
                  label: 'Pagamento confirmado',
                  done: true,
                },
                {
                  label: 'Pedido registrado',
                  done: true,
                },
                {
                  label: hasDigitalItems
                    ? 'Preparando arquivo'
                    : 'Pedido em processamento',
                  done: false,
                },
                {
                  label: hasDigitalItems
                    ? 'Entrega digital'
                    : 'Próxima etapa',
                  done: false,
                },
              ].map((step, index) => (
                <div
                  key={step.label}
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      '28px minmax(0,1fr)',
                    gap: '12px',
                    alignItems: 'start',
                    paddingBottom:
                      index < 3 ? '18px' : 0,
                  }}
                >
                  <div
                    style={{
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      background: step.done
                        ? '#111'
                        : '#f1f1f1',
                      color: step.done
                        ? '#fff'
                        : '#777',
                      fontSize: '12px',
                      fontWeight: 800,
                    }}
                  >
                    {step.done
                      ? '✓'
                      : index === 2
                        ? '•'
                        : index + 1}

                    {index < 3 && (
                      <span
                        style={{
                          position: 'absolute',
                          top: '28px',
                          left: '50%',
                          width: '1px',
                          height: '18px',
                          transform:
                            'translateX(-50%)',
                          background: '#e2e2e2',
                        }}
                      />
                    )}
                  </div>

                  <div>
                    <strong
                      style={{
                        display: 'block',
                        fontSize: '14px',
                        lineHeight: 1.35,
                      }}
                    >
                      {step.label}
                    </strong>

                    <span
                      style={{
                        display: 'block',
                        marginTop: '4px',
                        color: '#777',
                        fontSize: '12px',
                        lineHeight: 1.5,
                      }}
                    >
                      {step.done
                        ? 'Concluído'
                        : index === 2
                          ? 'Estamos finalizando esta etapa.'
                          : 'Aguardando conclusão da etapa anterior.'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                marginTop: '24px',
                paddingTop: '20px',
                borderTop: '1px solid #eeeeee',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '10px',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span
                style={{
                  color: '#777',
                  fontSize: '12px',
                }}
              >
                Pedido
              </span>

              <strong
                style={{
                  fontSize: '12px',
                  wordBreak: 'break-all',
                }}
              >
                {pixPayment.orderId ?? '—'}
              </strong>
            </div>

            <p
              style={{
                margin: '14px 0 0',
                color: '#777',
                fontSize: '12px',
                lineHeight: 1.6,
              }}
            >
              Guarde este número para consultar seu pedido.
            </p>
          </section>

          <div
            style={{
              marginTop: '18px',
              padding: '18px 20px',
              borderRadius: '16px',
              background: '#f6f6f6',
              border: '1px solid #e9e9e9',
              display: 'flex',
              gap: '12px',
              alignItems: 'flex-start',
            }}
          >
            <ShieldCheck
              size={19}
              style={{
                flexShrink: 0,
                marginTop: '1px',
              }}
            />

            <p
              style={{
                margin: 0,
                color: '#555',
                fontSize: '13px',
                lineHeight: 1.6,
              }}
            >
              Seu pagamento foi confirmado com segurança.
              {hasDigitalItems
                ? ' A entrega digital está sendo preparada para o e-mail informado no checkout.'
                : ' O pedido seguirá para o processamento da Forge3D.'}
            </p>
          </div>
        </div>

        <style>{`
          .forge3d-delivery-spinner {
            width: 56px;
            height: 56px;
            border-radius: 50%;
            border: 3px solid rgba(255,255,255,.18);
            border-top-color: #fff;
            animation: forge3d-spin 1s linear infinite;
          }

          @keyframes forge3d-spin {
            to { transform: rotate(360deg); }
          }

          @media (prefers-reduced-motion: reduce) {
            .forge3d-delivery-spinner {
              animation: none;
            }
          }
        `}</style>
      </section>
    );
  }

  /*
   * ============================================================
   * PIX GERADO
   * ============================================================
   */

  if (
    status ===
      'payment-created' &&
    pixPayment
  ) {
    const hasCopyPaste =
      Boolean(
        pixPayment.copyPaste,
      );

    const hasImageQrCode =
      Boolean(
        pixPayment.qrCode,
      );

    return (
      <section className="checkout-page">
        <div className="container checkout-wrap">

          <div className="checkout-head">
            <div>
              <span className="eyebrow">
                PAGAMENTO VIA PIX
              </span>

              <h1>
                Seu PIX foi gerado
              </h1>
            </div>

            <span>
              <LockKeyhole
                size={15}
              />

              Ambiente seguro
            </span>
          </div>

          <div
            className="checkout-grid"
            style={{
              alignItems:
                'start',
            }}
          >

            <div className="checkout-form">

              <section>

                <div
                  style={{
                    textAlign:
                      'center',

                    padding:
                      '20px 10px 10px',
                  }}
                >

                  <CheckCircle2
                    size={48}
                    style={{
                      marginBottom:
                        '12px',
                    }}
                  />

                  <h2>
                    PIX pronto para pagamento
                  </h2>

                  <p>
                    Escaneie o QR Code
                    com o celular ou
                    copie o código PIX.
                  </p>

                </div>

                {/*
                 * ==================================================
                 * QR CODE
                 *
                 * Se o provedor de pagamento entregar uma imagem/URL,
                 * usamos essa imagem.
                 *
                 * Caso contrário, geramos o QR diretamente
                 * através do Copia e Cola.
                 * ==================================================
                 */}

                {hasCopyPaste && (
                  <div
                    style={{
                      display:
                        'flex',

                      flexDirection:
                        'column',

                      alignItems:
                        'center',

                      justifyContent:
                        'center',

                      margin:
                        '24px 0 30px',

                      padding:
                        '20px',

                      background:
                        '#ffffff',

                      border:
                        '1px solid #e5e5e5',

                      borderRadius:
                        '16px',
                    }}
                  >

                    {hasImageQrCode ? (
                      <img
                        src={
                          pixPayment.qrCode
                        }
                        alt="QR Code PIX"
                        style={{
                          width:
                            '280px',

                          height:
                            '280px',

                          maxWidth:
                            '100%',

                          objectFit:
                            'contain',

                          borderRadius:
                            '12px',

                          background:
                            '#ffffff',
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width:
                            '280px',

                          height:
                            '280px',

                          maxWidth:
                            '100%',

                          display:
                            'flex',

                          alignItems:
                            'center',

                          justifyContent:
                            'center',

                          background:
                            '#ffffff',

                          border:
                            '1px solid #eeeeee',

                          borderRadius:
                            '12px',

                          padding:
                            '10px',

                          boxSizing:
                            'border-box',
                        }}
                      >

                        <QRCodeSVG
                          value={
                            pixPayment.copyPaste!
                          }
                          size={
                            250
                          }
                          level="M"
                          includeMargin
                          bgColor="#ffffff"
                          fgColor="#111111"
                        />

                      </div>
                    )}

                    <strong
                      style={{
                        display:
                          'block',

                        marginTop:
                          '18px',

                        fontSize:
                          '15px',

                        textAlign:
                          'center',
                      }}
                    >
                      Escaneie para pagar
                    </strong>

                    <span
                      style={{
                        display:
                          'block',

                        marginTop:
                          '6px',

                        fontSize:
                          '13px',

                        color:
                          '#666',

                        textAlign:
                          'center',
                      }}
                    >
                      Abra o aplicativo do
                      seu banco e escaneie
                      este código.
                    </span>

                  </div>
                )}

                {/*
                 * ==================================================
                 * CASO EXTREMAMENTE RARO
                 *
                 * Se não vier nem QR nem Copia e Cola,
                 * mostramos uma mensagem clara.
                 * ==================================================
                 */}

                {!hasCopyPaste &&
                  !hasImageQrCode && (
                    <div
                      className="setup-alert error"
                      style={{
                        marginTop:
                          '20px',
                      }}
                    >
                      <strong>
                        Não recebemos o código PIX.
                      </strong>

                      <span>
                        O pagamento foi criado,
                        mas não recebemos os dados do PIX.
                      </span>
                    </div>
                  )}

                {/*
                 * ==================================================
                 * PIX COPIA E COLA
                 * ==================================================
                 */}

                {pixPayment.copyPaste && (
                  <div
                    style={{
                      marginTop:
                        '20px',
                    }}
                  >

                    <label
                      style={{
                        display:
                          'block',

                        marginBottom:
                          '8px',

                        fontWeight:
                          600,
                      }}
                    >
                      PIX Copia e Cola
                    </label>

                    <textarea
                      readOnly
                      value={
                        pixPayment.copyPaste
                      }
                      rows={5}
                      aria-label="Código PIX Copia e Cola"
                      style={{
                        width:
                          '100%',

                        resize:
                          'none',

                        padding:
                          '12px',

                        border:
                          '1px solid #ddd',

                        borderRadius:
                          '10px',

                        fontSize:
                          '13px',

                        fontFamily:
                          'monospace',

                        boxSizing:
                          'border-box',
                      }}
                    />

                    <button
                      type="button"
                      className="main-buy"
                      onClick={
                        copyPixCode
                      }
                      style={{
                        marginTop:
                          '12px',

                        width:
                          '100%',
                      }}
                    >

                      <Copy
                        size={18}
                      />

                      {copied
                        ? 'PIX COPIADO!'
                        : 'COPIAR PIX'}

                    </button>

                  </div>
                )}

                {/*
                 * ==================================================
                 * CHECKOUT EXTERNO
                 * ==================================================
                 */}

                {pixPayment.checkoutUrl && (
                  <a
                    href={
                      pixPayment.checkoutUrl
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="main-buy"
                    style={{
                      marginTop:
                        '12px',

                      display:
                        'flex',

                      alignItems:
                        'center',

                      justifyContent:
                        'center',

                      textDecoration:
                        'none',
                    }}
                  >
                    ABRIR PAGAMENTO

                    <ArrowRight
                      size={18}
                    />
                  </a>
                )}

                {/*
                 * ==================================================
                 * AGUARDANDO PAGAMENTO
                 * ==================================================
                 */}

                <div
                  className="setup-alert"
                  style={{
                    marginTop:
                      '20px',
                  }}
                >

                  <strong>
                    Aguardando pagamento
                  </strong>

                  <span>
                    O pedido só será
                    considerado pago depois
                    que o pagamento for
                    confirmado automaticamente.
                  </span>

                </div>

                {/*
                 * ==================================================
                 * PEDIDO
                 * ==================================================
                 */}

                {pixPayment.orderId && (
                  <p
                    style={{
                      marginTop:
                        '16px',

                      fontSize:
                        '13px',

                      opacity:
                        0.7,

                      textAlign:
                        'center',
                    }}
                  >
                    Pedido:{' '}
                    {pixPayment.orderId}
                  </p>
                )}

              </section>

            </div>

            {/*
             * ====================================================
             * RESUMO
             * ====================================================
             */}

            <aside className="summary checkout-summary">

              <h2>
                Resumo da compra
              </h2>

              {items.map(
                (item) => (
                  <div
                    className="summary-product"
                    key={`${item.product.id}-${item.purchaseType}`}
                  >

                    <img
                      src={
                        item.product.image
                      }
                      alt=""
                    />

                    <span>
                      {item.product.name}

                      <small>
                        {item.purchaseType ===
                        'stl'
                          ? 'STL digital'
                          : 'Modelo impresso'}
                      </small>
                    </span>

                    <strong>
                      R${' '}
                      {(
                        (item.purchaseType === 'stl'
                          ? item.product.stlPrice
                          : item.product.printedPrice) *
                        item.quantity
                      )
                        .toFixed(2)
                        .replace(
                          '.',
                          ',',
                        )}
                    </strong>

                  </div>
                ),
              )}

              <hr />

              <div>
                <span>
                  Subtotal
                </span>

                <strong>
                  R${' '}
                  {total
                    .toFixed(2)
                    .replace(
                      '.',
                      ',',
                    )}
                </strong>
              </div>

              <div>
                <span>
                  Frete
                </span>

                <strong>
                  {physical
                    ? shippingMethod ===
                      'sedex10'
                      ? `SEDEX 10 — R$ ${shippingCost
                          .toFixed(2)
                          .replace(
                            '.',
                            ',',
                          )}`
                      : `Correios — Frete grátis — ${shippingDays} dias úteis`
                    : 'Sem frete'}
                </strong>
              </div>

              <div className="summary-total">

                <span>
                  Total
                </span>

                <strong>
                  R${' '}
                  {(
                    pixPayment.amount ??
                    checkoutTotal
                  )
                    .toFixed(2)
                    .replace(
                      '.',
                      ',',
                    )}
                </strong>

              </div>

              <div className="secure-list">

                <span>
                  <ShieldCheck
                    size={16}
                  />

                  Compra segura
                </span>

                <span>
                  <CheckCircle2
                    size={16}
                  />

                  Confirmação automática
                </span>

              </div>

            </aside>

          </div>

        </div>
      </section>
    );
  }

  /*
   * ============================================================
   * CHECKOUT NORMAL
   * ============================================================
   */

  return (
    <section className="checkout-page">

      <div className="container checkout-wrap">

        <Link
          to="/carrinho"
          className="back-link"
        >
          <ArrowLeft
            size={16}
          />

          Voltar ao carrinho
        </Link>

        <div className="checkout-head">

          <div>

            <span className="eyebrow">
              FINALIZE COM SEGURANÇA
            </span>

            <h1>
              Seu pedido
            </h1>

          </div>

          <span>
            <LockKeyhole
              size={15}
            />

            Ambiente seguro
          </span>

        </div>

        <form
          onSubmit={submit}
          className="checkout-grid"
        >

          <div className="checkout-form">

            <section>

              <h2>
                1. Seus dados
              </h2>

              <div className="form-grid">

                <label>
                  Nome completo

                  <input
                    required
                    value={
                      form.name
                    }
                    onChange={
                      update(
                        'name',
                      )
                    }
                    autoComplete="name"
                  />
                </label>

                <label>
                  E-mail

                  <input
                    required
                    type="email"
                    value={
                      form.email
                    }
                    onChange={
                      update(
                        'email',
                      )
                    }
                    autoComplete="email"
                  />
                </label>

                <label>
                  WhatsApp

                  <input
                    value={
                      form.phone
                    }
                    onChange={
                      update(
                        'phone',
                      )
                    }
                    autoComplete="tel"
                  />
                </label>

                <label>
                  CPF/CNPJ

                  <input
                    value={
                      form.cpf
                    }
                    onChange={
                      update(
                        'cpf',
                      )
                    }
                    autoComplete="off"
                  />
                </label>

              </div>

            </section>

            {physical && (
              <section>

                <h2>
                  2. Entrega
                </h2>

                <div className="form-grid">

                  <label>
                    CEP

                    <input
                      value={
                        form.zip
                      }
                      onChange={
                        update(
                          'zip',
                        )
                      }
                      onBlur={
                        lookupCep
                      }
                      required
                      inputMode="numeric"
                      maxLength={9}
                      autoComplete="postal-code"
                      placeholder="00000-000"
                    />

                    {zipLoading && (
                      <small
                        className="checkout-field-status"
                      >
                        Consultando CEP...
                      </small>
                    )}

                    {zipError && (
                      <small
                        className="checkout-field-error"
                      >
                        {zipError}
                      </small>
                    )}
                  </label>

                  <label>
                    Endereço

                    <input
                      value={
                        form.address
                      }
                      onChange={
                        update(
                          'address',
                        )
                      }
                      required
                      autoComplete="street-address"
                      placeholder="Rua / Avenida"
                    />
                  </label>

                  <label>
                    Número

                    <input
                      value={
                        form.number
                      }
                      onChange={
                        update(
                          'number',
                        )
                      }
                      required
                      inputMode="numeric"
                      autoComplete="address-line2"
                    />
                  </label>

                  <label>
                    Complemento

                    <input
                      value={
                        form.complement
                      }
                      onChange={
                        update(
                          'complement',
                        )
                      }
                      autoComplete="address-line2"
                      placeholder="Apartamento, bloco..."
                    />
                  </label>

                  <label>
                    Bairro

                    <input
                      value={
                        form.neighborhood
                      }
                      onChange={
                        update(
                          'neighborhood',
                        )
                      }
                      required
                      autoComplete="address-level3"
                    />
                  </label>

                  <label>
                    Cidade

                    <input
                      value={
                        form.city
                      }
                      onChange={
                        update(
                          'city',
                        )
                      }
                      required
                      autoComplete="address-level2"
                    />
                  </label>

                  <label>
                    Estado

                    <input
                      value={
                        form.state
                      }
                      onChange={
                        update(
                          'state',
                        )
                      }
                      maxLength={2}
                      required
                      autoComplete="address-level1"
                    />
                  </label>

                </div>

                <div
                  className="shipping-options"
                  aria-label="Forma de envio"
                >

                  <div className="shipping-options-head">
                    <strong>
                      3. Forma de envio
                    </strong>

                    <span>
                      Enviado pelos Correios
                    </span>
                  </div>

                  <label
                    className={`shipping-option ${
                      shippingMethod ===
                      'free'
                        ? 'is-selected'
                        : ''
                    }`}
                  >
                    <input
                      type="radio"
                      name="shippingMethod"
                      value="free"
                      checked={
                        shippingMethod ===
                        'free'
                      }
                      onChange={() =>
                        setShippingMethod(
                          'free',
                        )
                      }
                    />

                    <span className="shipping-option-content">
                      <strong>
                        Correios —
                        Frete Grátis
                      </strong>

                      <small>
                        Prazo: {FREE_SHIPPING_DAYS} dias úteis
                      </small>
                    </span>

                    <strong>
                      R$ 0,00
                    </strong>
                  </label>

                  <label
                    className={`shipping-option ${
                      shippingMethod ===
                      'sedex10'
                        ? 'is-selected'
                        : ''
                    }`}
                  >
                    <input
                      type="radio"
                      name="shippingMethod"
                      value="sedex10"
                      checked={
                        shippingMethod ===
                        'sedex10'
                      }
                      onChange={() =>
                        setShippingMethod(
                          'sedex10',
                        )
                      }
                    />

                    <span className="shipping-option-content">
                      <strong>
                        Correios —
                        SEDEX 10
                      </strong>

                      <small>
                        Prazo: {SEDEX10_DAYS} dias úteis
                      </small>
                    </span>

                    <strong>
                      R$ 29,99
                    </strong>
                  </label>

                </div>

              </section>
            )}

            <section>

              <h2>
                {physical
                  ? '4'
                  : '2'}
                . Pagamento
              </h2>

              <div className="payment-option">

                <QrCode
                  size={24}
                />

                <div>

                  <strong>
                    PIX
                  </strong>

                  <span>
                    Pagamento rápido via PIX
                    com confirmação automática.
                  </span>

                </div>

                <span className="payment-check">
                  ✓
                </span>

              </div>

              {status ===
                'not-configured' && (
                <div className="setup-alert">

                  <strong>
                    PIX ainda não configurado.
                  </strong>

                  <span>
                    O pagamento via PIX está
                    temporariamente indisponível.
                  </span>

                </div>
              )}

              {status ===
                'error' && (
                <div className="setup-alert error">

                  <strong>
                    Não foi possível iniciar
                    o pagamento.
                  </strong>

                  <span>
                    Tente novamente em alguns
                    instantes.
                  </span>

                </div>
              )}

            </section>

            <button
              type="submit"
              className="main-buy checkout-submit"
              disabled={
                status ===
                'loading'
              }
              data-track="checkout-submit"
              data-track-label="Gerar PIX agora"
            >

              {status ===
              'loading'
                ? 'GERANDO PIX...'
                : 'GERAR PIX AGORA'}

              <ArrowRight
                size={18}
              />

            </button>

          </div>

          {/*
           * ======================================================
           * RESUMO DA COMPRA
           * ======================================================
           */}

          <aside className="summary checkout-summary">

            <h2>
              Resumo da compra
            </h2>

            {items.map(
                (item) => (
                <div
                  className="summary-product"
                  key={`${item.product.id}-${item.purchaseType}`}
                >

                  <img
                    src={
                      item.product.image
                    }
                    alt=""
                  />

                  <span>
                    {item.product.name}

                    <small>
                      {item.purchaseType ===
                      'stl'
                        ? 'STL digital'
                        : 'Modelo impresso'}
                    </small>
                  </span>

                  <strong>
                    R${' '}
                    {(
                      (item.purchaseType === 'stl'
                        ? item.product.stlPrice
                        : item.product.printedPrice) *
                      item.quantity
                    )
                        .toFixed(2)
                      .replace(
                        '.',
                        ',',
                      )}
                  </strong>

                </div>
              ),
            )}

            <hr />

            <div>

              <span>
                Subtotal
              </span>

              <strong>
                R${' '}
                {total
                  .toFixed(2)
                  .replace(
                    '.',
                    ',',
                  )}
              </strong>

            </div>

            <div>

              <span>
                Frete
              </span>

              <strong>
                {physical
                  ? shippingMethod ===
                    'sedex10'
                    ? `SEDEX 10 — R$ ${shippingCost
                        .toFixed(2)
                        .replace(
                          '.',
                          ',',
                        )}`
                    : `Correios — Frete grátis — ${shippingDays} dias úteis`
                  : 'Sem frete'}
              </strong>

            </div>

            <div className="summary-total">

              <span>
                Total
              </span>

              <strong>
                R${' '}
                {checkoutTotal
                  .toFixed(2)
                  .replace(
                    '.',
                    ',',
                  )}
              </strong>

            </div>

            <div className="secure-list">

              <span>
                <ShieldCheck
                  size={16}
                />

                Compra segura
              </span>

              <span>
                <CheckCircle2
                  size={16}
                />

                Acesso após confirmação
              </span>

            </div>

          </aside>

        </form>

      </div>

    </section>
  );
}