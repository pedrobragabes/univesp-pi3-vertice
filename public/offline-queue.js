const DB_NAME = 'vertice-offline';
const STORE_NAME = 'outbox';
const DB_VERSION = 1;
const form = document.querySelector('[data-offline-form]');
const syncStatus = document.querySelector('[data-sync-status]');

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: 'client_id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(mode, operation) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const request = operation(transaction.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => reject(transaction.error);
  });
}

const queue = {
  put: (item) => withStore('readwrite', (store) => store.put(item)),
  all: () => withStore('readonly', (store) => store.getAll()),
  delete: (id) => withStore('readwrite', (store) => store.delete(id)),
  count: () => withStore('readonly', (store) => store.count()),
};

async function updateQueueBadge() {
  const count = await queue.count().catch(() => 0);
  for (const badge of document.querySelectorAll('[data-queue-count]')) badge.textContent = String(count);
}

function formPayload(target) {
  const data = new FormData(target);
  let clientId = data.get('client_id');
  if (!clientId) {
    clientId = crypto.randomUUID();
    target.elements.client_id.value = clientId;
  }
  return {
    client_id: clientId,
    titulo: data.get('titulo'), tipo: data.get('tipo'), local: data.get('local'),
    responsavel: data.get('responsavel'), latitude: data.get('latitude'), longitude: data.get('longitude'),
    observacoes: data.get('observacoes'), status: data.get('status'),
    itens: [...target.querySelectorAll('[data-check-item]')].map((section) => ({
      code: section.dataset.code,
      label: section.dataset.label,
      result: data.get(`resultado_${section.dataset.code}`),
      note: data.get(`observacao_${section.dataset.code}`),
    })),
  };
}

async function send(payload) {
  const response = await fetch('/api/inspecoes', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.errors?.join(' ') || data.error || 'Não foi possível enviar a inspeção.');
    error.validation = response.status === 422;
    throw error;
  }
  return data;
}

async function flushQueue() {
  if (!navigator.onLine) return;
  const pending = await queue.all().catch(() => []);
  for (const payload of pending) {
    try {
      await send(payload);
      await queue.delete(payload.client_id);
    } catch (error) {
      if (!error.validation) break;
    }
  }
  await updateQueueBadge();
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = formPayload(form);
  syncStatus.textContent = navigator.onLine ? 'Enviando inspeção…' : 'Salvando inspeção neste dispositivo…';
  try {
    if (!navigator.onLine) throw new TypeError('offline');
    const result = await send(payload);
    window.location.assign(`/inspecoes/${result.id}?criada=1`);
  } catch (error) {
    if (error.validation) {
      syncStatus.textContent = error.message;
      syncStatus.dataset.kind = 'error';
      return;
    }
    await queue.put(payload);
    await updateQueueBadge();
    syncStatus.textContent = 'Inspeção salva no dispositivo. Ela será enviada quando a conexão voltar.';
    syncStatus.dataset.kind = 'queued';
  }
});

window.addEventListener('online', flushQueue);
updateQueueBadge();
flushQueue();
