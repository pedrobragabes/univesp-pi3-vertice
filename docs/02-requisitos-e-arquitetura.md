# Requisitos e arquitetura

## Requisitos funcionais iniciais

| ID | Requisito | Evidência |
|---|---|---|
| RF01 | criar ficha com checklist | formulário e `POST /api/inspecoes` |
| RF02 | consultar fichas sincronizadas | listagem, filtros e API |
| RF03 | registrar pontos de atenção | itens normalizados no banco |
| RF04 | guardar envio durante falha de rede | object store `outbox` no IndexedDB |
| RF05 | reenviar sem duplicar | `client_id` único e retorno idempotente |
| RF06 | registrar posição opcional | Geolocation API acionada por botão |
| RF07 | atualizar andamento | formulário e endpoint de status |

## Requisitos não funcionais

- interface entre 320 px e desktop;
- navegação por teclado e foco visível;
- shell essencial disponível após primeira visita;
- consultas SQL parametrizadas;
- payload limitado a 40 KB;
- falha de sincronização não descarta ficha;
- API retorna erros estruturados;
- CI executa checagem e testes.

## Arquitetura

```mermaid
flowchart LR
    P["PWA no navegador"] -->|"HTML ou JSON"| E["Express 5"]
    E --> S[("SQLite")]
    P --> I[("IndexedDB / outbox")]
    W["Service worker"] --> C[("Cache do shell")]
    I -->|"sincronização idempotente"| E
    G["Geolocation API opcional"] --> P
```

## Modelo de dados

Uma inspeção possui vários itens de checklist. `client_id` é opcional no cadastro tradicional e obrigatório na fila offline. A unicidade desse valor permite reconhecer reenvio sem inserir duplicata.

## Limites arquiteturais

O IndexedDB pertence ao perfil do navegador e não é backup. Limpeza de dados do site remove a fila. Vários dispositivos não compartilham rascunhos. O service worker não substitui autenticação, sincronização de conflitos ou observabilidade de produção.
