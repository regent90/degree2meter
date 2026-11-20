// 執行：node test/geo.test.js
const assert = require('node:assert/strict');
const G = require('../js/geo.js');

const near = (a, b, tol, msg) =>
  assert.ok(Math.abs(a - b) <= tol, `${msg || ''} expected ${b} got ${a} (tol ${tol})`);

// ---- 一、一度差多少公尺（基準：pyproj Geod WGS84 大地線 / N·cosφ 公式）
{
  // 緯度：以該緯度為中心的 1° 大地線長；局部尺度與其差 < 0.1 m
  for (const [lat, ref] of [[0, 110574.304], [25, 110772.904], [45, 111131.778], [60, 111412.273]])
    near(G.degreeLengths(lat).lat, ref, 0.1, 'lat@' + lat);
  // 經度：平行圈長
  for (const [lat, ref] of [[0, 111319.491], [25, 100950.090], [45, 78846.835], [60, 55800.002]])
    near(G.degreeLengths(lat).lon, ref, 0.005, 'lon@' + lat);
  near(G.degreeLengths(90).lon, 0, 1e-6, 'lon@90');
  near(G.degreeLengths(25, 0.01).lat * 100, G.degreeLengths(25).lat, 1e-6, 'delta scale');
  near(G.meridianArc(0, 90), 10001965.729, 0.01, 'quarter meridian');
  near(G.meridianArc(24.5, 25.5), 110772.904, 0.01, 'arc');
  const back = G.metersToDegrees(25, G.degreeLengths(25).lat);
  near(back.lat, 1, 1e-12, 'm→deg');
}

// ---- 二、二進位儲存
{
  assert.equal(G.quantize(0.1, { type: 'f32' }), Math.fround(0.1));
  // 0.5 可精確表示 → 誤差 0
  assert.equal(G.errorDeg('0.5', G.quantize(0.5, { type: 'f32' })), 0);
  // 0.1 的 float64 誤差 = 5.55e-18
  near(G.errorDeg('0.1', 0.1), 5.551115123125783e-18, 1e-30, 'f64 0.1');
  // float32 的 121.5644722 在台灣約 < 0.5 m
  const e32 = G.positionError('25.0339639', '121.5644722', { type: 'f32' });
  assert.ok(e32.dist < 1 && e32.dist > 1e-3, 'f32 error ' + e32.dist);
  const e64 = G.positionError('25.0339639', '121.5644722', { type: 'f64' });
  assert.ok(e64.dist < 1e-8, 'f64 error ' + e64.dist);
  // 定點：16 bit 小數 → 間距 2^-16 deg ≈ 1.7 m，誤差不超過半格
  const fx = G.positionError('25.0339639', '121.5644722', { type: 'fixed', bits: 16, rounding: 'nearest' });
  assert.ok(Math.abs(fx.dLat) <= 2 ** -17 + 1e-15 && Math.abs(fx.dLon) <= 2 ** -17 + 1e-15);
  const tr = G.positionError('25.0339639', '121.5644722', { type: 'fixed', bits: 16, rounding: 'trunc' });
  assert.ok(tr.dLat <= 0 && tr.dLon <= 0 && Math.abs(tr.dLat) < 2 ** -16);
  // 位元欄位
  const b = G.floatBits(1, 'f32');
  assert.deepEqual(b, { sign: '0', exp: '01111111', mant: '0'.repeat(23) });
  const b64 = G.floatBits(-2, 'f64');
  assert.equal(b64.sign, '1'); assert.equal(b64.exp, '10000000000');
  assert.deepEqual(G.fixedBits(0.75, 4), { sign: '+', int: '0', frac: '1100' });
  assert.equal(G.latticeStep(121.56, { type: 'f32' }), 2 ** -17);
  assert.equal(G.latticeStep(25.03, { type: 'f64' }), 2 ** -48);
}

// ---- 三、橫麥卡托：對照 pyproj（EPSG:3826 / 3825）
{
  const cases = [
    [25.0339639, 121.5644722, 121, 306962.7438328624, 2769658.213347427],
    [22.6392, 120.302, 121, 178256.40952129485, 2504499.8082873793],
    [23.5, 119.57, 121, null, null],
    [23.5, 119.57, 119, 308215.22741075204, 2599766.8185068956],
  ];
  for (const [lat, lon, z, E, N] of cases) {
    const r = G.twd97TM(z).forward(lat, lon);
    if (E !== null) { near(r.E, E, 1e-4, 'E'); near(r.N, N, 1e-4, 'N'); }
    const b = G.twd97TM(z).inverse(r.E, r.N);
    near(b.lat, lat, 1e-11, 'lat roundtrip');
    near(b.lon, lon, 1e-11, 'lon roundtrip');
  }
  // 大範圍來回
  for (let lat = 21.5; lat <= 26; lat += 0.37)
    for (let lon = 119.2; lon <= 122.2; lon += 0.41) {
      const z = G.autoZone(lon);
      const r = G.twd97TM(z).forward(lat, lon);
      const b = G.twd97TM(z).inverse(r.E, r.N);
      near(b.lat, lat, 1e-10); near(b.lon, lon, 1e-10);
    }
  // 中央經線上 E = 250000
  near(G.twd97TM(121).forward(24, 121).E, 250000, 1e-9, 'central meridian');
}

// ---- TWD97 ↔ TWD67（官方六參數）
{
  const r67 = G.twd97ToTwd67(306962.744, 2769658.213);
  // 本島約向西 ~828 m、向北 ~207 m
  near(r67.E - 306962.744, -828, 20, 'dE'); near(r67.N - 2769658.213, 207, 20, 'dN');
  const back = G.twd67ToTwd97(r67.E, r67.N);
  // 官方兩個方向各自為迴歸式，來回約差 1~2 cm
  near(back.E, 306962.744, 0.03, 'E back'); near(back.N, 2769658.213, 0.03, 'N back');
}

// ---- convert 六個方向
{
  const w = [25.0339639, 121.5644722];
  const a = G.convert('WGS84', 'TWD97', ...w);
  near(a.v1, 306962.7438, 1e-3); near(a.v2, 2769658.2133, 1e-3);
  assert.equal(a.zone, 121);
  const b = G.convert('WGS84', 'TWD67', ...w);
  const c = G.convert('TWD97', 'TWD67', a.v1, a.v2);
  near(b.v1, c.v1, 1e-9); near(b.v2, c.v2, 1e-9);
  const d = G.convert('TWD97', 'WGS84', a.v1, a.v2, 121);
  near(d.v1, w[0], 1e-10); near(d.v2, w[1], 1e-10);
  const e = G.convert('TWD67', 'WGS84', b.v1, b.v2, 121);
  near(e.v1, w[0], 2e-7); near(e.v2, w[1], 2e-7); // 官方公式來回 ~cm
  const f = G.convert('TWD67', 'TWD97', c.v1, c.v2);
  near(f.v1, a.v1, 0.03); near(f.v2, a.v2, 0.03);
  assert.equal(G.convert('WGS84', 'TWD97', 23.5, 119.57).zone, 119); // 澎湖自動分帶
}

console.log('all tests passed');
