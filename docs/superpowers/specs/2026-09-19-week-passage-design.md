# The week's passage: design

19 September 2026. Approved in conversation by Emre (shape: "the week's passage, recorded by the teacher, practised daily, compared, triaged, looped, reported"; explicitly no video and no photo of the score). Written while he slept; where a call had to be made it is marked *assumption*.

## What it is

The teacher records the few bars that matter this week (up to 60 seconds). The pupil records the same bars after a session, any day, thirty seconds. Stuckato lines the two up and says where they differ: "Stuckato thinks 21 of 24 notes matched Melisande's. Have a listen at 0:04 and 0:11." The pupil can hear her bar and theirs at that spot, loop hers, and play the whole passage slowed down. The teacher sees every day's take on the pupil page with the same spots, hears the twenty seconds that matter instead of the whole play-through, and judges. The week's trend (Monday four notes off, Thursday one) is the number that goes to the parent card and the pilot export.

The principle stays: **the app points, the humans judge.** Wording is always "Stuckato thinks", "have a listen", never "wrong". The reference is the teacher's playing, not a score.

## Scope

In: teacher recording of a passage per week; pupil takes per day; on-device pitch analysis; alignment and spots; playback of spots and slowed playback; teacher triage (heard, ask); trend on trail, pupil page and parent card; "still differs" line in the lesson boxes; demo seed; README and deck positioning.

Out (explicitly): video, photo of the score, MusicXML import, rhythm verdicts, intonation in cents as a verdict (measured, shown only as a hint in the spot detail), polyphonic instruments (piano and guitar chords will produce noisy results; the UI says so when the profile instrument is piano, guitar or harp), tokens for takes (tokens still come with the sentence only), real-time feedback while playing.

## Data (inside the pupil's JSON document, like everything else)

```
week.passage = { id, at, by, seconds, mime, url | data, label, notes:[{m,t,d}], v:1 }
week.takes   = [ { i, at, seconds, mime, url | data, notes:[{m,t,d}], diff, heard, heardAt, ask } ]
diff = { total, matched, wrong, missing, extra, spots:[{t, te, tp, kind, expect, got, cents}] }
```

- `notes`: the analysed note list. `m` MIDI number, `t` start in seconds, `d` duration. Analysed on the device that recorded it, so the other side never needs the audio to draw the comparison.
- `takes[].i`: day index (0-based, like `done[].i`). One take per day; recording again the same day replaces it.
- `spots`: places in the teacher's clip to listen to. `t`/`te` seconds in the teacher's clip, `tp` in the pupil's. `kind` is `wrong`, `missing` or `extra`; `expect`/`got` note names ("F#4"). Consecutive differences within one second merge into one spot.
- Replacing the passage clears `takes` (the diffs were against the old one); the teacher is warned.
- Audio storage mirrors the play-through: `melodigo-audio/<studio>/passages/<pupil>/<week>.<ext>` for the teacher's clip, `…/<week>-d<i>.<ext>` for takes; a data URL on the device when there is no cloud (under 1.2 MB). The existing bucket policy allows it (first folder = the member's studio).

## Analysis (`passage.js`, a plain script; `window.Passage` in the page, `module.exports` under Node so it is unit-tested)

1. **Decode**: `AudioContext.decodeAudioData`, mix to mono, resample to 16 kHz (linear).
2. **Pitch track**: McLeod pitch method (normalised square difference, first peak above 0.85 of the maximum, parabolic interpolation), window 100 ms, hop 20 ms, 60 Hz to 1600 Hz. Output frames `{t, f, clarity}`.
3. **Notes**: frames with clarity ≥ 0.9 (and RMS above a floor) to MIDI (fractional); median over five frames; runs of the same rounded MIDI merge into a note; notes under 80 ms dropped; runs broken by ≤ 2 unvoiced frames are joined.
4. **Align**: Needleman-Wunsch over MIDI numbers (match 0, substitution 1, gap 1; ties prefer match) with traceback, giving ops `match | wrong | missing | extra`.
5. **Compare**: counts, spots merged, `cents` for matched notes (mean pitch difference, shown only in the spot detail as "a little low/high", never as a count).

Speed: 30 s of audio is about 1500 frames × 1600 × 260 lags ≈ 0.6 G multiply-adds, one to two seconds on a phone. Analysis runs after the recording stops, with "Listening…" shown.

Known limits, written in the UI note: phone mics, vibrato, open-string ring and double stops cause the odd false spot; chords are not handled. This is why the app never says "wrong".

## Screens

