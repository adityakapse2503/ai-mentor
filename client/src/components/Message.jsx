import SourceList from './SourceList.jsx';

// Turns "[1]" markers in the answer into small citation badges.
function renderWithCitations(text) {
  return text.split(/(\[\d+\])/g).map((part, i) =>
    /^\[\d+\]$/.test(part) ? (
      <sup
        key={i}
        className="mx-0.5 rounded bg-indigo-100 px-1 py-0.5 text-[10px] font-semibold text-indigo-700"
      >
        {part.slice(1, -1)}
      </sup>
    ) : (
      part
    )
  );
}

export default function Message({ message }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-indigo-600 px-4 py-2.5 text-sm text-white shadow-sm">
          {message.content}
        </div>
      </div>
    );
  }

  const tone = message.isError
    ? 'border-red-200 bg-red-50'
    : message.grounded
    ? 'border-slate-200 bg-white'
    : 'border-amber-200 bg-amber-50';

  return (
    <div className="flex justify-start">
      <div className={`max-w-[90%] rounded-2xl rounded-bl-sm border px-4 py-3 shadow-sm ${tone}`}>
        {!message.grounded && !message.isError && (
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
            Not in knowledge base
          </p>
        )}
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
          {renderWithCitations(message.content)}
        </p>
        <SourceList sources={message.sources} />
      </div>
    </div>
  );
}
