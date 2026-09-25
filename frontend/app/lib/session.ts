// Sessão assinada (HMAC-SHA256) usando apenas Web Crypto, para funcionar tanto
// no middleware (edge runtime) quanto nas rotas de API (node runtime), sem
// depender de módulos específicos de um único runtime.

export type SessionPayload = {
  sub: string;
  nome: string;
  papel: string;
  condominio_id: string | null;
  funcionario_id: string | null;
  exp: number; // unix seconds
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function hmacKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    {name: "HMAC", hash: "SHA-256"},
    false,
    ["sign", "verify"]
  );
}

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

export async function signSession(payload: SessionPayload, secret: string): Promise<string> {
  const payloadB64 = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const key = await hmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payloadB64));
  return `${payloadB64}.${toHex(signature)}`;
}

export async function verifySession(cookieValue: string | undefined, secret: string): Promise<SessionPayload | null> {
  if (!cookieValue) return null;
  const [payloadB64, signatureHex] = cookieValue.split(".");
  if (!payloadB64 || !signatureHex) return null;
  try {
    const key = await hmacKey(secret);
    const expected = await crypto.subtle.sign("HMAC", key, encoder.encode(payloadB64));
    if (toHex(expected) !== signatureHex) return null;
    const payload = JSON.parse(decoder.decode(fromBase64Url(payloadB64))) as SessionPayload;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// Token curto (5min), so pra provar pro backend que quem esta chamando
// /api/documentos/processar direto (sem passar pelo proxy same-origin, que
// tem limite de 4.5MB de corpo na Vercel - pequeno demais pra PDF escaneado)
// tem sessao valida. Formato simples (nao JSON) porque o payload e so 2 campos.
export async function signUploadToken(userId: string, secret: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + 5 * 60;
  const base = `${userId}.${exp}`;
  const key = await hmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(base));
  return `${base}.${toHex(signature)}`;
}
