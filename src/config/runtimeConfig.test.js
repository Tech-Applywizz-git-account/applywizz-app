const assert = require("assert");
const {
  allowSelfRegistration,
  buildAuthScreens,
  buildRuntimeExtra,
  validatedHttpsUrl,
} = require("./runtimeConfig");

assert.strictEqual(allowSelfRegistration("production", "true"), false);
assert.strictEqual(allowSelfRegistration("preview", "true"), true);
assert.strictEqual(allowSelfRegistration("development", "TRUE"), true);
assert.strictEqual(allowSelfRegistration("development", undefined), false);

assert.deepStrictEqual(buildAuthScreens({ Login: "login" }, false), { Login: "login" });
assert.deepStrictEqual(buildAuthScreens({ Login: "login" }, true), {
  Login: "login",
  Register: "register",
});

assert.strictEqual(validatedHttpsUrl("https://example.com/privacy"), "https://example.com/privacy");
assert.strictEqual(validatedHttpsUrl("http://example.com/privacy"), null);
assert.strictEqual(validatedHttpsUrl("javascript:alert(1)"), null);
assert.strictEqual(validatedHttpsUrl("not a url"), null);
assert.strictEqual(validatedHttpsUrl(""), null);

assert.deepStrictEqual(
  buildRuntimeExtra({
    EXPO_PUBLIC_ALLOW_SELF_REGISTRATION: "true",
    EXPO_PUBLIC_PRIVACY_POLICY_URL: "https://example.com/privacy",
    EXPO_PUBLIC_SUPPORT_URL: "ftp://example.com/support",
  }, "production"),
  {
    appEnv: "production",
    allowSelfRegistration: false,
    privacyPolicyUrl: "https://example.com/privacy",
    supportUrl: null,
    storeDemo: false,
  },
);

const { storeDemoEnabled } = require("./runtimeConfig");
assert.strictEqual(storeDemoEnabled({ EXPO_PUBLIC_STORE_DEMO: "true" }, "preview"), true);
assert.strictEqual(storeDemoEnabled({ EXPO_PUBLIC_STORE_DEMO: "true" }, "production"), false);
assert.strictEqual(
  storeDemoEnabled({
    EXPO_PUBLIC_STORE_DEMO: "true",
    EXPO_PUBLIC_STORE_DEMO_ALLOW_PRODUCTION: "true",
  }, "production"),
  true,
);
assert.strictEqual(storeDemoEnabled({}, "development"), false);

console.log("runtime config tests passed");
