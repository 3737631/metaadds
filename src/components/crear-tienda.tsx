"use client";

import { useRef, useState } from "react";
import { loadShopifyCreds } from "./shopify-connect";
import StoreFrame from "./store-frame";
import { replicaToTheme } from "@/lib/stores/replica";
import type { ChatOp } from "@/lib/stores/chat";
import {
  Search,
  Store,
  Loader2,
  ArrowLeft,
  ArrowRight,
  Download,
  Check,
  ChevronDown,
  Pencil,
  Send,
  Sparkles,
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
  const [snapshot, setSnapshot] = useState<import("@/lib/stores/snapshot").StoreSnapshot | null>(null);
  const [replica, setReplica] = useState<import("@/lib/stores/replica").StoreReplica | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notif, setNotif] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [chatMsgs, setChatMsgs] = useState<{ role: "user" | "ai" | "sys"; text: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatOpsRef = useRef<((ops: ChatOp[]) => void) | null>(null);
  const [streamingReply, setStreamingReply] = useState<string | null>(null);
  const typewriterRef = useRef<number | null>(null);

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
    setEditing(false);
    setChatMsgs([]);
    setChatInput("");
    setStreamingReply(null);
    try {
      // Miniatura fiel (HTML+CSS reales) + réplica (para descargar/subir tema).
      const [snapRes, reproRes] = await Promise.all([
        fetch("/api/stores/snapshot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: c.url }),
        }),
        fetch("/api/stores/replica", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: c.url }),
        }),
      ]);
      const [snapJson, reproJson] = await Promise.all([
        snapRes.json(),
        reproRes.json(),
      ]);
      if (!snapRes.ok) throw new Error(snapJson.error?.message || "No se pudo capturar la web");
      setSnapshot(snapJson.data);
      if (reproRes.ok && reproJson.data?.replica) setReplica(reproJson.data.replica);
      setStep("editor");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al abrir la tienda");
    } finally {
      setOpening(false);
    }
  }

  // Muestra la respuesta de la IA "palabra a palabra" (efecto tecleo).
  function showStreamingReply(full: string) {
    if (typewriterRef.current) window.clearInterval(typewriterRef.current);
    setStreamingReply("");
    const words = full.split(" ");
    let idx = 0;
    typewriterRef.current = window.setInterval(() => {
      idx += 1;
      setStreamingReply(words.slice(0, idx).join(" "));
      if (idx >= words.length && typewriterRef.current) {
        window.clearInterval(typewriterRef.current);
        typewriterRef.current = null;
      }
    }, 45);
  }

  function commitReply(full: string, fallback: string) {
    if (typewriterRef.current) {
      window.clearInterval(typewriterRef.current);
      typewriterRef.current = null;
    }
    setStreamingReply(null);
    setChatMsgs((prev) => [...prev, { role: "ai", text: full || fallback }]);
  }

  async function doChat(text: string) {
    const req = text.trim();
    if (!req || !selected || chatLoading) return;
    setChatMsgs((prev) => [...prev, { role: "user", text: req }]);
    setChatInput("");
    setChatLoading(true);
    setError(null);

    let reply = "";
    try {
      const res = await fetch("/api/stores/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: selected.url, request: req }),
      });

      if (!res.ok || !res.body) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error?.message || "No pude aplicar el cambio");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let sseBuf = "";
      let errorMsg: string | null = null;
      let gotDone = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        sseBuf += decoder.decode(value, { stream: true });

        let sep: number;
        while ((sep = sseBuf.indexOf("\n\n")) >= 0) {
          const event = sseBuf.slice(0, sep).trim();
          sseBuf = sseBuf.slice(sep + 2);
          if (!event.startsWith("data:")) continue;
          const payload = event.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          let data: any;
          try {
            data = JSON.parse(payload);
          } catch {
            continue;
          }
          if (data.type === "ops" && Array.isArray(data.ops)) {
            for (const op of data.ops) {
              if (chatOpsRef.current) chatOpsRef.current([op]);
            }
          } else if (data.type === "reply" && typeof data.text === "string") {
            reply = data.text;
            showStreamingReply(data.text);
          } else if (data.type === "done") {
            gotDone = true;
          } else if (data.type === "error" && typeof data.message === "string") {
            errorMsg = data.message;
          }
        }
      }
      // Limpieza final del buffer SSE sobrante.
      if (sseBuf.trim().startsWith("data:")) {
        const payload = sseBuf.slice(5).trim();
        if (payload && payload !== "[DONE]") {
          try {
            const data = JSON.parse(payload);
            if (data.type === "reply" && typeof data.text === "string" && !reply) {
              reply = data.text;
              showStreamingReply(data.text);
            } else if (data.type === "error" && typeof data.message === "string") {
              errorMsg = data.message;
            }
          } catch {
            /* noop */
          }
        }
      }

      if (!gotDone && !errorMsg) {
        // Servidor cerró sin evento done: tratamos como éxito silencioso.
        gotDone = true;
      }

      if (errorMsg) {
        throw new Error(errorMsg);
      }

      // Espera a que termine el tecleo antes de fijar el mensaje final.
      await new Promise<void>((resolve) => {
        const wait = () => {
          if (!typewriterRef.current) {
            resolve();
          } else {
            setTimeout(wait, 60);
          }
        };
        wait();
      });
      commitReply(reply, "He aplicado tus cambios.");
    } catch (e) {
      if (typewriterRef.current) {
        window.clearInterval(typewriterRef.current);
        typewriterRef.current = null;
      }
      setStreamingReply(null);
      setError(e instanceof Error ? e.message : "Error al aplicar el cambio");
      setChatMsgs((prev) => [...prev, { role: "sys", text: "No pude aplicar tu petición. Inténtalo de nuevo." }]);
    } finally {
      setChatLoading(false);
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

      {/* PASO 2: mini web fiel de la tienda real */}
      {step === "editor" && snapshot ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep("result")}
              className="inline-flex items-center gap-1 text-sm text-dim hover:text-text"
            >
              <ArrowLeft className="h-4 w-4" /> Volver a tiendas
            </button>
            <span className="text-xs text-faint">Vista fiel de la web real</span>
          </div>

          {/* Botón grande de edición */}
          {!editing ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-6 py-4 text-base font-bold text-white shadow-lg shadow-accent/25 transition-transform active:scale-[0.98] hover:brightness-110"
            >
              <Pencil className="h-6 w-6" /> EDITAR
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-emerald-500/50 bg-emerald-500/10 px-6 py-4 text-base font-bold text-emerald-400 hover:brightness-110"
              >
                <Check className="h-6 w-6" /> LISTO
              </button>
            </div>
          )}

          <StoreFrame
            html={snapshot.html}
            title={snapshot.title}
            shopify={snapshot.shopify}
            domain={snapshot.domain}
            editMode={editing}
            opsRef={chatOpsRef}
          />

          {/* Chat: pide cambios y se aplican en vivo sobre la mini web */}
          <div className="rounded-2xl border border-border bg-surface p-4">
            <h3 className="flex items-center gap-2 text-base font-semibold text-text">
              <Sparkles className="h-4 w-4 text-accent2" /> Pide cambios por chat
            </h3>
            <div className="mt-3 flex max-h-56 flex-col gap-2 overflow-y-auto">
              {chatMsgs.length === 0 && (
                <p className="text-xs text-faint">
                  Ej: «cambia el titular por Hola Mundo», «pon el botón en rojo», «quita el banner de cookies»…
                </p>
              )}
              {chatMsgs.map((m, i) => (
                <div
                  key={i}
                  className={
                    "max-w-[85%] rounded-xl px-3 py-2 text-sm " +
                    (m.role === "user"
                      ? "self-end bg-accent/20 text-text"
                      : m.role === "ai"
                        ? "self-start bg-surface-2 text-dim"
                        : "self-start bg-rose-500/10 text-rose-300")
                  }
                >
                  {m.text}
                </div>
              ))}
              {streamingReply !== null && (
                <div className="self-start max-w-[85%] rounded-xl bg-surface-2 px-3 py-2 text-sm text-dim">
                  {streamingReply}
                  <span className="ml-0.5 inline-block animate-pulse">▌</span>
                </div>
              )}
              {chatLoading && streamingReply === null && (
                <div className="self-start flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm text-dim">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Aplicando cambios…
                </div>
              )}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") doChat(chatInput);
                }}
                placeholder="Describe qué quieres cambiar…"
                className="flex-1 rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-text focus:border-accent focus:outline-none"
              />
              <button
                type="button"
                onClick={() => doChat(chatInput)}
                disabled={!chatInput.trim() || chatLoading}
                className="inline-flex items-center justify-center rounded-xl bg-accent px-4 py-2.5 text-white disabled:opacity-40"
                aria-label="Enviar cambio"
              >
                {chatLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={doDownload}
              disabled={downloading || !replica}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-40"
            >
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {downloading ? "Generando ZIP..." : "DESCARGAR TEMA SHOPIFY (ZIP)"}
            </button>

            <button
              type="button"
              onClick={doUpload}
              disabled={uploading || !replica}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-3.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-40"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
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
