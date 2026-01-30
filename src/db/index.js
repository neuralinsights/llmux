/**
 * LLMux - Database Layer
 * Factory to initialize the appropriate database adapter
 */

const SqliteAdapter = require('./sqlite');
// PostgresAdapter will be lazy loaded or added later
// const PostgresAdapter = require('./postgres');

let dbInstance = null;

const SUPPORTED_BACKENDS = {
    SQLITE: 'sqlite',
    POSTGRES: 'postgres',
};

/**
 * Initialize the database
 * @param {Object} config - DB configuration
 * @returns {Promise<Object>} Database adapter instance
 */
async function initializeDatabase(config = {}) {
    if (dbInstance) return dbInstance;

    const backend = (process.env.DB_BACKEND || SUPPORTED_BACKENDS.SQLITE).toLowerCase();

    console.log(`[DB] Initializing database backend: ${backend}`);

    switch (backend) {
        case SUPPORTED_BACKENDS.POSTGRES:
            // const PostgresAdapter = require('./postgres');
            // dbInstance = new PostgresAdapter(config);
            throw new Error('PostgreSQL backend not fully implemented in this phase. Use sqlite.');
            break;

        case SUPPORTED_BACKENDS.SQLITE:
        default:
            dbInstance = new SqliteAdapter({
                path: process.env.DB_PATH,
                ...config
            });
            break;
    }

    await dbInstance.connect();
    return dbInstance;
}

/**
 * Get current DB instance
 */
function getDatabase() {
    if (!dbInstance) {
        throw new Error('Database not initialized. Call initializeDatabase() first.');
    }
    return dbInstance;
}

module.exports = {
    initializeDatabase,
    getDatabase,
    SUPPORTED_BACKENDS
};
