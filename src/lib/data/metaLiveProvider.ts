import type { RawAd, Advertiser, DataSourceInfo, Platform } from "@/lib/types";
import type { DataProvider } from "@/lib/data/provider";

/**
 * META AD LIBRARY PROVEEDOR EN VIVO
 *
 * Consulta la API pública de la biblioteca de anuncios de Meta
 * (https://graph.facebook.com/v20.0/ads_archive) usando el token de acceso
 * del desarrollador (META_ADS_ACCESS_TOKEN). Devuelve anuncios REALES y
 * observables: texto, página, fechas, plataformas, dominios de destino y el
 * enlace al snapshot del creativo.
 *
 * Solo se mapean señales observables de la API. Nunca se fabrican ventas,
 * ROAS, CPA, inversión ni impresiones.
 */

const API_VERSION = "v20.0";

interface ArchiveAd {
  id: string;
  page_id: string;
  page_name: string;
  ad_delivery_start_time: string;
  ad_delivery_stop_time?: string | null;
  ad_creative_bodies?: string[];
  ad_creative_link_titles?: string | string[];
  ad_creative_link_descriptions?: string | string[];
  publisher_platforms?: string[];
  landing_page_urls?: string[];
  ad_snapshot_url?: string;
  byline?: string;
}

interface ArchiveResponse {
  data: ArchiveAd[];
  paging?: { cursors?: { before?: string; after?: string } };
  error?: { message?: string };
}

const PLATFORM_MAP: Record<string, Platform> = {
  facebook: "facebook",
  instagram: "instagram",
  messenger: "messenger",
  audience_network: "audience_network",
};

export function hasLiveMetaToken(): boolean {
  return Boolean(process.env.META_ADS_ACCESS_TOKEN);
}

export class MetaLiveProvider implements DataProvider {
  readonly info: DataSourceInfo = {
    id: "meta-live",
    name: "Meta Ad Library (en vivo)",
    kind: "meta",
    isDemo: false,
    description:
      "Anuncios reales consultados en vivo desde la biblioteca de anuncios de Meta.",
  };

  private token = process.env.META_ADS_ACCESS_TOKEN ?? "";

  // Términos de búsqueda por defecto para el feed de anuncios. La API exige
  // `search_terms` y devuelve 500 transitorios en muchos términos, así que
  // consultamos varios y combinamos los resultados reales (deduplicadas).
  private defaultSearchTerms = [
    "tienda",
    "anillo",
    "moda",
    "hogar",
    "fitness",
    "belleza",
    "mascotas",
    "tecnologia",
  ];

  async fetchRawAds(): Promise<RawAd[]> {
    const token = this.token;
    if (!token) return [];

    const t0 = Date.now();
    // ads_archive acepta parámetros por GET; POST devuelve un 400
    // "Unsupported post request". El término `search_terms` es obligatorio.
    const results = await Promise.all(
      this.defaultSearchTerms.map((term) => this.queryTerm(token, term))
    );

    // Deduplicar por id conservando el orden y limitar a 25 resultados reales.
    const seen = new Set<string>();
    const ads: RawAd[] = [];
    let attempted = 0;
    for (const batch of results) {
      attempted += batch.length;
      for (const ad of batch) {
        if (seen.has(ad.id)) continue;
        seen.add(ad.id);
        ads.push(ad);
        if (ads.length >= 25) break;
      }
    }
    console.warn(
      `[meta-live] términos=${this.defaultSearchTerms.length} resultados_crudos=${attempted} ads_unicos=${ads.length} ms=${Date.now() - t0}`
    );
    if (ads.length === 0) {
      // La API en vivo no devolvió ningún anuncio real (términos agotados,
      // throttle de Meta o red vacía). Lanzamos para que el repositorio
      // caiga al siguiente proveedor (snapshot/demo) en vez de mostrar
      // una página vacía sin explicación.
      throw new Error("Meta en vivo devolvió 0 anuncios reales");
    }
    return ads;
  }

