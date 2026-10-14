/**
 * Store-demo helpers — unit checks (no network, no real data).
 * Run: node src/storeDemo/storeDemo.test.js
 */
const assert = require("assert");

// Mirror filter logic without Expo Constants (fixtures only).
const { DEMO_INVOICE_INBOX } = require("./fixtures");

function filterDemoInbox({ status = "all", search = "" } = {}) {
  const q = String(search || "").trim().toLowerCase();
  return DEMO_INVOICE_INBOX.filter((row) => {
    const st = String(row.displayStatus || row.status || "").toLowerCase();
    if (status && status !== "all") {
      const want = String(status).toLowerCase();
      if (want === "created" && st !== "created" && st !== "open") return false;
      if (want !== "created" && st !== want) return false;
    }
    if (!q) return true;
    const hay = [
      row.reference,
      row.clientName,
      row.clientEmail,
      row.awlId,
      row.methodLabel,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

function test(name, fn) {
  try {
    fn();
    console.log("ok -", name);
  } catch (e) {
    console.error("fail -", name, e);
    process.exitCode = 1;
  }
}

test("fixtures contain only example.com emails", () => {
  for (const row of DEMO_INVOICE_INBOX) {
    assert.ok(String(row.clientEmail).endsWith("@example.com"));
    assert.ok(String(row.reference).startsWith("BILL-DEMO"));
    assert.ok(String(row.awlId).startsWith("AWL-100"));
  }
});

test("filter by paid", () => {
  const paid = filterDemoInbox({ status: "paid" });
  assert.strictEqual(paid.length, 2);
  assert.ok(paid.every((r) => r.displayStatus === "paid"));
});

test("search by fictional name", () => {
  const hit = filterDemoInbox({ search: "Jordan" });
  assert.strictEqual(hit.length, 1);
  assert.strictEqual(hit[0].clientName, "Jordan Lee");
});

test("no real-looking gmail domains in fixtures", () => {
  const blob = JSON.stringify(DEMO_INVOICE_INBOX).toLowerCase();
  assert.ok(!blob.includes("@gmail.com"));
  assert.ok(!blob.includes("razorpay"));
  assert.ok(!blob.includes("mohammed"));
});

console.log("storeDemo tests done");
