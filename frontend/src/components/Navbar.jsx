import React from 'react';
import { Package, RefreshCw, Settings } from 'lucide-react';

export default function Navbar({ 
  isConnected, 
  lastUpdated, 
  isRefreshing, 
  onRefresh, 
  refreshInterval, 
  setRefreshInterval, 
  onOpenSettings,
  activeTab,
  setActiveTab 
}) {
  return (
    <header className="border-b border-stone-200 bg-white/80 backdrop-blur-md sticky top-0 z-30 transition-all">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-100/80 border border-amber-200/80 flex items-center justify-center text-amber-900 shadow-sm transition-transform hover:scale-105">
            <Package className="w-5 h-5 text-amber-700" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-stone-900 text-lg tracking-tight">Conveyor</h1>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 border border-stone-200">
                v1.0
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-stone-500">
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              <span>{isConnected ? 'System Operational' : 'Disconnected'}</span>
              {lastUpdated && (
                <span className="text-stone-400 text-[11px]">
                  • {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              )}
            </div>
          </div>
        </div>

        <nav className="hidden md:flex items-center bg-stone-100 p-1 rounded-xl border border-stone-200/70 text-sm font-medium">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3.5 py-1.5 rounded-lg transition-all ${
              activeTab === 'overview' 
                ? 'bg-white text-stone-900 shadow-sm font-semibold' 
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('dispatch')}
            className={`px-3.5 py-1.5 rounded-lg transition-all ${
              activeTab === 'dispatch' 
                ? 'bg-white text-stone-900 shadow-sm font-semibold' 
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Dispatch
          </button>
          <button
            onClick={() => setActiveTab('workers')}
            className={`px-3.5 py-1.5 rounded-lg transition-all ${
              activeTab === 'workers' 
                ? 'bg-white text-stone-900 shadow-sm font-semibold' 
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Workers
          </button>
          <button
            onClick={() => setActiveTab('dead')}
            className={`px-3.5 py-1.5 rounded-lg transition-all ${
              activeTab === 'dead' 
                ? 'bg-white text-stone-900 shadow-sm font-semibold' 
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            DLQ
          </button>
          <button
            onClick={() => setActiveTab('chaos')}
            className={`px-3.5 py-1.5 rounded-lg transition-all ${
              activeTab === 'chaos' 
                ? 'bg-white text-stone-900 shadow-sm font-semibold' 
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Load Testing
          </button>
        </nav>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-stone-100 rounded-lg p-0.5 text-xs text-stone-600 border border-stone-200">
            <button
              onClick={() => setRefreshInterval(1000)}
              className={`px-2 py-1 rounded-md transition-all ${refreshInterval === 1000 ? 'bg-white font-medium text-stone-900 shadow-xs' : 'hover:text-stone-900'}`}
            >
              1s
            </button>
            <button
              onClick={() => setRefreshInterval(3000)}
              className={`px-2 py-1 rounded-md transition-all ${refreshInterval === 3000 ? 'bg-white font-medium text-stone-900 shadow-xs' : 'hover:text-stone-900'}`}
            >
              3s
            </button>
            <button
              onClick={() => setRefreshInterval(0)}
              className={`px-2 py-1 rounded-md transition-all ${refreshInterval === 0 ? 'bg-white font-medium text-stone-900 shadow-xs' : 'hover:text-stone-900'}`}
            >
              Off
            </button>
          </div>

          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-2 text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200/70 border border-stone-200 rounded-lg transition-all active:scale-95 disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-amber-700' : ''}`} />
          </button>

          <button
            onClick={onOpenSettings}
            className="p-2 text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200/70 border border-stone-200 rounded-lg transition-all active:scale-95"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex md:hidden overflow-x-auto border-t border-stone-100 px-4 py-2 gap-1 text-xs">
        {['overview', 'dispatch', 'workers', 'dead', 'chaos'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap capitalize ${
              activeTab === tab ? 'bg-stone-900 text-white font-medium' : 'text-stone-600 bg-stone-100'
            }`}
          >
            {tab === 'dead' ? 'DLQ' : tab === 'chaos' ? 'Load Test' : tab}
          </button>
        ))}
      </div>
    </header>
  );
}
