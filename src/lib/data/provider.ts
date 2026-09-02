import type { RawAd, Advertiser, DataSourceInfo } from "@/lib/types";

/**
 * DataProvider abstraction.
 *
 * All Meta advertising data enters the pipeline through a DataProvider. This
 * keeps the intelligence engines identical regardless of whether the data is
 * demo (carefully hand-crafted, clearly flagged) or fetched from the real
 * Meta Ad Library API.
 *
 * IMPORTANT: A provider must NEVER fabricate performance metrics (ROAS, CPA,
 * sales, conversions). Only observable advertising signals are allowed:
 * that an ad exists, its dates, its advertiser, its creative assets and the
 * markets/platforms it appears in. Everything else is derived by the engines
 * from these observable signals.
 */
export interface DataProvider {
  readonly info: DataSourceInfo;
  fetchRawAds(): Promise<RawAd[]>;
  fetchAdvertisers(): Promise<Advertiser[]>;
}
