/**
 * Receipt Printer Utility for Thermal Printers (58mm / 80mm)
 * Generates PDF receipts with exact thermal paper dimensions.
 * Uses jsPDF for PDF generation with dynamic height based on content.
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
  // Loyalty points
  showLoyaltyPoints?: boolean;
  loyaltyPointsEarned?: number;
  loyaltyPointsBalance?: number;
}

type PaperWidth = 58 | 80;

// Font sizes in points
const FONT_SIZE_NORMAL = 9;
const FONT_SIZE_SMALL = 7.5;
const LINE_HEIGHT = 3.5; // mm per line
const LINE_HEIGHT_SMALL = 3; // mm per line for small text
const MARGIN = 3; // mm margins

function formatAmount(amount: number, decimals: number = 2): string {
  // Utiliser toFixed pour conserver les décimales exactes sans arrondi
  const formatted = amount.toFixed(decimals);
  // Séparer les milliers avec des espaces
  const parts = formatted.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return parts.join('.');
}

function formatAmountWithCurrency(amount: number, currency: string, decimals: number = 2): string {
  return `${formatAmount(amount, decimals)} ${currency}`;
}

/**
 * Calculate the total height needed for the receipt content
 */
function calculateReceiptHeight(data: ReceiptData): number {
  let lines = 0;

  // Header section
  lines += 1; // org name
  if (data.orgAddress) lines += 1;
  if (data.orgPhone) lines += 1;
  if (data.receiptHeader) lines += data.receiptHeader.split("\n").length;
  lines += 1; // separator

  // Credit sale banner
  if (data.isCreditSale) lines += 2;

  // Loyalty points
  if (data.showLoyaltyPoints && data.loyaltyPointsEarned) lines += 3;

  // Receipt info
  lines += 2; // reference + date
  if (data.registerName) lines += 1;
  if (data.cashierName) lines += 1;
  if (data.customerName) {
    lines += 1;
    if (data.customerPhone) lines += 1;
  }
  lines += 1; // separator

  // Items header
  lines += 2; // header + separator

  // Items
  data.items.forEach(item => {
    lines += 1;
    if (item.discount_percentage > 0) lines += 1;
  });

  lines += 1; // separator

  // Totals
  lines += 1; // subtotal
  if (data.discountAmount > 0) lines += 1;
  if (data.taxAmount > 0) lines += 1;
  lines += 2; // separator + total + separator

  // Payments
  lines += 1; // empty line
  lines += data.payments.length;
  if (data.change > 0) lines += 2;
  if (data.isCreditSale && data.amountDue && data.amountDue > 0) lines += 2;

  // Footer
  lines += 1; // empty line
  if (data.receiptFooter) {
    lines += data.receiptFooter.split("\n").length;
  } else {
    lines += 2; // default footer
  }
  lines += 2; // empty + powered by

  // Calculate height: lines * line height + margins
  return (lines * LINE_HEIGHT) + (MARGIN * 2) + 5; // +5mm buffer
}

/**
 * Generate a PDF receipt and return the blob URL.
 * Use this when you need to control how/when the PDF is opened.
 */
