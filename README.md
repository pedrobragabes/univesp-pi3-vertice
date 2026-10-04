# Vértice — Projeto Integrador III

[![CI](https://github.com/pedrobragabes/univesp-pi3-vertice/actions/workflows/ci.yml/badge.svg)](https://github.com/pedrobragabes/univesp-pi3-vertice/actions/workflows/ci.yml)
[![CodeQL](https://github.com/pedrobragabes/univesp-pi3-vertice/actions/workflows/codeql.yml/badge.svg)](https://github.com/pedrobragabes/univesp-pi3-vertice/actions/workflows/codeql.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

O **Vértice** é uma PWA experimental para inspeções e ocorrências em campo. O projeto combina interface web responsiva, API própria, SQLite, service worker e fila offline em IndexedDB. Ele é independente do Conecta Bairro e do Nexo.

## Estado

| Dimensão | Situação |
|---|---|
| fundação técnica | release histórico `v0.1.0-foundation`; revisão 0.1.2 protege fila e conflitos, com 13 testes Node e 17 E2E |
| entrega acadêmica | pendente de parceiro, validação de campo, relatório e vídeo |
| operação offline | reload offline, revisão, exportação, falhas de gravação/remoção e concorrência entre abas testados em Chromium; dispositivo físico pendente |
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
npx playwright install chromium
npm run test:e2e
```

## API

| Método | Endpoint | Finalidade |
|---|---|---|
| `GET` | `/api/inspecoes` | listar e filtrar fichas |
| `POST` | `/api/inspecoes` | criar ou reconhecer reenvio pelo `client_id` |
| `GET` | `/api/inspecoes/:id` | consultar ficha e checklist |
| `PATCH` | `/api/inspecoes/:id/status` | atualizar estado da ficha |

O `POST` retorna `201` ao criar e `200` quando o mesmo `client_id` e conteúdo normalizado já foram sincronizados. Conteúdo diferente com a mesma chave retorna `409`, preservando o original e a cópia local. O recibo mantém o conteúdo inicial mesmo quando o status da ficha muda. Checklists precisam conter os quatro códigos previstos uma única vez; rótulos são canônicos.

A inicialização cria uma tabela adicional de recibos, sem alterar as fichas anteriores. Registros antigos sem recibo retornam conflito para comparação manual; não recebem um histórico inicial inventado. O ensaio de reinício/compatibilidade usa exclusivamente arquivo SQLite temporário, e nenhum banco anterior desta máquina foi aberto ou migrado.

## Funcionamento offline

O service worker guarda o shell essencial. Antes de tentar enviar, a ficha é gravada no IndexedDB; a confirmação de salvamento espera o término da transação. Falha local mantém os campos e é informada sem afirmar que a ficha foi salva. O evento `online` inicia nova tentativa, e uma resposta inválida não remove a cópia local. A exclusão após aceite só ocorre se o conteúdo local ainda corresponder à versão enviada: uma edição mais recente em outra aba permanece na fila.

O painel **Fichas neste dispositivo** permite revisar inclusive offline, tentar sincronizar e exportar JSON por ação explícita. Erros `422` e conflitos `409` ficam visíveis e aguardam revisão. Uma ficha aberta pelo link Revisar não é enviada automaticamente enquanto está sendo editada; use Salvar inspeção. Nos conflitos, compare o registro do servidor e exporte as alterações antes de remover a cópia local, ação que exige confirmação e preserva o servidor. A exportação é um arquivo privado das fichas, não um serviço de backup ou importação.

Os E2E usam servidor em loopback e SQLite em memória, com fichas fictícias. Há cenários em 1440/390 px, inspeção de quatro páginas em 320 px e auditorias Axe nos estados testados. Não houve uso de geolocalização real, parceiro, conta externa ou implantação. Axe não certifica acessibilidade completa nem instalação em aparelhos físicos.

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
