// End-to-end encryption for journal entries, built on the Web Crypto API.
//
// Design:
// - A random 256-bit AES-GCM "data key" (DEK) encrypts every journal entry.
// - The DEK is wrapped (encrypted) with a key derived from the user's
//   password via PBKDF2 (the KEK). Only the wrapped DEK and the PBKDF2 salt
//   are stored on the server -- never the password, KEK, or raw DEK.
// - The server therefore only ever sees ciphertext. Decryption is only
//   possible with the user's password or a device that already holds the DEK.

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const PBKDF2_ITERATIONS = 310000;

export function toB64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

export function fromB64(str) {
  return Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
}

export function makeSalt() {
  return toB64(crypto.getRandomValues(new Uint8Array(16)));
}

export async function generateDek() {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ]);
}

export async function exportDek(dek) {
  return toB64(await crypto.subtle.exportKey('raw', dek));
}

export async function importDek(b64) {
  return crypto.subtle.importKey('raw', fromB64(b64), 'AES-GCM', true, [
    'encrypt',
    'decrypt',
  ]);
}

export async function deriveKek(password, saltB64) {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: fromB64(saltB64),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function aesEncrypt(key, bytes) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes);
  return `${toB64(iv)}.${toB64(ct)}`;
}

async function aesDecrypt(key, payload) {
  const [ivB64, ctB64] = payload.split('.');
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(ivB64) },
    key,
    fromB64(ctB64)
  );
  return new Uint8Array(pt);
}

export async function wrapDek(dek, kek) {
  const raw = await crypto.subtle.exportKey('raw', dek);
  return aesEncrypt(kek, new Uint8Array(raw));
}

export async function unwrapDek(wrappedB64, kek) {
  const raw = await aesDecrypt(kek, wrappedB64);
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', true, [
    'encrypt',
    'decrypt',
  ]);
}

export async function encryptText(dek, text) {
  return aesEncrypt(dek, textEncoder.encode(text));
}

export async function decryptText(dek, payload) {
  return textDecoder.decode(await aesDecrypt(dek, payload));
}
