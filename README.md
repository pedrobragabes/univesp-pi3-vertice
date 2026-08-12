# Vértice — Projeto Integrador III

[![CI](https://github.com/pedrobragabes/univesp-pi3-vertice/actions/workflows/ci.yml/badge.svg)](https://github.com/pedrobragabes/univesp-pi3-vertice/actions/workflows/ci.yml)
[![CodeQL](https://github.com/pedrobragabes/univesp-pi3-vertice/actions/workflows/codeql.yml/badge.svg)](https://github.com/pedrobragabes/univesp-pi3-vertice/actions/workflows/codeql.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

O **Vértice** é uma PWA experimental para inspeções e ocorrências em campo. O projeto combina interface web responsiva, API própria, SQLite, service worker e fila offline em IndexedDB. Ele é independente do Conecta Bairro e do Nexo.

## Estado

| Dimensão | Situação |
|---|---|
| fundação técnica | concluída, com 8 testes e release `v0.1.0-foundation` |
| entrega acadêmica | pendente de parceiro, validação de campo, relatório e vídeo |
| operação offline | validada no navegador com sincronização posterior |
| nuvem | configuração de contêiner pronta; homologação real ainda não executada |

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

Requer Node.js 22.5 ou superior. Após clonar o repositório e entrar em sua pasta:

```powershell
npm ci
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
- [Modelo de relatório parcial](docs/04-relatorio-parcial.md)
- [Modelo de relatório final](docs/05-relatorio-final.md)
- [Implantação em nuvem](docs/06-implantacao-em-nuvem.md)

## Governança e licença

As atividades devem ser acompanhadas por issues e milestones alinhados ao AVA. Consulte [SECURITY.md](SECURITY.md). O código usa [licença MIT](LICENSE); localização, fotos e evidências reais permanecem sujeitas a consentimento e retenção definidos com o parceiro.
