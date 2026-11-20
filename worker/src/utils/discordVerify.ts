function hexToUint8Array(hex: string): Uint8Array<ArrayBuffer> {
  const matches = hex.match(/.{1,2}/g);
  if (!matches) {
    return new Uint8Array(new ArrayBuffer(0));
  }

  const buffer = new ArrayBuffer(matches.length);
  const view = new Uint8Array(buffer);
  matches.forEach((byte, index) => {
    view[index] = parseInt(byte, 16);
  });

  return view;
}

/**
 * Web Crypto API (Ed25519) を用いて Discord からのリクエスト署名を検証する
 */
export async function verifyDiscordSignature(params: {
  publicKey: string;
  signature: string;
  timestamp: string;
  body: string;
}): Promise<boolean> {
  try {
    const pubKeyBytes = hexToUint8Array(params.publicKey);
    const signatureBytes = hexToUint8Array(params.signature);
    const messageBytes = new TextEncoder().encode(params.timestamp + params.body);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      pubKeyBytes,
      { name: 'Ed25519' },
      false,
      ['verify'],
    );

    return await crypto.subtle.verify({ name: 'Ed25519' }, cryptoKey, signatureBytes, messageBytes);
  } catch {
    return false;
  }
}
