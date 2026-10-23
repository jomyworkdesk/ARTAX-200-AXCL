const path = require("path");
const nodemailer = require("nodemailer");
const appConfig = require("../config/appConfig");

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

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

const isMailDelivered = ({ to, accepted, rejected }) => {
    if (!Array.isArray(accepted)) return false;

    const rejectedEmails = Array.isArray(rejected) ? rejected.map(normalizeEmail) : [];
    return accepted.map(normalizeEmail).includes(normalizeEmail(to)) && rejectedEmails.length === 0;
};

const escapeHtml = (value) =>
    String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

const displayValue = (value) =>
    value === undefined || value === null || value === "" ? "-" : escapeHtml(value);

const padNumber = (value, length = 2) => String(value).padStart(length, "0");

const formatDatabaseDateTime = (value) => {
    if (!(value instanceof Date)) return value;

    return [
        value.getUTCFullYear(),
        padNumber(value.getUTCMonth() + 1),
        padNumber(value.getUTCDate())
    ].join("-") + " " + [
        padNumber(value.getUTCHours()),
        padNumber(value.getUTCMinutes()),
        padNumber(value.getUTCSeconds())
    ].join(":") + `.${padNumber(value.getUTCMilliseconds(), 3)}`;
};

const displayDateTimeValue = (value) => displayValue(formatDatabaseDateTime(value));

