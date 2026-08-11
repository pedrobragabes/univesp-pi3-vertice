import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../src/app.js';
import { createDatabase } from '../src/database.js';

function payload(overrides = {}) {
  return {
    client_id: 'device-test-001',
    titulo: 'Vistoria do acesso lateral',
    tipo: 'Vistoria de acessibilidade',
    local: 'Centro de testes - acesso lateral',
    responsavel: 'Pessoa Teste',
    latitude: '-23.550520',
    longitude: '-46.633308',
    observacoes: 'Registro automatizado sem dados pessoais reais.',
    status: 'Enviada',
    itens: [
      { code: 'acesso', label: 'Acesso e circulação', result: 'Atenção', note: 'Desnível de demonstração.' },
      { code: 'sinalizacao', label: 'Sinalização e orientação', result: 'Conforme', note: '' },
      { code: 'iluminacao', label: 'Iluminação do percurso', result: 'Conforme', note: '' },
      { code: 'conservacao', label: 'Conservação do espaço', result: 'Não se aplica', note: '' },
    ],
    ...overrides,
  };
}

async function withServer(run, { seed = false } = {}) {
  const database = createDatabase({ filename: ':memory:', seed });
  const server = createApp({ database }).listen(0);
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try { await run({ baseUrl, database }); }
  finally { await new Promise((resolve) => server.close(resolve)); database.close(); }
}

test('health check confirma disponibilidade do servico', () => withServer(async ({ baseUrl }) => {
  const response = await fetch(`${baseUrl}/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok', service: 'vertice' });
}));

test('painel apresenta propósito e indicadores', () => withServer(async ({ baseUrl }) => {
  const response = await fetch(baseUrl);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Observe/);
  assert.match(html, /Registre/);
  assert.match(response.headers.get('content-security-policy'), /worker-src 'self'/);
}));

test('API cria, consulta e atualiza inspeção', () => withServer(async ({ baseUrl }) => {
  const created = await fetch(`${baseUrl}/api/inspecoes`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload()),
  });
  assert.equal(created.status, 201);
  const creation = await created.json();
  assert.equal(creation.item.items.length, 4);
  assert.equal(creation.item.latitude, -23.55052);

  const detail = await fetch(`${baseUrl}/api/inspecoes/${creation.id}`);
  assert.equal(detail.status, 200);
  assert.equal((await detail.json()).item.titulo, 'Vistoria do acesso lateral');

  const updated = await fetch(`${baseUrl}/api/inspecoes/${creation.id}/status`, {
    method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'Concluída' }),
  });
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).item.status, 'Concluída');
}));

test('client_id torna sincronização idempotente', () => withServer(async ({ baseUrl, database }) => {
  const options = { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload()) };
  const first = await fetch(`${baseUrl}/api/inspecoes`, options);
  const second = await fetch(`${baseUrl}/api/inspecoes`, options);
  assert.equal(first.status, 201);
  assert.equal(second.status, 200);
  assert.equal((await first.json()).id, (await second.json()).id);
  assert.equal(database.indicators().total, 1);
}));

test('API rejeita checklist incompleto e coordenada inválida', () => withServer(async ({ baseUrl, database }) => {
  const response = await fetch(`${baseUrl}/api/inspecoes`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload({ latitude: '200', itens: payload().itens.slice(0, 2) })),
  });
  assert.equal(response.status, 422);
  const data = await response.json();
  assert.ok(data.errors.some((error) => error.includes('coordenadas')));
  assert.ok(data.errors.some((error) => error.includes('checklist')));
  assert.equal(database.indicators().total, 0);
}));

test('listagem filtra registros e expõe alertas', () => withServer(async ({ baseUrl }) => {
  const response = await fetch(`${baseUrl}/api/inspecoes?status=Enviada&busca=entrada`);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.items.length, 1);
  assert.equal(data.items[0].alertas, 2);
}, { seed: true }));

test('PWA publica manifest, service worker e fallback offline', () => withServer(async ({ baseUrl }) => {
  const manifest = await fetch(`${baseUrl}/manifest.webmanifest`);
  assert.equal(manifest.status, 200);
  assert.equal((await manifest.json()).display, 'standalone');
  const worker = await fetch(`${baseUrl}/service-worker.js`);
  assert.match(await worker.text(), /vertice-shell-v2/);
  const offline = await fetch(`${baseUrl}/offline`);
  assert.match(await offline.text(), /A rede saiu de campo/);
}));

test('escrita entre sites é bloqueada', () => withServer(async ({ baseUrl, database }) => {
  const response = await fetch(`${baseUrl}/api/inspecoes`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'sec-fetch-site': 'cross-site' }, body: JSON.stringify(payload()),
  });
  assert.equal(response.status, 403);
  assert.equal(database.indicators().total, 0);
}));
