# Permission Lens 🔐

**Know what can access your NEAR account — before you trust it with more money.**

A read-only NEAR wallet permission checker that explains access keys in plain language.

- **Event:** NEAR HACKATHON, 1–14 Nov 2026 (development ends 14 Nov 2026, 23:59 UTC)
- **Track:** AI Security & Defense (`security`)
- **Live demo:** (added after deploy) · **Demo post:** (added after posting on X)

## The problem

Every NEAR account can have many access keys: full-access keys that can act as the
account itself, and limited "app keys" that wallets hand to dApps so they can call one
contract. Most users have granted keys they no longer remember — to apps they may not
use any more. The information is public on-chain, but the raw form (public keys,
yoctoNEAR allowances, method lists) means nothing to a non-developer.

## What it does

1. Enter a NEAR account ID and pick testnet or mainnet — **do X:** type
   `example.testnet`, click *Check permissions* — **see Y:** every key on the account
   as a plain-language card.
2. **Full-access cards** explain what the key can do (send funds, manage keys, deploy,
   delete the account) and give context: this is normally the owner's own wallet key,
   so what matters is where it is stored and whether you recognise it. Permission Lens
   deliberately does **not** score keys or label them "dangerous".
3. **App-key cards** name the single contract the key can call, whether it can call
   any method or only named ones, and its remaining allowance converted from
   yoctoNEAR, with a note that allowance pays transaction fees — it is not a spending
   limit on the user's funds.
4. **Review checklist:** each card asks whether the user recognises the key and still
   needs it, with a progress count, a "before you remove any key" safety guide
   (never remove your only full-access key), and a copyable text summary.

## How NEAR is used

- Live data from public NEAR RPC: `query` / `view_access_key_list` against public
  endpoints (FastNEAR first, official `rpc.<network>.near.org` as fallback).
- NEAR's access-key model is the product: FullAccess vs FunctionCall permissions,
  receiver restrictions, method restrictions, and allowances are exactly what the
  cards explain. This tool could not exist in this form on an account model without
  scoped keys.

## Safety model

- Read-only by design: the app only makes `view_*` RPC queries. It cannot sign, send,
  add, or delete anything.
- No seed phrase, private key, or wallet connection is ever requested.
- No backend, no accounts, no storage, no analytics. Lookups happen in the visitor's
  browser directly against public RPC.

## Run it

```sh
# any static server works, e.g.
python3 -m http.server 8000
# then open http://localhost:8000
```

No build step, no dependencies.

## Test

```sh
node test/explain.test.mjs
```

Covers yoctoNEAR conversion (values taken from live RPC responses), account-ID
validation, full-access and function-call explanations (including the rule that keys
are never labelled dangerous), and summary counts. Live data was verified against
`example.testnet` (12 keys, both kinds) and `alice.near` (38 keys, both kinds) on
2026-11-13.

## Layout

- `index.html`, `style.css`, `app.js` — the page, styling, and browser logic
  (RPC with endpoint fallback, rendering, review state, copy summary).
- `src/explain.mjs` — pure explanation logic shared by the page and the tests.
- `test/explain.test.mjs` — assertion tests (Node, no framework).

## Known limits

- Accounts with more than 100 keys (mostly large system accounts such as `near`)
  return `TOO_MANY_ACCESS_KEYS` from RPC; v1 shows a clear message instead of a
  partial list. Upgrade path: paginated `view_access_key_list` requests.
- Key creation dates are not exposed by `view_access_key_list`, so cards do not
  guess at a key's age.
- Revocation is guidance-only in v1: removal happens in the user's own wallet or
  NEAR CLI, never inside Permission Lens.

## License

MIT
