const db = require("../db");

const main = async () => {
    await db.connect();
    const rows = await db.queryUnsafe("SELECT 1 AS ok");
    console.log(rows);
    await db.close();
};

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
