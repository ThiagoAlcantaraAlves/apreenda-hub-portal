import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { googleExchangeCode } from "@/lib/google.functions";
import { googleCallbackUri } from "@/lib/google-oauth";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/oauth/google/callback")({
  component: GoogleCallbackPage,
});

function GoogleCallbackPage() {
  const navigate = useNavigate();
  const exchange = useServerFn(googleExchangeCode);
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const gError = params.get("error_description") || params.get("error");

    if (gError) {
      setError(decodeURIComponent(gError));
      return;
    }
    if (!code) {
      setError("Código de autorização ausente.");
      return;
    }

    exchange({ data: { code, redirectUri: googleCallbackUri() } })
      .then(() => navigate({ to: "/dashboard", replace: true }))
      .catch((e) => setError(e?.message || "Falha ao conectar com o Google."));
  }, [exchange, navigate]);

  return (
    <div className="max-w-md mx-auto px-6 py-24 text-center">
      {error ? (
        <>
          <h1 className="font-display text-2xl text-primary">Não foi possível conectar</h1>
          <p className="mt-4 text-sm text-muted-foreground">{error}</p>
          <button
            onClick={() => navigate({ to: "/dashboard", replace: true })}
            className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Voltar ao dashboard
          </button>
        </>
      ) : (
        <>
          <Loader2 className="mx-auto size-8 animate-spin text-primary" />
          <p className="mt-4 text-sm text-muted-foreground">Conectando sua conta do Google…</p>
        </>
      )}
    </div>
  );
}
