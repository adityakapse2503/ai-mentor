import { useEffect, useState } from 'react';
import KnowledgePanel from './components/KnowledgePanel.jsx';
import ChatWindow from './components/ChatWindow.jsx';
import { getDocuments, getHealth, sendChat } from './api.js';

export default function App() {
  const [documents, setDocuments] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    Promise.all([getDocuments(), getHealth()])
      .then(([docs, health]) => {
        setDocuments(docs);
        // if (!health.hasApiKey) setServerError('ANTHROPIC_API_KEY is missing in server/.env. Add it and restart the server.');
        // if (!health.hasApiKey) setServerError('Test mode: no ANTHROPIC_API_KEY, so chat shows retrieved passages only.');
        if (!health.hasApiKey) setServerError('Test mode: no LLM key set in server/.env, so chat shows retrieved passages only.');
      })
      .catch(() => setServerError('Cannot reach the server. Is it running on port 8787?'));
  }, []);

  async function handleSend(text) {
    const next = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setLoading(true);
    try {
      const res = await sendChat(next);
      setMessages([...next, { role: 'assistant', content: res.answer, grounded: res.grounded, sources: res.sources }]);
    } catch (err) {
      setMessages([...next, { role: 'assistant', content: err.message, grounded: false, sources: [], isError: true }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside
        className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} fixed inset-y-0 left-0 z-20 w-80 border-r border-slate-200 bg-white transition-transform md:static md:translate-x-0`}
      >
        <KnowledgePanel documents={documents} setDocuments={setDocuments} onClose={() => setSidebarOpen(false)} />
      </aside>
      {sidebarOpen && <div className="fixed inset-0 z-10 bg-black/30 md:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Chat */}
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
          <button
            className="rounded-md border border-slate-200 px-2 py-1 text-sm md:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            Library
          </button>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">AI Mentor</h1>
            <p className="text-xs text-slate-500">Answers only from your uploaded knowledge base</p>
          </div>
          {messages.length > 0 && (
            <button className="ml-auto text-sm text-slate-500 hover:text-slate-800" onClick={() => setMessages([])}>
              New chat
            </button>
          )}
        </header>

        {serverError && <div className="bg-amber-50 px-4 py-2 text-sm text-amber-800">{serverError}</div>}

        <ChatWindow
          messages={messages}
          loading={loading}
          hasDocuments={documents.length > 0}
          onSend={handleSend}
        />
      </main>
    </div>
  );
}