export function generateReceiptPdfUrl(data: ReceiptData, paperWidth: PaperWidth = 58): string {
  const contentWidth = paperWidth - (MARGIN * 2);
  const height = calculateReceiptHeight(data);

  // Create PDF with custom dimensions (width x height in mm)
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [paperWidth, height],
  });

  let y = MARGIN + 2;
  const leftX = MARGIN;
  const rightX = paperWidth - MARGIN;
  const centerX = paperWidth / 2;

  // Helper functions
  const drawCenteredText = (text: string, fontSize: number = FONT_SIZE_NORMAL, bold: boolean = false, lineHeight: number = LINE_HEIGHT) => {
    doc.setFontSize(fontSize);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(text, centerX, y, { align: "center" });
    y += lineHeight;
  };

  const drawLeftText = (text: string, fontSize: number = FONT_SIZE_NORMAL, bold: boolean = false, lineHeight: number = LINE_HEIGHT) => {
    doc.setFontSize(fontSize);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(text, leftX, y);
    y += lineHeight;
  };

  const drawLeftRightText = (left: string, right: string, fontSize: number = FONT_SIZE_NORMAL, bold: boolean = false, lineHeight: number = LINE_HEIGHT) => {
    doc.setFontSize(fontSize);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(left, leftX, y);
    doc.text(right, rightX, y, { align: "right" });
    y += lineHeight;
  };

  const drawSeparator = (char: string = "-", lineHeight: number = LINE_HEIGHT_SMALL) => {
    doc.setDrawColor(0, 0, 0);
    if (char === "=") {
      doc.setLineWidth(0.3);
      doc.line(leftX, y - 1, rightX, y - 1);
    } else {
      doc.setLineWidth(0.1);
      doc.line(leftX, y - 1, rightX, y - 1);
    }
    y += lineHeight;
  };

  // === HEADER ===
  if (data.receiptHeader) {
    // Si un en-tête personnalisé existe, afficher uniquement celui-ci
    data.receiptHeader.split("\n").forEach(line => drawCenteredText(line.trim(), FONT_SIZE_SMALL, false, LINE_HEIGHT_SMALL));
  } else {
    // Sinon, afficher les informations par défaut
    drawCenteredText(data.orgName.toUpperCase(), FONT_SIZE_NORMAL, true);
    if (data.orgAddress) drawCenteredText(data.orgAddress, FONT_SIZE_SMALL, false, LINE_HEIGHT_SMALL);
    if (data.orgPhone) drawCenteredText(`Tel: ${data.orgPhone}`, FONT_SIZE_SMALL, false, LINE_HEIGHT_SMALL);
  }
  y += 1; // spacing
  drawSeparator("=");

  // === CREDIT SALE BANNER ===
  if (data.isCreditSale) {
    drawCenteredText("** VENTE A CREDIT **", FONT_SIZE_NORMAL, true);
    drawSeparator();
  }

  // === RECEIPT INFO ===
  y += 0.5;
  drawLeftText(`Recu: ${data.reference}`, FONT_SIZE_SMALL, false, LINE_HEIGHT_SMALL);
  drawLeftText(`Date: ${data.date}`, FONT_SIZE_SMALL, false, LINE_HEIGHT_SMALL);
  if (data.registerName) drawLeftText(`Caisse: ${data.registerName}`, FONT_SIZE_SMALL, false, LINE_HEIGHT_SMALL);
  if (data.cashierName) drawLeftText(`Caissier: ${data.cashierName}`, FONT_SIZE_SMALL, false, LINE_HEIGHT_SMALL);
  if (data.customerName) {
    drawLeftText(`Client: ${data.customerName}`, FONT_SIZE_SMALL, false, LINE_HEIGHT_SMALL);
    if (data.customerPhone) drawLeftText(`Tel: ${data.customerPhone}`, FONT_SIZE_SMALL, false, LINE_HEIGHT_SMALL);
  }
  y += 0.5;
  drawSeparator();

  // === ITEMS HEADER ===
  y += 1;
  doc.setFontSize(FONT_SIZE_SMALL);
  doc.setFont("helvetica", "normal");
  doc.text("Article", leftX, y);
  doc.text("Qte", leftX + contentWidth * 0.45, y, { align: "right" });
  doc.text("P.U.", leftX + contentWidth * 0.7, y, { align: "right" });
  doc.text("Total", rightX, y, { align: "right" });
  y += LINE_HEIGHT_SMALL + 0.5;
  drawSeparator();

  // === ITEMS ===
  doc.setFont("helvetica", "normal");
  data.items.forEach((item, index) => {
    const maxNameWidth = contentWidth * 0.4;
    let name = item.name;
    // Truncate name if too long
    while (doc.getTextWidth(name) > maxNameWidth && name.length > 3) {
      name = name.slice(0, -1);
    }
    if (name !== item.name) name += "..";

    doc.setFontSize(FONT_SIZE_SMALL);
    doc.text(name, leftX, y);
    doc.text(item.quantity.toString(), leftX + contentWidth * 0.45, y, { align: "right" });
    doc.text(formatAmount(item.unit_price, 2), leftX + contentWidth * 0.7, y, { align: "right" });
    doc.text(formatAmount(item.total, 2), rightX, y, { align: "right" });
    y += LINE_HEIGHT_SMALL;

    if (item.discount_percentage > 0) {
      doc.setFontSize(FONT_SIZE_SMALL - 0.5);
      doc.text(`  Remise: -${item.discount_percentage}%`, leftX + 2, y);
      y += LINE_HEIGHT_SMALL;
    }
  });
  y += 0.5;
  drawSeparator();

  // === TOTALS ===
  y += 1;
  drawLeftRightText("Sous-total", formatAmount(data.subtotal, 2), FONT_SIZE_SMALL, false, LINE_HEIGHT_SMALL);

  if (data.discountAmount > 0) {
    const discLabel = data.globalDiscountPercent > 0 ? `Remise (${data.globalDiscountPercent}%)` : "Remises";
    drawLeftRightText(discLabel, `-${formatAmount(data.discountAmount, 2)}`, FONT_SIZE_SMALL, false, LINE_HEIGHT_SMALL);
  }

  if (data.taxAmount > 0) {
    drawLeftRightText("Taxes (TVA)", `+${formatAmount(data.taxAmount, 2)}`, FONT_SIZE_SMALL, false, LINE_HEIGHT_SMALL);
  }

  y += 1;
  drawSeparator("=");
  drawLeftRightText("Total a payer", formatAmountWithCurrency(data.total, data.currency, 2), FONT_SIZE_NORMAL);
  drawSeparator("=");

  // === PAYMENTS ===
  y += 1.5;
  data.payments.forEach(p => {
    drawLeftRightText(p.method, formatAmountWithCurrency(p.amount, p.currency, 2), FONT_SIZE_SMALL, false, LINE_HEIGHT_SMALL);
  });

  if (data.change > 0) {
    drawLeftRightText("Monnaie a rendre", formatAmountWithCurrency(data.change, data.currency, 2), FONT_SIZE_SMALL);
  }

  if (data.isCreditSale && data.amountDue && data.amountDue > 0) {
    drawLeftRightText("Reste a payer", formatAmountWithCurrency(data.amountDue, data.currency, 2), FONT_SIZE_SMALL);
  }

  // === LOYALTY POINTS ===
  if (data.showLoyaltyPoints && data.loyaltyPointsEarned && data.loyaltyPointsEarned > 0) {
    y += 1;
    drawSeparator();
    drawCenteredText("*** POINTS DE FIDELITE ***", FONT_SIZE_SMALL, true, LINE_HEIGHT_SMALL);
    drawLeftRightText("Points gagnes", `+${data.loyaltyPointsEarned} pts`, FONT_SIZE_SMALL, false, LINE_HEIGHT_SMALL);
    if (data.loyaltyPointsBalance !== undefined) {
      drawLeftRightText("Solde total", `${data.loyaltyPointsBalance} pts`, FONT_SIZE_SMALL, true, LINE_HEIGHT_SMALL);
    }
  }

  // === FOOTER ===
  y += 2;
  if (data.receiptFooter) {
    data.receiptFooter.split("\n").forEach(line => drawCenteredText(line.trim(), FONT_SIZE_SMALL, false, LINE_HEIGHT_SMALL));
  } else {
    drawCenteredText("Merci pour votre achat !", FONT_SIZE_SMALL, false, LINE_HEIGHT_SMALL);
    drawCenteredText("A bientot !", FONT_SIZE_SMALL, false, LINE_HEIGHT_SMALL);
  }

  y += 1.5;
  doc.setTextColor(158, 158, 158); // gray
  drawCenteredText("Powered by Vente Facile", FONT_SIZE_SMALL - 1, false, LINE_HEIGHT_SMALL);

  // Return the PDF blob URL
  const pdfBlob = doc.output("blob");
  return URL.createObjectURL(pdfBlob);
}

