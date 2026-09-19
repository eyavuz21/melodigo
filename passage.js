// Stuckato: the week's passage. Pure signal and alignment functions, no DOM.
// The teacher's clip and the pupil's take are each turned into a note list on the device that recorded them;
// the two lists are aligned and the differences become "spots" to listen to. Stuckato points; the people judge.
// Loaded as a plain script in the page (window.Passage) and imported under Node (globalThis.Passage) for the unit tests.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.Passage = factory();
})(typeof globalThis !== 'undefined' ? globalThis : self, function () {
  'use strict';
  const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const noteName = m => NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
  const fmtT = s => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const midiOf = f => 69 + 12 * Math.log2(f / 440);
  const freqOf = m => 440 * Math.pow(2, (m - 69) / 12);

  // Linear resampling; good enough for pitch tracking (we only need the fundamental and a couple of harmonics).
  function resample(x, from, to) {
    if (from === to) return x;
    const n = Math.floor(x.length * to / from); const out = new Float32Array(n); const r = from / to;
    for (let i = 0; i < n; i++) { const p = i * r; const k = Math.floor(p); const a = p - k; out[i] = (x[k] || 0) * (1 - a) + (x[k + 1] || 0) * a; }
    return out;
  }

  // McLeod pitch method: normalised square difference per lag, first key maximum above k times the biggest, parabolic peak.
  function pitchTrack(x, sr, o) {
    o = o || {}; const W = Math.round((o.win || 0.06) * sr), H = Math.round((o.hop || 0.02) * sr);
    const minLag = Math.max(2, Math.floor(sr / (o.fmax || 1600))), maxLag = Math.min(W - 2, Math.ceil(sr / (o.fmin || 60)));
    const k = o.k || 0.9; const frames = [];
    const nsdf = new Float64Array(maxLag + 1);
    for (let s = 0; s + W <= x.length; s += H) {
      let e = 0; for (let j = 0; j < W; j++) e += x[s + j] * x[s + j];
      const rms = Math.sqrt(e / W);
      if (rms < 1e-5) { frames.push({ t: s / sr, f: 0, clarity: 0, rms }); continue; }
      // m(tau) = sum_{j<W-tau} x[j]^2 + x[j+tau]^2, from prefix sums of squares
      const pre = new Float64Array(W + 1); for (let j = 0; j < W; j++) pre[j + 1] = pre[j] + x[s + j] * x[s + j];
      let best = 0;
      for (let tau = 1; tau <= maxLag; tau++) {
        let acf = 0; const n = W - tau; for (let j = 0; j < n; j++) acf += x[s + j] * x[s + j + tau];
        const m = pre[n] + (pre[W] - pre[tau]); nsdf[tau] = m > 0 ? 2 * acf / m : 0;
      }
      // key maxima: the highest point between each positive-going zero crossing and the next negative-going one,
      // after the lobe around lag zero; only lags in range count
      const peaks = []; let tau = 1; while (tau <= maxLag && nsdf[tau] > 0) tau++;
      while (tau <= maxLag) {
        while (tau <= maxLag && nsdf[tau] <= 0) tau++;
        let bi = -1, bv = -Infinity; while (tau <= maxLag && nsdf[tau] > 0) { if (nsdf[tau] > bv) { bv = nsdf[tau]; bi = tau; } tau++; }
        if (bi >= minLag) { peaks.push([bi, bv]); if (bv > best) best = bv; }
      }
      let pick = null; for (const p of peaks) { if (p[1] >= k * best) { pick = p; break; } }
      if (!pick || pick[1] < 0.3) { frames.push({ t: s / sr, f: 0, clarity: pick ? pick[1] : 0, rms }); continue; }
      let [bi, bv] = pick; let lag = bi;
      if (bi > 1 && bi < maxLag) { const a = nsdf[bi - 1], b = nsdf[bi], c = nsdf[bi + 1]; const den = a - 2 * b + c; if (den < 0) { const d = 0.5 * (a - c) / den; lag = bi + d; bv = b - 0.25 * (a - c) * d; } }
      frames.push({ t: s / sr, f: sr / lag, clarity: Math.min(1, bv), rms });
    }
    return frames;
  }

  // Frames to notes: voiced frames (clear, loud enough) to fractional MIDI, median-smoothed, runs of one pitch merged,
  // split again where the loudness dips and recovers on the same pitch (a repeated note).
  function notesFrom(frames, o) {
    o = o || {}; const minC = o.minClarity == null ? 0.9 : o.minClarity, minDur = o.minDur == null ? 0.08 : o.minDur, bridge = o.bridge == null ? 2 : o.bridge;
    if (!frames.length) return [];
    let maxRms = 0; for (const f of frames) if (f.rms > maxRms) maxRms = f.rms;
    const floor = o.rmsFloor == null ? Math.max(0.002, 0.05 * maxRms) : o.rmsFloor;
    const hop = frames.length > 1 ? frames[1].t - frames[0].t : 0.02;
    const mf = frames.map(f => (f.f > 0 && f.clarity >= minC && f.rms >= floor) ? midiOf(f.f) : null);
    // median of five over voiced neighbours
    const sm = mf.map((v, i) => { if (v == null) return null; const w = []; for (let j = i - 2; j <= i + 2; j++) if (mf[j] != null) w.push(mf[j]); w.sort((a, b) => a - b); return w[Math.floor(w.length / 2)]; });
    const notes = []; let cur = null, gap = 0, peak = 0; const dip = o.dip == null ? 0.6 : o.dip;
    const close = () => { if (cur) { cur.d = cur.end - cur.t; cur.cents = Math.round(100 * (cur.sum / cur.n - cur.m)); delete cur.sum; delete cur.n; delete cur.end; if (cur.d >= minDur) notes.push(cur); } cur = null; };
    for (let i = 0; i < sm.length; i++) {
      const v = sm[i], t = frames[i].t, r = frames[i].rms;
      if (v == null) { if (cur && ++gap > bridge) close(); continue; }
      gap = 0; const m = Math.round(v);
      // a repeated note: the same pitch again after the loudness dips and comes back (a bow change, a re-struck key, tonguing)
      const valley = cur && cur.m === m && r < dip * peak && i + 1 < sm.length && frames[i + 1].rms > r;
      if (cur && cur.m === m && !valley) { cur.end = t + hop; cur.sum += v; cur.n++; if (r > peak) peak = r; }
      else { close(); cur = { m, t, end: t + hop, sum: v, n: 1 }; peak = r; }
    }
    close();
    return notes;
  }

  // Needleman-Wunsch over MIDI numbers: match 0, substitution 1, gap 1; ties prefer the diagonal.
  function align(ref, take) {
    const R = ref.length, T = take.length; const W = T + 1; const dp = new Int32Array((R + 1) * W);
    for (let i = 1; i <= R; i++) dp[i * W] = i; for (let j = 1; j <= T; j++) dp[j] = j;
    for (let i = 1; i <= R; i++) for (let j = 1; j <= T; j++) {
      const d = dp[(i - 1) * W + j - 1] + (ref[i - 1] === take[j - 1] ? 0 : 1);
      dp[i * W + j] = Math.min(d, dp[(i - 1) * W + j] + 1, dp[i * W + j - 1] + 1);
    }
    const ops = []; let i = R, j = T;
    while (i > 0 || j > 0) {
      const here = dp[i * W + j];
      if (i > 0 && j > 0 && here === dp[(i - 1) * W + j - 1] + (ref[i - 1] === take[j - 1] ? 0 : 1)) { ops.push({ kind: ref[i - 1] === take[j - 1] ? 'match' : 'wrong', r: i - 1, p: j - 1 }); i--; j--; }
      else if (i > 0 && here === dp[(i - 1) * W + j] + 1) { ops.push({ kind: 'missing', r: i - 1, p: null }); i--; }
      else { ops.push({ kind: 'extra', r: null, p: j - 1 }); j--; }
    }
    return ops.reverse();
  }

  // Compare two note lists. Spots are places in the teacher's clip; consecutive differences merge into one spot.
  function compare(ref, take) {
    ref = ref || []; take = take || [];
    const ops = align(ref.map(n => n.m), take.map(n => n.m));
    const out = { total: ref.length, matched: 0, wrong: 0, missing: 0, extra: 0, spots: [], cents: 0 };
    let cSum = 0, cN = 0, lastRefEnd = 0, lastTakeEnd = 0, sinceDiff = 1; const spots = []; // sinceDiff: matched notes since the last difference
    for (const op of ops) {
      const rn = op.r != null ? ref[op.r] : null, pn = op.p != null ? take[op.p] : null;
      if (op.kind === 'match') { out.matched++; sinceDiff++; cSum += (pn.cents || 0) - (rn.cents || 0); cN++; lastRefEnd = rn.t + rn.d; lastTakeEnd = pn.t + pn.d; continue; }
      out[op.kind]++;
      const t = rn ? rn.t : lastRefEnd, te = rn ? rn.t + rn.d : lastRefEnd, tp = pn ? pn.t : lastTakeEnd;
      const last = spots[spots.length - 1];
      if (last && sinceDiff === 0) { last.te = Math.max(last.te, te); last.n++; if (rn && !last.expect) last.expect = noteName(rn.m); }
      else spots.push({ t, te, tp, kind: op.kind, expect: rn ? noteName(rn.m) : '', got: pn ? noteName(pn.m) : '', n: 1 });
      sinceDiff = 0;
      if (rn) lastRefEnd = rn.t + rn.d; if (pn) lastTakeEnd = pn.t + pn.d;
    }
    out.spots = spots; out.cents = cN ? Math.round(cSum / cN) : 0;
    return out;
  }

  // Test helper (also used by the in-browser check): a tone with two harmonics per note, m = 0 for silence.
  function synthNotes(notes, sr) {
    const total = Math.round(notes.reduce((a, n) => a + n.d, 0) * sr); const out = new Float32Array(total); let p = 0;
    for (const n of notes) {
      const len = Math.round(n.d * sr); const fade = Math.min(Math.round(0.01 * sr), len >> 1);
      if (n.m > 0) { const f = freqOf(n.m); for (let i = 0; i < len; i++) { const t = i / sr; let env = 1; if (i < fade) env = i / fade; else if (i > len - fade) env = (len - i) / fade; out[p + i] = 0.5 * env * (Math.sin(2 * Math.PI * f * t) + 0.5 * Math.sin(4 * Math.PI * f * t) + 0.25 * Math.sin(6 * Math.PI * f * t)); } }
      p += len;
    }
    return out;
  }

  return { noteName, fmtT, midiOf, freqOf, resample, pitchTrack, notesFrom, align, compare, synthNotes };
});
