import React, { useState } from 'react';
import { Send, Clock, Shuffle, MessageSquare, Terminal, Check } from 'lucide-react';
import { api } from '../api';

const PRESETS = [
  {
    id: 'echo',
    name: 'Echo Task',
    icon: MessageSquare,
    desc: 'Logs payload data to standard output',
    color: 'border-amber-200 bg-amber-50/50 hover:bg-amber-50 text-amber-900',
    type: 'echo',
    defaultPayload: JSON.stringify({ message: "Task payload test", timestamp: new Date().toISOString() }, null, 2),
    priority: 0,
    maxAttempts: 3,
  },
  {
    id: 'sleep',
    name: 'Sleep Task',
    icon: Clock,
    desc: 'Executes a timed delay task',
    color: 'border-blue-200 bg-blue-50/50 hover:bg-blue-50 text-blue-900',
    type: 'sleep',
    defaultPayload: JSON.stringify({ seconds: 3 }, null, 2),
    priority: 5,
    maxAttempts: 3,
  },
  {
    id: 'flaky',
    name: 'Flaky Task',
    icon: Shuffle,
    desc: 'Fails probabilistically for retry testing',
    color: 'border-rose-200 bg-rose-50/50 hover:bg-rose-50 text-rose-900',
    type: 'flaky',
    defaultPayload: JSON.stringify({ test: "retry_backoff" }, null, 2),
    priority: 0,
    maxAttempts: 3,
  },
];

