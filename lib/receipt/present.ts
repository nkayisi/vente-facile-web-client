/**
 * Présentation du PDF produit.
 *
 * Le ticket n'est pas imprimé par le navigateur : il est relayé à Thermer (ou à
 * toute application d'impression) via un onglet et un téléchargement. D'où la
 * contrainte qui gouverne tout ce module : l'onglet doit être ouvert
 * SYNCHRONEMENT sur le geste de l'utilisateur, avant tout appel réseau, sinon le
 * bloqueur de fenêtres surgissantes l'annule.
 */

export type PresentResult = "opened" | "downloaded";

const REVOKE_OPEN_MS = 180_000;
const REVOKE_DOWNLOAD_MS = 120_000;

function download(pdfUrl: string, filename: string): void {
  const a = document.createElement("a");
  a.href = pdfUrl;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Ouvre un onglet vierge, à appeler sur le clic.
 *
 * Ne pas passer `noopener` : la référence de fenêtre serait nulle alors que
 * l'onglet s'ouvre quand même, et l'assignation de l'URL en ouvrirait un second.
 */
export function openPrintTab(): Window | null {
  return window.open("about:blank", "_blank");
}

/** Referme l'onglet pré-ouvert quand l'opération est abandonnée. */
export function closePrintTab(w: Window | null): void {
  if (w && !w.closed) {
    try {
      w.close();
    } catch {
      /* l'onglet a pu être fermé par l'utilisateur entre-temps */
    }
  }
}

/** Ouvre le PDF dans un nouvel onglet et l'enregistre. */
export function openPdf(pdfUrl: string, filename: string): PresentResult {
  download(pdfUrl, filename);
  const w = window.open(pdfUrl, "_blank", "noopener,noreferrer");
  if (w) {
    setTimeout(() => URL.revokeObjectURL(pdfUrl), REVOKE_OPEN_MS);
    return "opened";
  }
  setTimeout(() => URL.revokeObjectURL(pdfUrl), REVOKE_DOWNLOAD_MS);
  return "downloaded";
}

/** Envoie le PDF dans l'onglet pré-ouvert, ou se rabat sur `openPdf`. */
export function assignToPrintTab(
  printTab: Window | null,
  pdfUrl: string,
  filename: string
): PresentResult {
  if (printTab && !printTab.closed) {
    printTab.location.replace(pdfUrl);
    download(pdfUrl, filename);
    setTimeout(() => URL.revokeObjectURL(pdfUrl), REVOKE_OPEN_MS);
    return "opened";
  }
  return openPdf(pdfUrl, filename);
}

/** Message affiché après présentation, identique partout. */
export function presentMessage(result: PresentResult): string {
  return result === "opened"
    ? "Reçu ouvert et enregistré : utilisez Thermer ou Partager pour imprimer."
    : "Reçu téléchargé : l'onglet n'a pas pu s'ouvrir, ouvrez le fichier dans Thermer.";
}
