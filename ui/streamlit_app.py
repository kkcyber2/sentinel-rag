import streamlit as st
import requests
import json

st.set_page_config(
    page_title="Sentinel-RAG | Self-Verifying Document Q&A",
    page_icon="🛡️",
    layout="wide"
)

API_BASE_URL = st.sidebar.text_input("Backend API Base URL", value="http://localhost:8000")

st.title("🛡️ Sentinel-RAG: Self-Verifying Multi-Agent Document Q&A")
st.caption("Researcher Agent drafts answers ➔ Verifier Agent audits facts against source chunks")

# Sidebar - Health & Upload
st.sidebar.header("System Status & Ingestion")

try:
    health_resp = requests.get(f"{API_BASE_URL}/health", timeout=3)
    if health_resp.status_code == 200:
        hdata = health_resp.json()
        st.sidebar.success(f"Vector Store: {hdata['vector_store']['chunk_count']} chunks indexed")
        if hdata['ollama']['reachable']:
            st.sidebar.info(f"Ollama: Online ({hdata['ollama']['model']})")
        else:
            st.sidebar.warning("Ollama: Offline (Fallback Mode Active)")
    else:
        st.sidebar.error("API Status Error")
except Exception:
    st.sidebar.error("Cannot connect to FastAPI backend")

st.sidebar.subheader("📄 Upload Document")
uploaded_file = st.sidebar.file_uploader("Upload PDF or TXT document", type=["pdf", "txt"])
if uploaded_file is not None:
    if st.sidebar.button("Ingest Document"):
        with st.spinner("Chunking, embedding, and indexing..."):
            files = {"file": (uploaded_file.name, uploaded_file.getvalue(), uploaded_file.type)}
            try:
                res = requests.post(f"{API_BASE_URL}/upload", files=files)
                if res.status_code == 200:
                    data = res.json()
                    st.sidebar.success(f"Ingested {data['chunks_added']} chunks from {uploaded_file.name}")
                    st.rerun()
                else:
                    st.sidebar.error(res.json().get("detail", "Upload failed"))
            except Exception as e:
                st.sidebar.error(f"Upload error: {str(e)}")

# Main Content Interface
if "chat_history" not in st.session_state:
    st.session_state.chat_history = []

for msg in st.session_state.chat_history:
    with st.chat_message(msg["role"]):
        st.write(msg["content"])
        if "verified" in msg:
            if msg["verified"]:
                st.success("✅ Verified Answer (All claims grounded in source context)")
            else:
                st.warning("⚠️ Unverified Answer (Contains unconfirmed claims or missing coverage)")
                if msg.get("issues"):
                    with st.expander("Audit Issues Identified"):
                        for issue in msg["issues"]:
                            st.write(f"- {issue}")

        if msg.get("sources"):
            with st.expander("📚 Source Chunks Used"):
                for idx, src in enumerate(msg["sources"]):
                    st.markdown(f"**Chunk {idx+1}** ({src.get('source')} - Page {src.get('page', 1)})")
                    st.info(src.get("chunk_preview"))

user_query = st.chat_input("Ask a question about your ingested documents...")

if user_query:
    st.session_state.chat_history.append({"role": "user", "content": user_query})
    with st.chat_message("user"):
        st.write(user_query)

    with st.chat_message("assistant"):
        with st.spinner("Thinking... (Running Researcher draft + Verifier audit loop)"):
            try:
                resp = requests.post(
                    f"{API_BASE_URL}/ask",
                    json={"question": user_query},
                    timeout=30
                )
                if resp.status_code == 200:
                    data = resp.json()
                    answer = data["answer"]
                    verified = data["verified"]
                    sources = data["sources"]
                    issues = data["issues"]

                    st.write(answer)
                    if verified:
                        st.success("✅ Verified Answer")
                    else:
                        st.warning("⚠️ Unverified Answer")
                        if issues:
                            with st.expander("Audit Issues Identified"):
                                for issue in issues:
                                    st.write(f"- {issue}")

                    if sources:
                        with st.expander("📚 Source Chunks Used"):
                            for idx, src in enumerate(sources):
                                st.markdown(f"**Chunk {idx+1}** ({src.get('source')} - Page {src.get('page', 1)})")
                                st.info(src.get("chunk_preview"))

                    st.session_state.chat_history.append({
                        "role": "assistant",
                        "content": answer,
                        "verified": verified,
                        "sources": sources,
                        "issues": issues
                    })
                else:
                    err_msg = resp.json().get("detail", "Error processing request")
                    st.error(f"Error: {err_msg}")
            except Exception as e:
                st.error(f"Failed to reach server: {str(e)}")
