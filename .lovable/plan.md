# Plano

## Objetivo
Fazer o preview voltar a carregar normalmente, em vez de mostrar a tela cinza de “Preview has not been built yet”.

## O que vou corrigir
1. Revisar o ponto que está quebrando o build/dev server do app.
2. Ajustar a configuração de inicialização/roteamento que estiver impedindo o preview de subir.
3. Validar que a rota `/home` volta a renderizar e que o app não fica em branco após o login.

## Foco da investigação
- Configuração do servidor/preview (`vite.config.ts`, `src/server.ts`, `src/start.ts`)
- Estrutura do roteador e rotas autenticadas (`src/router.tsx`, `src/routes/_authenticated/route.tsx`, `src/routes/auth.tsx`)
- Arquivo gerado de rotas, porque houve edição anterior nele e isso pode ter deixado o app instável

## Resultado esperado
- O preview deixa de exibir a mensagem de build quebrado
- A aplicação carrega novamente
- Após login, a navegação para `/home` funciona sem tela vazia

## Detalhes técnicos
- Vou priorizar a causa de build/runtime do preview, não mudanças visuais.
- Se houver configuração incorreta no bootstrap do TanStack Start ou no roteamento autenticado, ela será corrigida sem alterar funcionalidades além do necessário.
- Depois, valido o fluxo mínimo: carregar app, abrir `/auth`, navegar para `/home`.