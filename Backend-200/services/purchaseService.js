const purchaseRepository = require("../repositories/purchaseRepository");
const { requestAccessToken } = require("./taxillaService");
const { getPurchaseInvoiceXml } = require("./purchaseDownloadService");

const getDashboard = async (fromDate, toDate, invoiceTypeCode) =>
    purchaseRepository.getDashboardCounts(fromDate, toDate, invoiceTypeCode);

const getPurchases = async (type, fromDate, toDate, invoiceTypeCode) =>
    purchaseRepository.getPurchases(type, fromDate, toDate, invoiceTypeCode);

const getRecentActivity = async (fromDate, toDate) =>
    purchaseRepository.getRecentActivity(fromDate, toDate);

const getPurchaseDetails = async (documentNumber, invoiceTypeCode) =>
    purchaseRepository.getPurchaseDetails(documentNumber, invoiceTypeCode);

const getPurchaseTransactions = async (instanceIdentifier) =>
    purchaseRepository.getPurchaseTransactions(instanceIdentifier);

const getPurchaseInDocumentAttachment = async (documentNumber, invoiceTypeCode) =>
    purchaseRepository.getPurchaseInDocumentAttachment(documentNumber, invoiceTypeCode);

const getPurchaseTransactionXml = async (transactionId, createdBy = "system") => {
    const safeTransactionId = String(transactionId || "").trim();

    if (!safeTransactionId) {
        throw new Error("TransactionId is required");
    }

    const token = await requestAccessToken({ createdBy });
    return getPurchaseInvoiceXml({
        token,
        transactionId: safeTransactionId
    });
};

const formatExportValue = (value) => {
    if (value === null || value === undefined) return "";

    if (value instanceof Date) {
        return value.toISOString();
    }

    return String(value);
};

