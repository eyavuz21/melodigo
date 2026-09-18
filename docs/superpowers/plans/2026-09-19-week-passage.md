# The Week's Passage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The teacher records a short passage for the week; the pupil records it daily; Stuckato aligns the two, points at the spots that differ, and the teacher judges.

**Architecture:** A new plain script `passage.js` holds all the signal work (pitch track, notes, alignment, comparison) as pure functions with no DOM, exported to `window.Passage` in the page and `module.exports` under Node so it is unit-tested. `index.html` gains a teacher section, a pupil card, parent-card and CSV lines, and demo data, following the play-through code's patterns (MediaRecorder helpers, `uploadRecording`, `saveCurrent`). README and deck are updated last.

**Tech Stack:** Vanilla JS in one page, Web Audio for decoding, MediaRecorder, Supabase storage (existing bucket), Node 22 `node --test`, Playwright MCP for the browser pass, Python `build_deck.py` + headless Chrome for the deck.

**Spec:** `docs/superpowers/specs/2026-09-19-week-passage-design.md`

## Global Constraints

- Copy: "Stuckato thinks", "have a listen"; never "wrong" or "correct" in pupil-facing text. Attribute the reference to the teacher by name.
- No em-dashes anywhere in copy.
- Database objects and the bucket keep their `practicigo_` / `melodigo-audio` names.
- Tokens are unchanged: no token for a take.
- Beige on black only; use existing classes (`.card`, `.label`, `.note`, `.daybox`, `.btn`, `.chip`, `.row`).
- Teacher clip ≤ 60 s, pupil take ≤ 30 s.
- Work on branch `passage`; production untouched.

---

### Task 1: Analysis module, pure functions

**Files:**
- Create: `passage.js`
- Test: `test/passage.test.js`
- Modify: `package.json` (add `"scripts": {"test": "node --test test/"}`)

**Interfaces (Produces):**
```
Passage.resample(Float32Array samples, fromRate, toRate) -> Float32Array
Passage.pitchTrack(Float32Array samples, sampleRate, {win=0.1, hop=0.02, fmin=60, fmax=1600}) -> [{t, f, clarity, rms}]
Passage.notesFrom(frames, {minClarity=0.9, minDur=0.08, rmsFloor}) -> [{m, t, d, cents}]
Passage.align(refMidi:number[], takeMidi:number[]) -> [{kind:'match'|'wrong'|'missing'|'extra', r:number|null, p:number|null}]
Passage.compare(refNotes, takeNotes) -> {total, matched, wrong, missing, extra, spots:[{t, te, tp, kind, expect, got, cents}]}
Passage.noteName(midi:number) -> 'F#4'
Passage.fmtT(seconds) -> '0:04'
Passage.synthNotes([{m, d}], sampleRate) -> Float32Array   (test helper: sine + 2 harmonics with a short fade; also used by the browser test)
```

