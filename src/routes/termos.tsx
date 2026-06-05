import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/termos")({
  component: TermosPage,
});

function TermosPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-display text-3xl text-primary">Termos de Uso</h1>
      <p className="mt-2 text-xs text-muted-foreground">Última atualização: junho de 2026</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-foreground">
        <p>
          Ao usar o Apreenda Dashboard, produto da Apreenda Digital, você concorda com estes
          termos. Se não concordar, não utilize o serviço.
        </p>

        <section>
          <h2 className="font-semibold text-primary mb-2">O serviço</h2>
          <p>
            O Apreenda Dashboard exibe, em modo somente leitura, métricas das contas de marketing
            (Meta Ads, Google Ads, Google Analytics) que você conectar voluntariamente. Não
            criamos, alteramos nem pausamos nada nas suas contas.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-primary mb-2">Teste grátis</h2>
          <p>
            Novos usuários têm um período de teste de 30 dias a partir da primeira conexão de
            conta. Após esse período, o acesso pode ser bloqueado até a contratação de um plano.
            Podemos alterar as condições do teste a qualquer momento.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-primary mb-2">Suas responsabilidades</h2>
          <p>
            Você é responsável por manter suas credenciais seguras e por ter autorização para
            conectar as contas de anúncio que vincular. O uso deve respeitar os termos da Meta e
            do Google.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-primary mb-2">Disponibilidade e limitação</h2>
          <p>
            O serviço é fornecido "como está". Não garantimos disponibilidade ininterrupta nem
            nos responsabilizamos por decisões tomadas com base nos dados exibidos. Os dados são
            obtidos das APIs da Meta e do Google e podem sofrer atrasos ou indisponibilidade.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-primary mb-2">Privacidade e dados</h2>
          <p>
            O tratamento de dados segue nossa{" "}
            <a href="/privacidade" className="text-primary underline">Política de Privacidade</a>.
            Você pode excluir seus dados a qualquer momento — veja{" "}
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
