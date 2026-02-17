import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Couleur principale orange (brand color)
const BRAND_COLOR: [number, number, number] = [249, 115, 22];
const HEADER_BG: [number, number, number] = [245, 245, 245];
const HEADER_TEXT: [number, number, number] = [51, 51, 51];

export interface PDFDocumentOptions {
  title: string;
  subtitle?: string;
  organizationName: string;
  orientation?: "portrait" | "landscape";
}

export interface PDFSummaryItem {
  label: string;
  value: string;
  color?: "green" | "red" | "blue" | "default";
}

/**
 * Crée un nouveau document PDF avec en-tête standardisé
 */
export function createPDFDocument(options: PDFDocumentOptions): { doc: jsPDF; y: number; pageWidth: number } {
  const doc = new jsPDF({
    orientation: options.orientation || "portrait",
    unit: "mm",
    format: "a4",
  });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  // Titre principal
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(options.title, pageWidth / 2, y, { align: "center" });
  y += 7;

  // Nom de l'organisation
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(options.organizationName, pageWidth / 2, y, { align: "center" });
  y += 5;

  // Sous-titre (période, date, etc.)
  if (options.subtitle) {
    doc.setFontSize(10);
    doc.text(options.subtitle, pageWidth / 2, y, { align: "center" });
    y += 5;
  }

  // Date d'impression
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  doc.text(`Imprimé le ${new Date().toLocaleString("fr-CD")}`, pageWidth / 2, y, { align: "center" });
  doc.setTextColor(0, 0, 0);
  y += 8;

  // Ligne de séparation
  doc.setDrawColor(200, 200, 200);
  doc.line(14, y, pageWidth - 14, y);
  y += 6;

  return { doc, y, pageWidth };
}

/**
 * Ajoute une section de résumé avec des valeurs clés
 */
export function addSummarySection(
  doc: jsPDF,
  y: number,
  pageWidth: number,
  items: PDFSummaryItem[]
): number {
  doc.setFontSize(9);
  const colWidth = (pageWidth - 28) / items.length;

  items.forEach((item, index) => {
    const x = 14 + index * colWidth;

    // Label
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(item.label, x, y);

    // Valeur
    doc.setFont("helvetica", "bold");
    if (item.color === "green") doc.setTextColor(22, 163, 74);
    else if (item.color === "red") doc.setTextColor(220, 38, 38);
    else if (item.color === "blue") doc.setTextColor(37, 99, 235);
    else doc.setTextColor(0, 0, 0);
    doc.text(item.value, x, y + 5);
  });

  doc.setTextColor(0, 0, 0);
  return y + 14;
}

/**
 * Ajoute un tableau avec style standardisé
 */
export function addTable(
  doc: jsPDF,
  startY: number,
  head: string[][],
  body: (string | number)[][],
  options?: {
    columnStyles?: Record<number, { halign?: "left" | "center" | "right"; cellWidth?: number }>;
    useAlternateRowColors?: boolean;
    highlightColumn?: number;
  }
): number {
  autoTable(doc, {
    startY,
    head,
    body,
    theme: "grid",
    tableWidth: "auto",
    styles: {
      fontSize: 8,
      cellPadding: 2,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: BRAND_COLOR,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "center",
    },
    alternateRowStyles: options?.useAlternateRowColors ? { fillColor: [250, 250, 250] } : undefined,
    columnStyles: options?.columnStyles,
    margin: { left: 14, right: 14 },
    didParseCell: (hookData) => {
      // Colorer les valeurs positives/négatives
      if (hookData.section === "body") {
        const val = String(hookData.cell.raw);
        if (val.startsWith("+")) {
          hookData.cell.styles.textColor = [22, 163, 74];
        } else if (val.startsWith("-") && !val.startsWith("-0") && val !== "-") {
          hookData.cell.styles.textColor = [220, 38, 38];
        }
        // Colonne de cumul en bleu
        if (options?.highlightColumn !== undefined && hookData.column.index === options.highlightColumn) {
          hookData.cell.styles.textColor = [37, 99, 235];
          hookData.cell.styles.fontStyle = "bold";
        }
      }
    },
  });

  return (doc as any).lastAutoTable.finalY;
}

/**
 * Ajoute une section de signatures toujours positionnée en bas de la page
 */
export function addSignatureSection(doc: jsPDF, y: number, pageWidth: number, labels: string[]): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  const signatureHeight = 25; // Hauteur nécessaire pour les signatures
  const bottomMargin = 20; // Marge en bas de page

  // Position Y pour les signatures (toujours en bas de page)
  let signatureY = pageHeight - bottomMargin - signatureHeight;

  // Si le contenu dépasse la zone de signature, ajouter une nouvelle page
  if (y > signatureY - 10) {
    doc.addPage();
    signatureY = pageHeight - bottomMargin - signatureHeight;
  }

  doc.setDrawColor(0, 0, 0);
  doc.setFontSize(8);

  const spacing = (pageWidth - 60) / (labels.length - 1 || 1);

  labels.forEach((label, index) => {
    const x = 30 + index * spacing;
    doc.line(x - 25, signatureY, x + 25, signatureY);
    doc.text(label, x, signatureY + 5, { align: "center" });
  });

  return signatureY + 15;
}

/**
 * Formate un nombre pour l'affichage PDF (avec espace comme séparateur de milliers)
 */
export function formatNumberForPDF(value: string | number, decimals: number = 2): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "0";

  // Utiliser fr-FR puis remplacer l'espace fine insécable (U+202F) par un espace normal
  // (jsPDF affiche l'espace fine insécable comme un "/")
  const formatted = num.toLocaleString("fr-FR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return formatted.replace(/\u202F/g, " ");
}

/**
 * Formate un montant en CDF pour l'affichage PDF (espace comme séparateur)
 */
export function formatCurrencyForPDF(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "0,00 CDF";

  // Utiliser fr-FR puis remplacer l'espace fine insécable (U+202F) par un espace normal
  // (jsPDF affiche l'espace fine insécable comme un "/")
  const formatted = num.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return formatted.replace(/\u202F/g, " ") + " CDF";
}

/**
 * Formate une date pour l'affichage PDF
 */
export function formatDateForPDF(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("fr-CD", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Formate un mois pour l'affichage PDF
 */
export function formatMonthForPDF(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("fr-CD", {
    month: "long",
    year: "numeric",
  });
}
