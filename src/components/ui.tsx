import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex items-end justify-between gap-6 border-b border-border pb-5 pt-8">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-text">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-dim">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Card({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={
        "rounded-xl border border-border bg-surface ring-1 ring-transparent " + className
      }
    >
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  icon,
  accent,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  icon?: ReactNode;
  accent?: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-faint">
          {label}
        </span>
        {icon && <span className={"text-" + (accent ?? "faint")}>{icon}</span>}
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight text-text">{value}</div>
      {sub && <div className="mt-1 text-xs text-dim">{sub}</div>}
    </Card>
  );
}

export function SectionTitle({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-sm font-semibold tracking-tight text-text">{title}</h2>
      {action}
    </div>
  );
}
