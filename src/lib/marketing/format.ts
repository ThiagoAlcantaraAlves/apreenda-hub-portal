const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 2,
});
const NUM = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const NUM2 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

export const formatBRL = (v: number) => BRL.format(Number.isFinite(v) ? v : 0);
export const formatNumber = (v: number) => NUM.format(Number.isFinite(v) ? v : 0);
export const formatDecimal = (v: number) => NUM2.format(Number.isFinite(v) ? v : 0);
export const formatPercent = (v: number, digits = 2) =>
  `${(Number.isFinite(v) ? v : 0).toFixed(digits).replace(".", ",")}%`;
export const formatDuration = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}m ${sec.toString().padStart(2, "0")}s`;
};

export const formatDateBR = (iso: string, withYear = true) => {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = withYear ? String(d.getFullYear()).slice(2) : "";
  return withYear ? `${day}/${month}/${year}` : `${day}/${month}`;
};

export const formatRange = (start: string, end: string) =>
  `${formatDateBR(start)} a ${formatDateBR(end)}`;
