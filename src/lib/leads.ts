import { supabase } from './supabase';
import { getAttribution } from './analytics';

export type LeadPayload = {
  name: string;
  email: string;
  phone?: string;
  cpfCnpj?: string;
  city?: string;
  state?: string;
  event?: string;
};

export async function saveLead(
  payload: LeadPayload
) {
  const attribution = getAttribution();

  const source =
    attribution.utm_source ||
    'direct';

  const medium =
    attribution.utm_medium ||
    '';

  const campaign =
    attribution.utm_campaign ||
    '';

  const content =
    attribution.utm_content ||
    '';

  const term =
    attribution.utm_term ||
    '';

  const fbclid =
    attribution.fbclid ||
    '';

  const referrer =
    attribution.firstReferrer ||
    '';

  const landingPage =
    attribution.firstLandingPage ||
    '';

  const eventName =
    payload.event ||
    'Lead';

  /*
   * Dados completos do lead para
   * armazenamento local.
   *
   * Aqui podemos manter cpfCnpj porque
   * o localStorage não depende do schema
   * do Supabase.
   */
  const localLead = {
    id: `L-${Date.now()}`,

    date:
      new Date().toLocaleString(
        'pt-BR'
      ),

    name:
      payload.name,

    email:
      payload.email,

    phone:
      payload.phone || '',

    cpfCnpj:
      payload.cpfCnpj || '',

    city:
      payload.city || '',

    state:
      payload.state || '',

    source,
    medium,
    campaign,
    content,
    term,
    fbclid,
    referrer,
    landing_page:
      landingPage,

    event_name:
      eventName,
  };

  /*
   * Salva uma cópia local para
   * permitir consulta mesmo quando
   * o Supabase estiver indisponível.
   */
  if (
    typeof window !== 'undefined'
  ) {
    try {
      const stored =
        localStorage.getItem(
          'forge3d_leads'
        );

      let current: unknown[] = [];

      if (stored) {
        const parsed =
          JSON.parse(stored);

        if (
          Array.isArray(parsed)
        ) {
          current = parsed;
        }
      }

      current.unshift(
        localLead
      );

      localStorage.setItem(
        'forge3d_leads',
        JSON.stringify(
          current.slice(
            0,
            500
          )
        )
      );
    } catch (error) {
      console.warn(
        '[Forge3D] Não foi possível salvar o lead localmente:',
        error
      );
    }
  }

  /*
   * IMPORTANTE:
   *
   * Aqui NÃO usamos:
   *
   * { ...payload }
   *
   * porque payload possui:
   *
   * cpfCnpj
   *
   * enquanto o banco possui:
   *
   * cpf_cnpj
   *
   * Enviamos somente as colunas
   * reais do banco.
   */
  if (supabase) {
    const leadForDatabase = {
      name:
        payload.name,

      email:
        payload.email,

      phone:
        payload.phone ||
        null,

      cpf_cnpj:
        payload.cpfCnpj ||
        null,

      city:
        payload.city ||
        null,

      state:
        payload.state ||
        null,

      source,

      medium,

      campaign,

      content,

      term,

      fbclid,

      referrer,

      landing_page:
        landingPage,

      event_name:
        eventName,
    };

    const {
      error,
    } = await supabase
      .from('leads')
      .insert(
        leadForDatabase
      );

    if (error) {
      console.warn(
        '[Forge3D] Não foi possível salvar o lead no Supabase:',
        error.message
      );
    }
  }
}