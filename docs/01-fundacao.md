# Fundação do Vértice

## Hipótese

Inspeções feitas com papel, mensagens e fotografias sem padrão podem produzir registros incompletos e difíceis de consolidar. Uma solução multiplataforma, com checklist e tolerância a falhas de conexão, pode melhorar a rastreabilidade do trabalho de campo.

Essa hipótese ainda precisa ser confirmada com uma organização e participantes reais.

## Questão orientadora

Como uma solução multiplataforma e tolerante à conexão instável pode tornar inspeções de campo mais completas, rastreáveis e acessíveis?

## Decisões da primeira entrega

1. PWA responsiva em vez de dois aplicativos nativos.
2. HTML funcional sem JavaScript, com offline como melhoria progressiva.
3. API própria como contrato entre cliente e servidor.
4. IndexedDB para fila local estruturada.
5. `client_id` para reenvio idempotente.
6. geolocalização opcional e iniciada pelo usuário.
7. dados fictícios até existir parceria e consentimento.
8. fotografias fora do primeiro MVP por privacidade, armazenamento e moderação.

## Pendências de campo

- parceiro, território e perfil dos inspetores;
- checklist e vocabulário reais;
- aparelhos, navegadores e condições de conectividade;
- finalidade e necessidade da geolocalização;
- política de dados e tempo de retenção;
- tarefas, participantes e critérios de sucesso;
- estratégia de implantação em nuvem.
