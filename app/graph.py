import json
import re
import logging
from typing import Dict, Any, List, TypedDict, Optional

from langgraph.graph import StateGraph, END

try:
    from langchain_ollama import ChatOllama
except ImportError:
    from langchain_community.chat_models import ChatOllama

try:
    from langchain_google_genai import ChatGoogleGenerativeAI
except ImportError:
    ChatGoogleGenerativeAI = None

from app.config import OLLAMA_BASE_URL, OLLAMA_MODEL, GEMINI_API_KEY, MAX_REVISION_ATTEMPTS
from app.vectorstore import vector_store

logger = logging.getLogger("sentinel.graph")

class GraphState(TypedDict):
    question: str
    retrieved_chunks: List[Dict[str, Any]]
    draft_answer: str
    verification_result: Dict[str, Any]
    final_answer: str
    attempt_count: int
    verified: bool
    audit_trail: List[Dict[str, Any]]

def get_llm():
    """
    Instantiates LangChain LLM chat instance (ChatOllama or ChatGoogleGenerativeAI).
    Fails loudly with a RuntimeError if neither service is available.
    """
    # 1. Primary: Local ChatOllama
    try:
        llm = ChatOllama(
            model=OLLAMA_MODEL,
            base_url=OLLAMA_BASE_URL,
            temperature=0.1
        )
        return llm, "Ollama"
    except Exception as e:
        logger.warning(f"Failed to initialize ChatOllama: {e}")

    # 2. Cloud Fallback: ChatGoogleGenerativeAI (only if GEMINI_API_KEY is present)
    if GEMINI_API_KEY and ChatGoogleGenerativeAI is not None:
        try:
            llm = ChatGoogleGenerativeAI(
                model="gemini-2.5-flash",
                google_api_key=GEMINI_API_KEY,
                temperature=0.1
            )
            return llm, "Gemini"
        except Exception as e:
            logger.warning(f"Failed to initialize ChatGoogleGenerativeAI: {e}")

    raise RuntimeError(
        f"LLM Service Unavailable: Ollama model '{OLLAMA_MODEL}' at {OLLAMA_BASE_URL} "
        "is unreachable and no valid GEMINI_API_KEY is configured."
    )

def invoke_llm(system_prompt: str, user_prompt: str) -> str:
    """
    Executes LangChain model call using ChatOllama or ChatGoogleGenerativeAI.
    """
    llm, provider = get_llm()
    messages = [
        ("system", system_prompt),
        ("human", user_prompt)
    ]
    
    try:
        response = llm.invoke(messages)
        content = response.content
        if isinstance(content, list):
            content = "".join([str(c) for c in content])
        logger.info(f"LLM response received from provider: {provider}")
        return str(content)
    except Exception as e:
        # Retry with Gemini if Ollama invoke failed at runtime
        if provider == "Ollama" and GEMINI_API_KEY and ChatGoogleGenerativeAI is not None:
            try:
                gemini_llm = ChatGoogleGenerativeAI(
                    model="gemini-2.5-flash",
                    google_api_key=GEMINI_API_KEY,
                    temperature=0.1
                )
                res = gemini_llm.invoke(messages)
                return str(res.content)
            except Exception as ge:
                raise RuntimeError(f"All LLM providers failed. Primary Ollama error: {e}, Gemini error: {ge}")
        raise RuntimeError(f"LLM execution failed using provider '{provider}': {str(e)}")

def parse_verifier_json(raw_text: str) -> Dict[str, Any]:
    """
    Parses verifier response into structured audit result:
    {"approved": bool, "issues": list[str], "reasoning": str}
    """
    json_match = re.search(r'\{.*\}', raw_text, re.DOTALL)
    if json_match:
        try:
            parsed = json.loads(json_match.group(0))
            approved = bool(parsed.get("approved", False))
            issues = parsed.get("issues", [])
            if isinstance(issues, str):
                issues = [issues] if issues else []
            reasoning = str(parsed.get("reasoning", ""))
            return {"approved": approved, "issues": issues, "reasoning": reasoning}
        except Exception:
            pass

    lower = raw_text.lower()
    if "approved" in lower or "verified: true" in lower or "✅" in raw_text:
        return {"approved": True, "issues": [], "reasoning": raw_text}
    else:
        issues = []
        if "unsupported" in lower or "missing" in lower or "not covered" in lower:
            issues.append("Contains claims not explicitly supported by retrieved context.")
        return {
            "approved": False,
            "issues": issues or ["Draft answer contains unverified details."],
            "reasoning": raw_text
        }

