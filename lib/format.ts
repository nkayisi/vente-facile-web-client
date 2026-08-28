/**
 * Réexport depuis `@vente-facile/core`, plus ce qui ne peut pas en faire partie.
 *
 * Le formatage vit désormais dans le paquet partagé : c'est ce qui garantit
 * qu'un montant s'écrit pareil à l'écran, sur un ticket et sur un rapport,
 * quelle que soit la surface. `getMediaUrl` reste ici parce qu'elle lit une
 * variable d'environnement Next : sur mobile, la même résolution part d'une
 * autre base et se fait dans le client HTTP.
 *
 * Rappel de doctrine, portée par le paquet : **les montants s'écrivent TOUJOURS
 * en entier.** Quand un montant ne tient pas, c'est la taille du texte qui
 * cède, jamais le nombre de chiffres.
 */

export {
  setDefaultCurrency,
  getDefaultCurrency,
  formatPrice,
  formatNumber,
  formatDecimal,
  formatPriceValue,
  formatPercent,
  formatDate,
  formatDateTime,
  formatPoints,
} from "@vente-facile/core";

/**
 * Résout une URL media relative du backend Django en URL absolue.
 * Ex: "/media/users/avatars/photo.jpg" → "http://localhost:8005/media/users/avatars/photo.jpg"
 */
export function getMediaUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const baseUrl = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8005/api/v1").replace("/api/v1", "");
  return `${baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;
}
