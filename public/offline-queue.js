const DB_NAME = 'vertice-offline';
const STORE_NAME = 'outbox';
const form = document.querySelector('[data-offline-form]');
const syncStatus = document.querySelector('[data-sync-status]');
const queuePanel = document.querySelector('[data-local-queue]');
const queueList = document.querySelector('[data-local-queue-list]');
const queueStatus = document.querySelector('[data-local-queue-status]');
const editingLocalId = new URL(location.href).searchParams.get('local');
let syncing;
let submitting = false;

function openDatabase() {
  return new Promise((resolve, reject) => {
    let failed = false;
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: 'client_id' });
    };
    request.onblocked = () => { failed = true; reject(new Error('Armazenamento bloqueado.')); };
    request.onerror = () => { failed = true; reject(request.error); };
    request.onsuccess = () => {
      if (failed) request.result.close();
      else resolve(request.result);
    };
  });
}

async function withStore(mode, operation) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction(STORE_NAME, mode);
      const request = operation(transaction.objectStore(STORE_NAME));
      transaction.oncomplete = () => { db.close(); resolve(request.result); };
      const fail = () => { db.close(); reject(transaction.error || new Error('A gravação local foi interrompida.')); };
      transaction.onabort = fail;
      transaction.onerror = fail;
    } catch (error) { db.close(); reject(error); }
  });
}

function payloadOnly(item) {
  const { _failure, ...payload } = item;
  return payload;
}

const queue = {
  put: (item) => withStore('readwrite', (store) => store.put(item)),
  get: (id) => withStore('readonly', (store) => store.get(id)),
  all: () => withStore('readonly', (store) => store.getAll()),
  async changeIfUnchanged(payload, failure) {
    let changed = false;
    await withStore('readwrite', (store) => {
      const request = store.get(payload.client_id);
      request.addEventListener('success', () => {
        const current = request.result;
        if (!current) { changed = !failure; return; }
        if (JSON.stringify(payloadOnly(current)) !== JSON.stringify(payloadOnly(payload))) return;
        if (failure) store.put({ ...current, _failure: failure });
        else store.delete(payload.client_id);
        changed = true;
      });
      return request;
    });
    return changed;
  },
};

function setFormStatus(message, kind = '') {
  if (!syncStatus) return;
  syncStatus.textContent = message;
  syncStatus.dataset.kind = kind;
}

async function refreshQueue() {
  try {
    const items = await queue.all();
    document.querySelectorAll('[data-queue-count]').forEach((badge) => { badge.textContent = String(items.length); });
    if (!queuePanel) return;
    queuePanel.hidden = items.length === 0;
    queueStatus.textContent = navigator.onLine ? 'Confira as fichas que aguardam envio ou revisão.' : 'As fichas continuam neste dispositivo enquanto não há conexão.';
    queueList.replaceChildren();
    for (const item of items) {
      const row = document.createElement('li');
      const title = document.createElement('strong');
      title.textContent = String(item.titulo || 'Ficha sem título');
      const status = document.createElement('p');
      status.textContent = item._failure?.message || 'Aguardando sincronização.';
      const review = document.createElement('a');
      review.href = `/inspecoes/nova?local=${encodeURIComponent(item.client_id)}`;
      review.textContent = 'Revisar ficha';
      review.setAttribute('aria-label', `Revisar ficha: ${title.textContent}`);
      row.append(title, status, review);
      if (Number.isSafeInteger(item._failure?.serverId) && item._failure.serverId > 0) {
        const serverLink = document.createElement('a');
        serverLink.href = `/inspecoes/${item._failure.serverId}`;
        serverLink.textContent = 'Comparar com o servidor';
        row.append(document.createTextNode(' · '), serverLink);
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'button button-light';
        remove.textContent = 'Remover cópia local';
        remove.addEventListener('click', async () => {
          if (!confirm('Remover apenas a cópia local desta ficha? Confira o registro do servidor e exporte as alterações que quiser guardar.')) return;
          try {
            const removed = await queue.changeIfUnchanged(item);
            await refreshQueue();
            queuePanel.hidden = false;
            queueStatus.textContent = removed ? 'Cópia local removida. O registro do servidor foi preservado.' : 'A ficha mudou em outra página. A versão mais recente foi preservada.';
          } catch { queueStatus.textContent = 'Não foi possível remover a cópia local. Nenhum dado foi apagado.'; }
        });
        row.append(document.createTextNode(' · '), remove);
      }
      queueList.append(row);
    }
  } catch {
    document.querySelectorAll('[data-queue-count]').forEach((badge) => { badge.textContent = '?'; });
    if (queuePanel) {
      queuePanel.hidden = false;
      queueList.replaceChildren();
      queueStatus.textContent = 'Não foi possível acessar a fila neste dispositivo. Os dados não foram apagados.';
    }
  }
}

