import {
  TAILLE_VIGNETTE,
  TYPE_VIGNETTE,
  vignetteSociale,
} from "@/lib/seo/vignette";

/**
 * La vignette de l'accueil, ET LE REPLI DE TOUT LE GROUPE.
 *
 * Un `opengraph-image` posé sur un segment est HÉRITÉ par ses enfants : une page
 * qui n'en déclare pas reçoit celle-ci. Aucune page publique ne peut donc se
 * partager sans image, même si l'on oublie la sienne. Son texte est volontairement
 * celui de la MARQUE et non celui de l'accueil, pour rester vrai en repli.
 */
export const size = TAILLE_VIGNETTE;
export const contentType = TYPE_VIGNETTE;
export const alt =
  "Vente Facile : la caisse, le stock et le crédit client des commerces de la RDC.";

export default function Image() {
  return vignetteSociale({
    titre: "La caisse qui n'attend pas le réseau.",
    accroche:
      "Caisse, stock et crédit client pour les commerces de la RDC. En francs et en dollars.",
  });
}
