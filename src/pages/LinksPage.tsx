import { siInstagram, siWhatsapp } from 'simple-icons';

function InstagramIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="forge-contact-icon"
    >
      <path d={siInstagram.path} fill="currentColor" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="forge-contact-icon forge-whatsapp-icon"
    >
      <path d={siWhatsapp.path} fill="currentColor" />
    </svg>
  );
}

export function LinksPage() {
  return (
    <main
      className="forge-links-page"
      aria-label="Central de links Forge3D"
    >
      <div className="forge-links-shell">
        <div className="forge-links-content">
          <header className="forge-links-header">
            <div className="forge-links-brand">
              <img
                src="https://eqygfzdowcligbvlcixk.supabase.co/storage/v1/object/public/product-media/LOGOFORGE3D-removebg-preview%20(1).png"
                alt="R&G Forge3D — impressão, design e personalização"
              />
            </div>
          </header>

          <section className="forge-links-hero">
            <div className="forge-links-hero-copy">
              <span className="forge-links-eyebrow">
                CRIE. IMPRIMA. SURPREENDA.
              </span>
              <h1>
                Seu próximo projeto
                <strong>começa aqui.</strong>
              </h1>
              <p>
                Arquivos STL e impressão 3D para transformar suas ideias em peças reais.
              </p>
            </div>
            <div
              className="forge-links-orbit"
              aria-hidden="true"
            >
              <span />
              <span />
              <span />
            </div>
          </section>

          <section className="forge-contact-section" aria-labelledby="forge-contact-title">
            <div className="forge-contact-heading">
              <span className="forge-links-eyebrow">VAMOS CONVERSAR</span>
              <h2 id="forge-contact-title">Fale com a Forge3D</h2>
              <p>Escolha por onde prefere chamar a gente.</p>
            </div>

            <div className="forge-contact-list">
              <a
                className="forge-contact-card forge-contact-instagram"
                href="https://www.instagram.com/rgforge3d/"
                target="_blank"
                rel="noreferrer"
                aria-label="Abrir Instagram @rgforge3d"
              >
                <span className="forge-contact-icon-wrap">
                  <InstagramIcon />
                </span>
                <span className="forge-contact-copy">
                  <strong>Instagram</strong>
                  <small>@rgforge3d</small>
                </span>
                <span className="forge-contact-arrow" aria-hidden="true">↗</span>
              </a>

              <a
                className="forge-contact-card forge-contact-whatsapp"
                href="https://wa.me/5563992028137"
                target="_blank"
                rel="noreferrer"
                aria-label="Conversar com Guilherme Oliveira pelo WhatsApp"
              >
                <span className="forge-contact-icon-wrap">
                  <WhatsAppIcon />
                </span>
                <span className="forge-contact-copy">
                  <strong>Guilherme Oliveira</strong>
                  <small>WhatsApp</small>
                </span>
                <span className="forge-contact-arrow" aria-hidden="true">↗</span>
              </a>

              <a
                className="forge-contact-card forge-contact-whatsapp"
                href="https://wa.me/5563992099150"
                target="_blank"
                rel="noreferrer"
                aria-label="Conversar com Rayara Soares pelo WhatsApp"
              >
                <span className="forge-contact-icon-wrap">
                  <WhatsAppIcon />
                </span>
                <span className="forge-contact-copy">
                  <strong>Rayara Soares</strong>
                  <small>WhatsApp</small>
                </span>
                <span className="forge-contact-arrow" aria-hidden="true">↗</span>
              </a>
            </div>
          </section>

          <aside className="forge-services-note">
            <span className="forge-services-mark" aria-hidden="true">&lt;/&gt;</span>
            <p>
              Também criamos <strong>sistemas e sites</strong>
              <small>pessoais e corporativos.</small>
            </p>
          </aside>
        </div>
      </div>
    </main>
  );
}
