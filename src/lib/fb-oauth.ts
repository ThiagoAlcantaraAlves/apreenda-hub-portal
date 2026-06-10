// Facebook App da Apreenda (novo App ID).
export const FB_APP_ID = "962713629923248";
const FB_SCOPES = "ads_read,read_insights";
const META_STATE_KEY = "oauth_state_meta";

export function metaCallbackUri() {
  return `${window.location.origin}/oauth/meta/callback`;
}

function generateState() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** URL do diálogo de OAuth do Facebook (fluxo de redirect). */
export function getMetaOAuthUrl() {
  const state = generateState();
  try {
    sessionStorage.setItem(META_STATE_KEY, state);
  } catch {
    // ignore
  }
  const redirect = encodeURIComponent(metaCallbackUri());
  return `https://www.facebook.com/v21.0/dialog/oauth?client_id=${FB_APP_ID}&redirect_uri=${redirect}&scope=${encodeURIComponent(FB_SCOPES)}&response_type=code&state=${encodeURIComponent(state)}`;
}

/** Validates returned state against the value stored at flow start. Clears it on success. */
export function consumeMetaOAuthState(returned: string | null): boolean {
  try {
    const stored = sessionStorage.getItem(META_STATE_KEY);
    sessionStorage.removeItem(META_STATE_KEY);
    return !!stored && !!returned && stored === returned;
  } catch {
    return false;
  }
}
