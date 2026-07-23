import React, { useState } from 'react';
import { Send, Upload, Sparkles, CheckCircle, AlertTriangle, FileText, ChevronDown, ChevronUp, Bot, User, RefreshCw } from 'lucide-react';
import { AskResponseData } from '../types';

interface ChatInterfaceProps {
  onAsk: (question: string) => Promise<AskResponseData | null>;
  onFileUpload: (file: File) => Promise<boolean>;
  isLoading: boolean;
  chunkCount: number;
}

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  data?: AskResponseData;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  onAsk,
  onFileUpload,
  isLoading,
  chunkCount
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: 'Hello! I am Sentinel-RAG, a self-verifying document assistant. Ask me anything about your uploaded documents or click a sample test prompt below to observe the Researcher + Verifier agent pipeline in action.'
    }
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});

  const presetQuestions = [
    {
      label: '🎯 Grounding Test',
      query: 'What hardware keys are required for multi-factor authentication?',
      desc: 'Tests direct retrieval & verified extraction from policy doc'
    },
    {
      label: '🛑 Hallucination Trap',
      query: 'What is the capital of France and its total population?',
      desc: 'Tests refusal/unverified flag on out-of-scope question'
    },
    {
      label: '🔐 Security Finding',
      query: 'What critical severity finding was identified in the Red Team Assessment?',
      desc: 'Tests retrieval from Red Team Report'
    },
    {
      label: '⏱️ Escalation Timelines',
      query: 'What is the mandatory timeline for GDPR DPO breach notification?',
      desc: 'Tests retrieval from Incident Response Plan'
    }
  ];

  const handleSend = async (queryToSend?: string) => {
    const q = (queryToSend || inputQuery).trim();
    if (!q || isLoading) return;

    const userMsgId = `user_${Date.now()}`;
    const assistantMsgId = `assistant_${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      { id: userMsgId, sender: 'user', text: q },
      { id: assistantMsgId, sender: 'assistant', text: 'Thinking... (Running Researcher draft + Verifier audit loop)' }
    ]);

    if (!queryToSend) setInputQuery('');

    const responseData = await onAsk(q);

    if (responseData) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? {
                ...m,
                text: responseData.answer,
                data: responseData
              }
            : m
        )
      );
    } else {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? {
                ...m,
                text: 'Failed to process response. Please make sure documents are uploaded and try again.'
              }
            : m
        )
      );
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      await onFileUpload(file);
    }
  };

  const toggleSourceExpand = (id: string) => {
    setExpandedSources((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-5">
      
      {/* Preset Test Queries Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
          <Sparkles className="w-4 h-4 text-indigo-600" />
          <span>Quick Verification Prompts:</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {presetQuestions.map((preset, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(preset.query)}
              disabled={isLoading || chunkCount === 0}
              className="text-left p-3 rounded-lg bg-slate-50 hover:bg-indigo-50/60 border border-slate-200 hover:border-indigo-200 transition group cursor-pointer disabled:opacity-50"
            >
              <div className="font-bold text-xs text-indigo-700 group-hover:text-indigo-800">
                {preset.label}
              </div>
              <p className="text-xs text-slate-700 font-medium line-clamp-1 mt-0.5">{preset.query}</p>
              <p className="text-[10px] text-slate-500 mt-1">{preset.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Main Chat Feed */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 shadow-2xs min-h-[420px] max-h-[580px] overflow-y-auto space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.sender === 'assistant' && (
              <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-2xs font-bold">
                <Bot className="w-4 h-4" />
              </div>
            )}

            <div
              className={`max-w-2xl rounded-xl p-4 text-xs sm:text-sm space-y-3 ${
                msg.sender === 'user'
                  ? 'bg-indigo-600 text-white rounded-tr-xs shadow-2xs'
                  : 'bg-slate-50 border border-slate-200 text-slate-800 rounded-tl-xs shadow-2xs'
              }`}
            >
              <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>

              {/* Verified / Unverified Status Badge */}
              {msg.data && (
                <div className="space-y-3 pt-3 border-t border-slate-200">
                  <div className="flex items-center justify-between">
                    {msg.data.verified ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Verified ✅ (All claims grounded)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Unverified ⚠️ (Contains missing coverage)
                      </span>
                    )}
                    <span className="text-[11px] font-medium text-slate-500">
                      Attempts: {msg.data.attempt_count} / 2
                    </span>
                  </div>

                  {/* Verifier Issues List */}
                  {msg.data.issues && msg.data.issues.length > 0 && (
                    <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1">
                      <div className="font-bold text-xs flex items-center gap-1 text-amber-800">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        Verifier Audit Feedback:
                      </div>
                      <ul className="list-disc list-inside space-y-0.5 text-xs text-amber-800">
                        {msg.data.issues.map((issue, idx) => (
                          <li key={idx}>{issue}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Expandable Source Chunks */}
                  {msg.data.sources && msg.data.sources.length > 0 && (
                    <div className="space-y-1">
                      <button
                        onClick={() => toggleSourceExpand(msg.id)}
                        className="flex items-center justify-between w-full text-xs font-semibold text-slate-600 hover:text-slate-900 transition py-1"
                      >
                        <span className="flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-indigo-600" />
                          Source Chunks ({msg.data.sources.length})
                        </span>
                        {expandedSources[msg.id] ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>

                      {expandedSources[msg.id] && (
                        <div className="space-y-2 pt-1">
                          {msg.data.sources.map((src, idx) => (
                            <div key={idx} className="p-3 rounded-lg bg-white border border-slate-200 text-xs space-y-1 shadow-2xs">
                              <div className="flex items-center justify-between font-bold text-indigo-700 text-xs">
                                <span>[#{idx + 1}] {src.source}</span>
                                <span className="text-slate-400 font-mono text-[11px]">pg. {src.page}</span>
                              </div>
                              <p className="text-xs text-slate-600 leading-relaxed">"{src.chunk_preview}"</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {msg.sender === 'user' && (
              <div className="w-8 h-8 rounded-lg bg-slate-800 text-white flex items-center justify-center shrink-0 font-bold text-xs shadow-2xs">
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Input Field & File Upload Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-3.5 shadow-2xs flex items-center gap-3">
        <label className="p-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition cursor-pointer shrink-0">
          <Upload className="w-4 h-4 text-indigo-600" />
          <input
            type="file"
            accept=".pdf,.txt"
            onChange={handleFileChange}
            disabled={isLoading}
            className="hidden"
          />
        </label>

        <input
          type="text"
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder={chunkCount > 0 ? "Ask a question about your uploaded documents..." : "Please upload a document or reload sample docs first..."}
          disabled={isLoading || chunkCount === 0}
          className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition disabled:opacity-50"
        />

        <button
          onClick={() => handleSend()}
          disabled={isLoading || !inputQuery.trim() || chunkCount === 0}
          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm shadow-2xs transition flex items-center gap-2 cursor-pointer disabled:opacity-50 shrink-0 uppercase tracking-wider"
        >
          {isLoading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          <span>Ask Sentinel</span>
        </button>
      </div>
    </div>
  );
};