/**
 * Generate and open a PDF receipt in a new tab.
 * For use in synchronous contexts (direct user click).
 */
export function printReceipt(data: ReceiptData, paperWidth: PaperWidth = 58): void {
  const pdfUrl = generateReceiptPdfUrl(data, paperWidth);
  window.open(pdfUrl, "_blank");
}

/**
 * Save the PDF as a real file, then display it in a pre-opened window.
 * The PDF is downloaded first, then embedded in an HTML viewer (no raw blob URL).
 */
export function openPdfInWindow(pdfUrl: string, targetWindow: Window | null, filename: string = "recu.pdf"): void {
  // 1. Enregistrer/télécharger le PDF en tant que vrai fichier
  const a = document.createElement("a");
  a.href = pdfUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  // 2. Afficher le PDF dans l'onglet pré-ouvert avec un viewer intégré
  const win = targetWindow && !targetWindow.closed ? targetWindow : null;
  if (win) {
    win.document.open();
    win.document.write(
      `<!DOCTYPE html><html><head><title>${filename}</title>` +
      `<style>*{margin:0;padding:0;overflow:hidden}embed{width:100vw;height:100vh}</style></head>` +
      `<body><embed src="${pdfUrl}" type="application/pdf" /></body></html>`
    );
    win.document.close();
  }
}

