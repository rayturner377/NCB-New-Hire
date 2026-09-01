'use strict';

const crypto = require('node:crypto');
const postgresMigration = require('./migrations/postgres/001-initial-schema');
const mysqlMigration = require('./migrations/mysql/001-initial-schema');

const SUPPORTED_DIALECTS = new Set(['postgres', 'mysql']);

function databaseConfig(env = {}) {
  const enabled = parseBool(env.DATABASE_ENABLED);
  const provider = String(env.DATABASE_PROVIDER || 'postgres').trim().toLowerCase();
  const dialect = provider === 'cloudsql'
    ? String(env.CLOUDSQL_DIALECT || 'postgres').trim().toLowerCase()
    : provider === 'mariadb' ? 'mysql' : provider;
  if (enabled && !SUPPORTED_DIALECTS.has(dialect)) {
    throw new Error('DATABASE_PROVIDER must be postgres, mysql, mariadb, or cloudsql with CLOUDSQL_DIALECT set to postgres or mysql.');
  }

  return {
    enabled,
    provider,
    dialect,
    host: env.DATABASE_HOST || '127.0.0.1',
    port: positiveInt(env.DATABASE_PORT, dialect === 'mysql' ? 3306 : 5432),
    database: validateIdentifier(env.DATABASE_NAME || 'ncb_medical', 'DATABASE_NAME'),
    user: env.DATABASE_USER || '',
    password: env.DATABASE_PASSWORD || '',
    socketPath: env.DATABASE_SOCKET_PATH || env.CLOUDSQL_SOCKET_PATH || '',
    sslMode: String(env.DATABASE_SSL_MODE || 'require').trim().toLowerCase(),
    sslCa: normalizePem(env.DATABASE_SSL_CA || ''),
    sslCert: normalizePem(env.DATABASE_SSL_CERT || ''),
    sslKey: normalizePem(env.DATABASE_SSL_KEY || ''),
    poolMin: nonNegativeInt(env.DATABASE_POOL_MIN, 0),
    poolMax: positiveInt(env.DATABASE_POOL_MAX, 10),
    idleTimeoutMs: positiveInt(env.DATABASE_IDLE_TIMEOUT_MS, 30000),
    connectTimeoutMs: positiveInt(env.DATABASE_CONNECT_TIMEOUT_MS, 10000),
    statementTimeoutMs: positiveInt(env.DATABASE_STATEMENT_TIMEOUT_MS, 30000),
    autoMigrate: env.DATABASE_AUTO_MIGRATE === undefined ? true : parseBool(env.DATABASE_AUTO_MIGRATE),
    autoCreate: parseBool(env.DATABASE_AUTO_CREATE),
    applicationName: env.APP_NAME || 'ncb-medical-platform'
  };
}

function databaseConfigFromSettings(settings = {}, appName = 'ncb-medical-platform') {
  const source = settings && typeof settings === 'object' ? settings : {};
  return databaseConfig({
    DATABASE_ENABLED: source.enabled,
    DATABASE_PROVIDER: source.provider,
    CLOUDSQL_DIALECT: source.cloudSqlDialect,
    DATABASE_HOST: source.host,
    DATABASE_PORT: source.port,
    DATABASE_NAME: source.database,
    DATABASE_USER: source.user,
    DATABASE_PASSWORD: source.password,
    DATABASE_SOCKET_PATH: source.socketPath,
    DATABASE_SSL_MODE: source.sslMode,
    DATABASE_SSL_CA: source.sslCa,
    DATABASE_SSL_CERT: source.sslCert,
    DATABASE_SSL_KEY: source.sslKey,
    DATABASE_POOL_MIN: source.poolMin,
    DATABASE_POOL_MAX: source.poolMax,
    DATABASE_IDLE_TIMEOUT_MS: source.idleTimeoutMs,
    DATABASE_CONNECT_TIMEOUT_MS: source.connectTimeoutMs,
    DATABASE_STATEMENT_TIMEOUT_MS: source.statementTimeoutMs,
    DATABASE_AUTO_MIGRATE: source.autoMigrate,
    DATABASE_AUTO_CREATE: source.autoCreate,
    APP_NAME: appName
  });
}

