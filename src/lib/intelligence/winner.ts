import type {
  WinnerCategory,
  ScorePenalty,
  ScoreBreakdown,
  WinnerScoring,
  SaturationLevel,
} from "@/lib/types";
import { WEIGHTS, type SignalResult } from "@/lib/intelligence/signalEngine";

/**
 * WINNER SCORE
 *
 * Aggregates the raw signal score into a single 0-100 winner score, then
 * applies penalties for conditions that degrade the reliability or expected
 * value of the opportunity:
 *
 *   - Data quality       : sparse/fresh evidence reduces trust
 *   - Saturation         : crowded niches are penalized
 *   - Duplicate          : low dedup confidence hints at diluted signal
 *   - Clustering uncert. : low cluster confidence adds noise
 *
 * Categories (winner score):
 *   PROVEN    90-100
 *   STRONG    80-89
 *   EMERGING  70-79
 *   WATCHLIST 60-69
 *   LOW        0-59
 */
export interface WinnerInput {
  signal: SignalResult;
  saturationScore: number;
  saturationLevel: SaturationLevel;
  dataQuality: number; // 0-100
  clusterConfidence: number; // 0-100
  duplicateAdRatio: number; // 0-1
}

export function categoryFor(score: number): WinnerCategory {
  if (score >= 90) return "PROVEN";
  if (score >= 80) return "STRONG";
  if (score >= 70) return "EMERGING";
  if (score >= 60) return "WATCHLIST";
  return "LOW";
}

export function computeWinner(input: WinnerInput): WinnerScoring {
  const {
    signal,
    saturationScore,
    saturationLevel,
    dataQuality,
    clusterConfidence,
    duplicateAdRatio,
  } = input;

  const penalties: ScorePenalty[] = [];
  let penaltySum = 0;

  const addPenalty = (points: number, name: string, reason: string) => {
    if (points <= 0) return;
    penalties.push({ name, points, reason });
    penaltySum += points;
  };

  // 1. Data quality penalty — inversely related to data quality.
  const dataQualityPenalty = Math.round((100 - dataQuality) * 0.35);
  if (dataQualityPenalty > 0) {
    addPenalty(
      dataQualityPenalty,
      "Data Quality",
      `Data quality ${dataQuality}/100 leaves ${dataQualityPenalty} points of uncertainty`
    );
  }

  // 2. Saturation penalty.
  const saturationPenalty = Math.round(saturationScore * 0.4);
  if (saturationPenalty > 0) {
    addPenalty(
      saturationPenalty,
      "Saturation",
      `Saturation is ${saturationLevel.toLowerCase()} (${saturationScore}/100)`
    );
  }

  // 3. Duplicate penalty.
  const duplicatePenalty = Math.round(duplicateAdRatio * 100 * 0.3);
  if (duplicatePenalty > 0) {
    addPenalty(
      duplicatePenalty,
      "Duplicate",
      `${Math.round(duplicateAdRatio * 100)}% of raw ads were deduplicated — diluted signal`
    );
  }

  // 4. Clustering uncertainty penalty.
  const clusterPenalty = Math.round((100 - clusterConfidence) * 0.25);
  if (clusterPenalty > 0) {
    addPenalty(
      clusterPenalty,
      "Clustering Uncertainty",
      `Product cluster confidence ${clusterConfidence}/100`
    );
  }

  const baseScore = signal.rawSignal;
  const winnerScore = Math.max(0, Math.min(100, Math.round(baseScore - penaltySum)));

  return {
    winnerScore,
    category: categoryFor(winnerScore),
    confidence: Math.round(signal.rawSignal), // confidence computed separately too
    saturation: saturationScore,
    saturationLevel,
    signalBreakdown: signal.breakdown,
    penalties,
    dataQuality,
  };
}

export function breakdownWeighted(b: ScoreBreakdown): Record<keyof ScoreBreakdown, number> {
  const out = {} as Record<keyof ScoreBreakdown, number>;
  (Object.keys(WEIGHTS) as Array<keyof ScoreBreakdown>).forEach((k) => {
    out[k] = b[k] * WEIGHTS[k];
  });
  return out;
}

export const CATEGORY_META: Record<WinnerCategory, { label: string; color: string; blurb: string }> = {
  PROVEN: {
    label: "Proven",
    color: "emerald",
    blurb: "Sustained, multi-advertiser traction with strong momentum and longevity.",
  },
  STRONG: {
    label: "Strong",
    color: "green",
    blurb: "A dependable winner with solid diversity and recent activity.",
  },
  EMERGING: {
    label: "Emerging",
    color: "amber",
    blurb: "Shows promising early signals but not yet fully proven.",
  },
  WATCHLIST: {
    label: "Watchlist",
    color: "sky",
    blurb: "Moderate signals — monitor for growing advertiser momentum.",
  },
  LOW: {
    label: "Low",
    color: "slate",
    blurb: "Little observable evidence of a winning product.",
  },
};
