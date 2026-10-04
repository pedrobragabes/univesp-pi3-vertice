import express from 'express';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checklist, clean, inspectionStatuses, inspectionTypes, itemResults, validateInspection } from './domain.js';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function addSecurityHeaders(req, res, next) {
  res.set({
    'Content-Security-Policy': "default-src 'self'; base-uri 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data: blob:; manifest-src 'self'; object-src 'none'; script-src 'self'; style-src 'self'; worker-src 'self'",
    'Permissions-Policy': 'camera=(), geolocation=(self), microphone=()',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
  });
  next();
}

function rejectCrossSiteWrites(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('sec-fetch-site') === 'cross-site') return res.status(403).send('Requisição entre sites bloqueada.');
  const origin = req.get('origin');
  if (origin) {
    try {
      if (new URL(origin).origin !== new URL(`${req.protocol}://${req.get('host')}`).origin) return res.status(403).send('Origem não permitida.');
    } catch { return res.status(403).send('Origem inválida.'); }
  }
  next();
}

function filtersFrom(query) {
  return { status: clean(query.status), type: clean(query.tipo), search: clean(query.busca) };
}

export function createApp({ database }) {
  if (!database) throw new Error('A dependência database é obrigatória.');
  const app = express();
  app.disable('x-powered-by');
  app.set('view engine', 'ejs');
  app.set('views', resolve(projectRoot, 'views'));
  app.use(addSecurityHeaders);
  app.use(rejectCrossSiteWrites);
  app.use(express.urlencoded({ extended: false, limit: '40kb' }));
  app.use(express.json({ limit: '40kb' }));
  app.use(express.static(resolve(projectRoot, 'public'), { maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0 }));

  app.use((req, res, next) => {
    res.locals.path = req.path;
    res.locals.checklist = checklist;
    res.locals.inspectionTypes = inspectionTypes;
    res.locals.inspectionStatuses = inspectionStatuses;
    res.locals.itemResults = itemResults;
    res.locals.formatDate = (value) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(`${value.replace(' ', 'T')}Z`));
    next();
  });

  app.get('/health', (req, res) => res.json({ status: 'ok', service: 'vertice' }));

  app.get('/', (req, res) => res.render('index', {
    title: 'Painel de campo', indicators: database.indicators(), recent: database.list().slice(0, 4),
  }));

  app.get('/inspecoes', (req, res) => {
    const filters = filtersFrom(req.query);
    res.render('inspecoes/index', { title: 'Inspeções', items: database.list(filters), filters });
  });

  app.get('/inspecoes/nova', (req, res) => res.render('inspecoes/form', {
    title: 'Nova inspeção', item: { status: 'Enviada' }, errors: [],
  }));

  app.post('/inspecoes', (req, res) => {
    const { inspection, errors } = validateInspection(req.body);
    if (errors.length) return res.status(422).render('inspecoes/form', { title: 'Nova inspeção', item: inspection, errors });
    const result = database.create(inspection);
    res.redirect(`/inspecoes/${result.id}?criada=1`);
  });

  app.get('/inspecoes/:id', (req, res, next) => {
    const item = database.find(Number(req.params.id));
    if (!item) return next();
    res.render('inspecoes/show', { title: item.titulo, item, created: req.query.criada === '1' });
  });

  app.post('/inspecoes/:id/status', (req, res, next) => {
    const status = clean(req.body.status);
    if (!inspectionStatuses.includes(status)) return res.status(422).send('Status inválido.');
    if (!database.updateStatus(Number(req.params.id), status)) return next();
    res.redirect(`/inspecoes/${req.params.id}`);
  });

  app.get('/api/inspecoes', (req, res) => res.json({ items: database.list(filtersFrom(req.query)) }));
  app.post('/api/inspecoes', (req, res) => {
    const { inspection, errors } = validateInspection(req.body);
    if (errors.length) return res.status(422).json({ errors });
    const result = database.create(inspection);
    res.status(result.created ? 201 : 200).json({ ...result, item: database.find(result.id) });
  });
  app.get('/api/inspecoes/:id', (req, res) => {
    const item = database.find(Number(req.params.id));
    if (!item) return res.status(404).json({ error: 'Inspeção não encontrada.' });
    res.json({ item });
  });
  app.patch('/api/inspecoes/:id/status', (req, res) => {
    const status = clean(req.body.status);
    if (!inspectionStatuses.includes(status)) return res.status(422).json({ error: 'Status inválido.' });
    if (!database.updateStatus(Number(req.params.id), status)) return res.status(404).json({ error: 'Inspeção não encontrada.' });
    res.json({ item: database.find(Number(req.params.id)) });
  });

  app.get('/offline', (req, res) => res.render('offline', { title: 'Sem conexão' }));
  app.get('/sobre', (req, res) => res.render('sobre', { title: 'Sobre o Vértice' }));
  app.use((req, res) => res.status(404).render('404', { title: 'Página não encontrada' }));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error.code === 'IDEMPOTENCY_CONFLICT' && Number.isSafeInteger(error.id)) {
      if (req.path.startsWith('/api/')) return res.status(409).json({ error: error.message, id: error.id });
      return res.status(409).send(error.message);
    }
    if (error.type === 'entity.parse.failed' || error.type === 'entity.too.large') {
      const status = error.type === 'entity.too.large' ? 413 : 400;
      const message = status === 413 ? 'A ficha excede o limite de envio.' : 'O corpo da requisição é inválido.';
      if (req.path.startsWith('/api/')) return res.status(status).json({ error: message });
      return res.status(status).send(message);
    }
    console.error('Falha interna ao processar a requisição.');
    res.status(500).render('500', { title: 'Erro interno' });
  });
  return app;
}
