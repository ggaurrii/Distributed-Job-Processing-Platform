import React, { useState } from 'react';
import { X, Server, RotateCcw } from 'lucide-react';
import { getStoredBaseUrl, setStoredBaseUrl } from '../api';

export default function SettingsModal({ isOpen, onClose, onSave }) {
  const [url, setUrl] = useState(getStoredBaseUrl());

  if (!isOpen) return null;

  const handleSave = (e) => {
    e.preventDefault();
    setStoredBaseUrl(url.trim());
    onSave();
    onClose();
  };

  const handleReset = () => {
    setUrl('/api');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xl max-w-md w-full p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-stone-100 text-stone-700">
              <Server className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-sm text-stone-900">API Connection Settings</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-stone-400 hover:text-stone-700 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Base URL
            </label>
            <input
              type="text"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="e.g. /api or http://localhost:8080"
              className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handleReset}
              className="text-xs text-stone-500 hover:text-stone-800 flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              Reset (/api)
            </button>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold shadow-xs"
              >
                Save
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
