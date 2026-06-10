// Google OAuth (GA4 + Google Ads). Client ID público.
export const GOOGLE_CLIENT_ID =
  "144948979755-9dejqp5jtpmcdlv630gvthfsrll8hs84.apps.googleusercontent.com";

const GOOGLE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/analytics.readonly",
  "https://www.googleapis.com/auth/adwords",
].join(" ");

const GOOGLE_STATE_KEY = "oauth_state_google";

export function googleCallbackUri() {
  return `${window.location.origin}/oauth/google/callback`;
}

function generateState() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function getGoogleOAuthUrl() {
  const state = generateState();
  try {
    sessionStorage.setItem(GOOGLE_STATE_KEY, state);
  } catch {
    // ignore
  }
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: googleCallbackUri(),
    response_type: "code",
    scope: GOOGLE_SCOPES,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/** Validates returned state against the value stored at flow start. Clears it on success. */
export function consumeGoogleOAuthState(returned: string | null): boolean {
  try {
    const stored = sessionStorage.getItem(GOOGLE_STATE_KEY);
    sessionStorage.removeItem(GOOGLE_STATE_KEY);
    return !!stored && !!returned && stored === returned;
  } catch {
    return false;
  }
}
