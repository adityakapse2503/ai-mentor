const API = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

async function handle(res) {
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }

  return data;
}

export const getHealth = () =>
  fetch(`${API}/api/health`).then(handle);

export const getDocuments = () =>
  fetch(`${API}/api/documents`).then(handle);

export const uploadDocuments = (files) => {
  const form = new FormData();

  files.forEach((file) => {
    form.append('files', file);
  });

  return fetch(`${API}/api/documents`, {
    method: 'POST',
    body: form,
  }).then(handle);
};

export const deleteDocument = (id) =>
  fetch(`${API}/api/documents/${id}`, {
    method: 'DELETE',
  }).then(handle);

export const sendChat = (messages) =>
  fetch(`${API}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: messages.map(({ role, content }) => ({
        role,
        content,
      })),
    }),
  }).then(handle);