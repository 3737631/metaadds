"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Copy, Check, RefreshCw, Bot, Sparkles, Wand2, PenLine } from "lucide-react";
import {
  buildVideoPrompt,
  type VideoPrompt,
} from "@/lib/ai/videoPrompts";
import {
  visualDefs,
  buildImagePrompt,
  type VisualDef,
} from "@/lib/ai/visualPrompts";
import {
  REGENERATE_OPTIONS,
  regeneratePrompt,
} from "@/lib/ai/regenerate";
import { buildCopy, type CopyVariant } from "@/lib/ai/copy";
import {
  VIDEO_MODELS,
  IMAGE_MODELS,
  modelById,
  type AIModel,
} from "@/lib/ai/models";

type AdTypeId = "ugc" | "demostracion" | "producto" | "imagen" | "carrusel";

const TIPOS: { id: AdTypeId; label: string; emoji: string; kind: "video" | "image"; desc: string }[] = [
  { id: "ugc", label: "Vídeo UGC", emoji: "🎬", kind: "video", desc: "Grabado estilo usuario real" },
  { id: "demostracion", label: "Vídeo demostración", emoji: "🛠️", kind: "video", desc: "Muestra el producto en acción" },
  { id: "producto", label: "Vídeo producto", emoji: "📦", kind: "video", desc: "Enfoque limpio en el producto" },
  { id: "imagen", label: "Imagen publicitaria", emoji: "🖼️", kind: "image", desc: "Imagen estática para anuncio" },
  { id: "carrusel", label: "Carrusel", emoji: "🎠", kind: "image", desc: "Varias imágenes deslizables" },
];

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard no disponible */
    }
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
  }
  return { copied, copy };
}

