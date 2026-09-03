import type { SearchProvider, SearchProviderName } from "./provider";
import { SerperProvider } from "./serper";
import { DuckDuckGoProvider } from "./duckduckgo";

let cached: SearchProvider | null = null;

/**
 * Devuelve el proveedor de búsqueda configurado por variables de entorno.
 * 1. Serper (Google) si SEARCH_API_KEY está presente.
 * 2. DuckDuckGo (gratis, sin clave) como fallback.
 * Nunca devuelve resultados inventados.
 */
export function getSearchProvider(): SearchProvider {
  if (cached) return cached;
  const serperKey = process.env.SEARCH_API_KEY;
  if (serperKey) {
    cached = new SerperProvider(serperKey);
  } else {
    cached = new DuckDuckGoProvider();
  }
  return cached;
}

export function activeSearchProviderName(): SearchProviderName {
  return process.env.SEARCH_API_KEY ? "serper" : "duckduckgo";
}

/** Nombres de variables de entorno pendientes de configurar para la búsqueda. */
export function missingSearchKeys(): string[] {
  const missing: string[] = [];
  if (!process.env.SEARCH_API_KEY) missing.push("SEARCH_API_KEY");
  return missing;
}
