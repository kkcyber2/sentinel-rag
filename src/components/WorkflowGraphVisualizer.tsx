import React from 'react';
import { Search, BrainCircuit, ShieldAlert, RotateCcw, CheckCircle2, Layers } from 'lucide-react';
import { AuditTrailStep } from '../types';

interface WorkflowGraphVisualizerProps {
  auditTrail?: AuditTrailStep[];
  isVerified?: boolean;
  attemptCount?: number;
}

export const WorkflowGraphVisualizer: React.FC<WorkflowGraphVisualizerProps> = ({
  auditTrail = [],
  isVerified,
  attemptCount = 0
}) => {
  const findStep = (stepName: string) => auditTrail.filter((a) => a.step === stepName);
  const researchStep = findStep('research')[0];
  const verifySteps = findStep('verify');
  const reviseSteps = findStep('revise');

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-6">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600" />
            LangGraph Agent Workflow Execution
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Deterministic state machine tracing Researcher draft, Verifier audit & revision loops
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold">
          <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-700 border border-slate-200">
            Attempts: {attemptCount} / 2
          </span>
          {isVerified !== undefined && (
            <span
              className={`px-2.5 py-1 rounded font-bold border ${
                isVerified
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              {isVerified ? '✅ Verified' : '⚠️ Unverified'}
            </span>
          )}
        </div>
      </div>

      {/* Nodes Diagram Flow */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
        
        {/* Node 1: Retrieve */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-center space-y-2">
          <div className="w-8 h-8 mx-auto rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold ring-4 ring-indigo-50 shadow-2xs">
            <Search className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-xs text-slate-800">1. Retrieve</h3>
          <p className="text-[10px] text-slate-500 font-medium">Top-k Cosine Search</p>
          <span className="inline-block text-[10px] px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold border border-indigo-100">
            {auditTrail.length > 0 ? '✓ Context Fetched' : 'Idle'}
          </span>
        </div>

        {/* Node 2: Research */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-center space-y-2">
          <div className="w-8 h-8 mx-auto rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold ring-4 ring-indigo-50 shadow-2xs">
            <BrainCircuit className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-xs text-slate-800">2. Research</h3>
          <p className="text-[10px] text-slate-500 font-medium">Draft Answer</p>
          <span className="inline-block text-[10px] px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold border border-indigo-100">
            {researchStep ? '✓ Drafted' : 'Idle'}
          </span>
        </div>

        {/* Node 3: Verify */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-center space-y-2">
          <div className="w-8 h-8 mx-auto rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold ring-4 ring-indigo-50 shadow-2xs">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-xs text-slate-800">3. Verify</h3>
          <p className="text-[10px] text-slate-500 font-medium">Factual Source Audit</p>
          <span className="inline-block text-[10px] px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold border border-indigo-100">
            {verifySteps.length > 0 ? `✓ Audited (${verifySteps.length}x)` : 'Idle'}
          </span>
        </div>

        {/* Node 4: Revise */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-center space-y-2">
          <div className="w-8 h-8 mx-auto rounded-full bg-white border-2 border-slate-300 text-slate-600 flex items-center justify-center text-xs font-bold">
            <RotateCcw className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-xs text-slate-800">4. Revise Loop</h3>
          <p className="text-[10px] text-slate-500 font-medium">Fix Issues</p>
          <span className="inline-block text-[10px] px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-bold border border-amber-200">
            {reviseSteps.length > 0 ? `Triggered (${reviseSteps.length}x)` : 'Passed'}
          </span>
        </div>

        {/* Node 5: Finalize */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-center space-y-2">
          <div className="w-8 h-8 mx-auto rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold ring-4 ring-emerald-50 shadow-2xs">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-xs text-slate-800">5. Finalize</h3>
          <p className="text-[10px] text-slate-500 font-medium">Attach Sources</p>
          <span className="inline-block text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
            {auditTrail.length > 0 ? '✓ Complete' : 'Idle'}
          </span>
        </div>

      </div>

      {/* Terminal State Audit Logs */}
      {auditTrail.length > 0 && (
        <div className="mt-6 bg-slate-900 rounded-xl p-4 flex flex-col font-mono text-xs leading-relaxed shadow-inner space-y-3">
          <div className="flex justify-between border-b border-slate-800 pb-2">
            <span className="text-indigo-400 font-bold uppercase tracking-wider text-[11px]">LangGraph Execution Trace</span>
            <span className="text-slate-500 text-[10px]">State Graph v1.0</span>
          </div>
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {auditTrail.map((step, idx) => (
              <div key={idx} className="p-2.5 rounded bg-slate-950/80 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-400 uppercase text-[11px]">
                    Step {idx + 1}: [{step.step}]
                  </span>
                  {step.attempt && <span className="text-[10px] text-amber-400 font-semibold">Attempt {step.attempt}</span>}
                </div>
                {step.draft && (
                  <p className="text-slate-300 text-[11px] line-clamp-2">Draft: "{step.draft}"</p>
                )}
                {step.verification && (
                  <div className="text-[11px]">
                    <span className={step.verification.approved ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                      Status: {step.verification.approved ? 'APPROVED ✓' : 'REJECTED ⚠️'}
                    </span>
                    {step.verification.reasoning && (
                      <p className="text-slate-400 mt-0.5">Reason: {step.verification.reasoning}</p>
                    )}
                  </div>
                )}
                {step.revised_draft && (
                  <p className="text-teal-300 text-[11px] line-clamp-2">Revised Draft: "{step.revised_draft}"</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