export default function CrearAnuncio({
  productId,
  productName,
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
  const [tipo, setTipo] = useState<AdTypeId | null>(null);
  const [modelId, setModelId] = useState<string | null>(null);
  const [generated, setGenerated] = useState(false);
  const [video, setVideo] = useState<VideoPrompt | null>(null);
  const [visuals, setVisuals] = useState<VisualDef[]>([]);
  const [imagePrompts, setImagePrompts] = useState<Record<string, string>>({});
  const [copies, setCopies] = useState<CopyVariant[]>([]);
  const [customChange, setCustomChange] = useState("");
  const [showRegen, setShowRegen] = useState(false);
  const { copied, copy } = useCopy();

  const selectedTipo = tipo ? TIPOS.find((t) => t.id === tipo)! : null;
  const kind = selectedTipo ? selectedTipo.kind : "video";
  const models = kind === "video" ? VIDEO_MODELS : IMAGE_MODELS;
  const selectedModel = modelId ? modelById(modelId) ?? models[0] : models[0];

  function pickModel(m: AIModel) {
    setModelId(m.id);
    setGenerated(false);
  }

  function generate() {
    if (!tipo || !selectedModel) return;
    const cat = category;
    if (kind === "video") {
      const vp = buildVideoPrompt({ product: productName, category: cat, model: selectedModel.id, durationSec: 15, ratio: "9:16" });
      setVideo(vp);
      setVisuals(visualDefs(productName, cat));
    } else {
      setVideo(null);
      setVisuals(visualDefs(productName, cat));
    }
    setCopies(buildCopy({ product: productName, category: cat, numVariants: 3 }));
    setImagePrompts({});
    setCustomChange("");
    setShowRegen(false);
    setGenerated(true);
  }

  function ensureImagePrompt(visual: VisualDef) {
    setImagePrompts((prev) => {
      if (prev[visual.id]) return prev;
      const p = buildImagePrompt({
        product: productName,
        category,
        model: selectedModel!.id,
        visualTitle: visual.title,
        visualDesc: visual.desc,
        ratio: "9:16",
      });
      return { ...prev, [visual.id]: p };
    });
  }

  function regenPrompt(changeId: string, custom?: string) {
    if (kind === "video" && video) {
      const np = regeneratePrompt({
        previousPrompt: video.promptText,
        changeId,
        customChange: custom,
        product: productName,
      });
      setVideo({ ...video, promptText: np });
    } else {
      // regenerate the image prompt of each visual that has one
      setImagePrompts((prev) => {
        const next: Record<string, string> = {};
        for (const v of visuals) {
          if (prev[v.id]) {
            next[v.id] = regeneratePrompt({
              previousPrompt: prev[v.id],
              changeId,
              customChange: custom,
              product: productName,
            });
          }
        }
        return next;
      });
    }
  }

  return (
    <div className="flex flex-col">
      <Link href={`/productos/${productId}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-dim hover:text-text">
        <ArrowLeft className="h-4 w-4" /> Volver al producto
      </Link>

      <div className="mt-3 flex items-center gap-3">
        {cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
        )}
        <div>
          <h1 className="text-xl font-bold leading-snug text-text sm:text-2xl">{productName}</h1>
          <p className="mt-0.5 text-sm text-dim">Crea tu anuncio con IA</p>
          {isDemo && (
            <span className="mt-1 inline-block rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
              Datos demo
            </span>
          )}
        </div>
      </div>

      {!generated ? (
        <>
          {/* Paso 1: tipo */}
          <section className="mt-6">
            <h2 className="text-lg font-semibold text-text">¿Qué quieres crear?</h2>
            <div className="mt-3 grid grid-cols-1 gap-2">
              {TIPOS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setTipo(t.id);
                    const m = (t.kind === "video" ? VIDEO_MODELS : IMAGE_MODELS)[0];
                    setModelId(m.id);
                    setGenerated(false);
                  }}
                  className={
                    "flex items-center justify-between rounded-2xl border p-4 text-left transition-colors " +
                    (tipo === t.id
                      ? "border-accent bg-accent/10"
                      : "border-border bg-surface hover:border-accent/40")
                  }
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{t.emoji}</span>
                    <div>
                      <div className="font-semibold text-text">{t.label}</div>
                      <div className="text-xs text-dim">{t.desc}</div>
                    </div>
                  </div>
                  <span className={"h-5 w-5 rounded-full border-2 " + (tipo === t.id ? "border-accent bg-accent" : "border-border")} />
                </button>
              ))}
            </div>
          </section>

          {/* Paso 2: plataforma */}
          {tipo && (
            <section className="mt-6">
              <h2 className="text-lg font-semibold text-text">Plataforma IA</h2>
              <div className="mt-3 space-y-4">
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">{kind === "video" ? "Vídeo" : "Imagen"}</div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {models.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => pickModel(m)}
                        className={
                          "rounded-xl border p-3 text-center transition-colors " +
                          (selectedModel?.id === m.id
                            ? "border-accent bg-accent/10"
                            : "border-border bg-surface hover:border-accent/40")
                        }
                      >
                        <div className="text-sm font-semibold text-text">{m.name}</div>
                        <div className="mt-0.5 text-[11px] text-dim">{m.ratios[0]}</div>
                      </button>
                    ))}
                  </div>
                </div>
                {selectedModel?.notes && (
                  <p className="rounded-xl bg-surface-2 p-3 text-xs text-dim">{selectedModel.notes}</p>
                )}
              </div>
              <button
                type="button"
                onClick={generate}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-6 py-4 text-base font-semibold text-white shadow-lg shadow-accent/25 transition-transform active:scale-[0.98] hover:brightness-110"
              >
                <Wand2 className="h-5 w-5" />
                GENERAR PROMPTS
              </button>
            </section>
          )}
        </>
      ) : (
        /* Resultados */
        <div className="mt-6 flex flex-col gap-8">
          {/* Video prompt */}
          {video && (
            <section>
              <h2 className="text-lg font-semibold text-text">🎬 Prompt de vídeo</h2>
              <div className="mt-3 rounded-2xl border border-border bg-surface p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm">
                    <span className="font-semibold text-text">{selectedModel?.name}</span>
                    <span className="ml-2 text-dim">{video.ratio} · {video.durationSec}s</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copy(video.promptText, "video")}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-accent/15 px-3 py-2 text-xs font-semibold text-accent2 ring-1 ring-accent/30"
                  >
                    {copied === "video" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    COPIAR
                  </button>
                </div>
                <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-xl bg-bg p-3 font-sans text-[13px] leading-relaxed text-dim">
                  {video.promptText}
                </pre>
              </div>

              <div className="mt-4 space-y-2">
                {video.scenes.map((s) => (
                  <div key={s.num} className="rounded-xl border border-border bg-surface p-3">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="rounded bg-accent/20 px-2 py-0.5 text-xs font-bold text-accent2">{s.label}</span>
                      <span className="text-xs font-semibold uppercase tracking-wide text-faint">{s.beat}</span>
                    </div>
                    <p className="mt-2 text-sm text-text">{s.shot}</p>
                    {s.ref && <p className="mt-1 text-xs text-faint">Ref. visual: {s.ref}</p>}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Visuales necesarios */}
          <section>
            <h2 className="text-lg font-semibold text-text">🖼 Visuales necesarios</h2>
            <p className="mt-1 text-xs text-dim">Para crear el anuncio necesitas estas imágenes. Genera el prompt de cada una.</p>
            <div className="mt-3 space-y-2">
              {visuals.map((v) => {
                const p = imagePrompts[v.id] ?? null;
                return (
                  <div key={v.id} className="rounded-xl border border-border bg-surface p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-text">{v.title}</div>
                        <div className="text-xs text-dim">{v.desc}</div>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        {!p && (
                          <button
                            type="button"
                            onClick={() => ensureImagePrompt(v)}
                            className="inline-flex items-center gap-1 rounded-lg bg-accent/15 px-3 py-1.5 text-xs font-semibold text-accent2 ring-1 ring-accent/30"
                          >
                            <Sparkles className="h-3.5 w-3.5" /> Prompt
                          </button>
                        )}
                        {p && (
                          <button
                            type="button"
                            onClick={() => copy(p, "visual-" + v.id)}
                            className="inline-flex items-center gap-1 rounded-lg bg-accent/15 px-3 py-1.5 text-xs font-semibold text-accent2 ring-1 ring-accent/30"
                          >
                            {copied === "visual-" + v.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                            COPIAR
                          </button>
                        )}
                      </div>
                    </div>
                    {p && (
                      <pre className="mt-2 rounded-xl bg-bg p-3 font-sans text-[12px] leading-relaxed text-dim">
                        {p}
                      </pre>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Copiar */}
          <section>
            <h2 className="text-lg font-semibold text-text">✍️ Copy del anuncio</h2>
            <div className="mt-3 space-y-3">
              {copies.map((c, i) => (
                <div key={i} className="rounded-2xl border border-border bg-surface p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-faint">Variante {i + 1}</span>
                    <button
                      type="button"
                      onClick={() => copy(`${c.hook}\n\n${c.primaryText}\n\n${c.headline}\n${c.cta}`, "copy-" + i)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-accent/15 px-3 py-1.5 text-xs font-semibold text-accent2 ring-1 ring-accent/30"
                    >
                      {copied === "copy-" + i ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      COPIAR
                    </button>
                  </div>
                  <div className="space-y-2 text-sm text-dim">
                    <p><span className="font-semibold text-text">Hook:</span> {c.hook}</p>
                    <p><span className="font-semibold text-text">Texto:</span> {c.primaryText}</p>
                    <p><span className="font-semibold text-text">Título:</span> {c.headline}</p>
                    <p><span className="font-semibold text-text">CTA:</span> {c.cta}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Regenerar */}
          <section>
            <button
              type="button"
              onClick={() => setShowRegen((s) => !s)}
              className="inline-flex items-center gap-2 rounded-xl bg-surface-2 px-4 py-2.5 text-sm font-semibold text-text"
            >
              <RefreshCw className="h-4 w-4" /> Regenerar prompts
            </button>
            {showRegen && (
              <div className="mt-3 rounded-2xl border border-border bg-surface p-4">
                <h3 className="text-sm font-semibold text-text">¿Qué quieres cambiar?</h3>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {REGENERATE_OPTIONS.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => regenPrompt(o.id)}
                      className="rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-left text-xs font-medium text-text hover:border-accent/40"
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <input
                    value={customChange}
                    onChange={(e) => setCustomChange(e.target.value)}
                    placeholder="Escribe el cambio..."
                    className="flex-1 rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-text focus:border-accent focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled={!customChange.trim()}
                    onClick={() => regenPrompt("otro", customChange.trim())}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                  >
                    <PenLine className="h-4 w-4" /> Aplicar
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Cambiar tipo/modelo */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setGenerated(false)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-surface-2 px-4 py-2.5 text-sm font-semibold text-text"
            >
              <Bot className="h-4 w-4" /> Cambiar tipo o modelo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
