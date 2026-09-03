import type {
  RawAd,
  Advertiser,
  DataSourceInfo,
  RawCreativeAsset,
} from "@/lib/types";
import type { DataProvider } from "@/lib/data/provider";

/**
 * MOCK DATA PROVIDER
 *
 * This provider serves carefully hand-crafted DEMO data. It is clearly flagged
 * as `isDemo: true` and every UI surface must show an indicator that the data
 * is illustrative. It never fabricates performance metrics — only observable
 * advertising signals.
 *
 * A "today" anchor is used so that recency-based signals (advertiser momentum,
 * ad momentum) behave realistically relative to the current date.
 */

const today = new Date();
const iso = (daysAgo: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split("T")[0];
};

const unsplash = (photoId: string): RawCreativeAsset => ({
  type: "image",
  url: `https://images.unsplash.com/${photoId}?w=900&q=70&auto=format&fit=crop`,
  width: 1080,
  height: 1350,
});

// Real, freely-licensed Unsplash photos (verified reachable). Grouped per niche.
const SERUM_IMGS = [
  "photo-1686121522744-dc323ce3fb26",
  "photo-1723951174326-2a97221d3b7f",
  "photo-1741896135512-084b251887f7",
  "photo-1640625696922-1fd63c0b97c9",
];
const CUBE_IMGS = [
  "photo-1527849214787-c99cd25c2f09",
  "photo-1681263810102-ee12f623a5f3",
  "photo-1570543581686-2ff4efd5df18",
];
const BAND_IMGS = [
  "photo-1767605523281-8b54b3692078",
  "photo-1767605524203-b942b7fa91b5",
];
const CHIP_IMGS = [
  "photo-1708746333890-8e775f97f0a6",
  "photo-1755415275657-e2024d4e033c",
  "photo-1748765968997-ba9bae9cfd7b",
  "photo-1674747497867-6cb150b3cb84",
];

const img = (pool: string[], seed: number): RawCreativeAsset =>
  unsplash(pool[seed % pool.length]);

const video = (url: string): RawCreativeAsset => ({
  type: "video",
  url,
  durationMs: 15000,
});

export class MockDataProvider implements DataProvider {
  readonly info: DataSourceInfo = {
    id: "demo",
    name: "Demo Data (illustrative)",
    kind: "demo",
    isDemo: true,
    description:
      "Hand-crafted illustrative dataset clearly marked as demo. No real Meta performance data.",
  };

  private advertisers: Advertiser[] = [
    { id: "adv-01", name: "LumaGlow Skincare", pageName: "LumaGlow", normalizedName: "lumaglowskincare", firstSeen: iso(120), lastSeen: iso(0) },    { id: "adv-02", name: "Radiant Skin Co", pageName: "Radiant Skin Co", normalizedName: "radiantskinco", firstSeen: iso(150), lastSeen: iso(0) },
    { id: "adv-03", name: "GlowBottle Beauty", pageName: "GlowBottle", normalizedName: "glowbottlebeauty", firstSeen: iso(90), lastSeen: iso(0) },
    { id: "adv-04", name: "DermaPure Lab", pageName: "DermaPure", normalizedName: "dermapurelab", firstSeen: iso(75), lastSeen: iso(0) },
    { id: "adv-05", name: "SkinFix Essentials", pageName: "SkinFix", normalizedName: "skinfixessentials", firstSeen: iso(60), lastSeen: iso(0) },
    { id: "adv-06", name: "Nova Home Co", pageName: "Nova Home", normalizedName: "novahomeco", firstSeen: iso(200), lastSeen: iso(0) },
    { id: "adv-07", name: "CozyNest Living", pageName: "CozyNest", normalizedName: "cozynestliving", firstSeen: iso(180), lastSeen: iso(0) },
    { id: "adv-08", name: "HomeRise", pageName: "HomeRise", normalizedName: "homerise", firstSeen: iso(110), lastSeen: iso(0) },
    { id: "adv-09", name: "EverFit Active", pageName: "EverFit", normalizedName: "everfitactive", firstSeen: iso(160), lastSeen: iso(0) },
    { id: "adv-10", name: "PeakPulse Athletics", pageName: "PeakPulse", normalizedName: "peakpulseathletics", firstSeen: iso(140), lastSeen: iso(0) },
    { id: "adv-11", name: "IronForm Gear", pageName: "IronForm", normalizedName: "ironformgear", firstSeen: iso(85), lastSeen: iso(0) },
    { id: "adv-12", name: "FitForge Studio", pageName: "FitForge", normalizedName: "fitforgestudio", firstSeen: iso(70), lastSeen: iso(0) },
    { id: "adv-13", name: "PureBite Foods", pageName: "PureBite", normalizedName: "purebitefoods", firstSeen: iso(130), lastSeen: iso(0) },
    { id: "adv-14", name: "SnackSavvy", pageName: "SnackSavvy", normalizedName: "snacksavvy", firstSeen: iso(14), lastSeen: iso(0) },
    { id: "adv-15", name: "NutriPop", pageName: "NutriPop", normalizedName: "nutripop", firstSeen: iso(9), lastSeen: iso(0) },
    { id: "adv-16", name: "WellNibble Co", pageName: "WellNibble", normalizedName: "wellnibbleco", firstSeen: iso(3), lastSeen: iso(0) },
  ];

