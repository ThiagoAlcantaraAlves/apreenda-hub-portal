# Plano aprovado

## Banco
- Migration `google_tokens` (user_id, access_token, refresh_token, expires_at, ga4_property_id/name, ads_customer_id/name) + GRANTs + RLS (SELECT own row).

## Novos arquivos
- `src/lib/google-oauth.ts` — client ID + `getGoogleOAuthUrl()` + `googleCallbackUri()`.
- `src/lib/google.functions.ts` — `googleExchangeCode`, `googleListAssets`, `googleSelectAssets`, `getValidGoogleToken` (refresh auto).
- `src/routes/_authenticated/oauth.google.callback.tsx`.
- `src/routes/_authenticated/oauth.meta.callback.tsx` (substitui o antigo `meta-callback`).

## Alterações
- `src/lib/fb-oauth.ts` — `FB_APP_ID="962713629923248"`, scopes `ads_read,read_insights`, callback `/oauth/meta/callback`.
- `src/routes/_authenticated/dashboard.tsx` — adiciona estado Google, tela `ConnectAccounts` (Meta + Google), `GooglePicker` (GA4 + Ads opcional), hint da fonte que falta.

## Remoção
- `src/routes/_authenticated/meta-callback.tsx`.

## Após implementar
- Pedir secrets: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_ADS_DEVELOPER_TOKEN` (opcional), atualizar `META_APP_ID` para `962713629923248`.

## Confirmado pelo usuário
- Troca de Meta App ID ok (reconexão dos antigos).
- Redirect URIs já cadastradas em produção (Meta + Google).
- Sem necessidade de cadastrar preview.
