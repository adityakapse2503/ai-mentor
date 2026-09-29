import { useRef, useState } from 'react';
import { deleteDocument, uploadDocuments } from '../api.js';

export default function KnowledgePanel({ documents, setDocuments, onClose }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState(null);

  async function handleFiles(fileList) {
    const files = Array.from(fileList);
    if (!files.length) return;
    setUploading(true);
    setNotice(null);
    try {
      const { results, documents: docs } = await uploadDocuments(files);
      setDocuments(docs);
      const failed = results.filter((r) => !r.ok);
      setNotice(
        failed.length
          ? { type: 'error', text: failed.map((f) => `${f.name}: ${f.error}`).join('\n') }
          : { type: 'ok', text: `Indexed ${results.length} file(s).` }
      );
    } catch (err) {
      setNotice({ type: 'error', text: err.message });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function handleDelete(id) {
    setDocuments(await deleteDocument(id));
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h2 className="font-semibold text-slate-900">Knowledge base</h2>
        <button className="text-sm text-slate-500 md:hidden" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="p-4">
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.txt,.md"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <button
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFiles(e.dataTransfer.files);
          }}
          className="w-full rounded-xl border-2 border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-600 transition hover:border-indigo-400 hover:bg-indigo-50 disabled:cursor-wait disabled:opacity-60"
        >
          {uploading ? (
            <span className="flex flex-col items-center gap-2">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
              Indexing… the first run downloads the embedding model, so it can take a minute.
            </span>
          ) : (
            <>
              <span className="font-medium text-indigo-600">Click to upload</span> or drag and drop
              <br />
              <span className="text-xs text-slate-400">PDF, TXT or MD (text-based books)</span>
            </>
          )}
        </button>

        {notice && (
          <p
            className={`mt-3 whitespace-pre-line rounded-md px-3 py-2 text-xs ${
              notice.type === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
            }`}
          >
            {notice.text}
          </p>
        )}
      </div>

      <ul className="flex-1 space-y-2 overflow-y-auto px-4 pb-4">
        {documents.length === 0 && <li className="text-sm text-slate-400">No documents yet.</li>}
        {documents.map((d) => (
          <li key={d.id} className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-800" title={d.name}>
                {d.name}
              </p>
              <p className="text-xs text-slate-500">{d.chunkCount} chunks</p>
            </div>
            <button className="text-xs text-slate-400 hover:text-red-600" onClick={() => handleDelete(d.id)}>
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
