/**
 * Receipt Printer Utility for Thermal Printers (58mm / 80mm)
 * Generates PDF receipts with exact thermal paper dimensions (Thermer-compatible).
 * Uses jsPDF with dynamic height based on wrapped content.
 */

import { jsPDF } from "jspdf";

export interface ReceiptItem {
  name: string;
  quantity: number;
  unit_price: number;
  discount_percentage: number;
  total: number;
}

export interface ReceiptPayment {
  method: string;
  amount: number;
  currency: string;
}

export interface ReceiptData {
  orgName: string;
  orgAddress?: string;
  orgPhone?: string;
  registerName?: string;
  cashierName?: string;
  reference: string;
  date: string;
  customerName?: string;
  customerPhone?: string;
  items: ReceiptItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  globalDiscountPercent: number;
  total: number;
  payments: ReceiptPayment[];
  amountPaid: number;
  change: number;
  currency: string;
  receiptHeader?: string;
  receiptFooter?: string;
  isCreditSale?: boolean;
  amountDue?: number;
  showLoyaltyPoints?: boolean;
  loyaltyPointsEarned?: number;
  loyaltyPointsBalance?: number;
}

type PaperWidth = 58 | 80;

const FONT_SIZE_NORMAL = 11;
const FONT_SIZE_SMALL = 9;
const LINE_HEIGHT = 4.2;
const LINE_HEIGHT_SMALL = 3.5;
const MARGIN = 2.5;
/** Espace blanc au-dessus de l’en-tête (mm) — confort sur imprimante thermique / Thermer */
const TOP_MARGIN_BEFORE_HEADER = 5;

const DEFAULT_REVOKE_OPEN_MS = 180_000;
const DEFAULT_REVOKE_DOWNLOAD_MS = 120_000;

function pdfDocOptions(paperWidth: number, height: number) {
  return {
    orientation: "portrait" as const,
    unit: "mm" as const,
    format: [paperWidth, height] as [number, number],
    compress: true,
  };
}

function formatAmount(amount: number, decimals: number = 2): string {
  const formatted = amount.toFixed(decimals);
  const parts = formatted.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return parts.join(".");
}

function formatAmountWithCurrency(amount: number, currency: string, decimals: number = 2): string {
  return `${formatAmount(amount, decimals)} ${currency}`;
}

/** Line count for text wrapped like jsPDF splitTextToSize (mm width, helvetica). */
function wrappedLineCount(
  measureDoc: jsPDF,
  text: string,
  maxWidthMm: number,
  fontSize: number,
  bold: boolean
): number {
  measureDoc.setFontSize(fontSize);
  measureDoc.setFont("helvetica", bold ? "bold" : "normal");
  return measureDoc.splitTextToSize(text, maxWidthMm).length;
}

