require("./config/loadEnv")();

if (typeof AbortSignal.any !== "function") {
    AbortSignal.any = (signals) => {
        const controller = new AbortController();

        const abort = (signal) => {
            controller.abort(signal.reason);
        };

        for (const signal of signals) {
            if (signal.aborted) {
                abort(signal);
                break;
            }

            signal.addEventListener("abort", () => abort(signal), { once: true });
        }

        return controller.signal;
    };
}

// Validate environment variables immediately
const validateEnvironment = require("./config/validateEnv");
validateEnvironment();

const path = require("path");
const express = require("express");
const cors = require("cors");
const db = require("./db");
const appConfig = require("./config/appConfig");
const databaseContext = require("./middleware/databaseContext");

const { startTableDrivenScheduler } = require("./CronJobs/tableDrivenScheduler");
const { startClientPortalScheduler } = require("./CronJobs/clientPortalScheduler");
const logger = require("./utils/logger");

const app = express();

app.use(cors());
app.use(express.json({ limit: "25mb" }));

// Logging middleware
app.use(logger.logHttpRequest);
app.use(databaseContext);

// Error handling middleware (must be before routes)

const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");


// Routes-----------------------------------------------------------------------------------
const invoiceRoute = require("./routes/invoice");
const authRoute = require("./routes/auth");
const configureRoute = require("./routes/configure");
const organizationRoute = require("./routes/organization");
const creditNoteRoute = require("./routes/creditNote");
const purchaseRoute = require("./routes/purchase");
const logRoute = require("./routes/logs");
const automationRoute = require("./routes/automation");
const settingsProfileRoute = require("./routes/settingsProfile");
const settingsAdminRoute = require("./routes/settingsAdmin");

// Use routes--------------------------------------------------------------------------------
app.use("/api", invoiceRoute);
app.use("/api/invoice", invoiceRoute);
// Support auth endpoints under both /api/* and /api/auth/* for frontend/backward compatibility.
app.use("/api", authRoute);
app.use("/api/auth", authRoute);
app.use("/api/configure", configureRoute);
app.use("/api/organization", organizationRoute);
app.use("/api/creditnote", creditNoteRoute);
app.use("/api/purchase", purchaseRoute);
app.use("/api/logs", logRoute);
app.use("/api/automation", automationRoute);
app.use("/api/settings-profile", settingsProfileRoute);
app.use("/api/settings-admin", settingsAdminRoute);

// Health check endpoint
app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date() });
});

// Serve React/Vite frontend build from Backend-200/Artax_ui
const frontendPath = path.join(__dirname, "Artax_ui");

app.use(express.static(frontendPath));

app.get(/.*/, (req, res, next) => {
    if (req.path.startsWith("/api") || req.path === "/health") {
        return next();
    }

    res.sendFile(path.join(frontendPath, "index.html"));
});

// 404 handler (must be after all routes)
app.use(notFoundHandler);

// Error handling middleware (must be last)
app.use(errorHandler);

db
    .connect()
    .then(() => {
        logger.info("Database connected successfully");

        startTableDrivenScheduler();
        startClientPortalScheduler();

        app.listen(appConfig.port, appConfig.host, () => {
            logger.info(`Server running on ${appConfig.host}:${appConfig.port}`);
        });
    })
    .catch((err) => {
        logger.error("Database connection failed", { error: err.message });
        process.exit(1);
    });
