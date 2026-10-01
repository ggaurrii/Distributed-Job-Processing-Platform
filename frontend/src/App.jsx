import React, { useState, useEffect, useCallback } from 'react';
import { api } from './api';
import Navbar from './components/Navbar';
import StatsCards from './components/StatsCards';
import JobDispatcher from './components/JobDispatcher';
import WorkersView from './components/WorkersView';
import DeadQueueView from './components/DeadQueueView';
import ChaosLab from './components/ChaosLab';
import SettingsModal from './components/SettingsModal';
import Toast from './components/Toast';
import { Terminal, Activity, ArrowRight, AlertCircle } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState({ queued: 0, running: 0, succeeded: 0, dead: 0, blocked: 0 });
  const [workers, setWorkers] = useState([]);
  const [deadJobs, setDeadJobs] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(3000);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const fetchData = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);

    try {
      const statsData = await api.getStats();
      setStats(statsData || { queued: 0, running: 0, succeeded: 0, dead: 0, blocked: 0 });

      try {
        const workersData = await api.getWorkers();
        setWorkers(Array.isArray(workersData) ? workersData : []);
      } catch (wErr) {
        console.warn('Could not fetch workers:', wErr);
      }

      try {
        const deadData = await api.getDeadJobs();
        setDeadJobs(Array.isArray(deadData) ? deadData : []);
      } catch (dErr) {
        console.warn('Could not fetch dead jobs:', dErr);
      }

      setIsConnected(true);
      setConnectionError(null);
      setLastUpdated(new Date());
    } catch (err) {
      setIsConnected(false);
      setConnectionError(err.message);
    } finally {
      if (isManual) {
        setTimeout(() => setIsRefreshing(false), 300);
      }
    }
  }, []);

  useEffect(() => {
    fetchData();

    if (refreshInterval > 0) {
      const interval = setInterval(() => {
        fetchData();
      }, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchData, refreshInterval]);

  return (
    <div className="min-h-screen bg-[#faf9f6] text-stone-800 flex flex-col selection:bg-amber-100 selection:text-amber-900">
      <Navbar
        isConnected={isConnected}
        lastUpdated={lastUpdated}
        isRefreshing={isRefreshing}
        onRefresh={() => fetchData(true)}
        refreshInterval={refreshInterval}
        setRefreshInterval={setRefreshInterval}
        onOpenSettings={() => setIsSettingsOpen(true)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {!isConnected && (
          <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200 text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-amber-100 text-amber-800 shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-xs text-amber-900">Backend Disconnected</h3>
                <p className="text-xs text-amber-800/90 mt-0.5">
                  {connectionError || 'Unable to reach backend API.'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-center">
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-white border border-amber-200 text-amber-900 hover:bg-amber-100/50 text-xs font-semibold"
              >
                Configure URL
              </button>
              <button
                onClick={() => fetchData(true)}
                className="px-3.5 py-1.5 rounded-xl bg-stone-900 text-white hover:bg-stone-800 text-xs font-semibold shadow-2xs"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        <StatsCards
          stats={stats}
          workersCount={workers.filter(w => w.status === 'active').length}
        />

        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="p-6 rounded-3xl bg-stone-900 text-white relative overflow-hidden shadow-sm">
              <div className="relative z-10 max-w-xl space-y-2">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 text-white/90 text-xs font-medium backdrop-blur-md">
                  Queue Engine
                </div>
                <h2 className="text-xl font-bold tracking-tight">
                  Distributed Job Management
                </h2>
                <p className="text-xs text-stone-300 leading-relaxed">
                  PostgreSQL-backed job queue with lease-based recovery, exponential retry backoff, and dead letter queue routing.
                </p>
                <div className="pt-2 flex items-center gap-3">
                  <button
                    onClick={() => setActiveTab('dispatch')}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-stone-900 text-xs font-bold hover:bg-stone-100 transition-all shadow-xs active:scale-95"
                  >
                    Enqueue Job <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setActiveTab('chaos')}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/15 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur-md transition-all active:scale-95"
                  >
                    Load Test
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <JobDispatcher
                  onJobDispatched={() => fetchData(true)}
                  showToast={showToast}
                />
              </div>

              <div className="space-y-6">
                <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs">
                  <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                    <span className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                      <Activity className="w-4 h-4 text-purple-600" />
                      Active Workers
                    </span>
                    <button
                      onClick={() => setActiveTab('workers')}
                      className="text-[11px] text-stone-500 hover:text-stone-800 font-medium"
                    >
                      View all ({workers.length}) →
                    </button>
                  </div>
                  <div className="mt-3 space-y-2">
                    {workers.slice(0, 3).map((w) => (
                      <div key={w.id} className="p-2.5 rounded-xl bg-stone-50 border border-stone-100 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-mono font-semibold text-stone-800 text-[11px]">{w.hostname}</div>
                          <div className="text-[10px] text-stone-400 font-mono">concurrency: {w.concurrency}</div>
                        </div>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          w.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-700'
                        }`}>
                          {w.status}
                        </span>
                      </div>
                    ))}
                    {workers.length === 0 && (
                      <p className="text-xs text-stone-400 text-center py-3">No active workers</p>
                    )}
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs">
                  <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                    <span className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                      <Terminal className="w-4 h-4 text-rose-600" />
                      Dead Letter Queue
                    </span>
                    <button
                      onClick={() => setActiveTab('dead')}
                      className="text-[11px] text-stone-500 hover:text-stone-800 font-medium"
                    >
                      Inspect ({deadJobs.length}) →
                    </button>
                  </div>
                  <div className="mt-3 space-y-2">
                    {deadJobs.slice(0, 2).map((d) => (
                      <div key={d.id} className="p-2.5 rounded-xl bg-rose-50/60 border border-rose-100 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-rose-900 text-[11px]">{d.type}</span>
                          <span className="text-[10px] text-rose-700 font-semibold">{d.attempts} attempts</span>
                        </div>
                        <p className="text-[10px] font-mono text-rose-600 truncate mt-1">{d.last_error || 'Failed'}</p>
                      </div>
                    ))}
                    {deadJobs.length === 0 && (
                      <p className="text-xs text-stone-400 text-center py-3">Queue is empty</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'dispatch' && (
          <JobDispatcher
            onJobDispatched={() => fetchData(true)}
            showToast={showToast}
          />
        )}

        {activeTab === 'workers' && (
          <WorkersView
            workers={workers}
            isConnected={isConnected}
          />
        )}

        {activeTab === 'dead' && (
          <DeadQueueView
            deadJobs={deadJobs}
            onReplaySuccess={() => fetchData(true)}
            showToast={showToast}
          />
        )}

        {activeTab === 'chaos' && (
          <ChaosLab
            onJobDispatched={() => fetchData(true)}
            showToast={showToast}
          />
        )}
      </main>

      <footer className="border-t border-stone-200 py-6 text-center text-xs text-stone-400">
        <p>Conveyor Job Queue Platform</p>
      </footer>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSave={() => fetchData(true)}
      />

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
