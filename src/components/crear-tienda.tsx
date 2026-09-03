"use client";

import { useState } from "react";
import { loadShopifyCreds } from "./shopify-connect";
import ReplicaEditor from "./replica-editor";
import { replicaToTheme } from "@/lib/stores/replica";
import {
  Search,
  Store,
  Loader2,
  ArrowLeft,
  ArrowRight,
  Download,
  Check,
  ChevronDown,
} from "lucide-react";

type Category = { id: string; label: string };

interface StoreCandidate {
  id: string;
  name: string;
  url: string;
  domain: string;
  category: string;
  country: string;
  similarity: number;
  shopify: boolean;
  verified: boolean;
  title: string;
  snippet: string;
}

type Step = "topic" | "result" | "editor";

export default function CrearTienda({ categories }: { categories: Category[] }) {
  const [step, setStep] = useState<Step>("topic");
  const [topic, setTopic] = useState<Category | null>(null);
  const [searching, setSearching] = useState(false);
  const [candidates, setCandidates] = useState<StoreCandidate[]>([]);
  const [searchNote, setSearchNote] = useState("");
  const [selected, setSelected] = useState<StoreCandidate | null>(null);
  const [opening, setOpening] = useState(false);
  const [replica, setReplica] = useState<import("@/lib/stores/replica").StoreReplica | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notif, setNotif] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState<string | null>(null);

  function flash(msg: string) {
    setNotif(msg);
    setTimeout(() => setNotif(null), 2500);
  }

  async function doSearch() {
    if (!topic) return;
    setSearching(true);
    setSearchNote("");
    setCandidates([]);
    setError(null);
    try {
      const res = await fetch("/api/stores/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: topic.label, country: "es" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Error al buscar tiendas");
      setCandidates(json.data.candidates || []);
      setSearchNote(json.data.note || "");
      setStep("result");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error buscando tiendas");
    } finally {
      setSearching(false);
    }
  }

  async function doOpen(c: StoreCandidate) {
    setSelected(c);
    setOpening(true);
    setError(null);
    setUploaded(null);
    try {
      const res = await fetch("/api/stores/replica", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: c.url }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "No se pudo abrir la tienda");
      setReplica(json.data.replica);
      setStep("editor");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al abrir la tienda");
    } finally {
      setOpening(false);
    }
  }

  async function doDownload() {
    if (!replica) return;
    setDownloading(true);
    const theme = replicaToTheme(replica);
    try {
      const res = await fetch("/api/shopify/theme/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme }),
      });
      if (!res.ok) throw new Error("No se pudo generar el ZIP");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${theme.brandName || "tienda"}-theme.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      flash("Tema Shopify descargado");
    } catch {
      setError("No se pudo generar el ZIP");
    } finally {
      setDownloading(false);
    }
  }

  async function doUpload() {
    if (!replica) return;
    setUploading(true);
    setUploaded(null);
    setError(null);
    const creds = loadShopifyCreds();
    if (!creds) {
      setError("Primero conecta tu tienda en Ajustes (dominio y token de admin).");
      setUploading(false);
      return;
    }
    const theme = replicaToTheme(replica);
    try {
      const res = await fetch("/api/shopify/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop: creds.shop, accessToken: creds.token, theme }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error?.message || "No se pudo subir el tema.");
      }
      setUploaded(json?.data?.message ?? "Tema subido.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al subir el tema.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {notif && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-emerald-500/90 px-4 py-2 text-sm font-semibold text-white shadow-lg">
          {notif}
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-300">
          {error}
        </div>
      )}

      {/* PASO 0: categoría / temática — desplegable Apple-style, siempre visible */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center gap-2 text-2xl font-bold tracking-tight text-text sm:text-3xl">
          <Store className="h-7 w-7 text-accent2" /> Crear tienda
        </div>
        <p className="mx-auto mt-2 max-w-sm text-sm text-dim">
          Elige una temática, mira las tiendas que están funcionando y crea la tuya con tu propia marca.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <label className="block text-left">
          <span className="text-xs font-medium text-dim">Temática</span>
          <div className="relative mt-1">
            <select
              value={topic?.label ?? ""}
              onChange={(e) => {
                const c = categories.find((x) => x.label === e.target.value);
                setTopic(c ?? null);
                setStep(c ? "topic" : "topic");
                setCandidates([]);
                setSearchNote("");
                setSelected(null);
                setReplica(null);
              }}
              className="w-full appearance-none rounded-2xl border border-border bg-surface px-4 py-3.5 text-base font-semibold text-text focus:border-accent focus:outline-none"
            >
              <option value="" disabled>
                Elige una temática
              </option>
              {categories.map((c) => (
                <option key={c.id} value={c.label}>
                  {c.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-dim" />
          </div>
        </label>

        <button
          type="button"
          onClick={doSearch}
          disabled={!topic || searching}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-6 py-4 text-base font-semibold text-white shadow-lg shadow-accent/25 transition-transform active:scale-[0.98] hover:brightness-110 disabled:opacity-40"
        >
          {searching ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
          {searching ? "Buscando tiendas..." : "VER TIENDAS QUE FUNCIONAN"}
        </button>
      </div>

      {step === "topic" ? (
        <p className="text-center text-xs text-dim">
          {searching
            ? `Buscando tiendas reales de ${topic?.label}... puede tardar unos segundos.`
            : "Selecciona una temática y pulsa el botón para ver tiendas reales verificadas."}
        </p>
      ) : null}

      {/* PASO 1: resultados */}
      {step === "result" ? (
        <>
          <div className="flex items-center gap-2 text-sm text-dim">
            <button type="button" onClick={() => setStep("topic")} className="inline-flex items-center gap-1 hover:text-text">
              <ArrowLeft className="h-4 w-4" /> Cambiar temática
            </button>
          </div>
          <h2 className="text-lg font-semibold text-text">Tiendas de {topic?.label}</h2>
          {searchNote && <p className="text-xs text-faint">{searchNote}</p>}
          {candidates.length === 0 ? (
            <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-dim">
              No se encontraron tiendas. Prueba otra temática.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {candidates.map((c, i) => (
                <div key={c.id} className="rounded-2xl border border-border bg-surface p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-text">{c.name}</div>
                      <div className="mt-0.5 truncate text-xs text-dim">{c.url}</div>
                      {c.snippet && <p className="mt-1.5 text-xs text-faint line-clamp-2">{c.snippet}</p>}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {c.shopify && (
                        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                          Shopify
                        </span>
                      )}
                      <span className="text-[10px] text-faint">Similitud {c.similarity}%</span>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-accent2 hover:underline"
                    >
                      Visitar <ArrowRight className="h-3.5 w-3.5" />
                    </a>
                    <button
                      type="button"
                      onClick={() => doOpen(c)}
                      disabled={opening && selected?.id === c.id}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-white ring-1 ring-accent"
                    >
                      {opening && selected?.id === c.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                      {opening && selected?.id === c.id ? "Abriendo..." : "Abrir y editar"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : null}

      {/* PASO 2: editor fiel click-to-edit */}
      {step === "editor" && replica ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep("result")}
              className="inline-flex items-center gap-1 text-sm text-dim hover:text-text"
            >
              <ArrowLeft className="h-4 w-4" /> Volver a tiendas
            </button>
            <span className="text-xs text-faint">
              Haz clic en cualquier texto, color o imagen para editarlo
            </span>
          </div>

          <ReplicaEditor replica={replica} onChange={setReplica} />

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={doDownload}
              disabled={downloading}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-40"
            >
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {downloading ? "Generando ZIP..." : "DESCARGAR TEMA SHOPIFY (ZIP)"}
            </button>

            <button
              type="button"
              onClick={doUpload}
              disabled={uploading}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-3.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-40"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {uploading ? "Subiendo a tu tienda..." : "SUBIR A MI TIENDA SHOPIFY"}
            </button>
            {uploaded && (
              <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-400">
                {uploaded}
              </p>
            )}
            {!loadShopifyCreds() && (
              <a
                href="/ajustes"
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-surface px-4 py-3 text-xs text-dim hover:text-text"
              >
                Conectar mi tienda (dominio y token) en Ajustes
              </a>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
