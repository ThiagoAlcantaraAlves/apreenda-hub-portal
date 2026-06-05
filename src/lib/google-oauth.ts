// Google OAuth (GA4 + Google Ads). Client ID público.
export const GOOGLE_CLIENT_ID =
  "144948979755-placeholder.apps.googleusercontent.com";

const GOOGLE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/analytics.readonly",
  "https://www.googleapis.com/auth/adwords",
].join(" ");

export function googleCallbackUri() {
  return `${window.location.origin}/oauth/google/callback`;
}

export function getGoogleOAuthUrl() {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: googleCallbackUri(),
    response_type: "code",
    scope: GOOGLE_SCOPES,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}