export default function JobDispatcher({ onJobDispatched, showToast }) {
  const [selectedPreset, setSelectedPreset] = useState('echo');
  const [jobType, setJobType] = useState('echo');
  const [queue, setQueue] = useState('default');
  const [priority, setPriority] = useState(0);
  const [maxAttempts, setMaxAttempts] = useState(5);
  const [payloadText, setPayloadText] = useState(PRESETS[0].defaultPayload);
  const [useIdempotency, setUseIdempotency] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const handleSelectPreset = (preset) => {
    setSelectedPreset(preset.id);
    setJobType(preset.type);
    setPriority(preset.priority);
    setMaxAttempts(preset.maxAttempts);
    setPayloadText(preset.defaultPayload);
  };

  const handleGenerateKey = () => {
    setIdempotencyKey(`key_${Math.random().toString(36).substring(2, 9)}`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setLastResult(null);

    try {
      let parsedPayload = {};
      if (payloadText.trim()) {
        try {
          parsedPayload = JSON.parse(payloadText);
        } catch (err) {
          throw new Error('Invalid JSON in payload: ' + err.message);
        }
      }

      const res = await api.submitJob({
        type: jobType.trim(),
        queue: queue.trim() || 'default',
        priority: Number(priority),
        max_attempts: Number(maxAttempts),
        payload: parsedPayload,
        idempotency_key: useIdempotency ? idempotencyKey : '',
      });

      setLastResult({ success: true, data: res });
      showToast('Job enqueued successfully', 'success');
      if (onJobDispatched) onJobDispatched();
    } catch (err) {
      setLastResult({ success: false, error: err.message });
      showToast(err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-100">
        <div>
          <h2 className="text-base font-bold text-stone-900">
            Enqueue Job
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Submit a job to the distributed queue.
          </p>
        </div>
        
        <span className="text-xs font-medium text-stone-500">Presets:</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-4">
        {PRESETS.map((p) => {
          const Icon = p.icon;
          const isSelected = selectedPreset === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => handleSelectPreset(p)}
              className={`p-3.5 rounded-xl border text-left transition-all relative ${
                isSelected 
                  ? `${p.color} ring-2 ring-stone-900/10 shadow-xs` 
                  : 'border-stone-200 bg-stone-50/60 hover:bg-stone-100/70 text-stone-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-semibold text-xs flex items-center gap-1.5">
                  <Icon className="w-3.5 h-3.5" />
                  {p.name}
                </span>
                {isSelected && (
                  <span className="w-4 h-4 rounded-full bg-stone-900 text-white flex items-center justify-center text-[10px]">
                    <Check className="w-2.5 h-2.5" />
                  </span>
                )}
              </div>
              <p className="text-[11px] text-stone-500 leading-snug">
                {p.desc}
              </p>
            </button>
          );
        })}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Job Type
            </label>
            <input
              type="text"
              required
              value={jobType}
              onChange={(e) => {
                setJobType(e.target.value);
                setSelectedPreset('custom');
              }}
              placeholder="e.g. echo, sleep, flaky"
              className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-mono transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Queue
            </label>
            <input
              type="text"
              value={queue}
              onChange={(e) => setQueue(e.target.value)}
              placeholder="default"
              className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-mono transition-all"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-stone-700">
                Priority
              </label>
              <span className="text-[11px] font-mono text-stone-500">
                {priority}
              </span>
            </div>
            <input
              type="number"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              min="-100"
              max="100"
              className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-mono transition-all"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Max Attempts
            </label>
            <input
              type="number"
              min="1"
              max="20"
              value={maxAttempts}
              onChange={(e) => setMaxAttempts(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-mono transition-all"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-stone-700 flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useIdempotency}
                  onChange={(e) => {
                    setUseIdempotency(e.target.checked);
                    if (e.target.checked && !idempotencyKey) handleGenerateKey();
                  }}
                  className="rounded border-stone-300 text-stone-900 focus:ring-stone-900/20"
                />
                Idempotency Key
              </label>
              {useIdempotency && (
                <button
                  type="button"
                  onClick={handleGenerateKey}
                  className="text-[11px] text-amber-700 hover:text-amber-800 font-medium"
                >
                  Generate Key
                </button>
              )}
            </div>
            <input
              type="text"
              disabled={!useIdempotency}
              value={idempotencyKey}
              onChange={(e) => setIdempotencyKey(e.target.value)}
              placeholder="Unique key (e.g. order_123)"
              className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 bg-stone-50/50 disabled:bg-stone-100/60 disabled:text-stone-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-mono transition-all"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold text-stone-700 flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-stone-500" />
              Payload (JSON)
            </label>
            <button
              type="button"
              onClick={() => setPayloadText(JSON.stringify({ value: "test" }, null, 2))}
              className="text-[11px] text-stone-500 hover:text-stone-800"
            >
              Reset Payload
            </button>
          </div>
          <textarea
            rows={4}
            value={payloadText}
            onChange={(e) => setPayloadText(e.target.value)}
            className="w-full p-3 text-xs rounded-xl border border-stone-200 bg-stone-50/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-mono leading-relaxed transition-all"
            placeholder="{}"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold shadow-xs transition-all active:scale-95 disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            {isSubmitting ? 'Submitting...' : 'Enqueue'}
          </button>
        </div>
      </form>

      {lastResult && (
        <div className={`mt-4 p-4 rounded-xl text-xs border ${
          lastResult.success 
            ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950' 
            : 'bg-rose-50/60 border-rose-200 text-rose-950'
        }`}>
          <div className="flex items-center justify-between font-semibold mb-1">
            <span>{lastResult.success ? 'Job Enqueued' : 'Submission Error'}</span>
            {lastResult.success && lastResult.data?.id && (
              <span className="font-mono text-[11px] text-emerald-700">ID: {lastResult.data.id}</span>
            )}
          </div>
          {lastResult.success ? (
            <pre className="mt-2 p-2 rounded-lg bg-white/80 border border-emerald-200/50 font-mono text-[11px] overflow-x-auto text-stone-800">
              {JSON.stringify(lastResult.data, null, 2)}
            </pre>
          ) : (
            <p className="mt-1 text-rose-800">{lastResult.error}</p>
          )}
        </div>
      )}
    </div>
  );
}
