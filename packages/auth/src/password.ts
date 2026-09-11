import { hashPassword as scryptHash, verifyPassword as scryptVerify } from 'better-auth/crypto';

export async function hash(password: string): Promise<string> {
  return scryptHash(password);
}

export async function verify({ hash: stored, password }: { hash: string; password: string }): Promise<boolean> {
  return scryptVerify({ hash: stored, password });
}
