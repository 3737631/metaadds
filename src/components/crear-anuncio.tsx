"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft, Copy, Check, RefreshCw, Bot, Sparkles, Plus,
  Trash2, GripVertical, Pencil, Loader2, AlertCircle, Save,
} from "lucide-react";
import type { SceneData, GenerateRequest, CreativeData } from "@/lib/ai/schemas";

type AdFormat = "video" | "image";
type Step = "config" | "generating" | "result" | "error";

const PLATFORMS = [
  { id: "TikTok", label: "TikTok" },
  { id: "Instagram Reels", label: "Instagram Reels" },
  { id: "Facebook", label: "Facebook" },
  { id: "YouTube Shorts", label: "YouTube Shorts" },
  { id: "Pinterest", label: "Pinterest" },
  { id: "Snapchat", label: "Snapchat" },
];

const STYLES = [
  { id: "UGC", label: "UGC" },
  { id: "Testimonio", label: "Testimonio" },
  { id: "Problema/Solución", label: "Problema/Solución" },
  { id: "Unboxing", label: "Unboxing" },
  { id: "Demostración", label: "Demostración" },
  { id: "Lifestyle", label: "Lifestyle" },
  { id: "Antes/Después", label: "Antes/Después" },
  { id: "Storytelling", label: "Storytelling" },
  { id: "Premium", label: "Premium" },
  { id: "Producto viral", label: "Producto viral" },
];

const OBJECTIVES = [
  { id: "Ventas", label: "Ventas" },
  { id: "Clicks", label: "Clicks" },
  { id: "Leads", label: "Leads" },
  { id: "Reconocimiento", label: "Reconocimiento" },
  { id: "Retargeting", label: "Retargeting" },
];

const DURATIONS = [10, 15, 20, 30, 45, 60];

const LANGUAGES = [
  { id: "es", label: "Español" },
  { id: "en", label: "Inglés" },
  { id: "fr", label: "Francés" },
  { id: "it", label: "Italiano" },
  { id: "de", label: "Alemán" },
  { id: "pt", label: "Portugués" },
];

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = useCallback(async (text: string, key: string) => {
    try { await navigator.clipboard.writeText(text); } catch { /* noop */ }
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
  }, []);
  return { copied, copy };
}

