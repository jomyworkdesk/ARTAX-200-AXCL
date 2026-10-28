const sql = require("mssql");
const { AsyncLocalStorage } = require("async_hooks");
const { rewriteSql } = require("./config/databaseSchema");

const databaseContextStorage = new AsyncLocalStorage();

const toBoolean = (value) => {
    if (typeof value === "boolean") {
        return value;
    }

    return String(value).toLowerCase() === "true";
};

const getConfig = () => {
    return {
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        server: process.env.DB_SERVER,
        port: Number(process.env.DB_PORT),
        database: process.env.DB_NAME,
        options: {
            encrypt: toBoolean(process.env.DB_ENCRYPT),
            trustServerCertificate: toBoolean(process.env.DB_TRUST_CERT),
            // Temporary compatibility with SQL Server 2008 R2 RTM.
            cryptoCredentialsDetails: {
                minVersion: "TLSv1"
            }
        }
    };
};

const dbConfig = {
    ...getConfig(),
    pool: {
        max: Number(process.env.DB_POOL_MAX),
        min: Number(process.env.DB_POOL_MIN),
        idleTimeoutMillis: Number(process.env.DB_POOL_IDLE_MS)
    },
    requestTimeout: Number(process.env.DB_REQUEST_TIMEOUT),
    connectionTimeout: Number(process.env.DB_CONNECTION_TIMEOUT)
};

let poolPromise;
const databasePoolPromises = new Map();

const normalizeDatabaseName = (databaseName) => {
    const selectedDatabase = String(databaseName || "").trim();
    return selectedDatabase || null;
};

const getContextDatabaseName = () =>
    databaseContextStorage.getStore()?.databaseName || null;

const getPool = async (databaseName, options = {}) => {
    const selectedDatabase = normalizeDatabaseName(databaseName) ||
        (options.ignoreContext ? null : getContextDatabaseName());

    if (!selectedDatabase || selectedDatabase === dbConfig.database) {
        if (!poolPromise) {
            const pool = new sql.ConnectionPool(dbConfig);
            poolPromise = pool.connect();
        }

        return poolPromise;
    }

    if (!databasePoolPromises.has(selectedDatabase)) {
        const pool = new sql.ConnectionPool({
            ...dbConfig,
            database: selectedDatabase
        });
        databasePoolPromises.set(selectedDatabase, pool.connect());
    }

    return databasePoolPromises.get(selectedDatabase);
};

const bindRequestValues = (request, values) => {
    values.forEach((value, index) => {
        request.input(`p${index}`, value);
    });
};

const buildParameterizedStatement = (strings, values) => {
    let statement = "";

    for (let index = 0; index < strings.length; index += 1) {
        statement += strings[index];

        if (index < values.length) {
            statement += `@p${index}`;
        }
    }

    return statement;
};

const extractRecordset = (result) => {
    if (Array.isArray(result.recordsets) && result.recordsets.length > 0) {
        for (let index = result.recordsets.length - 1; index >= 0; index -= 1) {
            if (result.recordsets[index]?.length) {
                return result.recordsets[index];
            }
        }

        return result.recordsets[result.recordsets.length - 1] || [];
    }

    return result.recordset || [];
};

const createClient = (requestFactory) => ({
    async query(strings, ...values) {
        const request = requestFactory();
        bindRequestValues(request, values);
        const statement = rewriteSql(buildParameterizedStatement(strings, values));
        const result = await request.query(statement);
        return extractRecordset(result);
    },

    async execute(strings, ...values) {
        const request = requestFactory();
        bindRequestValues(request, values);
        const statement = rewriteSql(buildParameterizedStatement(strings, values));
        const result = await request.query(statement);
        return Array.isArray(result.rowsAffected)
            ? result.rowsAffected.reduce((sum, count) => sum + count, 0)
            : 0;
    },

    async queryUnsafe(statement) {
        const request = requestFactory();
        const result = await request.query(rewriteSql(statement));
        return extractRecordset(result);
    },

    async executeUnsafe(statement) {
        const request = requestFactory();
        const result = await request.query(rewriteSql(statement));
        return Array.isArray(result.rowsAffected)
            ? result.rowsAffected.reduce((sum, count) => sum + count, 0)
            : 0;
    },

    async executeStatement(statement, values = []) {
        const request = requestFactory();
        bindRequestValues(request, values);
        const result = await request.query(rewriteSql(statement));
        return Array.isArray(result.rowsAffected)
            ? result.rowsAffected.reduce((sum, count) => sum + count, 0)
            : 0;
    },

    async queryStatement(statement, values = []) {
        const request = requestFactory();
        bindRequestValues(request, values);
        const result = await request.query(rewriteSql(statement));
        return extractRecordset(result);
    }
});

