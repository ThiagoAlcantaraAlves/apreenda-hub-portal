// Shared Asaas helper (production)
export const ASAAS_BASE = "https://api.asaas.com/v3";

export function asaasHeaders() {
  const key = Deno.env.get("ASAAS_API_KEY");
  if (!key) throw new Error("ASAAS_API_KEY not configured");
  return {
    "Content-Type": "application/json",
    "User-Agent": "Apreenda/1.0",
    access_token: key,
  };
}

export async function asaasFetch(path: string, init: RequestInit = {}) {
  const res = await fetch(`${ASAAS_BASE}${path}`, {
    ...init,
    headers: { ...asaasHeaders(), ...(init.headers as Record<string, string> || {}) },
  });
  const text = await res.text();
  let body: any;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) {
    console.error("Asaas error", res.status, body);
    throw new Error(`Asaas ${res.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

// Get or create a customer in Asaas for the given user
export async function getOrCreateCustomer(opts: {
  name: string;
  email: string;
  cpfCnpj?: string;
  phone?: string;
  existingId?: string | null;
}) {
  if (opts.existingId) {
    try {
      return await asaasFetch(`/customers/${opts.existingId}`);
    } catch (_) {
      // fall through to lookup/create
    }
  }
  // Try lookup by email
  const search = await asaasFetch(`/customers?email=${encodeURIComponent(opts.email)}`);
  if (search?.data?.length) return search.data[0];
  return await asaasFetch("/customers", {
    method: "POST",
    body: JSON.stringify({
      name: opts.name,
      email: opts.email,
      cpfCnpj: opts.cpfCnpj,
      mobilePhone: opts.phone,
    }),
  });
}
