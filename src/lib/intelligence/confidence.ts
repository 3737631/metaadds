import type { ProductCluster } from "@/lib/types";

/**
 * CONFIDENCE SCORE
 *
 * Reflects how much trust we put in the winner score for a product. High
 * confidence means the evidence is abundant, fresh, and unambiguous. Low
 * confidence means sparse or conflicting evidence. Confidence is reported
 * alongside the winner score but is NOT the winner score itself.
 */
export interface ConfidenceInput {
  adCount: number;
  advertiserCount: number;
  creativeCount: number;
  isActiveShare: number; // 0-1
  clusterConfidence: number; // 0-100
  dataProviderIsDemo: boolean;
}

export interface ConfidenceResult {
  score: number;
  evidence: string[];
}

export function computeConfidence(input: ConfidenceInput): ConfidenceResult {
  const { adCount, advertiserCount, creativeCount, isActiveShare, clusterConfidence, dataProviderIsDemo } = input;
  const evidence: string[] = [];

  let score = 0;

  // Volume of samples we could actually see.
  const sample = scale(adCount + advertiserCount, [2, 40]);
  score += sample * 40;
  if (adCount < 3) evidence.push("Few ads observed — limited evidence");
  else evidence.push(`${adCount} ads observed`);

  // Diversity of independent sources reduces single-source bias.
  const source = scale(advertiserCount, [1, 8]);
  score += source * 15;
  evidence.push(`${advertiserCount} independent advertiser(s) as sources`);

  // Fresh/sustained activity increases reliability.
  score += isActiveShare * 15;
  evidence.push(`Active ad share: ${Math.round(isActiveShare * 100)}%`);

  // How confident we are that ads describe one and the same product.
  score += (clusterConfidence / 100) * 20;
  evidence.push(`Cluster confidence: ${clusterConfidence}/100`);

  // Demo data is internally consistent but not real-world — reflect that.
  if (dataProviderIsDemo) {
    score = score * 0.9;
    evidence.push("Data provider is demo — reduced by 10%");
  }

  const final = Math.round(Math.max(0, Math.min(100, score)));
  return { score: final, evidence };
}

function scale(v: number, range: [number, number]): number {
  const [min, max] = range;
  if (v <= min) return 0;
  if (v >= max) return 1;
  return (v - min) / (max - min);
}
