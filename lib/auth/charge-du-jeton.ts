/**
 * La charge utile d'un JWT, lue SANS en vérifier la signature.
 *
 * ⚠ Une LECTURE, jamais une preuve : rien de ce qui en sort n'ouvre un droit. Le
 * serveur vérifie chaque jeton qu'il reçoit ; on ne lit ici que ce qu'il nous a
 * lui-même remis, pour savoir de quelle session on parle.
 *
 * ⚠ `atob` et non `Buffer` : ce module est aussi chargé par le middleware, qui
 * peut tourner hors de Node. Les revendications lues ici sont en ASCII.
 *
 * Module PUR, importable du serveur comme du navigateur.
 */
export function chargeDuJeton(jeton: unknown): Record<string, unknown> | null {
  if (typeof jeton !== "string") return null;
  const corps = jeton.split(".")[1];
  if (!corps) return null;
  try {
    const json: unknown = JSON.parse(atob(corps.replace(/-/g, "+").replace(/_/g, "/")));
    return json && typeof json === "object" && !Array.isArray(json)
      ? (json as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