**Teacher, pupil page, "This week" card, after the play-through section: "The week's passage".**
No passage yet: one line of what it is, a label field ("Bars 9 to 16 of the Twinkle"), *Record*, "Up to a minute. Phone on the stand, play it once the way you want it." After stopping: "Listening…" then "24 notes heard" (or "Too few notes heard, try again nearer the phone"), *Listen back*, *Save to the week*, *Record again*.
With a passage: label, player, "24 notes · recorded Tue", *Record again* (warns it clears the takes). Then **Takes**: a row of the week's days with notes-off per day (`M 4 · T 3 · W · T 1`), then each take newest first: "Day 4 · Thu 18:12 · 23 of 24 matched" with spots, each with *Hers 0:04* and *Theirs 0:03* play buttons; *Heard it*; *Ask them* (prompt → extras, as for the sentence). If the profile instrument is piano, guitar or harp: a note that chords are not handled and spots will be rough.

**Pupil, trail, a card after the Today card: "The week's passage · from Melisande".**
Label, *Play*, *Play slowly* (0.6×, pitch kept; `audio.preservesPitch`), *Record mine · 30 s*. After recording: "Listening…" then "Stuckato thinks 21 of 24 notes matched Melisande's. Have a listen at 0:04 and 0:11." Spots as chips: each opens a row with *Hers*, *Loop hers* (three times), *Mine*. *Send to Melisande* saves the take (day = today's session day, or the last done day, or day 0), *Record again* discards. Trend row (`M 4 · T 3 · W · T 1`). One note: "Stuckato hears roughly. Melisande decides."
No passage: the card is absent.
Done screen: one quiet button under "Done for today": "Record the week's passage" (only when a passage exists; goes to the trail card).

**Lesson boxes.** On the trail's "At the lesson: ask" and the teacher's flagged box, a computed line (not stored) when the latest take has spots: "The passage: still differs at 0:04 and 0:11 on Thursday's take."

**Parent card.** Under the big line in box 2, when there is at least one take: "The passage: 23 of 24 notes matched Melisande's on Thursday" and, with two or more takes, "up from 20 on Monday." Box 2 grows by 40 px.

**Pilot export.** Two columns: `passage_first_off`, `passage_last_off` (notes off on the first and last take of the week; blank if none), with definitions in `METRICS`.

**Pinned bar** unchanged.

## Playback helpers

`playSpan(audioEl, from, to, times)`: seeks to `from - 0.3`, plays, stops at `to + 0.3` via `timeupdate`, repeats `times`. Slowed play: `playbackRate = 0.6`, `preservesPitch = true` (`webkitPreservesPitch` for older Safari).

## Demo

Emre's current week gets a passage (label "Twinkle variation A, first phrase", 16 notes, no audio) and takes for days 0 and 1 (4 and 2 notes off). Buttons that need audio are hidden when there is none. Aisha unchanged.

## Errors

Microphone refused: the status line says so, nothing else changes. Fewer than four notes heard: "Too few notes heard" and no take is saved. Upload failure: the take stays on the device (data URL if small) and the status says "Could not send"; Send can be retried. Decoding failure (odd codec): "Could not read the recording, try again."

## Testing

Node (`node --test`): synthesised tone sequences (sine plus two harmonics, 16 kHz) → `notesFrom` returns the right MIDI sequence; a sequence with one substitution, one dropped and one added note → `compare` reports 1 wrong, 1 missing, 1 extra with the right spots; adjacent differences merge; empty inputs do not throw.
Browser (Playwright on a local server, demo mode): teacher page shows the passage section and takes; trail shows the card, chips and trend; parent card draws; `analyseBlob` on a WAV rendered in-page by `OfflineAudioContext` returns the synthesised notes.
Not testable here: a real instrument through a phone mic. Emre tries it with the cello in the morning on the preview deployment.

## Positioning (README and deck)

README "The idea" gains the Yousician paragraph ("Yousician is for people without a teacher. Stuckato is for the six days between lessons, run by the teacher."), a v0.8 section, and the principle sentence becomes: the app never claims to judge the pupil; it points at bars that differ from the teacher's playing, and the pupil and teacher judge. The deck: slide 2's "Every practice app listens to you play and scores the notes" line and slide 3's "Nothing listens to you play" are reworded, and a new slide "Why not Yousician" (two columns) goes between the product and the money.

## Assumptions made without Emre

1. No tokens for takes. 2. Teacher's clip limit 60 s, pupil's 30 s. 3. Replacing the passage clears takes. 4. Spots by time in the teacher's clip, not bar numbers (no score, so no bars). 5. Ships on a branch with a Vercel preview, not to production.
