import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/exclusao-de-dados")({
  component: ExclusaoDeDadosPage,
});

function ExclusaoDeDadosPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-display text-3xl text-primary">Exclusão de Dados</h1>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-foreground">
        <p>Você pode excluir seus dados do Apreenda Dashboard de três formas:</p>

        <section>
          <h2 className="font-semibold text-primary mb-2">1. Pelo dashboard</h2>
          <p>
            Na página de conexão de contas, desconecte suas contas Meta/Google. Os tokens de
            acesso são removidos imediatamente.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-primary mb-2">2. Pela Meta</h2>
          <p>
            Em Configurações e privacidade → Configurações → Apps e sites → remova o
            "Apreenda Dashboard". Ao receber o aviso da Meta, excluímos todos os dados
            associados à sua conta.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-primary mb-2">3. Por solicitação</h2>
          <p>
            Envie um e-mail para <strong>talcalves@gmail.com</strong> com o assunto
            "Exclusão de dados" e o e-mail da sua conta. Confirmaremos a exclusão completa em
            até 7 dias.
          </p>
        </section>

        <p>
          A exclusão remove: tokens de acesso, lista de contas conectadas e dados de métricas
          armazenados.
        </p>
      </div>
    </div>
  );
}
