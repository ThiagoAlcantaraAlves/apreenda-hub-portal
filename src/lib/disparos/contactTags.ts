// Known unit names (carryover from the original Rede Lina deployment).
// In the Hub each user has their own units, so these only act as suggestions for
// the "own / franchise" quick-filter — when a tag matches one of these it's
// recognized as a unit, otherwise it shows up under "roles/cargos".
export const KNOWN_UNITS = new Set([
  "Araraquara", "B. - Express", "Barretos", "Baviera", "Brasília",
  "Camelot", "Campinas", "Caxias do Sul", "Express Curitiba",
  "Goiania", "Heads", "Jundiai", "Manaus", "Mumbai", "Palhoça",
  "Poeme", "Ribeirao Preto", "Rio Preto", "RV", "Taiko",
  "Tubarão", "Vale dos Sinos", "Villages", "Xangai", "Zaya",
  "Zeax", "Zona Sul",
]);

export const FRANCHISE_UNITS = new Set([
  "Manaus", "Express Curitiba", "Poeme",
]);

export function classifyTags(contacts: { tags?: string[] | null }[]) {
  const allTags = Array.from(new Set(contacts.flatMap((c) => c.tags || [])));
  const units = allTags.filter((t) => KNOWN_UNITS.has(t)).sort();
  const roles = allTags.filter((t) => !KNOWN_UNITS.has(t)).sort();
  return { allTags: allTags.sort(), units, roles };
}
