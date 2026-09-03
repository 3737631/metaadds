import type { DataProvider } from "@/lib/data/provider";
import { MockDataProvider } from "@/lib/data/mockData";
import { MetaSnapshotProvider, hasRealData } from "@/lib/data/metaProvider";
import { normalizeAds } from "@/lib/normalize";
import { deduplicateAds } from "@/lib/dedupe";
import { resolveProducts } from "@/lib/entityResolution";
import { computeSignals, type SignalResult } from "@/lib/intelligence/signalEngine";
import { computeSaturation } from "@/lib/intelligence/saturationEngine";
import { computeConfidence } from "@/lib/intelligence/confidence";
import { computeWinner, categoryFor, type WinnerInput } from "@/lib/intelligence/winner";
import type {
  NormalizedAd,
  Product,
  Advertiser,
  ProductScore,
  ScoredProduct,
  DataSourceInfo,
  SyncRun,
  ProductCluster,
  PriceInfo,
} from "@/lib/types";

/**
 * WATCHLIST
 *
 * Simulated watchlist persisted to localStorage. Kept in a tiny module so a
 * real database backend can swap in later without touching the UI.
 */

export interface WatchlistStore {
  productIds: string[];
  toggledAt: Record<string, string>;
}

export class LocalWatchlist {
  private key = "mwi:watchlist";

  read(): WatchlistStore {
    if (typeof window === "undefined") return { productIds: [], toggledAt: {} };
    try {
      const raw = window.localStorage.getItem(this.key);
      if (!raw) return { productIds: [], toggledAt: {} };
      return JSON.parse(raw) as WatchlistStore;
    } catch {
      return { productIds: [], toggledAt: {} };
    }
  }

  private write(store: WatchlistStore) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(this.key, JSON.stringify(store));
  }

  toggle(productId: string): WatchlistStore {
    const store = this.read();
    const exists = store.productIds.includes(productId);
    if (exists) {
      store.productIds = store.productIds.filter((id) => id !== productId);
      delete store.toggledAt[productId];
    } else {
      store.productIds.push(productId);
      store.toggledAt[productId] = new Date().toISOString();
    }
    this.write(store);
    return store;
  }

  isWatched(productId: string): boolean {
    return this.read().productIds.includes(productId);
  }
}

export interface PipelineResult {
  products: Product[];
  clusters: ProductCluster[];
  normalizedAds: NormalizedAd[];
  advertisers: Advertiser[];
  scored: ScoredProduct[];
  provider: DataSourceInfo;
  duplicatesRemoved: number;
  lastSync: SyncRun;
}

export function getProviders(): DataProvider[] {
  if (hasRealData()) return [new MetaSnapshotProvider(), new MockDataProvider()];
  return [new MockDataProvider(), new MetaSnapshotProvider()];
}

/**
 * Observable demo price intelligence. Source is clearly the demo dataset —
 * these are illustrative observed prices, never fabricated as real market data.
 */
const DEMO_PRICES: Record<string, PriceInfo> = {
  "lumaglow.com": {
    currency: "EUR",
    min: 24.99,
    typical: 29.99,
    max: 39.99,
    costLow: 8,
    costHigh: 12,
    costSource: "Estimación demo (proveedores)",
    observedAt: new Date().toISOString(),
  },
  "novahome.com": {
    currency: "EUR",
    min: 19.99,
    typical: 24.99,
    max: 34.99,
    costLow: 6,
    costHigh: 9,
    costSource: "Estimación demo (proveedores)",
    observedAt: new Date().toISOString(),
  },
  "everfit.com": {
    currency: "EUR",
    min: 22.99,
    typical: 27.99,
    max: 37.99,
    costLow: 7,
    costHigh: 10,
    costSource: "Estimación demo (proveedores)",
    observedAt: new Date().toISOString(),
  },
  "purebite.com": {
    currency: "EUR",
    min: 14.99,
    typical: 19.99,
    max: 24.99,
    costLow: 5,
    costHigh: 8,
    costSource: "Estimación demo (proveedores)",
    observedAt: new Date().toISOString(),
  },
};

async function loadProviderData(provider: DataProvider) {
  const [raw, advertiserList] = await Promise.all([
    provider.fetchRawAds(),
    provider.fetchAdvertisers(),
  ]);
  return { raw, advertiserList };
}

const pipelineCache = new Map<string, PipelineResult>();

/**
 * Async, cacheable pipeline loader. Runs the full pipeline
 * (normalize → dedupe → entity resolve → signal → scoring → ranking) over a
 * data provider. This is the single shared scoring path for demo AND real data.
 */
