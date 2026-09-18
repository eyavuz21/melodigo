// Unit tests for passage.js: the pure signal and alignment functions behind "the week's passage".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../passage.js';
const P = globalThis.Passage;

const SR = 16000;
const seq = (midis, d = 0.4) => midis.map(m => ({ m, d }));
const notesOf = (midis, d) => P.notesFrom(P.pitchTrack(P.synthNotes(seq(midis, d), SR), SR));

test('noteName', () => {
  assert.equal(P.noteName(69), 'A4');
  assert.equal(P.noteName(66), 'F#4');
  assert.equal(P.noteName(36), 'C2');
});

test('fmtT', () => {
  assert.equal(P.fmtT(4.2), '0:04');
  assert.equal(P.fmtT(71), '1:11');
});

test('pitch track + notes on a synthesised D major fragment', () => {
  const n = notesOf([62, 64, 66, 67]);
  assert.deepEqual(n.map(x => x.m), [62, 64, 66, 67]);
  assert.ok(Math.abs(n[1].t - 0.4) < 0.06, 'second note starts near 0.4 s, got ' + n[1].t);
  assert.ok(n[0].d > 0.25, 'first note lasts most of 0.4 s');
});

test('a low cello C2 is tracked', () => {
  const n = notesOf([36, 43], 0.6);
  assert.deepEqual(n.map(x => x.m), [36, 43]);
});

test('a high violin note is tracked', () => {
  const n = notesOf([88, 86], 0.4); // E6, D6
  assert.deepEqual(n.map(x => x.m), [88, 86]);
});

test('repeated notes with a gap between them stay separate', () => {
  const s = P.synthNotes([{ m: 62, d: 0.4 }, { m: 0, d: 0.12 }, { m: 62, d: 0.4 }], SR); // m 0 = silence
  const n = P.notesFrom(P.pitchTrack(s, SR));
  assert.deepEqual(n.map(x => x.m), [62, 62]);
});

test('align: substitution, deletion, insertion', () => {
  const kinds = ops => ops.map(o => o.kind);
  assert.deepEqual(kinds(P.align([1, 2, 3, 4], [1, 9, 3, 4])), ['match', 'wrong', 'match', 'match']);
  const del = P.align([1, 2, 3, 4], [1, 3, 4]);
  assert.deepEqual(kinds(del), ['match', 'missing', 'match', 'match']);
  assert.equal(del[1].r, 1);
  const ins = P.align([1, 2, 3], [1, 2, 7, 3]);
  assert.deepEqual(kinds(ins), ['match', 'match', 'extra', 'match']);
  assert.equal(ins[2].p, 2);
});

test('compare: one wrong note and one missing note give two spots', () => {
  const ref = notesOf([62, 64, 66, 67, 69, 67, 66, 64]);
  const take = notesOf([62, 64, 65, 67, 69, 66, 64]); // F# -> F, second F# dropped
  const c = P.compare(ref, take);
  assert.equal(c.total, 8);
  assert.equal(c.wrong, 1);
  assert.equal(c.missing, 1);
  assert.equal(c.extra, 0);
  assert.equal(c.matched, 6);
  assert.equal(c.spots.length, 2);
  assert.equal(c.spots[0].kind, 'wrong');
  assert.equal(c.spots[0].expect, 'F#4');
  assert.equal(c.spots[0].got, 'F4');
  assert.ok(Math.abs(c.spots[0].t - 0.8) < 0.08, 'spot at the third note, got ' + c.spots[0].t);
  assert.equal(c.spots[1].kind, 'missing');
});

test('compare: adjacent differences merge into one spot', () => {
  const ref = notesOf([62, 64, 66, 67, 69]);
  const take = notesOf([62, 63, 65, 67, 69]);
  const c = P.compare(ref, take);
  assert.equal(c.wrong, 2);
  assert.equal(c.spots.length, 1);
});

test('compare: a perfect take has no spots', () => {
  const ref = notesOf([62, 64, 66, 67]);
  const c = P.compare(ref, notesOf([62, 64, 66, 67]));
  assert.equal(c.matched, 4);
  assert.equal(c.spots.length, 0);
});

test('compare: empty inputs do not throw', () => {
  const c = P.compare([], []);
  assert.deepEqual([c.total, c.matched, c.wrong, c.missing, c.extra], [0, 0, 0, 0, 0]);
  assert.deepEqual(c.spots, []);
  const c2 = P.compare(notesOf([62, 64]), []);
  assert.equal(c2.missing, 2);
});

test('a noisy, slightly flat take still aligns to the reference', () => {
  const midis = [62, 64, 66, 67, 69, 67, 66, 64];
  const ref = notesOf(midis);
  // the take: 20 cents flat, with noise at about -20 dB
  const notes = midis.map(m => ({ m: m - 0.2, d: 0.4 }));
  const x = P.synthNotes(notes, SR);
  let seed = 7; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff - 0.5; };
  for (let i = 0; i < x.length; i++) x[i] += 0.03 * rnd();
  const take = P.notesFrom(P.pitchTrack(x, SR));
  assert.deepEqual(take.map(n => n.m), midis);
  const c = P.compare(ref, take);
  assert.equal(c.matched, 8);
  assert.ok(c.cents < -10 && c.cents > -30, 'reports roughly 20 cents flat, got ' + c.cents);
});

test('thirty seconds of audio analyses in a few seconds', () => {
  const midis = []; for (let i = 0; i < 75; i++) midis.push(60 + (i % 12));
  const x = P.synthNotes(seq(midis, 0.4), SR); // 30 s
  const t0 = Date.now(); const n = P.notesFrom(P.pitchTrack(x, SR)); const ms = Date.now() - t0;
  assert.equal(n.length, 75);
  assert.ok(ms < 6000, 'took ' + ms + ' ms');
});
