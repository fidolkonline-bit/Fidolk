import { createPrivateKey, sign } from "node:crypto";
import type { PushSubscriptionRecord } from "./types";

const encode = (value: string | Buffer) =>
  Buffer.from(value).toString("base64url");

function credentials(endpoint: string) {
  const publicKey = process.env.VAPID_PUBLIC_KEY ?? "";
  const privateKey = process.env.VAPID_PRIVATE_KEY ?? "";
  const subject = process.env.VAPID_SUBJECT ?? "";
  const publicBytes = Buffer.from(publicKey, "base64url");
  if (
    publicBytes.length !== 65 ||
    publicBytes[0] !== 4 ||
    Buffer.from(privateKey, "base64url").length !== 32 ||
    !/^(mailto:|https:)/.test(subject)
  )
    throw new Error(
      "Valid VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT are required.",
    );
  const header = encode(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const payload = encode(
    JSON.stringify({
      aud: new URL(endpoint).origin,
      exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
      sub: subject,
    }),
  );
  const key = createPrivateKey({
    key: {
      kty: "EC",
      crv: "P-256",
      x: publicBytes.subarray(1, 33).toString("base64url"),
      y: publicBytes.subarray(33).toString("base64url"),
      d: privateKey,
    },
    format: "jwk",
  });
  const signature = sign("sha256", Buffer.from(`${header}.${payload}`), {
    key,
    dsaEncoding: "ieee-p1363",
  }).toString("base64url");
  return {
    publicKey,
    authorization: `vapid t=${header}.${payload}.${signature}, k=${publicKey}`,
  };
}

export async function sendEmptyPush(subscription: PushSubscriptionRecord) {
  const vapid = credentials(subscription.endpoint);
  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      Authorization: vapid.authorization,
      TTL: "60",
      Urgency: "high",
    },
    signal: AbortSignal.timeout(10000),
  });
  return {
    ok: response.ok,
    expired: response.status === 404 || response.status === 410,
  };
}
