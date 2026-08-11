export const inspectionTypes = [
  'Vistoria de acessibilidade',
  'Manutenção preventiva',
  'Zeladoria',
  'Segurança do espaço',
];

export const inspectionStatuses = ['Rascunho', 'Enviada', 'Concluída'];
export const itemResults = ['Conforme', 'Atenção', 'Não se aplica'];

export const checklist = [
  { code: 'acesso', label: 'Acesso e circulação' },
  { code: 'sinalizacao', label: 'Sinalização e orientação' },
  { code: 'iluminacao', label: 'Iluminação do percurso' },
  { code: 'conservacao', label: 'Conservação do espaço' },
];

export function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function coordinate(value, min, max) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : Number.NaN;
}

export function validateInspection(body = {}) {
  const rawItems = Array.isArray(body.itens)
    ? body.itens
    : checklist.map(({ code, label }) => ({
        code,
        label,
        result: clean(body[`resultado_${code}`]),
        note: clean(body[`observacao_${code}`]),
      }));

  const inspection = {
    clientId: clean(body.client_id) || clean(body.clientId),
    title: clean(body.titulo) || clean(body.title),
    type: clean(body.tipo) || clean(body.type),
    place: clean(body.local) || clean(body.place),
    responsible: clean(body.responsavel) || clean(body.responsible),
    latitude: coordinate(body.latitude, -90, 90),
    longitude: coordinate(body.longitude, -180, 180),
    notes: clean(body.observacoes) || clean(body.notes),
    status: clean(body.status) || 'Enviada',
    items: rawItems.map((item, index) => ({
      code: clean(item.code) || checklist[index]?.code || `item-${index + 1}`,
      label: clean(item.label) || checklist[index]?.label || `Item ${index + 1}`,
      result: clean(item.result),
      note: clean(item.note),
    })),
  };

  const errors = [];
  if (inspection.clientId && inspection.clientId.length > 80) errors.push('O identificador do dispositivo é inválido.');
  if (inspection.title.length < 5 || inspection.title.length > 120) errors.push('O título deve ter entre 5 e 120 caracteres.');
  if (!inspectionTypes.includes(inspection.type)) errors.push('Selecione um tipo de inspeção válido.');
  if (inspection.place.length < 3 || inspection.place.length > 160) errors.push('Informe o local da inspeção.');
  if (inspection.responsible.length < 2 || inspection.responsible.length > 100) errors.push('Informe a pessoa responsável pela inspeção.');
  if (Number.isNaN(inspection.latitude) || Number.isNaN(inspection.longitude)) errors.push('As coordenadas informadas são inválidas.');
  if ((inspection.latitude === null) !== (inspection.longitude === null)) errors.push('Informe latitude e longitude em conjunto.');
  if (inspection.notes.length > 1500) errors.push('As observações devem ter no máximo 1.500 caracteres.');
  if (!inspectionStatuses.includes(inspection.status)) errors.push('O status informado é inválido.');
  if (inspection.items.length !== checklist.length) errors.push('O checklist deve conter todos os itens previstos.');
  for (const item of inspection.items) {
    if (!itemResults.includes(item.result)) errors.push(`Selecione um resultado válido para “${item.label}”.`);
    if (item.note.length > 500) errors.push(`A observação de “${item.label}” deve ter no máximo 500 caracteres.`);
  }

  return { inspection, errors: [...new Set(errors)] };
}
