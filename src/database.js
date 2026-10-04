import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

class IdempotencyConflictError extends Error {
  constructor(id) {
    super('Já existe uma ficha no servidor para este envio. Confira o conteúdo antes de alterar.');
    this.code = 'IDEMPOTENCY_CONFLICT';
    this.id = id;
  }
}

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const schema = `
  CREATE TABLE IF NOT EXISTS inspecoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id TEXT UNIQUE,
    titulo TEXT NOT NULL,
    tipo TEXT NOT NULL,
    local TEXT NOT NULL,
    responsavel TEXT NOT NULL,
    latitude REAL,
    longitude REAL,
    observacoes TEXT DEFAULT '',
    status TEXT NOT NULL CHECK(status IN ('Rascunho', 'Enviada', 'Concluída')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS itens_inspecao (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    inspecao_id INTEGER NOT NULL REFERENCES inspecoes(id) ON DELETE CASCADE,
    codigo TEXT NOT NULL,
    rotulo TEXT NOT NULL,
    resultado TEXT NOT NULL CHECK(resultado IN ('Conforme', 'Atenção', 'Não se aplica')),
    observacao TEXT DEFAULT '',
    UNIQUE(inspecao_id, codigo)
  );
  CREATE TABLE IF NOT EXISTS inspecoes_submetidas (
    inspecao_id INTEGER PRIMARY KEY REFERENCES inspecoes(id) ON DELETE CASCADE,
    submission_hash TEXT NOT NULL
  );
`;

const seeds = [
  {
    title: 'Vistoria da entrada principal', type: 'Vistoria de acessibilidade', place: 'Centro Comunitário - entrada norte',
    responsible: 'Equipe de demonstração', latitude: null, longitude: null, status: 'Enviada',
    notes: 'Registro fictício criado para demonstrar o fluxo do projeto.',
    items: [
      { code: 'acesso', label: 'Acesso e circulação', result: 'Atenção', note: 'Desnível demonstrativo junto ao portão.' },
      { code: 'sinalizacao', label: 'Sinalização e orientação', result: 'Conforme', note: '' },
      { code: 'iluminacao', label: 'Iluminação do percurso', result: 'Conforme', note: '' },
      { code: 'conservacao', label: 'Conservação do espaço', result: 'Atenção', note: 'Piso com desgaste em área fictícia.' },
    ],
  },
  {
    title: 'Ronda preventiva do salão', type: 'Segurança do espaço', place: 'Salão multiuso - bloco B',
    responsible: 'Equipe de demonstração', latitude: null, longitude: null, status: 'Concluída',
    notes: 'Massa de dados fictícia; não corresponde a uma inspeção real.',
    items: [
      { code: 'acesso', label: 'Acesso e circulação', result: 'Conforme', note: '' },
      { code: 'sinalizacao', label: 'Sinalização e orientação', result: 'Atenção', note: 'Sinalização simulada para revisão.' },
      { code: 'iluminacao', label: 'Iluminação do percurso', result: 'Conforme', note: '' },
      { code: 'conservacao', label: 'Conservação do espaço', result: 'Conforme', note: '' },
    ],
  },
];

export function createDatabase({ filename, seed = true } = {}) {
  const dbPath = filename || resolve(projectRoot, 'data', 'vertice.db');
  if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  db.exec(schema);

  const selectByClientId = db.prepare('SELECT i.id, s.submission_hash FROM inspecoes i LEFT JOIN inspecoes_submetidas s ON s.inspecao_id = i.id WHERE i.client_id = ?');
  const insertSubmission = db.prepare('INSERT INTO inspecoes_submetidas (inspecao_id, submission_hash) VALUES (?, ?)');
  const insertInspection = db.prepare(`
    INSERT INTO inspecoes (client_id, titulo, tipo, local, responsavel, latitude, longitude, observacoes, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertItem = db.prepare(`
    INSERT INTO itens_inspecao (inspecao_id, codigo, rotulo, resultado, observacao)
    VALUES (?, ?, ?, ?, ?)
  `);

  function create(inspection) {
    const submissionHash = createHash('sha256').update(JSON.stringify({
      title: inspection.title, type: inspection.type, place: inspection.place,
      responsible: inspection.responsible, latitude: inspection.latitude, longitude: inspection.longitude,
      notes: inspection.notes, status: inspection.status,
      items: inspection.items.map(({ code, result, note }) => ({ code, result, note })).sort((a, b) => a.code.localeCompare(b.code)),
    })).digest('hex');
    db.exec('BEGIN IMMEDIATE');
    try {
      if (inspection.clientId) {
        const existing = selectByClientId.get(inspection.clientId);
        if (existing) {
          if (existing.submission_hash !== submissionHash) throw new IdempotencyConflictError(existing.id);
          db.exec('COMMIT');
          return { id: existing.id, created: false };
        }
      }
      const result = insertInspection.run(
        inspection.clientId || null, inspection.title, inspection.type, inspection.place, inspection.responsible,
        inspection.latitude, inspection.longitude, inspection.notes, inspection.status,
      );
      const id = Number(result.lastInsertRowid);
      for (const item of inspection.items) insertItem.run(id, item.code, item.label, item.result, item.note);
      insertSubmission.run(id, submissionHash);
      db.exec('COMMIT');
      return { id, created: true };
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  if (seed && db.prepare('SELECT COUNT(*) AS total FROM inspecoes').get().total === 0) {
    for (const item of seeds) create({ ...item, clientId: '' });
  }

  function find(id) {
    const inspection = db.prepare('SELECT * FROM inspecoes WHERE id = ?').get(id);
    if (!inspection) return undefined;
    return {
      ...inspection,
      items: db.prepare('SELECT codigo, rotulo, resultado, observacao FROM itens_inspecao WHERE inspecao_id = ? ORDER BY id').all(id),
    };
  }

  return {
    create,
    find,
    list({ status = '', type = '', search = '' } = {}) {
      const clauses = [];
      const params = [];
      if (status) { clauses.push('status = ?'); params.push(status); }
      if (type) { clauses.push('tipo = ?'); params.push(type); }
      if (search) {
        const term = `%${search}%`;
        clauses.push('(titulo LIKE ? OR local LIKE ? OR responsavel LIKE ?)');
        params.push(term, term, term);
      }
      const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
      return db.prepare(`
        SELECT i.*, COALESCE(SUM(CASE WHEN it.resultado = 'Atenção' THEN 1 ELSE 0 END), 0) AS alertas
        FROM inspecoes i LEFT JOIN itens_inspecao it ON it.inspecao_id = i.id
        ${where} GROUP BY i.id
        ORDER BY CASE i.status WHEN 'Enviada' THEN 1 WHEN 'Rascunho' THEN 2 ELSE 3 END, datetime(i.created_at) DESC
      `).all(...params);
    },
    updateStatus(id, status) {
      return db.prepare('UPDATE inspecoes SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, id).changes;
    },
    indicators() {
      return db.prepare(`
        SELECT COUNT(*) AS total,
          COALESCE(SUM(CASE WHEN status = 'Enviada' THEN 1 ELSE 0 END), 0) AS enviadas,
          COALESCE(SUM(CASE WHEN status = 'Concluída' THEN 1 ELSE 0 END), 0) AS concluidas,
          COUNT(DISTINCT local) AS locais
        FROM inspecoes
      `).get();
    },
    close() { db.close(); },
  };
}
