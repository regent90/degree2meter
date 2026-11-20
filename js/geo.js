/*
 * geo.js — 經緯度 / 公尺 / 二進位 / 橫麥卡托 的純運算函式
 * 同時支援瀏覽器（window.Geo）與 Node（require）。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Geo = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const RAD = Math.PI / 180;

  /* ------------------------------------------------------------------ *
   * 橢球
   * ------------------------------------------------------------------ */
  function derive(a, invf) {
    const f = 1 / invf;
    return { a, f, e2: f * (2 - f), n: f / (2 - f) };
  }
  const WGS84 = derive(6378137, 298.257223563);
  const GRS80 = derive(6378137, 298.257222101); // TWD97 使用

  /* ------------------------------------------------------------------ *
   * 一、緯度 / 經度一度差多少公尺
   * ------------------------------------------------------------------ */

  /** 子午圈曲率半徑 M（南北向） */
  function meridianRadius(latDeg, el = WGS84) {
    const s = Math.sin(latDeg * RAD);
    const w2 = 1 - el.e2 * s * s;
    return (el.a * (1 - el.e2)) / (w2 * Math.sqrt(w2));
  }

  /** 卯酉圈曲率半徑 N（東西向） */
  function primeVerticalRadius(latDeg, el = WGS84) {
    const s = Math.sin(latDeg * RAD);
    return el.a / Math.sqrt(1 - el.e2 * s * s);
  }

  /** 在某緯度，緯度差 / 經度差 deltaDeg 度 ≈ 多少公尺（局部尺度） */
  function degreeLengths(latDeg, deltaDeg = 1, el = WGS84) {
    return {
      lat: meridianRadius(latDeg, el) * RAD * deltaDeg,
      lon: primeVerticalRadius(latDeg, el) * Math.cos(latDeg * RAD) * RAD * deltaDeg,
    };
  }

  /** 子午線由 lat1 到 lat2 的弧長（Simpson 積分） */
  function meridianArc(lat1, lat2, el = WGS84, steps = 720) {
    const h = ((lat2 - lat1) * RAD) / steps;
    let sum = meridianRadius(lat1, el) + meridianRadius(lat2, el);
    for (let i = 1; i < steps; i++) {
      sum += (i % 2 ? 4 : 2) * meridianRadius(lat1 + (i * (lat2 - lat1)) / steps, el);
    }
    return Math.abs((sum * h) / 3);
  }

  /** 公尺 → 度（在某緯度） */
  function metersToDegrees(latDeg, meters, el = WGS84) {
    const per = degreeLengths(latDeg, 1, el);
    return { lat: meters / per.lat, lon: per.lon > 0 ? meters / per.lon : Infinity };
  }

  /* ------------------------------------------------------------------ *
   * 二、十進位 ↔ 二進位 儲存誤差
   * ------------------------------------------------------------------ */

  const SCALE_DIGITS = 100;
  const SCALE = 10n ** BigInt(SCALE_DIGITS);

  /** 十進位字串 → 放大 10^100 倍的 BigInt（精確） */
  function decimalToScaled(str) {
    const m = /^\s*([+-]?)(\d*)\.?(\d*)\s*$/.exec(String(str));
    if (!m || (m[2] === '' && m[3] === '')) return null;
    const frac = m[3].slice(0, SCALE_DIGITS).padEnd(SCALE_DIGITS, '0');
    const v = BigInt((m[2] || '0') + frac);
    return m[1] === '-' ? -v : v;
  }

  /** double → 放大 10^100 倍的 BigInt（toFixed 在 ≤100 位為精確展開） */
  function doubleToScaled(x) {
    const v = BigInt(Math.abs(x).toFixed(SCALE_DIGITS).replace('.', ''));
    return x < 0 ? -v : v;
  }

  /** 儲存值（double）與十進位字串的精確差（度） */
  function errorDeg(decimalStr, stored) {
    const d = decimalToScaled(decimalStr);
    if (d === null) return NaN;
    return Number(doubleToScaled(stored) - d) / Number(SCALE);
  }

  /**
   * 格式：
   *  { type:'f32' } | { type:'f64' } | { type:'fixed', bits:k, rounding:'nearest'|'trunc' }
   */
  function quantize(x, fmt) {
    switch (fmt.type) {
      case 'f64':
        return x;
      case 'f32':
        return Math.fround(x);
      case 'fixed': {
        const s = Math.pow(2, fmt.bits);
        const v = Math.abs(x) * s;
        const q = fmt.rounding === 'trunc' ? Math.floor(v) : Math.round(v);
        return (x < 0 ? -q : q) / s;
      }
      default:
        throw new Error('unknown format ' + fmt.type);
    }
  }

  /** 該格式在 x 附近的可表示數間距（度） */
  function latticeStep(x, fmt) {
    if (fmt.type === 'fixed') return Math.pow(2, -fmt.bits);
    const mant = fmt.type === 'f32' ? 23 : 52;
    const ax = Math.abs(x);
    if (ax === 0) return Math.pow(2, fmt.type === 'f32' ? -149 : -1074);
    let e = Math.floor(Math.log2(ax));
    while (Math.pow(2, e) > ax) e--;
    while (Math.pow(2, e + 1) <= ax) e++;
    return Math.pow(2, e - mant);
  }

  /** IEEE 754 位元欄位 */
  function floatBits(x, type) {
    const dv = new DataView(new ArrayBuffer(8));
    if (type === 'f32') {
      dv.setFloat32(0, x);
      const s = dv.getUint32(0).toString(2).padStart(32, '0');
      return { sign: s.slice(0, 1), exp: s.slice(1, 9), mant: s.slice(9) };
    }
    dv.setFloat64(0, x);
    const s = dv.getBigUint64(0).toString(2).padStart(64, '0');
    return { sign: s.slice(0, 1), exp: s.slice(1, 12), mant: s.slice(12) };
  }

  /** 定點數（已量化的值）的二進位：符號 + 整數位 + 小數位 */
  function fixedBits(stored, bits) {
    const q = BigInt(Math.round(Math.abs(stored) * Math.pow(2, bits)));
    const b = BigInt(bits);
    return {
      sign: stored < 0 ? '-' : '+',
      int: (q >> b).toString(2),
      frac: (q & ((1n << b) - 1n)).toString(2).padStart(bits, '0'),
    };
  }

  /** 一個十進位座標轉成指定二進位格式後的位置誤差 */
  function positionError(latStr, lonStr, fmt) {
    const lat0 = Number(latStr);
    const lon0 = Number(lonStr);
    const latS = quantize(lat0, fmt);
    const lonS = quantize(lon0, fmt);
    const dLat = errorDeg(latStr, latS);
    const dLon = errorDeg(lonStr, lonS);
    const north = dLat * RAD * meridianRadius(lat0);
    const east = dLon * RAD * primeVerticalRadius(lat0) * Math.cos(lat0 * RAD);
    return { latS, lonS, dLat, dLon, north, east, dist: Math.hypot(north, east) };
  }

  /* ------------------------------------------------------------------ *
   * 三、橫麥卡托（Krüger n 級數，Karney 2011，誤差 < 1 nm）
   * ------------------------------------------------------------------ */

  function createTM(el, p) {
    const n = el.n;
    const n2 = n * n, n3 = n2 * n, n4 = n3 * n, n5 = n4 * n, n6 = n5 * n;
    const e = Math.sqrt(el.e2);
    const A = (el.a / (1 + n)) * (1 + n2 / 4 + n4 / 64 + n6 / 256);
    const alpha = [
      0,
      n / 2 - (2 / 3) * n2 + (5 / 16) * n3 + (41 / 180) * n4 - (127 / 288) * n5 + (7891 / 37800) * n6,
      (13 / 48) * n2 - (3 / 5) * n3 + (557 / 1440) * n4 + (281 / 630) * n5 - (1983433 / 1935360) * n6,
      (61 / 240) * n3 - (103 / 140) * n4 + (15061 / 26880) * n5 + (167603 / 181440) * n6,
      (49561 / 161280) * n4 - (179 / 168) * n5 + (6601661 / 7257600) * n6,
      (34729 / 80640) * n5 - (3418889 / 1995840) * n6,
      (212378941 / 319334400) * n6,
    ];
    const beta = [
      0,
      n / 2 - (2 / 3) * n2 + (37 / 96) * n3 - (1 / 360) * n4 - (81 / 512) * n5 + (96199 / 604800) * n6,
      (1 / 48) * n2 + (1 / 15) * n3 - (437 / 1440) * n4 + (46 / 105) * n5 - (1118711 / 3870720) * n6,
      (17 / 480) * n3 - (37 / 840) * n4 - (209 / 4480) * n5 + (5569 / 90720) * n6,
      (4397 / 161280) * n4 - (11 / 504) * n5 - (830251 / 7257600) * n6,
      (4583 / 161280) * n5 - (108847 / 3991680) * n6,
      (20648693 / 638668800) * n6,
    ];
    const { lon0, k0, fe, fn } = p;

    function forward(latDeg, lonDeg) {
      let dl = lonDeg - lon0;
      dl = ((((dl + 180) % 360) + 360) % 360) - 180;
      const lam = dl * RAD;
      const tau = Math.tan(latDeg * RAD);
      const sigma = Math.sinh(e * Math.atanh((e * tau) / Math.sqrt(1 + tau * tau)));
      const tauP = tau * Math.sqrt(1 + sigma * sigma) - sigma * Math.sqrt(1 + tau * tau);
      const xiP = Math.atan2(tauP, Math.cos(lam));
      const etaP = Math.asinh(Math.sin(lam) / Math.sqrt(tauP * tauP + Math.cos(lam) ** 2));
      let xi = xiP, eta = etaP;
      for (let j = 1; j <= 6; j++) {
        xi += alpha[j] * Math.sin(2 * j * xiP) * Math.cosh(2 * j * etaP);
        eta += alpha[j] * Math.cos(2 * j * xiP) * Math.sinh(2 * j * etaP);
      }
      return { E: fe + k0 * A * eta, N: fn + k0 * A * xi, dLon: dl };
    }

    function inverse(E, N) {
      const xi = (N - fn) / (k0 * A);
      const eta = (E - fe) / (k0 * A);
      let xiP = xi, etaP = eta;
      for (let j = 1; j <= 6; j++) {
        xiP -= beta[j] * Math.sin(2 * j * xi) * Math.cosh(2 * j * eta);
        etaP -= beta[j] * Math.cos(2 * j * xi) * Math.sinh(2 * j * eta);
      }
      const chi = Math.asin(Math.sin(xiP) / Math.cosh(etaP));
      const lam = Math.atan2(Math.sinh(etaP), Math.cos(xiP));
      const tauP = Math.tan(chi);
      let tau = tauP;
      for (let i = 0; i < 6; i++) {
        const sigma = Math.sinh(e * Math.atanh((e * tau) / Math.sqrt(1 + tau * tau)));
        const tauI = tau * Math.sqrt(1 + sigma * sigma) - sigma * Math.sqrt(1 + tau * tau);
        tau +=
          ((tauP - tauI) / Math.sqrt(1 + tauI * tauI)) *
          ((1 + (1 - el.e2) * tau * tau) / ((1 - el.e2) * Math.sqrt(1 + tau * tau)));
      }
      return { lat: Math.atan(tau) / RAD, lon: lon0 + lam / RAD };
    }

    return { forward, inverse };
  }

  /** TWD97 二度分帶：中央經線 121°（本島）或 119°（澎金馬），k0=0.9999，E0=250000 */
  const tmCache = {};
  function twd97TM(zone) {
    if (!tmCache[zone]) {
      tmCache[zone] = createTM(GRS80, { lon0: zone, k0: 0.9999, fe: 250000, fn: 0 });
    }
    return tmCache[zone];
  }

  /** 內政部公告 TWD97 ↔ TWD67（二度分帶）六參數轉換式 */
  const TWD67_A = 0.00001549;
  const TWD67_B = 0.000006521;
  const TWD67_DE = 807.8;
  const TWD67_DN = 248.6;

  function twd97ToTwd67(E, N) {
    return {
      E: E - TWD67_DE - TWD67_A * E - TWD67_B * N,
      N: N + TWD67_DN - TWD67_A * N - TWD67_B * E,
    };
  }
  function twd67ToTwd97(E, N) {
    return {
      E: E + TWD67_DE + TWD67_A * E + TWD67_B * N,
      N: N - TWD67_DN + TWD67_A * N + TWD67_B * E,
    };
  }

  /** 依經度自動判斷分帶（澎湖、金門、馬祖用 119°） */
  function autoZone(lonDeg) {
    return lonDeg < 120.5 ? 119 : 121;
  }

  const SYSTEMS = {
    WGS84: { kind: 'latlon' },
    TWD97: { kind: 'en' },
    TWD67: { kind: 'en' },
  };

  /**
   * 任意兩系統互轉。
   * from/to: 'WGS84' | 'TWD97' | 'TWD67'
   * WGS84 以 (緯度, 經度) 表示；TWD97 / TWD67 以 (E, N) 表示。
   * zone: 119 | 121 | 'auto'
   */
  function convert(from, to, v1, v2, zone = 'auto') {
    const warnings = [];
    let z = zone;
    if (z === 'auto') z = from === 'WGS84' ? autoZone(v2) : 121;
    const tm = twd97TM(z);

    // 先換成 TWD97 TM2（中繼）
    let hub;
    if (from === 'WGS84') {
      if (!(Math.abs(v1) <= 90)) throw new Error('緯度須介於 -90 ~ 90');
      if (!(Math.abs(v2) <= 180)) throw new Error('經度須介於 -180 ~ 180');
      const r = tm.forward(v1, v2);
      hub = { E: r.E, N: r.N };
      if (Math.abs(r.dLon) > 2) warnings.push('距離中央經線 ' + z + '° 超過 2°，投影變形變大，分帶可能不適合。');
    } else if (from === 'TWD97') hub = { E: v1, N: v2 };
    else hub = twd67ToTwd97(v1, v2);

    let out;
    if (to === 'WGS84') {
      const r = tm.inverse(hub.E, hub.N);
      out = { kind: 'latlon', v1: r.lat, v2: r.lon };
      if (Math.abs(r.lon - z) > 2) warnings.push('結果距離中央經線 ' + z + '° 超過 2°，請確認分帶是否正確。');
    } else if (to === 'TWD97') out = { kind: 'en', v1: hub.E, v2: hub.N };
    else {
      const r = twd97ToTwd67(hub.E, hub.N);
      out = { kind: 'en', v1: r.E, v2: r.N };
    }
    out.zone = z;
    out.warnings = warnings;
    return out;
  }

  /* ------------------------------------------------------------------ *
   * 格式化工具
   * ------------------------------------------------------------------ */

  function toDMS(deg, isLat) {
    const hemi = isLat ? (deg >= 0 ? 'N' : 'S') : deg >= 0 ? 'E' : 'W';
    const a = Math.abs(deg);
    let d = Math.floor(a);
    let m = Math.floor((a - d) * 60);
    let s = Math.round((((a - d) * 60 - m) * 60) * 1000) / 1000;
    if (s >= 60) { s = 0; m += 1; }
    if (m >= 60) { m = 0; d += 1; }
    return d + '°' + String(m).padStart(2, '0') + '′' + s.toFixed(3).padStart(6, '0') + '″ ' + hemi;
  }

  /** 長度（公尺）→ 易讀字串 */
  function fmtLength(m) {
    const a = Math.abs(m);
    if (a === 0) return '0 m';
    const sig = (v) => {
      const s = Number(v.toPrecision(3));
      return String(s);
    };
    if (a >= 1000) return sig(m / 1000) + ' km';
    if (a >= 1) return sig(m) + ' m';
    if (a >= 1e-2) return sig(m * 100) + ' cm';
    if (a >= 1e-3) return sig(m * 1e3) + ' mm';
    if (a >= 1e-6) return sig(m * 1e6) + ' µm';
    return sig(m * 1e9) + ' nm';
  }

  return {
    RAD, WGS84, GRS80, SYSTEMS,
    meridianRadius, primeVerticalRadius, degreeLengths, meridianArc, metersToDegrees,
    decimalToScaled, doubleToScaled, errorDeg, quantize, latticeStep, floatBits, fixedBits, positionError,
    createTM, twd97TM, twd97ToTwd67, twd67ToTwd97, autoZone, convert,
    toDMS, fmtLength,
  };
});