export default function CrearAnuncio({
  productId,
  productName: initialName,
  category,
  cover,
  isDemo,
}: {
  productId: string;
  productName: string;
  category: string;
  cover: string | null;
  isDemo: boolean;
}) {
  const [step, setStep] = useState<Step>("config");
  const [error, setError] = useState("");

  const [platform, setPlatform] = useState("TikTok");
  const [format, setFormat] = useState<AdFormat>("video");
  const [style, setStyle] = useState("UGC");
  const [objective, setObjective] = useState("Ventas");
  const [duration, setDuration] = useState(15);
  const [country, setCountry] = useState("ES");
  const [language, setLanguage] = useState("es");

  const [productName, setProductName] = useState(initialName);
  const [productDesc, setProductDesc] = useState("");
  const [manualMode, setManualMode] = useState(!initialName);

  const [creative, setCreative] = useState<CreativeData | null>(null);
  const [editingScene, setEditingScene] = useState<number | null>(null);
  const [editFields, setEditFields] = useState<Partial<SceneData>>({});
  const [regenInstruction, setRegenInstruction] = useState("");
  const [regenLoading, setRegenLoading] = useState(false);
  const [naturalEdit, setNaturalEdit] = useState("");
  const [naturalLoading, setNaturalLoading] = useState(false);

  const [audience, setAudience] = useState({
    age: "",
    gender: "",
    interests: "",
    problem: "",
    desire: "",
  });

  const { copied, copy } = useCopy();

  async function generate() {
    setStep("generating");
    setError("");

    const req: GenerateRequest = {
      productName,
      productDescription: productDesc,
      productUrl: "",
      productImage: cover ?? "",
      platform,
      format,
      style,
      objective,
      duration,
      country,
      language,
      audience,
    };

    try {
      const res = await fetch("/api/creatives/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error?.message ?? "Error al generar");
        setStep("error");
        return;
      }
      setCreative(data.data.creative);
      setStep("result");
    } catch {
      setError("No se pudo conectar con el servidor. Inténtalo de nuevo.");
      setStep("error");
    }
  }

  async function regenerateScene(sceneOrder: number, instruction: string) {
    if (!creative || !instruction.trim()) return;
    setRegenLoading(true);
    try {
      const res = await fetch("/api/creatives/regenerate-scene", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenes: creative.scenes,
          sceneOrder,
          instruction: instruction.trim(),
          productName,
          platform,
          style,
          duration,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCreative({ ...creative, scenes: data.data.scenes });
      }
    } catch { /* error silently */ }
    setRegenLoading(false);
  }

  function startEditScene(scene: SceneData) {
    setEditingScene(scene.order);
    setEditFields({ ...scene });
  }

  function saveEditScene() {
    if (!creative || editingScene === null) return;
    setCreative({
      ...creative,
      scenes: creative.scenes.map((s) =>
        s.order === editingScene ? { ...s, ...editFields } : s
      ),
    });
    setEditingScene(null);
    setEditFields({});
  }

  function deleteScene(order: number) {
    if (!creative) return;
    const remaining = creative.scenes.filter((s) => s.order !== order);
    const renumbered = remaining.map((s, i) => ({ ...s, order: i + 1 }));
    setCreative({ ...creative, scenes: renumbered });
  }

  function duplicateScene(scene: SceneData) {
    if (!creative) return;
    const idx = creative.scenes.findIndex((s) => s.order === scene.order);
    const dup = { ...scene, order: scene.order + 1 };
    const before = creative.scenes.slice(0, idx + 1);
    const after = creative.scenes.slice(idx + 1);
    const renumbered = [...before, ...after].map((s, i) => ({ ...s, order: i + 1 }));
    setCreative({ ...creative, scenes: renumbered });
  }

  function moveScene(from: number, to: number) {
    if (!creative) return;
    const scenes = [...creative.scenes];
    const [moved] = scenes.splice(from, 1);
    scenes.splice(to, 0, moved);
    setCreative({ ...creative, scenes: scenes.map((s, i) => ({ ...s, order: i + 1 })) });
  }

  const formatDuration = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div className="flex flex-col gap-6 pb-12">
      <Link
        href={productId ? `/productos/${productId}` : "/ganadores?categoria=todos"}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-dim hover:text-text"
      >
        <ArrowLeft className="h-4 w-4" /> Volver
      </Link>

      <div className="flex items-center gap-3">
        {cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
        )}
        <div>
          <h1 className="text-xl font-bold leading-snug text-text">
            {productName || "Nuevo anuncio"}
          </h1>
          <p className="mt-0.5 text-sm text-dim">Crear anuncio con IA</p>
        </div>
        {isDemo && (
          <span className="rounded-full bg-amber-500/20 px-3 py-1 text-xs font-bold text-amber-300">
            Demo
          </span>
        )}
      </div>

      {/* Error banner */}
      {(step === "error" || error) && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 text-rose-400" />
          <div>
            <p className="text-sm font-medium text-rose-300">{error}</p>
            <button
              type="button"
              onClick={() => { setStep("config"); setError(""); }}
              className="mt-2 text-xs text-rose-400 underline"
            >
              Volver a configurar
            </button>
          </div>
        </div>
      )}

      {/* STEP 1+2: Configuración */}
      {step === "config" && (
        <div className="flex flex-col gap-5">
          {/* Producto */}
          <section className="rounded-2xl border border-border bg-surface p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-faint">Producto</h2>
            {manualMode ? (
              <div className="mt-3 space-y-3">
                <input
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="Nombre del producto *"
                  className="w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-text focus:border-accent focus:outline-none"
                />
                <textarea
                  value={productDesc}
                  onChange={(e) => setProductDesc(e.target.value)}
                  placeholder="Descripción del producto (opcional)"
                  rows={2}
                  className="w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-text focus:border-accent focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setManualMode(false)}
                  className="text-xs text-accent2 underline"
                >
                  Usar producto existente
                </button>
              </div>
            ) : (
              <div className="mt-3">
                <div className="flex items-center gap-3 rounded-xl bg-surface-2 p-3">
                  {cover && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cover} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                  )}
                  <span className="text-sm font-medium text-text">{productName}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setManualMode(true)}
                  className="mt-2 text-xs text-accent2 underline"
                >
                  Crear producto manualmente
                </button>
              </div>
            )}
          </section>

          {/* Plataforma */}
          <section className="rounded-2xl border border-border bg-surface p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-faint">Plataforma</h2>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPlatform(p.id)}
                  className={`rounded-xl border p-2.5 text-center text-xs font-medium transition-colors ${
                    platform === p.id
                      ? "border-accent bg-accent/10 text-accent2"
                      : "border-border bg-surface-2 text-dim hover:text-text"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </section>

          {/* Formato + Estilo */}
          <div className="grid grid-cols-2 gap-3">
            <section className="rounded-2xl border border-border bg-surface p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-faint">Formato</h2>
              <div className="mt-3 space-y-2">
                {(["video", "image"] as AdFormat[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFormat(f)}
                    className={`w-full rounded-xl border p-2.5 text-sm font-medium transition-colors ${
                      format === f
                        ? "border-accent bg-accent/10 text-accent2"
                        : "border-border bg-surface-2 text-dim hover:text-text"
                    }`}
                  >
                    {f === "video" ? "🎬 Vídeo" : "🖼️ Imagen"}
                  </button>
                ))}
              </div>
            </section>
            <section className="rounded-2xl border border-border bg-surface p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-faint">Duración</h2>
              <div className="mt-3 grid grid-cols-3 gap-1.5">
                {DURATIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDuration(d)}
                    className={`rounded-lg border p-2 text-center text-xs font-medium transition-colors ${
                      duration === d
                        ? "border-accent bg-accent/10 text-accent2"
                        : "border-border bg-surface-2 text-dim"
                    }`}
                  >
                    {d}s
                  </button>
                ))}
              </div>
            </section>
          </div>

          {/* Estilo */}
          <section className="rounded-2xl border border-border bg-surface p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-faint">Estilo</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {STYLES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStyle(s.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    style === s.id
                      ? "border-accent bg-accent/10 text-accent2"
                      : "border-border bg-surface-2 text-dim hover:text-text"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </section>

          {/* Objetivo */}
          <section className="rounded-2xl border border-border bg-surface p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-faint">Objetivo</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {OBJECTIVES.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setObjective(o.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    objective === o.id
                      ? "border-accent bg-accent/10 text-accent2"
                      : "border-border bg-surface-2 text-dim hover:text-text"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </section>

          {/* País + Idioma */}
          <div className="grid grid-cols-2 gap-3">
            <section className="rounded-2xl border border-border bg-surface p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-faint">País</h2>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="mt-3 w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-text focus:border-accent focus:outline-none"
              >
                <option value="ES">🇪🇸 España</option>
                <option value="MX">🇲🇽 México</option>
                <option value="CO">🇨🇴 Colombia</option>
                <option value="AR">🇦🇷 Argentina</option>
                <option value="US">🇺🇸 Estados Unidos</option>
                <option value="UK">🇬🇧 Reino Unido</option>
                <option value="FR">🇫🇷 Francia</option>
                <option value="DE">🇩🇪 Alemania</option>
              </select>
            </section>
            <section className="rounded-2xl border border-border bg-surface p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-faint">Idioma</h2>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {LANGUAGES.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setLanguage(l.id)}
                    className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                      language === l.id
                        ? "border-accent bg-accent/10 text-accent2"
                        : "border-border bg-surface-2 text-dim"
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </section>
          </div>

          {/* Público */}
          <section className="rounded-2xl border border-border bg-surface p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-faint">Público objetivo</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <input value={audience.age} onChange={(e) => setAudience({ ...audience, age: e.target.value })} placeholder="Edad (ej: 25-45)" className="rounded-xl border border-border bg-bg px-3 py-2 text-xs text-text focus:border-accent focus:outline-none" />
              <input value={audience.gender} onChange={(e) => setAudience({ ...audience, gender: e.target.value })} placeholder="Género" className="rounded-xl border border-border bg-bg px-3 py-2 text-xs text-text focus:border-accent focus:outline-none" />
              <input value={audience.interests} onChange={(e) => setAudience({ ...audience, interests: e.target.value })} placeholder="Intereses" className="col-span-2 rounded-xl border border-border bg-bg px-3 py-2 text-xs text-text focus:border-accent focus:outline-none" />
              <input value={audience.problem} onChange={(e) => setAudience({ ...audience, problem: e.target.value })} placeholder="Problema que tiene" className="rounded-xl border border-border bg-bg px-3 py-2 text-xs text-text focus:border-accent focus:outline-none" />
              <input value={audience.desire} onChange={(e) => setAudience({ ...audience, desire: e.target.value })} placeholder="Deseo" className="rounded-xl border border-border bg-bg px-3 py-2 text-xs text-text focus:border-accent focus:outline-none" />
            </div>
          </section>

          <button
            type="button"
            onClick={generate}
            disabled={!productName.trim()}
            className="flex items-center justify-center gap-2 rounded-2xl bg-accent px-6 py-4 text-base font-semibold text-white shadow-lg shadow-accent/25 transition-all active:scale-[0.98] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Sparkles className="h-5 w-5" /> GENERAR ANUNCIO
          </button>
        </div>
      )}

      {/* STEP: Generando */}
      {step === "generating" && (
        <div className="flex flex-col items-center justify-center gap-4 py-20">
          <Loader2 className="h-10 w-10 animate-spin text-accent2" />
          <p className="text-sm text-dim">Generando tu anuncio con IA...</p>
          <p className="text-xs text-faint">Esto puede tardar 10-30 segundos</p>
        </div>
      )}

      {/* STEP: Resultado — Editor de creatividades */}
      {step === "result" && creative && (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text">Tu anuncio</h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  const all = JSON.stringify(creative, null, 2);
                  copy(all, "all");
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-surface-2 px-3 py-2 text-xs font-semibold text-text"
              >
                {copied === "all" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                Copiar todo
              </button>
              <button
                type="button"
                onClick={() => { setStep("config"); setCreative(null); }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-surface-2 px-3 py-2 text-xs font-semibold text-text"
              >
                Nuevo anuncio
              </button>
            </div>
          </div>

          {/* Info general */}
          <div className="rounded-2xl border border-border bg-surface p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent2" />
              <span className="text-sm font-semibold text-text">{creative.title}</span>
            </div>
            <p className="text-xs text-dim"><span className="font-semibold text-text">Hook:</span> {creative.hook}</p>
            <p className="text-xs text-dim"><span className="font-semibold text-text">Ángulo:</span> {creative.angle}</p>
            <p className="text-xs text-dim"><span className="font-semibold text-text">CTA:</span> {creative.cta}</p>
            <div className="flex gap-2 pt-2">
              <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[10px] font-medium text-dim">{platform}</span>
              <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[10px] font-medium text-dim">{style}</span>
              <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[10px] font-medium text-dim">{duration}s</span>
            </div>
          </div>

          {/* Copy */}
          <section className="rounded-2xl border border-border bg-surface p-4">
            <h3 className="text-sm font-semibold text-text">✍️ Copy del anuncio</h3>
            <div className="mt-2 space-y-2 text-sm text-dim">
              <p className="break-all">{creative.adCopy}</p>
              <p className="font-medium text-text">Título: {creative.headline}</p>
              {creative.description && <p className="text-xs">{creative.description}</p>}
            </div>
            <button
              type="button"
              onClick={() => copy(`${creative.hook}\n\n${creative.adCopy}\n\n${creative.headline}\n${creative.cta}`, "copy")}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-accent/15 px-3 py-1.5 text-xs font-semibold text-accent2 ring-1 ring-accent/30"
            >
              {copied === "copy" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              COPIAR COPY
            </button>
          </section>

          {/* Escenas */}
          <section>
            <h3 className="text-sm font-semibold text-text">🎬 Escenas ({creative.scenes.length})</h3>
            <div className="mt-3 space-y-3">
              {creative.scenes.map((scene, idx) => {
                const isEditing = editingScene === scene.order;
                return (
                  <div
                    key={scene.order}
                    className="rounded-2xl border border-border bg-surface p-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-accent/20 px-2 py-0.5 text-xs font-bold text-accent2">
                          {formatDuration(scene.start)}–{formatDuration(scene.end)}
                        </span>
                        <span className="text-sm font-semibold text-text">Escena {scene.order}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {idx > 0 && (
                          <button type="button" onClick={() => moveScene(idx, idx - 1)} className="rounded p-1 text-faint hover:text-text" aria-label="Mover arriba">
                            <GripVertical className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button type="button" onClick={() => startEditScene(scene)} className="rounded p-1 text-faint hover:text-accent2" aria-label="Editar">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => duplicateScene(scene)} className="rounded p-1 text-faint hover:text-accent2" aria-label="Duplicar">
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                        {creative.scenes.length > 1 && (
                          <button type="button" onClick={() => deleteScene(scene.order)} className="rounded p-1 text-faint hover:text-rose-400" aria-label="Eliminar">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {isEditing ? (
                      <div className="mt-3 space-y-2">
                        {(["visual", "action", "camera", "lighting", "audio", "dialogue", "onScreenText", "transition", "prompt"] as const).map((field) => (
                          <div key={field}>
                            <label className="text-[10px] font-semibold uppercase tracking-wide text-faint">{field}</label>
                            <textarea
                              value={String(editFields[field] ?? "")}
                              onChange={(e) => setEditFields({ ...editFields, [field]: e.target.value })}
                              rows={field === "prompt" ? 3 : 2}
                              className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-xs text-text focus:border-accent focus:outline-none"
                            />
                          </div>
                        ))}
                        <div className="flex gap-2">
                          <button type="button" onClick={saveEditScene} className="rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white">Guardar</button>
                          <button type="button" onClick={() => { setEditingScene(null); setEditFields({}); }} className="rounded-xl bg-surface-2 px-4 py-2 text-xs font-semibold text-text">Cancelar</button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 space-y-1 text-xs text-dim">
                        <p><span className="font-semibold text-text">Visual:</span> {scene.visual}</p>
                        <p><span className="font-semibold text-text">Acción:</span> {scene.action}</p>
                        <p><span className="font-semibold text-text">Cámara:</span> {scene.camera}</p>
                        {scene.dialogue && <p><span className="font-semibold text-text">Diálogo:</span> {scene.dialogue}</p>}
                        {scene.onScreenText && <p><span className="font-semibold text-text">Texto:</span> {scene.onScreenText}</p>}
                        {scene.prompt && (
                          <details className="mt-1">
                            <summary className="cursor-pointer text-faint hover:text-text">Ver prompt</summary>
                            <pre className="mt-1 whitespace-pre-wrap rounded-xl bg-bg p-2 text-[11px] text-dim">{scene.prompt}</pre>
                          </details>
                        )}
                      </div>
                    )}

                    {/* Regenerar esta escena */}
                    <div className="mt-3 flex items-center gap-2">
                      <input
                        value={editingScene === scene.order ? "" : ""}
                        placeholder="Cambiar esta escena..."
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && (e.target as HTMLInputElement).value.trim()) {
                            regenerateScene(scene.order, (e.target as HTMLInputElement).value);
                            (e.target as HTMLInputElement).value = "";
                          }
                        }}
                        className="flex-1 rounded-xl border border-border bg-bg px-3 py-2 text-xs text-text focus:border-accent focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          const input = (e.currentTarget.previousElementSibling as HTMLInputElement);
                          if (input.value.trim()) {
                            regenerateScene(scene.order, input.value.trim());
                            input.value = "";
                          }
                        }}
                        disabled={regenLoading}
                        className="rounded-xl bg-surface-2 p-2 text-faint hover:text-accent2 disabled:opacity-40"
                        aria-label="Regenerar escena"
                      >
                        {regenLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Edición natural */}
          <section className="rounded-2xl border border-border bg-surface p-4">
            <h3 className="text-sm font-semibold text-text">💬 ¿Qué quieres cambiar?</h3>
            <p className="mt-1 text-xs text-dim">Describe el cambio en lenguaje natural y la IA lo aplicará.</p>
            <div className="mt-3 flex items-center gap-2">
              <input
                value={naturalEdit}
                onChange={(e) => setNaturalEdit(e.target.value)}
                placeholder='Ej: "Ponlo más premium", "Cambia a una playa", "Hook más viral"'
                onKeyDown={(e) => {
                  if (e.key === "Enter" && naturalEdit.trim()) {
                    setNaturalLoading(true);
                    regenerateScene(creative.scenes[0]?.order ?? 1, naturalEdit.trim());
                    setNaturalEdit("");
                    setNaturalLoading(false);
                  }
                }}
                className="flex-1 rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-text focus:border-accent focus:outline-none"
              />
              <button
                type="button"
                disabled={naturalLoading || !naturalEdit.trim()}
                onClick={() => {
                  if (!naturalEdit.trim()) return;
                  setNaturalLoading(true);
                  regenerateScene(1, naturalEdit.trim());
                  setNaturalEdit("");
                  setNaturalLoading(false);
                }}
                className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
              >
                {naturalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aplicar"}
              </button>
            </div>
          </section>

          {/* Prompts de imagen si formato=image */}
          {format === "image" && (
            <section className="rounded-2xl border border-border bg-surface p-4">
              <h3 className="text-sm font-semibold text-text">🖼 Prompts de imagen</h3>
              <div className="mt-3 space-y-2">
                {creative.scenes.map((scene) => (
                  <div key={scene.order} className="rounded-xl bg-bg p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-accent2">Escena {scene.order}</span>
                      <button
                        type="button"
                        onClick={() => copy(scene.prompt || scene.visual, "img-" + scene.order)}
                        className="inline-flex items-center gap-1 rounded-lg bg-accent/15 px-2 py-1 text-[10px] font-semibold text-accent2"
                      >
                        {copied === "img-" + scene.order ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        COPIAR
                      </button>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-[11px] text-dim">{scene.prompt || scene.visual}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
