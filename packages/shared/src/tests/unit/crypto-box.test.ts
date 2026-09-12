import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { decryptBuffer, decryptJson, encryptBuffer, encryptJson, type EncryptedRecord } from '../../crypto-box.js';

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

describe('encryptBuffer/decryptBuffer', () => {
  const key = randomBytes(32);

  it('round-trips arbitrary binary data byte-for-byte', () => {
    const plaintext = randomBytes(4096);
    const encrypted = encryptBuffer(key, plaintext);
    expect(decryptBuffer(key, encrypted).equals(plaintext)).toBe(true);
  });

  it('never leaves the plaintext bytes recognizable in the output', () => {
    const plaintext = Buffer.from('a very identifiable plaintext string');
    const encrypted = encryptBuffer(key, plaintext);
    expect(encrypted.includes(plaintext)).toBe(false);
  });

  it('produces different ciphertext for the same input on repeated calls (random IV)', () => {
    const plaintext = Buffer.from('same input');
    expect(encryptBuffer(key, plaintext).equals(encryptBuffer(key, plaintext))).toBe(false);
  });

  it('rejects a tampered ciphertext byte', () => {
    const encrypted = encryptBuffer(key, Buffer.from('hello'));
    encrypted[encrypted.length - 1] = encrypted[encrypted.length - 1]! ^ 0xff;
    expect(() => decryptBuffer(key, encrypted)).toThrow();
  });

  it('rejects the wrong key', () => {
    const encrypted = encryptBuffer(key, Buffer.from('hello'));
    expect(() => decryptBuffer(randomBytes(32), encrypted)).toThrow();
  });

  it('rejects a buffer too short to contain an IV and auth tag', () => {
    expect(() => decryptBuffer(key, Buffer.from('short'))).toThrow('Encrypted buffer is too short.');
  });
});
