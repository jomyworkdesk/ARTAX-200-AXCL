const bcrypt = require("bcrypt");
const settingsProfileRepository = require("../repositories/settingsProfileRepository");

const cleanText = (value) => String(value ?? "").trim();

const getSessionContext = (session = {}) => ({
    AgentId: session.AgentId,
    UserName: session.UserName,
    DatabaseName: session.DatabaseName
});

const getProfile = async (session) => {
    const context = getSessionContext(session);
    if (!context.AgentId || !context.UserName) {
        throw new Error("Logged-in user details are required");
    }

    const [webLogin, mailConfig] = await Promise.all([
        settingsProfileRepository.getWebLoginByAgentAndUser(context),
        settingsProfileRepository.getMailConfig(context.DatabaseName)
    ]);

    return {
        user: webLogin
            ? {
                AutoIndex: webLogin.AutoIndex,
                AgentId: webLogin.AgentId,
                UserName: webLogin.UserName,
                ModifiedDate: webLogin.ModifiedDate
            }
            : {
                AgentId: context.AgentId,
                UserName: context.UserName,
                ModifiedDate: null
            },
        mail: mailConfig
            ? {
                id: mailConfig.id,
                tomail: mailConfig.tomail || "",
                ccmail: mailConfig.ccmail || ""
            }
            : null
    };
};

const changePassword = async (session, payload = {}) => {
    const context = getSessionContext(session);
    const currentPassword = cleanText(payload.currentPassword);
    const newPassword = cleanText(payload.newPassword);

    if (!context.AgentId || !context.UserName) {
        throw new Error("Logged-in user details are required");
    }

    if (!currentPassword || !newPassword) {
        throw new Error("Current password and new password are required");
    }

    if (newPassword.length < 6) {
        throw new Error("New password must be at least 6 characters");
    }

    const webLogin = await settingsProfileRepository.getWebLoginByAgentAndUser(context);
    if (!webLogin) {
        throw new Error("User login not found");
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, webLogin.Password);
    if (!isPasswordValid) {
        throw new Error("Current password is incorrect");
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await settingsProfileRepository.updateWebLoginPassword({
        AutoIndex: webLogin.AutoIndex,
        hashedPassword,
        DatabaseName: context.DatabaseName
    });

    return { UserName: webLogin.UserName };
};

const updateMail = async (session, payload = {}) => {
    const context = getSessionContext(session);
    const existing = await settingsProfileRepository.getMailConfig(context.DatabaseName);

    if (!existing?.id) {
        throw new Error("Mail configuration not found");
    }

    return settingsProfileRepository.updateMailConfig({
        id: existing.id,
        tomail: cleanText(payload.tomail),
        ccmail: cleanText(payload.ccmail),
        DatabaseName: context.DatabaseName
    });
};

module.exports = {
    getProfile,
    changePassword,
    updateMail
};
