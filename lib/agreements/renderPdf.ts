import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN_X = 54;
const MARGIN_TOP = 56;
const MARGIN_BOTTOM = 56;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;
const ORANGE = rgb(0.898, 0.318, 0.145);
const TEXT = rgb(0.08, 0.08, 0.08);
const MUTED = rgb(0.34, 0.34, 0.34);

type PdfContext = {
  pdf: PDFDocument;
  page: PDFPage;
  font: PDFFont;
  boldFont: PDFFont;
  y: number;
  pageNumber: number;
};

type TextStyle = {
  font: PDFFont;
  size: number;
  color: ReturnType<typeof rgb>;
  lineHeight: number;
  indent?: number;
};

function addPage(ctx: PdfContext) {
  if (ctx.pageNumber > 0) {
    ctx.page.drawText(`Page ${ctx.pageNumber}`, {
      x: PAGE_WIDTH - MARGIN_X - 42,
      y: 28,
      size: 8,
      font: ctx.font,
      color: MUTED,
    });
  }

  ctx.page = ctx.pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  ctx.pageNumber += 1;
  ctx.y = PAGE_HEIGHT - MARGIN_TOP;
}

function ensureSpace(ctx: PdfContext, height: number) {
  if (ctx.y - height < MARGIN_BOTTOM) {
    addPage(ctx);
  }
}

const PDF_TEXT_REPLACEMENTS = new Map<string, string>([
  ["\u00a0", " "],
  ["\u2010", "-"],
  ["\u2011", "-"],
  ["\u2012", "-"],
  ["\u2013", "-"],
  ["\u2014", "-"],
  ["\u2015", "-"],
  ["\u2018", "'"],
  ["\u2019", "'"],
  ["\u201a", "'"],
  ["\u201b", "'"],
  ["\u201c", "\""],
  ["\u201d", "\""],
  ["\u201e", "\""],
  ["\u201f", "\""],
  ["\u2022", "-"],
  ["\u2026", "..."],
  ["\u2032", "'"],
  ["\u2033", "\""],
  ["\u2212", "-"],
  ["\u2264", "<="],
  ["\u2265", ">="],
]);

function isPdfWhitespace(codepoint: number) {
  return codepoint === 0x09 || codepoint === 0x0a || codepoint === 0x0d;
}

export function sanitizePdfText(value: string) {
  return Array.from(value)
    .map((character) => {
      const replacement = PDF_TEXT_REPLACEMENTS.get(character);
      if (replacement !== undefined) return replacement;

      const codepoint = character.codePointAt(0);
      if (codepoint === undefined) return character;
      if ((codepoint <= 0x1f && !isPdfWhitespace(codepoint)) || (codepoint >= 0x80 && codepoint <= 0x9f)) {
        return "?";
      }
      return codepoint > 0xff ? "?" : character;
    })
    .join("")
    .replace(/\*\*/g, "");
}

type Word = { text: string; bold: boolean };

