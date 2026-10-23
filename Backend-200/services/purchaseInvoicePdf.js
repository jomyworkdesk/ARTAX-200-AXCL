const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 36;
const { formatUaeDate, formatUaeDateTime } = require('./time');

const hasValue = (value) => value !== null && value !== undefined && value !== '';

const cleanText = (value) => {
  if (!hasValue(value)) return '';
  return String(value)
    .replace(/[^\x00-\x7F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const escapePdfText = (value) => cleanText(value)
  .replace(/\\/g, '\\\\')
  .replace(/\(/g, '\\(')
  .replace(/\)/g, '\\)');

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  const formatted = formatUaeDate(dateValue, { numericMonth: true });
  return formatted === '-' ? '' : formatted.replace(/\//g, '-');
};

const formatAmount = (amount) => {
  if (!hasValue(amount)) return '';
  const number = Number(amount);
  if (Number.isNaN(number)) return cleanText(amount);
  return number.toLocaleString('en-AE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

const formatMoney = (amount, currencyCode = 'AED') => {
  const formattedAmount = formatAmount(amount);
  return formattedAmount ? `${currencyCode || 'AED'} ${formattedAmount}` : '';
};

const safeFilenamePart = (value, fallback) => {
  const safe = cleanText(value)
    .replace(/[<>:"/\\|?*]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return safe || fallback;
};

const getAttachmentFilename = (target) => {
  const invoiceNo = safeFilenamePart(target.invoice_no, 'Invoice');
  const sellerName = safeFilenamePart(target.seller_name, 'Seller');
  return `${invoiceNo} - ${sellerName}.pdf`;
};

const normalizePdfTarget = (target) => {
  const firstRow = Array.isArray(target.purchaseRows) && target.purchaseRows.length
    ? target.purchaseRows[0]
    : {};

  return {
    ...firstRow,
    ...target,
    received_at: target.received_at || firstRow.received_at || firstRow.created_at,
    purchaseRows: Array.isArray(target.purchaseRows) && target.purchaseRows.length
      ? target.purchaseRows
      : [target]
  };
};

const wrapText = (value, maxWidth, fontSize) => {
  const text = cleanText(value);
  if (!text) return [''];

  const words = text.split(' ');
  const lines = [];
  let line = '';
  const maxChars = Math.max(8, Math.floor(maxWidth / (fontSize * 0.60)));

  words.forEach((word) => {
    if (word.length > maxChars) {
      if (line) {
        lines.push(line);
        line = '';
      }
      for (let index = 0; index < word.length; index += maxChars) {
        lines.push(word.slice(index, index + maxChars));
      }
      return;
    }

    const nextLine = line ? `${line} ${word}` : word;
    if (nextLine.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = nextLine;
    }
  });

  if (line) lines.push(line);
  return lines.length ? lines : [''];
};

const createPage = () => {
  const commands = [];

  const setColor = (hex) => {
    const clean = hex.replace('#', '');
    const r = parseInt(clean.slice(0, 2), 16) / 255;
    const g = parseInt(clean.slice(2, 4), 16) / 255;
    const b = parseInt(clean.slice(4, 6), 16) / 255;
    commands.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg`);
    commands.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG`);
  };

  const text = (value, x, y, size = 10, font = 'F1', color = '#111827') => {
    if (!hasValue(value)) return;
    setColor(color);
    commands.push('BT');
    commands.push(`/${font} ${size} Tf`);
    commands.push(`${x.toFixed(2)} ${y.toFixed(2)} Td`);
    commands.push(`(${escapePdfText(value)}) Tj`);
    commands.push('ET');
  };

  const textWidth = (value, size = 10, font = 'F1') => {
    const str = cleanText(value);
    const isBold = font === 'F2';
    let width = 0;
    for (let i = 0; i < str.length; i += 1) {
      const c = str.charCodeAt(i);
      if (c >= 48 && c <= 57) width += 0.556;
      else if (c === 46 || c === 44 || c === 32) width += 0.278;
      else if (c === 45) width += 0.333;
      else if (c >= 65 && c <= 90) width += isBold ? 0.7 : 0.667;
      else if (c >= 97 && c <= 122) width += isBold ? 0.6 : 0.5;
      else width += isBold ? 0.6 : 0.556;
    }
    return width * size;
  };

  const rightText = (value, rightX, y, size = 10, font = 'F1', color = '#111827') => {
    if (!hasValue(value)) return;
    text(value, rightX - textWidth(value, size, font), y, size, font, color);
  };

  const centerText = (value, centerX, y, size = 10, font = 'F1', color = '#111827') => {
    if (!hasValue(value)) return;
    text(value, centerX - (textWidth(value, size, font) / 2), y, size, font, color);
  };

  const textBlock = (value, x, y, maxWidth, options = {}) => {
    const size = options.size || 9;
    const lineHeight = options.lineHeight || size + 3;
    const maxLines = options.maxLines || 6;
    const lines = wrapText(value, maxWidth, size).slice(0, maxLines);
    lines.forEach((lineText, index) => {
      text(lineText, x, y - (index * lineHeight), size, options.font || 'F1', options.color || '#111827');
    });
    return lines.length * lineHeight;
  };

  const rect = (x, y, width, height, fillColor) => {
    setColor(fillColor);
    commands.push(`${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re`);
    commands.push('f');
  };

  const line = (x1, y1, x2, y2, color = '#d1d5db', width = 0.6) => {
    setColor(color);
    commands.push(`${width.toFixed(2)} w`);
    commands.push(`${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`);
  };

  return { commands, text, rightText, centerText, textBlock, rect, line };
};

const buildAddress = (row, prefix) => [
  row[`${prefix}_addr_line1`],
  row[`${prefix}_addr_line2`],
  row[`${prefix}_addr_line3`],
  row[`${prefix}_city`],
  row[`${prefix}_country_subdivision`],
  row[`${prefix}_post_code`],
  row[`${prefix}_country_code`]
].filter(hasValue).join(', ');

const drawLabelValue = (page, label, value, x, y, width) => {
  page.text(label, x, y, 8, 'F2', '#6b7280');
  page.textBlock(value || '-', x, y - 12, width, { size: 9, lineHeight: 11, maxLines: 2 });
};

const drawHeader = (page, target) => {
  page.rect(0, PAGE_HEIGHT - 6, PAGE_WIDTH, 6, '#4f46e5');
  page.rightText('PURCHASE INVOICE', PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 42, 20, 'F2', '#111827');
  page.rightText(`Invoice No. ${target.invoice_no || '-'}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 62, 10, 'F1', '#6b7280');
  page.line(MARGIN, PAGE_HEIGHT - 82, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 82, '#e5e7eb');
};

const drawDocumentHeader = (page, target) => {
  const leftX = MARGIN;
  const rightX = 318;
  const topY = PAGE_HEIGHT - 112;

  page.text(target.seller_name || '-', leftX, topY, 13, 'F2', '#111827');
  page.textBlock(buildAddress(target, 'seller') || '-', leftX, topY - 16, 230, {
    size: 8.5,
    lineHeight: 11,
    maxLines: 4,
    color: '#374151'
  });
  if (target.seller_vat_id) {
    page.text(`TRN: ${target.seller_vat_id}`, leftX, topY - 66, 8.5, 'F2', '#111827');
  }

  page.text('BUYER DETAILS', leftX, topY - 100, 8, 'F2', '#4f46e5');
  drawLabelValue(page, 'Name', target.buyer_name, leftX, topY - 120, 230);
  drawLabelValue(page, 'Address', buildAddress(target, 'buyer'), leftX, topY - 154, 230);
  drawLabelValue(page, 'TRN', target.buyer_vat_id, leftX, topY - 198, 230);

  page.text('DOCUMENT DETAILS', rightX, topY, 8, 'F2', '#4f46e5');
  drawLabelValue(page, 'Received Date & Time', formatUaeDateTime(target.received_at), rightX, topY - 20, 220);
  drawLabelValue(page, 'Invoice Date', formatDate(target.invoice_issue_date), rightX, topY - 54, 220);
  drawLabelValue(page, 'Due Date', formatDate(target.payment_due_date), rightX, topY - 88, 220);
  drawLabelValue(page, 'Currency', target.invoice_currency_code || 'AED', rightX, topY - 122, 220);
  drawLabelValue(page, 'Payment Means', target.payment_means_type_code, rightX, topY - 156, 220);
  drawLabelValue(page, 'Instance Identifier', target.InstanceIdentifier, rightX, topY - 190, 220);

  return topY - 235;
};

const getTableColumns = () => {
  const width = PAGE_WIDTH - (MARGIN * 2);
  let currentX = MARGIN;
  const cols = [
    { label: '#', w: width * 0.05, align: 'left' },
    { label: 'DESCRIPTION', w: width * 0.40, align: 'left' },
    { label: 'QTY', w: width * 0.10, align: 'right' },
    { label: 'UNIT', w: width * 0.11, align: 'center' },
    { label: 'NET', w: width * 0.14, align: 'right' },
    { label: 'VAT', w: width * 0.09, align: 'right' },
    { label: 'TOTAL', w: width * 0.11, align: 'right' }
  ];

  return cols.map((col) => {
    const next = {
      ...col,
      startX: currentX,
      x: currentX + 6,
      rightX: currentX + col.w - 6,
      centerX: currentX + (col.w / 2)
    };
    currentX += col.w;
    return next;
  });
};

const drawTableHeader = (page, y) => {
  page.rect(MARGIN, y - 18, PAGE_WIDTH - (MARGIN * 2), 24, '#f9fafb');
  page.line(MARGIN, y + 6, PAGE_WIDTH - MARGIN, y + 6, '#e5e7eb', 1);
  page.line(MARGIN, y - 18, PAGE_WIDTH - MARGIN, y - 18, '#e5e7eb', 1);

  getTableColumns().forEach((col, index) => {
    if (col.align === 'right') page.rightText(col.label, col.rightX, y - 10, 8, 'F2', '#6b7280');
    else if (col.align === 'center') page.centerText(col.label, col.centerX, y - 10, 8, 'F2', '#6b7280');
    else page.text(col.label, col.x, y - 10, 8, 'F2', '#6b7280');
    if (index > 0) page.line(col.startX, y + 6, col.startX, y - 18, '#e5e7eb', 1);
  });
};

const drawFooter = (page, pageNumber) => {
  page.line(MARGIN, 32, PAGE_WIDTH - MARGIN, 32, '#e5e7eb');
  page.text(`Page ${pageNumber}`, PAGE_WIDTH - MARGIN - 36, 18, 8, 'F1', '#6b7280');
};

const buildPdfBuffer = (pages) => {
  const objects = [];
  const pageObjectNumbers = [];
  const fontRegularObjectNumber = 3;
  const fontBoldObjectNumber = 4;

  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = '';
  objects[fontRegularObjectNumber] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  objects[fontBoldObjectNumber] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';

  pages.forEach((page) => {
    const pageObjectNumber = objects.length;
    const contentObjectNumber = pageObjectNumber + 1;
    pageObjectNumbers.push(pageObjectNumber);
    const stream = page.commands.join('\n');
    objects[pageObjectNumber] = [
      '<< /Type /Page',
      '/Parent 2 0 R',
      `/MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}]`,
      `/Resources << /Font << /F1 ${fontRegularObjectNumber} 0 R /F2 ${fontBoldObjectNumber} 0 R >> >>`,
      `/Contents ${contentObjectNumber} 0 R`,
      '>>'
    ].join(' ');
    objects[contentObjectNumber] = `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`;
  });

  objects[2] = `<< /Type /Pages /Kids [${pageObjectNumbers.map((number) => `${number} 0 R`).join(' ')}] /Count ${pageObjectNumbers.length} >>`;

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let index = 1; index < objects.length; index += 1) {
    offsets[index] = Buffer.byteLength(pdf, 'latin1');
    pdf += `${index} 0 obj\n${objects[index]}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length}\n`;
  pdf += '0000000000 65535 f \n';
  for (let index = 1; index < objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, 'latin1');
};

const createPurchaseInvoicePdf = (target) => {
  const pdfTarget = normalizePdfTarget(target);
  const rows = Array.isArray(target.purchaseRows) && target.purchaseRows.length
    ? target.purchaseRows
    : [pdfTarget];
  const currency = pdfTarget.invoice_currency_code || 'AED';
  const pages = [];
  let page = createPage();
  pages.push(page);

  drawHeader(page, pdfTarget);
  let y = drawDocumentHeader(page, pdfTarget);
  drawTableHeader(page, y);
  y -= 28;

  const cols = getTableColumns();
  rows.forEach((row, index) => {
    const description = [row.item_name, row.item_description].filter(hasValue).join(' - ') || '-';
    const descHeight = Math.max(26, wrapText(description, cols[1].w - 14, 8.5).slice(0, 3).length * 11 + 8);

    if (y - descHeight < 150) {
      drawFooter(page, pages.length);
      page = createPage();
      pages.push(page);
      drawHeader(page, pdfTarget);
      y = PAGE_HEIGHT - 128;
      drawTableHeader(page, y);
      y -= 28;
    }

    const topY = y + 10;
    const bottomY = topY - descHeight;
    page.line(MARGIN, bottomY, PAGE_WIDTH - MARGIN, bottomY, '#e5e7eb', 1);
    cols.forEach((col, colIndex) => {
      if (colIndex > 0) page.line(col.startX, topY, col.startX, bottomY, '#e5e7eb', 1);
    });

    page.text(String(index + 1), cols[0].x, y, 8.5, 'F1', '#374151');
    page.textBlock(description, cols[1].x, y, cols[1].w - 14, { size: 8.5, lineHeight: 11, maxLines: 3 });
    page.rightText(formatAmount(row.invoiced_qty) || '-', cols[2].rightX, y, 8.5, 'F1', '#374151');
    page.centerText(row.invoiced_qty_uom_code || '-', cols[3].centerX, y, 8.5, 'F1', '#374151');
    page.rightText(formatMoney(row.invoice_line_net_amt || row.item_net_price, currency) || '-', cols[4].rightX, y, 8.5, 'F1', '#374151');
    page.rightText(formatMoney(row.vat_line_amt_aed, currency) || '-', cols[5].rightX, y, 8.5, 'F1', '#374151');
    page.rightText(formatMoney(row.invoice_line_amt_aed || row.invoice_line_net_amt, currency) || '-', cols[6].rightX, y, 8.5, 'F2', '#111827');
    y -= descHeight;
  });

  if (y < 260) {
    drawFooter(page, pages.length);
    page = createPage();
    pages.push(page);
    drawHeader(page, pdfTarget);
    y = PAGE_HEIGHT - 140;
  }

  const summaryX = PAGE_WIDTH - MARGIN - 220;
  page.text('Tax Details', MARGIN, y - 10, 10, 'F2', '#4f46e5');
  drawLabelValue(page, 'Tax Category', pdfTarget.vat_cat_code, MARGIN, y - 32, 95);
  drawLabelValue(page, 'Tax Rate', hasValue(pdfTarget.vat_cat_rate) ? `${pdfTarget.vat_cat_rate}%` : '-', MARGIN + 120, y - 32, 75);
  drawLabelValue(page, 'Taxable Amount', formatMoney(pdfTarget.vat_cat_taxable_amt, currency), MARGIN, y - 70, 105);
  drawLabelValue(page, 'Tax Amount', formatMoney(pdfTarget.vat_cat_tax_amt, currency), MARGIN + 120, y - 70, 95);

  page.text('Subtotal', summaryX, y - 10, 9, 'F1', '#4b5563');
  page.rightText(formatMoney(pdfTarget.invoice_line_net_total, currency) || '-', PAGE_WIDTH - MARGIN, y - 10, 9);
  page.text('VAT', summaryX, y - 30, 9, 'F1', '#4b5563');
  page.rightText(formatMoney(pdfTarget.invoice_total_tax_amt || pdfTarget.vat_cat_tax_amt, currency) || '-', PAGE_WIDTH - MARGIN, y - 30, 9);
  page.text('Total', summaryX, y - 50, 10, 'F2', '#111827');
  page.rightText(formatMoney(pdfTarget.invoice_total_with_tax || pdfTarget.amount_due, currency) || '-', PAGE_WIDTH - MARGIN, y - 50, 10, 'F2');
  page.text('Amount Due', summaryX, y - 70, 10, 'F2', '#111827');
  page.rightText(formatMoney(pdfTarget.amount_due || pdfTarget.invoice_total_with_tax, currency) || '-', PAGE_WIDTH - MARGIN, y - 70, 10, 'F2');

  pages.forEach((pdfPage, index) => drawFooter(pdfPage, index + 1));

  return {
    filename: getAttachmentFilename(pdfTarget),
    content: buildPdfBuffer(pages)
  };
};

module.exports = {
  createPurchaseInvoicePdf,
  getAttachmentFilename
};