/**
 * Download the receipt as a PDF file
 */
export function downloadReceipt(data: ReceiptData, paperWidth: PaperWidth = 58): void {
  const contentWidth = paperWidth - (MARGIN * 2);
  const height = calculateReceiptHeight(data);

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [paperWidth, height],
  });

  // Reuse the same generation logic - for now just call printReceipt
  // In production, we'd refactor to share the generation code
  doc.save(`recu-${data.reference}.pdf`);
}

/**
 * Generate receipt text only (for ESC/POS raw printing or preview).
 */
/**
 * Payment Receipt Data for credit/debt payments
 */
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
  // For sale-linked payments
  saleReference?: string;
  saleTotalAmount?: number;
  previouslyPaid?: number;
  remainingBalance?: number;
  // For general debt payments
  previousDebt?: number;
  newDebt?: number;
  cashierName?: string;
  notes?: string;
}

/**
 * Generate a payment receipt PDF and return the blob URL.
 */
export function generatePaymentReceiptPdfUrl(data: PaymentReceiptData, paperWidth: PaperWidth = 58): string {
  const contentWidth = paperWidth - MARGIN * 2;
  const leftX = MARGIN;

  // Calculate height
  let estimatedLines = 20; // Base lines
  if (data.saleReference) estimatedLines += 4;
  if (data.notes) estimatedLines += 2;
  const height = Math.max(80, estimatedLines * LINE_HEIGHT + 30);

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [paperWidth, height],
  });

  let y = MARGIN + 2;

  // Helper functions
  const drawCenteredText = (text: string, fontSize: number, bold = false) => {
    doc.setFontSize(fontSize);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    const textWidth = doc.getTextWidth(text);
    doc.text(text, paperWidth / 2 - textWidth / 2, y);
    y += fontSize === FONT_SIZE_SMALL ? LINE_HEIGHT_SMALL : LINE_HEIGHT;
  };

  const drawLeftRightText = (left: string, right: string, fontSize: number, bold = false) => {
    doc.setFontSize(fontSize);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(left, leftX, y);
    const rightWidth = doc.getTextWidth(right);
    doc.text(right, paperWidth - MARGIN - rightWidth, y);
    y += fontSize === FONT_SIZE_SMALL ? LINE_HEIGHT_SMALL : LINE_HEIGHT;
  };

  const drawSeparator = (char: string = "-") => {
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.line(leftX, y - 1, paperWidth - MARGIN, y - 1);
    y += 1.5;
  };

  // Header
  doc.setTextColor(0, 0, 0);
  drawCenteredText(data.orgName.toUpperCase(), FONT_SIZE_NORMAL, true);
  if (data.orgAddress) drawCenteredText(data.orgAddress, FONT_SIZE_SMALL);
  if (data.orgPhone) drawCenteredText(`Tél: ${data.orgPhone}`, FONT_SIZE_SMALL);

  y += 1;
  drawSeparator("=");

  // Receipt type
  drawCenteredText("REÇU DE PAIEMENT", FONT_SIZE_NORMAL, true);
  drawSeparator();

  // Receipt info
  y += 0.5;
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
  y += 0.5;
  drawSeparator();

  // Sale reference if linked to a sale
  if (data.saleReference) {
    y += 1;
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
    y += 0.5;
    drawSeparator();
  }

  // Payment details
  y += 1.5;
  drawLeftRightText("Mode:", data.paymentMethod, FONT_SIZE_SMALL);
  y += 1;
  drawSeparator("=");
  drawLeftRightText("Montant payé", formatAmountWithCurrency(data.amountPaid, data.currency), FONT_SIZE_NORMAL);
  drawSeparator("=");

  if (data.paymentReference) {
    drawLeftRightText("Réf:", data.paymentReference, FONT_SIZE_SMALL);
  }

  // Debt summary (for general payments)
  if (data.previousDebt !== undefined && data.newDebt !== undefined) {
    y += 1;
    drawLeftRightText("Dette avant:", formatAmountWithCurrency(data.previousDebt, data.currency), FONT_SIZE_SMALL);
    if (data.newDebt > 0) {
      drawLeftRightText("Dette restante:", formatAmountWithCurrency(data.newDebt, data.currency), FONT_SIZE_SMALL);
    } else {
      drawLeftRightText("Dette restante:", "SOLDÉE", FONT_SIZE_SMALL);
    }
  }

  // Notes
  if (data.notes) {
    y += 0.5;
    doc.setFontSize(FONT_SIZE_SMALL);
    doc.setFont("helvetica", "italic");
    const splitNotes = doc.splitTextToSize(data.notes, contentWidth);
    doc.text(splitNotes, leftX, y);
    y += splitNotes.length * LINE_HEIGHT_SMALL + 1;
  }

  // Footer
  y += 2;
  drawSeparator("=");
  drawCenteredText("Merci pour votre paiement !", FONT_SIZE_SMALL);
  drawCenteredText("Ce reçu fait foi de paiement", FONT_SIZE_SMALL);

  // Return the PDF blob URL
  const pdfBlob = doc.output("blob");
  return URL.createObjectURL(pdfBlob);
}