async function initializeDatabase(config) {
  if (!config.enabled) {
    return { enabled: false, dialect: '', close: async () => {} };
  }
  if (!config.user) throw new Error('DATABASE_USER is required when database support is enabled.');
  if (!config.password && !config.socketPath) {
    throw new Error('DATABASE_PASSWORD is required unless socket-based authentication is configured.');
  }

  if (config.autoCreate) await createDatabaseIfNeeded(config);
  const db = config.dialect === 'postgres'
    ? await connectPostgres(config)
    : await connectMysql(config);

  await db.query('SELECT 1');
  if (config.autoMigrate) await runMigrations(db, config.dialect);
  return { ...db, enabled: true, dialect: config.dialect };
}

async function createDatabaseIfNeeded(config) {
  if (config.dialect === 'postgres') {
    const { Pool } = requireDriver('pg', 'PostgreSQL');
    const pool = new Pool(postgresOptions(config, 'postgres'));
    try {
      const result = await pool.query('SELECT 1 FROM pg_database WHERE datname = $1', [config.database]);
      if (!result.rowCount) await pool.query(`CREATE DATABASE "${config.database}"`);
    } finally {
      await pool.end();
    }
    return;
  }

  const mysql = requireDriver('mysql2/promise', 'MySQL');
  const pool = mysql.createPool(mysqlOptions(config, false));
  try {
    await pool.query(`CREATE DATABASE IF NOT EXISTS \`${config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  } finally {
    await pool.end();
  }
}

async function connectPostgres(config) {
  const { Pool } = requireDriver('pg', 'PostgreSQL');
  const pool = new Pool(postgresOptions(config, config.database));
  pool.on('error', (error) => {
    console.error('Unexpected PostgreSQL pool error:', error.message);
  });
  return {
    query(text, params = []) {
      return pool.query(text, params);
    },
    async transaction(work) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await work({ query: (text, params = []) => client.query(text, params) });
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    async withConnection(work) {
      const client = await pool.connect();
      try {
        return await work({
          query: (text, params = []) => client.query(text, params),
          async transaction(transactionWork) {
            try {
              await client.query('BEGIN');
              const result = await transactionWork({ query: (text, params = []) => client.query(text, params) });
              await client.query('COMMIT');
              return result;
            } catch (error) {
              await client.query('ROLLBACK');
              throw error;
            }
          }
        });
      } finally {
        client.release();
      }
    },
    close() {
      return pool.end();
    }
  };
}

async function connectMysql(config) {
  const mysql = requireDriver('mysql2/promise', 'MySQL');
  const pool = mysql.createPool(mysqlOptions(config, true));
  return {
    async query(text, params = []) {
      const [rows] = await pool.query(text, params);
      return { rows, rowCount: Array.isArray(rows) ? rows.length : rows.affectedRows || 0 };
    },
    async transaction(work) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const result = await work({
          async query(text, params = []) {
            const [rows] = await connection.query(text, params);
            return { rows, rowCount: Array.isArray(rows) ? rows.length : rows.affectedRows || 0 };
          }
        });
        await connection.commit();
        return result;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },
    async withConnection(work) {
      const connection = await pool.getConnection();
      const session = {
        async query(text, params = []) {
          const [rows] = await connection.query(text, params);
          return { rows, rowCount: Array.isArray(rows) ? rows.length : rows.affectedRows || 0 };
        },
        async transaction(transactionWork) {
          try {
            await connection.beginTransaction();
            const result = await transactionWork(session);
            await connection.commit();
            return result;
          } catch (error) {
            await connection.rollback();
            throw error;
          }
        }
      };
      try {
        return await work(session);
      } finally {
        connection.release();
      }
    },
    close() {
      return pool.end();
    }
  };
}

async function runMigrations(db, dialect) {
  const migrations = dialect === 'postgres' ? [postgresMigration] : [mysqlMigration];
  await db.withConnection(async (session) => {
    await acquireMigrationLock(session, dialect);
    try {
      await ensureMigrationTable(session, dialect);
      for (const migration of migrations) {
        const checksum = checksumMigration(migration);
        const existing = await migrationRecord(session, dialect, migration.id);
        if (existing) {
          if (existing.checksum !== checksum) {
            throw new Error(`Migration ${migration.id} checksum mismatch. Refusing to modify an applied migration.`);
          }
          continue;
        }
        await session.transaction(async (tx) => {
          for (const statement of migration.statements) await tx.query(statement);
          if (dialect === 'postgres') {
            await tx.query('INSERT INTO schema_migrations (migration_id, checksum) VALUES ($1, $2)', [migration.id, checksum]);
          } else {
            await tx.query('INSERT INTO schema_migrations (migration_id, checksum) VALUES (?, ?)', [migration.id, checksum]);
          }
        });
        console.log(`Applied database migration ${migration.id}`);
      }
    } finally {
      await releaseMigrationLock(session, dialect);
    }
  });
}

async function ensureMigrationTable(db, dialect) {
  if (dialect === 'postgres') {
    await db.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        migration_id VARCHAR(120) PRIMARY KEY,
        checksum CHAR(64) NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    return;
  }
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      migration_id VARCHAR(120) PRIMARY KEY,
      checksum CHAR(64) NOT NULL,
      applied_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
    ) ENGINE=InnoDB
  `);
}

async function migrationRecord(db, dialect, id) {
  const result = dialect === 'postgres'
    ? await db.query('SELECT checksum FROM schema_migrations WHERE migration_id = $1', [id])
    : await db.query('SELECT checksum FROM schema_migrations WHERE migration_id = ?', [id]);
  return result.rows?.[0] || null;
}

async function acquireMigrationLock(db, dialect) {
  if (dialect === 'postgres') {
    await db.query("SELECT pg_advisory_lock(hashtext('ncb_medical_schema_migrations'))");
    return;
  }
  const result = await db.query("SELECT GET_LOCK('ncb_medical_schema_migrations', 30) AS acquired");
  if (!result.rows?.[0]?.acquired) throw new Error('Could not acquire database migration lock.');
}

async function releaseMigrationLock(db, dialect) {
  if (dialect === 'postgres') {
    await db.query("SELECT pg_advisory_unlock(hashtext('ncb_medical_schema_migrations'))");
    return;
  }
  await db.query("SELECT RELEASE_LOCK('ncb_medical_schema_migrations')");
}

function checksumMigration(migration) {
  return crypto.createHash('sha256').update(JSON.stringify(migration.statements)).digest('hex');
}

function postgresOptions(config, database) {
  return {
    host: config.socketPath || config.host,
    port: config.port,
    database,
    user: config.user,
    password: config.password,
    min: config.poolMin,
    max: config.poolMax,
    idleTimeoutMillis: config.idleTimeoutMs,
    connectionTimeoutMillis: config.connectTimeoutMs,
    statement_timeout: config.statementTimeoutMs,
    application_name: config.applicationName,
    ssl: postgresSsl(config)
  };
}

function mysqlOptions(config, includeDatabase) {
  return {
    host: config.socketPath ? undefined : config.host,
    socketPath: config.socketPath || undefined,
    port: config.port,
    database: includeDatabase ? config.database : undefined,
    user: config.user,
    password: config.password,
    connectionLimit: config.poolMax,
    maxIdle: config.poolMax,
    idleTimeout: config.idleTimeoutMs,
    connectTimeout: config.connectTimeoutMs,
    enableKeepAlive: true,
    charset: 'utf8mb4',
    timezone: 'Z',
    ssl: mysqlSsl(config)
  };
}

function postgresSsl(config) {
  if (config.socketPath || config.sslMode === 'disable') return false;
  const ssl = {
    rejectUnauthorized: config.sslMode !== 'no-verify'
  };
  if (config.sslCa) ssl.ca = config.sslCa;
  if (config.sslCert) ssl.cert = config.sslCert;
  if (config.sslKey) ssl.key = config.sslKey;
  return ssl;
}

function mysqlSsl(config) {
  if (config.socketPath || config.sslMode === 'disable') return undefined;
  const ssl = {
    rejectUnauthorized: config.sslMode !== 'no-verify'
  };
  if (config.sslCa) ssl.ca = config.sslCa;
  if (config.sslCert) ssl.cert = config.sslCert;
  if (config.sslKey) ssl.key = config.sslKey;
  return ssl;
}

function requireDriver(name, label) {
  try {
    return require(name);
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') {
      throw new Error(`${label} connector is not installed. Run npm install before enabling database support.`);
    }
    throw error;
  }
}

function validateIdentifier(value, name) {
  if (!/^[A-Za-z][A-Za-z0-9_]{0,62}$/.test(value)) {
    throw new Error(`${name} must begin with a letter and contain only letters, numbers, or underscores.`);
  }
  return value;
}

function parseBool(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}

function positiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function nonNegativeInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function normalizePem(value) {
  return String(value || '').replace(/\\n/g, '\n').trim();
}

module.exports = {
  databaseConfig,
  databaseConfigFromSettings,
  initializeDatabase
};
