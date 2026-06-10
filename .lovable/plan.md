## Diagnóstico

O que você está chamando de “telas sumiram” na verdade são **dois problemas diferentes** que vêm se alternando nas últimas mensagens:

1. **Tela cinza/branca** (anterior) — causada por erros de build do Vite (styles.css 500, mismatch em `routeTree.gen.ts` após edições manuais).
2. **Tela de login agora** (print atual em `/tool/disparos`) — o app **buildou e renderizou normalmente**, mas o guard `_authenticated/route.tsx` chamou `supabase.auth.getUser()`, não achou sessão válida e redirecionou pra `/auth`. Não é tela “sumindo” — é logout silencioso.

Evidência:
- Print atual mostra o formulário "Entrar" renderizado limpo (sem erro de build).
- Logs do auth no Supabase: várias chamadas `GET /user` retornando **200** nos últimos minutos → o backend responde, mas o cliente perdeu o token de sessão (ou nunca o teve no contexto desse reload do iframe do preview).
- Console do preview do usuário: sem erros do app (só warnings do gravador `rrweb` da Lovable).
- `src/routeTree.gen.ts` foi editado manualmente várias vezes — esse arquivo é **autogerado** e cada edição manual cria risco de novo mismatch que volta a derrubar tudo pra cinza.

## Por que isso fica acontecendo

- **Causa A (recorrente, cinza):** edições manuais em `src/routeTree.gen.ts` + um `styles.css` frágil. Toda vez que algo desalinha, o Vite devolve 500 e o preview vira cinza.
- **Causa B (agora, login):** o iframe do preview da Lovable, após um restart do dev server ou troca de token, perde o `localStorage` da sessão Supabase. O guard em `src/routes/_authenticated/route.tsx` chama `getUser()` direto no `beforeLoad`, e se não tiver sessão, redireciona pra `/auth` sem nenhum aviso — você interpreta como “sumiu”.

## Plano de correção

### 1. Parar de mexer no `routeTree.gen.ts`
- Esse arquivo é gerado pelo plugin do TanStack a partir dos arquivos em `src/routes/`. Vou removê-lo do fluxo de edição manual e deixar o Vite regenerar a partir das rotas reais. Se houver inconsistência, conserto na **rota**, não no gerado.

### 2. Trocar o redirect "mudo" por feedback ao usuário
- Quando `getUser()` falha no `_authenticated`, em vez de só `redirect({ to: "/auth" })`, passar `search: { reason: "expired", redirect: location.href }`.
- Em `src/routes/auth.tsx`, ler esse search e mostrar um toast/aviso curto ("Sua sessão expirou, entre novamente") + voltar pra rota original após login. Assim você sabe **por que** caiu no login em vez de achar que o app quebrou.

### 3. Reduzir falsos logouts no preview
- Confirmar que `src/integrations/supabase/client.ts` persiste sessão (`persistSession: true`, `autoRefreshToken: true`) — é o default, mas vou checar.
- Em `_authenticated/route.tsx`, substituir `supabase.auth.getUser()` por uma checagem que primeiro tenta `getSession()` (lê localStorage sem ir na rede) e só cai pro `getUser()` se houver sessão a validar. Isso evita o flicker→login quando o iframe ainda está hidratando o storage.

### 4. Salvaguarda contra tela cinza voltar
- Garantir que `src/styles.css` continue carregando como `?url` no `__root.tsx` (já está) e não tenha imports quebrados.
- Não tocar mais em `routeTree.gen.ts` em hipótese alguma.

## Resumo técnico do que vai mudar

```text
src/routes/_authenticated/route.tsx
  - beforeLoad: usa getSession() primeiro; passa search={reason,redirect} no redirect

src/routes/auth.tsx
  - lê search.reason e mostra aviso "sessão expirou"
  - após login, navega de volta pra search.redirect (se houver e for interno)

src/routeTree.gen.ts
  - não edito mais; deixo o plugin regenerar

src/integrations/supabase/client.ts
  - apenas leitura/verificação (não editar — é autogerado)
```

## O que NÃO vou fazer

- Reescrever o layout `_authenticated` do zero (é gerenciado pela integração).
- Mexer em edge functions, RLS, ou na UI das páginas de Disparos.
- Adicionar novas dependências.

---

Se você concordar, ao aprovar o plano eu já implemento os 4 passos numa rodada só e testo no preview do `/tool/disparos` pra confirmar que: (a) não cai mais cinza, e (b) se a sessão expirar de verdade, você vê um aviso em vez de “sumir”.
