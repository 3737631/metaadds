import type { SaturationLevel } from "@/lib/types";

/**
 * SATURATION ENGINE
 *
 * Estimates how crowded a product/niche is based on observable advertiser
 * activity. A higher saturation score means more advertisers are chasing the
 * same audience, which reduces the expected value of entering and is applied
 * as a penalty to the winner score.
 *
 * Score is 0-100 and mapped to a level:
 *   LOW    0-29
 *   MEDIUM 30-54
 *   HIGH   55-79
 *   EXTREME 80-100
 */
export interface SaturationInput {
  advertiserCount: number;
  creativeCount: number;
  adCount: number;
  marketCount: number;
}

export interface SaturationResult {
  score: number;
  level: SaturationLevel;
  evidence: string[];
}

export function computeSaturation(input: SaturationInput): SaturationResult {
  const { advertiserCount, creativeCount, adCount, marketCount } = input;

  let score = 0;
  const evidence: string[] = [];

  // Advertiser density is the dominant crowding signal.
  const adv = scale(advertiserCount, [1, 14]);
  score += adv * 0.5;
  evidence.push(`${advertiserCount} advertiser(s) running (dominant crowding signal)`);

  // Creative volume and ad volume indicate repeat-impression pressure.
  const cr = scale(creativeCount, [2, 30]);
  score += cr * 0.25;
  const adr = scale(adCount, [2, 40]);
  score += adr * 0.15;

  // Broad market reach suggests the niche is well covered.
  const mkt = scale(marketCount, [1, 8]);
  score += mkt * 0.1;

  const final = Math.round(Math.max(0, Math.min(100, score)));
  return {
    score: final,
    level: levelFor(final),
    evidence,
  };
}

export function levelFor(score: number): SaturationLevel {
  if (score >= 80) return "EXTREME";
  if (score >= 55) return "HIGH";
  if (score >= 30) return "MEDIUM";
  return "LOW";
}

export function levelColor(level: SaturationLevel): string {
  switch (level) {
    case "EXTREME":
      return "rose";
    case "HIGH":
      return "amber";
    case "MEDIUM":
      return "sky";
    case "LOW":
      return "emerald";
  }
}

function scale(v: number, range: [number, number]): number {
  const [min, max] = range;
  if (v <= min) return 0;
  if (v >= max) return 1;
  return (v - min) / (max - min);
}