- [ ] Step 1: Write `test/passage.test.js` with: `noteName(69)==='A4'`, `noteName(66)==='F#4'`; synth `[62,64,66,67]` at 16 kHz, 0.4 s each → `notesFrom(pitchTrack(...))` maps to `[62,64,66,67]`; a low cello note `[36]` (C2) is tracked; `align([1,2,3,4],[1,9,3,4])` gives one `wrong` at r=1; `align([1,2,3,4],[1,3,4])` one `missing`; `align([1,2,3],[1,2,7,3])` one `extra`; `compare` on synthesised ref `[62,64,66,67,69,67,66,64]` vs take with note 3 changed and note 6 dropped → `wrong===1, missing===1, matched===6`, two spots, `expect==='F#4'`; adjacent differences (two consecutive wrong notes) merge into one spot; `compare([],[])` returns zeros and `[]`.
- [ ] Step 2: Run `node --test test/` → fails (module missing).
- [ ] Step 3: Implement `passage.js`: resample (linear), NSDF pitch (McLeod: r'(τ) = 2·acf(τ)/(m(τ)), pick the first key maximum above 0.85·max, parabolic interpolation), notesFrom (median-5 smoothing, round to MIDI, merge runs, bridge ≤2 unvoiced frames, drop < minDur), align (NW, match 0 / sub 1 / gap 1, traceback preferring match on ties), compare (spots merged within 1 s in the teacher's clip; `cents` = mean of matched frames' offset), noteName, fmtT, synthNotes. UMD-style export.
- [ ] Step 4: `node --test test/` → all pass.
- [ ] Step 5: Commit `Passage analysis: pitch track, notes, alignment, comparison (unit-tested)`.

### Task 2: Browser glue, playback helpers, storage

**Files:**
- Modify: `index.html` (load `passage.js` before the main script; add helpers next to `uploadRecording`)

**Interfaces (Produces):**
```
async analyseBlob(blob) -> {notes, seconds}   // decode → mono → 16 kHz → Passage.pitchTrack → Passage.notesFrom; throws Error('Could not read the recording') on decode failure
async uploadAudio(blob, path) -> {url} | {data} | {}   // generalises uploadRecording; uploadRecording(blob,w) calls it
playSpan(audioEl, from, to, times=1)
slowPlay(audioEl, on)   // playbackRate 0.6 with preservesPitch/webkitPreservesPitch
takeDayIndex(w) -> number   // today's done day if any, else last done day, else nextIndex or 0
takesOff(w) -> [{i, off}]   // off = wrong+missing+extra per take, sorted by i
stillDiffersLine(w, tn) -> string|''  // "The passage: still differs at 0:04 and 0:11 on Thursday's take."
```

- [ ] Step 1: Add `<script src="passage.js?v=1"></script>` before the main `<script>`.
- [ ] Step 2: Write the helpers. `analyseBlob`: `new (window.AudioContext||window.webkitAudioContext)()`, `decodeAudioData(await blob.arrayBuffer())`, average channels, `Passage.resample(mono, buf.sampleRate, 16000)`, then track/notes; close the context.
- [ ] Step 3: Refactor `uploadRecording` to call `uploadAudio(blob, path)`; behaviour unchanged.
- [ ] Step 4: Commit `Passage: browser analysis and playback helpers`.

### Task 3: Teacher side

**Files:**
- Modify: `index.html` `renderTStudent` (after the play-through block), plus wiring at the end of `renderTStudent`.

- [ ] Step 1: Add the section HTML: `passageTeacherHTML(w, d, p)` returning the no-passage form or the passage + takes block as in the spec (label input `#pgLabel`, buttons `#pgRec`, `#pgPlay`, `#pgSave`, status `#pgStatus`, `<audio id="pgAudio">`; takes with `data-hear="ref|take" data-t data-te data-k`, `#pgHeard-<k>`, `#pgAsk-<k>`; trend row via `takesOff`). Piano/guitar/harp note when `/(piano|guitar|harp|keyboard)/i.test(p.instrument)`.
- [ ] Step 2: `wirePassageTeacher(w, d, p)`: record/stop with a 60 s cap (`recordStart`/`recordStop`), on stop `analyseBlob` → status "N notes heard" or "Too few notes heard (under four). Try again nearer the phone." (no save); Save → `uploadAudio(blob, \`${me.studio_id}/passages/${current.user_id}/${w.id||w.createdAt}.${ext}\`)` → `w.passage={id:uid(), at, by:me?.name||'', seconds, mime, label, notes, v:1, ...up}`; Record again with a passage present → `confirm('Recording again clears this week\'s takes. Go on?')` then `w.takes=[]`. Heard → `take.heard=true, heardAt`. Ask → prompt → extras `About the passage (day N): …`, `take.ask=true`. Hear buttons → `playSpan`.
- [ ] Step 3: Flagged box: append `stillDiffersLine(w, p.name)` as a `.flag` row when non-empty.
- [ ] Step 4: Commit `Passage: teacher records the week's passage, sees takes and spots`.

### Task 4: Pupil side

**Files:**
- Modify: `index.html` `renderTrail` (card after `todayCard`), Done screen markup (`#v-done`, a quiet button `#donePassage`), `showDone`.

- [ ] Step 1: `passagePupilHTML(w, tn)` → card `#pgCard` with label, `#ppPlay`, `#ppSlow`, `#ppRec`, status `#ppStatus`, result area `#ppResult`, trend row, note "Stuckato hears roughly. ${tn} decides." Absent when `!w.passage`.
- [ ] Step 2: `wirePassagePupil(w, tn)`: record with a 30 s cap; on stop `analyseBlob` → `Passage.compare(w.passage.notes, notes)` → result HTML: "Stuckato thinks ${matched} of ${total} notes matched ${tn}'s." + spots as chips (`data-spot=k`), each expanding to a row with Hers / Loop hers / Mine buttons (`playSpan` on `#pgAudio`/`#ppMine`), + Send / Record again. Send → `uploadAudio(blob, \`${me.studio_id}/passages/${sbUser.id}/${w.id||w.createdAt}-d${i}.${ext}\`)` (cloud) → replace or push `w.takes` entry `{i, at, seconds, mime, notes, diff, ...up}` → `saveCurrent()` → `renderTrail(false)` → toast "Sent to ${tn}.".
- [ ] Step 3: "At the lesson: ask" box: prepend `stillDiffersLine(w, tn)` as a `.flag` row (no remove button) when non-empty.
- [ ] Step 4: Done screen: `#donePassage` hidden unless `week().passage`; onclick → `renderJourney(true)` then scroll `#pgCard` into view.
- [ ] Step 5: Commit `Passage: pupil records the passage, hears the spots, sends the take`.

### Task 5: Parent card, CSV, demo

**Files:**
- Modify: `index.html` `drawCard` (box 2), `METRICS` + `downloadCSV`, `demoSeed`.

- [ ] Step 1: `drawCard`: when `(w.takes||[]).length`, box 2 height 310 (was 270), a line at `y+280` in `F(600,22)` `#B3A48C`: "The passage: 23 of 24 notes matched Melisande's on Thu" + (2+ takes) ", up from 20 on Mon." Shift `top` by 40 accordingly (`top` is a const 490 → compute `top=490+(takes?40:0)`).
- [ ] Step 2: `METRICS` gets `passage_first_off` ("Notes that differed from the teacher's passage on the pupil's first take of the week: wrong, missing and extra added. Blank if no take.") and `passage_last_off`; `downloadCSV` writes them per week.
- [ ] Step 3: `demoSeed`: Emre's current week gets `passage:{id, at:addDays(today(),-3)+'T17:30:00Z', by:'Melisande', seconds:14, label:'Twinkle variation A, first phrase', notes:<16 notes D D A A B B A G G F# F# E E D>, v:1}` (no audio) and `takes:[{i:0,...diff with 4 off},{i:1,...diff with 2 off}]` built by calling `Passage.compare` on note lists at seed time.
- [ ] Step 4: Commit `Passage: parent card line, pilot CSV columns, demo data`.

### Task 6: Browser verification

- [ ] Step 1: `python3 -m http.server 8771` in `app/`; Playwright: open `/?demo=pupil` → `#pgCard` present, trend row shows `4` and `2`, spot chips present; `/?demo=teacher` → open Emre → passage section with two takes and "still differs" line; share view draws without console errors.
- [ ] Step 2: In-page test via `browser_evaluate`: render a WAV with `Passage.synthNotes([62,64,66,67].map(m=>({m,d:0.4})),16000)` into a Blob (write a tiny WAV encoder inline in the evaluate) → `analyseBlob` → notes `[62,64,66,67]`.
- [ ] Step 3: Screenshots of pupil card and teacher section for the morning report (`deck/shots/shot-passage.png` at 480×860 @2x with `?demo=pupil&clean=1`).

### Task 7: README and deck

**Files:**
- Modify: `README.md` ("The idea", new "What's in v0.8", principle line, storage note)
- Modify: `../deck/build_deck.py` (slide 2 line, slide 3 "Nothing listens", new "Why not Yousician" slide), rebuild PDFs.

- [ ] Step 1: README edits per spec.
- [ ] Step 2: Deck edits; run `python3 build_deck.py`; check page count 6.
- [ ] Step 3: Commit app README; deck folder is outside the repo (no commit).

### Task 8: Branch, push, preview

- [ ] `git push -u origin passage`; `npx vercel --yes` (preview, not `--prod`) → URL for the morning report.
