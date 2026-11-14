import { constants, createHash, createPrivateKey, createPublicKey, generateKeyPairSync, randomBytes, sign, verify } from "node:crypto";
import { chmod, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";

import { audit,SYSTEM } from "../audit";
import { eq } from "drizzle-orm";

import { db } from "../db";
import { certSigningKeys, type CertManifest } from "../db/schema";

/**
 * Certificate signing (CERT-12, CERT-14). RSA-PSS with SHA-256 over the
 * canonical manifest. The private key is a PEM file in CERT_KEY_DIR (a
 * volume the owner controls and backs up separately); only its public half
 * goes to the database, so a database dump cannot forge a certificate.
 */
const KEY_DIR = resolve(process.env.CERT_KEY_DIR ?? join(process.cwd(), "cert-keys"));
const PSS = { padding: constants.RSA_PKCS1_PSS_PADDING, saltLength: constants.RSA_PSS_SALTLEN_DIGEST } as const;

const keyPath = (keyId: string) => join(KEY_DIR, `${keyId}.pem`);

/** Stable JSON: object keys sorted at every level, no whitespace. This exact string is what gets signed. */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    return `{${Object.keys(o)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export const manifestHash = (manifest: CertManifest) => createHash("sha256").update(canonical(manifest)).digest("hex");

async function createKey(): Promise<string> {
  const keyId = `k${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomBytes(3).toString("hex")}`;
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 3072,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  await mkdir(KEY_DIR, { recursive: true, mode: 0o700 });
  await Bun.write(keyPath(keyId), privateKey);
  await chmod(keyPath(keyId), 0o600);
  await db.transaction(async (tx) => {
    await tx.update(certSigningKeys).set({ active: false, retiredAt: new Date() }).where(eq(certSigningKeys.active, true));
    await tx.insert(certSigningKeys).values({ keyId, publicKeyPem: publicKey });
  });
  return keyId;
}

/** The key that signs new certificates; made on first use. A key whose file is gone cannot sign, so a new one replaces it. */
export async function activeKeyId(): Promise<string> {
  const [row] = await db.select({ keyId: certSigningKeys.keyId }).from(certSigningKeys).where(eq(certSigningKeys.active, true)).limit(1);
  if (row && (await Bun.file(keyPath(row.keyId)).exists())) return row.keyId;
  return createKey();
}

/** New signing key; the old public key stays so certificates it signed keep verifying. */
export const rotateKey = createKey;

export async function signManifest(manifest: CertManifest): Promise<string> {
  const pem = await Bun.file(keyPath(manifest.key_id)).text();
  await audit(SYSTEM,{action:"signing_key.read",module:"certificate",targetId:manifest.key_id});
  return sign("sha256", Buffer.from(canonical(manifest)), { key: createPrivateKey(pem), ...PSS }).toString("base64");
}

/** True only when the stored manifest is byte-for-byte what was signed by the key it names. */
export async function verifyManifest(manifest: CertManifest, signature: string): Promise<boolean> {
  const [key] = await db
    .select({ pem: certSigningKeys.publicKeyPem })
    .from(certSigningKeys)
    .where(eq(certSigningKeys.keyId, manifest.key_id))
    .limit(1);
  if (!key) return false;
  try {
    return verify("sha256", Buffer.from(canonical(manifest)), { key: createPublicKey(key.pem), ...PSS }, Buffer.from(signature, "base64"));
  } catch {
    return false;
  }
}