# ============================================================================
# LANGGRAPH NODE IMPLEMENTATIONS
# ============================================================================

def node_retrieve(state: GraphState) -> Dict[str, Any]:
    question = state["question"]
    chunks = vector_store.search(question)
    
    audit_entry = {
        "step": "retrieve",
        "chunks_count": len(chunks)
    }
    
    return {
        "retrieved_chunks": chunks,
        "audit_trail": state.get("audit_trail", []) + [audit_entry]
    }

def node_research(state: GraphState) -> Dict[str, Any]:
    chunks = state["retrieved_chunks"]
    question = state["question"]
    
    if not chunks:
        answer = "I could not find any relevant documents in the repository to answer your question."
        return {
            "draft_answer": answer,
            "final_answer": answer,
            "verified": False,
            "verification_result": {
                "approved": False,
                "issues": ["No document context retrieved."],
                "reasoning": "Vector database contains no matching chunks."
            },
            "audit_trail": state.get("audit_trail", []) + [{"step": "research", "draft": answer}]
        }

    formatted_context = "\n\n".join([
        f"[Chunk {idx+1} | Source: {c['metadata'].get('source')} Page {c['metadata'].get('page', 1)}]\n{c['text']}"
        for idx, c in enumerate(chunks)
    ])

    researcher_system_prompt = (
        "You are the Sentinel-RAG Researcher Agent. Your task is to draft a clear, accurate "
        "answer to the user's question using ONLY the provided document context.\n"
        "CRITICAL INSTRUCTIONS:\n"
        "1. Rely strictly on the provided context chunks.\n"
        "2. Do NOT hallucinate or assume facts not explicitly mentioned.\n"
        "3. If something is not mentioned in the context, explicitly state that it is not covered.\n"
        "4. Keep the answer professional and objective."
    )
    researcher_user_prompt = f"DOCUMENT CONTEXT:\n{formatted_context}\n\nQUESTION:\n{question}\n\nDraft Answer:"

    draft = invoke_llm(researcher_system_prompt, researcher_user_prompt)

    return {
        "draft_answer": draft,
        "audit_trail": state.get("audit_trail", []) + [{"step": "research", "draft": draft}]
    }

def node_verify(state: GraphState) -> Dict[str, Any]:
    chunks = state["retrieved_chunks"]
    draft = state["draft_answer"]
    attempt_count = state.get("attempt_count", 0)

    if not chunks:
        return {
            "verified": False,
            "verification_result": {"approved": False, "issues": ["No document context retrieved."], "reasoning": "Vector database contains no matching chunks."}
        }

    formatted_context = "\n\n".join([
        f"[Chunk {idx+1} | Source: {c['metadata'].get('source')} Page {c['metadata'].get('page', 1)}]\n{c['text']}"
        for idx, c in enumerate(chunks)
    ])

    verifier_system_prompt = (
        "You are the Sentinel-RAG Verifier Agent. Act as a strict, independent fact-checker. "
        "Your sole job is to compare the draft answer against the retrieved document chunks.\n"
        "INSTRUCTIONS:\n"
        "- Verify that EVERY claim in the draft answer is directly supported by the context.\n"
        "- If the draft answer makes unsupported claims, flag them as issues.\n"
        "- If the draft correctly admits information is missing, that is APPROVED.\n"
        "- Return strictly valid JSON format with keys:\n"
        '{"approved": true/false, "issues": ["issue1", ...], "reasoning": "brief explanation"}'
    )
    verifier_user_prompt = f"SOURCE CHUNKS:\n{formatted_context}\n\nDRAFT ANSWER:\n{draft}\n\nVerify and output JSON:"

    raw_verification = invoke_llm(verifier_system_prompt, verifier_user_prompt)
    v_result = parse_verifier_json(raw_verification)
    is_approved = v_result["approved"]

    audit_entry = {
        "step": "verify",
        "attempt": attempt_count + 1,
        "verification": v_result
    }

    return {
        "verification_result": v_result,
        "verified": is_approved,
        "final_answer": draft if is_approved else state.get("final_answer", draft),
        "audit_trail": state.get("audit_trail", []) + [audit_entry]
    }

