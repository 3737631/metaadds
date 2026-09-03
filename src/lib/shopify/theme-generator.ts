import JSZip from "jszip";
import type { StoreTheme } from "@/lib/stores/types";

/** Escapa texto para usarlo dentro de Liquid/HTML sin romper el markup. */
function esc(s: string): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function hexToRgb(hex: string): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec((hex || "").trim());
  if (!m) return "255,255,255";
  const n = parseInt(m[1], 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

function buildCss(theme: StoreTheme): string {
  const bg = theme.backgroundColor || "#ffffff";
  const fg = theme.textColor || "#111111";
  const p = theme.primaryColor || "#1f2937";
  const s = theme.secondaryColor || "#6b7280";
  const a = theme.accentColor || "#f59e0b";
  const font = theme.fontFamily || "system-ui, sans-serif";
  return `:root{
--bg:${bg};--fg:${fg};--p:${p};--s:${s};--a:${a};
--font:${font};
--rgb-p:${hexToRgb(p)};--rgb-a:${hexToRgb(a)};
}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--fg);font-family:var(--font);line-height:1.6;-webkit-font-smoothing:antialiased}
img{max-width:100%;display:block}
a{color:inherit;text-decoration:none}
.container{max-width:1120px;margin:0 auto;padding:0 20px}
header{position:sticky;top:0;z-index:50;background:var(--bg)/.9;backdrop-filter:blur(8px);border-bottom:1px solid rgba(var(--rgb-p),.12)}
.nav{display:flex;align-items:center;justify-content:space-between;height:64px}
.logo{font-weight:800;font-size:1.25rem;letter-spacing:-.02em;color:var(--p)}
.menu{display:flex;gap:24px;font-weight:500;font-size:.95rem}
.hero{text-align:center;padding:80px 20px 40px}
.hero h1{font-size:clamp(2rem,5vw,3.4rem);line-height:1.1;letter-spacing:-.03em;color:var(--p)}
.hero p{margin:20px auto;max-width:560px;color:var(--s)}
.btn{display:inline-block;background:var(--a);color:#fff;font-weight:700;padding:14px 32px;border-radius:999px;border:none;cursor:pointer;transition:transform .2s}
.btn:hover{transform:translateY(-2px)}
.section{padding:56px 20px}
.section h2{font-size:1.8rem;letter-spacing:-.02em;color:var(--p);margin-bottom:24px;text-align:center}
.grid{display:grid;gap:24px}
.grid-2{grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}
.grid-3{grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}
.card{background:#fff;border:1px solid rgba(var(--rgb-p),.1);border-radius:16px;padding:24px;transition:transform .2s,box-shadow .2s}
.card:hover{transform:translateY(-4px);box-shadow:0 12px 30px rgba(var(--rgb-p),.12)}
.product{display:grid;grid-template-columns:1fr 1fr;gap:40px;align-items:center}
.price{font-size:1.75rem;font-weight:800;color:var(--a)}
.compare{text-decoration:line-through;color:var(--s);margin-left:10px;font-size:1.1rem;font-weight:500}
.badge{display:inline-block;background:var(--a);color:#fff;font-size:.72rem;font-weight:700;padding:4px 10px;border-radius:999px;text-transform:uppercase;letter-spacing:.06em}
.top{background:var(--p);color:#fff;text-align:center;padding:40px 20px}
.top h2{color:#fff}
.top .btn{background:var(--a)}
footer{background:var(--p);color:rgba(255,255,255,.85);padding:40px 20px;margin-top:40px}
.footer-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:24px}
footer a{display:block;margin:6px 0}
.newsletter input{padding:12px 16px;border-radius:999px;border:none;min-width:220px}
.review{color:#b45309}
.acc details{border:1px solid rgba(var(--rgb-p),.15);border-radius:12px;padding:16px;margin-bottom:10px}
.acc summary{font-weight:600;cursor:pointer;color:var(--p)}
@media(max-width:720px){.product{grid-template-columns:1fr}.menu{display:none}.nosmall{display:none}}
`;
}

function buildThemeLiquid(): string {
  return `<!doctype html>
<html lang="{{ request.locale.iso_code }}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{{ page_title }}{% if current_tags %} &ndash; {{ current_tags | join: ', ' }}{% endif %}{% unless page_title contains shop.name %} &ndash; {{ shop.name }}{% endunless %}</title>
  {{ shop.meta_description | default: shop.description | escape }}
  {{ 'styles.css' | asset_url | stylesheet_tag }}
  {{ content_for_header }}
</head>
<body>
  {{ content_for_layout }}
  {% section 'footer' %}
</body>
</html>`;
}

function buildHeaderSection(theme: StoreTheme): string {
  const raw = theme.header?.menu ?? [];
  const items = raw
    .map((m) => (typeof m === "string" ? { text: m, href: "#" } : m))
    .filter((m) => m && typeof m.text === "string");
  const menu = (items.length > 0 ? items : [{ text: "Inicio", href: "#" }, { text: "Productos", href: "#" }, { text: "Contacto", href: "#" }])
    .map((m) => `<a href="${esc(m.href || "#")}">${esc(m.text)}</a>`)
    .join("");
  return `<header>
  <div class="container nav">
    <a href="/" class="logo">{{ shop.name | default: "${esc(theme.brandName || theme.header?.logoText || "")}" }}</a>
    <nav class="menu">${menu}</nav>
  </div>
</header>`;
}

function buildHero(theme: StoreTheme): string {
  return `<section class="hero">
  <h1>${esc(theme.hero?.headline || theme.tagline || "")}</h1>
  <p>${esc(theme.hero?.subheadline || "")}</p>
  <a class="btn" href="${esc(theme.hero?.ctaHref || "/products/placeholder")}">${esc(theme.hero?.ctaLabel || "Comprar ahora")}</a>
</section>`;
}

function buildBenefitsSection(theme: StoreTheme): string {
  const items = theme.homeSections?.find((s) => s.type === "benefits" || s.type === "features")?.items;
  if (!items || items.length === 0) return "";
  const cards = items.map((i) => `<div class="card"><h3>${esc(i.title)}</h3><p>${esc(i.text)}</p></div>`).join("");
  return `<section class="section"><div class="container"><h2>${esc(theme.homeSections.find((s) => s.type === "benefits")?.heading || "Beneficios")}</h2><div class="grid grid-3">${cards}</div></div></section>`;
}

function buildProductSection(theme: StoreTheme): string {
  const p = theme.product || {};
  const compare = p.compareAtPrice ? `<span class="compare">{{ product.compare_at_price | money }}</span>` : "";
  const badge = p.badge ? `<span class="badge">${esc(p.badge)}</span>` : "";
  const benefits = (p.benefits || []).map((b) => `<li>${esc(b)}</li>`).join("");
  return `<section class="section"><div class="container product">
  <div><img src="{{ product.featured_image | image_url: width: 800 }}" alt="{{ product.title | escape }}" {% unless product.featured_image %}style="display:none"{% endunless %}></div>
  <div>
    ${badge}
    <h2>{{ product.title | escape }}</h2>
    <div class="price">{{ product.price | money }}${compare}</div>
    <p>{{ product.description }}</p>
    <ul>${benefits}</ul>
    <a class="btn" href="{{ routes.cart_add_url }}?id={{ product.selected_or_first_available_variant.id }}">{{ product.title | escape }} button</a>
  </div>
</div></section>`;
}

function buildTestimonials(theme: StoreTheme): string {
  const items = theme.homeSections?.find((s) => s.type === "testimonials" || s.type === "reviews")?.items;
  if (!items || items.length === 0) return "";
  const cards = items.map((i) => `<div class="card"><p class="review">★★★★★</p><p>${esc(i.text)}</p><h4>${esc(i.title)}</h4></div>`).join("");
  return `<section class="section"><div class="container"><h2>${esc(theme.homeSections.find((s) => s.type === "testimonials")?.heading || "Opiniones")}</h2><div class="grid grid-3">${cards}</div></div></section>`;
}

function buildFaq(theme: StoreTheme): string {
  const items = theme.homeSections?.find((s) => s.type === "faq")?.items;
  if (!items || items.length === 0) return "";
  const acc = items.map((i) => `<details class="acc"><summary>${esc(i.title)}</summary><p>${esc(i.text)}</p></details>`).join("");
  return `<section class="section"><div class="container"><h2>${esc(theme.homeSections.find((s) => s.type === "faq")?.heading || "Preguntas frecuentes")}</h2>${acc}</div></section>`;
}

function buildCtaSection(theme: StoreTheme): string {
  const cta = theme.homeSections?.find((s) => s.type === "cta");
  if (!cta) return "";
  return `<section class="top"><div class="container"><h2>${esc(cta.heading || "")}</h2><p>${esc(cta.text || "")}</p><a class="btn" href="${esc(cta.ctaHref || "/")}">${esc(cta.ctaLabel || "Comprar ahora")}</a></div></section>`;
}

function buildFooterSection(theme: StoreTheme): string {
  const f = theme.footer || {};
  const links = (f.links || []).map((l) => `<a href="${esc(l.href || "#")}">${esc(l.text)}</a>`).join("");
  const newsletter = f.newsletter ? `<form class="newsletter" action="#" method="post"><input type="email" placeholder="Tu email" aria-label="Email"><button class="btn" type="submit">Suscribirme</button></form>` : "";
  return `<footer><div class="container footer-grid">
  <div><h3>{{ shop.name }}</h3><p>${esc(f.about || "")}</p></div>
  <div><h4>Enlaces</h4>${links}</div>
  ${newsletter ? `<div><h4>Newsletter</h4>${newsletter}</div>` : ""}
</div></footer>`;
}

function buildIndexLiquid(theme: StoreTheme): string {
  return [
    `{% section 'header' %}`,
    buildHero(theme),
    buildBenefitsSection(theme),
    buildProductSection(theme),
    buildTestimonials(theme),
    buildFaq(theme),
    buildCtaSection(theme),
  ].join("\n");
}

function buildSettingsSchema(theme: StoreTheme): string {
  return JSON.stringify(
    {
      name: theme.name || "Meta Winners Store",
      settings: [
        { type: "color", id: "color_primary", label: "Color principal", default: theme.primaryColor },
        { type: "color", id: "color_secondary", label: "Color secundario", default: theme.secondaryColor },
        { type: "color", id: "color_bg", label: "Fondo", default: theme.backgroundColor },
        { type: "color", id: "color_text", label: "Texto", default: theme.textColor },
        { type: "select", id: "font_family", label: "Tipografía", default: "system", options: [{ value: "system", label: "Sistema" }] },
      ],
    },
    null,
    2
  );
}

function buildSettingsData(theme: StoreTheme): string {
  return JSON.stringify(
    {
      current: {
        color_primary: theme.primaryColor,
        color_secondary: theme.secondaryColor,
        color_bg: theme.backgroundColor,
        color_text: theme.textColor,
      },
    },
    null,
    2
  );
}

function buildIndexJson(): string {
  return JSON.stringify(
    {
      sections: { header: { type: "header" }, main: { type: "main" }, footer: { type: "footer" } },
      order: ["header", "main", "footer"],
    },
    null,
    2
  );
}

/**
 * Genera un tema Shopify completo e instalable como ZIP a partir de un StoreTheme.
 */
export async function generateShopifyThemeZip(theme: StoreTheme): Promise<{ zip: Uint8Array; name: string }> {
  const zip = new JSZip();
  const root = zip;

  root.file("layout/theme.liquid", buildThemeLiquid());
  root.file("assets/styles.css", buildCss(theme));
  root.file("sections/header.liquid", buildHeaderSection(theme));
  root.file("sections/footer.liquid", buildFooterSection(theme));
  // template sin tema generado por IA: un index sencillo
  root.file("templates/index.json", buildIndexJson());
  root.file("templates/product.json", JSON.stringify({ sections: { main: { type: "main-product" } }, order: ["main"] }));
  root.file("config/settings_schema.json", buildSettingsSchema(theme));
  root.file("config/settings_data.json", buildSettingsData(theme));
  root.file("locales/es.json", JSON.stringify({ general: { search: { placeholder: "Buscar", results: "Resultados" } } }, null, 2));
  root.file("snippets/icon.liquid", "");

      const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
      const safeName = (theme.brandName || theme.name || "tienda")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      const src = new ArrayBuffer(buffer.byteLength);
      new Uint8Array(src).set(buffer);
      const bytes: Uint8Array<ArrayBuffer> = new Uint8Array(src);
      return { zip: bytes, name: `${safeName || "tienda"}-theme.zip` };
}
