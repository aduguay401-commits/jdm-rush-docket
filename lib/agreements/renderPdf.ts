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

export function sanitizePdfText(value: string) {
  return Array.from(value)
    .map((character) => {
      const replacement = PDF_TEXT_REPLACEMENTS.get(character);
      if (replacement !== undefined) return replacement;

      const codepoint = character.codePointAt(0);
      return codepoint !== undefined && codepoint > 0xff ? "?" : character;
    })
    .join("")
    .replace(/\*\*/g, "");
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

  for (const sourceLine of markdown.split(/\r?\n/)) {
    const line = sourceLine.trim();

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

    if (line.startsWith("- ")) {
      drawTextBlock(ctx, `• ${line.slice(2)}`, { font, size: 9.5, color: TEXT, lineHeight: 13.5, indent: 14 });
      continue;
    }

    const isBoldLine = line.startsWith("**") && line.endsWith("**");
    drawTextBlock(ctx, line, {
      font: isBoldLine ? boldFont : font,
      size: isBoldLine ? 10.5 : 9.5,
      color: TEXT,
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