def node_revise(state: GraphState) -> Dict[str, Any]:
    chunks = state["retrieved_chunks"]
    previous_draft = state["draft_answer"]
    issues = state.get("verification_result", {}).get("issues", [])
    current_attempt = state.get("attempt_count", 0) + 1

    formatted_context = "\n\n".join([
        f"[Chunk {idx+1} | Source: {c['metadata'].get('source')} Page {c['metadata'].get('page', 1)}]\n{c['text']}"
        for idx, c in enumerate(chunks)
    ])
    issues_text = "\n".join(issues)

    revise_system_prompt = (
        "You are the Sentinel-RAG Researcher Agent in revision mode. "
        "The Verifier rejected your previous draft because of unsupported claims. "
        "Revise the answer to eliminate ALL unverified claims and strictly adhere to the context."
    )
    revise_user_prompt = (
        f"SOURCE CONTEXT:\n{formatted_context}\n\n"
        f"PREVIOUS DRAFT:\n{previous_draft}\n\n"
        f"VERIFIER ISSUES:\n{issues_text}\n\n"
        "Corrected Answer:"
    )

    revised_draft = invoke_llm(revise_system_prompt, revise_user_prompt)

    audit_entry = {
        "step": "revise",
        "attempt": current_attempt,
        "revised_draft": revised_draft
    }

    return {
        "draft_answer": revised_draft,
        "attempt_count": current_attempt,
        "audit_trail": state.get("audit_trail", []) + [audit_entry]
    }

def node_finalize(state: GraphState) -> Dict[str, Any]:
    final_ans = state.get("final_answer") or state.get("draft_answer") or ""
    return {
        "final_answer": final_ans
    }

# ============================================================================
# LANGGRAPH CONDITIONAL EDGE & WORKFLOW COMPILED GRAPH
# ============================================================================

def route_after_verify(state: GraphState) -> str:
    """
    Conditional edge router:
    If verified or max attempts reached -> finalize
    Otherwise -> revise
    """
    if state.get("verified", False) or state.get("attempt_count", 0) >= MAX_REVISION_ATTEMPTS:
        return "finalize"
    # Nothing was retrieved, so there is nothing to revise against. Sending this
    # to the revise node tried to answer from an empty context and raised when
    # the model was unreachable, turning a "no documents" result into a crash.
    if not state.get("retrieved_chunks"):
        return "finalize"
    return "revise"

# Build LangGraph StateGraph
workflow = StateGraph(GraphState)

workflow.add_node("retrieve", node_retrieve)
workflow.add_node("research", node_research)
workflow.add_node("verify", node_verify)
workflow.add_node("revise", node_revise)
workflow.add_node("finalize", node_finalize)

workflow.set_entry_point("retrieve")
workflow.add_edge("retrieve", "research")
workflow.add_edge("research", "verify")
workflow.add_conditional_edges("verify", route_after_verify, {
    "revise": "revise",
    "finalize": "finalize"
})
workflow.add_edge("revise", "verify")
workflow.add_edge("finalize", END)

# Compile LangGraph state machine executable
graph = workflow.compile()

def run_sentinel_workflow(question: str) -> Dict[str, Any]:
    """
    Executes compiled LangGraph state machine for user question.
    """
    initial_state: GraphState = {
        "question": question,
        "retrieved_chunks": [],
        "draft_answer": "",
        "verification_result": {"approved": False, "issues": [], "reasoning": ""},
        "final_answer": "",
        "attempt_count": 0,
        "verified": False,
        "audit_trail": []
    }

    final_state = graph.invoke(initial_state)

    retrieved = final_state.get("retrieved_chunks", [])
    sources_formatted = [
        {
            "source": chunk["metadata"].get("source", "Unknown"),
            "page": chunk["metadata"].get("page", 1),
            "chunk_preview": chunk["text"][:150] + ("..." if len(chunk["text"]) > 150 else "")
        }
        for chunk in retrieved
    ]

    return {
        "answer": final_state.get("final_answer", ""),
        "verified": final_state.get("verified", False),
        "sources": sources_formatted,
        "issues": final_state.get("verification_result", {}).get("issues", []),
        "attempt_count": final_state.get("attempt_count", 0),
        "audit_trail": final_state.get("audit_trail", [])
    }
