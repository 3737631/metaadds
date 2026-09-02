export type WinnerCategory =
  | "PROVEN"
  | "STRONG"
  | "EMERGING"
  | "WATCHLIST"
  | "LOW";

export type SaturationLevel = "LOW" | "MEDIUM" | "HIGH" | "EXTREME";

export type Platform = "facebook" | "instagram" | "audience_network" | "messenger";

export interface RawAd {
  id: string;
  advertiserId: string;
  advertiserName: string;
  startDate: string;
  endDate: string | null;
  status: "active" | "inactive";
  platforms: Platform[];
  landingPage: string;
  landingDomain: string;
  primaryText: string;
  headline: string;
  description: string;
  pageName: string;
  creativeAssets: RawCreativeAsset[];
  market: string;
}

export interface RawCreativeAsset {
  type: "image" | "video";
  url: string;
  width?: number;
  height?: number;
  durationMs?: number;
}

export interface NormalizedAd {
  id: string;
  advertiser: {
    id: string;
    name: string;
    pageName: string;
    normalizedName: string;
  };
  startDate: string;
  endDate: string | null;
  isActive: boolean;
  platforms: Platform[];
  landing: {
    url: string;
    domain: string;
    normalizedUrl: string;
  };
  copy: {
    primaryText: string;
    headline: string;
    description: string;
  };
  creatives: NormalizedCreativeAsset[];
  market: string;
}

export interface NormalizedCreativeAsset {
  type: "image" | "video";
  url: string;
  width?: number;
  height?: number;
  durationMs?: number;
}

export interface Advertiser {
  id: string;
  name: string;
  pageName: string;
  normalizedName: string;
  firstSeen: string;
  lastSeen: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  domains: string[];
  landingPages: string[];
  brand: string | null;
  firstSeen: string;
  imageUrls: string[];
  markets: string[];
}

export interface ProductCluster {
  id: string;
  products: Product[];
  confidence: number;
}

export interface ScoreBreakdown {
  advertiserDiversity: number;
  advertiserMomentum: number;
  adMomentum: number;
  longevity: number;
  creativeDiversity: number;
  marketDiversity: number;
  newAdvertiserEntry: number;
  creativePersistence: number;
}

export interface WinnerScoring {
  winnerScore: number;
  category: WinnerCategory;
  confidence: number;
  saturation: number;
  saturationLevel: SaturationLevel;
  signalBreakdown: ScoreBreakdown;
  penalties: ScorePenalty[];
  dataQuality: number;
}

export interface ScorePenalty {
  name: string;
  points: number;
  reason: string;
}

export interface ProductScore {
  productId: string;
  winnerScore: number;
  category: WinnerCategory;
  confidence: number;
  saturation: number;
  saturationLevel: SaturationLevel;
  signalBreakdown: ScoreBreakdown;
  dataQuality: number;
  penalties: ScorePenalty[];
  scoredAt: string;
}

export interface ScoredProduct {
  product: Product;
  score: ProductScore;
  advertisers: Advertiser[];
  adCount: number;
  activeAds: number;
  creativeCount: number;
  marketCount: number;
}

export interface SyncRun {
  id: string;
  provider: string;
  status: "completed" | "running" | "failed";
  startedAt: string;
  finishedAt: string | null;
  adsIngested: number;
  advertisersIngested: number;
  productsClustered: number;
  error?: string;
}

export interface DataSourceInfo {
  id: string;
  name: string;
  kind: "demo" | "meta";
  description: string;
  isDemo: boolean;
}
