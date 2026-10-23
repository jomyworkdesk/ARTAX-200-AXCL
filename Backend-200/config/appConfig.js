const appConfig = {
    port: Number(process.env.PORT),
    host: process.env.HOST,
    jwtSecret: process.env.JWT_SECRET,
    nodeEnv: process.env.NODE_ENV,
    portalUrl: process.env.PORTAL_URL,
    mail: {
        host: process.env.MAIL_HOST,
        port: Number(process.env.MAIL_PORT),
        secure: String(process.env.MAIL_SECURE).toLowerCase() === "true",
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
        from: process.env.MAIL_FROM,
        fromName: process.env.MAIL_FROM_NAME,
        applicationUrl: process.env.MAIL_APPLICATION_URL,
        supportEmail: process.env.MAIL_SUPPORT_EMAIL
    }
};

module.exports = appConfig;
