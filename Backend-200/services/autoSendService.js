const db = require("../db");
const queueRepository = require("../repositories/eInvoiceQueueRepository");
const invoiceSendService = require("./invoiceSendService");
const creditNoteSendService = require("./creditNoteSendService");

const AUTO_SEND_BATCH_SIZE = Number(process.env.AUTO_SEND_BATCH_SIZE);
const SYSTEM_CREATED_BY = "autosend";

let isRunning = false;

const logPrefix = () => `[AutoSend ${new Date().toISOString()}]`;

const sendQueueRow = async (queueRow) => {
    const invoiceNumber = queueRow.InvNumber;
    const docType = Number(queueRow.DocType);

    if (docType === invoiceSendService.INVOICE_DOC_TYPE) {
        return invoiceSendService.sendInvoice({
            invoiceNumber,
            createdBy: SYSTEM_CREATED_BY
        });
    }

    if (docType === creditNoteSendService.CREDIT_NOTE_DOC_TYPE) {
        return creditNoteSendService.sendCreditNote({
            invoiceNumber,
            createdBy: SYSTEM_CREATED_BY
        });
    }

    throw new Error(`Unsupported DocType for autosend: ${queueRow.DocType}`);
};

const runAutoSend = async () => {
    console.log(`${logPrefix()} running`);

    if (isRunning) {
        console.log(`${logPrefix()} skipped: previous run is still processing`);
        return {
            skipped: true,
            message: "Auto Send is already running"
        };
    }

    isRunning = true;

    try {
        const status = await queueRepository.getAutoSendQueueStatus();
        console.log(
            `${logPrefix()} status: autosend=1 ${status.autoSendOn || 0}, ` +
            `ready ${status.readyToSend || 0}, waiting E_Invoicing ${status.waitingForEInvoicing || 0}, ` +
            `processing ${status.processing || 0}, sent ${status.sent || 0}, error ${status.error || 0}, ` +
            `autosend=2 ${status.autoSendOff || 0}`
        );

        const queueRows = await db.withTransaction((tx) =>
            queueRepository.lockAutoSendQueue(tx, AUTO_SEND_BATCH_SIZE)
        );

        if (queueRows.length === 0) {
            console.log(`${logPrefix()} no eligible autosend documents found`);
            return {
                processed: 0,
                sentCount: 0,
                failedCount: 0,
                noAutoSendTransactions: true
            };
        }

        const results = [];
        console.log(`${logPrefix()} locked ${queueRows.length} document(s) for sending`);

        for (const queueRow of queueRows) {
            console.log(
                `${logPrefix()} sending QueueID=${queueRow.QueueID}, ` +
                `InvNumber=${queueRow.InvNumber}, DocType=${queueRow.DocType}`
            );

            try {
                const result = await sendQueueRow(queueRow);
                console.log(
                    `${logPrefix()} success QueueID=${queueRow.QueueID}, ` +
                    `HTTP=${result.statusCode}, message=${result.responseMessage || "sent"}`
                );

                results.push({
                    QueueID: queueRow.QueueID,
                    InvNumber: queueRow.InvNumber,
                    DocType: queueRow.DocType,
                    success: true,
                    statusCode: result.statusCode,
                    responseMessage: result.responseMessage
                });
            } catch (error) {
                console.error(
                    `${logPrefix()} failed QueueID=${queueRow.QueueID}, ` +
                    `InvNumber=${queueRow.InvNumber}, DocType=${queueRow.DocType}: ` +
                    `${error.message || "Failed to autosend XML"}`
                );

                results.push({
                    QueueID: queueRow.QueueID,
                    InvNumber: queueRow.InvNumber,
                    DocType: queueRow.DocType,
                    success: false,
                    message: error.message || "Failed to autosend XML"
                });
            } finally {
                await queueRepository.releaseQueueEntries(db, [queueRow]);
            }
        }

        const sentCount = results.filter((result) => result.success).length;
        const failedCount = results.length - sentCount;

        console.log(
            `${logPrefix()} completed: processed ${queueRows.length}, ` +
            `success ${sentCount}, failed ${failedCount}`
        );

        return {
            processed: queueRows.length,
            sentCount,
            failedCount,
            results
        };
    } finally {
        isRunning = false;
    }
};

module.exports = {
    runAutoSend
};
