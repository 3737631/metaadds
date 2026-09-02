import type { NormalizedAd } from "@/lib/types";

/**
 * Deduplication
 *
 * Removes near-identical ad records produced by the same advertiser for the
 * same landing page. Real Meta Ad Library crawls routinely return the same ad
 * multiple times (or variants that are effectively identical). Keeping a
 * single canonical record per advertiser+landing+creative fingerprint prevents
 * an advertiser from inflating diversity signals with duplicated impressions.
 */
export function deduplicateAds(ads: NormalizedAd[]): NormalizedAd[] {
  const seen = new Map<string, NormalizedAd>();
  for (const ad of ads) {
    const creativeFingerprint = ad.creatives
      .map((c) => c.type + ":" + c.url)
      .sort()
      .join("|");
    const key = [
      ad.advertiser.id,
      ad.landing.normalizedUrl,
      normalizeCopy(ad.copy),
      creativeFingerprint,
    ].join("\u0001");

    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, ad);
      continue;
    }
    // Prefer the earliest startDate so longevity is not overstated by
    // duplicated records, and prefer the active one.
    if (!existing.isActive && ad.isActive) {
      seen.set(key, ad);
    } else if (existing.startDate > ad.startDate) {
      seen.set(key, ad);
    }
  }
  return Array.from(seen.values());
}

function normalizeCopy(copy: {
  primaryText: string;
  headline: string;
  description: string;
}): string {
  return [copy.headline, copy.description]
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
