/**
 * Node-runnable tests for mobile request lanes (no React Native imports).
 */
const assert = require("assert");
const {
  isLightUrl,
  shouldBypassQueue,
  enqueueRequest,
  resetMobileBalancerForTests,
} = require("./requestLanes.js");

function test(name, fn) {
  try {
    fn();
    console.log("ok -", name);
  } catch (e) {
    console.error("fail -", name);
    throw e;
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    console.log("ok -", name);
  } catch (e) {
    console.error("fail -", name);
    throw e;
  }
}

test("classifies catalog URLs as light", () => {
  assert.strictEqual(isLightUrl("/services/"), true);
  assert.strictEqual(isLightUrl("/billing/home/"), true);
  assert.strictEqual(isLightUrl("/billing/upi-accounts/"), true);
  assert.strictEqual(isLightUrl("/services/countries/"), true);
  assert.strictEqual(isLightUrl("/users/subordinates/"), true);
  assert.strictEqual(isLightUrl("/billing/inbox/"), false);
  assert.strictEqual(isLightUrl("/reports/analytics/"), false);
});

test("bypasses refresh", () => {
  assert.strictEqual(shouldBypassQueue("/auth/login/refresh/"), true);
  assert.strictEqual(shouldBypassQueue("/auth/me/"), false);
});

(async () => {
  resetMobileBalancerForTests();
  await testAsync("prefers light over heavy when capacity is tight", async () => {
    const order = [];
    const slow = (label, ms, light) =>
      enqueueRequest(
        () =>
          new Promise((resolve) => {
            order.push(`start:${label}`);
            setTimeout(() => {
              order.push(`end:${label}`);
              resolve(label);
            }, ms);
          }),
        { light },
      );

    const heavies = [
      slow("h1", 40, false),
      slow("h2", 40, false),
      slow("h3", 40, false),
    ];
    const light = slow("light", 10, true);
    await Promise.all([...heavies, light]);
    assert.ok(order.indexOf("start:light") < order.indexOf("start:h3"));
  });

  console.log("All requestLanes tests passed.");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
