import React from 'react';
import { Cpu, Clock, Server } from 'lucide-react';

export default function WorkersView({ workers = [], isConnected }) {
  const activeWorkers = workers.filter(w => w.status === 'active');
  const deadWorkers = workers.filter(w => w.status !== 'active');

  const formatHeartbeat = (hbString) => {
    if (!hbString) return 'unknown';
    try {
      const diffMs = Date.now() - new Date(hbString).getTime();
      const diffSecs = Math.max(0, Math.floor(diffMs / 1000));
      if (diffSecs < 60) return `${diffSecs}s ago`;
      return `${Math.floor(diffSecs / 60)}m ago`;
    } catch {
      return hbString;
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-purple-600" />
            Worker Fleet
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Registered worker nodes, concurrency pools, and lease telemetry.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
            {activeWorkers.length} Active
          </span>
          {deadWorkers.length > 0 && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-stone-100 text-stone-600 border border-stone-200">
              {deadWorkers.length} Inactive
            </span>
          )}
        </div>
      </div>

      {workers.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-dashed border-stone-200 text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-stone-100 flex items-center justify-center text-stone-400">
            <Server className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-stone-800">No Workers Registered</h3>
          <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
            {isConnected ? 'No active worker nodes found in the database.' : 'Backend connection unavailable.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {workers.map((worker) => {
            const isActive = worker.status === 'active';
            return (
              <div
                key={worker.id}
                className={`p-4 rounded-2xl border transition-all ${
                  isActive 
                    ? 'bg-white border-stone-200 shadow-2xs hover:border-stone-300' 
                    : 'bg-stone-50/70 border-stone-200 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-xl border ${
                      isActive 
                        ? 'bg-purple-50 text-purple-700 border-purple-200/80' 
                        : 'bg-stone-100 text-stone-500 border-stone-200'
                    }`}>
                      <Server className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-stone-900">
                          {worker.hostname || 'worker-node'}
                        </span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          isActive 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                            : 'bg-stone-200 text-stone-700 border-stone-300'
                        }`}>
                          {worker.status}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-stone-400">
                        {worker.id}
                      </span>
                    </div>
                  </div>

                  {isActive && (
                    <span className="flex h-2 w-2 relative mt-1">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-stone-50 border border-stone-100 text-xs">
                  <div>
                    <span className="text-[10px] font-medium text-stone-400 block uppercase">Concurrency</span>
                    <span className="font-semibold text-stone-800">{worker.concurrency || 1}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-medium text-stone-400 block uppercase">Queues</span>
                    <span className="font-mono text-stone-700">
                      {Array.isArray(worker.queues) ? worker.queues.join(', ') : worker.queues || 'default'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-medium text-stone-400 block uppercase">Heartbeat</span>
                    <span className="font-mono text-emerald-700 font-medium">
                      {formatHeartbeat(worker.last_heartbeat)}
                    </span>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-[11px] text-stone-400">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-stone-400" />
                    Started: {new Date(worker.started_at || Date.now()).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
