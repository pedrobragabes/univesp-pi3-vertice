# Vértice — Projeto Integrador III

O **Vértice** é uma PWA experimental para inspeções e ocorrências em campo. O projeto combina interface web responsiva, API própria, SQLite, service worker e fila offline em IndexedDB. Ele é independente do Conecta Bairro e do Nexo.

## Primeira entrega

- criação e consulta de fichas de inspeção;
- checklist estruturado com pontos de atenção;
- filtros por status, tipo e busca textual;
- API JSON própria e documentada;
- sincronização idempotente por `client_id`;
- rascunho/fila offline em IndexedDB;
- service worker e fallback de navegação;
- geolocalização opcional, solicitada apenas por ação do usuário;
- interface responsiva e instalável;
- cabeçalhos defensivos e bloqueio de escritas entre sites;
- testes automatizados e CI.

## Executar

Requer Node.js 22.5 ou superior.

```powershell
cd "C:\Users\pedro\Documents\Projetos\UNIVESP\Estudos UNIVESP\pi3-vertice"
npm install
npm start
```

Acesse `http://localhost:3002`.

```powershell
npm run check
npm test
```

## API

| Método | Endpoint | Finalidade |
|---|---|---|
| `GET` | `/api/inspecoes` | listar e filtrar fichas |
| `POST` | `/api/inspecoes` | criar ou reconhecer reenvio pelo `client_id` |
| `GET` | `/api/inspecoes/:id` | consultar ficha e checklist |
| `PATCH` | `/api/inspecoes/:id/status` | atualizar estado da ficha |

O `POST` retorna `201` ao criar e `200` quando o mesmo `client_id` já foi sincronizado. Essa idempotência evita duplicação após incerteza de rede.

## Funcionamento offline

O service worker guarda o shell essencial. Quando o envio pela API falha por indisponibilidade de rede, a ficha é armazenada no IndexedDB do dispositivo. O evento `online` inicia nova tentativa. Erros de validação permanecem na fila para correção futura e não são descartados silenciosamente.

## Limites

Os registros iniciais são fictícios. A solução ainda não possui autenticação, anexos, criptografia da fila local, política de retenção, moderação ou implantação. O uso real exige parceiro, checklist validado, finalidade legítima para localização, consentimento, definição de responsáveis e teste em dispositivos físicos.

## Documentação

- [Fundação e decisões](docs/01-fundacao.md)
- [Requisitos e arquitetura](docs/02-requisitos-e-arquitetura.md)
- [Revisão de código](docs/03-revisao-de-codigo.md)
