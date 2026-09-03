"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Trash2,
  Plus,
  Image as ImageIcon,
} from "lucide-react";
import type { StoreReplica } from "@/lib/stores/replica";

/**
 * Editor fiel "estilo Word+" de la réplica de la tienda real.
 * Cada bloque editable se resalta al pasar el ratón; un clic lo
 * convierte en un campo de edición en el propio sitio (texto, color o
 * imagen). Permite reordenar, duplicar y borrar secciones.
 */

export default function ReplicaEditor({
  replica,
  onChange,
}: {
  replica: StoreReplica;
  onChange: (r: StoreReplica) => void;
}) {
  const set = (patch: Partial<StoreReplica>) => onChange({ ...replica, ...patch });
  const accent = replica.brand.colors[1] || replica.brand.colors[0] || "#111";

  return (
    <div className="min-h-full overflow-hidden bg-white text-gray-900" style={{ fontFamily: replica.brand.fontFamily || "sans-serif" }}>
      {/* Cabecera */}
      <header
        className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6"
        style={{ background: replica.brand.colors[0] || "#ffffff", color: readable(replica.brand.colors[0] || "#ffffff") }}
      >
        <EditableText value={replica.header.logoText || replica.brand.name} onCommit={(v) => set({ header: { ...replica.header, logoText: v } })} className="text-base font-bold sm:text-lg" />
        <nav className="hidden flex-wrap items-center gap-4 text-xs font-medium md:flex">
          {replica.header.menu.map((m, i) => (
            <EditableText key={i} value={m} onCommit={(v) => set({ header: { ...replica.header, menu: replica.header.menu.map((x, j) => (j === i ? v : x)) } })} />
          ))}
        </nav>
      </header>

      {/* Hero */}
      <section className="relative">
        {replica.hero.imageUrl ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={replica.hero.imageUrl} alt={replica.hero.headline} className="h-52 w-full object-cover sm:h-72" />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
              <EditableText value={replica.hero.headline} onCommit={(v) => set({ hero: { ...replica.hero, headline: v } })} className="text-2xl font-extrabold sm:text-4xl" />
              {replica.hero.subheadline && (
                <EditableText value={replica.hero.subheadline} onCommit={(v) => set({ hero: { ...replica.hero, subheadline: v } })} className="text-sm sm:text-base" />
              )}
              {replica.hero.ctaLabel && (
                <button
                  type="button"
                  className="mt-2 rounded-full px-5 py-2 text-sm font-semibold"
                  style={{ background: (replica.brand.colors[1] || replica.brand.colors[0]) || "#111", color: readable((replica.brand.colors[1] || replica.brand.colors[0]) || "#111") }}
                >
                  {replica.hero.ctaLabel}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 p-8 text-center">
            <EditableText value={replica.hero.headline} onCommit={(v) => set({ hero: { ...replica.hero, headline: v } })} className="text-2xl font-extrabold sm:text-4xl" />
            {replica.hero.subheadline && (
              <EditableText value={replica.hero.subheadline} onCommit={(v) => set({ hero: { ...replica.hero, subheadline: v } })} className="text-sm text-gray-600 sm:text-base" />
            )}
          </div>
        )}
        {replica.hero.imageUrl && (
          <EditImage value={replica.hero.imageUrl} onCommit={(v) => set({ hero: { ...replica.hero, imageUrl: v } })} className="absolute right-2 top-2" />
        )}
      </section>

      {/* Secciones */}
      <div className="flex flex-col">
        {replica.sections.map((sec, i) => (
          <SectionBlock
            key={i}
            index={i}
            count={replica.sections.length}
            section={sec}
            accent={accent}
            onChange={(patch) => set({ sections: replica.sections.map((s, j) => (j === i ? { ...s, ...patch } : s)) })}
            onMove={(dir) => {
              const arr = [...replica.sections];
              const j = i + dir;
              if (j < 0 || j >= arr.length) return;
              [arr[i], arr[j]] = [arr[j], arr[i]];
              set({ sections: arr });
            }}
            onDuplicate={() => set({ sections: [...replica.sections.slice(0, i + 1), { ...sec }, ...replica.sections.slice(i + 1)] })}
            onDelete={() => set({ sections: replica.sections.filter((_, j) => j !== i) })}
          />
        ))}
        {replica.sections.length === 0 && (
          <p className="p-4 text-center text-xs text-gray-400">Sin secciones detectadas en esta página.</p>
        )}
        <button
          type="button"
          onClick={() => set({ sections: [...replica.sections, { type: "custom", heading: "Nueva sección", text: "Texto de la sección", imageUrl: null }] })}
          className="mx-auto my-4 inline-flex items-center gap-1.5 rounded-full border border-gray-300 px-4 py-2 text-xs font-medium text-gray-600 hover:border-gray-500 hover:text-gray-800"
        >
          <Plus className="h-3.5 w-3.5" /> Añadir sección
        </button>
      </div>

      {/* Producto destacado */}
      <section className="px-4 py-6 sm:px-6" style={{ background: "#f6f6f7" }}>
        <div className="mx-auto max-w-md text-center">
          {replica.product.imageUrl && (
            <EditImage value={replica.product.imageUrl} onCommit={(v) => set({ product: { ...replica.product, imageUrl: v } })} className="mb-3 flex justify-center" imgClass="h-40 w-40 rounded-lg object-cover" />
          )}
          <EditableText value={replica.product.title || "Producto"} onCommit={(v) => set({ product: { ...replica.product, title: v } })} className="text-lg font-bold" />
          <div className="mt-1 flex items-center justify-center gap-2">
            <EditableText value={replica.product.price != null ? String(replica.product.price) : ""} onCommit={(v) => set({ product: { ...replica.product, price: parseFloat(v) || null } })} className="text-xl font-extrabold" />
            {replica.product.compareAt != null && (
              <span className="text-sm text-gray-400 line-through">{replica.product.compareAt}</span>
            )}
          </div>
          {replica.product.description && (
            <EditableText value={replica.product.description} onCommit={(v) => set({ product: { ...replica.product, description: v } })} className="mt-1 block text-xs text-gray-500" />
          )}
          <button
            type="button"
            className="mt-3 rounded-full px-6 py-2.5 text-sm font-semibold"
            style={{ background: accent, color: readable(accent) }}
          >
            {replica.product.ctaLabel || "Añadir al carrito"}
          </button>
        </div>
      </section>

      {/* Pie */}
      <footer className="px-4 py-5 text-xs" style={{ background: replica.brand.colors[0] || "#111", color: readable(replica.brand.colors[0] || "#111") }}>
        <EditableText value={replica.footer.about} onCommit={(v) => set({ footer: { ...replica.footer, about: v } })} className="block" />
        <div className="mt-2 flex flex-wrap gap-2">
          {replica.footer.links.map((l, i) => (
            <EditableText key={i} value={l.text} onCommit={(v) => set({ footer: { ...replica.footer, links: replica.footer.links.map((x, j) => (j === i ? { ...x, text: v } : x)) } })} />
          ))}
        </div>
      </footer>

      {/* Colores de marca */}
      <div className="flex items-center gap-3 px-4 py-3 text-xs text-gray-500">
        <span className="font-medium">Colores de marca:</span>
        {replica.brand.colors.map((c, i) => (
          <EditColor key={i} value={c} onCommit={(v) => set({ brand: { ...replica.brand, colors: replica.brand.colors.map((x, j) => (j === i ? v : x)) } })} />
        ))}
      </div>
    </div>
  );
}

function readable(hex: string): string {
  const m = /^#?([a-f\d]{6})$/i.exec(hex.trim());
  if (!m) return "#fff";
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255,
    g = (n >> 8) & 255,
    b = n & 255;
  return r * 0.299 + g * 0.587 + b * 0.114 > 150 ? "#111" : "#fff";
}

function SectionBlock({
  index,
  count,
  section,
  accent,
  onChange,
  onMove,
  onDuplicate,
  onDelete,
}: {
  index: number;
  count: number;
  section: { type: string; heading: string; text: string; imageUrl: string | null; items?: { title: string; text: string }[] };
  accent: string;
  onChange: (patch: Partial<typeof section>) => void;
  onMove: (dir: -1 | 1) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group relative border-b border-gray-100 px-4 py-6 sm:px-6" style={{ borderColor: accent + "33" }}>
      <div className="absolute right-2 top-2 z-10 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button type="button" onClick={() => onMove(-1)} disabled={index === 0} aria-label="Subir sección" className="rounded-md border border-gray-300 bg-white p-1 text-gray-500 hover:text-gray-800 disabled:opacity-30"><ChevronUp className="h-3.5 w-3.5" /></button>
        <button type="button" onClick={() => onMove(1)} disabled={index === count - 1} aria-label="Bajar sección" className="rounded-md border border-gray-300 bg-white p-1 text-gray-500 hover:text-gray-800 disabled:opacity-30"><ChevronDown className="h-3.5 w-3.5" /></button>
        <button type="button" onClick={onDuplicate} aria-label="Duplicar sección" className="rounded-md border border-gray-300 bg-white p-1 text-gray-500 hover:text-gray-800"><Copy className="h-3.5 w-3.5" /></button>
        <button type="button" onClick={onDelete} aria-label="Borrar sección" className="rounded-md border border-gray-300 bg-white p-1 text-rose-500 hover:text-rose-700"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
      <EditableText value={section.heading} onCommit={(v) => onChange({ heading: v })} className="text-lg font-bold" />
      {section.text && <EditableText value={section.text} onCommit={(v) => onChange({ text: v })} className="mt-1 block text-sm text-gray-600" />}
      {section.imageUrl && (
        <EditImage value={section.imageUrl} onCommit={(v) => onChange({ imageUrl: v })} className="mt-2" imgClass="max-h-56 w-full rounded-lg object-cover" />
      )}
      {section.items && section.items.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {section.items.map((it, j) => (
            <div key={j} className="rounded-lg p-2" style={{ background: accent + "1a" }}>
              <EditableText value={it.title} onCommit={(v) => onChange({ items: section.items!.map((x, k) => (k === j ? { ...x, title: v } : x)) })} className="text-xs font-semibold" />
              <EditableText value={it.text} onCommit={(v) => onChange({ items: section.items!.map((x, k) => (k === j ? { ...x, text: v } : x)) })} className="mt-0.5 block text-[11px] opacity-80" />
            </div>
          ))}
        </div>
      )}
      <div className="mt-1 text-[10px] uppercase tracking-wide text-gray-300">Sección · {section.type}</div>
    </div>
  );
}

