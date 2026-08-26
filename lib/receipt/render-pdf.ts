/**
 * Moteur de rendu PDF du ticket thermique.
 *
 * Principe : une SEULE traversée des blocs produit à la fois la hauteur totale
 * et la liste des primitives de tracé. On crée ensuite le document à la bonne
 * hauteur et on rejoue les primitives. Il n'existe donc plus de fonction
 * d'estimation à garder en miroir du tracé, qui était la source des bandes
 * blanches en pied de ticket et des dernières lignes tronquées.
 *
 * Le document de mesure est un jsPDF jetable : jsPDF ne sait mesurer un texte
 * qu'à travers une instance, et la mesure ne dépend que de la police et du
 * corps, jamais du format de page.
 */

import { jsPDF } from "jspdf";
import type { AmountRow, Block, ItemRow, KvRow } from "./blocks";
import {
  FONTS,
  leading,
  tokensFor,
  type FontRole,
  type PaperWidth,
  type Tokens,
} from "./tokens";

type DrawOp =
  | {
      op: "text";
      x: number;
      y: number;
      text: string;
      size: number;
      bold: boolean;
      italic?: boolean;
      align: "left" | "center" | "right";
      gray?: boolean;
      white?: boolean;
    }
  | { op: "rect"; x: number; y: number; w: number; h: number }
  | { op: "line"; x1: number; y1: number; x2: number; y2: number; weight: number }
  | {
      op: "image";
      dataUrl: string;
      format: "PNG" | "JPEG";
      x: number;
      y: number;
      w: number;
      h: number;
    };

/** Gris du pied de ticket. Le reste est en noir pur : c'est du thermique. */
const MUTED = 130;

class Layout {
  readonly ops: DrawOp[] = [];
  y: number;

  constructor(
    private readonly measure: jsPDF,
    readonly t: Tokens
  ) {
    this.y = t.margin + t.topPadding;
  }

  get left() {
    return this.t.margin;
  }
  get right() {
    return this.t.paperWidth - this.t.margin;
  }
  get center() {
    return this.t.paperWidth / 2;
  }

  /**
   * Décalage entre le haut d'une ligne et sa ligne de base.
   *
   * `this.y` désigne partout le HAUT de la ligne courante, jamais la ligne de
   * base : c'est ce qui permet de poser un filet à `y` sans qu'il barre le texte
   * qui suit. jsPDF, lui, positionne le texte sur sa ligne de base, d'où cette
   * conversion faite en un seul endroit.
   */
  baselineOf(size: number): number {
    return leading(size) * 0.78;
  }

  /** Écrit sans faire avancer le curseur : pour les cellules d'une même ligne. */
  textAt(
    text: string,
    x: number,
    size: number,
    bold: boolean,
    align: "left" | "center" | "right",
    extra?: {
      italic?: boolean;
      gray?: boolean;
      white?: boolean;
      /**
       * Pose ce texte sur la ligne de base d'un autre corps. Sert quand deux
       * corps différents partagent une ligne : sans cela, le plus grand des deux
       * semble flotter sous l'autre.
       */
      baselineSize?: number;
    }
  ) {
    this.ops.push({
      op: "text",
      x,
      y: this.y + this.baselineOf(extra?.baselineSize ?? size),
      text,
      size,
      bold,
      align,
      italic: extra?.italic,
      gray: extra?.gray,
      white: extra?.white,
    });
  }

  width(text: string, size: number, bold: boolean, italic = false): number {
    this.measure.setFontSize(size);
    this.measure.setFont("helvetica", italic ? "italic" : bold ? "bold" : "normal");
    return this.measure.getTextWidth(text);
  }

  wrap(text: string, maxWidth: number, size: number, bold: boolean, italic = false): string[] {
    this.measure.setFontSize(size);
    this.measure.setFont("helvetica", italic ? "italic" : bold ? "bold" : "normal");
    const lines = this.measure.splitTextToSize(text, Math.max(1, maxWidth)) as string[];
    return lines.length ? lines : [""];
  }

  text(
    text: string,
    opts: {
      x: number;
      size: number;
      bold: boolean;
      italic?: boolean;
      align: "left" | "center" | "right";
      gray?: boolean;
      white?: boolean;
      advance?: number;
    }
  ) {
    this.textAt(text, opts.x, opts.size, opts.bold, opts.align, {
      italic: opts.italic,
      gray: opts.gray,
      white: opts.white,
    });
    this.y += opts.advance ?? leading(opts.size);
  }
}

