/**
 * Client-side encryption utilities for file encryption
 * Uses Web Crypto API for secure encryption operations
 */

export type EncryptedFileData = {
  encryptedFile: Blob;
  dekBase64: string;
  iv: Uint8Array;
  originalFileName: string;
  originalSize: number;
  mimeType: string;
};

/**
 * Generate a random Data Encryption Key (DEK) using Web Crypto API
 * @returns {Promise<CryptoKey>} The generated DEK
 */
export async function generateDEK(): Promise<CryptoKey> {
  return await globalThis.crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 256, // 256-bit key
    },
    true, // extractable
    ["encrypt", "decrypt"],
  );
}

/**
 * Export a DEK to raw bytes for encryption with KEK
 * @param {CryptoKey} dek - The DEK to export
 * @returns {Promise<ArrayBuffer>} The raw key bytes
 */
export async function exportDEK(dek: CryptoKey): Promise<ArrayBuffer> {
  return await globalThis.crypto.subtle.exportKey("raw", dek);
}

/**
 * Import a DEK from raw bytes
 * @param {ArrayBuffer} dekBytes - The raw DEK bytes
 * @returns {Promise<CryptoKey>} The imported DEK
 */
export async function importDEK(dekBytes: ArrayBuffer): Promise<CryptoKey> {
  return await globalThis.crypto.subtle.importKey(
    "raw",
    dekBytes,
    {
      name: "AES-GCM",
      length: 256,
    },
    true,
    ["encrypt", "decrypt"],
  );
}

/**
 * Generate a random initialization vector (IV)
 * @returns {Uint8Array} Random 12-byte IV suitable for AES-GCM
 */
export function generateIV(): Uint8Array {
  return globalThis.crypto.getRandomValues(new Uint8Array(12));
}

/**
 * Encrypt a file using AES-GCM with the provided DEK
 * @param {File} file - The file to encrypt
 * @param {CryptoKey} dek - The DEK to use for encryption
 * @param {Uint8Array} iv - The initialization vector
 * @returns {Promise<ArrayBuffer>} The encrypted file data
 */
export async function encryptFile(
  file: File,
  dek: CryptoKey,
  iv: Uint8Array,
): Promise<ArrayBuffer> {
  const fileBuffer = await file.arrayBuffer();

  return await globalThis.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    dek,
    fileBuffer,
  );
}

/**
 * Decrypt a file using AES-GCM with the provided DEK
 * @param {ArrayBuffer} encryptedData - The encrypted file data
 * @param {CryptoKey} dek - The DEK to use for decryption
 * @param {Uint8Array} iv - The initialization vector used during encryption
 * @returns {Promise<ArrayBuffer>} The decrypted file data
 */
export async function decryptFile(
  encryptedData: ArrayBuffer,
  dek: CryptoKey,
  iv: Uint8Array,
): Promise<ArrayBuffer> {
  return await globalThis.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    dek,
    encryptedData,
  );
}

/**
 * Complete file encryption process
 * @param {File} file - The file to encrypt
 * @returns {Promise<EncryptedFileData>} Complete encrypted file data package
 */
export async function encryptFileComplete(
  file: File,
): Promise<EncryptedFileData> {
  // Generate DEK and IV
  const dek = await generateDEK();
  const iv = generateIV();

  // Encrypt the file
  const encryptedBuffer = await encryptFile(file, dek, iv);

  // Export DEK as base64 for transmission to server
  const dekBytes = await exportDEK(dek);
  const dekBase64 = arrayBufferToBase64(dekBytes);

  // Create encrypted file blob with appropriate metadata
  const encryptedFile = new Blob([encryptedBuffer], {
    type: "application/octet-stream", // Encrypted files are binary
  });

  return {
    encryptedFile,
    dekBase64,
    iv,
    originalFileName: file.name,
    originalSize: file.size,
    mimeType: file.type,
  };
}

/**
 * Convert ArrayBuffer to base64 string
 * @param {ArrayBuffer} buffer - The buffer to convert
 * @returns {string} Base64 encoded string
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCodePoint(byte);
  }
  return globalThis.btoa(binary);
}

/**
 * Convert base64 string to ArrayBuffer
 * @param {string} base64 - The base64 string to convert
 * @returns {ArrayBuffer} The decoded buffer
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.codePointAt(index) ?? 0;
  }
  return bytes.buffer;
}

/**
 * Convert Uint8Array to base64 string
 * @param {Uint8Array} array - The array to convert
 * @returns {string} Base64 encoded string
 */
export function uint8ArrayToBase64(array: Uint8Array): string {
  return arrayBufferToBase64(array.buffer);
}

/**
 * Convert base64 string to Uint8Array
 * @param {string} base64 - The base64 string to convert
 * @returns {Uint8Array} The decoded array
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  return new Uint8Array(base64ToArrayBuffer(base64));
}

/**
 * Complete file decryption process
 * @param {ArrayBuffer} encryptedData - The encrypted file data
 * @param {string} dekBase64 - Base64 encoded DEK
 * @param {string} ivBase64 - Base64 encoded IV
 * @param {string} originalFileName - Original file name
 * @param {string} originalMimeType - Original MIME type
 * @returns {Promise<File>} Decrypted file
 */
export async function decryptFileComplete(
  encryptedData: ArrayBuffer,
  dekBase64: string,
  ivBase64: string,
  originalFileName: string,
  originalMimeType: string,
): Promise<File> {
  // Convert base64 DEK and IV back to binary
  const dekBytes = base64ToArrayBuffer(dekBase64);
  const iv = base64ToUint8Array(ivBase64);

  // Import the DEK
  const dek = await importDEK(dekBytes);

  // Decrypt the file
  const decryptedBuffer = await decryptFile(encryptedData, dek, iv);

  // Create a File object from the decrypted data
  const decryptedFile = new File([decryptedBuffer], originalFileName, {
    type: originalMimeType,
  });

  return decryptedFile;
}

/**
 * Download a file by creating a temporary URL and triggering download
 * @param {File} file - The file to download
 */
export function downloadFile(file: File): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
