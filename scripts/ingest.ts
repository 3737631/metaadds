/**
 * META AD LIBRARY INGEST
 *
 * Fetches real commercial ads (delivered to the EU, e.g. Spain) from the
 * official Meta Ad Library API and writes a local snapshot used by the app.
 *
 * Usage:
 *   export META_ADS_ACCESS_TOKEN=...
 *   npm run ingest
 *
 * Requires identity verification to be approved by Meta (facebook.com/ID),
 * otherwise the API returns error 10 / 2332002 and this prints a clear message.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const API_VERSION = "v25.0";
const GRAPH = `https://graph.facebook.com/${API_VERSION}/ads_archive`;
const COUNTRY = process.env.META_ADS_COUNTRY || process.env.ADS_COUNTRY || "ES";
const SEARCH_TERMS = process.env.META_ADS_SEARCH || "comprar";
const MAX_CALLS = Number(process.env.META_ADS_MAX || "20");

const FIELDS = [
  "id",
  "page_id",
  "page_name",
  "ad_creative_bodies",
  "ad_creative_link_titles",
  "ad_creative_link_captions",
  "ad_creative_link_descriptions",
  "ad_delivery_start_time",
  "ad_delivery_stop_time",
  "publisher_platforms",
  "imgs",
  "videos",
  "media_type",
].join(",");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, "../data/meta-snapshot.json");

const token = process.env.META_ADS_ACCESS_TOKEN || process.env.ACCESS_TOKEN;

if (!token) {
  console.error(
    "Falta META_ADS_ACCESS_TOKEN. Pásalo como variable de entorno antes de ejecutar:",
    "  $env:META_ADS_ACCESS_TOKEN = '...'; npm run ingest"
  );
  process.exit(1);
}

type ApiItem = {
  id: string;
  page_id?: string;
  page_name?: string;
  ad_creative_bodies?: string[];
  ad_creative_link_titles?: string[];
  ad_creative_link_captions?: string[];
  ad_creative_link_descriptions?: string[];
  ad_delivery_start_time?: string;
  ad_delivery_stop_time?: string;
  publisher_platforms?: string[];
  imgs?: Array<{ original_image_url?: string }>;
  videos?: Array<{ normalized_variations?: unknown } | { [k: string]: unknown }>;
  media_type?: number;
};

function isFatalError(body: {
  error?: { code?: number; error_subcode?: number; message?: string };
}): boolean {
  if (!body.error) return false;
  // 10/2332002 => identity verification not approved.
  if (body.error.code === 10 && body.error.error_subcode === 2332002) return true;
  if (body.error.code === 190) return true; // expired/invalid token
  if (body.error.code === 613) return false; // rate limit, retryable
  return false;
}

async function fetchPage(params: Record<string, string>): Promise<{
  data: ApiItem[];
  after?: string;
} | null> {
  const qs = new URLSearchParams({
    access_token: token as string,
    ad_reached_countries: `['${COUNTRY}']`,
    search_terms: SEARCH_TERMS,
    ad_type: "ALL",
    ad_active_status: "ALL",
    fields: FIELDS,
    limit: "25",
    ...params,
  });
  const res = await fetch(`${GRAPH}?${qs.toString()}`);
  const body = await res.json();
  if (!res.ok) {
    if (isFatalError(body)) {
      throw new Error(
        `Meta bloquea el acceso: ${body.error?.message || "permiso denegado"} ` +
          `(código ${body.error?.code}). Aún no está aprobada la verificación de identidad ` +
          `en facebook.com/ID.`
      );
    }
    if (body.error?.code === 613) {
      console.warn("Límite de peticiones (613). Esperando 30s...");
      await new Promise((r) => setTimeout(r, 30000));
      return null;
    }
    throw new Error(`Error de API: ${JSON.stringify(body.error || body)}`);
  }
  const data = body.data && Array.isArray(body.data) ? (body.data as ApiItem[]) : [];
  const after = body.paging?.cursors?.after;
  return { data, after };
}

function extractVideoUrl(item: ApiItem): string | null {
  const v = item.videos && item.videos[0];
  if (!v) return null;
  const variations =
    (v as { normalized_variations?: Array<{ normalized_variations?: { url?: string } } | { url?: string }> })
      .normalized_variations;
  if (Array.isArray(variations)) {
    for (const vv of variations) {
      const nested = (vv as { normalized_variations?: { url?: string } }).normalized_variations;
      if (nested?.url) return nested.url;
      if ((vv as { url?: string }).url) return (vv as { url?: string }).url!;
    }
  }
  return null;
}

async function run(): Promise<void> {
  const out: {
    source: string;
    ingestedAt: string;
    reachedCountry: string;
    ads: Array<{
      id: string;
      pageId: string;
      pageName: string;
      startDate: string;
      endDate: string | null;
      primaryText: string;
      headline: string;
      description: string;
      platforms: string[];
      landingDomain: string;
      market: string;
      imageUrls: string[];
      videoUrls: string[];
    }>;
  } = {
    source: "meta-ad-library",
    ingestedAt: new Date().toISOString(),
    reachedCountry: COUNTRY,
    ads: [],
  };

  let cursor: string | undefined;
  let calls = 0;
  do {
    const params: Record<string, string> = {};
    if (cursor) params.after = cursor;
    const page = await fetchPage(params);
    calls++;
    if (page === null) {
      if (calls <= MAX_CALLS) continue;
      break;
    }
    const forItems = page.data;

    for (const it of forItems) {
      const domains: string[] = (it.ad_creative_bodies || [])
        .flatMap((b) => b.match(/https?:\/\/([\w.-]+)/g) || [])
        .map((u) => {
          try {
            return new URL(u).hostname;
          } catch {
            return "";
          }
        })
        .filter(Boolean);
      const landingDomain = domains[0] || "";
      if (!landingDomain) continue;

      out.ads.push({
        id: it.id,
        pageId: it.page_id || it.page_name?.toLowerCase().replace(/\W+/g, "") || "page-" + it.id,
        pageName: it.page_name || "Página desconocida",
        startDate: (it.ad_delivery_start_time || new Date().toISOString()).slice(0, 10),
        endDate: it.ad_delivery_stop_time ? it.ad_delivery_stop_time.slice(0, 10) : null,
        primaryText: (it.ad_creative_bodies || []).join("\n"),
        headline: it.ad_creative_link_titles?.[0] || it.ad_creative_link_captions?.[0] || "",
        description: it.ad_creative_link_descriptions?.[0] || "",
        platforms: it.publisher_platforms || [],
        landingDomain,
        market: COUNTRY,
        imageUrls: (it.imgs || []).map((i) => i.original_image_url || "").filter(Boolean),
        videoUrls: (() => {
          const v = extractVideoUrl(it);
          return v ? [v] : [];
        })(),
      });
    }

    cursor = page.after;
  } while (cursor && calls < MAX_CALLS);

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log(`Guardados ${out.ads.length} anuncios en ${OUT}`);
}

run().catch((err) => {
  console.error(String(err?.message || err));
  process.exit(1);
});
