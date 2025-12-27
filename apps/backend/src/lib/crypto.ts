/**
 * Crypto Utilities for API Key Encryption
 *
 * Uses Web Crypto API (available in Cloudflare Workers)
 * AES-256-GCM encryption with random IV
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits for GCM
const TAG_LENGTH = 128; // 128 bits authentication tag

/**
 * Derives an encryption key from a secret
 * Uses PBKDF2 with a static salt (the user ID)
 */
async function deriveKey(secret: string, salt: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(salt),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts an API key using AES-256-GCM
 *
 * @param apiKey - The plaintext API key to encrypt
 * @param secret - The encryption secret (from environment)
 * @param userId - User ID used as salt for key derivation
 * @returns Base64-encoded encrypted string (iv + ciphertext + tag)
 */
export async function encryptApiKey(
  apiKey: string,
  secret: string,
  userId: string
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await deriveKey(secret, userId);

  // Generate random IV
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  // Encrypt
  const encrypted = await crypto.subtle.encrypt(
    {
      name: ALGORITHM,
      iv,
      tagLength: TAG_LENGTH,
    },
    key,
    encoder.encode(apiKey)
  );

  // Combine IV + encrypted data
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  // Return as base64
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypts an API key
 *
 * @param encryptedKey - Base64-encoded encrypted string
 * @param secret - The encryption secret (from environment)
 * @param userId - User ID used as salt for key derivation
 * @returns Decrypted plaintext API key
 */
export async function decryptApiKey(
  encryptedKey: string,
  secret: string,
  userId: string
): Promise<string> {
  const decoder = new TextDecoder();
  const key = await deriveKey(secret, userId);

  // Decode base64
  const combined = new Uint8Array(
    atob(encryptedKey)
      .split('')
      .map((c) => c.charCodeAt(0))
  );

  // Extract IV and ciphertext
  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);

  // Decrypt
  const decrypted = await crypto.subtle.decrypt(
    {
      name: ALGORITHM,
      iv,
      tagLength: TAG_LENGTH,
    },
    key,
    ciphertext
  );

  return decoder.decode(decrypted);
}

/**
 * Validates an API key format (basic checks)
 */
export function validateApiKeyFormat(
  apiKey: string,
  provider: 'google' | 'anthropic'
): boolean {
  if (!apiKey || typeof apiKey !== 'string') {
    return false;
  }

  const trimmed = apiKey.trim();

  switch (provider) {
    case 'google':
      // Google AI API keys typically start with 'AIza'
      return trimmed.length >= 30 && trimmed.startsWith('AIza');

    case 'anthropic':
      // Anthropic API keys start with 'sk-ant-'
      return trimmed.startsWith('sk-ant-') && trimmed.length >= 40;

    default:
      return false;
  }
}
