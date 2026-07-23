import React from 'react';
import { ShieldCheck, Database, Cpu, RefreshCw, Layers, Shield, FileSearch, TestTube2, BookOpen } from 'lucide-react';
import { SystemHealth } from '../types';

interface HeaderProps {
  health: SystemHealth | null;
  activeTab: 'chat' | 'graph' | 'chunks' | 'tests' | 'docs';
  setActiveTab: (tab: 'chat' | 'graph' | 'chunks' | 'tests' | 'docs') => void;
  onPreloadSamples: () => void;
  onReset: () => void;
  isLoading: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  health,
  activeTab,
  setActiveTab,
  onPreloadSamples,
  isLoading
}) => {
  return (
    <header className="border-b border-slate-200 bg-white sticky top-0 z-50 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 py-3.5 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          
          {/* Brand Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-slate-900">Sentinel-RAG</h1>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase tracking-wider">
                  Multi-Agent v1.0
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">Self-Verifying Researcher + Verifier Intelligence</p>
            </div>
          </div>

          {/* Quick Metrics & Actions */}
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 font-medium">
              <Database className="w-3.5 h-3.5 text-indigo-600" />
              <span>Chunks Indexed:</span>
              <strong className="text-slate-900 font-bold">{health?.vector_store.chunk_count ?? 0}</strong>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 font-medium">
              <Cpu className="w-3.5 h-3.5 text-emerald-600" />
              <span>Engine:</span>
              <span className="text-slate-900 font-bold">Gemini / Ollama</span>
            </div>

            <button
              onClick={onPreloadSamples}
              disabled={isLoading}
              className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Reload Samples
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 mt-3.5 pt-2 border-t border-slate-100 overflow-x-auto text-xs font-semibold">
          <button
            onClick={() => setActiveTab('chat')}
            className={`px-3.5 py-2 rounded-lg transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'chat'
                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Shield className="w-4 h-4 text-indigo-600" />
            Interactive Q&A
          </button>

          <button
            onClick={() => setActiveTab('graph')}
            className={`px-3.5 py-2 rounded-lg transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'graph'
                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Layers className="w-4 h-4 text-indigo-600" />
            LangGraph Flow
          </button>

          <button
            onClick={() => setActiveTab('chunks')}
            className={`px-3.5 py-2 rounded-lg transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'chunks'
                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <FileSearch className="w-4 h-4 text-indigo-600" />
            Vector DB Inspector
          </button>

          <button
            onClick={() => setActiveTab('tests')}
            className={`px-3.5 py-2 rounded-lg transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'tests'
                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <TestTube2 className="w-4 h-4 text-indigo-600" />
            Test Suite
          </button>

          <button
            onClick={() => setActiveTab('docs')}
            className={`px-3.5 py-2 rounded-lg transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'docs'
                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <BookOpen className="w-4 h-4 text-indigo-600" />
            Architecture & Docs
          </button>
        </div>
      </div>
    </header>
  );
};
