import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export function keyVault(secret) {
  const key = createHash('sha256').update('keyzone-license-vault-v1\0' + secret).digest();
  return {
    seal(value) {
      const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
      const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
      return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64');
    },
    open(value) {
      const buffer = Buffer.from(value, 'base64'), decipher = createDecipheriv('aes-256-gcm', key, buffer.subarray(0, 12));
      decipher.setAuthTag(buffer.subarray(12, 28));
      return Buffer.concat([decipher.update(buffer.subarray(28)), decipher.final()]).toString('utf8');
    },
  };
}
