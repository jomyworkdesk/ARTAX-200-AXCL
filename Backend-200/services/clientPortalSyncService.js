const clientPortalRepository = require("../repositories/clientPortalSyncRepository");
const {
    postClientTransactions,
    getClientSubscription
} = require("./portal");

let isRunning = false;
const CLIENT_PORTAL_BATCH_SIZE = 10;

const toPortalTransaction = (row) => ({
    clientCode: row.clientCode,
    Peppolid: row.Peppolid,
    Period: row.Period,
    lastVolume: row.lastVolume,
    InstanceIdentifier: row.InstanceIdentifier,
    DocDate: row.DocDate,
    Invoiceno: row.Invoiceno,
    Type: row.Type,
    transtype: row.transtype
});

const getSubscriptionRow = (subscriptionResult) =>
    Array.isArray(subscriptionResult?.data) ? subscriptionResult.data[0] : null;

const syncClientPortalTransactions = async () => {
    if (isRunning) {
        return {
            skipped: true,
            reason: "Client portal sync is already processing"
        };
    }

    isRunning = true;

    try {
        const config = await clientPortalRepository.getClientPortalConfig();
        if (!config) {
            return {
                skipped: true,
                reason: "E_config row was not found"
            };
        }

        const clientCode = String(config.RefCode || "").trim();
        if (!clientCode) {
            return {
                skipped: true,
                reason: "E_config.RefCode is empty"
            };
        }

        const outboundRows = await clientPortalRepository.getPendingOutboundTransactions({
            limit: CLIENT_PORTAL_BATCH_SIZE
        });
        const remainingBatchSize = Math.max(CLIENT_PORTAL_BATCH_SIZE - outboundRows.length, 0);
        const inboundRows = remainingBatchSize > 0
            ? await clientPortalRepository.getPendingInboundTransactions({ limit: remainingBatchSize })
            : [];
        const transactions = [
            ...outboundRows.map(toPortalTransaction),
            ...inboundRows.map(toPortalTransaction)
        ];

        let markedOutbound = 0;
        let markedInbound = 0;

        if (transactions.length) {
            const transactionResult = await postClientTransactions(transactions);
            if (!transactionResult.success) {
                throw new Error(transactionResult.message || "Client transactions portal request failed");
            }

            markedOutbound = await clientPortalRepository.markOutboundTransactionsPortalSent({
                queueIds: outboundRows.map((row) => row.QueueID)
            });
            markedInbound = await clientPortalRepository.markInboundTransactionsPortalSent({
                queueIds: inboundRows.map((row) => row.QueueId)
            });
        }

        const subscriptionResult = await getClientSubscription({ ClientCode: clientCode });
        if (!subscriptionResult.success) {
            throw new Error(subscriptionResult.message || "Client subscription portal request failed");
        }

        const subscription = getSubscriptionRow(subscriptionResult);
        if (!subscription) {
            throw new Error("Client subscription response did not include data");
        }

        const updatedConfig = await clientPortalRepository.updateClientPortalSubscription({
            configId: config.id,
            periodId: subscription.Periodid,
            volume: subscription.Volume,
            ref: subscription.Ref
        });

        return {
            queued: transactions.length,
            posted: transactions.length,
            outbound: outboundRows.length,
            inbound: inboundRows.length,
            markedOutbound,
            markedInbound,
            subscriptionUpdated: updatedConfig,
            batchSize: CLIENT_PORTAL_BATCH_SIZE,
            subscription: {
                Periodid: subscription.Periodid,
                Volume: subscription.Volume,
                Ref: subscription.Ref
            }
        };
    } finally {
        isRunning = false;
    }
};

module.exports = {
    syncClientPortalTransactions
};
