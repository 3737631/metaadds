import type {
  NormalizedAd,
  Product,
  ProductCluster,
  NormalizedCreativeAsset,
} from "@/lib/types";
import { normalizeToken } from "@/lib/normalize";

/**
 * ENTITY RESOLUTION
 *
 * Groups the deduplicated ads into product-level entities. A product is an
 * identifiable item being sold across one or more landing pages. Resolution
 * uses weighted landing-page / domain evidence first (the strongest signal),
 * then keyword overlap of the ad copy as a supporting signal.
 *
 * Each cluster carries a clusterConfidence (0-100). High confidence means the
 * ads unambiguously describe the same product; lower confidence means the
 * grouping relies on weaker evidence and therefore contributes uncertainty to
 * the winner score (see the clustering-uncertainty penalty in winner.ts).
 */

const STOPWORDS = new Set([
  "the", "and", "for", "with", "your", "you", "our", "this", "that", "are",
  "free", "shop", "today", "now", "get", "buy", "over", "from", "into",
  "has", "have", "will", "just", "made", "make", "more", "than", "also",
  "only", "best", "top", "new", "great", "amazing", "love", "loved", "thousands",
]);

const categoryKeywords: Record<string, string[]> = {
  "Skincare & Beauty": ["serum", "skincare", "glow", "skin", "beauty", "radiant", "vitamin", "derma"],
  "Home & Living": ["cube", "packing", "home", "nest", "cozy", "organize", "storage", "travel"],
  "Fitness & Gear": ["resistance", "band", "workout", "fit", "gym", "active", "strength", "athletic"],
  "Food & Snacks": ["chips", "snack", "protein", "popped", "food", "nutrition", "bite"],
};

const headlineToken = (headline: string): string[] =>
  normalizeToken(headline).split(" ").filter((t) => t.length > 2 && !STOPWORDS.has(t));

function classifyCategory(copyTokens: Set<string>): string {
  let best = "General";
  let bestScore = 0;
  for (const [cat, kws] of Object.entries(categoryKeywords)) {
    const score = kws.reduce((acc, k) => (copyTokens.has(k) ? acc + 1 : acc), 0);
    if (score > bestScore) {
      bestScore = score;
      best = cat;
    }
  }
  return best;
}

function keywords(headlines: string[]): string[] {
  const counts = new Map<string, number>();
  for (const text of headlines) {
    for (const token of headlineToken(text)) {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([t]) => t);
}

export function resolveProducts(ads: NormalizedAd[]): {
  products: Product[];
  clusters: ProductCluster[];
  clusterAssignments: Map<string, string>;
} {
  // Group by normalized landing URL first.
  const byLanding = new Map<string, NormalizedAd[]>();
  for (const ad of ads) {
    const key = ad.landing.normalizedUrl;
    const arr = byLanding.get(key) ?? [];
    arr.push(ad);
    byLanding.set(key, arr);
  }

  const landingGroups = Array.from(byLanding.entries());
  const groups: NormalizedAd[][] = [];

  // Merge landing groups that share a strong keyword signature AND a domain,
  // because a product is often retargeted across several URLs on the same domain.
  for (const [, ads] of landingGroups) {
    const headlineTokens = ads.map((a) => headlineToken(a.copy.headline)).flat();
    const tokenSet = new Set(headlineTokens);
    let mergedInto: number | null = null;
    for (let gi = 0; gi < groups.length; gi++) {
      const existingSet = groups[gi][0].landing.domain === ads[0].landing.domain
        ? overlapScore(existingTokens(groups[gi]), tokenSet)
        : 0;
      if (existingSet >= 0.45) {
        mergedInto = gi;
        break;
      }
    }
    if (mergedInto === null) {
      groups.push(ads);
    } else {
      groups[mergedInto].push(...ads);
    }
  }

  const products: Product[] = [];
  const clusters: ProductCluster[] = [];
  const clusterAssignments = new Map<string, string>();

  groups.forEach((group, i) => {
    const id = "prod-" + (i + 1).toString().padStart(3, "0");
    const allTokens = new Set<string>();
    for (const ad of group) {
      for (const t of headlineToken(ad.copy.headline)) allTokens.add(t);
    }
    const headlines = group.map((a) => a.copy.headline);
    const kw = keywords(headlines);
    const category = classifyCategory(allTokens);

    const productName =
      kw.length > 0
        ? kw.map((k) => k.charAt(0).toUpperCase() + k.slice(1)).join(" ")
        : `${category} Product ${i + 1}`;

    const domains = Array.from(new Set(group.map((a) => a.landing.domain)));
    const landingPages = Array.from(new Set(group.map((a) => a.landing.url)));
    const markets = Array.from(
      new Set(group.map((a) => a.market))
    ).sort();
    const earliest = group.reduce(
      (m, a) => (a.startDate < m ? a.startDate : m),
      group[0].startDate
    );

    const imageUrls: string[] = [];
    for (const ad of group) {
      for (const c of ad.creatives) {
        if (c.type === "image" && !imageUrls.includes(c.url)) imageUrls.push(c.url);
      }
    }

    const brandTokens = Array.from(
      new Set(group.map((a) => a.advertiser.normalizedName))
    );
    const brand = brandTokens.length === 1 ? group[0].advertiser.name : null;

    const product: Product = {
      id,
      name: productName,
      category,
      domains,
      landingPages,
      brand,
      firstSeen: earliest,
      imageUrls,
      markets,
    };
    products.push(product);

    for (const ad of group) {
      clusterAssignments.set(ad.id, id);
    }

    clusters.push({
      id: "cluster-" + (i + 1),
      products: [product],
      confidence: clusterConfidence(group),
    });
  });

  return { products, clusters, clusterAssignments };
}

function existingTokens(group: NormalizedAd[]): Set<string> {
  const set = new Set<string>();
  for (const ad of group) {
    for (const t of headlineToken(ad.copy.headline)) set.add(t);
  }
  return set;
}

function overlapScore(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of b) if (a.has(t)) inter++;
  const union = new Set([...a, ...b]);
  return inter / (union.size || 1);
}

/**
 * Cluster confidence: stronger when more advertisers/timestamps/markets agree
 * on the same landing and creative signature, weaker when there are few samples
 * or the grouping rests on thin evidence.
 */
function clusterConfidence(group: NormalizedAd[]): number {
  const advertisers = new Set(group.map((a) => a.advertiser.id));
  const markets = new Set(group.map((a) => a.market));
  const imageFingerprints = new Set(
    group.map((a) => a.creatives.filter((c) => c.type === "image").map((c) => c.url).join("|"))
  );

  let base = 45;
  if (group.length >= 2) base += 5;
  if (group.length >= 5) base += 10;
  if (group.length >= 10) base += 10;
  base += Math.min(15, advertisers.size * 3);
  base += Math.min(10, markets.size * 2);
  if (imageFingerprints.size === 1) base += 5;
  return Math.max(20, Math.min(100, base));
}

export function mergeCreativeAssets(creatives: NormalizedCreativeAsset[]): NormalizedCreativeAsset[] {
  return Array.from(
    new Map(creatives.map((c) => [c.type + ":" + c.url, c])).values()
  );
}
