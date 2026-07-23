export interface SourceChunk {
  id: string;
  text: string;
  metadata: {
    source: string;
    page?: number;
    chunk_index?: number;
  };
}

export interface VerificationResult {
  approved: boolean;
  issues: string[];
  reasoning: string;
}

export interface AuditTrailStep {
  step: 'retrieve' | 'research' | 'verify' | 'revise' | 'finalize';
  draft?: string;
  verification?: VerificationResult;
  attempt?: number;
  revised_draft?: string;
  status?: string;
}

export interface AskResponseData {
  answer: string;
  verified: boolean;
  sources: Array<{
    source: string;
    page: number;
    chunk_preview: string;
  }>;
  issues: string[];
  attempt_count: number;
  audit_trail: AuditTrailStep[];
}

export interface IngestedDocument {
  filename: string;
  chunks_added: number;
  date: string;
}

export interface SystemHealth {
  status: string;
  vector_store: {
    chunk_count: number;
  };
  ollama: {
    base_url: string;
    reachable: boolean;
    model: string;
  };
  gemini_fallback: boolean;
}

export interface TestCaseResult {
  id: string;
  name: string;
  type: 'grounding' | 'hallucination' | 'adversarial' | 'empty_state';
  passed: boolean;
  question: string;
  details: string;
  answer: string;
  verified: boolean;
  durationMs: number;
}
