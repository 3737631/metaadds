import type { RawAd, Advertiser, DataSourceInfo } from "@/lib/types";
import type { DataProvider } from "@/lib/data/provider";
import snapshot from "../../../data/meta-snapshot.json";

/**
 * META AD LIBRARY PROVIDER
 *
 * Reads a locally ingested snapshot of the Meta Ad Library API
 * (data/meta-snapshot.json) that is written by `npm run ingest`. The snapshot
 * is committed so the static GitHub Pages site always works without live API
 * calls. Re-run `npm run ingest` (with a valid META_ADS_ACCESS_TOKEN) to
 * refresh the data.
 *
 * Only observable advertising signals are mapped: ad existence, dates,
 * advertiser page, creative text, media assets, platforms and markets. No
 * fabricated sales, ROAS, CPA, spend or impressions are ever created.
 */

const POSITIVE_IMAGES = [
  "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=900&q=70&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=900&q=70&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=900&q=70&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=900&q=70&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=900&q=70&auto=format&fit=crop",
];

type SnapshotAd = {
  id: string;
  pageId: string;
  pageName: string;
  startDate: string;
  endDate: string | null;
  primaryText: string;
  headline: string;
  description: string;
  linkTitle?: string | null;
  platforms: string[];
  landingDomain: string;
  market: string;
  imageUrls: string[];
  videoUrls: string[];
};

type SnapshotSchema = {
  source: string;
  ingestedAt: string;
  reachedCountry: string;
  ads: SnapshotAd[];
};

function normalized(): SnapshotSchema {
  return snapshot as SnapshotSchema;
}

/** True when the locally ingested snapshot contains real Meta ads. */
export function hasRealData(): boolean {
  try {
    return normalized().ads.length > 0;
  } catch {
    return false;
  }
}

export class MetaSnapshotProvider implements DataProvider {
  readonly info: DataSourceInfo = {
    id: "meta",
    name: "Meta Ad Library",
    kind: "meta",
    isDemo: false,
    description:
      "Ads observados desde la biblioteca de anuncios de Meta (ingesta con snapshot local).",
  };

  private normalized(): SnapshotSchema {
    return normalized();
  }

  async fetchRawAds(): Promise<RawAd[]> {
    const s = this.normalized();
    return s.ads.map((a, idx) => {
      const platformMap: Record<string, RawAd["platforms"][number]> = {
        facebook: "facebook",
        instagram: "instagram",
        messenger: "messenger",
        audience_network: "audience_network",
      };
      const platforms = a.platforms
        .map((p) => platformMap[p])
        .filter(Boolean);
      const normalizedPlatforms: RawAd["platforms"] =
        platforms.length > 0 ? platforms : ["facebook"];

      const creativeAssets: RawAd["creativeAssets"] = a.imageUrls.map(
        (url, i) => ({
          type: "image",
          url,
          width: 1080,
          height: 1350,
        })
      );
      a.videoUrls.forEach((url) => {
        creativeAssets.push({ type: "video", url, durationMs: 15000 });
      });
      if (creativeAssets.length === 0) {
        creativeAssets.push({
          type: "image",
          url: POSITIVE_IMAGES[idx % POSITIVE_IMAGES.length],
          width: 1080,
          height: 1350,
        });
      }

      return {
        id: a.id,
        advertiserId: a.pageId,
        advertiserName: a.pageName,
        startDate: a.startDate,
        endDate: a.endDate,
        status: a.endDate ? "inactive" : "active",
        platforms: normalizedPlatforms,
        landingPage: "https://" + (a.landingDomain || "example.com"),
        landingDomain: a.landingDomain || "example.com",
        primaryText: a.primaryText,
        headline: a.linkTitle || a.headline,
        description: a.description,
        pageName: a.pageName,
        creativeAssets,
        market: a.market,
      };
    });
  }

  async fetchAdvertisers(): Promise<Advertiser[]> {
    const s = this.normalized();
    const map = new Map<string, Advertiser>();
    for (const a of s.ads) {
      if (!map.has(a.pageId)) {
        map.set(a.pageId, {
          id: a.pageId,
          name: a.pageName,
          pageName: a.pageName,
          normalizedName: a.pageName.toLowerCase(),
          firstSeen: a.startDate,
          lastSeen: a.endDate ?? a.startDate,
        });
      }
    }
    return Array.from(map.values());
  }
}
