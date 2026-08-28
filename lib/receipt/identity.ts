/**
 * Réexport depuis `@vente-facile/core`, plus le chargement du logo.
 *
 * Les blocs d'en-tête et de pied décrivent le document : ils vivent dans le
 * paquet partagé, avec le reste du modèle de ticket. `loadLogo` reste ici :
 * charger une image et l'aplatir passe par `Image` et `canvas` sur le web, et
 * par le système de fichiers sur mobile. Le paquet reçoit un `LoadedLogo` déjà
 * construit, il ne le fabrique jamais.
 */

export {
  orgHeaderBlocks,
  footerBlocks,
} from "@vente-facile/core/receipt";

export type {
  OrgIdentity,
  LoadedLogo,
  ReceiptChrome,
} from "@vente-facile/core/receipt";

import type { LoadedLogo } from "@vente-facile/core/receipt";

/**
 * Charge le logo en dataURL, avec son rapport d'aspect.
 *
 * Volontairement tolérant : un logo injoignable, une URL expirée ou un canvas
 * bloqué par CORS ne doit jamais empêcher d'imprimer un reçu. On rend `null` et
 * le bloc disparaît.
 */
export async function loadLogo(url: string | undefined): Promise<LoadedLogo | null> {
  if (!url || typeof window === "undefined") return null;
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("logo unreachable"));
      img.src = url;
    });

    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;
    if (!canvas.width || !canvas.height) return null;

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    // Fond blanc : un PNG à fond transparent vire au noir une fois aplati, et
    // sur une imprimante thermique cela sort en pavé d'encre.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0);

    return {
      dataUrl: canvas.toDataURL("image/png"),
      format: "PNG",
      aspectRatio: canvas.width / canvas.height,
    };
  } catch {
    return null;
  }
}
