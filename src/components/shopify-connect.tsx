"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Plug, Unplug } from "lucide-react";

export interface ShopifyCreds {
  shop: string;
  token: string;
}

const STORAGE_KEY = "meta-winners:shopify";

export function loadShopifyCreds(): ShopifyCreds | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ShopifyCreds;
    if (parsed.shop && parsed.token) return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

export default function ShopifyConnect() {
  const [shop, setShop] = useState("");
  const [token, setToken] = useState("");
  const [saved, setSaved] = useState<ShopifyCreds | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    setSaved(loadShopifyCreds());
  }, []);

  function save() {
    const creds = { shop: shop.trim(), token: token.trim() };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(creds));
    setSaved(creds);
    setTestResult({ ok: true, message: "Conexión guardada en este navegador." });
  }

  function clear() {
    window.localStorage.removeItem(STORAGE_KEY);
    setSaved(null);
    setShop("");
    setToken("");
    setTestResult(null);
  }

  async function test() {
    if (!saved) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/shopify/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop: saved.shop, accessToken: saved.token, _test: true }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setTestResult({
          ok: false,
          message: json?.error?.message || "No pudimos conectar. Revisa el dominio y el token.",
        });
      } else {
        setTestResult({ ok: true, message: "Conectado correctamente. Tu tienda está lista para recibir temas." });
      }
    } catch {
      setTestResult({ ok: false, message: "Error de red al comprobar la conexión." });
    } finally {
      setTesting(false);
    }
  }

  return (
    <section>
      <div className="flex items-center gap-2">
        {saved ? <Plug className="h-4 w-4 text-emerald-400" /> : <Unplug className="h-4 w-4 text-dim" />}
        <h2 className="text-sm font-semibold uppercase tracking-wide text-faint">Conectar tu tienda Shopify</h2>
      </div>
      <p className="mt-2 text-sm text-dim">
        Cada cliente conecta su propia tienda. Introduce el dominio y el token de acceso de admin (gratis):{" "}
        <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-text">Ajustes → Apps → Desarrollar apps</span>
        {" "}→ crea una app interna con permisos de temas (leer y escribir) y copia su token.
      </p>

      {saved ? (
        <div className="mt-3 flex flex-col gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
          <div className="flex items-center gap-2 text-sm text-text">
            <Check className="h-4 w-4 text-emerald-400" />
            <span className="font-medium">{saved.shop}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={test}
              disabled={testing}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
            >
              {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plug className="h-3.5 w-3.5" />}
              Comprobar conexión
            </button>
            <button
              type="button"
              onClick={clear}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-xs text-dim hover:text-text"
            >
              <Unplug className="h-3.5 w-3.5" /> Desconectar
            </button>
          </div>
          {testResult && (
            <p className={"text-xs " + (testResult.ok ? "text-emerald-400" : "text-rose-400")}>{testResult.message}</p>
          )}
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          <label className="block">
            <span className="text-xs font-medium text-dim">Dominio de tu tienda</span>
            <input
              value={shop}
              onChange={(e) => setShop(e.target.value)}
              placeholder="tu-tienda.myshopify.com"
              autoCapitalize="none"
              spellCheck={false}
              className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-text focus:border-accent focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-dim">Token de acceso de admin</span>
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="shpat_xxxxxxxx"
              autoCapitalize="none"
              spellCheck={false}
              type="password"
              className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-text focus:border-accent focus:outline-none"
            />
          </label>
          <button
            type="button"
            onClick={save}
            disabled={!shop.trim() || !token.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            <Plug className="h-4 w-4" /> Guardar conexión
          </button>
        </div>
      )}
    </section>
  );
}