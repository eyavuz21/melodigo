// Create or delete the teacher's cloned voice. POST {audio (base64), mime, name} → {voice_id}; DELETE {voice_id}.
// The sample is recorded in the app with explicit consent; only the studio's teacher can call this.
import { whoAmI, readJson } from "./_auth.js";
export const config = { api: { bodyParser: { sizeLimit: "6mb" } } };

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const xi = process.env.ELEVENLABS_API_KEY;
  if (!xi) return res.status(503).json({ error: "not_configured", message: "ELEVENLABS_API_KEY is not set on this deployment." });
  const who = await whoAmI(req);
  if (!who || !who.me || who.me.role !== "teacher") return res.status(401).json({ error: "unauthorised", message: "Only a signed-in teacher can do this." });

  if (req.method === "DELETE") {
    const { voice_id } = readJson(req);
    if (!voice_id || voice_id !== who.me.voice_id) return res.status(400).json({ error: "bad_request", message: "That is not your studio's voice." });
    const r = await fetch(`https://api.elevenlabs.io/v1/voices/${encodeURIComponent(voice_id)}`, { method: "DELETE", headers: { "xi-api-key": xi } });
    return res.status(r.ok ? 200 : 502).json(r.ok ? { ok: true } : { error: "upstream", message: `ElevenLabs ${r.status}` });
  }
  if (req.method !== "POST") { res.setHeader("Allow", "POST, DELETE"); return res.status(405).json({ error: "method_not_allowed" }); }

  const { audio, mime = "audio/webm", name = "Teacher" } = readJson(req);
  if (!audio || typeof audio !== "string" || audio.length < 20000) return res.status(400).json({ error: "bad_request", message: "The recording is too short. Read the whole passage, about thirty seconds." });
  const bytes = Buffer.from(audio, "base64");
  const ext = /mp4|m4a|aac/.test(mime) ? "m4a" : /ogg/.test(mime) ? "ogg" : /wav/.test(mime) ? "wav" : "webm";
  const form = new FormData();
  form.append("name", `Practicigo · ${String(name).slice(0, 40)}`);
  form.append("description", "Teacher's voice for practice captions. Recorded in Practicigo with consent.");
  form.append("remove_background_noise", "true");
  form.append("files", new Blob([bytes], { type: mime }), `sample.${ext}`);
  const r = await fetch("https://api.elevenlabs.io/v1/voices/add", { method: "POST", headers: { "xi-api-key": xi }, body: form });
  if (!r.ok) { const t = await r.text().catch(() => ""); return res.status(502).json({ error: "upstream", message: `ElevenLabs ${r.status}: ${t.slice(0, 200)}` }); }
  const j = await r.json();
  return res.status(200).json({ voice_id: j.voice_id });
}