const escapeHtml = (value) =>
    formatExportValue(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

const escapeXml = (value) =>
    formatExportValue(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");

const columnLetter = (index) => {
    let value = index + 1;
    let result = "";

    while (value > 0) {
        const remainder = (value - 1) % 26;
        result = String.fromCharCode(65 + remainder) + result;
        value = Math.floor((value - 1) / 26);
    }

    return result;
};

const buildWorksheetXml = ({ columns, rows }) => {
    if (!Array.isArray(columns) || columns.length === 0) {
        return "";
    }

    const bodyRows = Array.isArray(rows) ? rows : [];
    const allRows = [columns, ...bodyRows.map((row) => columns.map((column) => row[column]))];

    const rowXml = allRows.map((row, rowIndex) => {
        const rowNumber = rowIndex + 1;
        const cells = row.map((value, columnIndex) => {
            const ref = `${columnLetter(columnIndex)}${rowNumber}`;
            return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`;
        }).join("");

        return `<row r="${rowNumber}">${cells}</row>`;
    }).join("");

    return [
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
        "<sheetData>",
        rowXml,
        "</sheetData>",
        "</worksheet>"
    ].join("");
};

const makeCrcTable = () => {
    const table = [];

    for (let index = 0; index < 256; index += 1) {
        let crc = index;

        for (let bit = 0; bit < 8; bit += 1) {
            crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
        }

        table[index] = crc >>> 0;
    }

    return table;
};

const crcTable = makeCrcTable();

const crc32 = (buffer) => {
    let crc = 0xffffffff;

    for (const byte of buffer) {
        crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    }

    return (crc ^ 0xffffffff) >>> 0;
};

const getDosDateTime = () => {
    const date = new Date();
    const year = Math.max(date.getFullYear(), 1980);
    const dosTime =
        (date.getHours() << 11) |
        (date.getMinutes() << 5) |
        Math.floor(date.getSeconds() / 2);
    const dosDate =
        ((year - 1980) << 9) |
        ((date.getMonth() + 1) << 5) |
        date.getDate();

    return { dosDate, dosTime };
};

const createZip = (entries) => {
    const fileParts = [];
    const centralParts = [];
    let offset = 0;
    const { dosDate, dosTime } = getDosDateTime();

    for (const entry of entries) {
        const nameBuffer = Buffer.from(entry.name, "utf8");
        const dataBuffer = Buffer.isBuffer(entry.data)
            ? entry.data
            : Buffer.from(entry.data, "utf8");
        const crc = crc32(dataBuffer);

        const localHeader = Buffer.alloc(30);
        localHeader.writeUInt32LE(0x04034b50, 0);
        localHeader.writeUInt16LE(20, 4);
        localHeader.writeUInt16LE(0, 6);
        localHeader.writeUInt16LE(0, 8);
        localHeader.writeUInt16LE(dosTime, 10);
        localHeader.writeUInt16LE(dosDate, 12);
        localHeader.writeUInt32LE(crc, 14);
        localHeader.writeUInt32LE(dataBuffer.length, 18);
        localHeader.writeUInt32LE(dataBuffer.length, 22);
        localHeader.writeUInt16LE(nameBuffer.length, 26);
        localHeader.writeUInt16LE(0, 28);

        fileParts.push(localHeader, nameBuffer, dataBuffer);

        const centralHeader = Buffer.alloc(46);
        centralHeader.writeUInt32LE(0x02014b50, 0);
        centralHeader.writeUInt16LE(20, 4);
        centralHeader.writeUInt16LE(20, 6);
        centralHeader.writeUInt16LE(0, 8);
        centralHeader.writeUInt16LE(0, 10);
        centralHeader.writeUInt16LE(dosTime, 12);
        centralHeader.writeUInt16LE(dosDate, 14);
        centralHeader.writeUInt32LE(crc, 16);
        centralHeader.writeUInt32LE(dataBuffer.length, 20);
        centralHeader.writeUInt32LE(dataBuffer.length, 24);
        centralHeader.writeUInt16LE(nameBuffer.length, 28);
        centralHeader.writeUInt16LE(0, 30);
        centralHeader.writeUInt16LE(0, 32);
        centralHeader.writeUInt16LE(0, 34);
        centralHeader.writeUInt16LE(0, 36);
        centralHeader.writeUInt32LE(0, 38);
        centralHeader.writeUInt32LE(offset, 42);

        centralParts.push(centralHeader, nameBuffer);
        offset += localHeader.length + nameBuffer.length + dataBuffer.length;
    }

    const centralDirectory = Buffer.concat(centralParts);
    const endRecord = Buffer.alloc(22);
    endRecord.writeUInt32LE(0x06054b50, 0);
    endRecord.writeUInt16LE(0, 4);
    endRecord.writeUInt16LE(0, 6);
    endRecord.writeUInt16LE(entries.length, 8);
    endRecord.writeUInt16LE(entries.length, 10);
    endRecord.writeUInt32LE(centralDirectory.length, 12);
    endRecord.writeUInt32LE(offset, 16);
    endRecord.writeUInt16LE(0, 20);

    return Buffer.concat([...fileParts, centralDirectory, endRecord]);
};

const buildXlsx = (exportData) => createZip([
    {
        name: "[Content_Types].xml",
        data: [
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
            '<Default Extension="xml" ContentType="application/xml"/>',
            '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
            '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>',
            '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>',
            "</Types>"
        ].join("")
    },
    {
        name: "_rels/.rels",
        data: [
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>',
            "</Relationships>"
        ].join("")
    },
    {
        name: "xl/workbook.xml",
        data: [
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
            '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
            "<sheets>",
            '<sheet name="Purchases" sheetId="1" r:id="rId1"/>',
            "</sheets>",
            "</workbook>"
        ].join("")
    },
    {
        name: "xl/_rels/workbook.xml.rels",
        data: [
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>',
            '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>',
            "</Relationships>"
        ].join("")
    },
    {
        name: "xl/styles.xml",
        data: [
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
            '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
            '<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>',
            '<fills count="1"><fill><patternFill patternType="none"/></fill></fills>',
            '<borders count="1"><border/></borders>',
            '<cellStyleXfs count="1"><xf/></cellStyleXfs>',
            '<cellXfs count="1"><xf xfId="0"/></cellXfs>',
            "</styleSheet>"
        ].join("")
    },
    {
        name: "xl/worksheets/sheet1.xml",
        data: buildWorksheetXml(exportData)
    }
]);

const exportPurchases = async (fromDate, toDate, search, invoiceTypeCode) => {
    const exportData = await purchaseRepository.getPurchaseExportRows(fromDate, toDate, search, invoiceTypeCode);
    return buildXlsx(exportData);
};

module.exports = {
    getDashboard,
    getPurchases,
    getRecentActivity,
    getPurchaseDetails,
    getPurchaseTransactions,
    getPurchaseInDocumentAttachment,
    getPurchaseTransactionXml,
    exportPurchases
};
