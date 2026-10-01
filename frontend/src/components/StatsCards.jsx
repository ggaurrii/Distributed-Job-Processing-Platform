import React from 'react';
import { Layers, PlayCircle, CheckCircle, AlertTriangle, Cpu } from 'lucide-react';

export default function StatsCards({ stats = {}, workersCount = 0 }) {
  const cards = [
    {
      key: 'queued',
      label: 'Queued',
      count: stats.queued || 0,
      icon: Layers,
      bg: 'bg-amber-50/70',
      border: 'border-amber-200/80',
      text: 'text-amber-900',
      desc: 'Pending execution',
    },
    {
      key: 'running',
      label: 'Running',
      count: stats.running || 0,
      icon: PlayCircle,
      bg: 'bg-emerald-50/70',
      border: 'border-emerald-200/80',
      text: 'text-emerald-900',
      desc: 'In progress',
      isLive: (stats.running || 0) > 0,
    },
    {
      key: 'succeeded',
      label: 'Succeeded',
      count: stats.succeeded || 0,
      icon: CheckCircle,
      bg: 'bg-indigo-50/70',
      border: 'border-indigo-200/80',
      text: 'text-indigo-900',
      desc: 'Completed jobs',
    },
    {
      key: 'dead',
      label: 'Dead Letter',
      count: stats.dead || 0,
      icon: AlertTriangle,
      bg: 'bg-rose-50/70',
      border: 'border-rose-200/80',
      text: 'text-rose-900',
      desc: 'Exceeded max attempts',
      alert: (stats.dead || 0) > 0,
    },
    {
      key: 'workers',
      label: 'Active Workers',
      count: workersCount || 0,
      icon: Cpu,
      bg: 'bg-stone-50',
      border: 'border-stone-200',
      text: 'text-stone-900',
      desc: 'Online nodes',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.key}
            className={`p-4 rounded-2xl border ${card.border} ${card.bg} transition-all duration-200 hover:shadow-xs`}
          >
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-semibold text-stone-600 tracking-wide uppercase">
                {card.label}
              </span>
              <div className="p-1.5 rounded-xl bg-white/80 border border-black/5 shadow-2xs">
                <Icon className={`w-4 h-4 ${card.text}`} />
              </div>
            </div>

            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-bold tracking-tight ${card.text}`}>
                {card.count.toLocaleString()}
              </span>
              {card.isLive && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-100/90 px-1.5 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  active
                </span>
              )}
              {card.alert && (
                <span className="text-[11px] font-medium text-rose-700 bg-rose-100/90 px-1.5 py-0.5 rounded-full">
                  attention
                </span>
              )}
            </div>

            <p className="mt-1 text-[11px] text-stone-500 truncate">
              {card.desc}
            </p>
          </div>
        );
      })}
    </div>
  );
}
