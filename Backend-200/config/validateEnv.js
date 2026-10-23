require("./loadEnv")();

const validateEnvironment = () => {
    const requiredEnvVars = [
        "DB_USER",
        "DB_PASSWORD",
        "DB_SERVER",
        "DB_PORT",
        "DB_NAME",
        "DB_ENCRYPT",
        "DB_TRUST_CERT",
        "DB_POOL_MAX",
        "DB_POOL_MIN",
        "DB_POOL_IDLE_MS",
        "DB_REQUEST_TIMEOUT",
        "DB_CONNECTION_TIMEOUT",
        "PORT",
        "HOST",
        "NODE_ENV",
        "JWT_SECRET",
        "PORTAL_URL",
        "TAXILLA_TOKEN_URL",
        "TAXILLA_OUTBOUND_URL",
        "TAXILLA_INSTANCE_IDENTIFIERS_URL",
        "TAXILLA_TRANSACTIONS_URL",
        "TAXILLA_ARTIFACT_STREAM_URL",
        "TAXILLA_CLIENT_ID",
        "TAXILLA_CLIENT_SECRET",
        "OUTBOUND_USER_AGENT",
        "AUTO_SEND_BATCH_SIZE",
        "PURCHASE_TRANSACTION_UPDATE_LIMIT",
        "MAIL_HOST",
        "MAIL_PORT",
        "MAIL_SECURE",
        "MAIL_USER",
        "MAIL_PASS",
        "MAIL_FROM",
        "MAIL_FROM_NAME",
        "MAIL_APPLICATION_URL",
        "MAIL_SUPPORT_EMAIL"
    ];
    const missingVars = requiredEnvVars.filter(
        (envVar) => !process.env[envVar]
    );

    if (missingVars.length > 0) {
        throw new Error(
            `Missing required environment variables: ${missingVars.join(", ")}. ` +
                "Please check your .env file or create one based on .env.example"
        );
    }

    const portEnvVars = ["PORT", "DB_PORT", "MAIL_PORT"];
    const invalidPort = portEnvVars.find((envVar) => {
        const port = Number(process.env[envVar]);
        return Number.isNaN(port) || port < 1 || port > 65535;
    });

    if (invalidPort) {
        throw new Error(
            `${invalidPort} must be a valid number between 1 and 65535. Got: ${process.env[invalidPort]}`
        );
    }

    const numberEnvVars = [
        "DB_POOL_MAX",
        "DB_POOL_MIN",
        "DB_POOL_IDLE_MS",
        "DB_REQUEST_TIMEOUT",
        "DB_CONNECTION_TIMEOUT",
        "AUTO_SEND_BATCH_SIZE",
        "PURCHASE_TRANSACTION_UPDATE_LIMIT"
    ];
    const invalidNumber = numberEnvVars.find((envVar) =>
        Number.isNaN(Number(process.env[envVar]))
    );

    if (invalidNumber) {
        throw new Error(
            `${invalidNumber} must be a valid number. Got: ${process.env[invalidNumber]}`
        );
    }

    console.log("Environment validation passed");
};

module.exports = validateEnvironment;
