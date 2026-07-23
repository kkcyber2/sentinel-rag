import React, { useState, useEffect } from 'react';
import { Database, Search, FileText, Hash, Trash2 } from 'lucide-react';

interface VectorInspectorProps {
  onResetStore: () => void;
}

interface ChunkData {
  id: string;
  text: string;
  metadata: {
    source: string;
    page: number;
    chunk_index: number;
  };
}

export const VectorInspector: React.FC<VectorInspectorProps> = ({ onResetStore }) => {
  const [chunks, setChunks] = useState<ChunkData[]>([]);
  const [filterQuery, setFilterQuery] = useState('');
  const [, setLoading] = useState(false);

  const fetchChunks = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/chunks');
      if (res.ok) {
        const data = await res.json();
        setChunks(data.chunks || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChunks();
  }, []);

  const filteredChunks = chunks.filter(
    (c) =>
      c.text.toLowerCase().includes(filterQuery.toLowerCase()) ||
      c.metadata.source.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-6">
      
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Database className="w-5 h-5 text-indigo-600" />
            Vector Database & Chunk Inspector (Chroma)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Explore indexed document chunks, source filenames, page numbers, and cosine embeddings
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs px-3 py-1 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold">
            {chunks.length} Total Chunks
          </span>
          <button
            onClick={() => {
              onResetStore();
              setChunks([]);
            }}
            className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear Store
          </button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
        <input
          type="text"
          value={filterQuery}
          onChange={(e) => setFilterQuery(e.target.value)}
          placeholder="Filter chunks by keyword or filename..."
          className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-10 pr-4 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
        />
      </div>

      {/* Chunks Cards List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-1">
        {filteredChunks.length === 0 ? (
          <div className="col-span-2 text-center py-12 text-slate-400 text-xs font-medium">
            No chunks found in vector store. Upload a document or click "Reload Samples".
          </div>
        ) : (
          filteredChunks.map((c) => (
            <div key={c.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 hover:border-indigo-300 transition shadow-2xs">
              <div className="flex items-center justify-between text-xs font-bold text-indigo-700 border-b border-slate-200 pb-2">
                <span className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  {c.metadata.source}
                </span>
                <span className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
                  <Hash className="w-3 h-3" />
                  pg. {c.metadata.page} | Chunk #{c.metadata.chunk_index}
                </span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed font-mono bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                {c.text}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
