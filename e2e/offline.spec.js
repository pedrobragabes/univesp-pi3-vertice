import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile, writeFile } from 'node:fs/promises';

test.beforeEach(async ({ page }) => { await page.emulateMedia({ reducedMotion: 'reduce' }); });

async function fillForm(page, title) {
  await page.getByLabel('Título da inspeção').fill(title);
  await page.getByLabel('Tipo', { exact: true }).selectOption('Zeladoria');
  await page.getByLabel('Local', { exact: true }).fill('Espaço sintético de teste');
  await page.getByLabel('Responsável pelo registro').fill('Equipe sintética');
  for (const code of ['acesso', 'sinalizacao', 'iluminacao', 'conservacao']) {
    await page.locator(`[name="resultado_${code}"]`).selectOption('Conforme');
  }
}

test('aborto de gravação local nunca confirma salvamento nem apaga formulário', async ({ page, context }) => {
  await page.goto('/inspecoes/nova');
  await fillForm(page, 'Ficha que não pode se perder');
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      const request = put.apply(this, args);
      request.addEventListener('success', () => this.transaction.abort(), { once: true });
      return request;
    };
  });
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Salvar inspeção', exact: true }).click();
  await expect(page.locator('[data-sync-status]')).toContainText('Não foi possível salvar neste dispositivo', { timeout: 2000 });
  await expect(page.getByLabel('Título da inspeção')).toHaveValue('Ficha que não pode se perder');
  await expect(page.getByRole('button', { name: 'Salvar inspeção', exact: true })).toBeEnabled();
  await expect(page.locator('.queue-badge [data-queue-count]')).toHaveText('0');
});

async function audit(page, info, name) {
  const result = await new AxeBuilder({ page }).analyze();
  await writeFile(info.outputPath(`axe-${name}.json`), JSON.stringify(result.violations, null, 2));
  expect(result.violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: true });
  await page.locator('[data-local-queue]').screenshot({ path: info.outputPath(`${name}-queue.png`) });
}

async function exportQueue(page, info) {
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar fichas locais' }).click();
  const download = await downloadPromise;
  const path = info.outputPath('outbox.json');
  await download.saveAs(path);
  return JSON.parse(await readFile(path, 'utf8'));
}

test('fila sobrevive a reload offline, permite revisão/exportação e sincroniza uma vez', async ({ page, context }, info) => {
  await page.goto('/inspecoes/nova');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => navigator.serviceWorker.controller);
  await fillForm(page, 'Ficha criada sem rede');
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Salvar inspeção', exact: true }).click();
  await expect(page.locator('[data-sync-status]')).toContainText('Inspeção salva no dispositivo');
  await page.reload();
  await expect(page.locator('.queue-badge [data-queue-count]')).toHaveText('1');
  await page.getByRole('link', { name: 'Revisar ficha: Ficha criada sem rede', exact: true }).click();
  await expect(page.getByLabel('Título da inspeção')).toHaveValue('Ficha criada sem rede');
  await expect(page.getByLabel('Local', { exact: true })).toHaveValue('Espaço sintético de teste');
  await page.getByLabel('Título da inspeção').fill('Ficha revisada <em>sem HTML</em>');
  await page.getByRole('button', { name: 'Salvar inspeção', exact: true }).click();
  await expect(page.locator('[data-sync-status]')).toContainText('Inspeção salva no dispositivo');
  const exported = await exportQueue(page, info);
  expect(exported.format).toBe('vertice-outbox-v1');
  expect(exported.items).toHaveLength(1);
  expect(exported.items[0].titulo).toBe('Ficha revisada <em>sem HTML</em>');
  await expect(page.locator('[data-local-queue-list] em')).toHaveCount(0);
  await audit(page, info, 'offline-review');
  await page.goto('/');
  await context.setOffline(false);
  await expect(page.locator('.queue-badge [data-queue-count]')).toHaveText('0');
  const data = await (await page.request.get('/api/inspecoes')).json();
  const matching = data.items.filter((item) => item.client_id === exported.items[0].client_id);
  expect(matching).toHaveLength(1);
  expect(matching[0].titulo).toBe(exported.items[0].titulo);
});

test('rejeição 422 preserva a ficha e permite corrigir sem trocar sua identidade', async ({ page }, info) => {
  let calls = 0;
  await page.route('**/api/inspecoes', async (route) => {
    calls++;
    await route.fulfill({ status: 422, json: { errors: ['Revise o título antes de sincronizar.'] } });
  });
  await page.goto('/inspecoes/nova');
  await fillForm(page, 'Ficha para revisar');
  await page.getByRole('button', { name: 'Salvar inspeção', exact: true }).click();
  await expect(page.locator('[data-sync-status]')).toContainText('preservada para revisão');
  const id = await page.locator('[name="client_id"]').inputValue();
  await page.getByRole('link', { name: 'Revisar ficha: Ficha para revisar', exact: true }).click();
  await expect(page.getByLabel('Título da inspeção')).toHaveValue('Ficha para revisar');
  expect(calls).toBe(1);
  await page.getByLabel('Título da inspeção').fill('Ficha corrigida');
  await audit(page, info, 'validation-review');
  await page.unroute('**/api/inspecoes');
  await page.getByRole('button', { name: 'Salvar inspeção', exact: true }).click();
  await expect(page).toHaveURL(/\/inspecoes\/\d+\?criada=1$/);
  await expect(page.locator('.queue-badge [data-queue-count]')).toHaveText('0');
  const data = await (await page.request.get('/api/inspecoes')).json();
  expect(data.items.filter((item) => item.client_id === id)).toHaveLength(1);
});

