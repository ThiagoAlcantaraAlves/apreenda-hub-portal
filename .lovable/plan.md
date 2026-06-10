## Diagnóstico

O erro na tela é **"Não foi possível analisar agora: Failed to send a request to the Edge Function"**, vindo do hook `useTemplateAnalysis` quando chama `supabase.functions.invoke("disparos-analyze-template", ...)`.

Evidência:
- Logs da edge function `disparos-analyze-template`: **vazios** (nenhuma invocação registrada). Quando a função existe e é chamada, mesmo erros 4xx/5xx aparecem nos logs. Vazio = função não foi atingida → ou não está deployada, ou a URL falhou no preflight CORS.
- Outras funções de disparos (ex: `disparos-create-template`) têm um comentário `// lovable redeploy nudge — 2026-06-10` no fim do arquivo. Esse é o padrão usado aqui pra forçar redeploy. A `disparos-analyze-template` **não tem esse nudge**, então provavelmente nunca foi redeployada após edits recentes.
- A função importa `../_shared/minimax.ts` e usa o secret `MINIMAX_API_KEY` (já existe). Os pré-requisitos de execução estão OK.

## Plano de correção

1. **Forçar redeploy** da `disparos-analyze-template` adicionando o nudge no fim do arquivo (mesmo padrão das outras funções).
2. **Deploy explícito** via `supabase--deploy_edge_functions` pra garantir.
3. **Testar** com `supabase--curl_edge_functions` enviando um payload mínimo (`bodyText`, `declaredCategory: "MARKETING"`, `skipAI: true` pra resposta rápida sem custo de IA).
4. Se passar, verificar com `skipAI: false` (chamada real ao MiniMax) pra confirmar que o secret e o shared module funcionam.
5. Se algum passo falhar, ler os logs da função e corrigir o problema real (ex: import quebrado, validação de payload, etc).

## O que NÃO vou mexer

- UI de Cadastrar Template, hook `useTemplateAnalysis`, ou client `invokeWithAuth` — eles estão corretos; o problema está no servidor.
- Outras funções de disparos.
- Auth / rotas / styles (já estabilizados na rodada anterior).
