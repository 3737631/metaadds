"use client";

import { useState } from "react";
import { loadShopifyCreds } from "./shopify-connect";
import {
  Search,
  Store,
  Sparkles,
  Loader2,
  ArrowLeft,
  ArrowRight,
  Download,
  RefreshCw,
  Send,
  Check,
  Monitor,
  Tablet,
  Smartphone,
  PenLine,
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

interface StoreAnalysis {
  url: string;
  domain: string;
  shopify: boolean;
  title: string | null;
  description: string | null;
  brand: { logoUrl: string | null; colors: string[]; fontFamily: string | null; style: string | null };
  home: { hero: string | null; benefits: string | null; socialProof: string | null; productCount: number | null; hasFaq: boolean; hasCta: boolean; sections: { type: string; heading: string | null; notes: string }[] };
  product: { title: string | null; price: number | null; currency: string | null; offer: string | null; variantsCount: number | null; description: string | null; hasReviews: boolean; guarantee: string | null; cta: string | null };
  conversion: { offerClarity: number | null; socialProofScore: number | null; trustScore: number | null; ctaClarity: number | null; structureScore: number | null; urgency: number | null; valueProp: string | null; strengths: string[]; weaknesses: string[] };
  rawExcerpt: string | null;
}

interface StoreTheme {
  name: string;
  brandName: string;
  tagline: string;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  fontFamily: string;
  header: { logoText: string; menu: string[] };
  hero: { headline: string; subheadline: string; ctaLabel: string; ctaHref: string; showImage: boolean };
  homeSections: { type: string; heading: string; text: string; ctaLabel?: string; ctaHref?: string; imageUrl?: string; items?: { title: string; text: string }[] }[];
  product: { title: string; price: number; compareAtPrice: number | null; description: string; benefits: string[]; ctaLabel: string; badge: string | null; currency: string };
  footer: { about: string; links: { text: string; href: string }[]; newsletter: boolean };
}

type Step = "topic" | "search" | "result" | "editor";

type PreviewDevice = "desktop" | "tablet" | "mobile";

export default function CrearTienda({ categories }: { categories: Category[] }) {
  const [step, setStep] = useState<Step>("topic");
  const [topic, setTopic] = useState<Category | null>(null);
  const [searching, setSearching] = useState(false);
  const [candidates, setCandidates] = useState<StoreCandidate[]>([]);
  const [searchNote, setSearchNote] = useState("");
  const [selected, setSelected] = useState<StoreCandidate | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<StoreAnalysis | null>(null);
  const [similarity, setSimilarity] = useState<{ score: number; reason: string } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [theme, setTheme] = useState<StoreTheme | null>(null);
  const [editing, setEditing] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chat, setChat] = useState<{ role: "user" | "ai" | "sys"; text: string }[]>([]);
  const [preview, setPreview] = useState<PreviewDevice>("desktop");
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [brandName, setBrandName] = useState("");
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

  async function doAnalyze(c: StoreCandidate) {
    setSelected(c);
    setAnalyzing(true);
    setError(null);
    try {
      const res = await fetch("/api/stores/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: c.url }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "No se pudo analizar la tienda");
      setAnalysis(json.data.analysis);
      setSimilarity(json.data.similarity);
      setChat([{ role: "ai", text: `He analizado ${json.data.analysis.domain}. Es una tienda ${json.data.analysis.shopify ? "de Shopify" : "de otro gestor"}. Puedo crear tu tienda imitando su estructura y estilo pero con tu propia marca.` }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al analizar");
    } finally {
      setAnalyzing(false);
    }
  }

  async function doGenerate() {
    if (!analysis) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/stores/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: analysis.url,
          analysis,
          brandName: brandName.trim() || undefined,
          userPreferences: "Mejora pequeños detalles, añade marca personal propia, cambia el logo y los nombres.",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "No se pudo generar la tienda");
      setTheme(json.data.theme);
      setChat((prev) => [...prev, { role: "ai", text: `¡Listo! He creado tu tienda "${json.data.theme.brandName}". Puedes editarla abajo o pedirme cambios por chat.` }]);
      setStep("editor");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al generar");
    } finally {
      setGenerating(false);
    }
  }

  async function doChat(text: string) {
    if (!text.trim() || !theme) return;
    setChat((prev) => [...prev, { role: "user", text }]);
    setChatInput("");
    setChatLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stores/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: analysis?.url ?? "", theme, instruction: text }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "No se pudo aplicar el cambio");
      setTheme(json.data.theme);
      setChat((prev) => [...prev, { role: "ai", text: "Listo, he aplicado tu cambio." }]);
    } catch (e) {
      setChat((prev) => [...prev, { role: "sys", text: "No pude aplicar el cambio, inténtalo de nuevo." }]);
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setChatLoading(false);
    }
  }

  async function doDownload() {
    if (!theme) return;
    setDownloading(true);
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
    if (!theme) return;
    setUploading(true);
    setUploaded(null);
    setError(null);
    const creds = loadShopifyCreds();
    if (!creds) {
      setError("Primero conecta tu tienda en Ajustes (dominio y token de admin).");
      setUploading(false);
      return;
    }
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
                setAnalysis(null);
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

      {step === "topic" || step === "search" ? (
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
                      onClick={() => doAnalyze(c)}
                      disabled={analyzing && selected?.id === c.id}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-accent/15 px-3 py-2 text-xs font-semibold text-accent2 ring-1 ring-accent/30"
                    >
                      {analyzing && selected?.id === c.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ArrowRight className="h-3.5 w-3.5" />
                      )}
                      {analyzing && selected?.id === c.id ? "Analizando..." : "Analizar"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Resultado del análisis */}
          {analysis && selected && (
            <div className="mt-4 rounded-2xl border border-accent/40 bg-accent/5 p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-text">Análisis de {analysis.domain}</h3>
                {similarity && (
                  <span className="rounded-full bg-surface-2 px-3 py-1 text-xs font-bold text-text">
                    Similitud: {similarity.score}%
                  </span>
                )}
              </div>
              <div className="mt-3 space-y-1.5 text-sm text-dim">
                <p><span className="text-faint">Título:</span> {analysis.title ?? "—"}</p>
                <p><span className="text-faint">Estilo:</span> {analysis.brand.style ?? "—"}</p>
                <p><span className="text-faint">Colores:</span> {analysis.brand.colors?.join(", ") || "—"}</p>
                {analysis.conversion.valueProp && (
                  <p><span className="text-faint">Propuesta de valor:</span> {analysis.conversion.valueProp}</p>
                )}
              </div>
              <div className="mt-2 flex flex-col gap-2 items-start">
                <p className="text-xs text-faint">{similarity?.reason}</p>
              </div>

              <div className="mt-4">
                <label className="text-xs font-medium text-dim">Nombre de tu marca (opcional)</label>
                <input
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="Nombre de tu marca"
                  className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-text focus:border-accent focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={doGenerate}
                disabled={generating}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-accent/25 hover:brightness-110 disabled:opacity-40"
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {generating ? "Creando tu tienda..." : "CREAR MI TIENDA"}
              </button>
            </div>
          )}
        </>
      ) : null}

      {/* PASO 2: editor + preview + chat */}
      {step === "editor" && theme ? (
        <>
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep("result")}
              className="inline-flex items-center gap-1 text-sm text-dim hover:text-text"
            >
              <ArrowLeft className="h-4 w-4" /> Volver a tiendas
            </button>
            <div className="flex items-center gap-1 rounded-xl bg-surface-2 p-1">
              {(["desktop", "tablet", "mobile"] as PreviewDevice[]).map((d) => {
                const Icon = d === "desktop" ? Monitor : d === "tablet" ? Tablet : Smartphone;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setPreview(d)}
                    aria-label={d}
                    className={"rounded-lg p-1.5 " + (preview === d ? "bg-surface text-accent2" : "text-faint")}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Editor */}
            <div className="flex flex-col gap-4">
              <EditorField label="Marca" value={theme.brandName} onString={(v) => setTheme({ ...theme, brandName: v })} />
              <EditorField label="Eslogan" value={theme.tagline} onString={(v) => setTheme({ ...theme, tagline: v })} />
              <EditorField label="Color primario" type="color" value={theme.primaryColor} onString={(v) => setTheme({ ...theme, primaryColor: v })} />
              <EditorField label="Color de fondo" type="color" value={theme.backgroundColor} onString={(v) => setTheme({ ...theme, backgroundColor: v })} />
              <EditorField label="Color de texto" type="color" value={theme.textColor} onString={(v) => setTheme({ ...theme, textColor: v })} />
              <EditorField
                label="Hero (título)"
                value={theme.hero.headline}
                onString={(v) => setTheme({ ...theme, hero: { ...theme.hero, headline: v } })}
              />
              <EditorField
                label="Hero (subtítulo)"
                value={theme.hero.subheadline}
                onString={(v) => setTheme({ ...theme, hero: { ...theme.hero, subheadline: v } })}
              />
              <EditorField
                label="CTA"
                value={theme.hero.ctaLabel}
                onString={(v) => setTheme({ ...theme, hero: { ...theme.hero, ctaLabel: v } })}
              />
              {theme.homeSections.map((sec, i) => (
                <div key={i} className="rounded-xl border border-border bg-surface p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-faint">Sección {i + 1} · {sec.type}</div>
                  <EditorField label="Título" value={sec.heading} onString={(v) => setTheme({ ...theme, homeSections: theme.homeSections.map((s, j) => (j === i ? { ...s, heading: v } : s)) })} />
                  <EditorField label="Texto" value={sec.text} onString={(v) => setTheme({ ...theme, homeSections: theme.homeSections.map((s, j) => (j === i ? { ...s, text: v } : s)) })} />
                </div>
              ))}

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

            {/* Preview */}
            <div>
              <div
                className="mx-auto overflow-hidden rounded-2xl border border-border shadow-2xl"
                style={{
                  width: preview === "mobile" ? 220 : preview === "tablet" ? 380 : "100%",
                  maxWidth: "100%",
                  background: theme.backgroundColor,
                  color: theme.textColor,
                  fontFamily: theme.fontFamily || "sans-serif",
                }}
              >
                <StorePreview theme={theme} />
              </div>
            </div>
          </div>

          {/* Chat IA */}
          <div className="rounded-2xl border border-border bg-surface p-4">
            <h3 className="flex items-center gap-2 text-base font-semibold text-text">
              <PenLine className="h-4 w-4 text-accent2" /> Edita con IA
            </h3>
            <div className="mt-3 flex max-h-48 flex-col gap-2 overflow-y-auto">
              {chat.map((m, i) => (
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
              {chatLoading && (
                <div className="self-start flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm text-dim">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Editando...
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
                placeholder="Ej: pon el hook más agresivo, usa tono de lujo, cambia el CTA..."
                className="flex-1 rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-text focus:border-accent focus:outline-none"
              />
              <button
                type="button"
                onClick={() => doChat(chatInput)}
                disabled={!chatInput.trim() || chatLoading}
                className="inline-flex items-center justify-center rounded-xl bg-accent px-4 py-2.5 text-white disabled:opacity-40"
                aria-label="Enviar"
              >
                {chatLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
            {analysis && (
              <button
                type="button"
                onClick={() => setTheme({ ...theme, primaryColor: analysis.brand.colors[0] || theme.primaryColor })}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-surface-2 px-3 py-1.5 text-xs text-dim hover:text-text"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Usar color principal de la competencia
              </button>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

function EditorField({
  label,
  value,
  type = "text",
  onString,
}: {
  label: string;
  value?: string;
  type?: "text" | "color";
  onString: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-dim">{label}</span>
      <input
        type={type}
        value={value ?? ""}
        onChange={(e) => onString(e.target.value)}
        className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm text-text focus:border-accent focus:outline-none"
      />
    </label>
  );
}

function StorePreview({ theme }: { theme: StoreTheme }) {
  return (
    <div className="min-h-full">
      {/* Header */}
      <header
        style={{ background: theme.primaryColor, color: "#fff" }}
        className="flex items-center justify-between px-4 py-3"
      >
        <span className="text-base font-bold">{theme.header.logoText || theme.brandName}</span>
        <nav className="hidden gap-3 text-xs sm:flex">
          {theme.header.menu.map((m, i) => (
            <span key={i}>{m}</span>
          ))}
        </nav>
      </header>

      {/* Hero */}
      <section className="px-4 py-8 text-center">
        <h1 className="text-xl font-bold leading-tight" style={{ color: theme.textColor }}>
          {theme.hero.headline}
        </h1>
        {theme.hero.subheadline && (
          <p className="mt-2 text-sm" style={{ color: theme.textColor, opacity: 0.8 }}>
            {theme.hero.subheadline}
          </p>
        )}
        <a
          href={theme.hero.ctaHref || "#"}
          className="mt-4 inline-block rounded-full px-5 py-2.5 text-sm font-semibold text-white"
          style={{ background: theme.accentColor || theme.primaryColor }}
        >
          {theme.hero.ctaLabel}
        </a>
      </section>

      {/* Sections */}
      {theme.homeSections.map((s, i) => (
        <section key={i} className="border-t px-4 py-6" style={{ borderColor: theme.primaryColor + "33" }}>
          <h2 className="text-base font-bold" style={{ color: theme.textColor }}>
            {s.heading}
          </h2>
          {s.text && <p className="mt-1.5 text-xs" style={{ color: theme.textColor, opacity: 0.8 }}>{s.text}</p>}
          {s.items && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {s.items.map((it, j) => (
                <div key={j} className="rounded-lg p-2" style={{ background: theme.primaryColor + "1a" }}>
                  <div className="text-xs font-semibold">{it.title}</div>
                  <div className="text-[11px]" style={{ opacity: 0.8 }}>{it.text}</div>
                </div>
              ))}
            </div>
          )}
        </section>
      ))}

      {/* Product */}
      <section className="border-t px-4 py-6" style={{ borderColor: theme.primaryColor + "33" }}>
        <h2 className="text-base font-bold">{theme.product.title}</h2>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-lg font-bold" style={{ color: theme.accentColor || theme.primaryColor }}>
            {theme.product.currency || "€"}
            {theme.product.price}
          </span>
          {theme.product.compareAtPrice != null && (
            <span className="text-xs" style={{ opacity: 0.5, textDecoration: "line-through" }}>
              {theme.product.currency || "€"}
              {theme.product.compareAtPrice}
            </span>
          )}
        </div>
        {theme.product.description && (
          <p className="mt-2 text-xs" style={{ opacity: 0.8 }}>{theme.product.description}</p>
        )}
        <button
          className="mt-3 w-full rounded-full py-2.5 text-sm font-semibold text-white"
          style={{ background: theme.accentColor || theme.primaryColor }}
        >
          {theme.product.ctaLabel}
        </button>
      </section>

      {/* Footer */}
      <footer className="px-4 py-5 text-xs" style={{ background: theme.primaryColor, color: "#fff" }}>
        <p>{theme.footer.about}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {theme.footer.links.map((l, i) => (
            <span key={i}>{l.text}</span>
          ))}
        </div>
        {theme.footer.newsletter && <p className="mt-2 opacity-80">Suscríbete a nuestras novedades</p>}
      </footer>
    </div>
  );
}