/**
 * Place un libellé et sa valeur sur une ligne justifiée, sans jamais les laisser
 * se chevaucher.
 *
 * C'est le défaut le plus grave de l'ancien générateur : il écrivait le libellé
 * à gauche et le montant à droite sans mesurer. Sur 58 mm, « Montant payé » face
 * à « 12 500 000.00 CDF » se recouvraient de 4 mm. Le CDF étant la devise par
 * défaut de la plateforme, tout règlement au-delà d'environ 450 $ produisait un
 * ticket illisible.
 *
 * Trois recours, dans l'ordre : la ligne telle quelle ; le libellé replié sur la
 * largeur qui reste ; le montant renvoyé seul à la ligne suivante, aligné à
 * droite, ce qui lui laisse toute la largeur du papier.
 */
function drawPair(
  L: Layout,
  label: string,
  value: string,
  role: FontRole,
  strong: boolean
) {
  const { size } = FONTS[role];
  const labelBold = FONTS[role].bold;
  const valueBold = strong || FONTS[role].bold;

  const valueW = L.width(value, size, valueBold);
  const available = L.t.contentWidth - valueW - L.t.minGap;

  if (available >= L.width(label, size, labelBold)) {
    L.textAt(label, L.left, size, labelBold, "left");
    L.text(value, { x: L.right, size, bold: valueBold, align: "right" });
    return;
  }

  if (available >= size * 0.5) {
    const [head, ...rest] = L.wrap(label, available, size, labelBold);
    L.textAt(head, L.left, size, labelBold, "left");
    L.text(value, { x: L.right, size, bold: valueBold, align: "right" });
    for (const line of rest) {
      L.text(line, { x: L.left, size, bold: labelBold, align: "left" });
    }
    return;
  }

  for (const line of L.wrap(label, L.t.contentWidth, size, labelBold)) {
    L.text(line, { x: L.left, size, bold: labelBold, align: "left" });
  }
  L.text(value, { x: L.right, size, bold: valueBold, align: "right" });
}

/**
 * Le libellé n'apporte rien quand la valeur le répète déjà.
 *
 * Les marchands nomment leurs caisses « Caisse 1 » : préfixer donnait
 * « Caisse Caisse 1 » sur chaque ticket.
 */
function isRedundantLabel(label: string, value: string): boolean {
  const norm = (t: string) => t.trim().toLowerCase().replace(/\s+/g, " ");
  return norm(value).startsWith(`${norm(label)} `);
}

/** Champ d'identité : la valeur suit le libellé, le débord passe en retrait. */
function drawInline(L: Layout, row: KvRow, role: FontRole) {
  const { size, bold } = FONTS[role];
  if (isRedundantLabel(row.label, row.value)) {
    for (const line of L.wrap(row.value, L.t.contentWidth, size, row.strong || bold)) {
      L.text(line, { x: L.left, size, bold: row.strong || bold, align: "left" });
    }
    return;
  }
  const label = `${row.label} `;
  const labelW = L.width(label, size, bold);
  const first = L.t.contentWidth - labelW;

  const lines = L.wrap(row.value, Math.max(first, size * 0.5), size, row.strong || bold);
  const [head, ...rest] = lines;

  L.textAt(label, L.left, size, bold, "left");
  L.text(head, {
    x: L.left + labelW,
    size,
    bold: row.strong || bold,
    align: "left",
  });

  for (const line of L.wrap(
    rest.join(" "),
    L.t.contentWidth - L.t.indent,
    size,
    row.strong || bold
  )) {
    if (!line) continue;
    L.text(line, {
      x: L.left + L.t.indent,
      size,
      bold: row.strong || bold,
      align: "left",
    });
  }
}

function drawBand(L: Layout, text: string, sub?: string) {
  const { size, bold } = FONTS.band;
  const lines = L.wrap(text, L.t.contentWidth - L.t.space.sm * 2, size, bold);
  const lineH = leading(size);
  const padV = L.t.space.xs + 0.4;

  L.ops.push({
    op: "rect",
    x: L.left,
    y: L.y,
    w: L.t.contentWidth,
    h: lines.length * lineH + padV * 2,
  });

  L.y += padV;
  for (const line of lines) {
    L.text(line, {
      x: L.center,
      size,
      bold,
      align: "center",
      white: true,
      advance: lineH,
    });
  }
  L.y += padV;

  if (sub) {
    L.y += L.t.space.xs;
    for (const line of L.wrap(sub, L.t.contentWidth, FONTS.legal.size, false)) {
      L.text(line, {
        x: L.center,
        size: FONTS.legal.size,
        bold: false,
        align: "center",
      });
    }
  }
}

