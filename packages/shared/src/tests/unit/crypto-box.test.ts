import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { decryptJson, encryptJson, type EncryptedRecord } from '../../crypto-box.js';

describe('crypto-box', () => {
  const key = randomBytes(32);

  it('round-trips a JSON value', () => {
    const value = { candidateId: 'abc-123', notes: 'confidential', count: 3 };
    const record = encryptJson(key, value);
    expect(decryptJson(key, record)).toEqual(value);
  });

  it('rejects a tampered ciphertext byte', () => {
    const record = encryptJson(key, { a: 1 });
    const bytes = Buffer.from(record.ciphertext, 'base64');
    bytes[0] = bytes[0] ^ 0xff;
    const tampered: EncryptedRecord = { ...record, ciphertext: bytes.toString('base64') };
    expect(() => decryptJson(key, tampered)).toThrow();
  });

  it('rejects a tampered auth tag', () => {
    const record = encryptJson(key, { a: 1 });
    const bytes = Buffer.from(record.tag, 'base64');
    bytes[0] = bytes[0] ^ 0xff;
    const tampered: EncryptedRecord = { ...record, tag: bytes.toString('base64') };
    expect(() => decryptJson(key, tampered)).toThrow();
  });

  it('rejects the wrong key', () => {
    const record = encryptJson(key, { a: 1 });
    const wrongKey = randomBytes(32);
    expect(() => decryptJson(wrongKey, record)).toThrow();
  });

  it('rejects an unsupported algorithm tag', () => {
    const record = encryptJson(key, { a: 1 });
    const tampered = { ...record, alg: 'AES-128-GCM' } as unknown as EncryptedRecord;
    expect(() => decryptJson(key, tampered)).toThrow('Unsupported encrypted record.');
  });

  it('rejects a missing record', () => {
    expect(() => decryptJson(key, undefined as unknown as EncryptedRecord)).toThrow(
      'Unsupported encrypted record.'
    );
  });
});