function formPayload(target) {
  const data = new FormData(target);
  const clientId = data.get('client_id') || crypto.randomUUID();
  target.elements.client_id.value = clientId;
  return {
    client_id: clientId,
    titulo: data.get('titulo'), tipo: data.get('tipo'), local: data.get('local'),
    responsavel: data.get('responsavel'), latitude: data.get('latitude'), longitude: data.get('longitude'),
    observacoes: data.get('observacoes'), status: data.get('status'),
    itens: [...target.querySelectorAll('[data-check-item]')].map((section) => ({
      code: section.dataset.code, label: section.dataset.label,
      result: data.get(`resultado_${section.dataset.code}`), note: data.get(`observacao_${section.dataset.code}`),
    })),
  };
}

async function send(item) {
  const payload = payloadOnly(item);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch('/api/inspecoes', {
      method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(payload), signal: controller.signal,
    });
    const data = await response.json();
    if (!response.ok) {
      const error = new Error(String(data.errors?.join(' ') || data.error || 'O servidor não confirmou o envio.').slice(0, 400));
      error.reviewRequired = response.status >= 400 && response.status < 500;
      if (Number.isSafeInteger(data.id) && data.id > 0) error.serverId = data.id;
      throw error;
    }
    if (!Number.isSafeInteger(data.id) || data.id <= 0 || data.item?.client_id !== payload.client_id) {
      throw new Error('O servidor não confirmou esta ficha. Ela permanece no dispositivo.');
    }
    return data;
  } finally { clearTimeout(timer); }
}

async function recordFailure(payload, error) {
  await queue.changeIfUnchanged(payload, {
    message: error.reviewRequired || error.confirmed ? error.message : 'Envio não confirmado. A ficha permanece no dispositivo.',
    reviewRequired: Boolean(error.reviewRequired), ...(error.serverId ? { serverId: error.serverId } : {}),
  }).catch(() => {});
}

