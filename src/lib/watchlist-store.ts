"use client";

import { useSyncExternalStore } from "react";
import { LocalWatchlist } from "@/lib/repository";

const EVENT = "mw:watchlist";

function subscribe(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

function getSnapshot(): string {
  if (typeof window === "undefined") return "";
  return JSON.stringify(new LocalWatchlist().read().productIds);
}

function isEmpty(snapshot: string): boolean {
  return snapshot === "" || snapshot === "[]";
}

export function useSavedIds(): string[] {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => "");
  if (isEmpty(snapshot)) return [];
  try {
    return JSON.parse(snapshot) as string[];
  } catch {
    return [];
  }
}

export function useIsSaved(productId: string): boolean {
  const ids = useSavedIds();
  return ids.includes(productId);
}

export function toggleSaved(productId: string): boolean {
  const store = new LocalWatchlist().toggle(productId);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(EVENT));
  }
  return store.productIds.includes(productId);
}
