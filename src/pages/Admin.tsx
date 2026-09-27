
import { ProductMediaManager } from '../components/admin/ProductMediaManager';
import { ProductVariantManager } from '../components/admin/ProductVariantManager';
import { ProductFileManager } from '../components/admin/ProductFileManager';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import {
  BarChart3,
  CheckCircle2,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  FolderPlus,
  LogIn,
  LogOut,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

type Lead = {
  id: string;
  date: string;
  name: string;
  email: string;
  state: string;
  city: string;
  source: string;
  medium: string;
  campaign: string;
  content: string;
  referrer: string;
  landing: string;
  event: string;
};

type AdminLeadRow = {
  id: string;
  created_at: string;
  name: string;
  email: string;
  phone: string | null;
  city: string | null;
  state: string | null;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  referrer: string | null;
  landing_page: string | null;
  event_name: string | null;
};

function toLead(row: AdminLeadRow): Lead {
  return {
    id: row.id,
    date: new Date(row.created_at).toLocaleString('pt-BR'),
    name: row.name,
    email: row.email,
    state: row.state ?? '',
    city: row.city ?? '',
    source: row.source ?? '',
    medium: row.medium ?? '',
    campaign: row.campaign ?? '',
    content: row.content ?? '',
    referrer: row.referrer ?? '',
    landing: row.landing_page ?? '',
    event: row.event_name ?? 'Lead',
  };
}

type ProductType = 'stl' | 'physical';

type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

type ProductLandingTemplate = 'product' | 'turbo';

type LandingBenefit = {
  title: string;
  text: string;
};

type LandingFaq = {
  question: string;
  answer: string;
};

type Product = {
  id: string;
  category_id: string | null;
  name: string;
  slug: string;
  description: string;
  product_type: ProductType;

  stl_price: number;
  printed_price: number;
  compare_stl_price: number | null;
  compare_printed_price: number | null;

  stl_enabled: boolean | null;
  printed_enabled: boolean | null;

  landing_template: ProductLandingTemplate | null;
  landing_badge: string | null;
  landing_title: string | null;
  landing_subtitle: string | null;
  landing_description: string | null;
  landing_why_title: string | null;
  landing_why_description: string | null;
  landing_benefits: unknown;
  landing_stl_points: unknown;
  landing_printed_points: unknown;
  landing_detail_title: string | null;
  landing_detail_description: string | null;
  landing_faq: unknown;
  landing_final_title: string | null;
  landing_final_description: string | null;

  // Campos legados mantidos para compatibilidade.
  price: number;
  compare_price: number | null;

  thumbnail_url: string | null;
  active: boolean;
  featured: boolean;
  is_new: boolean;
  is_best_seller: boolean;
  created_at: string;
  updated_at: string;
  categories?: {
    name: string;
  } | null;
};

type ProductForm = {
  name: string;
  slug: string;
  description: string;
  product_type: ProductType;

  stl_enabled: boolean;
  printed_enabled: boolean;

  stl_price: string;
  compare_stl_price: string;
  printed_price: string;
  compare_printed_price: string;

  thumbnail_url: string;
  category_id: string;

  landing_template: ProductLandingTemplate;
  landing_badge: string;
  landing_title: string;
  landing_subtitle: string;
  landing_description: string;
  landing_why_title: string;
  landing_why_description: string;
  landing_benefits: LandingBenefit[];
  landing_stl_points: string[];
  landing_printed_points: string[];
  landing_detail_title: string;
  landing_detail_description: string;
  landing_faq: LandingFaq[];
  landing_final_title: string;
  landing_final_description: string;

  active: boolean;
  featured: boolean;
  is_new: boolean;
  is_best_seller: boolean;
};


type PaidOrder = {
  id: string;
  customerName: string;
  customerEmail: string;
  total: number;
  paymentMethod: string;
  paidAt: string | null;
  createdAt: string;
  items: Array<{
    productName: string;
    quantity: number;
    productType: ProductType;
    totalPrice: number;
  }>;
};

const emptyProductForm: ProductForm = {
  name: '',
  slug: '',
  description: '',
  product_type: 'stl',

  stl_enabled: true,
  printed_enabled: true,

  stl_price: '',
  compare_stl_price: '',
  printed_price: '',
  compare_printed_price: '',

  thumbnail_url: '',
  category_id: '',

  landing_template: 'product',
  landing_badge: 'OFERTA ESPECIAL',
  landing_title: '',
  landing_subtitle: '',
  landing_description: '',
  landing_why_title: '',
  landing_why_description: '',
  landing_benefits: [
    { title: '', text: '' },
    { title: '', text: '' },
    { title: '', text: '' },
    { title: '', text: '' },
  ],
  landing_stl_points: [
    '',
    '',
    '',
  ],
  landing_printed_points: [
    '',
    '',
    '',
  ],
  landing_detail_title: '',
  landing_detail_description: '',
  landing_faq: [
    { question: '', answer: '' },
    { question: '', answer: '' },
    { question: '', answer: '' },
  ],
  landing_final_title: '',
  landing_final_description: '',

  active: true,
  featured: false,
  is_new: false,
  is_best_seller: false,
};

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function formatCurrency(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return '—';
  }

  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function parsePrice(value: string): number {
  const cleaned = value
    .replace(/R\$\s*/gi, '')
    .replace(/\s/g, '')
    .trim();

  if (!cleaned) {
    return 0;
  }

  if (cleaned.includes(',')) {
    return Number(
      cleaned
        .replace(/\./g, '')
        .replace(',', '.'),
    );
  }

  // Sem vírgula, preserva 19.90 como decimal,
  // mas entende 1.099 como mil e noventa e nove.
  if (
    /^\d+(?:\.\d{3})+$/.test(
      cleaned,
    )
  ) {
    return Number(
      cleaned.replace(/\./g, ''),
    );
  }

  return Number(cleaned);
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

function toLandingBenefits(value: unknown): LandingBenefit[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (
        typeof item === 'object' &&
        item !== null
      ) {
        const candidate =
          item as Record<string, unknown>;

        return {
          title:
            typeof candidate.title === 'string'
              ? candidate.title.trim()
              : '',
          text:
            typeof candidate.text === 'string'
              ? candidate.text.trim()
              : '',
        };
      }

      if (typeof item === 'string') {
        return {
          title: item.trim(),
          text: '',
        };
      }

      return {
        title: '',
        text: '',
      };
    })
    .filter((item) => item.title || item.text);
}

function toLandingFaq(value: unknown): LandingFaq[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (
        typeof item !== 'object' ||
        item === null
      ) {
        return {
          question: '',
          answer: '',
        };
      }

      const candidate =
        item as Record<string, unknown>;

      return {
        question:
          typeof candidate.question === 'string'
            ? candidate.question.trim()
            : '',
        answer:
          typeof candidate.answer === 'string'
            ? candidate.answer.trim()
            : '',
      };
    })
    .filter((item) => item.question && item.answer);
}

