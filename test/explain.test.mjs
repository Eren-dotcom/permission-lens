import assert from "node:assert";
import { explainKey, summarize, yoctoToNear, isValidAccountId } from "../src/explain.mjs";

// yocto conversion — values taken from live RPC responses checked 2026-11-13
assert.equal(yoctoToNear("250000000000000000000000"), "0.25"); // alice.near app keys
assert.equal(yoctoToNear("1000000000000000000000000"), "1");
assert.equal(yoctoToNear("9999203942481156415000"), "0.0099"); // example.testnet app key
assert.equal(yoctoToNear(null), null);

// account ID validation
assert.equal(isValidAccountId("alice.near"), true);
assert.equal(isValidAccountId("example.testnet"), true);
assert.equal(isValidAccountId("0123456789abcdef".repeat(4)), true); // implicit account
assert.equal(isValidAccountId("Alice.NEAR"), false); // uppercase not allowed
assert.equal(isValidAccountId("a"), false); // too short
assert.equal(isValidAccountId("bad..dots.near"), false);
assert.equal(isValidAccountId(""), false);

// full-access key — real shape from example.testnet
const full = explainKey({ public_key: "ed25519:4F9T", access_key: { nonce: 1, permission: "FullAccess" } });
assert.equal(full.kind, "full");
assert.match(full.headline, /act as the account itself/);
assert.ok(!JSON.stringify(full).toLowerCase().includes("dangerous"), "must not label keys dangerous");

// limited key with all methods, real shape from alice.near
const app = explainKey({
  public_key: "ed25519:2NT3",
  access_key: { nonce: 5, permission: { FunctionCall: { allowance: "250000000000000000000000", method_names: [], receiver_id: "social.near" } } },
});
assert.equal(app.kind, "function");
assert.equal(app.receiverId, "social.near");
assert.equal(app.allowanceNear, "0.25");
assert.ok(app.points.some((p) => p.includes("any method")));

// limited key with named methods + unlimited allowance
const named = explainKey({
  public_key: "ed25519:X",
  access_key: { nonce: 1, permission: { FunctionCall: { allowance: null, method_names: ["ft_transfer"], receiver_id: "token.near" } } },
});
assert.ok(named.points.some((p) => p.includes("ft_transfer")));
assert.ok(named.points.some((p) => p.includes("no set allowance limit")));

// summary counts
const s = summarize([
  { public_key: "k1", access_key: { permission: "FullAccess" } },
  { public_key: "k2", access_key: { permission: { FunctionCall: { allowance: "1", method_names: [], receiver_id: "a.near" } } } },
  { public_key: "k3", access_key: { permission: { FunctionCall: { allowance: "1", method_names: [], receiver_id: "a.near" } } } },
]);
assert.deepEqual({ total: s.total, full: s.full, fn: s.function }, { total: 3, full: 1, fn: 2 });
assert.deepEqual(s.contracts, ["a.near"]);

console.log("explain.test.mjs: all assertions passed");