function drawChip(L: Layout, text: string) {
  const { size, bold } = FONTS.chip;
  const lineH = leading(size);
  const padH = L.t.space.sm;
  const padV = L.t.space.xs * 0.6;
  const textW = Math.min(L.width(text, size, bold), L.t.contentWidth - padH * 2);
  const w = textW + padH * 2;
  const x = L.center - w / 2;

  L.ops.push({ op: "rect", x, y: L.y, w, h: lineH + padV * 2 });
  L.y += padV;
  L.text(text, { x: L.center, size, bold, align: "center", white: true, advance: lineH });
  L.y += padV;
}

/**
 * Tableau des articles, sur deux lignes par article.
 *
 * Quatre colonnes ne tiennent pas sur 53 mm utiles : quantité, prix unitaire et
 * total en réclament près de 38, ce qui laissait 15 mm au nom. « Farine de
 * froment Bralima 25 kg sac entier » se brisait en quatre lignes de trois mots.
 *
 * Le nom prend donc toute la largeur, et la ligne suivante porte « 2 × 92 000 »
 * à gauche, le total à droite. C'est la disposition des tickets de caisse
 * étroits, et elle laisse enfin de la place au conditionnement.
 */
function drawItems(L: Layout, rows: ItemRow[]) {
  const head = FONTS.label;
  const body = FONTS.body;
  const legal = FONTS.legal;

  L.textAt("Article", L.left, head.size, head.bold, "left");
  L.textAt("Total", L.right, head.size, head.bold, "right");
  L.y += leading(head.size) + L.t.space.xs * 0.5;
  L.ops.push({
    op: "line",
    x1: L.left,
    y1: L.y,
    x2: L.right,
    y2: L.y,
    weight: L.t.rule.hair,
  });
  L.y += L.t.space.xs * 0.5;

  rows.forEach((row, index) => {
    if (index > 0) L.y += L.t.space.xs * 0.5;

    for (const line of L.wrap(row.name, L.t.contentWidth, body.size, body.bold)) {
      L.text(line, { x: L.left, size: body.size, bold: body.bold, align: "left" });
    }

    const discount =
      row.discountPercentage && row.discountPercentage > 0
        ? `  (-${row.discountPercentage} %)`
        : "";
    const detail = `${row.quantity} × ${row.unitPrice}${discount}`;

    L.textAt(detail, L.left + L.t.indent, legal.size, false, "left", {
      baselineSize: body.size,
    });
    L.text(row.total, {
      x: L.right,
      size: body.size,
      bold: body.bold,
      align: "right",
    });

    if (row.quantityLabel) {
      L.text(row.quantityLabel, {
        x: L.left + L.t.indent,
        size: legal.size,
        bold: false,
        align: "left",
      });
    }
  });
}

/**
 * Le chiffre du document.
 *
 * Toujours sur deux lignes : libellé discret, montant en grand dessous, aligné à
 * droite. Un rendu en une ligne dépendrait de la longueur du montant, donc de la
 * devise : le même ticket n'aurait pas la même allure en dollars et en francs.
 * Sur deux lignes, le montant dispose de toute la largeur du papier et la forme
 * du document ne change jamais.
 */
function drawTotal(L: Layout, label: string, value: string) {
  L.ops.push({
    op: "line",
    x1: L.left,
    y1: L.y,
    x2: L.right,
    y2: L.y,
    weight: L.t.rule.heavy,
  });
  L.y += L.t.space.sm;

  L.text(label, {
    x: L.left,
    size: FONTS.label.size,
    bold: false,
    align: "left",
  });

  const { size, bold } = FONTS.total;
  const lines = L.wrap(value, L.t.contentWidth, size, bold);
  for (const line of lines) {
    L.text(line, { x: L.right, size, bold, align: "right" });
  }

  L.y += L.t.space.xs;
  L.ops.push({
    op: "line",
    x1: L.left,
    y1: L.y,
    x2: L.right,
    y2: L.y,
    weight: L.t.rule.heavy,
  });
  L.y += L.t.space.xs;
}

