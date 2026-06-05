import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacidade")({
  component: PrivacidadePage,
});

function PrivacidadePage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-display text-3xl text-primary">Política de Privacidade</h1>
      <p className="mt-2 text-xs text-muted-foreground">Última atualização: junho de 2026</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-foreground">
        <p>
          O Apreenda Dashboard ("nós") é um produto da Apreenda Digital que analisa dados de
          marketing digital das contas que você conecta voluntariamente.
        </p>

        <section>
          <h2 className="font-semibold text-primary mb-2">Dados que coletamos</h2>
          <p>
            <strong>Dados de cadastro:</strong> nome e e-mail, para criar sua conta.{" "}
            <strong>Tokens de acesso OAuth:</strong> ao conectar suas contas Meta
            (Facebook/Instagram Ads) e Google (Google Ads e Google Analytics), recebemos tokens
            de acesso autorizados por você, armazenados de forma segura e nunca expostos no
            navegador. <strong>Métricas de marketing:</strong> dados de desempenho de campanhas,
            anúncios e analytics (investimento, impressões, cliques, conversões e similares) das
            contas que você selecionar, em modo somente leitura.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-primary mb-2">O que NÃO fazemos</h2>
          <p>
            Não vendemos nem compartilhamos seus dados com terceiros. Não publicamos, criamos ou
            alteramos nada nas suas contas — o acesso é somente leitura. Não coletamos dados
            pessoais de quem interagiu com seus anúncios.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-primary mb-2">Como usamos os dados</h2>
          <p>
            Exclusivamente para exibir análises, relatórios e recomendações dentro do seu
            dashboard.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-primary mb-2">Armazenamento e segurança</h2>
          <p>
            Os dados ficam em infraestrutura segura (Supabase), com criptografia em trânsito e em
            repouso e controle de acesso por usuário (RLS).
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-primary mb-2">Seus direitos (LGPD)</h2>
          <p>
            Você pode solicitar acesso, correção ou exclusão dos seus dados a qualquer momento.
            Para revogar o acesso às suas contas, desconecte-as no dashboard ou remova a
            autorização nas configurações da Meta/Google. Veja também a página{" "}
            <a href="/exclusao-de-dados" className="text-primary underline">Exclusão de Dados</a>.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-primary mb-2">Contato</h2>
          <p>E-mail: talcalves@gmail.com</p>
        </section>
      </div>
    </div>
  );
}
