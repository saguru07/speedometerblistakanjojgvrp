let elements = {};
let speedMode = 1;
let indicators = 0;

const NS = 'http://www.w3.org/2000/svg';
const clamp01 = v => Math.min(1, Math.max(0, Number(v) || 0));

// Sudut jarum (derajat, searah jarum jam dari atas)
const SWEEP = { big: [-135, 135], small: [-70, 70] };

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
}

/**
 * Updates the speed display based on the current speed mode.
 * @param {number} speed - The speed value in meters per second (m/s).
 * @description Jarum selalu memakai skala km/h; angka digital mengikuti speed mode.
 */
function setSpeed(speed) {
    setNeedle(elements.needleSpeed, (speed * 3.6) / 240, SWEEP.big);
    switch (speedMode) {
        case 1: elements.speed.textContent = `${Math.round(speed * 2.236936)} MPH`; break; // MPH
        case 2: elements.speed.textContent = `${Math.round(speed * 1.943844)} Knots`; break; // Knots
        default: elements.speed.textContent = `${Math.round(speed * 3.6)} KMH`; // KMH
    }
}

/**
 * Updates the RPM needle.
 * @param {number} rpm - The RPM value (0 to 1), 1 = 10.000 RPM pada dial.
 */
function setRPM(rpm) {
    setNeedle(elements.needleRpm, rpm, SWEEP.big);
}

/**
 * Updates the fuel gauge.
 * @param {number} fuel - The fuel level (0 to 1).
 */
function setFuel(fuel) {
    setNeedle(elements.needleFuel, fuel, SWEEP.small);
}

/**
 * Updates the engine health gauge. Lampu check engine menyala jika health < 30%.
 * @param {number} health - The vehicle health level (0 to 1).
 */
function setHealth(health) {
    setNeedle(elements.needleHealth, health, SWEEP.small);
    lamp(elements.lampEngine, clamp01(health) < 0.3);
}

/**
 * Updates the current gear display.
 * @param {number} gear - The current gear to display. 0 represents neutral/reverse.
 */
function setGear(gear) {
    elements.gear.textContent = gear === 0 ? 'N/R' : String(gear);
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
 * Sets the speed display mode.
 * @param {number} mode - The speed mode to set (0: KMH, 1: MPH, 2: Knots).
 */
function setSpeedMode(mode) {
    speedMode = mode;
}

/**
 * Updates the odometer display.
 * @param {number} distance - The distance in miles.
 */
function setOdometer(distance) {
    elements.odometer.textContent = distance.toFixed(1) + ' mi';
}

// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
    const $ = id => document.getElementById(id);
    elements = {
        speed: $('speed'),
        gear: $('gear'),
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

    // Speedometer 0-240 km/h
    drawScale($('speed-scale'), { r: 90, from: 0, to: 240, major: 20, minor: 10, lr: 68, cls: 'num tiny', label: v => v, majLen: 11, minLen: 6 });

    // Fuel (E-F) dan Engine Health (0-100)
    const small = { cy: 104, r: 44, from: 0, to: 1, major: 0.5, minor: 0.25, sweep: SWEEP.small, majLen: 8, minLen: 5, lr: 29, cls: 'num tiny' };
    drawScale($('fuel-scale'), { ...small, cx: 58, label: v => (v === 0 ? 'E' : v === 1 ? 'F' : '') });
    drawScale($('health-scale'), { ...small, cx: 142, label: v => (v === 0 ? '0' : v === 1 ? '100' : '') });

    // Posisi awal
    setSpeed(0); setRPM(0); setFuel(0); setHealth(1);

    // Preview di browser: buka index.html#demo
    if (location.hash === '#demo') {
        let t = 0;
        setOdometer(12345.6); setGear(3); setFuel(0.65); setHeadlights(1); setSeatbelts(true);
        setInterval(() => {
            t += 0.03;
            const k = (Math.sin(t) + 1) / 2;
            setSpeed(k * 60); setRPM(0.15 + k * 0.75); setHealth(1 - k * 0.8);
            setLeftIndicator(Math.sin(t * 8) > 0);
        }, 50);
    }
});
