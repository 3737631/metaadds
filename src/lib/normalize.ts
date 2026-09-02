import type { NormalizedAd, RawAd } from "@/lib/types";

const normalizeToken = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");

const normalizeDomain = (url: string): string => {
  try {
    let host = new URL(url).hostname.toLowerCase();
    host = host.replace(/^www\./, "");
    host = host.replace(/^(m|mobile)\./, "");
    return host;
  } catch {
    return url.toLowerCase().trim();
  }
};

const normalizeLandingUrl = (url: string): string => {
  try {
    const u = new URL(url);
    u.hash = "";
    u.search = "";
    return u.href.replace(/\/$/, "").toLowerCase();
  } catch {
    return url.toLowerCase().trim();
  }
};

export function normalizeAd(raw: RawAd): NormalizedAd {
  return {
    id: raw.id,
    advertiser: {
      id: raw.advertiserId,
      name: raw.advertiserName,
      pageName: raw.pageName,
      normalizedName: normalizeToken(raw.advertiserName + " " + raw.pageName),
    },
    startDate: raw.startDate,
    endDate: raw.endDate,
    isActive: raw.status === "active",
    platforms: raw.platforms,
    landing: {
      url: raw.landingPage,
      domain: normalizeDomain(raw.landingPage),
      normalizedUrl: normalizeLandingUrl(raw.landingPage),
    },
    copy: {
      primaryText: raw.primaryText,
      headline: raw.headline,
      description: raw.description,
    },
    creatives: raw.creativeAssets.map((c) => ({
      type: c.type,
      url: c.url,
      width: c.width,
      height: c.height,
      durationMs: c.durationMs,
    })),
    market: raw.market,
  };
}

export function normalizeAds(raw: RawAd[]): NormalizedAd[] {
  return raw.map(normalizeAd);
}

export { normalizeToken, normalizeDomain, normalizeLandingUrl };
