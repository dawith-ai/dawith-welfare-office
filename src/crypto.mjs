import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

function readKey(dataDir) {
  const configured = process.env.WELFARE_DB_KEY || '';
  if (configured) {
    const key = /^[a-f0-9]{64}$/i.test(configured) ? Buffer.from(configured, 'hex') : Buffer.from(configured, 'base64');
    if (key.length !== 32) throw new Error('WELFARE_DB_KEY_must_be_32_bytes');
    return key;
  }
  const keyPath = path.join(dataDir, '.local-key');
  if (!fs.existsSync(keyPath)) fs.writeFileSync(keyPath, crypto.randomBytes(32), { mode: 0o600 });
  fs.chmodSync(keyPath, 0o600);
  const key = fs.readFileSync(keyPath);
  if (key.length !== 32) throw new Error('local_key_invalid');
  return key;
}

export function createFieldCipher(dataDir) {
  const key = readKey(dataDir);
  return {
    seal(value) {
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
      return `v1.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`;
    },
    open(value) {
      if (!String(value).startsWith('v1.')) return String(value);
      const [, ivText, tagText, encryptedText] = String(value).split('.');
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivText, 'base64url'));
      decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
      return Buffer.concat([decipher.update(Buffer.from(encryptedText, 'base64url')), decipher.final()]).toString('utf8');
    },
  };
}