function drawBlock(L: Layout, block: Block) {
  switch (block.kind) {
    case "logo": {
      // On part de la hauteur maximale, puis on rabat si le logo est large :
      // un bandeau horizontal ne doit pas déborder du papier.
      const ratio = block.aspectRatio > 0 ? block.aspectRatio : 1;
      let h = L.t.logoMaxHeight;
      let w = h * ratio;
      if (w > L.t.contentWidth) {
        w = L.t.contentWidth;
        h = w / ratio;
      }
      L.ops.push({
        op: "image",
        dataUrl: block.dataUrl,
        format: block.format,
        x: L.center - w / 2,
        y: L.y,
        w,
        h,
      });
      L.y += h + L.t.space.xs;
      return;
    }
    case "text": {
      const { size, bold } = FONTS[block.role];
      const x =
        block.align === "center"
          ? L.center
          : L.left + (block.indent ? L.t.indent : 0);
      const maxW = L.t.contentWidth - (block.indent ? L.t.indent : 0);
      for (const line of L.wrap(block.text, maxW, size, bold, block.italic)) {
        L.text(line, {
          x,
          size,
          bold,
          italic: block.italic,
          align: block.align === "center" ? "center" : "left",
          gray: block.muted,
        });
      }
      return;
    }
    case "band":
      drawBand(L, block.text, block.sub);
      return;
    case "chip":
      drawChip(L, block.text);
      return;
    case "kv": {
      const role = block.role ?? "body";
      for (const row of block.rows) {
        if (block.mode === "inline") drawInline(L, row, role);
        else drawPair(L, row.label, row.value, role, Boolean(row.strong));
      }
      return;
    }
    case "items":
      drawItems(L, block.rows);
      return;
    case "amounts": {
      const role = block.role ?? "body";
      for (const row of block.rows as AmountRow[]) {
        drawPair(L, row.label, row.value, role, Boolean(row.strong));
      }
      return;
    }
    case "total":
      drawTotal(L, block.label, block.value);
      return;
    case "rule":
      L.ops.push({
        op: "line",
        x1: L.left,
        y1: L.y,
        x2: L.right,
        y2: L.y,
        weight: L.t.rule[block.weight],
      });
      L.y += L.t.space.xs;
      return;
    case "space":
      L.y += L.t.space[block.size];
      return;
  }
}

function docOptions(paperWidth: number, height: number) {
  return {
    orientation: "portrait" as const,
    unit: "mm" as const,
    format: [paperWidth, height] as [number, number],
    compress: true,
  };
}

/** Rend les blocs et retourne le document jsPDF prêt à être exporté. */
export function renderReceipt(blocks: Block[], paperWidth: PaperWidth = 58): jsPDF {
  const t = tokensFor(paperWidth);
  const measure = new jsPDF(docOptions(paperWidth, 400));
  const L = new Layout(measure, t);

  for (const block of blocks) drawBlock(L, block);

  const height = L.y + t.bottomPadding;
  const doc = new jsPDF(docOptions(paperWidth, height));

  for (const op of L.ops) {
    if (op.op === "text") {
      doc.setFontSize(op.size);
      doc.setFont("helvetica", op.italic ? "italic" : op.bold ? "bold" : "normal");
      if (op.white) doc.setTextColor(255, 255, 255);
      else if (op.gray) doc.setTextColor(MUTED, MUTED, MUTED);
      else doc.setTextColor(0, 0, 0);
      doc.text(op.text, op.x, op.y, { align: op.align });
    } else if (op.op === "rect") {
      doc.setFillColor(0, 0, 0);
      doc.rect(op.x, op.y, op.w, op.h, "F");
    } else if (op.op === "line") {
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(op.weight);
      doc.line(op.x1, op.y1, op.x2, op.y2);
    } else {
      try {
        doc.addImage(op.dataUrl, op.format, op.x, op.y, op.w, op.h);
      } catch {
        // Un logo illisible ne doit jamais empêcher d'imprimer un reçu.
      }
    }
  }

  doc.setTextColor(0, 0, 0);
  return doc;
}

/** Rend les blocs et retourne une blob URL, prête pour l'onglet d'impression. */
export function renderReceiptUrl(blocks: Block[], paperWidth: PaperWidth = 58): string {
  return URL.createObjectURL(renderReceipt(blocks, paperWidth).output("blob"));
}