function flushQueue(force = false) {
  if (syncing) return syncing;
  syncing = (async () => {
    if (!navigator.onLine) return;
    const pending = await queue.all();
    for (const item of pending) {
      if (!navigator.onLine) break;
      if (submitting && form?.elements.client_id.value === item.client_id) continue;
      if (item.client_id === editingLocalId) continue;
      if (!force && item._failure?.reviewRequired) continue;
      let confirmed;
      try {
        confirmed = await send(item);
        const removed = await queue.changeIfUnchanged(item);
        if (removed && form?.elements.client_id.value === item.client_id) {
          setFormStatus('Inspeção sincronizada. Confira o registro no servidor.', 'success');
          const link = document.createElement('a');
          link.href = `/inspecoes/${confirmed.id}`;
          link.textContent = ' Abrir ficha sincronizada';
          syncStatus.append(link);
        }
      } catch (error) {
        await recordFailure(item, confirmed ? {
          message: 'O servidor confirmou a ficha, mas a cópia local ainda não pôde ser removida.',
          confirmed: true, serverId: confirmed.id,
        } : error);
        if (!error.reviewRequired) break;
      }
    }
  })().catch(() => {}).finally(async () => { syncing = undefined; await refreshQueue(); });
  return syncing;
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (submitting) return;
  submitting = true;
  const payload = formPayload(form);
  const fields = [...form.querySelectorAll('input, select, textarea, button')].map((field) => [field, field.disabled]);
  fields.forEach(([field]) => { field.disabled = true; });
  let saved = false;
  let confirmed;
  try {
    setFormStatus('Salvando inspeção neste dispositivo…');
    await queue.put(payload);
    saved = true;
    if (!navigator.onLine) {
      setFormStatus('Inspeção salva no dispositivo. Ela será enviada quando a conexão voltar.', 'queued');
      return;
    }
    setFormStatus('Enviando inspeção…');
    const result = await send(payload);
    confirmed = result;
    if (await queue.changeIfUnchanged(payload)) window.location.assign(`/inspecoes/${result.id}?criada=1`);
    else setFormStatus('A ficha local mudou durante o envio. A versão mais recente continua na fila.', 'error');
  } catch (error) {
    if (!saved) setFormStatus('Não foi possível salvar neste dispositivo. Mantenha esta página aberta e tente novamente; os campos continuam preenchidos.', 'error');
    else {
      if (confirmed) {
        const message = 'O servidor confirmou a ficha, mas a fila local não pôde ser atualizada. A cópia foi preservada.';
        await recordFailure(payload, { message, confirmed: true, serverId: confirmed.id });
        setFormStatus(message, 'error');
      } else {
        await recordFailure(payload, error);
        setFormStatus(error.reviewRequired ? `${error.message} A ficha local foi preservada para revisão.` : 'O envio não foi confirmado. A ficha foi preservada no dispositivo para uma nova tentativa.', error.reviewRequired ? 'error' : 'queued');
      }
    }
  } finally {
    fields.forEach(([field, disabled]) => { field.disabled = disabled; });
    submitting = false;
    await refreshQueue();
  }
});

async function loadLocalInspection() {
  if (!form) return;
  const id = editingLocalId;
  if (!id) return;
  try {
    const item = await queue.get(id);
    if (!item) { setFormStatus('Esta ficha não está mais na fila deste dispositivo.', 'error'); return; }
    for (const name of ['client_id', 'titulo', 'tipo', 'local', 'responsavel', 'latitude', 'longitude', 'observacoes', 'status']) {
      form.elements.namedItem(name).value = item[name] ?? '';
    }
    for (const section of form.querySelectorAll('[data-check-item]')) {
      const check = Array.isArray(item.itens) ? item.itens.find((candidate) => candidate?.code === section.dataset.code) : undefined;
      form.elements.namedItem(`resultado_${section.dataset.code}`).value = check?.result ?? '';
      form.elements.namedItem(`observacao_${section.dataset.code}`).value = check?.note ?? '';
    }
    setFormStatus('Revise a ficha salva neste dispositivo antes de enviar.', 'queued');
  } catch { setFormStatus('Não foi possível abrir a ficha local. Nenhum dado foi apagado.', 'error'); }
}

document.querySelector('[data-queue-sync]')?.addEventListener('click', () => flushQueue(true));
document.querySelector('[data-queue-export]')?.addEventListener('click', async () => {
  try {
    const items = await queue.all();
    const url = URL.createObjectURL(new Blob([JSON.stringify({ format: 'vertice-outbox-v1', items }, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'vertice-fichas-locais.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    queueStatus.textContent = 'Exportação preparada. O arquivo contém os dados das fichas; guarde-o em local privado.';
  } catch { queueStatus.textContent = 'Não foi possível exportar a fila. Nenhum dado foi apagado.'; }
});
window.addEventListener('online', () => flushQueue());
window.addEventListener('focus', () => refreshQueue());
loadLocalInspection().then(() => { refreshQueue(); flushQueue(); });
