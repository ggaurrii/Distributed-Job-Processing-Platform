import React, { useState } from 'react';
import { Zap, Play, AlertTriangle, Gauge } from 'lucide-react';
import { api } from '../api';

export default function ChaosLab({ onJobDispatched, showToast }) {
  const [burstCount, setBurstCount] = useState(10);
  const [burstType, setBurstType] = useState('flaky');
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState({ total: 0, sent: 0, failed: 0 });

  const runBurst = async () => {
    setIsRunning(true);
    setProgress({ total: burstCount, sent: 0, failed: 0 });

    let sent = 0;
    let failed = 0;

    for (let i = 0; i < burstCount; i++) {
      try {
        let payload = {};
        if (burstType === 'flaky') {
          payload = { burst_index: i + 1, test: 'concurrency_load' };
        } else if (burstType === 'sleep') {
          payload = { seconds: 1 + Math.random() * 2 };
        } else {
          payload = { item: i + 1 };
        }

        await api.submitJob({
          type: burstType,
          queue: 'default',
          priority: Math.floor(Math.random() * 10),
          max_attempts: 3,
          payload,
        });
        sent++;
      } catch {
        failed++;
      }
      setProgress({ total: burstCount, sent, failed });
    }

    setIsRunning(false);
    showToast(`Dispatched ${sent} jobs in batch`, 'success');
    if (onJobDispatched) onJobDispatched();
  };

  return (
    <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
      <div className="flex items-start justify-between gap-4 pb-4 border-b border-stone-100">
        <div>
          <h2 className="text-base font-bold text-stone-900">
            Batch Load Testing
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Submit multiple concurrent jobs to benchmark throughput and worker distribution.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-4">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">
              Task Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'flaky', label: 'Flaky (Retries)', icon: AlertTriangle },
                { id: 'sleep', label: 'Sleep (1-3s)', icon: Gauge },
                { id: 'echo', label: 'Echo', icon: Zap },
              ].map((b) => {
                const Icon = b.icon;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setBurstType(b.id)}
                    className={`p-2.5 rounded-xl border text-xs text-left transition-all ${
                      burstType === b.id
                        ? 'border-stone-900 bg-stone-900 text-white font-medium shadow-xs'
                        : 'border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 mb-1 opacity-80" />
                    <span className="block">{b.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">
              Batch Size: <span className="font-mono text-stone-900 font-bold">{burstCount} Jobs</span>
            </label>
            <div className="flex gap-2">
              {[5, 10, 25, 50].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setBurstCount(count)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-mono transition-all ${
                    burstCount === count
                      ? 'bg-amber-100 border-amber-300 text-amber-900 font-bold'
                      : 'border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  +{count}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={runBurst}
            disabled={isRunning}
            className="w-full py-2.5 px-4 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-semibold text-xs shadow-xs transition-all flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50"
          >
            <Play className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
            {isRunning ? `Sending (${progress.sent}/${progress.total})...` : `Submit ${burstCount} Jobs`}
          </button>
        </div>

        <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 text-xs space-y-3">
          <h4 className="font-semibold text-stone-800">
            Execution Details
          </h4>
          <ul className="space-y-2 text-stone-600 leading-relaxed list-disc list-inside">
            <li>
              Tasks are enqueued to PostgreSQL with configured parameters.
            </li>
            <li>
              Workers claim tasks via <code className="bg-stone-200/70 px-1 py-0.5 rounded text-[11px]">FOR UPDATE SKIP LOCKED</code>.
            </li>
            <li>
              Failed tasks are scheduled for retry with exponential backoff.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
