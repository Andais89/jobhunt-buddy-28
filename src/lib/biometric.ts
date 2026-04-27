// Biometric (Face ID / Touch ID) helpers using WebAuthn.
// Works on iOS Safari and installed PWAs that support platform authenticators.

const CRED_KEY = "biometric.credentialId";
const ENABLED_KEY = "biometric.enabled";
const USER_KEY = "biometric.userId";
const UNLOCKED_KEY = "biometric.unlockedAt"; // session storage timestamp
const RP_NAME = "Job Tracker";

function bufToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function b64ToBuf(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

export async function biometricAvailable(): Promise<boolean> {
  if (typeof window === "undefined" || !window.PublicKeyCredential) return false;
  try {
    // @ts-ignore
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export function biometricEnabled(): boolean {
  return localStorage.getItem(ENABLED_KEY) === "1" && !!localStorage.getItem(CRED_KEY);
}

export function biometricEnabledForUser(userId: string): boolean {
  return biometricEnabled() && localStorage.getItem(USER_KEY) === userId;
}

export async function enableBiometric(userId: string, userName: string): Promise<void> {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userIdBuf = new TextEncoder().encode(userId);

  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: RP_NAME, id: window.location.hostname },
      user: { id: userIdBuf, name: userName, displayName: userName },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },   // ES256
        { type: "public-key", alg: -257 }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred",
      },
      timeout: 60000,
      attestation: "none",
    },
  })) as PublicKeyCredential | null;

  if (!cred) throw new Error("Registrazione biometrica annullata");

  localStorage.setItem(CRED_KEY, bufToB64(cred.rawId));
  localStorage.setItem(USER_KEY, userId);
  localStorage.setItem(ENABLED_KEY, "1");
  markUnlocked();
}

export function disableBiometric(): void {
  localStorage.removeItem(ENABLED_KEY);
  localStorage.removeItem(CRED_KEY);
  localStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(UNLOCKED_KEY);
}

export async function verifyBiometric(): Promise<boolean> {
  const credId = localStorage.getItem(CRED_KEY);
  if (!credId) return false;
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        rpId: window.location.hostname,
        timeout: 60000,
        userVerification: "required",
        allowCredentials: [{ id: b64ToBuf(credId), type: "public-key" }],
      },
    });
    if (assertion) {
      markUnlocked();
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function markUnlocked() {
  sessionStorage.setItem(UNLOCKED_KEY, String(Date.now()));
}
export function isUnlockedThisSession(): boolean {
  return !!sessionStorage.getItem(UNLOCKED_KEY);
}
export function clearUnlock() {
  sessionStorage.removeItem(UNLOCKED_KEY);
}
