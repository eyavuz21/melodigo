// Who is calling? The page sends the signed-in user's Supabase access token; we ask Supabase who that is
// and what role they hold. Nothing here trusts the browser's word for it.
export async function whoAmI(req) {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_ANON_KEY;
  const auth = req.headers.authorization || "";
  if (!url || !key || !auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  const u = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, authorization: `Bearer ${token}` } });
  if (!u.ok) return null;
  const user = await u.json();
  const m = await fetch(`${url}/rest/v1/rpc/practicigo_me`, { method: "POST", headers: { apikey: key, authorization: `Bearer ${token}`, "content-type": "application/json" }, body: "{}" });
  const me = m.ok ? await m.json() : null;
  return { user, me, token };
}
export function readJson(req) { return typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {}); }
