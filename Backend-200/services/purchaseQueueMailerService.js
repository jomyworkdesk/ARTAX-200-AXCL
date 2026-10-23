const path = require("path");
const nodemailer = require("nodemailer");
const appConfig = require("../config/appConfig");
const { createPurchaseInvoicePdf } = require("./purchaseInvoicePdf");

let transporter = null;

const LOGO_CID = "artax-logo";
const LOGO_PATH = path.resolve(__dirname, "..", "Artax_ui", "logo1.png");

const requireMailConfig = () => {
    const missing = [];
    if (!appConfig.mail.host) missing.push("MAIL_HOST");
    if (!appConfig.mail.user) missing.push("MAIL_USER");
    if (!appConfig.mail.pass) missing.push("MAIL_PASS");
    if (!appConfig.mail.from) missing.push("MAIL_FROM");

    if (missing.length) {
        throw new Error(`Missing mail configuration: ${missing.join(", ")}`);
    }
};

const getTransporter = () => {
    if (!transporter) {
        requireMailConfig();
        transporter = nodemailer.createTransport({
            host: appConfig.mail.host,
            port: appConfig.mail.port,
            secure: appConfig.mail.secure,
            auth: {
                user: appConfig.mail.user,
                pass: appConfig.mail.pass
            }
        });
    }

    return transporter;
};

const cleanEmail = (value) => {
    const email = String(value || "").trim();
    return email || null;
};

const splitEmails = (value) =>
    String(value || "")
        .split(/[;,]/)
        .map(cleanEmail)
        .filter(Boolean);

const escapeHtml = (value) =>
    String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

const displayValue = (value) =>
    value === undefined || value === null || value === "" ? "-" : escapeHtml(value);

const valueFrom = (target, keys) => {
    const row = target.purchaseRows?.[0] || {};

    for (const key of keys) {
        if (row[key] !== undefined && row[key] !== null && row[key] !== "") return row[key];
        if (target[key] !== undefined && target[key] !== null && target[key] !== "") return target[key];
    }

    return null;
};

const resolvePurchaseDocumentType = (target) => {
    const invoiceType = String(valueFrom(target, ["InvoiceType", "invoice_type_code"]) || "").trim();
    return invoiceType === "380" ? "Purchase Invoice" : "Purchase Return";
};

const formatAmount = (value, currency) => {
    if (value === undefined || value === null || value === "") return "-";

    const amount = Number(value);
    const formattedAmount = Number.isFinite(amount)
        ? amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : String(value);

    return `${currency ? `${escapeHtml(currency)} ` : ""}${escapeHtml(formattedAmount)}`;
};

const formatDate = (value) => {
    if (!value) return "-";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return escapeHtml(value);
    return escapeHtml(date.toLocaleDateString("en-AE", {
        year: "numeric",
        month: "short",
        day: "2-digit"
    }));
};

const normalizeApplicationUrl = (value) => {
    const url = String(value || "").trim();
    if (!url) return null;
    return /^https?:\/\//i.test(url) ? url : `https://${url}`;
};

const fromAddress = () => {
    const name = String(appConfig.mail.fromName || "").replace(/"/g, "\\\"").trim();
    return name ? `"${name}" <${appConfig.mail.from}>` : appConfig.mail.from;
};

const summaryItem = (label, value) => `
    <tr>
      <td style="padding: 0 16px 14px 0; color: #475569; font-size: 13px;">${escapeHtml(label)}</td>
      <td style="padding: 0 0 14px; color: #111827; font-size: 14px; font-weight: 700;">${value}</td>
    </tr>
`;

