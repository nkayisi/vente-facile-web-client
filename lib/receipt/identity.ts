/**
 * En-tête et pied communs à tous les documents imprimés.
 *
 * La base porte depuis toujours `logo`, `address`, `city`, `phone`, `rccm`,
 * `id_nat` et `tax_id` sur l'organisation : rien ne les imprimait. Les tickets
 * sortaient avec le seul nom de la boutique, sans même l'adresse, ce qui est un
 * problème d'identification autant que de conformité pour un commerçant en RDC.
 */

import { compact, type Block } from "./blocks";

export interface OrgIdentity {
  name: string;
  address?: string;
  city?: string;
  country?: string;
  phone?: string;
  email?: string;
  /** Registre du commerce. */
  rccm?: string;
  /** Identification nationale. */
  idNat?: string;
  /** Numéro impôt. */
  taxId?: string;
  logo?: LoadedLogo;
}

export interface LoadedLogo {
  dataUrl: string;
  format: "PNG" | "JPEG";
  aspectRatio: number;
}

export interface ReceiptChrome {
  org: OrgIdentity;
  /**
   * En-tête libre saisi par le marchand. Il COMPLÈTE désormais le bloc
   * d'identité au lieu de le remplacer : l'ancien générateur écrasait nom,
   * adresse et téléphone dès qu'un en-tête personnalisé existait, si bien qu'un
   * marchand qui voulait ajouter un slogan perdait ses coordonnées.
   */
  header?: string;
  footer?: string;
}

function lines(value: string | undefined): string[] {
  return (value ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

/** « 12 av. Kasavubu, Goma » à partir des champs séparés. */
function locality(org: OrgIdentity): string | undefined {
  const parts = [org.address, org.city].map((p) => p?.trim()).filter(Boolean);
  return parts.length ? parts.join(", ") : undefined;
}

/**
 * Mentions légales, une par ligne.
 *
 * Les enchaîner sur une même ligne les faisait couper n'importe où au repli
 * (« ... · ID Nat » puis « 01-H5300-N12345 · NIF ... »), ce qui rend un numéro
 * d'identification illisible. Trois lignes de 7 pt tiennent sans se scinder.
 */
function legalMentions(org: OrgIdentity): string[] {
  return [
    org.rccm?.trim() ? `RCCM ${org.rccm.trim()}` : "",
    org.idNat?.trim() ? `ID Nat ${org.idNat.trim()}` : "",
    org.taxId?.trim() ? `NIF ${org.taxId.trim()}` : "",
  ].filter(Boolean);
}

/** Blocs d'en-tête : logo, identité, coordonnées, mentions légales. */
export function orgHeaderBlocks(chrome: ReceiptChrome): Block[] {
  const { org } = chrome;
  const place = locality(org);
  const legal = legalMentions(org);

  return compact<Block>([
    org.logo && {
      kind: "logo",
      dataUrl: org.logo.dataUrl,
      format: org.logo.format,
      aspectRatio: org.logo.aspectRatio,
    },
    { kind: "text", text: org.name.toUpperCase(), role: "orgName", align: "center" },
    place && { kind: "text", text: place, role: "label", align: "center" },
    org.phone?.trim() && {
      kind: "text",
      text: `Tél. ${org.phone.trim()}`,
      role: "label",
      align: "center",
    },
    org.email?.trim() && {
      kind: "text",
      text: org.email.trim(),
      role: "legal",
      align: "center",
    },
    ...legal.map(
      (line): Block => ({ kind: "text", text: line, role: "legal", align: "center" })
    ),
    ...lines(chrome.header).map(
      (line): Block => ({ kind: "text", text: line, role: "label", align: "center" })
    ),
    { kind: "space", size: "xs" },
    { kind: "rule", weight: "heavy" },
  ]);
}

/**
 * Blocs de pied. `defaultLines` sert quand le marchand n'a rien personnalisé :
 * chaque document propose sa propre formule de politesse.
 */
export function footerBlocks(chrome: ReceiptChrome, defaultLines: string[]): Block[] {
  const custom = lines(chrome.footer);
  const body = custom.length ? custom : defaultLines;

  return compact<Block>([
    { kind: "space", size: "sm" },
    ...body.map(
      (line): Block => ({ kind: "text", text: line, role: "label", align: "center" })
    ),
    { kind: "space", size: "xs" },
    {
      kind: "text",
      text: "Powered by Vente Facile",
      role: "legal",
      align: "center",
      muted: true,
    },
  ]);
}

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
