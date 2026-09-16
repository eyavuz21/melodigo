// "They've finished." A signed-in pupil posts here the moment they write their after-session sentence; if their teacher
// asked to be told (profile.notifyFinish, set on the pupil page), the teacher gets one short email through Resend.
// Nothing here trusts the browser: who the pupil is, and which studio, comes from their token; the teacher's address
// comes from the studio row and Supabase auth, read with the service-role key. No email configured: answers {sent:false}.
import { whoAmI, readJson } from "./_auth.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  const who = await whoAmI(req);
  if (!who || !who.user || !who.me || who.me.role !== "teacher" && who.me.role !== "student") return res.status(401).json({ error: "unauthorised" });
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY, resend = process.env.RESEND_API_KEY;
  if (!url || !key) return res.status(503).json({ error: "not_configured", message: "SUPABASE_SERVICE_ROLE_KEY is not set on this deployment." });
  if (!resend) return res.status(200).json({ sent: false, reason: "email_not_configured" });
  const h = { apikey: key, authorization: `Bearer ${key}` };
  const body = readJson(req);
  const note = String(body.note || "").slice(0, 600), title = String(body.title || "").slice(0, 120);
  const day = Number(body.day) || 0, of = Number(body.of) || 0, minutes = Number(body.minutes) || 0;

  // the pupil's own row: is the teacher asking to be told?
  const sr = await fetch(`${url}/rest/v1/melodigo_students?select=studio_id,data&user_id=eq.${who.user.id}`, { headers: h });
  const srow = (await sr.json())[0]; if (!srow) return res.status(404).json({ error: "no_pupil" });
  if (!srow.data?.profile?.notifyFinish) return res.status(200).json({ sent: false, reason: "not_requested" });
  const name = srow.data?.profile?.name || "Your pupil";

  // the studio's teacher, then their email
  const st = await fetch(`${url}/rest/v1/melodigo_studios?select=teacher_id,name&id=eq.${srow.studio_id}`, { headers: h });
  const studio = (await st.json())[0]; if (!studio) return res.status(404).json({ error: "no_studio" });
  const ur = await fetch(`${url}/auth/v1/admin/users/${studio.teacher_id}`, { headers: h });
  if (!ur.ok) return res.status(502).json({ error: "auth", message: `auth ${ur.status}` });
  const teacher = await ur.json(); if (!teacher.email) return res.status(200).json({ sent: false, reason: "no_teacher_email" });

  const when = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
  const text = `${name} finished ${day && of ? `day ${day} of ${of}` : "a session"}${title ? ` (${title})` : ""} at ${when}${minutes ? `, ${minutes} minutes` : ", in their own time"}.\n\nThey wrote: "${note}"\n\nConfirm it, ask them a question, or take the token back: ${process.env.APP_URL || "https://practicigo.vercel.app"}\n\nYou get this because you ticked "Tell me when they finish" on ${name}'s page.`;
  const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { authorization: `Bearer ${resend}`, "content-type": "application/json" },
    body: JSON.stringify({ from: process.env.REMINDER_FROM || "Practicigo <onboarding@resend.dev>", to: [teacher.email], subject: `${name} finished today's practice`, text }) });
  if (!r.ok) return res.status(502).json({ sent: false, reason: `resend ${r.status}` });
  return res.status(200).json({ sent: true });
}
