import express from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import * as pdfParseModule from "pdf-parse";
const pdfParse = (pdfParseModule as any).default || pdfParseModule;
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;

app.use(express.json());

// File upload configuration
const upload = multer({ storage: multer.memoryStorage() });

// Initialize Gemini Client server-side
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// In-Memory Vector Store for Express App (mirrors python app/vectorstore.py)
interface VectorChunk {
  id: string;
  text: string;
  metadata: {
    source: string;
    page: number;
    chunk_index: number;
  };
  vector?: Record<string, number>;
}

let memoryVectorStore: VectorChunk[] = [];

function tokenize(text: string): string[] {
  return text ? text.toLowerCase().match(/\w+/g) || [] : [];
}

function computeVector(text: string): Record<string, number> {
  const tokens = tokenize(text);
  if (!tokens.length) return {};
  const freq: Record<string, number> = {};
  for (const t of tokens) {
    freq[t] = (freq[t] || 0) + 1;
  }
  let sumSq = 0;
  for (const k in freq) {
    sumSq += freq[k] * freq[k];
  }
  const length = Math.sqrt(sumSq);
  if (length === 0) return {};
  const vec: Record<string, number> = {};
  for (const k in freq) {
    vec[k] = freq[k] / length;
  }
  return vec;
}

function cosineSimilarity(v1: Record<string, number>, v2: Record<string, number>): number {
  let score = 0;
  for (const k in v1) {
    if (v2[k]) {
      score += v1[k] * v2[k];
    }
  }
  return score;
}

function chunkText(text: string, chunkSize = 500, overlap = 75): string[] {
  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    if (!para.trim()) continue;
    if (current.length + para.length <= chunkSize) {
      current += (current ? "\n\n" : "") + para;
    } else {
      if (current.trim()) chunks.push(current.trim());
      if (para.length > chunkSize) {
        // Hard character split for large paragraphs
        let start = 0;
        while (start < para.length) {
          const end = Math.min(start + chunkSize, para.length);
          chunks.push(para.slice(start, end).trim());
          start += chunkSize - overlap;
        }
        current = "";
      } else {
        current = para;
      }
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

function addDocumentToStore(text: string, source: string): number {
  const rawChunks = chunkText(text);
  let added = 0;

  for (let i = 0; i < rawChunks.length; i++) {
    const chunkContent = rawChunks[i];
    if (!chunkContent.trim()) continue;
    
    memoryVectorStore.push({
      id: `chunk_${memoryVectorStore.length + 1}`,
      text: chunkContent,
      metadata: {
        source,
        page: 1,
        chunk_index: i + 1
      },
      vector: computeVector(chunkContent)
    });
    added++;
  }

  return added;
}

function searchVectorStore(query: string, topK = 4): VectorChunk[] {
  if (!memoryVectorStore.length) return [];
  const qVec = computeVector(query);
  if (!Object.keys(qVec).length) return memoryVectorStore.slice(0, topK);

  const scored = memoryVectorStore.map((chunk) => ({
    chunk,
    score: cosineSimilarity(qVec, chunk.vector || {})
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).map((s) => s.chunk);
}

// Pre-populate sample documents on server startup
function preloadSampleDocs() {
  const sampleDir = path.join(process.cwd(), "data", "sample_docs");
  if (fs.existsSync(sampleDir)) {
    const files = fs.readdirSync(sampleDir);
    for (const file of files) {
      if (file.endsWith(".txt") || file.endsWith(".pdf")) {
        const filePath = path.join(sampleDir, file);
        if (file.endsWith(".txt")) {
          const content = fs.readFileSync(filePath, "utf-8");
          addDocumentToStore(content, file);
        }
      }
    }
  }
}
preloadSampleDocs();

// API ROUTES

// GET /api/health
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    vector_store: {
      chunk_count: memoryVectorStore.length
    },
    ollama: {
      base_url: "http://localhost:11434",
      reachable: false,
      model: "llama3:latest"
    },
    gemini_fallback: true
  });
});

// GET /api/chunks
app.get("/api/chunks", (req, res) => {
  res.json({
    chunks: memoryVectorStore.map((c) => ({
      id: c.id,
      text: c.text,
      metadata: c.metadata
    }))
  });
});

// POST /api/reset
app.post("/api/reset", (req, res) => {
  memoryVectorStore = [];
  res.json({ status: "cleared", chunk_count: 0 });
});

// POST /api/ingest-sample
app.post("/api/ingest-sample", (req, res) => {
  memoryVectorStore = [];
  preloadSampleDocs();
  res.json({ status: "success", chunk_count: memoryVectorStore.length });
});

// POST /api/upload
app.post("/api/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded." });
      return;
    }

    const filename = req.file.originalname;
    let fileText = "";

    if (filename.toLowerCase().endsWith(".pdf")) {
      try {
        const parsed = await pdfParse(req.file.buffer);
        fileText = parsed.text;
      } catch (err) {
        fileText = req.file.buffer.toString("utf-8");
      }
    } else {
      fileText = req.file.buffer.toString("utf-8");
    }

    const added = addDocumentToStore(fileText, filename);
    res.json({
      status: "success",
      filename,
      chunks_added: added,
      total_chunks: memoryVectorStore.length
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to upload file." });
  }
});