const buildPurchaseMailHtml = (target, invoiceType) => {
    const currency = valueFrom(target, ["invoice_currency_code"]) || "AED";
    const totalAmount = valueFrom(target, ["invoice_total_with_tax", "amount_due", "invoice_line_net_total"]);
    const vatAmount = valueFrom(target, ["invoice_total_tax_amt", "vat_cat_tax_amt"]);
    const applicationUrl = normalizeApplicationUrl(appConfig.mail.applicationUrl);
    const cta = applicationUrl
        ? `<a href="${escapeHtml(applicationUrl)}" style="display:inline-block;background:#0875f4;border-radius:7px;color:#fff;font-size:15px;font-weight:700;line-height:22px;padding:13px 28px;text-decoration:none;">View Invoice in ARTAX</a>`
        : "";

    return `
      <div style="margin:0;padding:0;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#111827;">
        <div style="max-width:760px;margin:0 auto;padding:18px 12px;">
          <div style="background:#fff;border:1px solid #e5edf5;border-radius:14px;overflow:hidden;box-shadow:0 14px 40px rgba(15,23,42,.08);">
            <div style="padding:12px 26px;">
              <img src="cid:${LOGO_CID}" alt="ARTAX e-Invoicing" width="128" style="display:block;width:128px;max-width:100%;height:auto;border:0;">
            </div>
            <div style="background:#16a34a;color:#fff;padding:16px 26px;">
              <h1 style="margin:0 0 3px;font-size:22px;line-height:28px;font-weight:700;">New ${escapeHtml(invoiceType)} Received</h1>
              <div style="font-size:14px;line-height:20px;color:#ecfdf3;">A new ${escapeHtml(invoiceType)} has been received successfully in ARTAX.</div>
            </div>
            <div style="padding:26px;">
              <div style="border:1px solid #e3e8ef;border-radius:12px;padding:22px;">
                <h2 style="margin:0 0 18px;font-size:19px;line-height:26px;">Invoice Summary</h2>
                <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
                  ${summaryItem("Invoice Number", displayValue(valueFrom(target, ["invoice_no", "InvoiceNo"])))}
                  ${summaryItem("Invoice Date", formatDate(valueFrom(target, ["invoice_issue_date"])))}
                  ${summaryItem("Supplier", displayValue(valueFrom(target, ["seller_name", "seller_trade_name"])))}
                  ${summaryItem("Customer", displayValue(valueFrom(target, ["buyer_name", "buyer_trade_name"])))}
                  ${summaryItem("Document Type", displayValue(invoiceType))}
                  ${summaryItem("Total Amount", formatAmount(totalAmount, currency))}
                  ${summaryItem("VAT Amount", formatAmount(vatAmount, currency))}
                  ${summaryItem("Currency", displayValue(currency))}
                  ${summaryItem("Status", "Received")}
                </table>
              </div>
              <div style="margin:20px 0 18px;border:1px solid #bfe9ce;border-radius:8px;background:#f4fcf7;color:#1f2937;font-size:15px;line-height:24px;padding:14px 18px;">
                This e-Invoice has been successfully received and is ready for review in the system.
              </div>
              <div style="text-align:center;">${cta}</div>
            </div>
            <div style="border-top:1px solid #e3e8ef;padding:20px 34px;color:#374151;font-size:14px;line-height:22px;">
              Need help? Contact us at <a href="mailto:${escapeHtml(appConfig.mail.supportEmail)}" style="color:#0875f4;text-decoration:none;">${escapeHtml(appConfig.mail.supportEmail)}</a>
            </div>
          </div>
        </div>
      </div>
    `;
};

const buildPurchaseMailText = (target, invoiceType) => [
    `New ${invoiceType} Received`,
    "",
    `Invoice Number: ${valueFrom(target, ["invoice_no", "InvoiceNo"]) || "-"}`,
    `Invoice Date: ${valueFrom(target, ["invoice_issue_date"]) || "-"}`,
    `Supplier: ${valueFrom(target, ["seller_name", "seller_trade_name"]) || "-"}`,
    `Customer: ${valueFrom(target, ["buyer_name", "buyer_trade_name"]) || "-"}`,
    `Document Type: ${invoiceType || "-"}`,
    `Instance Identifier: ${target.InstanceIdentifier || "-"}`
].join("\n");

const sendPurchaseQueueMail = async ({ queueRow, purchaseRows, mailConfig }) => {
    const to = cleanEmail(mailConfig?.tomail);
    if (!to) {
        throw new Error("E_config.tomail is empty");
    }

    const cc = splitEmails(mailConfig?.ccmail);
    const target = {
        ...queueRow,
        purchaseRows
    };
    const documentType = resolvePurchaseDocumentType(target);
    const pdfAttachment = createPurchaseInvoicePdf(target);
    const subject = `New ${documentType} Received`;
    const mailResult = await getTransporter().sendMail({
        from: fromAddress(),
        to,
        cc,
        subject,
        text: buildPurchaseMailText(target, documentType),
        html: buildPurchaseMailHtml(target, documentType),
        attachments: [
            {
                filename: "logo1.png",
                path: LOGO_PATH,
                cid: LOGO_CID
            },
            {
                filename: pdfAttachment.filename,
                content: pdfAttachment.content,
                contentType: "application/pdf"
            }
        ]
    });

    return {
        to,
        cc,
        messageId: mailResult.messageId
    };
};

module.exports = {
    sendPurchaseQueueMail
};
