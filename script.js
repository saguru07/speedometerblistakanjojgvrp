let elements = {};
let speedMode = 1;
let indicators = 0;

const NS = 'http://www.w3.org/2000/svg';
const clamp01 = v => Math.min(1, Math.max(0, Number(v) || 0));

// Sudut jarum (derajat, searah jarum jam dari atas)
const SWEEP = { big: [-135, 135], fuel: [205, 335], health: [155, 25] };
const MAX_SPEED = 140; // mph

/* ---------- Helper SVG ---------- */
function svgEl(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    parent.appendChild(e);
    return e;
}

const pt = (cx, cy, r, a) => {
    const t = a * Math.PI / 180;
    return [cx + r * Math.sin(t), cy - r * Math.cos(t)];
};

/** Menggambar garis skala + angka pada sebuah <g>. */
function drawScale(g, o) {
    const { cx = 100, cy = 100, r, from, to, major, minor, label, lr, cls = 'num',
            sweep = SWEEP.big, majLen = 10, minLen = 5, width = 1.6 } = o;
    const n = Math.round((to - from) / minor);
    for (let i = 0; i <= n; i++) {
        const v = from + i * minor;
        const a = sweep[0] + (v - from) / (to - from) * (sweep[1] - sweep[0]);
        const isMajor = Math.abs(v / major - Math.round(v / major)) < 1e-6;
        const [x1, y1] = pt(cx, cy, r, a);
        const [x2, y2] = pt(cx, cy, r - (isMajor ? majLen : minLen), a);
        svgEl('line', { class: 'tick', x1, y1, x2, y2, 'stroke-width': isMajor ? width : width * 0.6 }, g);
        if (isMajor && label) {
            const txt = label(v);
            if (txt === '') continue;
            const [tx, ty] = pt(cx, cy, lr, a);
            svgEl('text', { class: cls, x: tx, y: ty }, g).textContent = txt;
        }
    }
}

function setNeedle(el, fraction, sweep) {
    el.style.transform = `rotate(${sweep[0] + clamp01(fraction) * (sweep[1] - sweep[0])}deg)`;
}

const lamp = (el, on) => el.classList.toggle('on', !!on);

/* ---------- API ---------- */

/**
 * Updates the display of the engine state.
 * @param {boolean} state If true, the engine is on; otherwise, it is off.
 * @description Engine mati = seluruh cluster meredup.
 */
function setEngine(state) {
    document.body.classList.toggle('engine-off', !state);
    lamp(elements.lampEngine, state);
}

/**
 * Updates the speedometer needle.
 * @param {number} speed - The speed value in meters per second (m/s).
 * @description Jarum memakai skala mph. Tidak ada angka digital di tengah dial.
 */
function setSpeed(speed) {
    setNeedle(elements.needleSpeed, (speed * 2.236936) / MAX_SPEED, SWEEP.big);
}

let rpmValue = 0;
let rpmShake = null;
const SHAKE_FROM = 0.9; // zona 9-10 (x1000 rpm)

function applyRPM() {
    let f = rpmValue;
    if (rpmShake) {
        // makin dekat 10 makin kencang bergetarnya
        const amp = 0.008 + (rpmValue - SHAKE_FROM) * 0.12;
        f = clamp01(rpmValue + (Math.random() * 2 - 1) * amp);
    }
    setNeedle(elements.needleRpm, f, SWEEP.big);
}

/**
 * Updates the RPM needle. Di zona 9-10 jarum bergoyang sampai RPM naik/turun lagi.
 * @param {number} rpm - The RPM value (0 to 1), 1 = 10.000 RPM pada dial.
 */
function setRPM(rpm) {
    rpmValue = clamp01(rpm);
    if (rpmValue >= SHAKE_FROM) {
        if (!rpmShake) rpmShake = setInterval(applyRPM, 60);
    } else if (rpmShake) {
        clearInterval(rpmShake);
        rpmShake = null;
    }
    applyRPM();
}

