// Stuckato: turns a teacher's thirty-second lesson note (or a conductor's rehearsal note) into the pupil's week: three guided sessions
// (steps, minutes, what the teacher's voice says) and a checklist for the next lesson.
import Anthropic from "@anthropic-ai/sdk";

const SCHEMA = {
  type: "object",
  properties: {
    sessions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          intro: { type: "string" },
          steps: {
            type: "array",
            items: {
              type: "object",
              properties: { name: { type: "string" }, minutes: { type: "number" }, caption: { type: "string" } },
              required: ["name", "minutes", "caption"],
              additionalProperties: false,
            },
          },
        },
        required: ["title", "intro", "steps"],
        additionalProperties: false,
      },
    },
    checklist: { type: "array", items: { type: "string" } },
    work: { type: "array", items: { type: "string" } },
    encouragement: { type: "string" },
  },
  required: ["sessions", "checklist", "work", "encouragement"],
  additionalProperties: false,
};

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "GET") return res.status(200).json({ ok: true, configured: Boolean(process.env.ANTHROPIC_API_KEY) });
  if (req.method !== "POST") { res.setHeader("Allow", "GET, POST"); return res.status(405).json({ error: "method_not_allowed" }); }
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: "not_configured", message: "ANTHROPIC_API_KEY is not set on this deployment." });

  const { profile = {}, note = {}, teacherName = "your teacher", weeksToGoal = null, group = null, lastWeekTally = [] } = req.body || {};
  const sessions = Math.min(7, Math.max(3, Number(profile.sessionsPerWeek) || 7));
  const minutes = Math.min(120, Math.max(10, Number(profile.minutes) || 20));
  const workedOn = String(note.workedOn || "").slice(0, 2000);
  const forNext = Array.isArray(note.forNext) ? note.forNext.map(String).slice(0, 10) : [];
  const line = String(note.line || "").slice(0, 400);
  if (!workedOn && !forNext.length) return res.status(400).json({ error: "bad_request", message: "Add what you worked on or what to prepare." });

  const isGroup = group && typeof group === "object";
  const gName = isGroup ? String(group.name || "the group").slice(0, 120) : "";
  const gParts = isGroup && Array.isArray(group.parts) ? group.parts.map(String).slice(0, 12) : [];
  const prompt = isGroup ? `You write individual practice sessions for every member of a choir or orchestra, in the conductor's voice, after a rehearsal. British English. Warm, specific, unhurried, never gushing.

Group: ${gName}.${gParts.length ? ` Parts receiving this week: ${gParts.join(", ")}.` : ""} Each member practises alone at home on their own part, between rehearsals. Write for "you" and "your part" so the same sessions make sense to a soprano, a second violin or a cellist. Sessions for an ensemble are about: learning the notes and rhythms of your part slowly, counting entries and rests, words from memory for singers, listening to a recording while following the score, marking the score, singing or playing along with the recording at speed, and being ready to hold your line against the others. Level: mixed.
Conductor: ${teacherName}.

The conductor's note after this week's rehearsal:` : `You write practice sessions for a music teacher's pupil, in the teacher's voice. British English. Warm, specific, unhurried, never gushing.

Pupil: ${profile.name || "the pupil"}. Instrument: ${profile.instrument || "violin"}. Level: ${profile.level || "beginner"}.${profile.goalLabel ? ` Goal: ${profile.goalLabel}${weeksToGoal !== null ? `, about ${weeksToGoal} weeks away` : ""}.` : ""}
Teacher: ${teacherName}.

The teacher's note after this week's lesson:`
  + `
What we worked on: ${workedOn || "(not given)"}
For next lesson: ${forNext.length ? forNext.map((x) => "- " + x).join("\n") : "(not given)"}
One line for the week: ${line || "(none)"}

Write exactly ${sessions} sessions, one for each day of the week in order (day 1 is the day after the lesson), each about ${minutes} minutes in total, which is the length the teacher has set for this pupil (the step minutes must add up to between ${minutes - 2} and ${minutes + 2}). Each session has ${minutes >= 45 ? "6 to 9" : "4 to 6"} steps. One of the middle days should be deliberately lighter.${Array.isArray(lastWeekTally) && lastWeekTally.length ? `\n\nWhat the pupil ticked as worked on last week, most first: ${lastWeekTally.slice(0, 10).join("; ")}. Balance this week so the neglected items get their turn, and say so in a caption once.` : ""} Structure every session: a short warm-up, then technique from the note, then the piece or passage from the note, then a return to the technique in a new way (interleave), then a one-minute wind-down that ends by telling the pupil to stop. Steps get shorter and more focused as the week goes on; session ${sessions} should feel like preparation for the lesson.

Each step's caption is what the teacher says at the start of that step, one or two sentences. The only technical content allowed is what the teacher wrote in the note, restated in the teacher's words and attributed ("you said the F sharp was low; slowly, and listen for it"). Never invent technique, fingering, bowing, breathing, posture or interpretation advice the note does not contain: you are organising the teacher's instructions into a week, not teaching. Where the note gives nothing for a step, the caption is about how to practise (slowly, once through, stop before it gets messy, listen back, play it for someone), not how to play. Never imply that the app can hear the pupil or judge the result; the pupil and the teacher judge, the app only reminds and times. Never say "great job" style filler. A "stop before it gets messy" instruction belongs somewhere in each session. Vary the sessions; do not repeat captions.

Also write: a checklist of 3 to 5 short items the pupil should be able to show at the next lesson, drawn from "For next lesson"; a work list of 4 to 8 short labels (a scale, a passage, a technique, a piece) that the pupil will tick after each day's practice to say what they worked on, written as nouns a child can recognise ("D major scale", "Twinkle, first phrase"); and one sentence of encouragement for the week that a real teacher would say.

Respond with JSON only.`.replace(/the pupil/g, isGroup ? "each member" : "the pupil").replace(/the lesson/g, isGroup ? "the rehearsal" : "the lesson").replace(/next lesson/g, isGroup ? "next rehearsal" : "next lesson");

  const client = new Anthropic();
  try {
    const response = await client.beta.messages.create({
      model: "claude-opus-5",
      max_tokens: 4096,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
      messages: [{ role: "user", content: prompt }],
    });
    if (response.stop_reason === "refusal") return res.status(502).json({ error: "refusal", message: "The model declined this request." });
    const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    let parsed;
    try { parsed = JSON.parse(text); } catch { return res.status(502).json({ error: "bad_json", message: "The model returned something that was not JSON." }); }
    const plain = (t) => String(t || "").replace(/\s*[\u2014\u2013]\s*/g, ", ").replace(/,\s*,/g, ",");
    parsed.sessions = (parsed.sessions || []).slice(0, sessions).map((s) => ({ ...s, title: plain(s.title), intro: plain(s.intro), steps: (s.steps || []).map((x) => ({ ...x, name: plain(x.name), caption: plain(x.caption) })) }));
    parsed.checklist = (parsed.checklist || []).map(plain);
    parsed.work = (parsed.work || []).map(plain).slice(0, 8);
    parsed.encouragement = plain(parsed.encouragement);
    return res.status(200).json(parsed);
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return res.status(429).json({ error: "rate_limited", message: "Too many requests just now. Try again in a minute." });
    if (err instanceof Anthropic.AuthenticationError) return res.status(500).json({ error: "auth", message: "The API key on this deployment was rejected." });
    if (err instanceof Anthropic.APIConnectionError) return res.status(502).json({ error: "connection", message: "Could not reach the model." });
    if (err instanceof Anthropic.APIError) return res.status(502).json({ error: "upstream", message: `Upstream error ${err.status}.` });
    return res.status(500).json({ error: "unknown", message: "Something went wrong." });
  }
}
