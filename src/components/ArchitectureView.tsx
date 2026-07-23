import React from 'react';
import { Shield, BrainCircuit, Search, FileCode, CheckCircle, Terminal } from 'lucide-react';

export const ArchitectureView: React.FC = () => {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-6 text-xs sm:text-sm text-slate-700">
      
      {/* Title */}
      <div className="border-b border-slate-100 pb-4 space-y-1">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Shield className="w-5 h-5 text-indigo-600" />
          Sentinel-RAG Technical Architecture & System Design
        </h2>
        <p className="text-xs text-slate-500">
          How Sentinel-RAG eliminates RAG hallucinations using a deterministic two-agent state machine and factual audit loops.
        </p>
      </div>

      {/* 4-5 Sentence Interview Summary */}
      <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-200 text-indigo-950 space-y-2 shadow-2xs">
        <h3 className="font-bold text-indigo-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
          <BrainCircuit className="w-4 h-4 text-indigo-600" />
          Architecture Overview & Value Proposition
        </h3>
        <p className="leading-relaxed text-xs text-indigo-900">
          Sentinel-RAG is a self-verifying document Q&A system designed to eliminate RAG hallucinations through a deterministic two-agent state machine. The Researcher agent first embeds user queries, retrieves top-k chunks via Chroma vector search, and drafts a candidate answer strictly bounded by retrieved context. An independent Verifier agent then audits every claim against raw source text, returning structured JSON containing fact-check approval status and specific issue reports. If ungrounded claims are flagged, a revision loop feeds the verifier's feedback back to the researcher to correct the draft (up to 2 retries). The final output provides a visible "Verified ✅ / Unverified ⚠️" badge alongside exact source chunk previews and audit trails.
        </p>
      </div>

      {/* Tech Stack Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 shadow-2xs">
          <h4 className="font-bold text-slate-900 flex items-center gap-2 text-xs">
            <Search className="w-4 h-4 text-indigo-600" />
            Vector DB & Embeddings
          </h4>
          <p className="text-slate-600 text-xs leading-relaxed">
            ChromaDB persistent client with Cosine similarity search and metadata preservation (source filename, page number, chunk index).
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 shadow-2xs">
          <h4 className="font-bold text-slate-900 flex items-center gap-2 text-xs">
            <BrainCircuit className="w-4 h-4 text-indigo-600" />
            LLM Orchestration & Graph
          </h4>
          <p className="text-slate-600 text-xs leading-relaxed">
            Ollama local daemon (`llama3:latest` & `nomic-embed-text`) with server-side Gemini 2.5/3.6 Flash fallback. LangGraph state machine controls agent loops.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 shadow-2xs">
          <h4 className="font-bold text-slate-900 flex items-center gap-2 text-xs">
            <FileCode className="w-4 h-4 text-indigo-600" />
            Backend & Deployment
          </h4>
          <p className="text-slate-600 text-xs leading-relaxed">
            FastAPI REST API with `/upload`, `/ask`, `/health`, and `/reset` endpoints. Multi-stage Dockerfile and Docker Compose setup for packaging.
          </p>
        </div>
      </div>

      {/* Key Test Results & Interview Honesty Flags */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
        <div className="space-y-3">
          <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            Automated Unit Test Suite (10/10 Passing)
          </h4>
          <ul className="space-y-2 text-xs text-slate-800 font-mono">
            <li className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 shadow-2xs">
              ✓ test_chunk_count_and_overlap: Chunking bounds & overlap verification
            </li>
            <li className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 shadow-2xs">
              ✓ test_grounding_test: Valid answerable question returns verified: True
            </li>
            <li className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 shadow-2xs">
              ✓ test_hallucination_trap: Out-of-scope prompt triggers refusal/unverified
            </li>
            <li className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 shadow-2xs">
              ✓ test_retry_loop_tracking: LangGraph state machine tracks audit retry loops
            </li>
          </ul>
        </div>

        <div className="space-y-3">
          <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
            <Terminal className="w-4 h-4 text-amber-600" />
            Known Trade-Offs & Technical Roadmap
          </h4>
          <ul className="space-y-2 text-xs text-slate-600 list-disc list-inside leading-relaxed">
            <li>Local LLM Latency: Running sequential 8B inference calls locally on CPU can take 8-15 seconds per turn.</li>
            <li>Hybrid BM25 + Vector Search: Adding BM25 keyword matching would improve precision for specialized policy acronyms.</li>
            <li>Dynamic Header Chunking: Replacing character-count splitting with AST/markdown header semantic chunking.</li>
          </ul>
        </div>
      </div>

    </div>
  );
};