/**
 * Updates the fuel gauge.
 * @param {number} fuel - The fuel level (0 to 1).
 */
function setFuel(fuel) {
    setNeedle(elements.needleFuel, fuel, SWEEP.fuel);
}

/**
 * Updates the engine health gauge. Lampu mesin berubah oranye jika health < 30%.
 * @param {number} health - The vehicle health level (0 to 1).
 */
function setHealth(health) {
    setNeedle(elements.needleHealth, health, SWEEP.health);
    elements.lampEngine.classList.toggle('warn', clamp01(health) < 0.3);
}

let maxGear = 6;

/** Membuat deretan indikator gear: R, 1 ... maxGear. */
function buildGears(max) {
    maxGear = max;
    const wrap = elements.gears;
    wrap.replaceChildren();
    ['R', ...Array.from({ length: max }, (_, i) => String(i + 1))].forEach(label => {
        const span = document.createElement('span');
        span.className = 'gear' + (label === 'R' ? ' rev' : '');
        span.dataset.gear = label;
        span.textContent = label;
        wrap.appendChild(span);
    });
}

/**
 * Sets the highest gear shown on the gear indicator.
 * @param {number} max - Jumlah gigi maju (mis. 5 atau 6).
 */
function setMaxGear(max) {
    buildGears(Math.max(1, Math.floor(max)));
}

/**
 * Updates the gear indicator. Hanya satu indikator menyala:
 * R = merah, 1 / 2 / ... = hijau. Tidak ada neutral: gear 0 atau negatif = R.
 * Perubahan di-fade lewat CSS transition.
 * @param {number} gear - The current gear: 0 or negative = reverse, 1+ = forward gear.
 */
function setGear(gear) {
    const key = gear <= 0 ? 'R' : String(Math.min(gear, maxGear));
    elements.gears.querySelectorAll('.gear').forEach(g => g.classList.toggle('on', g.dataset.gear === key));
}

/**
 * Updates the headlights status display.
 * @param {number} state - The headlight state (0: Off, 1: On, 2: High Beam).
 */
function setHeadlights(state) {
    elements.lampHeadlights.classList.toggle('low', state === 1);
    elements.lampHeadlights.classList.toggle('high', state === 2);
}

/**
 * Sets the state of the left turn indicator.
 * @param {boolean} state - If true, turns the left indicator on; otherwise, turns it off.
 */
function setLeftIndicator(state) {
    indicators = (indicators & 0b10) | (state ? 0b01 : 0b00);
    lamp(elements.lampLeft, state);
}

/**
 * Sets the state of the right turn indicator.
 * @param {boolean} state - If true, turns the right indicator on; otherwise, turns it off.
 */
function setRightIndicator(state) {
    indicators = (indicators & 0b01) | (state ? 0b10 : 0b00);
    lamp(elements.lampRight, state);
}

/**
 * Updates the seatbelt warning. Lampu merah menyala jika sabuk BELUM terpasang.
 * @param {boolean} state - If true, seatbelts are fastened; otherwise, they are not.
 */
function setSeatbelts(state) {
    lamp(elements.lampSeatbelt, !state);
}

/**
 * Dipertahankan agar kompatibel. Dial hanya menampilkan mph, jadi mode tidak berpengaruh.
 * @param {number} mode - (tidak dipakai)
 */
function setSpeedMode(mode) {
    speedMode = mode;
}

const ODO_DIGITS = 6;

/** Membuat kolom angka odometer mekanik. */
function buildOdometer() {
    elements.odometer.replaceChildren();
    for (let i = 0; i < ODO_DIGITS; i++) {
        const cell = document.createElement('div');
        cell.className = 'odo-cell';
        cell.appendChild(document.createElement('span')).textContent = '0';
        elements.odometer.appendChild(cell);
    }
}

