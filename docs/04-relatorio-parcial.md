# Relatório parcial técnico — Vértice / PI III

Revisão local de 04/10/2026. Esta parte registra desenvolvimento e ensaios efetivamente
executados com dados fictícios. Identificação acadêmica, calendário do AVA e evidências
de campo permanecem pendentes; os testes não substituem a atividade com parceiro.

## Identificação e contexto

Curso, polo, modalidade PJI/PIE, semestre, equipe e orientador: pendentes de fonte oficial.
Comunidade, parceiro, aceite e participantes: pendentes. Nenhuma data ou autorização foi
estimada. A hipótese de inspeções com registros dispersos é a hipótese técnica descrita
em `01-fundacao.md`, ainda sem levantamento real confirmado.

## Problema e objetivos

O protótipo busca registrar uma inspeção com checklist, consultar andamento e tolerar
falhas de conexão sem duplicar ou descartar registros silenciosamente. A revisão tratou
quatro falhas reproduzidas: sucesso da requisição IndexedDB antes de confirmar a transação,
reenvio alterado aceito como a ficha anterior, checklist malformado retornando erro interno
e tentativa de envio depois de perder a conexão durante a leitura da fila.

O objetivo desta fatia foi tornar verificável o percurso entre formulário, cópia local
e confirmação do servidor, acrescentando revisão e exportação das pendências. A redução
de tempo, satisfação dos usuários e adequação do checklist não foram medidas.

## Requisitos, decisões e evidências

| Requisito | Decisão implementada | Evidência local |
| --- | --- | --- |
| RF01/RF03 — ficha e checklist | Quatro códigos únicos e rótulos canônicos; entrada malformada é recusada antes do banco. | Casos Node de validação, sem gravação na recusa. |
| RF02/RF07 — consulta e status | API/lista mantidas; status pode mudar sem substituir o recibo inicial. | Criação, filtros, atualização e replay após alteração de status. |
| RF04 — guardar durante falha | Gravar antes do fetch e aguardar o commit da transação local. | Aborto de gravação mantém campos e não confirma salvamento; reload offline preserva fila; queda durante leitura não inicia envio. |
| RF05 — reenvio sem duplicar | Recibo do conteúdo inicial; `409` em conflito; remover cópia apenas se ainda for a versão enviada. | Aceite sem resposta, correção de `422`, edição em outra aba e falha de remoção após aceite. |
| RF06 — posição opcional | Ação explícita existente; booleanos/objetos inválidos e espaços opcionais tratados na API. | Testes sintéticos de coordenadas; localização física não foi solicitada. |
| Revisar pendências | Painel local, revisão offline, exportação JSON e comparação com o servidor. | Download lido e conteúdo conferido; cópia conflitante só removida por confirmação do usuário. |
| Acessibilidade/responsividade | Foco no conteúdo, interface de fila em texto e quebra de conteúdo longo. | Chromium 1440/390 px, quatro páginas em 320 px e Axe nos estados testados. |

## Implementação e reprodução

PWA com Express/EJS, SQLite, IndexedDB e service worker, conforme a arquitetura em
`02-requisitos-e-arquitetura.md`. O servidor de teste usa `127.0.0.1:3384` e banco em
memória. O teste de compatibilidade/reinício cria e remove apenas seu arquivo temporário.
A nova tabela de recibos não altera fichas existentes; sem recibo antigo, o reenvio
exige comparação manual em vez de supor o conteúdo original.

```powershell
npm ci
npm run check
npm test
npx playwright install chromium
npm run test:e2e
npm audit
```

No ambiente local Node 24, passaram 13 testes Node e 17 E2E: oito cenários repetidos em
desktop/mobile e um cenário de layout/teclado cobrindo quatro páginas em 320 px. As
auditorias Axe dos estados registrados não apresentaram violações. Antes da correção,
os testes de conflito, checklist malformado , aborto de IndexedDB e queda durante leitura da fila falharam. O audit
ficou sem alertas conhecidos após o patch compatível de brace-expansion. O CI configurado
acrescenta execução Linux, CodeQL, varredura de segredos e build do contêiner; evidências
remotas ficam nos checks da PR.

## Limites e próxima validação

O IndexedDB pertence ao perfil do navegador; limpar dados do site elimina as fichas.
O exportador não importa/restaura arquivos e não substitui uma política de backup.
Não há autenticação, autorização, proteção criptográfica da fila nem retenção aprovada
para dados reais. A revisão não publicou site, abriu banco anterior, coletou localização
real ou executou atividade com participantes.

As issues 3/4/5/6 continuam abertas: confirmar AVA/equipe/parceiro; validar checklist e
privacidade; homologar em HTTPS/nuvem e aparelhos reais; executar o piloto, registrar
devolutiva, relatório final, vídeo e release acadêmico. O modelo final em
`05-relatorio-final.md` continua reservado às evidências de campo.

## Referências técnicas

- [MDN — complete da transação IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction/complete_event): a confirmação usa o evento da transação concluída.
- [MDN — service workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers): referência para shell/cache e operação offline.
- Código, testes e decisões do próprio repositório: `src/`, `public/`, `test/`, `e2e/`, `01-fundacao.md` e `02-requisitos-e-arquitetura.md`.
