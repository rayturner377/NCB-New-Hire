'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT_DIR = path.join(__dirname, '..');
const USERS_PATH = path.join(ROOT_DIR, 'data', 'users.json');
const ALLOWED_ROLES = new Set(['clinician', 'reviewer', 'admin', 'patient']);

async function main() {
  const [emailArg, passwordArg, roleArg = 'reviewer', ...displayParts] = process.argv.slice(2);
  const email = String(emailArg || '').trim().toLowerCase();
  const password = String(passwordArg || '');
  const role = String(roleArg || '').trim().toLowerCase();
  const displayName = displayParts.join(' ').trim() || email;

  if (!email || !email.includes('@')) {
    throw new Error('Usage: node scripts/upsert-user.js <email> <password> <clinician|reviewer|admin|patient> [display name]');
  }
  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters.');
  }
  if (!ALLOWED_ROLES.has(role)) {
    throw new Error(`Role must be one of: ${Array.from(ALLOWED_ROLES).join(', ')}`);
  }

  const parsed = JSON.parse(await fs.readFile(USERS_PATH, 'utf8'));
  const users = Array.isArray(parsed.users) ? parsed.users : [];
  const existing = users.find((user) => user.email === email);
  const user = existing || {
    id: `usr_${randomToken(10)}`,
    email,
    createdAt: new Date().toISOString()
  };

  user.displayName = displayName;
  user.role = role;
  user.active = true;
  user.password = makePasswordRecord(password);

  if (!existing) users.push(user);

  const output = `${JSON.stringify({ users }, null, 2)}\n`;
  await fs.writeFile(USERS_PATH, output, { mode: 0o600 });
  await fs.chmod(USERS_PATH, 0o600).catch(() => {});

  console.log(`${existing ? 'Updated' : 'Created'} ${email} as ${role}.`);
}

function makePasswordRecord(password) {
  const salt = crypto.randomBytes(16);
  const iterations = 310000;
  const hash = crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256');
  return {
    alg: 'PBKDF2-SHA256',
    iterations,
    salt: salt.toString('base64'),
    hash: hash.toString('base64')
  };
}

function randomToken(bytes) {
  return crypto.randomBytes(bytes).toString('base64url');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
