// Facebook App da Apreenda (mesmo do Gestor).
export const FB_APP_ID = "922760227217391";
const FB_SCOPES = "ads_read,ads_management,business_management";

export function metaCallbackUri() {
  return `${window.location.origin}/meta-callback`;
}

/** URL do diálogo de OAuth do Facebook (fluxo de redirect). */
export function getMetaOAuthUrl() {
  const redirect = encodeURIComponent(metaCallbackUri());
  return `https://www.facebook.com/v21.0/dialog/oauth?client_id=${FB_APP_ID}&redirect_uri=${redirect}&scope=${encodeURIComponent(FB_SCOPES)}&response_type=code`;
}
