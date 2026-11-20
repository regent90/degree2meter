/* app.js — 介面與繪圖（運算在 geo.js） */
(function () {
  'use strict';
  const G = window.Geo;
  const RAD = G.RAD;
  const $ = (s, r) => (r || document).querySelector(s);

  /* ------------------------------ 共用工具 ------------------------------ */
  const nf = (v, d) =>
    v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let cssEl = document.documentElement;
  const css = (name) => getComputedStyle(cssEl).getPropertyValue(name).trim();
  const sig = (v, n) => String(Number(v.toPrecision(n)));
  const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
  const sup = (n) => String(n).split('').map((c) => SUP[+c]).join('');
  const signedLen = (m) => (m === 0 ? '0 m' : (m < 0 ? '−' : '+') + G.fmtLength(Math.abs(m)));

  function num(v) {
    const n = Number(String(v).trim().replace(/[,，\s]/g, ''));
    return String(v).trim() === '' ? NaN : n;
  }

  async function copyText(text, btn) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (_) {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (__) { /* ignore */ }
      ta.remove();
    }
    if (btn) {
      const old = btn.textContent;
      btn.textContent = '已複製';
      setTimeout(() => { btn.textContent = old; }, 1200);
    }
  }

  /* ============================== 1. 一度差多少 ============================== */

  function renderDegree() {
    let lat = parseFloat($('#d-lat').value);
    let delta = parseFloat($('#d-delta').value);
    if (!isFinite(lat)) lat = 0;
    lat = Math.max(-90, Math.min(90, lat));
    if (!isFinite(delta) || delta < 0) delta = 1;

    const one = G.degreeLengths(lat, 1);
    const len = G.degreeLengths(lat, delta);
    const M = G.meridianRadius(lat);
    const N = G.primeVerticalRadius(lat);
    const dn = delta === 1 ? '1' : sig(delta, 6);

    $('#d-tiles').innerHTML = `
      <div class="ro ro--lat">
        <dt>南北方向<small>緯度差 ${dn}°</small></dt>
        <dd class="num">${nf(len.lat, 2)}<small>公尺</small></dd>
        <dd class="side">約 <b>${nf(len.lat / 1000, 3)}</b> 公里<br>1′ 約 <b>${nf(one.lat / 60, 2)}</b> 公尺，1″ 約 <b>${nf(one.lat / 3600, 3)}</b> 公尺</dd>
      </div>
      <div class="ro ro--lon">
        <dt>東西方向<small>經度差 ${dn}°</small></dt>
        <dd class="num">${nf(len.lon, 2)}<small>公尺</small></dd>
        <dd class="side">約 <b>${nf(len.lon / 1000, 3)}</b> 公里<br>1′ 約 <b>${nf(one.lon / 60, 2)}</b> 公尺，1″ 約 <b>${nf(one.lon / 3600, 3)}</b> 公尺</dd>
      </div>
      <div class="ro ro--rad">
        <dt>曲率半徑</dt>
        <dd class="num">M ${nf(M / 1000, 3)} km，N ${nf(N / 1000, 3)} km</dd>
        <dd class="side">cos φ = <b>${nf(Math.cos(lat * RAD), 5)}</b>，東西 ÷ 南北 = <b>${nf(one.lon / one.lat, 4)}</b></dd>
      </div>`;

    // 單側弧長 vs 局部尺度
    const lat2 = lat + delta <= 90 ? lat + delta : lat - delta;
    let note = '以上是該緯度的局部尺度：M·π/180 與 N·cos φ·π/180 乘上度數。';
    if (lat2 >= -90 && lat2 <= 90 && delta > 0) {
      const arc = G.meridianArc(lat, lat2);
      note += ` 如果改量 φ 到 ${sig(lat2, 8)}° 的子午線弧長，實際是 ${nf(arc, 2)} m，和局部尺度差 ${nf(Math.abs(arc - len.lat), 2)} m。`;
    }
    $('#d-note').textContent = note;

    // 小數位數表
    let rows = '';
    for (let k = 0; k <= 8; k++) {
      const d = Math.pow(10, -k);
      const l = G.degreeLengths(lat, d);
      rows += `<tr><td>小數第 ${k} 位</td><td>${k === 0 ? '1' : '0.' + '0'.repeat(k - 1) + '1'}°</td><td>${G.fmtLength(l.lat)}</td><td>${G.fmtLength(l.lon)}</td></tr>`;
    }
    rows += `<tr><td>1 角分 ′</td><td>1/60°</td><td>${G.fmtLength(one.lat / 60)}</td><td>${G.fmtLength(one.lon / 60)}</td></tr>`;
    rows += `<tr><td>1 角秒 ″</td><td>1/3600°</td><td>${G.fmtLength(one.lat / 3600)}</td><td>${G.fmtLength(one.lon / 3600)}</td></tr>`;
    $('#d-decimals').innerHTML = '<thead><tr><th>位數</th><th>差值</th><th>緯度向</th><th>經度向</th></tr></thead><tbody>' + rows + '</tbody>';

    // 各緯度表
    let hl = Math.round(Math.abs(lat) / 5) * 5;
    let r2 = '';
    for (let p = 0; p <= 90; p += 5) {
      const l = G.degreeLengths(p, 1);
      r2 += `<tr${p === hl ? ' class="hl"' : ''}><td>${p}°</td><td>${nf(l.lat, 1)}</td><td>${nf(l.lon, 1)}</td></tr>`;
    }
    $('#d-lats').innerHTML = '<thead><tr><th>緯度</th><th>緯度 1°（m）</th><th>經度 1°（m）</th></tr></thead><tbody>' + r2 + '</tbody>';

    renderChart(Math.abs(lat));
    if (heroUpdate) heroUpdate(lat);

    // 反向
    const m = parseFloat($('#r-meters').value);
    if (isFinite(m)) {
      const r = G.metersToDegrees(lat, Math.abs(m));
      $('#r-out').innerHTML =
        `<span class="pill">緯度向 ≈ <b>${sig(r.lat, 8)}°</b></span>` +
        `<span class="pill">經度向 ≈ <b>${isFinite(r.lon) ? sig(r.lon, 8) + '°' : '—'}</b></span>`;
    } else $('#r-out').innerHTML = '';
  }

  function renderChart(curLat) {
    const W = 640, H = 300, L = 46, R = 14, T = 16, B = 34;
    const x = (p) => L + (p / 90) * (W - L - R);
    const y = (km) => T + (1 - km / 120) * (H - T - B);
    let latPts = '', lonPts = '';
    for (let p = 0; p <= 90; p += 1) {
      const l = G.degreeLengths(p, 1);
      latPts += `${p ? 'L' : 'M'}${x(p).toFixed(1)},${y(l.lat / 1000).toFixed(1)}`;
      lonPts += `${p ? 'L' : 'M'}${x(p).toFixed(1)},${y(l.lon / 1000).toFixed(1)}`;
    }
    let grid = '';
    for (let k = 0; k <= 120; k += 20)
      grid += `<line class="gridl" x1="${L}" x2="${W - R}" y1="${y(k)}" y2="${y(k)}"/><text x="${L - 8}" y="${y(k) + 4}" text-anchor="end">${k}</text>`;
    for (let p = 0; p <= 90; p += 15)
      grid += `<text x="${x(p)}" y="${H - 12}" text-anchor="middle">${p}°</text>`;
    const cur = G.degreeLengths(curLat, 1);
    $('#d-chart').innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
        ${grid}
        <line class="ax" x1="${L}" x2="${L}" y1="${T}" y2="${H - B}"/>
        <line class="ax" x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}"/>
        <text x="${L}" y="11">公里 / 度</text>
        <text x="${W - R}" y="${H - 1}" text-anchor="end">緯度</text>
        <path class="l-lat" d="${latPts}"/>
        <path class="l-lon" d="${lonPts}"/>
        <line class="cur" x1="${x(curLat)}" x2="${x(curLat)}" y1="${T}" y2="${H - B}"/>
        <circle class="dot-lat" cx="${x(curLat)}" cy="${y(cur.lat / 1000)}" r="5"/>
        <circle class="dot-lon" cx="${x(curLat)}" cy="${y(cur.lon / 1000)}" r="5"/>
        <text class="legend-t a" x="${x(89)}" y="${y(102)}" text-anchor="end">南北方向 1°（約 110.6 到 111.7 km）</text>
        <text class="legend-t b" x="${x(3)}" y="${y(34)}">東西方向 1°（111.3 到 0 km）</text>
      </svg>`;
  }

  /* ========================== 2. 十進位 vs 二進位 ========================== */

  const B = { pts: [], sel: 0, fmt: { type: 'f32' }, errs: [], userMag: false };

  const PT_RE = /^([+-]?(?:\d+\.?\d*|\.\d+))\s*[,，\s]\s*([+-]?(?:\d+\.?\d*|\.\d+))\s*(.*)$/;

  function parsePoints(text) {
    const pts = [], errs = [];
    text.split(/\r?\n/).forEach((line, i) => {
      const t = line.trim();
      if (!t) return;
      const m = PT_RE.exec(t);
      if (!m) { errs.push(`第 ${i + 1} 行無法解析：「${t}」`); return; }
      const lat = Number(m[1]), lon = Number(m[2]);
      if (Math.abs(lat) > 90 || Math.abs(lon) > 180) { errs.push(`第 ${i + 1} 行超出範圍（緯度 ±90、經度 ±180）：「${t}」`); return; }
      pts.push({ latStr: m[1], lonStr: m[2], lat, lon, label: m[3].trim() });
    });
    return { pts, errs };
  }

  function readFmt() {
    const type = (document.querySelector('input[name="fmt"]:checked') || {}).value || 'f32';
    if (type === 'fixed') {
      let bits = parseInt($('#b-bits').value, 10);
      if (!isFinite(bits)) bits = 16;
      bits = Math.max(1, Math.min(40, bits));
      return { type, bits, rounding: $('#b-round').value };
    }
    return { type };
  }

  const fmtName = (f) =>
    f.type === 'f32' ? 'float32' : f.type === 'f64' ? 'float64'
      : `定點 k=${f.bits}（${f.rounding === 'trunc' ? '捨去' : '四捨五入'}）`;

  const exactDecimal = (x) => {
    const s = Math.abs(x).toFixed(100).replace(/0+$/, '').replace(/\.$/, '');
    return (x < 0 ? '-' : '') + s;
  };

  const ptName = (p, i) => p.label || `${p.latStr}, ${p.lonStr}`;

  function bitsHtml(stored, fmt) {
    if (fmt.type === 'fixed') {
      const b = G.fixedBits(stored, fmt.bits);
      return `<span class="s">${b.sign}</span> <span class="i">${b.int}</span><span class="dot">.</span><span class="m">${b.frac}</span>`;
    }
    const b = G.floatBits(stored, fmt.type);
    return `<span class="s">${b.sign}</span> <span class="e">${b.exp}</span> <span class="m">${b.mant}</span>`;
  }

  function renderBinary() {
    const { pts, errs } = parsePoints($('#b-points').value);
    B.pts = pts;
    B.fmt = readFmt();
    document.querySelectorAll('.fixed-only').forEach((el) => { el.hidden = B.fmt.type !== 'fixed'; });

    const eb = $('#b-errors');
    eb.hidden = errs.length === 0;
    eb.innerHTML = errs.map(esc).join('<br>');

    // 選單
    const sel = $('#b-which');
    const prev = Math.min(B.sel, Math.max(0, pts.length - 1));
    sel.innerHTML = pts.map((p, i) => `<option value="${i}">${i + 1}. ${esc(ptName(p, i))}</option>`).join('');
    sel.value = String(prev);
    B.sel = prev;

    if (!pts.length) {
      ['#b-compare', '#b-table'].forEach((s) => { $(s).innerHTML = ''; });
      $('#b-bits-view').innerHTML = '<p class="hint">請輸入至少一組座標。</p>';
      B.errsList = [];
      drawAllCanvases();
      return;
    }

    B.errsList = pts.map((p) => G.positionError(p.latStr, p.lonStr, B.fmt));
    const p = pts[B.sel];

    // 格式比較（選定點）
    const fx = B.fmt.type === 'fixed' ? B.fmt : { type: 'fixed', bits: 16, rounding: 'nearest' };
    const rowsFmt = [{ type: 'f32' }, { type: 'f64' }, fx];
    $('#b-compare').innerHTML =
      '<thead><tr><th>格式</th><th>儲存後緯度</th><th>儲存後經度</th><th>北向誤差</th><th>東向誤差</th><th>總偏移</th></tr></thead><tbody>' +
      rowsFmt.map((f) => {
        const e = G.positionError(p.latStr, p.lonStr, f);
        const on = f.type === B.fmt.type;
        return `<tr class="${on ? 'sel' : ''}"><td>${esc(fmtName(f))}</td><td>${e.latS.toFixed(12)}</td><td>${e.lonS.toFixed(12)}</td><td>${signedLen(e.north)}</td><td>${signedLen(e.east)}</td><td><b>${G.fmtLength(e.dist)}</b></td></tr>`;
      }).join('') + '</tbody>';

    // 位元檢視
    const e = B.errsList[B.sel];
    const box = (title, str, stored, dDeg, dM, isLat, v) => {
      const step = G.latticeStep(v, B.fmt);
      const mPer = isLat ? G.meridianRadius(p.lat) * RAD : G.primeVerticalRadius(p.lat) * Math.cos(p.lat * RAD) * RAD;
      let extra = '';
      if (B.fmt.type !== 'fixed') {
        const bi = G.floatBits(stored, B.fmt.type);
        const bias = B.fmt.type === 'f32' ? 127 : 1023;
        extra = `<dt>指數</dt><dd>${parseInt(bi.exp, 2)} − ${bias} = ${parseInt(bi.exp, 2) - bias}（值 ≈ 1.xxx × 2<sup>${parseInt(bi.exp, 2) - bias}</sup>）</dd>`;
      }
      return `<div class="bitbox"><h4>${title}</h4><dl>
        <dt>十進位輸入</dt><dd>${esc(str)}</dd>
        <dt>二進位</dt><dd class="bits">${bitsHtml(stored, B.fmt)}</dd>
        ${extra}
        <dt>儲存的精確值</dt><dd>${exactDecimal(stored)}</dd>
        <dt>誤差</dt><dd>${dDeg === 0 ? '0' : dDeg.toExponential(3)}° ≈ ${signedLen(dM)}</dd>
        <dt>可表示間距</dt><dd>${step.toExponential(3)}° ≈ ${G.fmtLength(step * mPer)}</dd>
      </dl></div>`;
    };
    const legend = B.fmt.type === 'fixed'
      ? '<span class="s">■</span> 符號　<span class="i">■</span> 整數位　<span class="m">■</span> 小數位（k 位元）'
      : '<span class="s">■</span> 符號　<span class="e">■</span> 指數　<span class="m">■</span> 尾數';
    $('#b-bits-view').innerHTML =
      box('緯度', p.latStr, e.latS, e.dLat, e.north, true, p.lat) +
      box('經度', p.lonStr, e.lonS, e.dLon, e.east, false, p.lon) +
      `<div class="bits-legend" style="grid-column:1/-1">${legend}（格式：${esc(fmtName(B.fmt))}）</div>`;

    // 所有點
    $('#b-table').innerHTML =
      '<thead><tr><th>#</th><th>名稱</th><th>緯度</th><th>經度</th><th>北向誤差</th><th>東向誤差</th><th>總偏移</th></tr></thead><tbody>' +
      pts.map((q, i) => {
        const r = B.errsList[i];
        return `<tr class="${i === B.sel ? 'sel' : ''}"><td>${i + 1}</td><td class="l">${esc(q.label || '—')}</td><td>${esc(q.latStr)}</td><td>${esc(q.lonStr)}</td><td>${signedLen(r.north)}</td><td>${signedLen(r.east)}</td><td><b>${G.fmtLength(r.dist)}</b></td></tr>`;
      }).join('') + '</tbody>';

    if (!B.userMag) setAutoMag();
    updateMagLabel();
    drawAllCanvases();
  }

  /* ---------------- 畫布 ---------------- */

  function prep(canvas) {
    cssEl = canvas;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(220, Math.round(rect.width));
    const h = Math.max(220, Math.round(rect.height || rect.width));
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  }

  function niceLen(target) {
    const p = Math.pow(10, Math.floor(Math.log10(target)));
    const n = target / p;
    return (n >= 5 ? 5 : n >= 2 ? 2 : 1) * p;
  }

  function drawLegend(ctx, items, x, y, font) {
    ctx.font = font;
    ctx.textBaseline = 'middle';
    items.forEach((it, i) => {
      const yy = y + i * 20;
      it.icon(ctx, x + 8, yy);
      ctx.fillStyle = css('--ink');
      ctx.textAlign = 'left';
      ctx.fillText(it.text, x + 22, yy);
    });
  }
  const iconRing = (ctx, x, y) => { ctx.strokeStyle = css('--mark'); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 5.5, 0, 7); ctx.stroke(); };
  const iconDot = (ctx, x, y) => { ctx.fillStyle = css('--bin'); ctx.beginPath(); ctx.arc(x, y, 4.5, 0, 7); ctx.fill(); };
  const iconBox = (ctx, x, y) => { ctx.fillStyle = css('--bin'); ctx.globalAlpha = 0.16; ctx.fillRect(x - 6, y - 6, 12, 12); ctx.globalAlpha = 1; ctx.strokeStyle = css('--bin'); ctx.lineWidth = 1; ctx.strokeRect(x - 6, y - 6, 12, 12); };

  function drawScaleBar(ctx, w, h, mPerPx, pad) {
    const len = niceLen(mPerPx * w * 0.22);
    const px = len / mPerPx;
    const x0 = pad, y0 = h - pad;
    ctx.strokeStyle = css('--ink'); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x0, y0 - 5); ctx.lineTo(x0, y0); ctx.lineTo(x0 + px, y0); ctx.lineTo(x0 + px, y0 - 5); ctx.stroke();
    ctx.fillStyle = css('--ink'); ctx.font = '12px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    ctx.fillText(G.fmtLength(len), x0, y0 - 8);
  }

  function cellRange(x, step, fmt) {
    if (fmt.type === 'fixed' && fmt.rounding === 'trunc') return x >= 0 ? [0, step] : [-step, 0];
    return [-step / 2, step / 2];
  }

  function drawZoom() {
    const cv = $('#b-zoom');
    const { ctx, w, h } = prep(cv);
    if (!B.pts.length) return;
    const p = B.pts[B.sel], e = B.errsList[B.sel];
    const mLat = G.meridianRadius(p.lat) * RAD;
    const mLon = G.primeVerticalRadius(p.lat) * Math.cos(p.lat * RAD) * RAD;
    const stLat = G.latticeStep(p.lat, B.fmt), stLon = G.latticeStep(p.lon, B.fmt);
    const sy = stLat * mLat, sx = stLon * mLon;
    const H = Math.max(sx, sy) * 2.6;
    const cx = w / 2, cy = h / 2;
    const k = (Math.min(w, h) / 2 - 16) / H; // px / m
    const X = (m) => cx + m * k, Y = (m) => cy - m * k;

    // 捕捉區（落在此區的十進位值都會變成同一個二進位點）
    const [xl, xh] = cellRange(p.lon, stLon, B.fmt), [yl, yh] = cellRange(p.lat, stLat, B.fmt);
    ctx.fillStyle = css('--bin'); ctx.globalAlpha = 0.14;
    ctx.fillRect(X(e.east + xl * mLon), Y(e.north + yh * mLat), (xh - xl) * mLon * k, (yh - yl) * mLat * k);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = css('--bin'); ctx.lineWidth = 1;
    ctx.strokeRect(X(e.east + xl * mLon), Y(e.north + yh * mLat), (xh - xl) * mLon * k, (yh - yl) * mLat * k);

    // 格線
    ctx.strokeStyle = css('--line'); ctx.lineWidth = 1;
    const maxLines = 90;
    if (sx * k >= 3) {
      const i0 = Math.floor((-H - e.east) / sx), i1 = Math.ceil((H - e.east) / sx);
      if (i1 - i0 <= maxLines) for (let i = i0; i <= i1; i++) { const xx = X(e.east + i * sx); ctx.beginPath(); ctx.moveTo(xx, 0); ctx.lineTo(xx, h); ctx.stroke(); }
    }
    if (sy * k >= 3) {
      const j0 = Math.floor((-H - e.north) / sy), j1 = Math.ceil((H - e.north) / sy);
      if (j1 - j0 <= maxLines) for (let j = j0; j <= j1; j++) { const yy = Y(e.north + j * sy); ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(w, yy); ctx.stroke(); }
    }
    // 格點
    if (sx * k >= 3 && sy * k >= 3) {
      ctx.fillStyle = css('--muted');
      const i0 = Math.floor((-H - e.east) / sx), i1 = Math.ceil((H - e.east) / sx);
      const j0 = Math.floor((-H - e.north) / sy), j1 = Math.ceil((H - e.north) / sy);
      if ((i1 - i0) * (j1 - j0) <= 2000)
        for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { ctx.beginPath(); ctx.arc(X(e.east + i * sx), Y(e.north + j * sy), 2, 0, 7); ctx.fill(); }
    }

    // 連線、十進位原點、儲存點
    ctx.strokeStyle = css('--ink'); ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(e.east), Y(e.north)); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = css('--bin'); ctx.beginPath(); ctx.arc(X(e.east), Y(e.north), 6, 0, 7); ctx.fill();
    ctx.strokeStyle = css('--paper'); ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = css('--mark'); ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(X(0), Y(0), 8, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(X(0) - 12, Y(0)); ctx.lineTo(X(0) + 12, Y(0)); ctx.moveTo(X(0), Y(0) - 12); ctx.lineTo(X(0), Y(0) + 12); ctx.stroke();

    drawLegend(ctx, [
      { icon: iconRing, text: '十進位原點' },
      { icon: iconDot, text: '二進位儲存值（' + fmtName(B.fmt) + '）' },
      { icon: iconBox, text: '捨入後會變成同一點的範圍' },
    ], 10, 18, '12px system-ui, sans-serif');
    drawScaleBar(ctx, w, h, 1 / k, 12);
    ctx.fillStyle = css('--ink'); ctx.font = '600 13px system-ui, sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
    ctx.fillText('偏移 ' + G.fmtLength(e.dist), w - 12, h - 12);
    ctx.font = '12px system-ui, sans-serif'; ctx.fillStyle = css('--muted'); ctx.textBaseline = 'top';
    ctx.fillText('格距 ' + G.fmtLength(sy) + '（南北） × ' + G.fmtLength(sx) + '（東西）', w - 12, 8);
  }

  const magFactor = () => Math.pow(10, parseInt($('#b-mag').value, 10) || 0);
  function updateMagLabel() {
    const n = parseInt($('#b-mag').value, 10) || 0;
    $('#b-mag-out').textContent = n === 0 ? '×1（真實）' : n < 7 ? '×' + nf(Math.pow(10, n), 0) : '×10' + sup(n);
  }

  function overviewGeometry() {
    const pts = B.pts;
    const latC = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
    const lonC = pts.reduce((s, p) => s + p.lon, 0) / pts.length;
    const mLat = G.meridianRadius(latC) * RAD;
    const mLon = G.primeVerticalRadius(latC) * Math.cos(latC * RAD) * RAD;
    return pts.map((p, i) => ({ x: (p.lon - lonC) * mLon, y: (p.lat - latC) * mLat, e: B.errsList[i] }));
  }

  function setAutoMag() {
    if (!B.pts.length) return;
    const g = overviewGeometry();
    let half = Math.max(...g.map((q) => Math.max(Math.abs(q.x), Math.abs(q.y))));
    const maxErr = Math.max(...g.map((q) => q.e.dist));
    let n = 0;
    if (maxErr > 0) {
      const target = 0.08 * (half > 0 ? half : 1);
      n = Math.round(Math.log10(target / maxErr));
    }
    $('#b-mag').value = String(Math.max(0, Math.min(14, n)));
  }

  function drawOverview() {
    const cv = $('#b-overview');
    const { ctx, w, h } = prep(cv);
    if (!B.pts.length) return;
    const g = overviewGeometry();
    const f = magFactor();
    let half = 0;
    g.forEach((q) => {
      half = Math.max(half, Math.abs(q.x), Math.abs(q.y), Math.abs(q.x + q.e.east * f), Math.abs(q.y + q.e.north * f));
    });
    if (half === 0) half = 1;
    half *= 1.18;
    const cx = w / 2, cy = h / 2;
    const k = (Math.min(w, h) / 2 - 14) / half;
    const X = (m) => cx + m * k, Y = (m) => cy - m * k;

    // 背景格線（4 等分）
    ctx.strokeStyle = css('--line'); ctx.lineWidth = 1;
    for (let i = -1; i <= 1; i += 0.5) {
      ctx.beginPath(); ctx.moveTo(X(i * half), 0); ctx.lineTo(X(i * half), h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, Y(i * half)); ctx.lineTo(w, Y(i * half)); ctx.stroke();
    }

    const labelOn = g.length <= 14;
    const placed = [];
    g.forEach((q, i) => {
      const sel = i === B.sel;
      const bx = q.x + q.e.east * f, by = q.y + q.e.north * f;
      ctx.strokeStyle = css('--ink'); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(X(q.x), Y(q.y)); ctx.lineTo(X(bx), Y(by)); ctx.stroke();
      ctx.fillStyle = css('--bin'); ctx.beginPath(); ctx.arc(X(bx), Y(by), sel ? 5.5 : 4, 0, 7); ctx.fill();
      ctx.strokeStyle = css('--mark'); ctx.lineWidth = sel ? 3 : 2;
      ctx.beginPath(); ctx.arc(X(q.x), Y(q.y), sel ? 8 : 6.5, 0, 7); ctx.stroke();
      if (labelOn) {
        ctx.fillStyle = css('--ink'); ctx.font = (sel ? '600 ' : '') + '12px system-ui, sans-serif';
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        const name = B.pts[i].label || String(i + 1);
        const tw = ctx.measureText(name).width;
        let lx = X(q.x) + 11, ly = Y(q.y) - 11;
        // 與已畫的標籤重疊時，往下挪一行
        for (let tries = 0; tries < 6 && placed.some((r) => lx < r.x + r.w && lx + tw > r.x && Math.abs(ly - r.y) < 14); tries++) ly += 14;
        placed.push({ x: lx, y: ly, w: tw });
        ctx.fillText(name, lx, ly);
      }
    });

    drawLegend(ctx, [
      { icon: iconRing, text: '十進位原位置' },
      { icon: iconDot, text: '二進位儲存後（偏移 ×' + nf(f, 0) + '）' },
    ], 10, 18, '12px system-ui, sans-serif');
    drawScaleBar(ctx, w, h, 1 / k, 12);
    ctx.fillStyle = css('--muted'); ctx.font = '12px system-ui, sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
    ctx.fillText('北 ↑　（' + fmtName(B.fmt) + '）', w - 12, h - 12);
  }

  function drawAllCanvases() { drawZoom(); drawOverview(); }

  /* ============================== 3. 座標轉換 ============================== */

  const T = { last: null };
  const SAMPLE = [25.0339639, 121.5644722]; // 台北101

  const LABELS = {
    WGS84: ['緯度（°）', '經度（°）'],
    TWD97: ['E 東距（m）', 'N 北距（m）'],
    TWD67: ['E 東距（m）', 'N 北距（m）'],
  };
  const SYSNAME = { WGS84: 'WGS84 經緯度', TWD97: 'TWD97 TM2', TWD67: 'TWD67 TM2' };

  const fixedStr = (kind, v) => (kind === 'latlon' ? v.toFixed(9) : v.toFixed(3));

  function renderTM() {
    const from = $('#t-from').value, to = $('#t-to').value, zone = $('#t-zone').value;
    $('#t-l1').textContent = LABELS[from][0];
    $('#t-l2').textContent = LABELS[from][1];
    const v1 = num($('#t-v1').value), v2 = num($('#t-v2').value);
    const box = $('#t-result');
    T.last = null;
    if (!isFinite(v1) || !isFinite(v2)) {
      box.innerHTML = '<span class="err">請輸入兩個數字。</span>';
      return;
    }
    let r;
    try {
      r = G.convert(from, to, v1, v2, zone === 'auto' ? 'auto' : Number(zone));
    } catch (err) {
      box.innerHTML = `<span class="err">${esc(err.message)}</span>`;
      return;
    }
    T.last = r;
    const lines = r.kind === 'latlon'
      ? [['緯度', r.v1.toFixed(9) + '°', G.toDMS(r.v1, true), r.v1.toFixed(9)], ['經度', r.v2.toFixed(9) + '°', G.toDMS(r.v2, false), r.v2.toFixed(9)]]
      : [['E 東距', r.v1.toFixed(3) + ' m', '', r.v1.toFixed(3)], ['N 北距', r.v2.toFixed(3) + ' m', '', r.v2.toFixed(3)]];
    const involvesTM = from !== 'WGS84' || to !== 'WGS84';
    const bits = [`${SYSNAME[from]} 換成 ${SYSNAME[to]}。`];
    if (involvesTM) bits.push(`分帶中央經線 ${r.zone}°${zone === 'auto' ? '，由經度自動判斷' : ''}。`);
    if (from === to) bits.push('來源與目標相同。');
    if (from === 'TWD67' || to === 'TWD67') bits.push('TWD67 用官方迴歸式，精度約公尺等級。');
    const meta = bits.join('');
    box.innerHTML =
      lines.map((l) => `<div class="rline"><span class="rl">${l[0]}</span><span class="rv">${l[1]}</span>${l[2] ? `<span class="rsub">${l[2]}</span>` : ''}<button type="button" class="copy" data-copy="${l[3]}">複製</button></div>`).join('') +
      `<div class="rline"><span class="rl">合併</span><span class="rsub">${lines[0][3]}, ${lines[1][3]}</span><button type="button" class="copy" data-copy="${lines[0][3]}, ${lines[1][3]}">複製</button></div>` +
      `<div class="meta">${esc(meta)}</div>` +
      r.warnings.map((w) => `<div class="warn">⚠ ${esc(w)}</div>`).join('');
  }

  function setInputsFor(sys) {
    const r = sys === 'WGS84' ? { kind: 'latlon', v1: SAMPLE[0], v2: SAMPLE[1] } : G.convert('WGS84', sys, SAMPLE[0], SAMPLE[1], 121);
    $('#t-v1').value = fixedStr(r.kind, r.v1);
    $('#t-v2').value = fixedStr(r.kind, r.v2);
  }

  function swapTM() {
    const from = $('#t-from').value, to = $('#t-to').value;
    const last = T.last;
    $('#t-from').value = to;
    $('#t-to').value = from;
    if (last) {
      $('#t-v1').value = fixedStr(last.kind, last.v1);
      $('#t-v2').value = fixedStr(last.kind, last.v2);
    }
    renderTM();
  }

  function runBatch() {
    const from = $('#t-from').value, to = $('#t-to').value, zone = $('#t-zone').value;
    const out = [];
    $('#t-batch-in').value.split(/\r?\n/).forEach((line) => {
      const t = line.trim();
      if (!t) return;
      const parts = t.split(/[,，;\s]+/).filter(Boolean);
      const a = Number(parts[0]), b = Number(parts[1]);
      if (parts.length < 2 || !isFinite(a) || !isFinite(b)) { out.push(`${t},ERROR,,`); return; }
      try {
        const r = G.convert(from, to, a, b, zone === 'auto' ? 'auto' : Number(zone));
        out.push(`${parts[0]},${parts[1]},${fixedStr(r.kind, r.v1)},${fixedStr(r.kind, r.v2)},${r.zone}`);
      } catch (_) { out.push(`${parts[0]},${parts[1]},ERROR,,`); }
    });
    $('#t-batch-out').value = out.join('\n');
  }


  /* ============================== 英雄：正弦投影經緯網格 ============================== */

  let heroUpdate = null;

  function initHero() {
    const NS = 'http://www.w3.org/2000/svg';
    const map = $('#hf-map'), cell = $('#hf-cell'), range = $('#h-lat'), outEl = $('#h-out');
    if (!map || !cell || !range) return;
    map.classList.add('hf');
    cell.classList.add('hf');

    /* 正弦投影：x = 相對經度 × cos φ，y = 緯度；兩個方向的比例都是真的 */
    const k = 5.6, LM = 22, cx = 168, y0 = 540;
    const X = (l, p) => cx + l * Math.cos(p * RAD) * k;
    const Y = (p) => y0 - p * k;
    const el = (tag, attrs, parent) => {
      const e = document.createElementNS(NS, tag);
      for (const a in attrs) e.setAttribute(a, attrs[a]);
      (parent || map).appendChild(e);
      return e;
    };
    let idx = 0;
    const line = (d, cls) => el('path', { d, class: cls + ' draw', pathLength: 1, style: '--i:' + idx++ });

    // 平行圈（每 5°，10° 加粗）
    for (let p = 0; p <= 90; p += 5) {
      const major = p % 10 === 0;
      line(`M${X(-LM, p).toFixed(1)},${Y(p).toFixed(1)}L${X(LM, p).toFixed(1)},${Y(p).toFixed(1)}`, 'parallel' + (major ? ' major' : ' minor'));
    }
    // 經線（每 5°，10° 加粗）
    for (let l = -20; l <= 20; l += 5) {
      let d = '';
      for (let p = 0; p <= 90; p += 3) d += (p ? 'L' : 'M') + X(l, p).toFixed(1) + ',' + Y(p).toFixed(1);
      line(d, 'meridian' + (l % 10 === 0 ? ' major' : ' minor'));
    }
    // 圖廓
    let od = '';
    for (let p = 0; p <= 90; p += 3) od += (p ? 'L' : 'M') + X(LM, p).toFixed(1) + ',' + Y(p).toFixed(1);
    for (let p = 90; p >= 0; p -= 3) od += 'L' + X(-LM, p).toFixed(1) + ',' + Y(p).toFixed(1);
    line(od + 'Z', 'outline');

    // 緯度尺
    el('line', { x1: 38, x2: 38, y1: Y(0), y2: Y(90), class: 'tick' });
    for (let p = 0; p <= 90; p += 10) {
      el('line', { x1: 31, x2: 38, y1: Y(p), y2: Y(p), class: 'tick' });
      const t = el('text', { x: 26, y: Y(p) + 4, 'text-anchor': 'end' });
      t.textContent = p + '°';
    }

    const band = el('path', { class: 'band' });
    const mini = el('path', { class: 'minicell' });
    const tw = el('path', { class: 'tw' });
    const twT = el('text', { class: 'tw-t' });
    twT.textContent = '臺灣';
    const tagG = el('g', {});
    const tagR = el('rect', { x: 0, width: 46, height: 20, rx: 3, class: 'lat-tag' }, tagG);
    const tagT = el('text', { x: 23, 'text-anchor': 'middle', class: 'lat-tag-t' }, tagG);

    /* 放大的 1°×1° 格子 */
    const s = 2.0, gw = 111.32 * s, gh = 110.57 * s, gx = (270 - gw) / 2, gy = 66, gb = gy + gh + 2;
    const t1 = el('text', { x: 24, y: 24, class: 'dim-s' }, cell); t1.textContent = '放大的 1° × 1° 格子';
    const t2 = el('text', { x: 24, y: 44, class: 'dim-s' }, cell); t2.textContent = '虛線是赤道上的同樣一格';
    el('rect', { x: gx, y: gb - gh, width: gw, height: gh, class: 'ghost' }, cell);
    const act = el('rect', { class: 'cellrect' }, cell);
    const dimB = el('path', { class: 'dim' }, cell);
    const dimL = el('path', { class: 'dim' }, cell);
    const lb1 = el('text', { x: 24, y: 352, class: 'dim-s' }, cell); lb1.textContent = '東西';
    const n1 = el('text', { x: 24, y: 392, class: 'dim-t' }, cell);
    const lb2 = el('text', { x: 24, y: 436, class: 'dim-s' }, cell); lb2.textContent = '南北';
    const n2 = el('text', { x: 24, y: 476, class: 'dim-t' }, cell);
    const rt = el('text', { x: 24, y: 516, class: 'dim-s' }, cell);

    const setNum = (node, v) => {
      node.textContent = '';
      node.append(document.createTextNode(nf(v, 2) + ' '));
      const u = document.createElementNS(NS, 'tspan');
      u.setAttribute('class', 'dim-s'); u.setAttribute('font-size', '16'); u.textContent = 'km';
      node.appendChild(u);
    };

    heroUpdate = function (latSigned) {
      const a = Math.min(90, Math.abs(latSigned));
      range.value = String(a);
      outEl.textContent = a.toFixed(1) + '°' + (latSigned < 0 ? 'S' : 'N');

      const lo = Math.max(0, a - 0.5), hi = Math.min(90, a + 0.5);
      band.setAttribute('d', `M${X(-LM, lo)},${Y(lo)}L${X(LM, lo)},${Y(lo)}L${X(LM, hi)},${Y(hi)}L${X(-LM, hi)},${Y(hi)}Z`);
      const h2 = Math.min(90, a + 1);
      mini.setAttribute('d', `M${X(0, a)},${Y(a)}L${X(1, a)},${Y(a)}L${X(1, h2)},${Y(h2)}L${X(0, h2)},${Y(h2)}Z`);
      const px = X(1.5, 25), py = Y(25);
      tw.setAttribute('d', `M${px},${py - 6.5}L${px + 6},${py + 4.5}L${px - 6},${py + 4.5}Z`);
      twT.setAttribute('x', px + 10); twT.setAttribute('y', py + 4);
      tagR.setAttribute('y', Y(a) - 10);
      tagT.setAttribute('y', Y(a) + 4);
      tagT.textContent = a.toFixed(1) + '°N'.replace('N', latSigned < 0 ? 'S' : 'N');

      const len = G.degreeLengths(a, 1);
      const w = (len.lon / 1000) * s, h = (len.lat / 1000) * s;
      const x0 = (270 - w) / 2, top = gb - h;
      act.setAttribute('x', x0); act.setAttribute('y', top); act.setAttribute('width', w); act.setAttribute('height', h);
      dimB.setAttribute('d', `M${x0},${gb + 12}H${x0 + w}M${x0},${gb + 7}V${gb + 17}M${x0 + w},${gb + 7}V${gb + 17}`);
      dimL.setAttribute('d', `M12,${top}V${gb}M7,${top}H17M7,${gb}H17`);
      setNum(n1, len.lon / 1000);
      setNum(n2, len.lat / 1000);
      rt.textContent = '東西是南北的 ' + nf((len.lon / len.lat) * 100, 1) + '%';
    };

    /* 滑鼠移過經緯網格就能掃描緯度；觸控與鍵盤用上方的滑桿 */
    map.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const r = map.getBoundingClientRect();
      const vy = ((e.clientY - r.top) / r.height) * 580;
      const lat = Math.max(0, Math.min(90, (y0 - vy) / k));
      setLat(lat);
    });
    range.addEventListener('input', () => setLat(parseFloat(range.value)));
  }

  function setLat(v) {
    v = Math.round(v * 10) / 10;
    $('#d-lat').value = v;
    $('#d-slider').value = v;
    renderDegree();
  }

  /** 進頁面時，緯度線掃到目前緯度一次 */
  function introSweep() {
    if (!heroUpdate || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
    const target = parseFloat($('#d-lat').value) || 0;
    const t0 = performance.now(), dur = 1400, delay = 500;
    const step = (now) => {
      const t = Math.max(0, Math.min(1, (now - t0 - delay) / dur));
      const e = 1 - Math.pow(1 - t, 3);
      heroUpdate(target * e);
      if (t < 1) requestAnimationFrame(step); else heroUpdate(parseFloat($('#d-lat').value) || 0);
    };
    heroUpdate(0);
    requestAnimationFrame(step);
  }

  /* ============================== 事件綁定 ============================== */

  function init() {
    // 1
    const lat = $('#d-lat'), slider = $('#d-slider');
    lat.addEventListener('input', () => { const v = parseFloat(lat.value); if (isFinite(v)) slider.value = v; renderDegree(); });
    slider.addEventListener('input', () => { lat.value = slider.value; renderDegree(); });
    ['#d-delta', '#r-meters'].forEach((s) => $(s).addEventListener('input', renderDegree));
    initHero();
    renderDegree();
    introSweep();

    // 2
    $('#b-points').addEventListener('input', () => { B.userMag = false; renderBinary(); });
    document.querySelectorAll('input[name="fmt"]').forEach((el) => el.addEventListener('change', () => { B.userMag = false; renderBinary(); }));
    ['#b-bits', '#b-round'].forEach((s) => $(s).addEventListener('input', () => { B.userMag = false; renderBinary(); }));
    $('#b-which').addEventListener('change', (e) => { B.sel = parseInt(e.target.value, 10) || 0; renderBinary(); });
    $('#b-mag').addEventListener('input', () => { B.userMag = true; updateMagLabel(); drawOverview(); });
    $('#b-mag-auto').addEventListener('click', () => { B.userMag = false; setAutoMag(); updateMagLabel(); drawOverview(); });
    renderBinary();
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(() => drawAllCanvases());
      ro.observe($('#b-zoom'));
      ro.observe($('#b-overview'));
    }
    if (window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const redraw = () => drawAllCanvases();
      if (mq.addEventListener) mq.addEventListener('change', redraw); else if (mq.addListener) mq.addListener(redraw);
    }

    // 3
    ['#t-to', '#t-zone', '#t-v1', '#t-v2'].forEach((s) => $(s).addEventListener('input', renderTM));
    $('#t-from').addEventListener('change', () => { setInputsFor($('#t-from').value); renderTM(); });
    $('#t-swap').addEventListener('click', swapTM);
    $('#t-result').addEventListener('click', (e) => {
      const b = e.target.closest('button.copy');
      if (b) copyText(b.dataset.copy, b);
    });
    $('#t-batch-run').addEventListener('click', runBatch);
    $('#t-batch-copy').addEventListener('click', (e) => copyText($('#t-batch-out').value, e.target));
    renderTM();
    runBatch();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