/** Splits a line on **bold** markers into words that remember their weight. */
function toWords(raw: string, allBold: boolean): Word[] {
  const words: Word[] = [];
  raw.split("**").forEach((segment, i) => {
    const bold = allBold || i % 2 === 1;
    for (const text of sanitizePdfText(segment).split(/\s+/).filter(Boolean)) {
      words.push({ text, bold });
    }
  });
  return words;
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

function drawTextBlock(ctx: PdfContext, raw: string, style: TextStyle) {
  const indent = style.indent ?? 0;
  const text = sanitizePdfText(raw);
  const lines = wrapText(text, style.font, style.size, CONTENT_WIDTH - indent);

  for (const line of lines) {
    ensureSpace(ctx, style.lineHeight);
    ctx.page.drawText(line, {
      x: MARGIN_X + indent,
      y: ctx.y,
      size: style.size,
      font: style.font,
      color: style.color,
    });
    ctx.y -= style.lineHeight;
  }
}

type RichStyle = {
  size: number;
  lineHeight: number;
  indent?: number;
  allBold?: boolean;
  /** Drawn in the indent on the first line only, e.g. a list bullet. */
  marker?: string;
};

function layoutRich(ctx: PdfContext, raw: string, style: RichStyle): Word[][] {
  const maxWidth = CONTENT_WIDTH - (style.indent ?? 0);
  const fontOf = (w: Word) => (w.bold ? ctx.boldFont : ctx.font);
  const space = ctx.font.widthOfTextAtSize(" ", style.size);

  const lines: Word[][] = [];
  let current: Word[] = [];
  let width = 0;
  for (const word of toWords(raw, style.allBold ?? false)) {
    const w = fontOf(word).widthOfTextAtSize(word.text, style.size);
    const needed = current.length ? width + space + w : w;
    if (current.length && needed > maxWidth) {
      lines.push(current);
      current = [word];
      width = w;
    } else {
      current.push(word);
      width = needed;
    }
  }
  if (current.length) lines.push(current);
  if (!lines.length) lines.push([]);
  return lines;
}

/** Body text with inline **bold**, wrapped word by word with a hanging indent. */
function drawRichBlock(ctx: PdfContext, raw: string, style: RichStyle) {
  const indent = style.indent ?? 0;
  const fontOf = (w: Word) => (w.bold ? ctx.boldFont : ctx.font);
  const space = ctx.font.widthOfTextAtSize(" ", style.size);
  const lines = layoutRich(ctx, raw, style);

  lines.forEach((line, i) => {
    ensureSpace(ctx, style.lineHeight);
    if (i === 0 && style.marker) {
      ctx.page.drawText(style.marker, {
        x: MARGIN_X + indent - 10,
        y: ctx.y,
        size: style.size,
        font: ctx.font,
        color: TEXT,
      });
    }
    let x = MARGIN_X + indent;
    for (const word of line) {
      ctx.page.drawText(word.text, { x, y: ctx.y, size: style.size, font: fontOf(word), color: TEXT });
      x += fontOf(word).widthOfTextAtSize(word.text, style.size) + space;
    }
    ctx.y -= style.lineHeight;
  });
}

function drawRule(ctx: PdfContext) {
  ensureSpace(ctx, 18);
  ctx.page.drawLine({
    start: { x: MARGIN_X, y: ctx.y - 2 },
    end: { x: PAGE_WIDTH - MARGIN_X, y: ctx.y - 2 },
    thickness: 0.8,
    color: rgb(0.82, 0.82, 0.82),
  });
  ctx.y -= 18;
}

const BODY: RichStyle = { size: 9.5, lineHeight: 13.5 };
const BULLET: RichStyle = { size: 9.5, lineHeight: 13.5, indent: 24, marker: "\u2022" };
const isListLine = (line: string) => line.startsWith("- ");

/** Height of a short list (and the sentence introducing it), so it is never split over a page. */
function keepTogetherHeight(ctx: PdfContext, lines: string[], start: number) {
  let end = start;
  while (end < lines.length && isListLine(lines[end])) end += 1;
  if (end - start > 6) return 0;
  return lines
    .slice(start, end)
    .reduce((h, l) => h + layoutRich(ctx, l.slice(2), BULLET).length * BULLET.lineHeight! + 2, 0);
}

export async function renderAgreementPdf(markdown: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ctx: PdfContext = {
    pdf,
    page: undefined as unknown as PDFPage,
    font,
    boldFont,
    y: 0,
    pageNumber: 0,
  };
  addPage(ctx);

  const lines = markdown.split(/\r?\n/).map((l) => l.trim());
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    if (!line) {
      ctx.y -= 8;
      continue;
    }

    if (/^-{3,}$/.test(line)) {
      drawRule(ctx);
      continue;
    }

    if (line.startsWith("### ")) {
      ctx.y -= 4;
      ensureSpace(ctx, 15 + 2 + BODY.lineHeight * 3); // never leave a heading alone at the foot of a page
      drawTextBlock(ctx, line.slice(4), { font: boldFont, size: 11.5, color: ORANGE, lineHeight: 15 });
      ctx.y -= 2;
      continue;
    }

    if (line.startsWith("## ")) {
      ctx.y -= 6;
      drawTextBlock(ctx, line.slice(3), { font: boldFont, size: 14, color: TEXT, lineHeight: 18 });
      ctx.y -= 2;
      continue;
    }

    if (line.startsWith("# ")) {
      drawTextBlock(ctx, line.slice(2), { font: boldFont, size: 18, color: TEXT, lineHeight: 22 });
      ctx.y -= 6;
      continue;
    }

    if (isListLine(line)) {
      if (i === 0 || !isListLine(lines[i - 1])) ensureSpace(ctx, keepTogetherHeight(ctx, lines, i));
      drawRichBlock(ctx, line.slice(2), BULLET);
      ctx.y -= 2;
      continue;
    }

    const isBoldLine = /^\*\*[^*]+\*\*$/.test(line);
    // A sentence ending in ":" that introduces a list stays on the list's page.
    const next = lines[i + 1] === "" ? i + 2 : i + 1;
    if (line.endsWith(":") && isListLine(lines[next] ?? "")) {
      const listHeight = keepTogetherHeight(ctx, lines, next);
      if (listHeight) ensureSpace(ctx, layoutRich(ctx, line, BODY).length * BODY.lineHeight! + 8 + listHeight);
    }
    drawRichBlock(ctx, line, {
      allBold: isBoldLine,
      size: isBoldLine ? 10.5 : 9.5,
      lineHeight: isBoldLine ? 14.5 : 13.5,
    });
  }

  ctx.page.drawText(`Page ${ctx.pageNumber}`, {
    x: PAGE_WIDTH - MARGIN_X - 42,
    y: 28,
    size: 8,
    font,
    color: MUTED,
  });

  return pdf.save();
}
