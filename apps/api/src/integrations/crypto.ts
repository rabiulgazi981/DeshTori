import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
export function encrypt(value: Record<string, string>, secret: string): string {
  if (secret.length < 32) throw new Error('INTEGRATIONS_ENCRYPTION_KEY_REQUIRED');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', createHash('sha256').update(secret).digest(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map(x => x.toString('base64')).join('.');
}
export function decrypt(value: string, secret: string): Record<string, string> {
  const [iv, tag, ciphertext] = value.split('.').map(x => Buffer.from(x, 'base64'));
  const decipher = createDecipheriv('aes-256-gcm', createHash('sha256').update(secret).digest(), iv);
  decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8'));
}