function cleanAdminText(value: string): string {
  return value
    .replace(/#{1,6}\s*/g, '')
    .replace(/[*_`~]/g, '')
    .replace(
      /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu,
      '',
    )
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function AdminGate() {
  const [loading, setLoading] = useState(true);
  const [logged, setLogged] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const checkAdminSession = useCallback(async () => {
    setLoading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        setLogged(false);
        setUserEmail('');
        return;
      }

      const { data: isAdmin, error: adminError } =
        await supabase.rpc('is_admin');

      if (adminError) {
        console.error('[Admin] Erro ao verificar administrador:', adminError);
        setLogged(false);
        setUserEmail('');
        setError(
          'Não foi possível verificar as permissões administrativas.',
        );
        return;
      }

      if (!isAdmin) {
        await supabase.auth.signOut();
        setLogged(false);
        setUserEmail('');
        setError('Este usuário não possui permissão de administrador.');
        return;
      }

      setLogged(true);
      setUserEmail(session.user.email ?? '');
      setError('');
    } catch (sessionError) {
      console.error('[Admin] Erro de sessão:', sessionError);
      setLogged(false);
      setUserEmail('');
      setError('Não foi possível validar sua sessão.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void checkAdminSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void checkAdminSession();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [checkAdminSession]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError('');

    if (!email.trim() || !password) {
      setError('Informe seu e-mail e sua senha.');
      return;
    }

    setAuthLoading(true);

    try {
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (loginError) {
        setError('E-mail ou senha inválidos.');
        return;
      }

      await checkAdminSession();
    } catch (loginException) {
      console.error('[Admin] Erro no login:', loginException);
      setError('Não foi possível realizar o login.');
    } finally {
      setAuthLoading(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    setLogged(false);
    setUserEmail('');
    setEmail('');
    setPassword('');
  }

  if (loading) {
    return (
      <div className="admin-login">
        <div className="admin-login-card">
          <RefreshCw className="spin" size={24} />
          <p>Verificando sessão administrativa...</p>
        </div>
      </div>
    );
  }

  if (!logged) {
    return (
      <AdminLogin
        email={email}
        password={password}
        error={error}
        loading={authLoading}
        onEmailChange={setEmail}
        onPasswordChange={setPassword}
        onSubmit={login}
      />
    );
  }

  return (
    <AdminDashboard
      userEmail={userEmail}
      onLogout={logout}
    />
  );
}

type AdminLoginProps = {
  email: string;
  password: string;
  error: string;
  loading: boolean;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

function AdminLogin({
  email,
  password,
  error,
  loading,
  onEmailChange,
  onPasswordChange,
  onSubmit,
}: AdminLoginProps) {
  return (
    <div className="admin-login">
      <div className="admin-login-card">
        <div className="brand brand-admin">
          <span className="brand-mark">
            <i></i>
            <b></b>
          </span>

          <span>
            FORGE<span>3D</span>
          </span>
        </div>

        <span className="eyebrow">ÁREA RESTRITA</span>

        <h1>Painel administrativo</h1>

        <p>
          Acesse o painel para administrar produtos, acompanhar leads e
          gerenciar a operação da Forge3D.
        </p>

        <form onSubmit={onSubmit}>
          <label>
            E-mail
            <input
              type="email"
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
              autoComplete="email"
              placeholder="seu@email.com"
              required
            />
          </label>

          <label>
            Senha
            <input
              type="password"
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
              autoComplete="current-password"
              placeholder="Sua senha"
              required
            />
          </label>

          {error && <div className="login-error">{error}</div>}

          <button
            type="submit"
            className="main-buy"
            disabled={loading}
          >
            {loading ? (
              <>
                <RefreshCw className="spin" size={17} />
                ENTRANDO...
              </>
            ) : (
              <>
                <LogIn size={17} />
                ENTRAR
              </>
            )}
          </button>
        </form>

        <small className="demo-warning">
          O acesso é validado pelo Supabase Auth e pelo perfil administrativo.
        </small>
      </div>
    </div>
  );
}

type AdminDashboardProps = {
  userEmail: string;
  onLogout: () => void;
};

function AdminDashboard({
  userEmail,
  onLogout,
}: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'products'>(
    'overview',
  );

  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div className="brand">
          <span className="brand-mark">
            <i></i>
            <b></b>
          </span>

          <span>
            FORGE<span>3D</span>
          </span>
        </div>

        <div className="admin-header-actions">
          <span className="admin-user-email">{userEmail}</span>

          <a href="/" className="admin-store-link">
            <ExternalLink size={16} />
            VER LOJA
          </a>

          <button type="button" onClick={onLogout}>
            <LogOut size={16} />
            SAIR
          </button>
        </div>
      </header>

      <div className="admin-tabs container">
        <button
          type="button"
          className={activeTab === 'overview' ? 'active' : ''}
          onClick={() => setActiveTab('overview')}
        >
          <BarChart3 size={17} />
          Dashboard
        </button>

        <button
          type="button"
          className={activeTab === 'products' ? 'active' : ''}
          onClick={() => setActiveTab('products')}
        >
          <Package size={17} />
          Produtos
        </button>
      </div>

      {activeTab === 'overview' ? (
        <OverviewDashboard />
      ) : (
        <ProductManager
          refreshKey={refreshKey}
          onRefresh={() => setRefreshKey((value) => value + 1)}
        />
      )}
    </div>
  );
}


function OverviewDashboard() {
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);

  return (
    <div>
      <PaidOrdersDashboard refreshKey={dashboardRefreshKey} />

      <LeadDashboard
        refreshKey={dashboardRefreshKey}
        onRefresh={() => setDashboardRefreshKey((value) => value + 1)}
      />
    </div>
  );
}

type PaidOrdersDashboardProps = {
  refreshKey: number;
};

function PaidOrdersDashboard({
  refreshKey,
}: PaidOrdersDashboardProps) {
  const [payments, setPayments] = useState<PaidOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [modeFilter, setModeFilter] = useState<'all' | ProductType>('all');

  const loadPaidOrders = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    try {
      const { data, error } = await supabase.rpc('get_admin_paid_orders');

      if (error) {
        throw error;
      }

      const rows = (data ?? []) as Array<{
        id: string;
        customer_name: string;
        customer_email: string;
        total: number | string | null;
        payment_method: string | null;
        paid_at: string | null;
        created_at: string;
        items: unknown;
      }>;

      const mapped: PaidOrder[] = rows.map((row) => {
        const rawItems = Array.isArray(row.items)
          ? row.items
          : [];

        const items = rawItems
          .filter(
            (item): item is Record<string, unknown> =>
              Boolean(item) && typeof item === 'object',
          )
          .map((item) => ({
            productName:
              typeof item.productName === 'string'
                ? item.productName
                : 'Produto',
            quantity: Number(item.quantity ?? 0),
            productType: (
              String(item.productType ?? '').toLowerCase() === 'physical'
                ? 'physical'
                : 'stl'
            ) as ProductType,
            totalPrice: Number(item.totalPrice ?? 0),
          }));

        return {
          id: row.id,
          customerName: row.customer_name,
          customerEmail: row.customer_email,
          total: Number(row.total ?? 0),
          paymentMethod: row.payment_method ?? 'PIX',
          paidAt: row.paid_at,
          createdAt: row.created_at,
          items,
        };
      });

      setPayments(mapped);
    } catch (loadException) {
      console.error(
        '[Admin] Erro ao carregar pedidos pagos:',
        loadException,
      );

      setLoadError(
        'Não foi possível carregar os pedidos pagos. Verifique a função administrativa get_admin_paid_orders e as permissões do usuário.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPaidOrders();
  }, [loadPaidOrders, refreshKey]);

  const filteredPayments = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return payments.filter((order) => {
      const matchesSearch =
        !normalizedSearch ||
        [
          order.customerName,
          order.customerEmail,
          order.id,
          ...order.items.map((item) => item.productName),
        ]
          .join(' ')
          .toLowerCase()
          .includes(normalizedSearch);

      const matchesMode =
        modeFilter === 'all' ||
        order.items.some((item) => item.productType === modeFilter);

      return matchesSearch && matchesMode;
    });
  }, [payments, search, modeFilter]);

  const totalRevenue = useMemo(
    () =>
      payments.reduce(
        (total, order) => total + order.total,
        0,
      ),
    [payments],
  );

  const stlQuantity = useMemo(
    () =>
      payments.reduce(
        (total, order) =>
          total +
          order.items
            .filter((item) => item.productType === 'stl')
            .reduce((sum, item) => sum + item.quantity, 0),
        0,
      ),
    [payments],
  );

  const printedQuantity = useMemo(
    () =>
      payments.reduce(
        (total, order) =>
          total +
          order.items
            .filter((item) => item.productType === 'physical')
            .reduce((sum, item) => sum + item.quantity, 0),
        0,
      ),
    [payments],
  );

  return (
    <main className="container admin-main">
      <div className="admin-title">
        <div>
          <span className="eyebrow">VENDAS CONFIRMADAS</span>
          <h1>Pedidos pagos</h1>
          <p>
            Acompanhe em tempo real os clientes com pagamento confirmado.
          </p>
        </div>

        <div className="admin-title-actions">
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => void loadPaidOrders()}
            disabled={loading}
          >
            <RefreshCw size={17} className={loading ? 'spin' : undefined} />
            ATUALIZAR
          </button>
        </div>
      </div>

      {loadError && (
        <div className="admin-alert error">{loadError}</div>
      )}

      <div className="stats-grid">
        <Stat
          icon={<CheckCircle2 />}
          label="PEDIDOS PAGOS"
          value={String(payments.length)}
        />

        <Stat
          icon={<BarChart3 />}
          label="FATURAMENTO"
          value={formatCurrency(totalRevenue)}
        />

        <Stat
          icon={<Package />}
          label="STLs VENDIDOS"
          value={String(stlQuantity)}
        />

        <Stat
          icon={<ShoppingCart />}
          label="MODELOS IMPRESSOS"
          value={String(printedQuantity)}
        />
      </div>

      <section className="admin-panel">
        <div className="panel-head">
          <div>
            <h2>Clientes que pagaram</h2>
            <p>
              Somente pedidos cujo pagamento já foi confirmado pelo sistema.
            </p>
          </div>

          <div className="admin-filters">
            <label>
              <Search size={15} />

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar cliente, e-mail ou pedido..."
              />
            </label>

            <select
              value={modeFilter}
              onChange={(event) =>
                setModeFilter(event.target.value as 'all' | ProductType)
              }
            >
              <option value="all">Todos</option>
              <option value="stl">STL</option>
              <option value="physical">Impresso</option>
            </select>
          </div>
        </div>

        <div className="lead-table-wrap">
          <table>
            <thead>
              <tr>
                <th>DATA</th>
                <th>CLIENTE</th>
                <th>PEDIDO</th>
                <th>PRODUTOS</th>
                <th>MODALIDADE</th>
                <th>VALOR</th>
                <th>PAGAMENTO</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7}>Carregando pedidos pagos...</td>
                </tr>
              ) : filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    Nenhum pagamento confirmado ainda.
                  </td>
                </tr>
              ) : (
                filteredPayments.map((order) => {
                  const modes = Array.from(
                    new Set(order.items.map((item) => item.productType)),
                  );

                  const hasDigital = modes.includes('stl');
                  const hasPhysical = modes.includes('physical');

                  return (
                    <tr key={order.id}>
                      <td>
                        {new Date(
                          order.paidAt ?? order.createdAt,
                        ).toLocaleString('pt-BR')}
                      </td>

                      <td>
                        <strong>{order.customerName}</strong>
                        <small>{order.customerEmail}</small>
                      </td>

                      <td>
                        <strong>#{order.id.slice(0, 8).toUpperCase()}</strong>
                        <small>{order.id}</small>
                      </td>

                      <td>
                        {order.items.length === 0 ? (
                          '—'
                        ) : (
                          order.items.map((item, index) => (
                            <div key={`${item.productName}-${index}`}>
                              <strong>
                                {item.quantity}x {item.productName}
                              </strong>
                              <small>
                                {formatCurrency(item.totalPrice)}
                              </small>
                            </div>
                          ))
                        )}
                      </td>

                      <td>
                        <div>
                          {hasDigital && (
                            <span className="event-pill success">
                              STL
                            </span>
                          )}

                          {hasPhysical && (
                            <span
                              className="event-pill"
                              style={{ marginLeft: '0.4rem' }}
                            >
                              IMPRESSO
                            </span>
                          )}
                        </div>
                      </td>

                      <td>
                        <strong>{formatCurrency(order.total)}</strong>
                      </td>

                      <td>
                        <span className="event-pill success">
                          <CheckCircle2 size={13} />
                          {order.paymentMethod}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function LeadDashboard({
  refreshKey,
  onRefresh,
}: {
  refreshKey: number;
  onRefresh: () => void;
}) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [search, setSearch] = useState('');
  const [state, setState] = useState('Todos');
  const [source, setSource] = useState('Todos');

  const loadLeads = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    try {
      const { data, error } = await supabase.rpc('get_admin_leads');

      if (error) {
        throw error;
      }

      setLeads(
        ((data ?? []) as AdminLeadRow[]).map(toLead),
      );
    } catch (loadException) {
      console.error('[Admin] Erro ao carregar leads:', loadException);
      setLoadError(
        'Não foi possível carregar os leads. Verifique as permissões administrativas.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLeads();
  }, [loadLeads, refreshKey]);

  const states = Array.from(
    new Set(leads.map((lead) => lead.state).filter(Boolean)),
  ).sort();

  const sources = Array.from(
    new Set(leads.map((lead) => lead.source).filter(Boolean)),
  ).sort();

  const filtered = useMemo(() => {
    const normalizedSearch = search.toLowerCase();

    return leads.filter((lead) => {
      const matchesState =
        state === 'Todos' || lead.state === state;

      const matchesSource =
        source === 'Todos' || lead.source === source;

      const searchableText = [
        lead.name,
        lead.email,
        lead.campaign,
        lead.city,
        lead.source,
      ]
        .join(' ')
        .toLowerCase();

      return (
        matchesState &&
        matchesSource &&
        searchableText.includes(normalizedSearch)
      );
    });
  }, [leads, search, state, source]);

  const byState = states
    .map((currentState) => ({
      state: currentState,
      count: leads.filter((lead) => lead.state === currentState).length,
    }))
    .sort((a, b) => b.count - a.count);

  function exportCsv() {
    const rows = [
      [
        'Data',
        'Nome',
        'Email',
        'Estado',
        'Cidade',
        'Origem',
        'Mídia',
        'Campanha',
        'Conteúdo',
        'Referrer',
        'Landing',
        'Evento',
      ],
      ...filtered.map((lead) => [
        lead.date,
        lead.name,
        lead.email,
        lead.state,
        lead.city,
        lead.source,
        lead.medium,
        lead.campaign,
        lead.content,
        lead.referrer,
        lead.landing,
        lead.event,
      ]),
    ];

    const csv = rows
      .map((row) =>
        row
          .map((value) => `"${String(value).replaceAll('"', '""')}"`)
          .join(';'),
      )
      .join('\n');

    const blob = new Blob([`\uFEFF${csv}`], {
      type: 'text/csv;charset=utf-8;',
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = 'forge3d-leads.csv';
    anchor.click();

    URL.revokeObjectURL(url);
  }

  return (
    <main className="container admin-main">
      <div className="admin-title">
        <div>
          <span className="eyebrow">CENTRAL DE CONTROLE</span>
          <h1>Dashboard</h1>
          <p>
            Visão comercial da Forge3D e origem dos visitantes.
          </p>
        </div>

        <div className="admin-title-actions">
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => {
              onRefresh();
              void loadLeads();
            }}
            disabled={loading}
          >
            <RefreshCw size={17} />
            ATUALIZAR
          </button>

          <button
            type="button"
            className="btn btn-dark"
            onClick={exportCsv}
            disabled={filtered.length === 0}
          >
            <Download size={17} />
            EXPORTAR LEADS
          </button>
        </div>
      </div>

      {loadError && (
        <div className="admin-alert error">{loadError}</div>
      )}

      <div className="stats-grid">
        <Stat
          icon={<Users />}
          label="LEADS"
          value={String(leads.length)}
        />

        <Stat
          icon={<ShoppingCart />}
          label="EVENTOS DE COMPRA"
          value={String(
            leads.filter((lead) => lead.event === 'Purchase').length,
          )}
        />

        <Stat
          icon={<BarChart3 />}
          label="CAMPANHAS"
          value={String(
            new Set(
              leads.map((lead) => lead.campaign).filter(Boolean),
            ).size,
          )}
        />

        <Stat
          icon={<Package />}
          label="ESTADOS"
          value={String(states.length)}
        />
      </div>

      <section className="admin-panel">
        <div className="panel-head">
          <div>
            <h2>Leads por estado</h2>
            <p>
              Distribuição dos registros capturados pela plataforma.
            </p>
          </div>
        </div>

        <div className="state-bars">
          {byState.map((item) => (
            <div className="state-row" key={item.state}>
              <strong>{item.state}</strong>

              <div>
                <i
                  style={{
                    width: `${Math.max(
                      10,
                      (item.count / Math.max(leads.length, 1)) * 100,
                    )}%`,
                  }}
                ></i>
              </div>

              <span>{item.count}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="admin-panel">
        <div className="panel-head">
          <div>
            <h2>Origem dos leads</h2>
            <p>
              Use UTMs para comparar campanhas, anúncios e canais.
            </p>
          </div>

          <div className="admin-filters">
            <label>
              <Search size={15} />

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar lead..."
              />
            </label>

            <select
              value={state}
              onChange={(event) => setState(event.target.value)}
            >
              <option>Todos</option>

              {states.map((currentState) => (
                <option key={currentState}>{currentState}</option>
              ))}
            </select>

            <select
              value={source}
              onChange={(event) => setSource(event.target.value)}
            >
              <option>Todos</option>

              {sources.map((currentSource) => (
                <option key={currentSource}>{currentSource}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="lead-table-wrap">
          <table>
            <thead>
              <tr>
                <th>DATA</th>
                <th>LEAD</th>
                <th>UF</th>
                <th>ORIGEM</th>
                <th>CAMPANHA</th>
                <th>LANDING</th>
                <th>EVENTO</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7}>Carregando leads...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7}>Nenhum lead encontrado.</td>
                </tr>
              ) : filtered.map((lead) => (
                <tr key={lead.id}>
                  <td>{lead.date}</td>

                  <td>
                    <strong>{lead.name}</strong>
                    <small>{lead.email}</small>
                  </td>

                  <td>{lead.state || '—'}</td>

                  <td>
                    {lead.source || 'direto'}
                    <small>{lead.medium}</small>
                  </td>

                  <td>
                    {lead.campaign || '—'}
                    <small>{lead.content}</small>
                  </td>

                  <td>{lead.landing}</td>

                  <td>
                    <span className="event-pill">{lead.event}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-panel">
        <div className="panel-head">
          <div>
            <h2>Configurações de aquisição</h2>
            <p>
              Informações básicas das integrações configuradas no projeto.
            </p>
          </div>
        </div>

        <div className="config-grid">
          <div>
            <strong>Meta Pixel</strong>
            <span>VITE_META_PIXEL_ID</span>
            <code>
              {import.meta.env.VITE_META_PIXEL_ID ||
                'NÃO CONFIGURADO'}
            </code>
          </div>

          <div>
            <strong>Supabase</strong>
            <span>Banco, Auth, Storage e RLS</span>
            <code>
              {import.meta.env.VITE_SUPABASE_URL
                ? 'CONFIGURADO'
                : 'AGUARDANDO URL'}
            </code>
          </div>

          <div>
            <strong>StreetPay</strong>
            <span>Gateway server-side</span>
            <code>CONFIGURADO NO BACKEND</code>
          </div>
        </div>
      </section>
    </main>
  );
}

type ProductManagerProps = {
  refreshKey: number;
  onRefresh: () => void;
};

function ProductManager({
  refreshKey,
  onRefresh,
}: ProductManagerProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | ProductType>(
    'all',
  );

  const [formOpen, setFormOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(
    null,
  );

  const [form, setForm] = useState<ProductForm>(emptyProductForm);

  const [newCategoryName, setNewCategoryName] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [
        { data: productsData, error: productsError },
        { data: categoriesData, error: categoriesError },
      ] = await Promise.all([
        supabase
          .from('products')
          .select('*, categories(name)')
          .order('created_at', { ascending: false }),

        supabase
          .from('categories')
          .select('*')
          .order('name', { ascending: true }),
      ]);

      if (productsError) {
        throw productsError;
      }

      if (categoriesError) {
        throw categoriesError;
      }

      setProducts((productsData ?? []) as Product[]);
      setCategories((categoriesData ?? []) as Category[]);
    } catch (loadError) {
      console.error('[Admin] Erro ao carregar catálogo:', loadError);
      setError(
        'Não foi possível carregar os produtos e categorias.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog, refreshKey]);

  const filteredProducts = useMemo(() => {
    const normalizedSearch = search.toLowerCase();

    return products.filter((product) => {
      const matchesType =
        typeFilter === 'all' || product.product_type === typeFilter;

      const searchableText = [
        product.name,
        product.slug,
        product.description,
        product.categories?.name ?? '',
      ]
        .join(' ')
        .toLowerCase();

  return (
        matchesType &&
        searchableText.includes(normalizedSearch)
      );
    });
  }, [products, search, typeFilter]);

  function updateForm<K extends keyof ProductForm>(
    field: K,
    value: ProductForm[K],
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function openCreateForm() {
    setEditingProductId(null);
    setForm(emptyProductForm);
    setError('');
    setSuccess('');
    setFormOpen(true);
  }

  function openEditForm(product: Product) {
    const benefits = toLandingBenefits(
      product.landing_benefits,
    );

    const faqs = toLandingFaq(product.landing_faq);

    setEditingProductId(product.id);

    setForm({
      name: product.name,
      slug: product.slug,
      description: product.description,
      product_type: product.product_type,

      stl_enabled:
        product.stl_enabled ??
        (Number(product.stl_price ?? product.price) > 0),

      printed_enabled:
        product.printed_enabled ??
        (Number(product.printed_price ?? 0) > 0),

      stl_price: String(
        product.stl_price ?? product.price,
      ),

      compare_stl_price:
        product.compare_stl_price !== null &&
        product.compare_stl_price !== undefined
          ? String(product.compare_stl_price)
          : product.compare_price !== null
            ? String(product.compare_price)
            : '',

      printed_price: String(
        product.printed_price ?? 0,
      ),

      compare_printed_price:
        product.compare_printed_price !== null &&
        product.compare_printed_price !== undefined
          ? String(product.compare_printed_price)
          : '',

      thumbnail_url:
        product.thumbnail_url ?? '',
      category_id:
        product.category_id ?? '',

      landing_template:
        product.landing_template === 'turbo'
          ? 'turbo'
          : 'product',

      landing_badge:
        product.landing_badge ?? '',

      landing_title:
        product.landing_title ?? product.name,

      landing_subtitle:
        product.landing_subtitle ?? '',

      landing_description:
        product.landing_description ??
        '',

      landing_why_title:
        product.landing_why_title ?? '',

      landing_why_description:
        product.landing_why_description ??
        '',

      landing_benefits:
        benefits.length > 0
          ? [
              ...benefits,
              ...Array.from(
                {
                  length: Math.max(
                    0,
                    4 - benefits.length,
                  ),
                },
                () => ({
                  title: '',
                  text: '',
                }),
              ),
            ].slice(0, 4)
          : emptyProductForm.landing_benefits.map(
              (item) => ({ ...item }),
            ),

      landing_stl_points:
        [
          ...toStringArray(
            product.landing_stl_points,
          ),
          '',
          '',
          '',
        ].slice(0, 4),

      landing_printed_points:
        [
          ...toStringArray(
            product.landing_printed_points,
          ),
          '',
          '',
          '',
        ].slice(0, 4),

      landing_detail_title:
        product.landing_detail_title ?? '',

      landing_detail_description:
        product.landing_detail_description ??
        '',

      landing_faq:
        faqs.length > 0
          ? [
              ...faqs,
              ...Array.from(
                {
                  length: Math.max(
                    0,
                    4 - faqs.length,
                  ),
                },
                () => ({
                  question: '',
                  answer: '',
                }),
              ),
            ].slice(0, 4)
          : emptyProductForm.landing_faq.map(
              (item) => ({ ...item }),
            ),

      landing_final_title:
        product.landing_final_title ?? '',

      landing_final_description:
        product.landing_final_description ??
        '',

      active: product.active,
      featured: product.featured,
      is_new: product.is_new,
      is_best_seller: product.is_best_seller,
    });

    setError('');
    setSuccess('');
    setFormOpen(true);
  }

  function closeForm() {
    if (saving) {
      return;
    }

    setFormOpen(false);
    setEditingProductId(null);
    setForm(emptyProductForm);
  }

  async function saveProduct(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError('');
    setSuccess('');

    const name = cleanAdminText(form.name);
    const slug = slugify(form.slug || name);

    const stlPrice = parsePrice(form.stl_price);
    const printedPrice = parsePrice(
      form.printed_price,
    );

    const compareStlPrice =
      form.compare_stl_price.trim()
        ? parsePrice(
            form.compare_stl_price,
          )
        : null;

    const comparePrintedPrice =
      form.compare_printed_price.trim()
        ? parsePrice(
            form.compare_printed_price,
          )
        : null;

    const landingBenefits =
      form.landing_benefits
        .map((item) => ({
          title: cleanAdminText(
            item.title,
          ),
          text: cleanAdminText(
            item.text,
          ),
        }))
        .filter(
          (item) =>
            item.title ||
            item.text,
        );

    const landingStlPoints =
      form.landing_stl_points
        .map((item) =>
          cleanAdminText(item),
        )
        .filter(Boolean);

    const landingPrintedPoints =
      form.landing_printed_points
        .map((item) =>
          cleanAdminText(item),
        )
        .filter(Boolean);

    const landingFaq =
      form.landing_faq
        .map((item) => ({
          question: cleanAdminText(
            item.question,
          ),
          answer: cleanAdminText(
            item.answer,
          ),
        }))
        .filter(
          (item) =>
            item.question &&
            item.answer,
        );

    if (!name) {
      setError('Informe o nome do produto.');
      return;
    }

    if (!slug) {
      setError('Informe um slug válido.');
      return;
    }

    if (
      !form.stl_enabled &&
      !form.printed_enabled
    ) {
      setError(
        'Ative pelo menos uma modalidade de venda.',
      );
      return;
    }

    if (
      form.stl_enabled &&
      (!Number.isFinite(stlPrice) ||
        stlPrice <= 0)
    ) {
      setError(
        'Informe um preço válido para o STL ou desative a modalidade STL.',
      );
      return;
    }

    if (
      form.printed_enabled &&
      (!Number.isFinite(
        printedPrice,
      ) ||
        printedPrice <= 0)
    ) {
      setError(
        'Informe um preço válido para o modelo impresso ou desative essa modalidade.',
      );
      return;
    }

    if (
      compareStlPrice !== null &&
      (!Number.isFinite(
        compareStlPrice,
      ) ||
        compareStlPrice <= stlPrice)
    ) {
      setError(
        'O preço anterior do STL deve ser maior que o preço atual.',
      );
      return;
    }

    if (
      comparePrintedPrice !==
        null &&
      (!Number.isFinite(
        comparePrintedPrice,
      ) ||
        comparePrintedPrice <=
          printedPrice)
    ) {
      setError(
        'O preço anterior do modelo impresso deve ser maior que o preço atual.',
      );
      return;
    }

    setSaving(true);

    try {
      if (!editingProductId) {
        const { data: slugExists, error: slugError } =
          await supabase
            .from('products')
            .select('id')
            .eq('slug', slug)
            .limit(1)
            .maybeSingle();

        if (slugError) {
          throw slugError;
        }

        if (slugExists) {
          setError(
            'Este slug já está sendo usado por outro produto.',
          );
          return;
        }
      } else {
        const { data: slugExists, error: slugError } =
          await supabase
            .from('products')
            .select('id')
            .eq('slug', slug)
            .neq('id', editingProductId)
            .limit(1)
            .maybeSingle();

        if (slugError) {
          throw slugError;
        }

        if (slugExists) {
          setError(
            'Este slug já está sendo usado por outro produto.',
          );
          return;
        }
      }

      const payload = {
        category_id:
          form.category_id || null,

        name,
        slug,
        description:
          form.description.trim(),
        product_type:
          form.product_type,

        stl_enabled:
          form.stl_enabled,

        printed_enabled:
          form.printed_enabled,

        stl_price:
          form.stl_enabled
            ? stlPrice
            : 0,

        compare_stl_price:
          form.stl_enabled
            ? compareStlPrice
            : null,

        printed_price:
          form.printed_enabled
            ? printedPrice
            : 0,

        compare_printed_price:
          form.printed_enabled
            ? comparePrintedPrice
            : null,

        // Compatibilidade com o código antigo.
        price:
          form.stl_enabled
            ? stlPrice
            : form.printed_enabled
              ? printedPrice
              : 0,

        compare_price:
          form.stl_enabled
            ? compareStlPrice
            : null,

        thumbnail_url:
          form.thumbnail_url.trim() ||
          null,

        landing_template:
          form.landing_template,

        landing_badge:
          cleanAdminText(
            form.landing_badge,
          ) || null,

        landing_title:
          cleanAdminText(
            form.landing_title,
          ) || name,

        landing_subtitle:
          cleanAdminText(
            form.landing_subtitle,
          ) || null,

        landing_description:
          cleanAdminText(
            form.landing_description,
          ) || null,

        landing_why_title:
          cleanAdminText(
            form.landing_why_title,
          ) || null,

        landing_why_description:
          cleanAdminText(
            form.landing_why_description,
          ) || null,

        landing_benefits:
          landingBenefits,

        landing_stl_points:
          landingStlPoints,

        landing_printed_points:
          landingPrintedPoints,

        landing_detail_title:
          cleanAdminText(
            form.landing_detail_title,
          ) || null,

        landing_detail_description:
          cleanAdminText(
            form.landing_detail_description,
          ) || null,

        landing_faq:
          landingFaq,

        landing_final_title:
          cleanAdminText(
            form.landing_final_title,
          ) || name,

        landing_final_description:
          cleanAdminText(
            form.landing_final_description,
          ) || null,

        active:
          form.active,
        featured: form.featured,
        is_new: form.is_new,
        is_best_seller:
          form.is_best_seller,

        updated_at:
          new Date().toISOString(),
      };

      if (editingProductId) {
        const {
          error: updateError,
        } = await supabase
          .from('products')
          .update(payload)
          .eq(
            'id',
            editingProductId,
          );

        if (updateError) {
          throw updateError;
        }

        setSuccess(
          'Produto e configuração da landing atualizados com sucesso.',
        );
      } else {
        const {
          data: insertedProduct,
          error: insertError,
        } = await supabase
          .from('products')
          .insert(payload)
          .select('id')
          .single();

        if (insertError) {
          throw insertError;
        }

        setEditingProductId(
          insertedProduct.id,
        );

        setSuccess(
          form.stl_enabled
            ? 'Produto cadastrado como rascunho até o arquivo STL ser enviado. Adicione as mídias, envie o STL e depois ative o produto.'
            : 'Produto cadastrado. Agora adicione as mídias e confira a landing.',
        );
      }

      await loadCatalog();
      onRefresh();
    } catch (saveError) {
      console.error(
        '[Admin] Erro ao salvar produto:',
        saveError,
      );

      const message =
        saveError instanceof Error
          ? saveError.message
          : 'Erro desconhecido ao salvar produto.';

      setError(
        `Não foi possível salvar o produto: ${message}`,
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleProductStatus(product: Product) {
    const action = product.active ? 'desativar' : 'ativar';

    const confirmed = window.confirm(
      `Deseja ${action} o produto "${product.name}"?`,
    );

    if (!confirmed) {
      return;
    }

    setError('');
    setSuccess('');

    try {
      const { error: updateError } = await supabase
        .from('products')
        .update({
          active: !product.active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', product.id);

      if (updateError) {
        throw updateError;
      }

      setSuccess(
        product.active
          ? 'Produto desativado.'
          : 'Produto ativado.',
      );

      await loadCatalog();
      onRefresh();
    } catch (toggleError) {
      console.error(
        '[Admin] Erro ao alterar status do produto:',
        toggleError,
      );

      setError('Não foi possível alterar o status do produto.');
    }
  }

  async function createCategory() {
    const name = newCategoryName.trim();

    if (!name) {
      return;
    }

    setCreatingCategory(true);
    setError('');
    setSuccess('');

    try {
      const { data, error: categoryError } = await supabase
        .from('categories')
        .insert({
          name,
          slug: slugify(name),
          description: null,
          image_url: null,
          active: true,
          updated_at: new Date().toISOString(),
        })
        .select('*')
        .single();

      if (categoryError) {
        throw categoryError;
      }

      setCategories((current) =>
        [...current, data as Category].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      );

      updateForm('category_id', data.id);
      setNewCategoryName('');
      setSuccess('Categoria criada com sucesso.');
    } catch (categoryError) {
      console.error(
        '[Admin] Erro ao criar categoria:',
        categoryError,
      );

      setError(
        'Não foi possível criar a categoria. Verifique se o slug já existe.',
      );
    } finally {
      setCreatingCategory(false);
    }
  }

      function updateLandingBenefit(
    index: number,
    field: keyof LandingBenefit,
    value: string,
  ) {
    setForm((current) => {
      const benefits =
        current.landing_benefits.map(
          (item, itemIndex) =>
            itemIndex === index
              ? {
                  ...item,
                  [field]: value,
                }
              : item,
        );

      return {
        ...current,
        landing_benefits:
          benefits,
      };
    });
  }

  function updateLandingPoint(
    field:
      | 'landing_stl_points'
      | 'landing_printed_points',
    index: number,
    value: string,
  ) {
    setForm((current) => ({
      ...current,
      [field]: current[field].map(
        (item, itemIndex) =>
          itemIndex === index
            ? value
            : item,
      ),
    }));
  }

  function updateLandingFaq(
    index: number,
    field: keyof LandingFaq,
    value: string,
  ) {
    setForm((current) => ({
      ...current,
      landing_faq:
        current.landing_faq.map(
          (item, itemIndex) =>
            itemIndex === index
              ? {
                  ...item,
                  [field]: value,
                }
              : item,
        ),
    }));
  }

  function openLandingPreview() {
    const slug = slugify(
      form.slug || form.name,
    );

    if (!slug) {
      setError(
        'Defina o slug antes de abrir a oferta.',
      );
      return;
    }

    window.open(
      `/oferta/${slug}`,
      '_blank',
      'noopener,noreferrer',
    );
  }


  return (
    <main className="container admin-main">
      <div className="admin-title">
        <div>
          <span className="eyebrow">CATÁLOGO</span>
          <h1>Produtos</h1>
          <p>
            Gerencie os produtos que serão disponibilizados na loja.
          </p>
        </div>

        <div className="admin-title-actions">
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => void loadCatalog()}
            disabled={loading}
          >
            <RefreshCw size={17} />
            ATUALIZAR
          </button>

          <button
            type="button"
            className="btn btn-dark"
            onClick={openCreateForm}
          >
            <Plus size={17} />
            NOVO PRODUTO
          </button>
        </div>
      </div>

      {error && <div className="admin-alert error">{error}</div>}

      {success && (
        <div className="admin-alert success">
          <CheckCircle2 size={17} />
          {success}
        </div>
      )}

      <div className="stats-grid">
        <Stat
          icon={<Package />}
          label="PRODUTOS"
          value={String(products.length)}
        />

        <Stat
          icon={<CheckCircle2 />}
          label="ATIVOS"
          value={String(
            products.filter((product) => product.active).length,
          )}
        />

        <Stat
          icon={<BarChart3 />}
          label="ARQUIVOS STL"
          value={String(
            products.filter(
              (product) =>
                product.stl_enabled ??
                product.stl_price > 0,
            ).length,
          )}
        />

        <Stat
          icon={<ShoppingCart />}
          label="IMPRESSÃO 3D"
          value={String(
            products.filter(
              (product) =>
                product.printed_enabled ??
                product.printed_price > 0,
            ).length,
          )}
        />
      </div>

      {formOpen && (
        <section className="admin-panel product-form-panel">
          <div className="panel-head">
            <div>
              <h2>
                {editingProductId
                  ? 'Editar produto'
                  : 'Cadastrar produto'}
              </h2>

              <p>
                Preencha os dados principais do produto.
              </p>
            </div>

            <button
              type="button"
              className="icon-button"
              onClick={closeForm}
              disabled={saving}
              aria-label="Fechar formulário"
            >
              <X size={19} />
            </button>
          </div>

          <form
            className="product-admin-form"
            onSubmit={saveProduct}
          >
            <div className="form-grid">
              <label>
                Nome do produto
                <input
                  value={form.name}
                  onChange={(event) => {
                    updateForm('name', event.target.value);

                    if (!editingProductId) {
                      updateForm(
                        'slug',
                        slugify(event.target.value),
                      );
                    }
                  }}
                  placeholder="Ex.: Suporte para celular"
                  required
                />
              </label>

              <label>
                Slug
                <input
                  value={form.slug}
                  onChange={(event) =>
                    updateForm('slug', slugify(event.target.value))
                  }
                  placeholder="suporte-para-celular"
                  required
                />
              </label>

              <label>
                Tipo de produto
                <select
                  value={form.product_type}
                  onChange={(event) =>
                    updateForm(
                      'product_type',
                      event.target.value as ProductType,
                    )
                  }
                >
                  <option value="stl">Arquivo STL</option>
                  <option value="physical">Impressão 3D</option>
                </select>
              </label>

              <label>
                Categoria
                <select
                  value={form.category_id}
                  onChange={(event) =>
                    updateForm('category_id', event.target.value)
                  }
                >
                  <option value="">Sem categoria</option>

                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="form-section-title full-width">
                <strong>Preços de venda</strong>
                <span>Defina separadamente o valor do arquivo STL e do modelo impresso.</span>
              </div>

              <label>
                Preço do STL
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.stl_price}
                  onChange={(event) =>
                    updateForm('stl_price', event.target.value)
                  }
                  placeholder="19,90"
                  disabled={!form.stl_enabled}
                />
              </label>

              <label>
                Preço anterior do STL
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.compare_stl_price}
                  onChange={(event) =>
                    updateForm('compare_stl_price', event.target.value)
                  }
                  placeholder="29,90"
                  disabled={!form.stl_enabled}
                />
              </label>

              <label>
                Preço do modelo impresso
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.printed_price}
                  onChange={(event) =>
                    updateForm('printed_price', event.target.value)
                  }
                  placeholder="69,90"
                  disabled={!form.printed_enabled}
                />
              </label>

              <label>
                Preço anterior do modelo impresso
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.compare_printed_price}
                  onChange={(event) =>
                    updateForm('compare_printed_price', event.target.value)
                  }
                  placeholder="89,90"
                  disabled={!form.printed_enabled}
                />
              </label>

              <label className="full-width">
                URL da imagem principal
                <input
                  type="url"
                  value={form.thumbnail_url}
                  onChange={(event) =>
                    updateForm('thumbnail_url', event.target.value)
                  }
                  placeholder="https://..."
                />
              </label>

              <label className="full-width">
                Descrição
                <textarea
                  value={form.description}
                  onChange={(event) =>
                    updateForm('description', event.target.value)
                  }
                  placeholder="Descreva o produto..."
                  rows={5}
                  required
                />
              </label>
            </div>

            <div className="form-section-title full-width">
              <strong>Configuração da oferta</strong>
              <span>
                Estes campos controlam diretamente o conteúdo da landing page. Não use Markdown, emojis ou HTML.
              </span>
            </div>

            <label>
              Template da landing
              <select
                value={form.landing_template}
                onChange={(event) =>
                  updateForm(
                    'landing_template',
                    event.target.value as ProductLandingTemplate,
                  )
                }
              >
                <option value="product">
                  Produto / oferta
                </option>
                <option value="turbo">
                  Kit Turbo
                </option>
              </select>
            </label>

            <label>
              Selo da oferta
              <input
                value={form.landing_badge}
                onChange={(event) =>
                  updateForm(
                    'landing_badge',
                    event.target.value,
                  )
                }
                placeholder="OFERTA ESPECIAL"
              />
            </label>

            <label>
              Título da landing
              <input
                value={form.landing_title}
                onChange={(event) =>
                  updateForm(
                    'landing_title',
                    event.target.value,
                  )
                }
                placeholder="Nome que aparecerá no hero"
              />
            </label>

            <label>
              Subtítulo principal
              <input
                value={form.landing_subtitle}
                onChange={(event) =>
                  updateForm(
                    'landing_subtitle',
                    event.target.value,
                  )
                }
                placeholder="Uma frase curta e forte sobre o produto"
              />
            </label>

            <label className="full-width">
              Descrição curta do hero
              <textarea
                value={form.landing_description}
                onChange={(event) =>
                  updateForm(
                    'landing_description',
                    event.target.value,
                  )
                }
                rows={3}
                maxLength={260}
                placeholder="Texto curto. Máximo recomendado: 220 caracteres."
              />
            </label>

            <label>
              Título da seção de benefícios
              <input
                value={form.landing_why_title}
                onChange={(event) =>
                  updateForm(
                    'landing_why_title',
                    event.target.value,
                  )
                }
                placeholder="Por que este produto é especial?"
              />
            </label>

            <label>
              Texto da seção de benefícios
              <textarea
                value={form.landing_why_description}
                onChange={(event) =>
                  updateForm(
                    'landing_why_description',
                    event.target.value,
                  )
                }
                rows={3}
              />
            </label>

            <div className="form-section-title full-width">
              <strong>4 benefícios da oferta</strong>
              <span>
                O título aparece na lista do hero e o texto aparece nos cards.
              </span>
            </div>

            {form.landing_benefits.map(
              (benefit, index) => (
                <div
                  className="full-width"
                  key={`benefit-${index}`}
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'minmax(0, 0.9fr) minmax(0, 1.6fr)',
                    gap: '0.8rem',
                  }}
                >
                  <label>
                    Benefício {index + 1}
                    <input
                      value={benefit.title}
                      onChange={(event) =>
                        updateLandingBenefit(
                          index,
                          'title',
                          event.target.value,
                        )
                      }
                      placeholder="Ex.: Produto bem apresentado"
                    />
                  </label>

                  <label>
                    Descrição do benefício {index + 1}
                    <input
                      value={benefit.text}
                      onChange={(event) =>
                        updateLandingBenefit(
                          index,
                          'text',
                          event.target.value,
                        )
                      }
                      placeholder="Explique rapidamente o benefício."
                    />
                  </label>
                </div>
              ),
            )}

            <div className="form-section-title full-width">
              <strong>Pontos do card de compra</strong>
              <span>
                Você pode ter conteúdos diferentes para STL e modelo impresso.
              </span>
            </div>

            <div
              className="full-width"
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(2, minmax(0, 1fr))',
                gap: '1rem',
              }}
            >
              <div>
                <strong
                  style={{
                    display: 'block',
                    marginBottom: '0.65rem',
                  }}
                >
                  STL
                </strong>

                {form.landing_stl_points.map(
                  (point, index) => (
                    <label
                      key={`stl-point-${index}`}
                      style={{
                        display: 'block',
                        marginBottom: '0.55rem',
                      }}
                    >
                      Ponto {index + 1}
                      <input
                        value={point}
                        onChange={(event) =>
                          updateLandingPoint(
                            'landing_stl_points',
                            index,
                            event.target.value,
                          )
                        }
                      />
                    </label>
                  ),
                )}
              </div>

              <div>
                <strong
                  style={{
                    display: 'block',
                    marginBottom: '0.65rem',
                  }}
                >
                  Modelo impresso
                </strong>

                {form.landing_printed_points.map(
                  (point, index) => (
                    <label
                      key={`printed-point-${index}`}
                      style={{
                        display: 'block',
                        marginBottom: '0.55rem',
                      }}
                    >
                      Ponto {index + 1}
                      <input
                        value={point}
                        onChange={(event) =>
                          updateLandingPoint(
                            'landing_printed_points',
                            index,
                            event.target.value,
                          )
                        }
                      />
                    </label>
                  ),
                )}
              </div>
            </div>

            <label>
              Título da seção de detalhes
              <input
                value={form.landing_detail_title}
                onChange={(event) =>
                  updateForm(
                    'landing_detail_title',
                    event.target.value,
                  )
                }
                placeholder="Veja os detalhes de perto."
              />
            </label>

            <label>
              Texto da seção de detalhes
              <textarea
                value={form.landing_detail_description}
                onChange={(event) =>
                  updateForm(
                    'landing_detail_description',
                    event.target.value,
                  )
                }
                rows={3}
              />
            </label>

            <div className="form-section-title full-width">
              <strong>FAQ da oferta</strong>
              <span>
                Perguntas e respostas que aparecem no final da landing.
              </span>
            </div>

            {form.landing_faq.map(
              (faq, index) => (
                <div
                  className="full-width"
                  key={`faq-${index}`}
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'minmax(0, 0.75fr) minmax(0, 1.25fr)',
                    gap: '0.8rem',
                  }}
                >
                  <label>
                    Pergunta {index + 1}
                    <input
                      value={faq.question}
                      onChange={(event) =>
                        updateLandingFaq(
                          index,
                          'question',
                          event.target.value,
                        )
                      }
                      placeholder="Ex.: Como recebo?"
                    />
                  </label>

                  <label>
                    Resposta {index + 1}
                    <textarea
                      value={faq.answer}
                      onChange={(event) =>
                        updateLandingFaq(
                          index,
                          'answer',
                          event.target.value,
                        )
                      }
                      rows={3}
                      placeholder="Explique de forma objetiva."
                    />
                  </label>
                </div>
              ),
            )}

            <label>
              Título do CTA final
              <input
                value={form.landing_final_title}
                onChange={(event) =>
                  updateForm(
                    'landing_final_title',
                    event.target.value,
                  )
                }
                placeholder="Nome do produto"
              />
            </label>

            <label>
              Texto do CTA final
              <input
                value={form.landing_final_description}
                onChange={(event) =>
                  updateForm(
                    'landing_final_description',
                    event.target.value,
                  )
                }
                placeholder="Uma frase final para incentivar a compra."
              />
            </label>

            <div
              className="full-width"
              style={{
                display: 'flex',
                gap: '0.65rem',
                flexWrap: 'wrap',
                alignItems: 'center',
              }}
            >
              <button
                type="button"
                className="btn btn-outline"
                onClick={openLandingPreview}
                disabled={!form.slug.trim()}
              >
                <Eye size={16} />
                VISUALIZAR OFERTA
              </button>

              <span
                style={{
                  fontSize: '0.82rem',
                  opacity: 0.7,
                }}
              >
                Salve o produto antes de testar a oferta no navegador.
              </span>
            </div>

            <div className="form-section-title full-width">
              <strong>Modalidades de venda</strong>
              <span>
                Desative uma modalidade quando ela não existir. Quando desativada, ela não aparece na landing e não pode ser comprada.
              </span>
            </div>

            <div
              className="product-flags full-width"
              style={{ marginTop: 0 }}
            >
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={form.stl_enabled}
                  onChange={(event) =>
                    updateForm(
                      'stl_enabled',
                      event.target.checked,
                    )
                  }
                />
                Vender arquivo STL
              </label>

              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={form.printed_enabled}
                  onChange={(event) =>
                    updateForm(
                      'printed_enabled',
                      event.target.checked,
                    )
                  }
                />
                Vender modelo impresso
              </label>
            </div>

            <div className="product-flags">
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(event) =>
                    updateForm('active', event.target.checked)
                  }
                />
                Produto ativo
              </label>

              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={form.featured}
                  onChange={(event) =>
                    updateForm('featured', event.target.checked)
                  }
                />
                Produto em destaque
              </label>

              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={form.is_new}
                  onChange={(event) =>
                    updateForm('is_new', event.target.checked)
                  }
                />
                Lançamento
              </label>

              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={form.is_best_seller}
                  onChange={(event) =>
                    updateForm('is_best_seller', event.target.checked)
                  }
                />
                Mais vendido
              </label>
            </div>

            <div className="category-creator">
              <div>
                <h3>Nova categoria</h3>
                <p>
                  Crie uma categoria sem sair do cadastro do produto.
                </p>
              </div>

              <div>
                <input
                  value={newCategoryName}
                  onChange={(event) =>
                    setNewCategoryName(event.target.value)
                  }
                  placeholder="Nome da categoria"
                />

                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => void createCategory()}
                  disabled={
                    creatingCategory || !newCategoryName.trim()
                  }
                >
                  <FolderPlus size={16} />
                  CRIAR
                </button>
              </div>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="btn btn-outline"
                onClick={closeForm}
                disabled={saving}
              >
                CANCELAR
              </button>

              <button
                type="submit"
                className="btn btn-dark"
                disabled={saving}
              >
                {saving ? (
                  <>
                    <RefreshCw className="spin" size={17} />
                    SALVANDO...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={17} />
                    {editingProductId
                      ? 'SALVAR ALTERAÇÕES'
                      : 'CADASTRAR PRODUTO'}
                  </>
                )}
              </button>
            </div>
          </form>

          {editingProductId ? (
            <>
              <ProductMediaManager productId={editingProductId} />
              <ProductFileManager
                productId={editingProductId}
                stlEnabled={form.stl_enabled}
              />
              <ProductVariantManager productId={editingProductId} />
            </>
          ) : (
            <p className="admin-form-hint">
              Salve o produto para adicionar imagens e vídeos.
            </p>
          )}
        </section>
      )}

      <section className="admin-panel">
        <div className="panel-head">
          <div>
            <h2>Catálogo cadastrado</h2>
            <p>
              Produtos registrados diretamente no Supabase.
            </p>
          </div>

          <div className="admin-filters">
            <label>
              <Search size={15} />

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar produto..."
              />
            </label>

            <select
              value={typeFilter}
              onChange={(event) =>
                setTypeFilter(
                  event.target.value as 'all' | ProductType,
                )
              }
            >
              <option value="all">Todos os tipos</option>
              <option value="stl">Arquivos STL</option>
              <option value="physical">Impressão 3D</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="admin-empty-state">
            <RefreshCw className="spin" size={24} />
            <p>Carregando produtos...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="admin-empty-state">
            <Package size={28} />
            <p>Nenhum produto encontrado.</p>

            <button
              type="button"
              className="btn btn-dark"
              onClick={openCreateForm}
            >
              <Plus size={17} />
              CADASTRAR PRODUTO
            </button>
          </div>
        ) : (
          <div className="product-admin-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>PRODUTO</th>
                  <th>TIPO</th>
                  <th>CATEGORIA</th>
                  <th>PREÇO</th>
                  <th>STATUS</th>
                  <th>AÇÕES</th>
                </tr>
              </thead>

              <tbody>
                {filteredProducts.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <div className="admin-product-cell">
                        {product.thumbnail_url ? (
                          <img
                            src={product.thumbnail_url}
                            alt={product.name}
                            loading="lazy"
                          />
                        ) : (
                          <div className="admin-product-placeholder">
                            <Package size={18} />
                          </div>
                        )}

                        <div>
                          <strong>{product.name}</strong>
                          <small>{product.slug}</small>
                        </div>
                      </div>
                    </td>

                    <td>
                      {product.product_type === 'stl'
                        ? 'STL'
                        : 'IMPRESSÃO 3D'}
                    </td>

                    <td>
                      {product.categories?.name || 'Sem categoria'}
                    </td>

                    <td>
                      <div>
                        <small>STL</small>
                        <strong>{formatCurrency(product.stl_price)}</strong>

                        {product.compare_stl_price !== null && (
                          <small>{formatCurrency(product.compare_stl_price)}</small>
                        )}
                      </div>

                      <div style={{ marginTop: '0.5rem' }}>
                        <small>IMPRESSO</small>
                        <strong>{formatCurrency(product.printed_price)}</strong>

                        {product.compare_printed_price !== null && (
                          <small>{formatCurrency(product.compare_printed_price)}</small>
                        )}
                      </div>
                    </td>

                    <td>
                      <span
                        className={
                          product.active
                            ? 'event-pill success'
                            : 'event-pill'
                        }
                      >
                        {product.active ? 'ATIVO' : 'INATIVO'}
                      </span>
                    </td>

                    <td>
                      <div className="product-row-actions">
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => openEditForm(product)}
                          title="Editar produto"
                          aria-label={`Editar ${product.name}`}
                        >
                          <Edit3 size={16} />
                        </button>

                        <button
                          type="button"
                          className="icon-button"
                          onClick={() =>
                            window.open(
                              `/oferta/${product.slug}`,
                              '_blank',
                              'noopener,noreferrer',
                            )
                          }
                          title="Visualizar landing"
                          aria-label={`Visualizar landing de ${product.name}`}
                        >
                          <Eye size={16} />
                        </button>

                        <button
                          type="button"
                          className="icon-button"
                          onClick={() =>
                            void toggleProductStatus(product)
                          }
                          title={
                            product.active
                              ? 'Desativar produto'
                              : 'Ativar produto'
                          }
                          aria-label={
                            product.active
                              ? `Desativar ${product.name}`
                              : `Ativar ${product.name}`
                          }
                        >
                          {product.active ? (
                            <Trash2 size={16} />
                          ) : (
                            <CheckCircle2 size={16} />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="stat-card">
      <span>{icon}</span>
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}
