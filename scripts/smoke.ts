const base = process.env.BASE_URL || "http://127.0.0.1:8787";
const password = process.env.APP_PASSWORD || "course-demo-password";

const health = await fetch(`${base}/api/health`);
if (!health.ok) throw new Error(`Health check failed: ${health.status}`);

const session = await fetch(`${base}/api/session`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ password }),
});
if (!session.ok) throw new Error(`Sign-in failed: ${session.status}`);
const cookie = session.headers.get("set-cookie");
if (!cookie) throw new Error("Sign-in did not set a cookie");

const api = await fetch(`${base}/api/properties`, { headers: { cookie } });
if (!api.ok) throw new Error(`Authenticated API check failed: ${api.status}`);
console.log("OpenProperty smoke test passed");
