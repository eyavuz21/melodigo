<p align="center"><img src="logo.svg" alt="Stuckato. Short bursts. Real progress." width="420"></p>

# Stuckato

**Short bursts. Real progress.** Couch to 5K for practising an instrument, on your own with a teacher or as part of a choir or orchestra. Your teacher sets the week in thirty seconds; Stuckato gets you to practise every day.

**Live:** https://stuckato.app

## The idea

Every practice app is one of two things: it listens to you play and scores the notes (Yousician, Simply Piano, Trala), or it's a diary where you log your minutes (Tonara, Modacity). Both leave you alone on the part that matters, which is turning up three times a week when nobody is making you. Couch to 5K never measured anyone's running; it had a calm voice, a structure, and a reason to go out on Thursday. Nobody had done that for practising an instrument.

Stuckato has two sides. The **teacher** writes a thirty-second note after each lesson (what we worked on, what to prepare, one line for the week) and sets how many minutes a day; Stuckato turns it into that pupil's week: one short guided session for every day, with step-by-step captions in the teacher's voice, a work list, and a checklist for the next lesson. The **pupil** runs each day's session (or practises on their own and just ticks), then ticks what they worked on from the work list, flags questions and breakthroughs while they're fresh, and keeps a streak that forgives a missed day. Before the next lesson the teacher sees what was worked on most, and the next week is planned around it. A **conductor** does the same for a whole choir or orchestra: one rehearsal note becomes a week for every member, each for their own part.

## What's in v0.7 (16 September 2026)