export async function getPipelineData(providerId = "demo"): Promise<PipelineResult> {
  const cached = pipelineCache.get(providerId);
  if (cached) return cached;

  const providers = getProviders();
  const provider = providers.find((p) => p.info.id === providerId) ?? providers[0];
  const { raw, advertiserList } = await loadProviderData(provider);

  const normalized = normalizeAds(raw);
  const beforeDedupe = normalized.length;
  const deduped = deduplicateAds(normalized);
  const duplicatesRemoved = beforeDedupe - deduped.length;

  const { products, clusters, clusterAssignments } = resolveProducts(deduped);
  const clusterByProduct = new Map<string, ProductCluster>();
  for (const c of clusters) {
    for (const p of c.products) clusterByProduct.set(p.id, c);
  }

  const adsByProduct = new Map<string, NormalizedAd[]>();
  for (const ad of deduped) {
    const pid = clusterAssignments.get(ad.id);
    if (!pid) continue;
    const arr = adsByProduct.get(pid) ?? [];
    arr.push(ad);
    adsByProduct.set(pid, arr);
  }

  const scored: ScoredProduct[] = products.map((product) => {
    const productAds = adsByProduct.get(product.id) ?? [];
    const cluster = clusterByProduct.get(product.id);
    const advertisers = uniqueAdvertisers(productAds, advertiserList);
    const signal: SignalResult = computeSignals({
      ads: productAds,
      product,
      cluster: cluster!,
    });
    const creativeCount = uniqueStrings(
      productAds.flatMap((a) => a.creatives.map((c) => c.type + ":" + c.url))
    ).length;
    const advertiserCount = advertisers.length;
    const activeShare = productAds.length
      ? productAds.filter((a) => a.isActive).length / productAds.length
      : 0;
    const saturation = computeSaturation({
      advertiserCount,
      creativeCount,
      adCount: productAds.length,
      marketCount: product.markets.length,
    });
    const dataQuality = computeDataQuality(productAds.length, advertisers.length, productAds.length);
    const confidence = computeConfidence({
      adCount: productAds.length,
      advertiserCount,
      creativeCount,
      isActiveShare: activeShare,
      clusterConfidence: cluster?.confidence ?? 50,
      dataProviderIsDemo: provider.info.isDemo,
    });
    const duplicateAdRatio = duplicatesRemoved / Math.max(1, beforeDedupe);
    const scoring = computeWinner({
      signal,
      saturationScore: saturation.score,
      saturationLevel: saturation.level,
      dataQuality,
      clusterConfidence: cluster?.confidence ?? 50,
      duplicateAdRatio,
    });
    const score: ProductScore = {
      productId: product.id,
      winnerScore: scoring.winnerScore,
      category: scoring.category,
      confidence: confidence.score,
      saturation: scoring.saturation,
      saturationLevel: scoring.saturationLevel,
      signalBreakdown: scoring.signalBreakdown,
      dataQuality,
      penalties: scoring.penalties,
      scoredAt: new Date().toISOString(),
    };
    const daysObserved = Math.max(
      1,
      Math.round((Date.now() - Date.parse(product.firstSeen)) / 86400000)
    );
    return {
      product,
      score,
      advertisers,
      adCount: productAds.length,
      activeAds: productAds.filter((a) => a.isActive).length,
      creativeCount,
      marketCount: product.markets.length,
      price: DEMO_PRICES[product.domains[0]] ?? null,
      daysObserved,
    };
  });
  scored.sort((a, b) => b.score.winnerScore - a.score.winnerScore);

  const lastSync: SyncRun = {
    id: "sync-" + Date.now(),
    provider: provider.info.id,
    status: "completed",
    startedAt: new Date(Date.now() - 1000).toISOString(),
    finishedAt: new Date().toISOString(),
    adsIngested: raw.length,
    advertisersIngested: advertiserList.length,
    productsClustered: products.length,
  };

  const result: PipelineResult = {
    products,
    clusters,
    normalizedAds: deduped,
    advertisers: advertiserList,
    scored,
    provider: provider.info,
    duplicatesRemoved,
    lastSync,
  };
  pipelineCache.set(providerId, result);
  return result;
}

export function uniqueAdvertisers(ads: NormalizedAd[], all: Advertiser[]): Advertiser[] {
  const byId = new Map(all.map((a) => [a.id, a]));
  const seen = new Map<string, Advertiser>();
  for (const ad of ads) {
    if (!seen.has(ad.advertiser.id)) {
      seen.set(
        ad.advertiser.id,
        byId.get(ad.advertiser.id) ?? {
          id: ad.advertiser.id,
          name: ad.advertiser.name,
          pageName: ad.advertiser.pageName,
          normalizedName: ad.advertiser.normalizedName,
          firstSeen: ad.startDate,
          lastSeen: ad.startDate,
        }
      );
    }
  }
  return Array.from(seen.values());
}

function uniqueStrings(arr: string[]): string[] {
  return Array.from(new Set(arr));
}

/**
 * Data quality: derived only from observable evidence volume and freshness.
 * High when there are many ads, many advertisers and recent activity.
 */
export function computeDataQuality(
  adCount: number,
  advertiserCount: number,
  activeCount: number
): number {
  let q = 20;
  q += Math.min(30, adCount * 2.5);
  q += Math.min(30, advertiserCount * 4);
  q += Math.min(20, activeCount * 3);
  return Math.max(0, Math.min(100, Math.round(q)));
}

export { categoryFor };

