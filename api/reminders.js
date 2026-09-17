// The morning message. Runs once a day (Vercel cron) and sends every pupil who has a session due today one
// note from their teacher: what they did last time, what is on today, how long the teacher asked for.
// Push (web push) first, email (Resend) if that is what they chose. Never twice in a day, never if the week is done.
//
// Also answers POST from a signed-in pupil ("send me today's message now") so the setting can be tested.
//
// Server-only secrets: SUPABASE_SERVICE_ROLE_KEY (reads every pupil row, bypassing RLS), VAPID_PUBLIC_KEY,
// VAPID_PRIVATE_KEY, VAPID_SUBJECT, CRON_SECRET, and optionally RESEND_API_KEY + REMINDER_FROM.
import webpush from "web-push";
import { whoAmI } from "./_auth.js";

const LONDON = "Europe/London";
const todayLondon = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: LONDON, year: "numeric", month: "2-digit", day: "2-digit" }).format(d); // YYYY-MM-DD
const addDays = (iso, n) => { const x = new Date(iso + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const nice = (iso) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "long", timeZone: LONDON });

function compose(data, today) {
  const p = data.profile || {}; const tn = data.teacherName || "your teacher";
  const w = data.weeks && data.weeks.length ? data.weeks[data.weeks.length - 1] : null;
  if (!w || !w.sessions || !w.sessions.length) return null;
  const done = new Set((w.done || []).map((x) => x.i));
  let next = -1; for (let i = 0; i < w.sessions.length; i++) if (!done.has(i)) { next = i; break; }
  if (next < 0) return null; // week complete: nothing to say
  // the most recent completed session across all weeks, with its date and feeling
  let last = null;
  for (const wk of data.weeks) for (const d of wk.done || []) { const at = String(d.at || "").slice(0, 10); if (!last || at > last.at) last = { at, feel: d.feel, title: wk.sessions?.[d.i]?.title || "your session", worked: Array.isArray(d.worked) ? d.worked.slice(0, 3) : [] }; }
  const minutes = Number(p.minutes) || 20; const s = w.sessions[next];
  let opening;
  if (last && last.at === addDays(today, -1)) opening = last.worked.length ? `Yesterday you worked on ${last.worked.join(", ")}${last.feel ? ` and said it felt ${last.feel}` : ""}.` : `You practised yesterday${last.feel ? ` and said it felt ${last.feel}` : ""}.`;
  else if (last) opening = `Your last session was ${last.title}, on ${nice(last.at)}. No matter; today is a fresh start.`;
  else opening = `Your first session is waiting.`;
  const body = `${opening} Today is day ${next + 1} of ${w.sessions.length}: ${s.title}, about ${minutes} minutes, whenever suits you.`;
  return { title: `${tn}, this morning`, body, next, minutes, url: process.env.APP_URL || "https://practicigo.app" };
}

async function sendPush(sub, msg) {
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:emre@talktalk.net", process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  await webpush.sendNotification(sub, JSON.stringify({ title: msg.title, body: msg.body, url: msg.url }), { TTL: 6 * 3600 });
}
async function sendEmail(to, msg, tn) {
  const key = process.env.RESEND_API_KEY; if (!key) throw new Error("email_not_configured");
  const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ from: process.env.REMINDER_FROM || "Stuckato <onboarding@resend.dev>", to: [to], subject: `${tn}: today's practice`, text: `${msg.body}\n\nOpen Practicigo: ${msg.url}\n\nYou get one of these on the mornings a session is due. Change it under Goal in the app.` }) });
  if (!r.ok) throw new Error(`resend ${r.status}: ${(await r.text()).slice(0, 200)}`);
}

async function deliver(row, msg, admin) {
  const data = row.data; const channel = data.profile?.reminder || (data.push ? "push" : data.contactEmail ? "email" : "off");
  if (channel === "off") return "off";
  const tn = data.teacherName || "Your teacher";
  if (channel === "push" && data.push) {
    try { await sendPush(data.push, msg); return "push"; }
    catch (e) { if (e.statusCode === 404 || e.statusCode === 410) { delete data.push; await admin.save(row.user_id, data); } if (!data.contactEmail) throw e; }
  }
  if (data.contactEmail) { await sendEmail(data.contactEmail, msg, tn); return "email"; }
  return "no_channel";
}

function adminClient() {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const h = { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" };
  return {
    async all() { const r = await fetch(`${url}/rest/v1/practicigo_students?select=user_id,data`, { headers: h }); if (!r.ok) throw new Error(`students ${r.status}`); return r.json(); },
    async one(id) { const r = await fetch(`${url}/rest/v1/practicigo_students?select=user_id,data&user_id=eq.${id}`, { headers: h }); const j = await r.json(); return j[0] || null; },
    async save(id, data) { const r = await fetch(`${url}/rest/v1/practicigo_students?user_id=eq.${id}`, { method: "PATCH", headers: { ...h, prefer: "return=minimal" }, body: JSON.stringify({ data, updated_at: new Date().toISOString() }) }); if (!r.ok) throw new Error(`save ${r.status}`); },
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const admin = adminClient();
  if (!admin) return res.status(503).json({ error: "not_configured", message: "SUPABASE_SERVICE_ROLE_KEY is not set on this deployment." });
  const today = todayLondon();

  // A signed-in pupil asking for their message now (the "send me a test" button)
  if (req.method === "POST") {
    const who = await whoAmI(req);
    if (!who || !who.user) return res.status(401).json({ error: "unauthorised" });
    const row = await admin.one(who.user.id);
    if (!row) return res.status(404).json({ error: "no_pupil" });
    const msg = compose(row.data, today);
    if (!msg) return res.status(200).json({ sent: false, message: "Nothing to send: no week set, or the week is already complete." });
    try { const via = await deliver(row, msg, admin); return res.status(200).json({ sent: via !== "off" && via !== "no_channel", via, preview: msg.body }); }
    catch (e) { return res.status(502).json({ sent: false, message: String(e.message || e).slice(0, 200), preview: msg.body }); }
  }

  // The daily run. Vercel cron calls GET with Authorization: Bearer $CRON_SECRET.
  if (req.method !== "GET") { res.setHeader("Allow", "GET, POST"); return res.status(405).json({ error: "method_not_allowed" }); }
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ error: "unauthorised" });

  const rows = await admin.all(); const out = { date: today, considered: rows.length, sent: 0, skipped: 0, failed: 0, channels: {} };
  for (const row of rows) {
    const data = row.data || {};
    const already = (data.reminders || []).some((r) => r.date === today);
    const msg = already ? null : compose(data, today);
    if (!msg) { out.skipped++; continue; }
    try {
      const via = await deliver(row, msg, admin);
      if (via === "off" || via === "no_channel") { out.skipped++; continue; }
      data.reminders = [...(data.reminders || []).slice(-60), { date: today, channel: via, next: msg.next, at: new Date().toISOString() }];
      await admin.save(row.user_id, data); out.sent++; out.channels[via] = (out.channels[via] || 0) + 1;
    } catch (e) { out.failed++; }
  }
  return res.status(200).json(out);
}
