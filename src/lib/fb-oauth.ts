// Facebook App da Apreenda (novo App ID).
export const FB_APP_ID = "962713629923248";
const FB_SCOPES = "ads_read,read_insights";

export function metaCallbackUri() {
  return `${window.location.origin}/oauth/meta/callback`;
}

/** URL do diálogo de OAuth do Facebook (fluxo de redirect). */
export function getMetaOAuthUrl() {
  const redirect = encodeURIComponent(metaCallbackUri());
  return `https://www.facebook.com/v21.0/dialog/oauth?client_id=${FB_APP_ID}&redirect_uri=${redirect}&scope=${encodeURIComponent(FB_SCOPES)}&response_type=code`;
}