/** Angka baru turun dari atas dan menggantikan angka lama yang turun keluar. */
function rollDigit(cell, value) {
    const spans = cell.querySelectorAll('span');
    const current = spans[spans.length - 1];
    if (current.textContent === value) return;
    spans.forEach(s => { if (s !== current) s.remove(); });

    const next = document.createElement('span');
    next.textContent = value;
    next.style.transition = 'none';
    next.style.transform = 'translateY(-100%)';
    cell.appendChild(next);
    void next.offsetHeight; // paksa reflow agar transisi berjalan
    next.style.transition = '';
    next.style.transform = 'translateY(0)';
    current.style.transform = 'translateY(100%)';
    setTimeout(() => current.remove(), 400);
}

/**
 * Updates the odometer display (6 digit, digit terakhir = 0.1 mil).
 * @param {number} distance - The distance in miles.
 */
function setOdometer(distance) {
    const value = Math.min(10 ** ODO_DIGITS - 1, Math.max(0, Math.floor(distance * 10)));
    const digits = String(value).padStart(ODO_DIGITS, '0');
    elements.odometer.querySelectorAll('.odo-cell').forEach((cell, i) => rollDigit(cell, digits[i]));
}

// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
    const $ = id => document.getElementById(id);
    elements = {
        gears: $('gears'),
        odometer: $('odometer'),
        needleRpm: $('needle-rpm'),
        needleSpeed: $('needle-speed'),
        needleFuel: $('needle-fuel'),
        needleHealth: $('needle-health'),
        lampEngine: $('lamp-engine'),
        lampHeadlights: $('lamp-headlights'),
        lampLeft: $('lamp-left'),
        lampRight: $('lamp-right'),
        lampSeatbelt: $('lamp-seatbelt'),
    };

    // Tachometer 0-10 (x1000) + redzone 8-10
    const tach = $('tach-scale');
    drawScale(tach, { r: 90, from: 0, to: 10, major: 1, minor: 0.5, lr: 70, label: v => v, majLen: 12 });
    const [rx1, ry1] = pt(100, 100, 82, 8 * 27 - 135), [rx2, ry2] = pt(100, 100, 82, 135);
    svgEl('path', { class: 'redzone', d: `M${rx1} ${ry1}A82 82 0 0 1 ${rx2} ${ry2}` }, tach);

    // Speedometer 0-140 mph
    drawScale($('speed-scale'), { r: 90, from: 0, to: MAX_SPEED, major: 20, minor: 10, lr: 68, cls: 'num', label: v => v, majLen: 11, minLen: 6 });

    // Fuel (E-F) dan Engine Health (0-100)
    const small = { cy: 100, r: 56, from: 0, to: 1, major: 0.5, minor: 0.125, majLen: 9, minLen: 6, lr: 40, cls: 'num tiny' };
    drawScale($('fuel-scale'), { ...small, cx: 70, sweep: SWEEP.fuel, label: v => (v === 0 ? 'E' : v === 1 ? 'F' : '') });
    drawScale($('health-scale'), { ...small, cx: 130, sweep: SWEEP.health, label: v => (v === 0 ? '0' : v === 1 ? '100' : '') });

    buildGears(maxGear);
    buildOdometer();

    // Posisi awal
    setEngine(false); setSpeed(0); setRPM(0); setFuel(0); setHealth(1);

    // Preview di browser: buka index.html#demo
    if (location.hash === '#demo') {
        let t = 0;
        setEngine(true); let odo = 12345.6; setOdometer(odo); setFuel(0.65); setHeadlights(1); setSeatbelts(true);
        setInterval(() => {
            t += 0.03;
            const k = (Math.sin(t) + 1) / 2;
            odo += 0.02 + k * 0.1; setOdometer(odo); setSpeed(k * 60); setGear(Math.min(maxGear, 1 + Math.floor(k * maxGear))); setRPM(0.15 + k * 0.75); setHealth(1 - k * 0.8);
            setLeftIndicator(Math.sin(t * 8) > 0);
        }, 50);
    }
});