function estimateSaleReceiptHeightMm(data: ReceiptData, paperWidth: PaperWidth): number {
  const contentWidth = paperWidth - MARGIN * 2;
  const itemNameMaxW = contentWidth * 0.4;
  const m = new jsPDF(pdfDocOptions(paperWidth, 400));
  let h = MARGIN + TOP_MARGIN_BEFORE_HEADER + 1;

  if (data.receiptHeader) {
    for (const raw of data.receiptHeader.split("\n")) {
      const n = wrappedLineCount(m, raw.trim(), contentWidth, FONT_SIZE_SMALL, false);
      h += Math.max(1, n) * LINE_HEIGHT_SMALL;
    }
  } else {
    h +=
      wrappedLineCount(m, data.orgName.toUpperCase(), contentWidth, FONT_SIZE_NORMAL, true) * LINE_HEIGHT;
    if (data.orgAddress) {
      h += wrappedLineCount(m, data.orgAddress, contentWidth, FONT_SIZE_SMALL, false) * LINE_HEIGHT_SMALL;
    }
    if (data.orgPhone) {
      h +=
        wrappedLineCount(m, `Tel: ${data.orgPhone}`, contentWidth, FONT_SIZE_SMALL, false) *
        LINE_HEIGHT_SMALL;
    }
  }

  h += 0.5 + LINE_HEIGHT_SMALL;

  if (data.isCreditSale) {
    h += LINE_HEIGHT + LINE_HEIGHT_SMALL;
  }

  h += 2 * LINE_HEIGHT_SMALL;
  if (data.registerName) h += LINE_HEIGHT_SMALL;
  if (data.cashierName) h += LINE_HEIGHT_SMALL;
  if (data.customerName) {
    h += LINE_HEIGHT_SMALL;
    if (data.customerPhone) h += LINE_HEIGHT_SMALL;
  }
  h += LINE_HEIGHT_SMALL;

  h += 0.5 + LINE_HEIGHT_SMALL + LINE_HEIGHT_SMALL;

  for (const item of data.items) {
    const nameLines = wrappedLineCount(m, item.name, itemNameMaxW, FONT_SIZE_SMALL, false);
    h += Math.max(1, nameLines) * LINE_HEIGHT_SMALL;
    if (item.discount_percentage > 0) h += LINE_HEIGHT_SMALL;
  }

  h += LINE_HEIGHT_SMALL;

  h += LINE_HEIGHT_SMALL;
  if (data.discountAmount > 0) h += LINE_HEIGHT_SMALL;
  if (data.taxAmount > 0) h += LINE_HEIGHT_SMALL;
  h += 0.5 + LINE_HEIGHT_SMALL + LINE_HEIGHT + LINE_HEIGHT_SMALL;

  h += 1;
  h += data.payments.length * LINE_HEIGHT_SMALL;
  if (data.change > 0) h += LINE_HEIGHT_SMALL;
  if (data.isCreditSale && data.amountDue && data.amountDue > 0) h += LINE_HEIGHT_SMALL;

  if (data.showLoyaltyPoints && data.loyaltyPointsEarned && data.loyaltyPointsEarned > 0) {
    h += 1 + LINE_HEIGHT_SMALL + LINE_HEIGHT_SMALL * 2;
    if (data.loyaltyPointsBalance !== undefined) h += LINE_HEIGHT_SMALL;
  }

  h += 1;
  if (data.receiptFooter) {
    for (const raw of data.receiptFooter.split("\n")) {
      const n = wrappedLineCount(m, raw.trim(), contentWidth, FONT_SIZE_SMALL, false);
      h += Math.max(1, n) * LINE_HEIGHT_SMALL;
    }
  } else {
    h += LINE_HEIGHT_SMALL * 2;
  }

  h += 1 + LINE_HEIGHT_SMALL;

  return h + MARGIN + 6;
}

export type ThermalPdfPresentResult = "opened" | "downloaded";