function EditableText({
  value,
  onCommit,
  className,
}: {
  value: string;
  onCommit: (v: string) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          onCommit(draft);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onCommit(draft);
            setEditing(false);
          }
          if (e.key === "Escape") setEditing(false);
        }}
        className={"rounded border border-blue-400 bg-white outline-none ring-2 ring-blue-200 " + (className || "")}
      />
    );
  }

  return (
    <span
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      className={"cursor-text rounded outline-dashed outline-1 outline-transparent transition-colors hover:outline-blue-400 " + (className || "")}
      title="Clic para editar"
    >
      {value}
    </span>
  );
}

function EditColor({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  return (
    <label className="relative inline-block h-6 w-6 cursor-pointer overflow-hidden rounded-full ring-1 ring-black/20">
      <span className="block h-full w-full" style={{ background: value }} />
      <input
        type="color"
        value={/^#?([a-f\d]{6})$/i.test(value) ? value : "#000000"}
        onChange={(e) => onCommit(e.target.value)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        aria-label="Cambiar color"
      />
    </label>
  );
}

function EditImage({
  value,
  onCommit,
  className,
  imgClass,
}: {
  value: string;
  onCommit: (v: string) => void;
  className?: string;
  imgClass?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (editing) {
    return (
      <div className={"relative " + (className || "")}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={value} alt="" className={imgClass} />
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            onCommit(draft);
            setEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onCommit(draft);
              setEditing(false);
            }
            if (e.key === "Escape") setEditing(false);
          }}
          placeholder="Pega la URL de la imagen"
          className="absolute inset-x-0 bottom-0 w-full border-t-2 border-blue-400 bg-white px-2 py-1 text-xs text-gray-700 outline-none"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      className={"group/btn relative inline-flex " + (className || "")}
      title="Clic para cambiar imagen"
      aria-label="Cambiar imagen"
    >
      <span className="absolute right-1 top-1 z-10 hidden items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white group-hover/btn:inline-flex">
        <ImageIcon className="h-3 w-3" /> Cambiar
      </span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={value} alt="" className={imgClass || "h-24 w-24 rounded-lg object-cover"} />
    </button>
  );
}