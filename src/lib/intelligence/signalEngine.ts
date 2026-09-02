import type {
  NormalizedAd,
  Product,
  ProductCluster,
  ScoreBreakdown,
} from "@/lib/types";

/**
 * SIGNAL ENGINE
 *
 * Produces a normalized 0-100 signal breakdown for a product from observable
 * advertising evidence. Every point in every signal is derived from real,
 * observable signals — never from fabricated performance metrics.
 *
 * Weights:
 *   advertiserDiversity   20%
 *   advertiserMomentum    20%
 *   adMomentum            10%
 *   longevity             15%
 *   creativeDiversity     10%
 *   marketDiversity       10%
 *   newAdvertiserEntry    10%
 *   creativePersistence    5%
 *                        -----
 *                         100%
 */

const WEIGHTS: Record<keyof ScoreBreakdown, number> = {
  advertiserDiversity: 0.2,
  advertiserMomentum: 0.2,
  adMomentum: 0.1,
  longevity: 0.15,
  creativeDiversity: 0.1,
  marketDiversity: 0.1,
  newAdvertiserEntry: 0.1,
  creativePersistence: 0.05,
};

export interface ProductAds {
  ads: NormalizedAd[];
  product: Product;
  cluster: ProductCluster;
}

export interface SignalResult {
  breakdown: ScoreBreakdown;
  rawSignal: number;
  signalScore: number;
  evidence: Record<string, string[]>;
}

export function computeSignals(p: ProductAds): SignalResult {
  const ads = p.ads;
  const today = dateIso(new Date());
  const advertisers = unique(ads.map((a) => a.advertiser.id));
  const markets = unique(ads.map((a) => a.market));

  // Advertiser diversity: how many distinct advertisers push the product.
  const advertiserDiversity = scale(advertisers.length, [1, 12], 0.55);

  // Advertiser momentum: share of advertisers that started recently.
  const recentAdvertiserIds = new Set(
    ads.filter((a) => daysBetween(a.startDate, today) <= 45).map((a) => a.advertiser.id)
  );
  const advertiserMomentumBase = advertiserDiversity * 0.5 + (recentAdvertiserIds.size / Math.max(1, advertisers.length)) * 50;
  const advertiserMomentum = clamp(recentAdvertiserIds.size >= 3 ? advertiserMomentumBase + 15 : advertiserMomentumBase, 0, 100);

  // Ad momentum: proportion of the product's ads that are currently active.
  const activeAds = ads.filter((a) => a.isActive).length;
  const activeRatio = activeAds / Math.max(1, ads.length);
  const adMomentum = scale(activeRatio, [0, 0.7], 0.3) + Math.min(activeAds * 3, 20);

  // Longevity: how long the product has been advertised (in days).
  const firstSeen = ads.reduce((m, a) => (a.startDate < m ? a.startDate : m), ads[0].startDate);
  const longevityYears = daysBetween(firstSeen, today) / 365;
  const longevity = clamp(longevityYears / 1.5 * 100, 0, 100);

  // Creative diversity: distinct creatives used.
  const creativeKeys = unique(ads.flatMap((a) => a.creatives.map((c) => c.type + ":" + c.url)));
  const creativeDiversity = scale(creativeKeys.length, [2, 20], 0.5);

  // Market diversity: distinct geos.
  const marketDiversity = scale(markets.length, [1, 8], 0.6);

  // New advertiser entry: advertisers that began within the last 21 days.
  const newAdvertiserCount = unique(
    ads.filter((a) => daysBetween(a.startDate, today) <= 21).map((a) => a.advertiser.id)
  ).length;
  const newAdvertiserEntry = scale(newAdvertiserCount, [1, 6], 0.6);

  // Creative persistence: the same creatives reused across multiple advertisers.
  const reuseCounts = countReuse(ads);
  const persistenceSource = Math.max(0, ...Array.from(reuseCounts.values()).map((c) => c - 1));
  const creativePersistence = scale(persistenceSource, [1, 8], 0.5);

  const breakdown: ScoreBreakdown = {
    advertiserDiversity: round(advertiserDiversity),
    advertiserMomentum: round(advertiserMomentum),
    adMomentum: round(adMomentum),
    longevity: round(longevity),
    creativeDiversity: round(creativeDiversity),
    marketDiversity: round(marketDiversity),
    newAdvertiserEntry: round(newAdvertiserEntry),
    creativePersistence: round(creativePersistence),
  };

  const weighted = weightedSum(breakdown, WEIGHTS);
  const rawSignal = round(weighted);

  const evidence: Record<string, string[]> = {
    advertiserDiversity: [`${advertisers.length} distinct advertiser(s) running ads for this product`],
    advertiserMomentum: [
      `${recentAdvertiserIds.size} advertiser(s) started within the last 45 days`,
    ],
    adMomentum: [`${activeAds} of ${ads.length} ads currently active`],
    longevity: [`Advertised for ${Math.round(daysBetween(firstSeen, today))} days (since ${firstSeen})`],
    creativeDiversity: [`${creativeKeys.length} distinct creative asset(s) observed`],
    marketDiversity: [`Active in ${markets.length} market(s)`],
    newAdvertiserEntry: [`${newAdvertiserCount} advertiser(s) entered within the last 21 days`],
    creativePersistence: [`${persistenceSource} creative asset(s) reused across multiple advertisers`],
  };

  return { breakdown, rawSignal, signalScore: rawSignal, evidence };
}

function countReuse(ads: NormalizedAd[]): Map<string, number> {
  const count = new Map<string, number>();
  for (const ad of ads) {
    for (const c of ad.creatives) {
      const key = c.type + ":" + c.url;
      count.set(key, (count.get(key) ?? 0) + 1);
    }
  }
  return count;
}

// --- helpers ---
function dateIso(d: Date): string {
  return d.toISOString().split("T")[0];
}
function daysBetween(a: string, b: string): number {
  const da = new Date(a + "T00:00:00").getTime();
  const db = new Date(b + "T00:00:00").getTime();
  return Math.max(0, Math.round((db - da) / 86400000));
}
function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
function round(v: number): number {
  return Math.round(v * 10) / 10;
}
function scale(v: number, range: [number, number], knee: number): number {
  const [min, max] = range;
  if (v <= min) return 0;
  if (v >= max) return 100;
  const t = (v - min) / (max - min);
  const eased = Math.pow(t, knee);
  return clamp(eased * 100, 0, 100);
}
function weightedSum(b: ScoreBreakdown, w: Record<keyof ScoreBreakdown, number>): number {
  return (
    b.advertiserDiversity * w.advertiserDiversity +
    b.advertiserMomentum * w.advertiserMomentum +
    b.adMomentum * w.adMomentum +
    b.longevity * w.longevity +
    b.creativeDiversity * w.creativeDiversity +
    b.marketDiversity * w.marketDiversity +
    b.newAdvertiserEntry * w.newAdvertiserEntry +
    b.creativePersistence * w.creativePersistence
  );
}
function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

export { WEIGHTS, unique, clamp, scale, dateIso, daysBetween, round };
