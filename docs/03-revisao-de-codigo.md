# Revisão de código - versão 0.1.1

## Escopo

Revisão local do backend, banco, API, templates, PWA, service worker, fila IndexedDB, geolocalização, testes e documentação antes da primeira publicação. Além da análise estática, foi executado um ensaio real interrompendo e restaurando o servidor durante o envio de uma ficha.

## Achados corrigidos

### P1 - Fila offline não era visível no formulário

O contador existia apenas no painel e na listagem. Depois de guardar uma ficha durante falha de rede, o usuário via a mensagem imediata, mas perdia a confirmação ao navegar.

**Correção:** o cabeçalho global agora apresenta conexão e quantidade de fichas na fila em todas as páginas.

### P1 - Assets cache-first não mudavam de versão

CSS e JavaScript foram alterados sem mudar a chave do cache. Dispositivos com o primeiro service worker poderiam manter arquivos antigos indefinidamente.

**Correção:** cache e URLs dos assets foram incrementados para `v2`/`0.1.1`. A ativação remove caches anteriores.

### P1 - Risco de duplicação após incerteza de rede

Um cliente pode enviar a ficha, perder a resposta e tentar novamente. Sem idempotência, seriam criados dois registros.

**Prevenção validada:** toda ficha da fila recebe `client_id`; o banco mantém índice único e o segundo envio retorna o registro existente com `200`.

### P2 - Estado online do navegador não garante acesso ao servidor

`navigator.onLine` pode continuar verdadeiro quando apenas o servidor está indisponível.

**Prevenção validada:** a aplicação também captura falha real do `fetch` e guarda a ficha. O teste de navegador confirmou esse caminho com o servidor desligado.

## Riscos aceitos nesta fase

### P1 para produção - ausência de autenticação e autorização

A API aceita criação e atualização sem identidade ou papéis. Antes da implantação, são necessários autenticação, permissões, auditoria e revogação.

### P1 para dados reais - fila local sem criptografia

O IndexedDB pertence ao perfil do navegador e armazena o conteúdo da ficha em texto. O MVP não deve guardar nomes, coordenadas ou observações reais em dispositivo compartilhado até existir política, minimização e proteção apropriadas.

### P2 - ficha inválida pode permanecer na fila

Se regras do servidor mudarem enquanto uma ficha estiver offline, a sincronização pode receber `422`. O registro é preservado para evitar perda, mas ainda não existe interface para editar ou exportar a fila. Essa tela é necessária antes do piloto.

### P2 - cache offline não é backup

Limpeza dos dados do navegador remove fila e shell. Vários dispositivos não compartilham rascunhos, e conflitos entre edições não são tratados.

### P2 - `node:sqlite` experimental

O Node emite aviso experimental. Uma implantação deve fixar o runtime e avaliar driver estável ou banco gerenciado.

## Verificações realizadas

- checagem sintática do servidor, domínio, banco, aplicação, fila e service worker;
- testes de API, validação, filtros, status, idempotência, PWA e proteção entre sites;
- `npm audit` sem vulnerabilidades conhecidas;
- inspeção visual em desktop e 390 x 844 px, sem overflow;
- console do navegador sem erros ou avisos;
- manifest e service worker publicados;
- envio com servidor interrompido guardou uma ficha no IndexedDB;
- restauração do servidor sincronizou a ficha e reduziu a fila de 1 para 0;
- consulta à API confirmou uma única ficha sincronizada.

## Conclusão

Não restaram bloqueadores para publicar o código como protótipo acadêmico. Autenticação, proteção da fila, gestão de erros `422` e governança de localização continuam bloqueadores explícitos para um piloto com dados reais.