  private rawAds: RawAd[] = [
    // ===== SKINCARE (LumaGlow serum) — high diversity, long-lived =====
    ...skinSerumAds(),

    // ===== HOME (compression travel cube set) =====
    ...travelCubeAds(),

    // ===== FITNESS (resistance band set) =====
    ...resistanceBandAds(),

    // ===== FOOD (popped chips brand) — NEW entrants, low diversity =====
    ...popChipsAds(),
  ];

  async fetchAdvertisers(): Promise<Advertiser[]> {
    return this.advertisers;
  }

  async fetchRawAds(): Promise<RawAd[]> {
    return this.rawAds;
  }
}

function skinSerumAds(): RawAd[] {
  const lp = "https://lumaglow.com/serum";
  const brands = [
    { id: "adv-01", name: "LumaGlow Skincare", page: "LumaGlow", starts: [120, 105, 88, 60, 45, 30, 18, 6, 2] },
    { id: "adv-02", name: "Radiant Skin Co", page: "Radiant Skin Co", starts: [150, 130, 90, 50, 20] },
    { id: "adv-03", name: "GlowBottle Beauty", page: "GlowBottle", starts: [90, 70, 40, 12] },
    { id: "adv-04", name: "DermaPure Lab", page: "DermaPure", starts: [75, 55, 35, 15, 5] },
    { id: "adv-05", name: "SkinFix Essentials", page: "SkinFix", starts: [60, 42, 25, 8] },
  ];
  return brands.flatMap((b, i) =>
    b.starts.map((s, j) =>
      mkAd("serum-" + b.id + "-" + j, b, s, lp, "Revitalizing Vitamin C Serum", "Serum", j, SERUM_IMGS)
    )
  );
}

function travelCubeAds(): RawAd[] {
  const lp = "https://novahome.com/packing-cubes";
  const brands = [
    { id: "adv-06", name: "Nova Home Co", page: "Nova Home", starts: [200, 170, 120, 80, 40, 10] },
    { id: "adv-07", name: "CozyNest Living", page: "CozyNest", starts: [180, 140, 95, 55, 22] },
    { id: "adv-08", name: "HomeRise", page: "HomeRise", starts: [110, 75, 30] },
  ];
  return brands.flatMap((b, i) =>
    b.starts.map((s, j) =>
      mkAd("cube-" + b.id + "-" + j, b, s, lp, "Ultimate Packing Cube Set", "Packing Cubes", j, CUBE_IMGS)
    )
  );
}

function resistanceBandAds(): RawAd[] {
  const lp = "https://everfit.com/resistance-bands";
  const brands = [
    { id: "adv-09", name: "EverFit Active", page: "EverFit", starts: [160, 130, 85, 40, 10] },
    { id: "adv-10", name: "PeakPulse Athletics", page: "PeakPulse", starts: [140, 100, 55, 20] },
    { id: "adv-11", name: "IronForm Gear", page: "IronForm", starts: [85, 50, 18] },
    { id: "adv-12", name: "FitForge Studio", page: "FitForge", starts: [70, 32] },
  ];
  return brands.flatMap((b, i) =>
    b.starts.map((s, j) =>
      mkAd("band-" + b.id + "-" + j, b, s, lp, "Pro Resistance Band Set", "Resistance Bands", j, BAND_IMGS)
    )
  );
}

function popChipsAds(): RawAd[] {
  const lp = "https://purebite.com/popped-chips";
  const brands = [
    { id: "adv-13", name: "PureBite Foods", page: "PureBite", starts: [30, 20, 10] },
    { id: "adv-14", name: "SnackSavvy", page: "SnackSavvy", starts: [14, 7] },
    { id: "adv-15", name: "NutriPop", page: "NutriPop", starts: [9, 4] },
    { id: "adv-16", name: "WellNibble Co", page: "WellNibble", starts: [3, 1] },
  ];
  return brands.flatMap((b, i) =>
    b.starts.map((s, j) =>
      mkAd("chips-" + b.id + "-" + j, b, s, lp, "Protein Popped Chips", "Protein Chips", j, CHIP_IMGS)
    )
  );
}

let adSeq = 0;
function mkAd(
  stableId: string,
  b: { id: string; name: string; page: string },
  startDaysAgo: number,
  landingPage: string,
  headline: string,
  productCategory: string,
  variant: number,
  imgPool: string[]
): RawAd {
  adSeq++;
  const startDate = iso(startDaysAgo);
  const stillActive = startDaysAgo <= 14;
  const marketsCycle = ["United States", "United States", "United Kingdom", "Canada", "Australia", "Germany", "United States"];
  const platformPick: Array<RawAd["platforms"]> = [
    ["facebook", "instagram"],
    ["instagram"],
    ["facebook"],
    ["facebook", "instagram", "messenger"],
  ];
  const creatives: RawCreativeAsset[] = [
    img(imgPool, variant),
    img(imgPool, variant + 1),
  ];
  if (variant % 2 === 0) {
    creatives.push(video("/assets/demo-creative.mp4"));
  }
  return {
    id: "ad-" + (stableId) + "-" + adSeq,
    advertiserId: b.id,
    advertiserName: b.name,
    startDate,
    endDate: stillActive ? null : iso(startDaysAgo - 7),
    status: stillActive ? "active" : "inactive",
    platforms: platformPick[variant % platformPick.length],
    landingPage,
    landingDomain: new URL(landingPage).hostname,
    primaryText: `Discover the ${productCategory} loved by thousands. Free returns.`,
    headline,
    description: "Premium quality you can feel. Shop the collection today.",
    pageName: b.page,
    creativeAssets: creatives,
    market: marketsCycle[variant % marketsCycle.length],
  };
}