const formatAmount = (value) => {
    if (value === undefined || value === null || value === "") return "-";

    const amount = Number(value);
    return Number.isFinite(amount)
        ? escapeHtml(amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
        : escapeHtml(value);
};

const formatPlainAmount = (value) => {
    if (value === undefined || value === null || value === "") return "-";

    const amount = Number(value);
    return Number.isFinite(amount)
        ? amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : String(value);
};

const rawTextValue = (value) =>
    value === undefined || value === null || value === "" ? "-" : String(formatDatabaseDateTime(value));

const normalizeApplicationUrl = (value) => {
    const url = String(value || "").trim();
    if (!url) return null;
    return /^https?:\/\//i.test(url) ? url : `https://${url}`;
};

const fromAddress = () => {
    const name = String(appConfig.mail.fromName || "").replace(/"/g, "\\\"").trim();
    return name ? `"${name}" <${appConfig.mail.from}>` : appConfig.mail.from;
};

const summaryItem = (icon, label, value, color, theme = {}) => `
    <tr>
      <td width="48" valign="top" style="padding:0 14px 22px 0;">
        <div style="width:40px;height:40px;border-radius:10px;background:${theme.iconBg || "#fee2e2"};color:${theme.iconColor || "#dc2626"};font-size:13px;line-height:40px;text-align:center;font-weight:700;">${escapeHtml(icon)}</div>
      </td>
      <td valign="top" style="padding:0 0 22px;">
        <div style="font-size:12px;line-height:18px;color:#334155;">${escapeHtml(label)}</div>
        <div style="font-size:16px;line-height:22px;color:${color || "#111827"};font-weight:700;">${value}</div>
      </td>
    </tr>
`;

const getErrorMailTheme = (errorRow = {}) => {
    const isArtaxError = String(errorRow.Status || errorRow.status || "").trim().toUpperCase() === "ARTAX_ERROR";

    return isArtaxError
        ? {
            title: "Document Error",
            subtitle: "An ARTAX validation error has occurred and has been recorded.",
            badge: "ARTAX ERROR",
            ctaColor: "#f59e0b",
            headerColor: "#f59e0b",
            headerTextColor: "#ffffff",
            headerSubtleColor: "#fef3c7",
            iconColor: "#d97706",
            iconBg: "#fef3c7",
            badgeBg: "#fef3c7",
            badgeColor: "#92400e",
            messageBorder: "#fde68a",
            messageBg: "#fffbeb",
            messageTitleColor: "#92400e",
            statusColor: "#d97706"
        }
        : {
            title: "Document Failed",
            subtitle: "An e-Invoice submission has failed and has been recorded in ARTAX.",
            badge: "ERROR",
            ctaColor: "#dc2626",
            headerColor: "#dc2626",
            headerTextColor: "#ffffff",
            headerSubtleColor: "#fee2e2",
            iconColor: "#dc2626",
            iconBg: "#fee2e2",
            badgeBg: "#fee2e2",
            badgeColor: "#b91c1c",
            messageBorder: "#fecaca",
            messageBg: "#fff5f5",
            messageTitleColor: "#991b1b",
            statusColor: "#dc2626"
        };
};

const buildValidationErrorMailHtml = (errorRow) => {
    const applicationUrl = normalizeApplicationUrl(appConfig.mail.applicationUrl);
    const theme = getErrorMailTheme(errorRow);
    const cta = applicationUrl
        ? `<a href="${escapeHtml(applicationUrl)}" style="display:inline-block;background:${theme.ctaColor};border-radius:7px;color:#ffffff;font-size:15px;font-weight:700;line-height:22px;padding:13px 28px;text-decoration:none;">View in ARTAX&nbsp;&nbsp;&gt;</a>`
        : "";

    return `
      <div style="margin:0;padding:0;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#111827;">
        <div style="max-width:760px;margin:0 auto;padding:18px 12px;">
          <div style="background:#ffffff;border:1px solid #e5edf5;border-radius:14px;overflow:hidden;box-shadow:0 14px 40px rgba(15,23,42,.08);">
            <div style="padding:12px 26px;">
              <img src="cid:${LOGO_CID}" alt="ARTAX e-Invoicing" width="128" style="display:block;width:128px;max-width:100%;height:auto;border:0;">
            </div>
            <div style="background:${theme.headerColor};color:${theme.headerTextColor};padding:16px 26px;">
              <h1 style="margin:0 0 3px;font-size:22px;line-height:28px;font-weight:700;">${escapeHtml(theme.title)}</h1>
              <div style="font-size:14px;line-height:20px;color:${theme.headerSubtleColor};">${escapeHtml(theme.subtitle)}</div>
            </div>
            <div style="padding:26px 26px 0;">
              <div style="border:1px solid #e3e8ef;border-radius:12px;padding:22px 22px 6px;box-shadow:0 8px 24px rgba(15,23,42,.06);">
                <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
                  <tr>
                    <td style="padding:0 0 22px;">
                      <span style="display:inline-block;width:30px;height:30px;color:${theme.iconColor};font-size:19px;line-height:30px;text-align:center;font-weight:700;">!</span>
                      <span style="font-size:19px;line-height:30px;font-weight:700;color:#111827;">${escapeHtml(theme.title)} Details</span>
                    </td>
                    <td align="right" style="padding:0 0 22px;">
                      <span style="display:inline-block;background:${theme.badgeBg};border-radius:18px;color:${theme.badgeColor};font-size:13px;font-weight:700;line-height:28px;padding:0 17px;">${escapeHtml(theme.badge)}</span>
                    </td>
                  </tr>
                </table>
                <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
                  <tr>
                    <td valign="top" style="width:50%;padding:0 28px 0 0;">
                      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
                        ${summaryItem("IID", "Instance Identifier", displayValue(errorRow.InstanceIdentifier), null, theme)}
                        ${summaryItem("INV", "Document Number", displayValue(errorRow.InvNumber), null, theme)}
                        ${summaryItem("DT", "Document Date", displayDateTimeValue(errorRow.InvDate), null, theme)}
                        ${summaryItem("CUS", "Customer", displayValue(errorRow.Customer), null, theme)}
                      </table>
                    </td>
                    <td valign="top" style="width:50%;padding:0 0 0 28px;border-left:1px solid #e3e8ef;">
                      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
                        ${summaryItem("AMT", "Document Amount", formatAmount(errorRow.InvoiceAmt), null, theme)}
                        ${summaryItem("STS", "Status", displayValue(errorRow.Status || errorRow.status), theme.statusColor, theme)}
                        ${summaryItem("ERR", "Error At", displayDateTimeValue(errorRow.ErrorAt), null, theme)}
                        ${summaryItem("LOG", "Created At", displayDateTimeValue(errorRow.CreatedAt), null, theme)}
                      </table>
                    </td>
                  </tr>
                </table>
              </div>
              <div style="margin:20px 0 18px;border:1px solid ${theme.messageBorder};border-radius:8px;background:${theme.messageBg};color:#1f2937;font-size:15px;line-height:24px;padding:14px 18px;">
                <div style="font-weight:700;color:${theme.messageTitleColor};margin-bottom:8px;">${escapeHtml(theme.title)} Message</div>
                <div style="white-space:pre-wrap;">${displayValue(errorRow.Error)}</div>
              </div>
              <div style="text-align:center;padding:0 0 18px;">${cta}</div>
            </div>
            <div style="border-top:1px solid #e3e8ef;padding:20px 34px;color:#374151;font-size:14px;line-height:22px;">
              Need help? Contact us at <a href="mailto:${escapeHtml(appConfig.mail.supportEmail)}" style="color:#0875f4;text-decoration:none;">${escapeHtml(appConfig.mail.supportEmail)}</a>
            </div>
          </div>
        </div>
      </div>
    `;
};

const buildValidationErrorMailText = (errorRow) => [
    getErrorMailTheme(errorRow).title,
    "",
    getErrorMailTheme(errorRow).subtitle,
    "",
    `Instance Identifier: ${errorRow.InstanceIdentifier || "-"}`,
    `Document Number: ${errorRow.InvNumber || "-"}`,
    `Document Date: ${rawTextValue(errorRow.InvDate)}`,
    `Customer: ${errorRow.Customer || "-"}`,
    `Document Amount: ${formatPlainAmount(errorRow.InvoiceAmt)}`,
    `Status: ${errorRow.Status || errorRow.status || "-"}`,
    `Error At: ${rawTextValue(errorRow.ErrorAt)}`,
    `Created At: ${rawTextValue(errorRow.CreatedAt)}`,
    "",
    `${getErrorMailTheme(errorRow).title} Message:`,
    errorRow.Error || "-"
].join("\n");

const sendInvoiceValidationErrorMail = async (errorRow) => {
    const to = cleanEmail(errorRow?.tomail);
    if (!to) {
        throw new Error("E_config.tomail is empty");
    }

    const cc = splitEmails(errorRow?.ccmail);
    const subject = `${getErrorMailTheme(errorRow).title} - ${errorRow.InvNumber || errorRow.InstanceIdentifier || "Invoice"}`;
    const mailResult = await getTransporter().sendMail({
        from: fromAddress(),
        to,
        cc,
        subject,
        text: buildValidationErrorMailText(errorRow),
        html: buildValidationErrorMailHtml(errorRow),
        attachments: [
            {
                filename: "logo1.png",
                path: LOGO_PATH,
                cid: LOGO_CID
            }
        ]
    });

    return {
        to,
        cc,
        messageId: mailResult.messageId,
        accepted: Array.isArray(mailResult.accepted) ? mailResult.accepted : [],
        rejected: Array.isArray(mailResult.rejected) ? mailResult.rejected : [],
        delivered: isMailDelivered({
            to,
            accepted: mailResult.accepted,
            rejected: mailResult.rejected
        })
    };
};

module.exports = {
    sendInvoiceValidationErrorMail
};
