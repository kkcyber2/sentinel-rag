/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { ChatInterface } from './components/ChatInterface';
import { WorkflowGraphVisualizer } from './components/WorkflowGraphVisualizer';
import { VectorInspector } from './components/VectorInspector';
import { TestRunnerView } from './components/TestRunnerView';
import { ArchitectureView } from './components/ArchitectureView';
import { SystemHealth, AskResponseData } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<'chat' | 'graph' | 'chunks' | 'tests' | 'docs'>('chat');
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [latestAuditTrail, setLatestAuditTrail] = useState<AskResponseData | null>(null);

  const fetchHealth = async () => {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        setHealth(data);
      }
    } catch (err) {
      console.error('Failed to fetch health status:', err);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const handlePreloadSamples = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/ingest-sample', { method: 'POST' });
      if (res.ok) {
        await fetchHealth();
      }
    } catch (err) {
      console.error('Failed to preload sample docs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async () => {
    setIsLoading(true);
    try {
      await fetch('/api/reset', { method: 'POST' });
      await fetchHealth();
      setLatestAuditTrail(null);
    } catch (err) {
      console.error('Failed to reset vector store:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAsk = async (question: string): Promise<AskResponseData | null> => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question })
      });

      if (res.ok) {
        const data: AskResponseData = await res.json();
        setLatestAuditTrail(data);
        await fetchHealth();
        return data;
      }
      return null;
    } catch (err) {
      console.error('Ask request error:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (file: File): Promise<boolean> => {
    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        await fetchHealth();
        return true;
      }
      return false;
    } catch (err) {
      console.error('Upload error:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased selection:bg-indigo-500/20 selection:text-indigo-900">
      <Header
        health={health}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onPreloadSamples={handlePreloadSamples}
        onReset={handleReset}
        isLoading={isLoading}
      />

      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {activeTab === 'chat' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <ChatInterface
                onAsk={handleAsk}
                onFileUpload={handleFileUpload}
                isLoading={isLoading}
                chunkCount={health?.vector_store.chunk_count ?? 0}
              />
            </div>
            <div className="lg:col-span-1">
              <WorkflowGraphVisualizer
                auditTrail={latestAuditTrail?.audit_trail}
                isVerified={latestAuditTrail?.verified}
                attemptCount={latestAuditTrail?.attempt_count}
              />
            </div>
          </div>
        )}

        {activeTab === 'graph' && (
          <WorkflowGraphVisualizer
            auditTrail={latestAuditTrail?.audit_trail}
            isVerified={latestAuditTrail?.verified}
            attemptCount={latestAuditTrail?.attempt_count}
          />
        )}

        {activeTab === 'chunks' && (
          <VectorInspector onResetStore={handleReset} />
        )}

        {activeTab === 'tests' && (
          <TestRunnerView />
        )}

        {activeTab === 'docs' && (
          <ArchitectureView />
        )}
      </main>
    </div>
  );
}
