import { randomBytes } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const existsSync = vi.fn();
const readFileSync = vi.fn();
const writeFileSync = vi.fn();
const mkdirSync = vi.fn();

vi.mock('node:fs', () => ({ existsSync, readFileSync, writeFileSync, mkdirSync }));

const originalEnv = { ...process.env };

async function importFreshMasterKeyModule() {
  vi.resetModules();
  return import('../../master-key');
}

describe('loadMasterKey', () => {
  beforeEach(() => {
    existsSync.mockReset();
    readFileSync.mockReset();
    writeFileSync.mockReset();
    mkdirSync.mockReset();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('uses APP_MASTER_KEY when set and correctly sized', async () => {
    const key = randomBytes(32);
    process.env.APP_MASTER_KEY = key.toString('base64');

    const { loadMasterKey } = await importFreshMasterKeyModule();
    expect(loadMasterKey()).toEqual(key);
    expect(existsSync).not.toHaveBeenCalled();
  });

  it('rejects an APP_MASTER_KEY that is not 32 bytes', async () => {
    process.env.APP_MASTER_KEY = randomBytes(16).toString('base64');

    const { loadMasterKey } = await importFreshMasterKeyModule();
    expect(() => loadMasterKey()).toThrow('APP_MASTER_KEY must be a 32-byte base64 value.');
  });

  it('falls back to data/master.key on disk when no env var is set', async () => {
    delete process.env.APP_MASTER_KEY;
    const key = randomBytes(32);
    existsSync.mockReturnValue(true);
    readFileSync.mockReturnValue(`${key.toString('base64')}\n`);

    const { loadMasterKey } = await importFreshMasterKeyModule();
    expect(loadMasterKey()).toEqual(key);
    expect(writeFileSync).not.toHaveBeenCalled();
  });

  it('rejects an invalid key on disk', async () => {
    delete process.env.APP_MASTER_KEY;
    existsSync.mockReturnValue(true);
    readFileSync.mockReturnValue(randomBytes(10).toString('base64'));

    const { loadMasterKey } = await importFreshMasterKeyModule();
    expect(() => loadMasterKey()).toThrow('data/master.key is invalid.');
  });

  it('generates and persists a new key when nothing exists yet', async () => {
    delete process.env.APP_MASTER_KEY;
    existsSync.mockReturnValue(false);

    const { loadMasterKey } = await importFreshMasterKeyModule();
    const key = loadMasterKey();

    expect(key).toHaveLength(32);
    expect(mkdirSync).toHaveBeenCalledWith(expect.stringContaining('data'), { recursive: true });
    expect(writeFileSync).toHaveBeenCalledTimes(1);
    const [, written] = writeFileSync.mock.calls[0] as [string, string];
    expect(Buffer.from(written.trim(), 'base64')).toEqual(key);
  });

  it('caches the key across calls within the same module instance', async () => {
    const key = randomBytes(32);
    process.env.APP_MASTER_KEY = key.toString('base64');

    const { loadMasterKey } = await importFreshMasterKeyModule();
    const first = loadMasterKey();
    delete process.env.APP_MASTER_KEY;
    const second = loadMasterKey();

    expect(second).toEqual(first);
  });
});