  private async queryTerm(token: string, searchTerm: string): Promise<RawAd[]> {
    const country = process.env.META_ADS_COUNTRY ?? "ES";
    const params = new URLSearchParams({
      access_token: token,
      search_terms: searchTerm,
      ad_reached_countries: '["' + country + '"]',
      ad_type: "ALL",
      limit: "25",
      fields: [
        "id",
        "page_id",
        "page_name",
        "ad_delivery_start_time",
        "ad_delivery_stop_time",
        "ad_creative_bodies",
        "ad_creative_link_titles",
        "ad_creative_link_descriptions",
        "publisher_platforms",
        "landing_page_urls",
        "ad_snapshot_url",
      ].join(","),
    });

    const url = `https://graph.facebook.com/${API_VERSION}/ads_archive?${params.toString()}`;

    // Meta devuelve 500 transitorios en muchos términos; reintentamos con backoff.
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const res = await fetch(url, {
        method: "GET",
        signal: AbortSignal.timeout(30_000),
      });

      if (res.ok) {
        const json = (await res.json()) as ArchiveResponse;
        if (json.error?.message) {
          console.warn(`[meta-live] término "${searchTerm}" OK pero error app: ${json.error.message.slice(0, 120)}`);
          break;
        }
        console.warn(`[meta-live] término "${searchTerm}" OK: ${json.data.length} ads (intento ${attempt})`);
        return json.data.map((a) => this.toRawAd(a));
      }

      const retryable =
        res.status === 500 || res.status === 429 || res.status === 502 || res.status === 503;
      let bodyPreview = "";
      try {
        const txt = (await res.clone().text()).slice(0, 160);
        bodyPreview = txt.replace(/\s+/g, " ").trim();
      } catch {
        /* sin cuerpo */
      }
      console.warn(
        `[meta-live] término "${searchTerm}" status=${res.status} (intento ${attempt}, retryable=${retryable}) cuerpo=${bodyPreview}`
      );
      if (!retryable || attempt === maxAttempts) {
        break;
      }
      await new Promise((r) => setTimeout(r, 1200 * attempt));
    }
    return [];
  }

  private toRawAd(a: ArchiveAd): RawAd {
    const platforms = (a.publisher_platforms ?? [])
      .map((p) => PLATFORM_MAP[p])
      .filter((p): p is Platform => Boolean(p));
    const normalizedPlatforms: Platform[] =
      platforms.length > 0 ? platforms : ["facebook"];

    const landingPage = a.landing_page_urls?.[0] ?? `https://facebook.com/${a.page_id}`;
    let landingDomain = "facebook.com";
    try {
      landingDomain = new URL(landingPage).hostname.replace(/^www\./, "");
    } catch {
      /* mantener facebook.com */
    }

    const headline = Array.isArray(a.ad_creative_link_titles)
      ? a.ad_creative_link_titles[0] ?? ""
      : a.ad_creative_link_titles ?? "";

    const primaryText = Array.isArray(a.ad_creative_bodies)
      ? a.ad_creative_bodies[0] ?? ""
      : a.ad_creative_bodies?.[0] ?? "";

    // El snapshot del creativo es la representación visual real del anuncio.
    // No disponemos de ficheros de imagen directos en ads_archive, así que
    // usamos el enlace oficial al snapshot en lugar de fabricar imágenes.
    const creativeAssets: RawAd["creativeAssets"] = a.ad_snapshot_url
      ? [{ type: "image", url: a.ad_snapshot_url }]
      : [];

    return {
      id: a.id,
      advertiserId: a.page_id || a.id,
      advertiserName: a.page_name || a.byline || "Página anunciante",
      startDate: a.ad_delivery_start_time || new Date().toISOString().slice(0, 10),
      endDate: a.ad_delivery_stop_time || null,
      status: a.ad_delivery_stop_time ? "inactive" : "active",
      platforms: normalizedPlatforms,
      landingPage,
      landingDomain,
      primaryText,
      headline,
      description: Array.isArray(a.ad_creative_link_descriptions)
        ? a.ad_creative_link_descriptions[0] ?? ""
        : a.ad_creative_link_descriptions ?? "",
      pageName: a.page_name || a.byline || "",
      creativeAssets,
      market: process.env.META_ADS_COUNTRY ?? "ES",
    };
  }

  async fetchAdvertisers(): Promise<Advertiser[]> {
    const ads = await this.fetchRawAds();
    const map = new Map<string, Advertiser>();
    for (const a of ads) {
      if (!map.has(a.advertiserId)) {
        map.set(a.advertiserId, {
          id: a.advertiserId,
          name: a.advertiserName,
          pageName: a.pageName,
          normalizedName: a.advertiserName.toLowerCase(),
          firstSeen: a.startDate,
          lastSeen: a.startDate,
        });
      }
    }
    return Array.from(map.values());
  }
}