const rootClient = createClient(() => {
    throw new Error("Database connection has not been initialized");
});

rootClient.connect = async () => {
    const pool = await getPool(null, { ignoreContext: true });
    return pool;
};

rootClient.close = async () => {
    const closePromises = [];

    if (poolPromise) {
        closePromises.push(poolPromise.then((pool) => pool.close()));
        poolPromise = null;
    }

    databasePoolPromises.forEach((databasePoolPromise) => {
        closePromises.push(databasePoolPromise.then((pool) => pool.close()));
    });
    databasePoolPromises.clear();

    await Promise.all(closePromises);
};

rootClient.query = async (strings, ...values) => {
    const pool = await getPool();
    return createClient(() => pool.request()).query(strings, ...values);
};

rootClient.execute = async (strings, ...values) => {
    const pool = await getPool();
    return createClient(() => pool.request()).execute(strings, ...values);
};

rootClient.queryUnsafe = async (statement) => {
    const pool = await getPool();
    return createClient(() => pool.request()).queryUnsafe(statement);
};

rootClient.executeUnsafe = async (statement) => {
    const pool = await getPool();
    return createClient(() => pool.request()).executeUnsafe(statement);
};

rootClient.executeStatement = async (statement, values = []) => {
    const pool = await getPool();
    return createClient(() => pool.request()).executeStatement(statement, values);
};

rootClient.queryStatement = async (statement, values = []) => {
    const pool = await getPool();
    return createClient(() => pool.request()).queryStatement(statement, values);
};

rootClient.withTransaction = async (callback) => {
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);

    await transaction.begin();

    try {
        const txClient = createClient(() => new sql.Request(transaction));
        const result = await callback(txClient);
        await transaction.commit();
        return result;
    } catch (error) {
        try {
            await transaction.rollback();
        } catch (rollbackError) {
            // SQL Server may have already rolled back a deadlock victim.
            error.rollbackError = rollbackError;
        }
        throw error;
    }
};

rootClient.forDatabase = (databaseName) => {
    const selectedDatabase = normalizeDatabaseName(databaseName);

    if (!selectedDatabase) {
        throw new Error("Database name is required");
    }

    return {
        async query(strings, ...values) {
            const pool = await getPool(selectedDatabase);
            return createClient(() => pool.request()).query(strings, ...values);
        },

        async execute(strings, ...values) {
            const pool = await getPool(selectedDatabase);
            return createClient(() => pool.request()).execute(strings, ...values);
        },

        async queryUnsafe(statement) {
            const pool = await getPool(selectedDatabase);
            return createClient(() => pool.request()).queryUnsafe(statement);
        },

        async executeUnsafe(statement) {
            const pool = await getPool(selectedDatabase);
            return createClient(() => pool.request()).executeUnsafe(statement);
        },

        async executeStatement(statement, values = []) {
            const pool = await getPool(selectedDatabase);
            return createClient(() => pool.request()).executeStatement(statement, values);
        },

        async queryStatement(statement, values = []) {
            const pool = await getPool(selectedDatabase);
            return createClient(() => pool.request()).queryStatement(statement, values);
        },

        async withTransaction(callback) {
            const pool = await getPool(selectedDatabase);
            const transaction = new sql.Transaction(pool);

            await transaction.begin();

            try {
                const txClient = createClient(() => new sql.Request(transaction));
                const result = await callback(txClient);
                await transaction.commit();
                return result;
            } catch (error) {
                try {
                    await transaction.rollback();
                } catch (rollbackError) {
                    // Preserve the original SQL error for callers and retry handling.
                    error.rollbackError = rollbackError;
                }
                throw error;
            }
        }
    };
};

rootClient.runWithDatabase = (databaseName, callback) => {
    const selectedDatabase = normalizeDatabaseName(databaseName);

    if (!selectedDatabase) {
        return callback();
    }

    return databaseContextStorage.run({ databaseName: selectedDatabase }, callback);
};

rootClient.getCurrentDatabaseName = () => getContextDatabaseName() || dbConfig.database;

rootClient.getDatabaseNames = async () => {
    const result = await rootClient.query`
        SELECT [name]
        FROM sys.databases
        WHERE [state] = 0
        ORDER BY [name]
    `;
    return result.map((row) => row.name);
};

module.exports = rootClient;