- **The sentence.** After every session the pupil writes (or dictates) what they worked on and what changed. "Done for today" stays off until there is a real sentence, and the day's token, coin and streak arrive with the sentence, not the tick. Close the app without writing it and Today shows "Day N isn't finished" until you do.
- **The teacher reads it.** On the pupil page, each day shows the sentence with three taps: *Sounds right* (confirms), *Ask them* (a one-line question that lands on the pupil's Today screen), *Doesn't add up* (takes the token back and greys the day). The pupil list shows "finished today 18:42", "sentence missing" and "play-through to hear".
- **The fermata.** When the last step's clock reaches zero the screen holds on a fermata: *Pause. Take a break.* Tap or wait, then the Done screen.
- **Tell me when they finish.** A per-pupil switch on the pupil page; when on, the teacher gets an email the moment the sentence is saved (`api/notify.js`, Resend; silent if email is not configured).
- **The play-through.** The day before the lesson (or once every day is done) Today asks for one recording of the piece, all the way through, up to five minutes. It uploads to the audio bucket under `<studio>/recordings/<pupil>/<week>`; the teacher gets a player, *Heard it*, and a one-line reply that goes to the pupil now and is pre-filled as next week's "What you did well". The week's two bonus tokens wait for it. The bucket is public-read, so anyone with the exact URL can play a recording: fine for the pilot, move recordings to a private bucket before it grows.
- **The light on the goal.** A dot and a word next to the goal, on Today, the Goal tab and the teacher's list: green *On track* (80%+ of the goal-weeks so far had practice in them), amber *Slipping* (50 to 79%), red *Talk about the date* (under 50%), dropped one level when it is day five or later with fewer than two days done. The one place colour is used for something other than a flag.
- Name: Stuckato (stuck + staccato). Mark: the S with a staccato dot above it.
- Demo views: `?demo=done`, `?demo=fermata`, `?demo=pupilpage`, `?demo=pupil2` (the pupil whose play-through is due).

## What's in v0.3 (14 September 2026)

- **Group mode for choirs and orchestras:** a studio can be an ensemble. Members set their part (alto, second violin); the conductor opens the Group tab, picks everyone or particular parts, writes one rehearsal note, reviews one preview, and publishes a week to every member. The sessions are written for "your part": notes and rhythms slowly, entries counted, words from memory, listening with the score. The conductor's cloned voice is synthesised once and shared. Add a task to everyone, and book a rehearsal for everyone, from the same screen
- **Tasks during the week:** a teacher who thinks of something on Wednesday adds it to a pupil's week without rewriting it. It appears on the pupil's Today screen under "New from [teacher]" and in their Journey checklist; the pupil ticks it off
- New name, new mark (then Melodigo): a quaver whose flag is the finish flag as the i

## What's in v0.5 (15 September 2026, evening)

- **A session every day.** Seven daily sessions by default (the teacher can set three to seven), one lighter day in the middle. The week is drawn as notes on a stave: filled notes are days done, the amber ring is today
- **Tick what you worked on.** Every week comes with a work list (scale, passage, technique, piece). After each session, or after practising without the timer ("I practised on my own"), the pupil ticks what they did and can add their own. The teacher's pupil page shows **worked on most this week**, and last week's tally goes into the planner so neglected items get their turn
- **The interface, redone for a nine-year-old and a teacher of any age.** One bold sans typeface throughout, beige on black (the logo's colours, one theme), every fact in its own box or chip (date, day 3 of 7, minutes set by the teacher), the teacher's line as a speech bubble, bigger buttons and labels, nothing crammed
- **Today, in order.** The week on the stave with any news from the teacher inside it, the teacher's line for the week, last time, today's session, the two buttons (start the guided session, or "I practised on my own"), then the streak and how many points to the reward. Everything in the same size except the two buttons
- **The teacher's side is one page too.** Left: the code to give pupils, then the pupils. Right: **Send a message** (everyone, parts, or chosen pupils; it lands as news on their trail) and **Whole group** (one week for everyone, opens the group form). No tabs. Flag counts and flags are in red
- **The parent card** is three boxes: the dates, the pupil's week (days done, minutes practised, points earned), and the teacher's feedback from the last lesson with "For next lesson" underneath. When the teacher has set an exam or concert date, a fourth box draws the goal as the end of a piece: one note a week from the first week to the date, filled when practised, a ring on this week, bar lines every four weeks and the double bar line on the day; then weeks practised and weeks complete
- **One screen, the trail.** The pupil's side has no tabs. Top to bottom: the lesson box (what you did well, what to work on, news), the seven days as a winding path with today's session as a card on it, the next lesson as a black box, show-the-teacher, ask-the-teacher (red-edged), tokens, the last four weeks, the road to the goal with its stages, and two buttons: set or change the goal, share the card. A black **Start today** bar is pinned at the bottom so the session is always one tap, wherever you have scrolled
- **The map.** The seven days wind from the last lesson to a black "Next lesson with Melisande" box: a note a day (filled when done, ring on today), a +1 token beside each day and +2 at the end. Below the map, in order: "At the lesson: show Melisande" (the checklist, where the path ends) and "At the lesson: ask Melisande" (the flags, in a red-edged box), then the tokens
- **Stages to the goal are the teacher's, or absent.** The trail shows the weeks to the date as a stave; named stages (Foundations, Pieces, Polish…) appear only if the teacher types them into the pupil's profile. The app does not invent a syllabus
- **The month and the goal.** Today shows one chip with the goal and weeks to go, when there is one. The trail and the teacher's pupil page stack the last five weeks as small staves, most recent first, with the goal date under them. The road on the trail draws the same stave above the stages
- **How it felt: Easy, Fine, Hard.** One axis, three taps. Hard asks one more thing, "which bit?", from the work list; that answer goes to the teacher as a flag for the next lesson. Easy and Fine ask nothing more
- **The planner does not teach.** The only technical content in a session is what the teacher wrote, restated in her words and attributed; where the note says nothing for a step, the caption is about how to practise (slowly, once through, stop), not how to play. The app never claims to hear the pupil; the pupil and the teacher judge
- **This week, from the teacher** on Today shows the work for the week (her "know by next lesson" list) first, then her one line

## Later

- A conductor's side of its own (next to pupil, teacher and parent's view): today a choir or orchestra is a studio in group mode on the teacher's side

## What's in v0.4 (15 September 2026)

- **A named reward.** The teacher writes what six tokens earns ("a hot chocolate after Thursday's lesson"); the pupil sees it on their Journey, and the teacher marks it given
- **The teacher sets the practice time.** Level is a dropdown (beginner, grades 1 to 3, 4 to 6, 7 to 8, returning adult, advanced) and each level suggests minutes a day (20, 25, 40, 60, 25, 75); the teacher can override it per pupil, up to 120. The sessions are written to that length and the pupil's Today screen says who set it
- **The morning message.** On any morning a session is due, the pupil gets one note from the teacher: what they did last time and how they said it felt, what is on today and how long. Never twice a day, nothing once the week is done. Delivered as a phone notification (web push, the app added to the Home Screen) or by email; the pupil chooses under Goal and can send themselves today's message to check it. A daily Vercel cron (`/api/reminders`, 06:30 UTC) does the sending and logs every send against the pupil, so completion within the day can be measured
- Installable: manifest, icons and a service worker, so Stuckato sits on the Home Screen like an app

## What was in v0.2

- Email sign-in (no password); teachers create a studio and get a six-character code; pupils join with it
- **Teacher:** pupils list with this week's progress and flags; per-pupil profile (instrument, level, goal, sessions a week, minutes); lesson note → generated week → preview → publish
- **Pupil:** Today (next session, streak, week dots), a session runner with a progress ring, captions, optional read-aloud (browser speech), pause/skip/stop, and "how did it feel"; Journey (path from lesson to lesson, checklist, flags, tokens); Goal (date, weeks to go, road phases)
- Tokens: one per session, two more for a full week; six is a small reward the teacher marks as given
- **See how it works:** a demo with three pupils and a week already set, switchable between the pupil's side, the teacher's side and the parent's view, no sign-in
- **The teacher's voice:** on first use the teacher reads a thirty-second passage with a consent box ticked; Stuckato clones the voice (ElevenLabs) and every caption in every published week is spoken in it. Only text the teacher has previewed and published is ever spoken; the teacher can re-record or delete the clone at any time, and deleting it removes it from ElevenLabs too. Pupils are told it's generated
- **Dictated notes:** every note field has a Dictate button. Browser speech recognition where it exists (Chrome, Safari), server transcription as the fallback
- **Share card:** the pupil turns their week into an image (sessions, minutes, streak, checklist, the teacher's line) and shares it with a parent or anyone they choose, from their own phone. Nothing is shared unless the pupil sends it; nothing else about them is in it
- Works on this device with no account, so anyone can try the whole loop alone (you play both sides)

Nothing listens to you play. That's the argument, not an omission.

## Accounts, children and consent

Two kinds of account: teacher and pupil. There is no parent login. A young pupil's account is set up and held by a parent with the parent's own email (the onboarding says so, for under-13s), so the adult controls it, and the pupil decides what to share by sending the card. No third role means no extra personal data, no account linking, and nothing a stranger could reach: pupils are visible only to the teacher whose code they joined with. A pupil's document holds a name, an instrument, a level, a goal, the weeks, the flags and the feelings, and nothing else.

## Stack

- `index.html`: the whole app, no build step, one Google Font (Plus Jakarta Sans)
- `api/plan.js`: a Vercel function. Takes the teacher's note, the pupil's profile and last week's tally (or a conductor's rehearsal note and the parts it is for), calls Claude (`claude-opus-5`, structured JSON output, effort `medium`, server-side refusal fallbacks) and returns the week: one session per day with steps, minutes and captions, a work list, a checklist, one line of encouragement
- `api/voice.js`: creates the teacher's cloned voice from the recorded sample (ElevenLabs), or deletes it. Teacher only, verified server-side against Supabase
- `api/speak.js`: turns one caption into audio in the studio's voice and stores it in the `melodigo-audio` bucket under the studio's folder, using the teacher's own session so storage policies apply
- `api/transcribe.js`: spoken notes to text (ElevenLabs Scribe) for browsers without built-in dictation
- `api/reminders.js`: the morning message. GET from the cron (Authorization: Bearer CRON_SECRET) sends to every pupil due; POST from a signed-in pupil sends their own message now. Uses the Supabase service-role key server-side to read every pupil row
- `sw.js`, `manifest.webmanifest`, `icon-192.png`, `icon-512.png`: the installable app and its notifications
- `api/config.js`: public Supabase config for the page, plus which features are configured
- `supabase/schema.sql`: studios, members, one JSON document per pupil that the pupil and their teacher can both read and write, row-level security, the RPCs. Every database object is prefixed `practicigo_` (renamed from `melodigo_` on 16 September 2026 by `supabase/migrate-practicigo.sql`; the audio bucket keeps its id `melodigo-audio` because stored caption and recording URLs embed it).
- `logo.svg` (lockup with slogan), `wordmark.svg`, `mark.svg` (the crotchet), `icon-tile.svg`: outlines, no font needed

## Deploying

Vercel serves `index.html` as static and `api/*` as Node functions. Environment variables:

| Name | Required | What |
|---|---|---|
| `ANTHROPIC_API_KEY` | yes | Writes the weeks |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | for accounts | Project Settings → API. The anon key is public by design |
| `ELEVENLABS_API_KEY` | for the voice | Voice cloning, spoken captions, and transcription fallback |
| `SUPABASE_SERVICE_ROLE_KEY` | for the morning message | Server-only; lets the cron read every pupil. Never sent to the page |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | for notifications | Generate once with `npx web-push generate-vapid-keys` |
| `CRON_SECRET` | for the cron | Vercel sends it as the bearer token on the scheduled call |
| `RESEND_API_KEY`, `REMINDER_FROM` | for email messages | Resend account with a verified domain; falls back to push only when unset |

Supabase: run `supabase/schema.sql` in the SQL editor once; under Authentication → URL Configuration add the live URL to Redirect URLs. The built-in email sender is rate-limited, so add custom SMTP (Resend) before a real cohort.

## Running locally

Open `index.html` in a browser and choose "Try it on this device". Accounts and the generated weeks need the deployed functions; the file version writes a plain placeholder week so the loop can still be walked through.

## Roadmap

1. Pilot with twenty pupils and one ensemble; measure who is still practising in week four
2. Record a clip at the end of a session and send it to the teacher, unscored
3. Custom SMTP for sign-in emails; a daily cap on generation per studio; the morning message as a voice note in the teacher's voice, and over WhatsApp
4. Piano and singing programmes; returning-adult track; sectionals (one note per part) for larger ensembles
5. Studio and ensemble licences for schools, youth orchestras, choirs and music hubs

## The name

*Stuckato* (from 17 September 2026; Stuckato, Melodigo, Sostenuto and Rosin before that): *stuck* and *staccato*. Practice in short, detached bursts, short bursts, real progress, so nobody stays stuck between lessons. Database objects keep the `practicigo_` prefix from the previous name; renaming them would need another migration and gains nothing.

## Founders

Melisande Yavuz (Royal Academy of Music Fellow, violinist and teacher) and Emre Yavuz (PhD computational neuroscience, UCL). September 2026.
