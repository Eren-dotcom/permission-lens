import { explainKey, summarize, isValidAccountId } from "./src/explain.mjs";

// Public NEAR RPC endpoints, tried in order. Read-only query calls only —
// this app never signs or sends a transaction.
// shortcut: no pagination yet, so accounts with >100 keys get a clear message
// instead of a list. Upgrade path: paginated view_access_key_list requests.
const RPCS = {
  testnet: ["https://rpc.testnet.fastnear.com", "https://rpc.testnet.near.org"],
  mainnet: ["https://rpc.mainnet.fastnear.com", "https://rpc.mainnet.near.org"],
};

const $ = (id) => document.getElementById(id);
const state = { result: null, reviewed: new Set() };

async function rpc(network, accountId) {
  const body = JSON.stringify({
    jsonrpc: "2.0", id: "permission-lens", method: "query",
    params: { request_type: "view_access_key_list", finality: "final", account_id: accountId },
  });
  let lastErr;
  for (const url of RPCS[network]) {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 15000);
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body, signal: ctl.signal });
      clearTimeout(t);
      const data = await res.json();
      if (data.error) {
        const name = data.error.cause?.name || "";
        if (name === "TOO_MANY_ACCESS_KEYS") throw new Error("TOO_MANY");
        if (name === "UNKNOWN_ACCOUNT") throw new Error("NOT_FOUND");
        throw new Error(data.error.data || data.error.message || "RPC error");
      }
      return data.result.keys;
    } catch (e) {
      if (e.message === "TOO_MANY" || e.message === "NOT_FOUND") throw e;
      lastErr = e;
    }
  }
  throw lastErr || new Error("All RPC endpoints failed");
}

function textSummary() {
  if (!state.result) return "";
  const { accountId, network, keys } = state.result;
  const s = summarize(keys);
  const lines = [
    `Permission Lens — ${accountId} (${network})`,
    `${s.total} keys: ${s.full} full-access, ${s.function} app keys${s.unknown ? `, ${s.unknown} unknown` : ""}.`,
    ...(s.contracts.length ? [`Contracts with app keys: ${s.contracts.join(", ")}`] : []),
    "",
    ...keys.map((k, i) => {
      const e = explainKey(k);
      return `${i + 1}. [${e.label}] ${k.public_key}\n   ${e.headline}`;
    }),
  ];
  return lines.join("\n");
}

function render() {
  const { accountId, network, keys } = state.result;
  const s = summarize(keys);
  $("summary").hidden = false;
  $("summary").innerHTML =
    `<h2>${accountId} <span class="mono">(${network})</span></h2>` +
    `<p>${s.total} keys found: <strong>${s.full} full-access</strong>, <strong>${s.function} app keys</strong>` +
    (s.unknown ? `, ${s.unknown} unknown type` : "") + `.</p>` +
    (s.contracts.length ? `<p>Apps/contracts holding limited keys: ${s.contracts.map((c) => `<span class="mono">${c}</span>`).join(", ")}</p>` : "") +
    `<p class="progress" id="progress"></p>`;
  $("cards").innerHTML = "";
  keys.forEach((k, i) => {
    const e = explainKey(k);
    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML =
      `<h3>Key ${i + 1} <span class="tag ${e.kind}">${e.label}</span></h3>` +
      `<p><strong>${e.headline}</strong></p>` +
      `<p class="mono">${k.public_key}</p>` +
      `<ul>${e.points.map((p) => `<li>${p}</li>`).join("")}</ul>` +
      `<div class="review"><p><strong>Review this key:</strong></p>` +
      e.review.map((r) => `<label><input type="checkbox" data-key="${i}"> ${r}</label>`).join("") +
      `</div>`;
    $("cards").appendChild(card);
  });
  $("guide").hidden = false;
  updateProgress();
  document.querySelectorAll('input[type="checkbox"][data-key]').forEach((cb) =>
    cb.addEventListener("change", () => {
      // A key counts as reviewed once every question on its card is ticked.
      const idx = cb.dataset.key;
      const all = [...document.querySelectorAll(`input[data-key="${idx}"]`)];
      if (all.every((b) => b.checked)) state.reviewed.add(idx); else state.reviewed.delete(idx);
      updateProgress();
    })
  );
}

function updateProgress() {
  const el = $("progress");
  if (el && state.result) el.textContent = `Reviewed: ${state.reviewed.size} of ${state.result.keys.length} keys`;
}

$("lookup").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const accountId = $("account").value.trim().toLowerCase();
  const network = $("network").value;
  state.reviewed.clear();
  if (!isValidAccountId(accountId)) {
    $("status").textContent = "That does not look like a NEAR account ID. Check for typos — account IDs are lowercase, like example.testnet or alice.near.";
    return;
  }
  $("status").textContent = `Checking ${accountId} on ${network}…`;
  try {
    const keys = await rpc(network, accountId);
    state.result = { accountId, network, keys };
    $("status").textContent = "";
    render();
  } catch (e) {
    $("summary").hidden = true; $("cards").innerHTML = ""; $("guide").hidden = true;
    $("status").textContent =
      e.message === "NOT_FOUND" ? `Account ${accountId} was not found on ${network}. Check the network — testnet accounts end in .testnet.` :
      e.message === "TOO_MANY" ? `${accountId} has more than 100 keys, more than this first version can list at once. Very large system accounts are affected; ordinary wallet accounts are not.` :
      `Could not reach the NEAR network (${e.message}). Try again in a moment.`;
  }
});

document.querySelectorAll(".chip").forEach((chip) =>
  chip.addEventListener("click", () => {
    $("network").value = chip.dataset.net;
    $("account").value = chip.dataset.acct;
    $("lookup").requestSubmit();
  })
);

$("copy").addEventListener("click", async () => {
  await navigator.clipboard.writeText(textSummary());
  $("copied").textContent = "Copied.";
});