test('resposta de sucesso inválida não apaga fila nem redireciona para registro inexistente', async ({ page }) => {
  await page.route('**/api/inspecoes', (route) => route.fulfill({ status: 200, json: { ok: true } }));
  await page.goto('/inspecoes/nova');
  await fillForm(page, 'Ficha sem confirmação válida');
  await page.getByRole('button', { name: 'Salvar inspeção', exact: true }).click();
  await expect(page.locator('[data-sync-status]')).toContainText('preservada no dispositivo');
  await expect(page.locator('.queue-badge [data-queue-count]')).toHaveText('1');
  await expect(page).toHaveURL(/\/inspecoes\/nova$/);
});

test('aceite sem resposta seguido de alteração gera conflito sem perder nenhuma versão', async ({ page }, info) => {
  let original;
  await page.route('**/api/inspecoes', async (route) => {
    original = await (await route.fetch()).json();
    await route.abort('failed');
  });
  await page.goto('/inspecoes/nova');
  await fillForm(page, 'Ficha original aceita');
  await page.getByRole('button', { name: 'Salvar inspeção', exact: true }).click();
  await expect(page.locator('[data-sync-status]')).toContainText('preservada no dispositivo');
  await page.unroute('**/api/inspecoes');
  await page.getByLabel('Título da inspeção').fill('Ficha alterada depois do aceite');
  await page.getByRole('button', { name: 'Salvar inspeção', exact: true }).click();
  await expect(page.locator('[data-sync-status]')).toContainText('Já existe uma ficha');
  await expect(page.getByRole('link', { name: 'Comparar com o servidor' })).toHaveAttribute('href', `/inspecoes/${original.id}`);
  const exported = await exportQueue(page, info);
  expect(exported.items[0].titulo).toBe('Ficha alterada depois do aceite');
  const saved = await (await page.request.get(`/api/inspecoes/${original.id}`)).json();
  expect(saved.item.titulo).toBe('Ficha original aceita');
  await audit(page, info, 'conflict-review');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Remover cópia local' }).click();
  await expect(page.locator('.queue-badge [data-queue-count]')).toHaveText('0');
  expect((await page.request.get(`/api/inspecoes/${original.id}`)).status()).toBe(200);
});

test('confirmação atrasada não remove uma edição mais recente feita em outra aba', async ({ page, context }, info) => {
  let original;
  let signalReceived;
  let release;
  const received = new Promise((resolve) => { signalReceived = resolve; });
  const gate = new Promise((resolve) => { release = resolve; });
  let editor;
  await page.route('**/api/inspecoes', async (route) => {
    const response = await route.fetch();
    original = await response.json();
    signalReceived();
    await gate;
    await route.fulfill({ response });
  });
  try {
    await page.goto('/inspecoes/nova');
    await fillForm(page, 'Versão enviada primeiro');
    await page.getByRole('button', { name: 'Salvar inspeção', exact: true }).click();
    await received;
    editor = await context.newPage();
    await editor.addInitScript(() => Object.defineProperty(navigator, 'onLine', { get: () => false }));
    await editor.goto(`/inspecoes/nova?local=${original.item.client_id}`);
    await expect(editor.getByLabel('Título da inspeção')).toHaveValue('Versão enviada primeiro');
    await editor.getByLabel('Título da inspeção').fill('Versão mais recente em outra aba');
    await editor.getByRole('button', { name: 'Salvar inspeção', exact: true }).click();
    await expect(editor.locator('[data-sync-status]')).toContainText('Inspeção salva no dispositivo');
    release();
    await expect(page.locator('[data-sync-status]')).toContainText('versão mais recente continua na fila');
    const exported = await exportQueue(editor, info);
    expect(exported.items).toHaveLength(1);
    expect(exported.items[0].titulo).toBe('Versão mais recente em outra aba');
    const saved = await (await page.request.get(`/api/inspecoes/${original.id}`)).json();
    expect(saved.item.titulo).toBe('Versão enviada primeiro');
  } finally { release(); await editor?.close(); }
});

test('falha de remoção local após aceite mantém cópia e permite reenvio sem duplicar', async ({ page }) => {
  await page.goto('/inspecoes/nova');
  await fillForm(page, 'Ficha aceita com cópia preservada');
  await page.evaluate(() => {
    const remove = IDBObjectStore.prototype.delete;
    window.restoreQueueDelete = () => { IDBObjectStore.prototype.delete = remove; };
    IDBObjectStore.prototype.delete = function (...args) {
      const request = remove.apply(this, args);
      request.addEventListener('success', () => this.transaction.abort(), { once: true });
      return request;
    };
  });
  await page.getByRole('button', { name: 'Salvar inspeção', exact: true }).click();
  await expect(page.locator('[data-sync-status]')).toContainText('servidor confirmou');
  await expect(page.locator('.queue-badge [data-queue-count]')).toHaveText('1');
  const id = await page.locator('[name="client_id"]').inputValue();
  await page.evaluate(() => window.restoreQueueDelete());
  await page.getByRole('button', { name: 'Tentar sincronizar' }).click();
  await expect(page.locator('.queue-badge [data-queue-count]')).toHaveText('0');
  await expect(page.locator('[data-sync-status]')).toContainText('Inspeção sincronizada');
  const data = await (await page.request.get('/api/inspecoes')).json();
  expect(data.items.filter((item) => item.client_id === id)).toHaveLength(1);
});
