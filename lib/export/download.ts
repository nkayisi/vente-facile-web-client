import type { ExportFile } from "./fetch-export";

export type { ExportFile } from "./fetch-export";
export type { ExportFormat } from "./fetch-export";

/**
 * Remet un fichier d'export à l'utilisateur.
 *
 * La séquence `Uint8Array -> Blob -> ancre -> revokeObjectURL` était recopiée
 * dans chaque page qui exporte ; oublier le `revokeObjectURL` laisse le binaire
 * en mémoire pour toute la durée de vie de l'onglet, ce qui pèse vite avec des
 * rapports de plusieurs mégaoctets.
 */
export function downloadExportFile(file: ExportFile): void {
  const blob = new Blob([new Uint8Array(file.data)], { type: file.contentType });
  const url = window.URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  window.URL.revokeObjectURL(url);
}
