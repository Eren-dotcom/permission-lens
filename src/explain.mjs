// Pure logic for Permission Lens: turn NEAR access-key data into plain language.
// No network, no DOM — the unit tests and the browser both use this file.

const YOCTO_PER_NEAR = 10n ** 24n;

// Format a yoctoNEAR integer string as NEAR, trimming to at most 4 decimals.
export function yoctoToNear(yocto) {
  if (yocto === null || yocto === undefined) return null;
  const v = BigInt(yocto);
  const whole = v / YOCTO_PER_NEAR;
  const frac = (v % YOCTO_PER_NEAR).toString().padStart(24, "0").slice(0, 4).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : `${whole}`;
}

// NEAR named accounts: lowercase segments of [a-z0-9_-] joined by dots, 2-64 chars.
// Implicit accounts: 64 hex chars. Anything else is rejected before any RPC call.
export function isValidAccountId(id) {
  if (typeof id !== "string" || id.length < 2 || id.length > 64) return false;
  if (/^[0-9a-f]{64}$/.test(id)) return true;
  return /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/.test(id);
}

// Explain one key entry from view_access_key_list:
// { public_key, access_key: { nonce, permission: "FullAccess" | { FunctionCall: {...} } } }
// Rule from the brief: describe capability and context. Never a safety score,
// never "dangerous" — a full-access key is often the owner's own main key.
export function explainKey(entry) {
  const perm = entry?.access_key?.permission;
  if (perm === "FullAccess") {
    return {
      kind: "full",
      label: "Full access",
      headline: "This key can act as the account itself.",
      points: [
        "It can send funds, add or remove other keys, deploy contracts, and delete the account.",
        "This is the kind of key a wallet creates for the owner — having one is normal and usually essential.",
        "What matters is where it is stored and whether you still control every copy of it.",
      ],
      review: [
        "Do you know where this key is stored (wallet, seed phrase, hardware wallet)?",
        "Is this your current main key, or an old one from a wallet you no longer use?",
        "If you do not recognise it, treat that as the first thing to sort out — before adding more funds.",
      ],
    };
  }
  if (perm && typeof perm === "object" && perm.FunctionCall) {
    const fc = perm.FunctionCall;
    const methods = fc.method_names || [];
    const near = yoctoToNear(fc.allowance);
    const points = [
      `It can only call one contract: ${fc.receiver_id}. It cannot act on any other contract or account.`,
      methods.length === 0
        ? `It can call any method on ${fc.receiver_id} — the app did not narrow it to specific actions.`
        : `It can only call these methods on that contract: ${methods.join(", ")}.`,
      fc.allowance === null || fc.allowance === undefined
        ? "It has no set allowance limit — the key itself does not cap how much transaction-fee balance it can spend over time."
        : `It has about ${near} NEAR of allowance left. Allowance pays transaction fees and is spent down as the key is used; it is not a transfer limit on your funds.`,
      "It cannot transfer your balance on its own, add other keys, or delete the account.",
    ];
    return {
      kind: "function",
      label: "App key (limited)",
      headline: `Limited to ${fc.receiver_id}.`,
      receiverId: fc.receiver_id,
      methodNames: methods,
      allowanceNear: near,
      points,
      review: [
        `Do you still use the app at ${fc.receiver_id}?`,
        "Do you recognise granting this access?",
        "If the app is gone or unused, this key is a candidate to remove in your wallet.",
      ],
    };
  }
  return {
    kind: "unknown",
    label: "Unknown permission type",
    headline: "This key has a permission format Permission Lens does not recognise.",
    points: ["The raw permission is shown below so you can check it yourself."],
    review: ["Check this key in a NEAR explorer before trusting it."],
  };
}

export function summarize(entries) {
  const explained = entries.map(explainKey);
  return {
    total: entries.length,
    full: explained.filter((e) => e.kind === "full").length,
    function: explained.filter((e) => e.kind === "function").length,
    unknown: explained.filter((e) => e.kind === "unknown").length,
    contracts: [...new Set(explained.filter((e) => e.receiverId).map((e) => e.receiverId))],
  };
}
