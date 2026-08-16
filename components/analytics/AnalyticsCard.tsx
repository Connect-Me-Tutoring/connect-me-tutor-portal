import React from "react";

type Props = {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
};

export default function AnalyticsCard({ title, subtitle, actions, children, className }: Props) {
  return (
    <section className={`rounded-lg border bg-white p-4 shadow-sm min-h-[200px] flex flex-col ${className ?? ""}`}>
      <header className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-medium text-slate-900">{title}</h3>
          {subtitle ? <p className="text-xs text-slate-500 mt-1">{subtitle}</p> : null}
        </div>
        <div className="flex items-center gap-2">{actions}</div>
      </header>

      <div className="mt-4 flex-1 overflow-hidden">
        {children ?? <div className="h-full w-full flex items-center justify-center text-sm text-slate-400">No data</div>}
      </div>
    </section>
  );
}
