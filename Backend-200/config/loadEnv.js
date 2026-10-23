const path = require("path");
const dotenv = require("dotenv");

const envPath = path.join(__dirname, "..", ".env");

const loadEnv = () => dotenv.config({ path: envPath });

module.exports = loadEnv;