/**
 * Print a payment receipt (wrapper that opens in new tab).
 * For synchronous contexts only.
 */
export function printPaymentReceipt(data: PaymentReceiptData, paperWidth: PaperWidth = 58): void {
  const pdfUrl = generatePaymentReceiptPdfUrl(data, paperWidth);
  window.open(pdfUrl, "_blank");
}

export function getReceiptText(data: ReceiptData, paperWidth: PaperWidth = 58): string {
  const cols = paperWidth === 58 ? 32 : 48;
  const lines: string[] = [];

  const padRight = (str: string, len: number) => str.length >= len ? str.substring(0, len) : str + " ".repeat(len - str.length);
  const padLeft = (str: string, len: number) => str.length >= len ? str.substring(0, len) : " ".repeat(len - str.length) + str;
  const centerText = (text: string, width: number) => {
    if (text.length >= width) return text.substring(0, width);
    const pad = Math.floor((width - text.length) / 2);
    return " ".repeat(pad) + text;
  };
  const line = (char: string, width: number) => char.repeat(width);

  lines.push(centerText(data.orgName.toUpperCase(), cols));
  if (data.orgAddress) lines.push(centerText(data.orgAddress, cols));
  if (data.orgPhone) lines.push(centerText(`Tel: ${data.orgPhone}`, cols));
  lines.push(line("=", cols));

  if (data.isCreditSale) {
    lines.push(centerText("** VENTE A CREDIT **", cols));
    lines.push(line("-", cols));
  }

  lines.push(`Recu: ${data.reference}`);
  lines.push(`Date: ${data.date}`);
  if (data.registerName) lines.push(`Caisse: ${data.registerName}`);
  if (data.cashierName) lines.push(`Caissier: ${data.cashierName}`);
  if (data.customerName) {
    lines.push(`Client: ${data.customerName}`);
    if (data.customerPhone) lines.push(`Tel: ${data.customerPhone}`);
  }
  lines.push(line("-", cols));

  const totalW = paperWidth === 80 ? 12 : 9;
  const labelW = cols - totalW - 1;

  data.items.forEach(item => {
    lines.push(`${item.name.substring(0, 20)} x${item.quantity} = ${formatAmount(item.total)}`);
  });

  lines.push(line("-", cols));
  lines.push(padRight("TOTAL", labelW) + " " + padLeft(formatAmountWithCurrency(data.total, data.currency), totalW));
  lines.push(line("=", cols));

  lines.push("");
  lines.push(centerText("Merci pour votre achat !", cols));

  return lines.join("\n");
}
