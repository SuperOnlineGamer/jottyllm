import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";

const PASSWORD_HASH_ALGORITHM = "scrypt";
const PASSWORD_KEY_LENGTH = 64;
const PASSWORD_SCRYPT_N = 16384;
const PASSWORD_SCRYPT_R = 8;
const PASSWORD_SCRYPT_P = 1;
const PASSWORD_SCRYPT_MAXMEM = 64 * 1024 * 1024;
const LEGACY_SHA256_REGEX = /^[a-f0-9]{64}$/i;

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
const legacyHashPassword = (password: string): string => {
  return createHash("sha256").update(password).digest("hex");
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
const safeCompareHex = (actualHex: string, expectedHex: string): boolean => {
  const actual = Buffer.from(actualHex, "hex");
  const expected = Buffer.from(expectedHex, "hex");

  return actual.length === expected.length && timingSafeEqual(actual, expected);
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
export const hashPassword = (password: string): string => {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, PASSWORD_KEY_LENGTH, {
    N: PASSWORD_SCRYPT_N,
    r: PASSWORD_SCRYPT_R,
    p: PASSWORD_SCRYPT_P,
    maxmem: PASSWORD_SCRYPT_MAXMEM,
  }).toString("hex");

  return [
    PASSWORD_HASH_ALGORITHM,
    PASSWORD_SCRYPT_N,
    PASSWORD_SCRYPT_R,
    PASSWORD_SCRYPT_P,
    salt,
    derivedKey,
  ].join("$");
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
export const needsPasswordRehash = (passwordHash: string): boolean => {
  return LEGACY_SHA256_REGEX.test(passwordHash);
};

/**
 * @todo fccview is telling you to review this AI generated code
 * and make sure it's up to standards, reusable, modular and consistent with
 * the rest of the codebase.
 */
export const verifyPassword = (
  password: string,
  storedPasswordHash: string,
): boolean => {
  if (!storedPasswordHash) return false;

  if (needsPasswordRehash(storedPasswordHash)) {
    return safeCompareHex(legacyHashPassword(password), storedPasswordHash);
  }

  const [algorithm, nValue, rValue, pValue, salt, expectedKey] =
    storedPasswordHash.split("$");
  if (algorithm !== PASSWORD_HASH_ALGORITHM || !salt || !expectedKey) {
    return false;
  }

  const cost = Number(nValue);
  const blockSize = Number(rValue);
  const parallelization = Number(pValue);
  if (!cost || !blockSize || !parallelization) {
    return false;
  }

  const derivedKey = scryptSync(password, salt, PASSWORD_KEY_LENGTH, {
    N: cost,
    r: blockSize,
    p: parallelization,
    maxmem: PASSWORD_SCRYPT_MAXMEM,
  }).toString("hex");

  return safeCompareHex(derivedKey, expectedKey);
};