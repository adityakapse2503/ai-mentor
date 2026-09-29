import { useEffect, useRef, useState } from 'react';
import Message from './Message.jsx';

const SUGGESTIONS = [
  'What are the main ideas in these books?',
  'What practical advice do the authors give?',
  'How should I deal with a difficult situation?',
];

export default function ChatWindow({ messages, loading, hasDocuments, onSend }) {
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  function submit(text = input) {
    const value = text.trim();
    if (!value || loading || !hasDocuments) return;
    setInput('');
    onSend(value);
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {messages.length === 0 && (
            <div className="mt-16 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 text-2xl">
                🎓
              </div>
              <h2 className="text-xl font-semibold text-slate-900">Ask your mentor</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                {hasDocuments
                  ? 'Every answer comes only from your uploaded books, with sources you can check.'
                  : 'Upload one or more books in the Library panel to get started.'}
              </p>
              {hasDocuments && (
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => submit(s)}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:border-indigo-300 hover:text-indigo-700"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {messages.map((m, i) => (
            <Message key={i} message={m} />
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="flex gap-1 rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-4 py-3">
                {[0, 150, 300].map((d) => (
                  <span
                    key={d}
                    className="h-2 w-2 animate-bounce rounded-full bg-slate-400"
                    style={{ animationDelay: `${d}ms` }}
                  />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="border-t border-slate-200 bg-white p-4">
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <textarea
            rows={1}
            value={input}
            disabled={!hasDocuments}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={hasDocuments ? 'Ask your mentor…' : 'Upload a document first'}
            className="max-h-40 flex-1 resize-none rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100"
          />
          <button
            onClick={() => submit()}
            disabled={!input.trim() || loading || !hasDocuments}
            className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </div>
    </>
  );
}
