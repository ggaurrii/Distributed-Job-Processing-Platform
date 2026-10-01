import React, { useState } from 'react';
import { AlertTriangle, RotateCcw, ChevronDown, ChevronUp, Copy, Check, ShieldAlert } from 'lucide-react';
import { api } from '../api';

export default function DeadQueueView({ deadJobs = [], onReplaySuccess, showToast }) {
  const [replayingId, setReplayingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const handleReplay = async (jobId) => {
    setReplayingId(jobId);
    try {
      await api.replayJob(jobId);
      showToast(`Job re-queued successfully`, 'success');
      if (onReplaySuccess) onReplaySuccess();
    } catch (err) {
      showToast(`Replay failed: ${err.message}`, 'error');
    } finally {
      setReplayingId(null);
    }
  };

  const handleReplayAll = async () => {
    if (deadJobs.length === 0) return;
    let count = 0;
    for (const job of deadJobs) {
      try {
        await api.replayJob(job.id);
        count++;
      } catch (err) {
        console.error('Failed replaying job:', job.id, err);
      }
    }
    showToast(`Replayed ${count} jobs from DLQ`, 'success');
    if (onReplaySuccess) onReplaySuccess();
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            Dead Letter Queue
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Jobs that exceeded their maximum retry limits.
          </p>
        </div>

        {deadJobs.length > 0 && (
          <button
            onClick={handleReplayAll}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold transition-all active:scale-95"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Replay All ({deadJobs.length})
          </button>
        )}
      </div>

      {deadJobs.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-dashed border-stone-200 text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-stone-800">Dead Letter Queue Empty</h3>
          <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
            No failed jobs present in the queue.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {deadJobs.map((job) => {
            const isExpanded = expandedId === job.id;
            const isReplaying = replayingId === job.id;

            return (
              <div
                key={job.id}
                className="bg-white rounded-2xl border border-rose-100/90 shadow-2xs overflow-hidden transition-all hover:border-rose-200"
              >
                <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 mt-0.5">
                      <AlertTriangle className="w-4 h-4" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-stone-900">
                          {job.type}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 border border-stone-200">
                          {job.queue || 'default'}
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-rose-100 text-rose-700">
                          {job.attempts}/{job.max_attempts} attempts
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-mono text-[11px] text-stone-400">
                          {job.id}
                        </span>
                        <button
                          onClick={() => copyToClipboard(job.id, job.id)}
                          className="text-stone-400 hover:text-stone-600"
                          title="Copy ID"
                        >
                          {copiedId === job.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>

                      {job.last_error && (
                        <p className="text-xs text-rose-700 mt-1.5 font-mono bg-rose-50/70 px-2.5 py-1 rounded-lg border border-rose-100 inline-block">
                          {job.last_error}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : job.id)}
                      className="px-2.5 py-1.5 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 text-xs font-medium flex items-center gap-1"
                    >
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      Payload
                    </button>

                    <button
                      onClick={() => handleReplay(job.id)}
                      disabled={isReplaying}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold shadow-xs transition-all active:scale-95 disabled:opacity-50"
                    >
                      <RotateCcw className={`w-3.5 h-3.5 ${isReplaying ? 'animate-spin' : ''}`} />
                      {isReplaying ? 'Replaying...' : 'Replay'}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-4 bg-stone-50/80 border-t border-stone-100 text-xs space-y-3">
                    <div>
                      <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider block mb-1">
                        Payload
                      </span>
                      <pre className="p-3 rounded-xl bg-white border border-stone-200 font-mono text-[11px] text-stone-800 overflow-x-auto">
                        {JSON.stringify(job.payload, null, 2)}
                      </pre>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-stone-500">
                      <div>
                        <span className="text-stone-400 block">Created</span>
                        <span>{job.created_at ? new Date(job.created_at).toLocaleString() : 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-stone-400 block">Finished</span>
                        <span>{job.finished_at ? new Date(job.finished_at).toLocaleString() : 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-stone-400 block">Priority</span>
                        <span className="font-mono">{job.priority}</span>
                      </div>
                      <div>
                        <span className="text-stone-400 block">Idempotency Key</span>
                        <span className="font-mono">{job.idempotency_key || 'None'}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
