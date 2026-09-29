import { useState } from 'react';

export default function SourceList({ sources }) {
  const [open, setOpen] = useState(null);
  if (!sources?.length) return null;

  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Sources</p>
      <ul className="space-y-1.5">
        {sources.map((s) => (
          <li key={s.n}>
            <button
              onClick={() => setOpen(open === s.n ? null : s.n)}
              className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-slate-50"
            >
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded bg-indigo-100 text-[10px] font-semibold text-indigo-700">
                {s.n}
              </span>
              <span className="flex-1 text-slate-700">
                <span className="font-medium">{s.docName}</span> · {s.chapter}
                {s.page ? ` · p. ${s.page}` : ''}
                <span className="ml-2 text-slate-400">match {Math.round(s.score * 100)}%</span>
              </span>
              <span className="text-slate-400">{open === s.n ? '−' : '+'}</span>
            </button>
            {open === s.n && (
              <blockquote className="ml-8 mt-1 rounded-md border-l-2 border-indigo-300 bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
                {s.text}
              </blockquote>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