function downloadThermalPdf(pdfUrl: string, filename: string = "recu.pdf"): void {
  const a = document.createElement("a");
  a.href = pdfUrl;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Open the PDF in a new tab for viewing / sharing to Thermer, and save the file (download).
 * Falls back to download-only if the popup is blocked.
 */
export function openThermalPdf(
  pdfUrl: string,
  options?: { filename?: string; revokeAfterMs?: number }
): ThermalPdfPresentResult {
  const filename = options?.filename ?? "recu.pdf";
  const revokeMs = options?.revokeAfterMs ?? DEFAULT_REVOKE_OPEN_MS;
  downloadThermalPdf(pdfUrl, filename);
  const w = window.open(pdfUrl, "_blank", "noopener,noreferrer");
  if (w) {
    setTimeout(() => URL.revokeObjectURL(pdfUrl), revokeMs);
    return "opened";
  }
  setTimeout(() => URL.revokeObjectURL(pdfUrl), DEFAULT_REVOKE_DOWNLOAD_MS);
  return "downloaded";
}

/**
 * Use when a tab was opened synchronously (e.g. about:blank before an async sale).
 * Navigates that tab to the blob URL; falls back to openThermalPdf if the tab is missing or closed.
 */
export function assignPdfToPrintWindow(
  printWindow: Window | null,
  pdfUrl: string,
  options?: { filename?: string; revokeAfterMs?: number }
): ThermalPdfPresentResult {
  const revokeMs = options?.revokeAfterMs ?? DEFAULT_REVOKE_OPEN_MS;
  const filename = options?.filename ?? "recu.pdf";
  if (printWindow && !printWindow.closed) {
    printWindow.location.replace(pdfUrl);
    downloadThermalPdf(pdfUrl, filename);
    setTimeout(() => URL.revokeObjectURL(pdfUrl), revokeMs);
    return "opened";
  }
  return openThermalPdf(pdfUrl, { filename, revokeAfterMs: revokeMs });
}

/**
 * Open a blank tab synchronously on user gesture; returns null if blocked.
 * Do not pass `noopener`: the window reference would be null while the tab still opens,
 * which would trigger a second tab when assigning the PDF URL.
 */
export function openPrintTab(): Window | null {
  return window.open("about:blank", "_blank");
}

/**
 * Close a pre-opened print tab when the operation is aborted (validation error, API failure).
 */
export function closePrintTabIfBlank(w: Window | null): void {
  if (w && !w.closed) {
    try {
      w.close();
    } catch {
      /* ignore */
    }
  }
}

/**
 * Generate a PDF receipt and return the blob URL.
 */
export function generateReceiptPdfUrl(data: ReceiptData, paperWidth: PaperWidth = 58): string {
  const contentWidth = paperWidth - (MARGIN * 2);
  const height = estimateSaleReceiptHeightMm(data, paperWidth);
  const doc = new jsPDF(pdfDocOptions(paperWidth, height));

  let y = MARGIN + TOP_MARGIN_BEFORE_HEADER + 1;
  const leftX = MARGIN;
  const rightX = paperWidth - MARGIN;
  const centerX = paperWidth / 2;
  const itemNameMaxW = contentWidth * 0.4;

  const drawCenteredText = (
    text: string,
    fontSize: number = FONT_SIZE_NORMAL,
    bold: boolean = false,
    lineHeight: number = LINE_HEIGHT
  ) => {
    doc.setFontSize(fontSize);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(text, centerX, y, { align: "center" });
    y += lineHeight;
  };

  const drawCenteredWrapped = (
    text: string,
    fontSize: number,
    bold: boolean,
    lineHeight: number
  ) => {
    doc.setFontSize(fontSize);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    const lines = doc.splitTextToSize(text.trim(), contentWidth);
    for (const line of lines) {
      doc.text(line, centerX, y, { align: "center" });
      y += lineHeight;
    }
  };

  const drawLeftText = (
    text: string,
    fontSize: number = FONT_SIZE_NORMAL,
    bold: boolean = false,
    lineHeight: number = LINE_HEIGHT
  ) => {
    doc.setFontSize(fontSize);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(text, leftX, y);
    y += lineHeight;
  };

  const drawLeftRightText = (
    left: string,
    right: string,
    fontSize: number = FONT_SIZE_NORMAL,
    bold: boolean = false,
    lineHeight: number = LINE_HEIGHT
  ) => {
    doc.setFontSize(fontSize);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(left, leftX, y);
    doc.text(right, rightX, y, { align: "right" });
    y += lineHeight;
  };

  const drawSeparator = (char: string = "-", lineHeight: number = LINE_HEIGHT_SMALL) => {
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(char === "=" ? 0.3 : 0.1);
    doc.line(leftX, y - 1, rightX, y - 1);
    y += lineHeight;
  };

  doc.setTextColor(0, 0, 0);

  if (data.receiptHeader) {
    for (const raw of data.receiptHeader.split("\n")) {
      drawCenteredWrapped(raw, FONT_SIZE_SMALL, false, LINE_HEIGHT_SMALL);
    }
  } else {
    drawCenteredWrapped(data.orgName.toUpperCase(), FONT_SIZE_NORMAL, true, LINE_HEIGHT);
    if (data.orgAddress) drawCenteredWrapped(data.orgAddress, FONT_SIZE_SMALL, false, LINE_HEIGHT_SMALL);
    if (data.orgPhone) {
      drawCenteredWrapped(`Tel: ${data.orgPhone}`, FONT_SIZE_SMALL, false, LINE_HEIGHT_SMALL);
    }
  }
  y += 0.5;
  drawSeparator("=");

  if (data.isCreditSale) {
    drawCenteredText("** VENTE A CREDIT **", FONT_SIZE_NORMAL, true);
    drawSeparator();
  }

  drawLeftText(`Recu: ${data.reference}`, FONT_SIZE_SMALL, false, LINE_HEIGHT_SMALL);
  drawLeftText(`Date: ${data.date}`, FONT_SIZE_SMALL, false, LINE_HEIGHT_SMALL);
  if (data.registerName) drawLeftText(`Caisse: ${data.registerName}`, FONT_SIZE_SMALL, false, LINE_HEIGHT_SMALL);
  if (data.cashierName) drawLeftText(`Caissier: ${data.cashierName}`, FONT_SIZE_SMALL, false, LINE_HEIGHT_SMALL);
  if (data.customerName) {
    drawLeftText(`Client: ${data.customerName}`, FONT_SIZE_SMALL, false, LINE_HEIGHT_SMALL);
    if (data.customerPhone) drawLeftText(`Tel: ${data.customerPhone}`, FONT_SIZE_SMALL, false, LINE_HEIGHT_SMALL);
  }
  drawSeparator();

  y += 0.5;
  doc.setFontSize(FONT_SIZE_SMALL);
  doc.setFont("helvetica", "normal");
  doc.text("Article", leftX, y);
  doc.text("Qte", leftX + contentWidth * 0.45, y, { align: "right" });
  doc.text("P.U.", leftX + contentWidth * 0.7, y, { align: "right" });
  doc.text("Total", rightX, y, { align: "right" });
  y += LINE_HEIGHT_SMALL;
  drawSeparator();

  const colQtyX = leftX + contentWidth * 0.45;
  const colPuX = leftX + contentWidth * 0.7;

  doc.setFont("helvetica", "normal");
  for (const item of data.items) {
    doc.setFontSize(FONT_SIZE_SMALL);
    const nameLines = doc.splitTextToSize(item.name, itemNameMaxW);
    nameLines.forEach((line: string, i: number) => {
      doc.text(line, leftX, y);
      if (i === 0) {
        doc.text(item.quantity.toString(), colQtyX, y, { align: "right" });
        doc.text(formatAmount(item.unit_price, 2), colPuX, y, { align: "right" });
        doc.text(formatAmount(item.total, 2), rightX, y, { align: "right" });
      }
      y += LINE_HEIGHT_SMALL;
    });

    if (item.discount_percentage > 0) {
      doc.setFontSize(FONT_SIZE_SMALL - 0.5);
      doc.text(`  Remise: -${item.discount_percentage}%`, leftX + 2, y);
      y += LINE_HEIGHT_SMALL;
    }
  }
  drawSeparator();

  drawLeftRightText("Sous-total", formatAmount(data.subtotal, 2), FONT_SIZE_SMALL, false, LINE_HEIGHT_SMALL);

  if (data.discountAmount > 0) {
    const discLabel =
      data.globalDiscountPercent > 0 ? `Remise (${data.globalDiscountPercent}%)` : "Remises";
    drawLeftRightText(discLabel, `-${formatAmount(data.discountAmount, 2)}`, FONT_SIZE_SMALL, false, LINE_HEIGHT_SMALL);
  }

  if (data.taxAmount > 0) {
    drawLeftRightText("Taxes (TVA)", `+${formatAmount(data.taxAmount, 2)}`, FONT_SIZE_SMALL, false, LINE_HEIGHT_SMALL);
  }

  y += 0.5;
  drawSeparator("=");
  drawLeftRightText("Total a payer", formatAmountWithCurrency(data.total, data.currency, 2), FONT_SIZE_NORMAL);
  drawSeparator("=");

  y += 1;
  for (const p of data.payments) {
    drawLeftRightText(
      p.method,
      formatAmountWithCurrency(p.amount, p.currency, 2),
      FONT_SIZE_SMALL,
      false,
      LINE_HEIGHT_SMALL
    );
  }

  if (data.change > 0) {
    drawLeftRightText(
      "Monnaie a rendre",
      formatAmountWithCurrency(data.change, data.currency, 2),
      FONT_SIZE_SMALL,
      false,
      LINE_HEIGHT_SMALL
    );
  }

  if (data.isCreditSale && data.amountDue && data.amountDue > 0) {
    drawLeftRightText(
      "Reste a payer",
      formatAmountWithCurrency(data.amountDue, data.currency, 2),
      FONT_SIZE_SMALL,
      false,
      LINE_HEIGHT_SMALL
    );
  }

  if (data.showLoyaltyPoints && data.loyaltyPointsEarned && data.loyaltyPointsEarned > 0) {
    y += 1;
    drawSeparator();
    drawCenteredText("*** POINTS DE FIDELITE ***", FONT_SIZE_SMALL, true, LINE_HEIGHT_SMALL);
    drawLeftRightText("Points gagnes", `+${data.loyaltyPointsEarned} pts`, FONT_SIZE_SMALL, false, LINE_HEIGHT_SMALL);
    if (data.loyaltyPointsBalance !== undefined) {
      drawLeftRightText("Solde total", `${data.loyaltyPointsBalance} pts`, FONT_SIZE_SMALL, true, LINE_HEIGHT_SMALL);
    }
  }

  y += 1;
  if (data.receiptFooter) {
    for (const raw of data.receiptFooter.split("\n")) {
      drawCenteredWrapped(raw, FONT_SIZE_SMALL, false, LINE_HEIGHT_SMALL);
    }
  } else {
    drawCenteredText("Merci pour votre achat !", FONT_SIZE_SMALL, false, LINE_HEIGHT_SMALL);
    drawCenteredText("A bientot !", FONT_SIZE_SMALL, false, LINE_HEIGHT_SMALL);
  }

  y += 1;
  doc.setTextColor(158, 158, 158);
  drawCenteredText("Powered by Vente Facile", FONT_SIZE_SMALL - 1, false, LINE_HEIGHT_SMALL);

  const pdfBlob = doc.output("blob");
  return URL.createObjectURL(pdfBlob);
}

export interface PaymentReceiptData {
  orgName: string;
  orgAddress?: string;
  orgPhone?: string;
  receiptNumber: string;
  date: string;
  customerName: string;
  customerPhone?: string;
  paymentMethod: string;
  paymentReference?: string;
  amountPaid: number;
  currency: string;
  saleReference?: string;
  saleTotalAmount?: number;
  previouslyPaid?: number;
  remainingBalance?: number;
  previousDebt?: number;
  newDebt?: number;
  cashierName?: string;
  notes?: string;
}

function estimatePaymentReceiptHeightMm(data: PaymentReceiptData, paperWidth: PaperWidth): number {
  const contentWidth = paperWidth - MARGIN * 2;
  const m = new jsPDF(pdfDocOptions(paperWidth, 400));
  let h = MARGIN + TOP_MARGIN_BEFORE_HEADER + 1;

  h += wrappedLineCount(m, data.orgName.toUpperCase(), contentWidth, FONT_SIZE_NORMAL, true) * LINE_HEIGHT;
  if (data.orgAddress) {
    h += wrappedLineCount(m, data.orgAddress, contentWidth, FONT_SIZE_SMALL, false) * LINE_HEIGHT_SMALL;
  }
  if (data.orgPhone) {
    h += wrappedLineCount(m, `Tél: ${data.orgPhone}`, contentWidth, FONT_SIZE_SMALL, false) * LINE_HEIGHT_SMALL;
  }

  h += 0.5 + 1.5;
  h += LINE_HEIGHT + 1.5;

  h += 2 * LINE_HEIGHT_SMALL;
  if (data.cashierName) h += LINE_HEIGHT_SMALL;
  if (data.customerName) {
    h += LINE_HEIGHT_SMALL;
    if (data.customerPhone) h += LINE_HEIGHT_SMALL;
  }
  h += 1.5;

  if (data.saleReference) {
    h += 4 * LINE_HEIGHT_SMALL + 1.5;
  }

  h += 0.5 + LINE_HEIGHT_SMALL + 0.5 + 1.5 + LINE_HEIGHT + 1.5;

  if (data.paymentReference) h += LINE_HEIGHT_SMALL;

  if (data.previousDebt !== undefined && data.newDebt !== undefined) {
    h += 1 + 2 * LINE_HEIGHT_SMALL;
  }

  if (data.notes) {
    m.setFontSize(FONT_SIZE_SMALL);
    m.setFont("helvetica", "italic");
    const noteLines = m.splitTextToSize(data.notes, contentWidth).length;
    h += 0.5 + noteLines * LINE_HEIGHT_SMALL + 1;
  }

  h += 1 + 1.5 + 2 * LINE_HEIGHT_SMALL;

  return Math.max(80, h + MARGIN + 6);
}

/**
 * Generate a payment receipt PDF and return the blob URL.
 */
export function generatePaymentReceiptPdfUrl(
  data: PaymentReceiptData,
  paperWidth: PaperWidth = 58
): string {
  const contentWidth = paperWidth - MARGIN * 2;
  const leftX = MARGIN;
  const rightX = paperWidth - MARGIN;
  const height = estimatePaymentReceiptHeightMm(data, paperWidth);
  const doc = new jsPDF(pdfDocOptions(paperWidth, height));

  let y = MARGIN + TOP_MARGIN_BEFORE_HEADER + 1;

  const drawCenteredText = (text: string, fontSize: number, bold = false) => {
    doc.setFontSize(fontSize);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(text, paperWidth / 2, y, { align: "center" });
    y += fontSize === FONT_SIZE_SMALL ? LINE_HEIGHT_SMALL : LINE_HEIGHT;
  };

  const drawCenteredWrapped = (text: string, fontSize: number, bold: boolean) => {
    doc.setFontSize(fontSize);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    const lines = doc.splitTextToSize(text, contentWidth);
    const lh = fontSize === FONT_SIZE_SMALL ? LINE_HEIGHT_SMALL : LINE_HEIGHT;
    for (const line of lines) {
      doc.text(line, paperWidth / 2, y, { align: "center" });
      y += lh;
    }
  };

  const drawLeftRightText = (left: string, right: string, fontSize: number, bold = false) => {
    doc.setFontSize(fontSize);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(left, leftX, y);
    doc.text(right, rightX, y, { align: "right" });
    y += fontSize === FONT_SIZE_SMALL ? LINE_HEIGHT_SMALL : LINE_HEIGHT;
  };

  const drawSeparator = (char: string = "-") => {
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(char === "=" ? 0.3 : 0.1);
    doc.line(leftX, y - 1, rightX, y - 1);
    y += 1.5;
  };

  doc.setTextColor(0, 0, 0);
  drawCenteredWrapped(data.orgName.toUpperCase(), FONT_SIZE_NORMAL, true);
  if (data.orgAddress) drawCenteredWrapped(data.orgAddress, FONT_SIZE_SMALL, false);
  if (data.orgPhone) drawCenteredWrapped(`Tél: ${data.orgPhone}`, FONT_SIZE_SMALL, false);

  y += 0.5;
  drawSeparator("=");

  drawCenteredText("REÇU DE PAIEMENT", FONT_SIZE_NORMAL, true);
  drawSeparator();

  drawLeftRightText("N°:", data.receiptNumber, FONT_SIZE_SMALL);
  drawLeftRightText("Date:", data.date, FONT_SIZE_SMALL);
  if (data.cashierName) {
    drawLeftRightText("Reçu par:", data.cashierName, FONT_SIZE_SMALL);
  }
  if (data.customerName) {
    drawLeftRightText("Client:", data.customerName, FONT_SIZE_SMALL);
    if (data.customerPhone) {
      drawLeftRightText("Tél:", data.customerPhone, FONT_SIZE_SMALL);
    }
  }
  drawSeparator();

  if (data.saleReference) {
    drawLeftRightText("Facture:", data.saleReference, FONT_SIZE_SMALL);
    if (data.saleTotalAmount !== undefined) {
      drawLeftRightText("Montant facture:", formatAmountWithCurrency(data.saleTotalAmount, data.currency), FONT_SIZE_SMALL);
    }
    if (data.previouslyPaid !== undefined) {
      drawLeftRightText("Déjà payé:", formatAmountWithCurrency(data.previouslyPaid, data.currency), FONT_SIZE_SMALL);
    }
    if (data.remainingBalance !== undefined) {
      drawLeftRightText("Reste après:", formatAmountWithCurrency(data.remainingBalance, data.currency), FONT_SIZE_SMALL);
    }
    drawSeparator();
  }

  y += 0.5;
  drawLeftRightText("Mode:", data.paymentMethod, FONT_SIZE_SMALL);
  y += 0.5;
  drawSeparator("=");
  drawLeftRightText("Montant payé", formatAmountWithCurrency(data.amountPaid, data.currency), FONT_SIZE_NORMAL);
  drawSeparator("=");

  if (data.paymentReference) {
    drawLeftRightText("Réf:", data.paymentReference, FONT_SIZE_SMALL);
  }

  if (data.previousDebt !== undefined && data.newDebt !== undefined) {
    y += 1;
    drawLeftRightText("Dette avant:", formatAmountWithCurrency(data.previousDebt, data.currency), FONT_SIZE_SMALL);
    if (data.newDebt > 0) {
      drawLeftRightText("Dette restante:", formatAmountWithCurrency(data.newDebt, data.currency), FONT_SIZE_SMALL);
    } else {
      drawLeftRightText("Dette restante:", "SOLDÉE", FONT_SIZE_SMALL);
    }
  }

  if (data.notes) {
    y += 0.5;
    doc.setFontSize(FONT_SIZE_SMALL);
    doc.setFont("helvetica", "italic");
    const splitNotes = doc.splitTextToSize(data.notes, contentWidth);
    doc.text(splitNotes, leftX, y);
    y += splitNotes.length * LINE_HEIGHT_SMALL + 1;
  }

  y += 1;
  drawSeparator("=");
  drawCenteredText("Merci pour votre paiement !", FONT_SIZE_SMALL);
  drawCenteredText("Ce reçu fait foi de paiement", FONT_SIZE_SMALL);

  const pdfBlob = doc.output("blob");
  return URL.createObjectURL(pdfBlob);
}