// POST /api/ask (Main Multi-Agent Workflow)
app.post("/api/ask", async (req, res) => {
  try {
    const { question } = req.body;
    if (!question || !question.trim()) {
      res.status(400).json({ error: "Question cannot be empty." });
      return;
    }

    if (memoryVectorStore.length === 0) {
      res.status(400).json({
        error: "No documents ingested yet. Please upload a PDF or TXT document or preload sample docs first."
      });
      return;
    }

    // Node 1: RETRIEVE
    const retrievedChunks = searchVectorStore(question, 4);
    const auditTrail: any[] = [];
    auditTrail.push({
      step: "retrieve",
      status: "success",
      chunks_count: retrievedChunks.length
    });

    const formattedContext = retrievedChunks
      .map(
        (c, idx) =>
          `[Chunk ${idx + 1} | Source: ${c.metadata.source} Page: ${c.metadata.page}]\n${c.text}`
      )
      .join("\n\n");

    let draftAnswer = "";
    let attemptCount = 0;
    const maxAttempts = 2;
    let isApproved = false;
    let verificationIssues: string[] = [];
    let verificationReasoning = "";

    // Node 2: RESEARCH
    const researcherSystemPrompt = `You are the Sentinel-RAG Researcher Agent. Your task is to draft a clear, accurate answer to the user's question using ONLY the provided document context.
CRITICAL INSTRUCTIONS:
1. Rely strictly on the provided context chunks.
2. Do NOT hallucinate or assume facts not explicitly mentioned.
3. If something is not covered in the context, explicitly state that it is not mentioned.
4. Keep the answer professional and objective.`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: `DOCUMENT CONTEXT:\n${formattedContext}\n\nUSER QUESTION:\n${question}\n\nDraft Answer:`,
        config: {
          systemInstruction: researcherSystemPrompt,
          temperature: 0.1
        }
      });
      draftAnswer = response.text || "";
      } catch (err: any) {
        res.status(503).json({ error: "LLM Generation Error: Unable to communicate with model service." });
        return;
      }

    auditTrail.push({
      step: "research",
      draft: draftAnswer
    });

    // Node 3 & 4: VERIFY AND REVISE LOOP
    const verifierSystemPrompt = `You are the Sentinel-RAG Verifier Agent acting as an independent fact-checker.
Compare the draft answer against the retrieved document chunks.
Determine if every claim in the draft is directly supported by the context.
Return ONLY valid JSON with keys:
{
  "approved": boolean,
  "issues": string[],
  "reasoning": "brief explanation"
}`;

    while (attemptCount <= maxAttempts) {
      try {
        const verifyResponse = await ai.models.generateContent({
          model: "gemini-3.6-flash",
          contents: `SOURCE CONTEXT:\n${formattedContext}\n\nDRAFT ANSWER:\n${draftAnswer}\n\nOutput verification JSON:`,
          config: {
            systemInstruction: verifierSystemPrompt,
            responseMimeType: "application/json"
          }
        });

        const rawJson = verifyResponse.text || "{}";
        const parsed = JSON.parse(rawJson);
        isApproved = Boolean(parsed.approved);
        verificationIssues = Array.isArray(parsed.issues) ? parsed.issues : [];
        verificationReasoning = parsed.reasoning || "";
      } catch (err: any) {
        isApproved = false;
        verificationIssues = ["Verification service error: Unable to audit draft answer."];
        verificationReasoning = "Fact checking process encountered an error.";
      }

      auditTrail.push({
        step: "verify",
        attempt: attemptCount + 1,
        verification: {
          approved: isApproved,
          issues: verificationIssues,
          reasoning: verificationReasoning
        }
      });

      if (isApproved) {
        break;
      }

      if (attemptCount < maxAttempts) {
        attemptCount++;
        // NODE 4: REVISE
        const reviseSystemPrompt = `You are the Sentinel-RAG Researcher Agent in revision mode.
The Verifier rejected your previous draft because of unsupported claims.
Revise your answer to eliminate ALL unverified claims and strictly adhere to the source context.`;

        try {
          const reviseResponse = await ai.models.generateContent({
            model: "gemini-3.6-flash",
            contents: `SOURCE CONTEXT:\n${formattedContext}\n\nPREVIOUS DRAFT:\n${draftAnswer}\n\nVERIFIER ISSUES:\n${verificationIssues.join("\n")}\n\nCorrected Answer:`,
            config: {
              systemInstruction: reviseSystemPrompt,
              temperature: 0.1
            }
          });
          draftAnswer = reviseResponse.text || draftAnswer;
        } catch (e) {
          draftAnswer = `According to ${retrievedChunks[0].metadata.source}: ${retrievedChunks[0].text.slice(0, 250)}.`;
        }

        auditTrail.push({
          step: "revise",
          attempt: attemptCount,
          revised_draft: draftAnswer
        });
      } else {
        break;
      }
    }

    // Node 5: FINALIZE
    const formattedSources = retrievedChunks.map((c) => ({
      source: c.metadata.source,
      page: c.metadata.page,
      chunk_preview: c.text.length > 180 ? c.text.slice(0, 180) + "..." : c.text
    }));

    res.json({
      answer: draftAnswer,
      verified: isApproved,
      sources: formattedSources,
      issues: verificationIssues,
      attempt_count: attemptCount,
      audit_trail: auditTrail
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to process Q&A request." });
  }
});

// Start Express + Vite Server
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Sentinel-RAG Server listening at http://localhost:${PORT}`);
  });
}

startServer();
