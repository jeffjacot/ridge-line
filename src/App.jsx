import React, { useState, useEffect, useMemo, useCallback } from "react";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

/* ---------- design tokens ----------
  Palette: deep trail forest + topo paper + trail-marker amber
  #14201A bg / #1E2E24 surface / #26372C surface-raised
  #F3EEE1 paper / #EDE8D8 ink / #9FB0A2 ink-soft
  #C8962C amber (marker/accent) / #A24632 rust (effort/alert) / #5C7A63 moss (secondary)
  Display: Oswald (condensed signage) / Body: Inter / Mono: IBM Plex Mono (stats)
------------------------------------- */

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap');`;

const COLORS = {
  bg: "#14201A",
  surface: "#1E2E24",
  raised: "#263A2E",
  paper: "#F3EEE1",
  ink: "#EDE8D8",
  inkSoft: "#9FB0A2",
  amber: "#C8962C",
  rust: "#B25239",
  moss: "#5C7A63",
  line: "#33473A",
};

const uid = () => Math.random().toString(36).slice(2, 10);
const STRAVA_CLIENT_ID = "267417";
const fmtDate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const todayStr = () => fmtDate(new Date());
const daysBetween = (a, b) => Math.round((b - a) / 86400000);

// ---------- plan generation ----------
// Professional 50-mile periodization for an athlete who is already well-trained
// (no generic base-building block — time goes straight into vert/threshold work).
// Structure: Foundation -> Build I -> Build II -> Peak -> Taper -> Race Week,
// with a cutback (~30% volume reduction) every 4th week to protect adaptation.
const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const SHORT_IDX = { Mon: 0, Tue: 1, Thu: 3, Fri: 4, Sat: 5 };

const PHASE_DEFS = [
  {
    name: "Foundation",
    color: COLORS.moss,
    longRun: [10, 16],
    totalFactor: 3.0,
    weights: { Mon: 0.18, Tue: 0.22, Thu: 0.2, Fri: 0.15, Sat: 0.25 },
    strengthDays: ["Tue", "Fri"],
    labels: { Tue: "Zone 2 easy", Fri: "Hill repeats" },
    wedLabel: "Long Run (aerobic)",
    focus: "Re-establish load, introduce hill repeats and general strength before volume climbs",
  },
  {
    name: "Build I",
    color: COLORS.amber,
    longRun: [16, 23],
    totalFactor: 2.8,
    weights: { Mon: 0.15, Tue: 0.22, Thu: 0.18, Fri: 0.15, Sat: 0.3 },
    strengthDays: ["Tue", "Fri"],
    labels: { Tue: "Tempo / threshold", Fri: "Hill repeats (extended)" },
    wedLabel: "Long Run + vert",
    focus: "Build vertical gain and threshold fitness, max-strength phase in the gym",
  },
  {
    name: "Build II",
    color: COLORS.amber,
    longRun: [23, 27],
    totalFactor: 2.4,
    weights: { Mon: 0.12, Tue: 0.18, Thu: 0.4, Fri: 0.1, Sat: 0.2 },
    strengthDays: ["Fri"],
    labels: { Tue: "Tempo / threshold", Thu: "Back-to-Back Long Run", Fri: "Zone 2 easy (recovery)" },
    wedLabel: "Long Run — race-specific terrain",
    focus: "Consecutive-day fatigue (Wed+Thu) to simulate late-race legs; fueling and gear rehearsal on long days",
  },
  {
    name: "Peak",
    color: COLORS.rust,
    longRun: [27, 31],
    totalFactor: 2.2,
    weights: { Mon: 0.1, Tue: 0.15, Thu: 0.45, Fri: 0.1, Sat: 0.2 },
    strengthDays: ["Fri"],
    labels: { Tue: "Tempo / threshold (race-pace)", Thu: "Back-to-Back Long Run (race simulation)", Fri: "Zone 2 easy (recovery)" },
    wedLabel: "Long Run — race simulation",
    focus: "Highest volume and biggest back-to-back of the cycle, then sharp drop into taper",
  },
];

// Hip-focused strength library — glute medius/abductor and hip-flexor work,
// since that's the reported weak link late in a 50-mile effort.
const STRENGTH_LIBRARY = {
  Foundation: {
    subtitle: "General strength — build the base before load climbs",
    exercises: [
      { name: "Side-lying hip abduction", sets: "3 x 15 / leg", note: "Slow, controlled — this is glute medius, your #1 hip stabilizer" },
      { name: "Clamshells with band", sets: "3 x 15 / leg", note: "Band above knees, hips stacked" },
      { name: "Standing monster walks (band)", sets: "3 x 10 steps each direction", note: "Band above ankles, stay low" },
      { name: "Single-leg glute bridge", sets: "3 x 12 / leg", note: "Pause 1s at top, squeeze glute not low back" },
      { name: "Bulgarian split squat (bodyweight or light)", sets: "3 x 10 / leg", note: "Rear foot elevated, front knee tracks over toes" },
      { name: "Side plank with hip abduction", sets: "3 x 30-45s / side", note: "Top leg lifts and lowers slowly" },
    ],
  },
  "Build I": {
    subtitle: "Max strength — heavier load, lower reps, still hip-first",
    exercises: [
      { name: "Weighted Bulgarian split squat", sets: "4 x 6 / leg", note: "Load with dumbbells or barbell, control the descent" },
      { name: "Single-leg RDL (deadlift)", sets: "4 x 8 / leg", note: "Hip hinge, flat back — trains the posterior hip chain" },
      { name: "Weighted step-ups", sets: "4 x 8 / leg", note: "Knee-height box or higher, drive through the heel" },
      { name: "Copenhagen plank (adductor)", sets: "3 x 20-30s / side", note: "Top foot on bench — often the missing piece for hip stability" },
      { name: "Weighted single-leg glute bridge", sets: "3 x 10 / leg", note: "Plate or band across hips" },
      { name: "Pallof press", sets: "3 x 10 / side", note: "Anti-rotation — trains hips and core to resist collapse" },
    ],
  },
  "Build II / Peak": {
    subtitle: "Power-endurance — lighter load, more reps, fatigued-state stability",
    exercises: [
      { name: "Single-leg squat to box", sets: "3 x 8 / leg", note: "Slow and controlled, focus on knee tracking" },
      { name: "Lateral band walks", sets: "3 x 15 steps / direction", note: "Stay low, band at ankles" },
      { name: "Single-leg glute bridge march", sets: "3 x 10 / leg", note: "Add the marching lift for hip-flexor/glute coordination" },
      { name: "Side plank with leg lift", sets: "3 x 10 / leg", note: "Do this one after an easy run to train stability under fatigue" },
      { name: "Standing hip flexor march (band)", sets: "3 x 15 / leg", note: "Band around foot, drive knee up against resistance" },
      { name: "Single-leg calf raise", sets: "3 x 15 / leg", note: "Ancillary — supports the whole kinetic chain late in the race" },
    ],
  },
  Taper: {
    subtitle: "Activation only — no new strength stimulus, just stay switched on",
    exercises: [
      { name: "Clamshells with band", sets: "2 x 15 / leg", note: "Light, easy — this is maintenance not training" },
      { name: "Glute bridge", sets: "2 x 15", note: "Bodyweight only" },
      { name: "Side plank", sets: "2 x 30s / side", note: "Hold, don't add movement" },
      { name: "Hip flexor mobility stretch", sets: "2 x 30s / side", note: "Kneeling lunge stretch, breathe into it" },
    ],
  },
};

// ---------- food database ----------
// Macros per 100g. gramsPerCup / servingGrams are set only where that unit makes sense.
const GRAMS_PER_UNIT = { g: 1, oz: 28.3495, lb: 453.592 };
const FOOD_DB = [
  { name: "Chicken breast, cooked", cal: 165, protein: 31, carbs: 0, fat: 3.6, defaultUnit: "oz" },
  { name: "White rice, cooked", cal: 130, protein: 2.7, carbs: 28, fat: 0.3, gramsPerCup: 158, defaultUnit: "cup" },
  { name: "Brown rice, cooked", cal: 123, protein: 2.7, carbs: 25.6, fat: 1.0, gramsPerCup: 195, defaultUnit: "cup" },
  { name: "Sweet potato, baked", cal: 90, protein: 2, carbs: 21, fat: 0.1, servingGrams: 130, defaultUnit: "serving" },
  { name: "Potato, baked", cal: 93, protein: 2.5, carbs: 21, fat: 0.1, servingGrams: 173, defaultUnit: "serving" },
  { name: "Banana", cal: 89, protein: 1.1, carbs: 22.8, fat: 0.3, servingGrams: 118, defaultUnit: "serving" },
  { name: "Apple", cal: 52, protein: 0.3, carbs: 13.8, fat: 0.2, servingGrams: 182, defaultUnit: "serving" },
  { name: "Orange", cal: 47, protein: 0.9, carbs: 11.8, fat: 0.1, servingGrams: 131, defaultUnit: "serving" },
  { name: "Blueberries", cal: 57, protein: 0.7, carbs: 14.5, fat: 0.3, gramsPerCup: 148, defaultUnit: "cup" },
  { name: "Oatmeal, dry", cal: 389, protein: 16.9, carbs: 66.3, fat: 6.9, gramsPerCup: 80, defaultUnit: "cup" },
  { name: "Egg, whole, cooked", cal: 155, protein: 13, carbs: 1.1, fat: 11, servingGrams: 50, defaultUnit: "serving" },
  { name: "Egg whites", cal: 52, protein: 10.9, carbs: 0.7, fat: 0.2, servingGrams: 33, defaultUnit: "serving" },
  { name: "Whole milk", cal: 61, protein: 3.2, carbs: 4.8, fat: 3.3, gramsPerCup: 244, defaultUnit: "cup" },
  { name: "Greek yogurt, plain nonfat", cal: 59, protein: 10.2, carbs: 3.6, fat: 0.4, gramsPerCup: 245, defaultUnit: "cup" },
  { name: "Peanut butter", cal: 588, protein: 25, carbs: 20, fat: 50, servingGrams: 32, defaultUnit: "serving" },
  { name: "White bread", cal: 265, protein: 9, carbs: 49, fat: 3.2, servingGrams: 25, defaultUnit: "serving" },
  { name: "Avocado", cal: 160, protein: 2, carbs: 8.5, fat: 14.7, servingGrams: 100, defaultUnit: "serving" },
  { name: "Salmon, cooked", cal: 208, protein: 20, carbs: 0, fat: 13, defaultUnit: "oz" },
  { name: "Ground beef 90/10, cooked", cal: 176, protein: 20, carbs: 0, fat: 10, defaultUnit: "oz" },
  { name: "Black beans, cooked", cal: 132, protein: 8.9, carbs: 23.7, fat: 0.5, gramsPerCup: 172, defaultUnit: "cup" },
  { name: "Broccoli, cooked", cal: 35, protein: 2.4, carbs: 7.2, fat: 0.4, defaultUnit: "oz" },
  { name: "Spinach, raw", cal: 23, protein: 2.9, carbs: 3.6, fat: 0.4, defaultUnit: "oz" },
  { name: "Almonds", cal: 579, protein: 21, carbs: 22, fat: 50, servingGrams: 28, defaultUnit: "serving" },
  { name: "Olive oil", cal: 884, protein: 0, carbs: 0, fat: 100, servingGrams: 13.5, defaultUnit: "serving" },
  { name: "Butter", cal: 717, protein: 0.9, carbs: 0.1, fat: 81, servingGrams: 14, defaultUnit: "serving" },
  { name: "Honey", cal: 304, protein: 0.3, carbs: 82.4, fat: 0, defaultUnit: "oz" },
  { name: "Maple syrup", cal: 260, protein: 0, carbs: 67, fat: 0.06, defaultUnit: "oz" },
  { name: "Energy gel (generic)", cal: 312, protein: 0, carbs: 78, fat: 0, servingGrams: 32, defaultUnit: "serving" },
  { name: "Sports drink (generic)", cal: 25, protein: 0, carbs: 6, fat: 0, servingGrams: 240, defaultUnit: "serving" },
  { name: "Pretzels", cal: 380, protein: 10, carbs: 79, fat: 2.6, servingGrams: 28, defaultUnit: "serving" },
  { name: "Pasta, cooked", cal: 131, protein: 5, carbs: 25, fat: 1.1, gramsPerCup: 140, defaultUnit: "cup" },
  { name: "Tortilla, flour", cal: 306, protein: 8.2, carbs: 51, fat: 7.5, servingGrams: 45, defaultUnit: "serving" },
  { name: "Cheddar cheese", cal: 403, protein: 25, carbs: 1.3, fat: 33, servingGrams: 28, defaultUnit: "serving" },
  { name: "Tuna, canned in water", cal: 116, protein: 25.5, carbs: 0, fat: 0.8, defaultUnit: "oz" },
  { name: "Quinoa, cooked", cal: 120, protein: 4.4, carbs: 21.3, fat: 1.9, gramsPerCup: 185, defaultUnit: "cup" },
  { name: "Tofu, firm", cal: 144, protein: 15.5, carbs: 3.9, fat: 8.7, defaultUnit: "oz" },
  { name: "Whey protein powder", cal: 400, protein: 80, carbs: 8, fat: 6.7, servingGrams: 30, defaultUnit: "serving" },
];

function unitsForFood(food) {
  const units = ["g", "oz", "lb"];
  if (food.gramsPerCup) units.push("cup");
  if (food.servingGrams) units.push("serving");
  return units;
}
function gramsForUnit(food, unit, amount) {
  const n = Number(amount) || 0;
  if (unit === "cup") return n * (food.gramsPerCup || 0);
  if (unit === "serving") return n * (food.servingGrams || 0);
  return n * (GRAMS_PER_UNIT[unit] || 1);
}
function macrosForGrams(food, grams) {
  const f = grams / 100;
  return {
    cal: Math.round(food.cal * f),
    protein: Math.round(food.protein * f * 10) / 10,
    carbs: Math.round(food.carbs * f * 10) / 10,
    fat: Math.round(food.fat * f * 10) / 10,
  };
}

function buildDaySchedule(weekStartSunday, phaseDef, longRun, isCutback, reducedFreq) {
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStartSunday);
    d.setDate(d.getDate() + i);
    const name = DAY_NAMES[i];
    days.push({ date: fmtDate(d), dayName: name, short: name.slice(0, 3), miles: 0, type: "Rest", strength: false });
  }

  days[2].type = phaseDef.wedLabel;
  days[2].miles = longRun;

  const cutMult = isCutback ? 0.72 : 1;
  const totalWeekly = longRun * phaseDef.totalFactor * cutMult;
  const nonLong = Math.max(totalWeekly - longRun, 0);

  // 5-day mode: only meaningful in Foundation/Build I, where Thursday is just
  // filler easy mileage. In Build II/Peak, Thursday is the deliberate
  // back-to-back long effort — too structurally important to drop, so it's
  // left untouched there even if the toggle is on.
  const canReduce = reducedFreq && (phaseDef.name === "Foundation" || phaseDef.name === "Build I");
  let weights = phaseDef.weights;
  if (canReduce) {
    weights = { ...phaseDef.weights };
    const thuWeight = weights.Thu || 0;
    delete weights.Thu;
    const remainingKeys = Object.keys(weights);
    const remainingSum = remainingKeys.reduce((s, k) => s + weights[k], 0) || 1;
    remainingKeys.forEach((k) => {
      weights[k] = weights[k] + thuWeight * (weights[k] / remainingSum);
    });
  }

  Object.entries(weights).forEach(([short, weight]) => {
    const idx = SHORT_IDX[short];
    let miles = Math.round(nonLong * weight);
    if (miles < 2) miles = 2;
    days[idx].miles = miles;
    days[idx].type = phaseDef.labels[short] || "Zone 2 easy";
    days[idx].strength = phaseDef.strengthDays.includes(short);
  });
  // Thursday, when dropped, keeps its default { type: "Rest", miles: 0 } from above.

  return days;
}

function buildTaperDays(weekStartSunday, taperIdx, peakLongRun) {
  const factors = [0.6, 0.4, 0.25];
  const longRun = Math.round(peakLongRun * (factors[taperIdx] ?? 0.3));
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStartSunday);
    d.setDate(d.getDate() + i);
    days.push({ date: fmtDate(d), dayName: DAY_NAMES[i], short: DAY_NAMES[i].slice(0, 3), miles: 0, type: "Rest", strength: false });
  }
  days[0] = { ...days[0], type: "Zone 2 easy (short)", miles: Math.max(3, Math.round(longRun * 0.3)) };
  days[1] = { ...days[1], type: "Zone 2 easy + light mobility", miles: Math.max(3, Math.round(longRun * 0.35)), strength: true };
  days[2] = { ...days[2], type: "Long Run (reduced)", miles: longRun };
  days[3] = { ...days[3], type: "Zone 2 easy (short)", miles: Math.max(2, Math.round(longRun * 0.25)) };
  days[4] = { ...days[4], type: taperIdx >= 2 ? "Rest / optional shakeout" : "Zone 2 easy (short)", miles: taperIdx >= 2 ? 0 : 3 };
  days[5] = { ...days[5], type: "Shakeout jog", miles: taperIdx >= 2 ? 2 : 4 };
  return { days, longRun };
}

function buildRaceWeekDays(weekStartMonday, raceDate) {
  const days = [];
  const raceIdx = (raceDate.getDay() + 6) % 7; // convert JS Sun=0 to our Mon=0 index
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStartMonday);
    d.setDate(d.getDate() + i);
    const offset = i - raceIdx;
    let type = "Rest",
      miles = 0;
    if (offset === 0) { type = "RACE DAY — 50 Miles"; miles = 50; }
    else if (offset === -1) { type = "Rest — pre-race"; }
    else if (offset === -2) { type = "Shakeout jog"; miles = 2; }
    else if (offset === -3) { type = "Zone 2 easy (short)"; miles = 3; }
    else if (offset < -3) { type = "Zone 2 easy (short)"; miles = 3; }
    else if (offset > 0) { type = "Recovery — rest"; }
    days.push({ date: fmtDate(d), dayName: DAY_NAMES[i], short: DAY_NAMES[i].slice(0, 3), miles, type, strength: false });
  }
  return days;
}

function mondayOf(date) {
  const d = new Date(date);
  const diff = (d.getDay() + 6) % 7; // days since most recent Monday
  d.setDate(d.getDate() - diff);
  return d;
}

function buildPlan(raceDateStr, planStartDateStr, reducedFreq) {
  const race = new Date(raceDateStr + "T00:00:00");
  const planStart = mondayOf(new Date((planStartDateStr || fmtDate(new Date())) + "T00:00:00"));
  const raceMonday = mondayOf(race);

  let totalWeeks = Math.round(daysBetween(planStart, raceMonday) / 7) + 1;
  if (totalWeeks < 6) totalWeeks = 6; // guard against a too-short window

  const remaining = totalWeeks - 1; // last week reserved for Race Week
  const foundationLen = Math.max(2, Math.round(remaining * 0.15));
  const buildILen = Math.max(4, Math.round(remaining * 0.3));
  const peakLen = Math.max(3, Math.round(remaining * 0.15));
  const taperLen = 3;
  const buildIILen = Math.max(2, remaining - foundationLen - buildILen - peakLen - taperLen);

  const phaseBlocks = [
    { def: PHASE_DEFS[0], len: foundationLen },
    { def: PHASE_DEFS[1], len: buildILen },
    { def: PHASE_DEFS[2], len: buildIILen },
    { def: PHASE_DEFS[3], len: peakLen },
  ];

  const weeks = [];
  let weekCursor = 0;
  let peakLongRunSeen = PHASE_DEFS[3].longRun[0];

  phaseBlocks.forEach((block) => {
    const { def, len } = block;
    const slowGrowth = reducedFreq && (def.name === "Foundation" || def.name === "Build I");
    for (let i = 0; i < len; i++) {
      const weekStart = new Date(planStart);
      weekStart.setDate(weekStart.getDate() + weekCursor * 7);
      const p = len > 1 ? i / (len - 1) : 1;
      const pGrowth = slowGrowth ? Math.pow(p, 1.6) : p; // bows the curve so early weeks add less, later weeks catch up
      const longRunRaw = def.longRun[0] + (def.longRun[1] - def.longRun[0]) * pGrowth;
      const isCutback = i > 0 && (i + 1) % 4 === 0;
      const longRun = Math.round(isCutback ? longRunRaw * 0.75 : longRunRaw);
      if (def.name === "Peak") peakLongRunSeen = Math.max(peakLongRunSeen, longRun);
      const days = buildDaySchedule(weekStart, def, longRun, isCutback, reducedFreq);
      const totalMiles = days.reduce((s, d) => s + (d.miles || 0), 0);
      weeks.push({
        week: weekCursor + 1,
        start: fmtDate(weekStart),
        phase: def.name,
        color: def.color,
        longRun,
        totalMiles,
        days,
        focus: isCutback ? `Cutback week — volume down ~25-30% to absorb load. ${def.focus}` : def.focus,
        isCutback,
      });
      weekCursor++;
    }
  });

  for (let i = 0; i < taperLen; i++) {
    const weekStart = new Date(planStart);
    weekStart.setDate(weekStart.getDate() + weekCursor * 7);
    const { days, longRun } = buildTaperDays(weekStart, i, peakLongRunSeen);
    const totalMiles = days.reduce((s, d) => s + (d.miles || 0), 0);
    weeks.push({
      week: weekCursor + 1,
      start: fmtDate(weekStart),
      phase: "Taper",
      color: "#7A8FA0",
      longRun,
      totalMiles,
      days,
      focus: "Cut volume, hold a little intensity, protect sleep and nutrition — fitness is banked",
      isCutback: false,
    });
    weekCursor++;
  }

  const raceWeekStart = new Date(planStart);
  raceWeekStart.setDate(raceWeekStart.getDate() + weekCursor * 7);
  const raceDays = buildRaceWeekDays(raceWeekStart, race);
  weeks.push({
    week: weekCursor + 1,
    start: fmtDate(raceWeekStart),
    phase: "Race Week",
    color: COLORS.paper,
    longRun: 0,
    totalMiles: raceDays.reduce((s, d) => s + (d.miles || 0), 0),
    days: raceDays,
    focus: "Shakeouts only, carb-load into race day, rest",
    isCutback: false,
  });

  return { raceDate: raceDateStr, startDate: fmtDate(planStart), weeks };
}

// Works out the calorie target, activity estimate, deficit, and prescribed
// session for ANY date — not just today — so both the Dashboard (today) and
// the Nutrition tab (any day you're looking back at) can share one source
// of truth instead of duplicating this math.
function computeDayEnergy(dateStr, profile, plan, runs) {
  const week =
    plan.weeks.find((w) => {
      const start = new Date(w.start + "T00:00:00");
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      const d = new Date(dateStr + "T00:00:00");
      return d >= start && d < end;
    }) || plan.weeks[plan.weeks.length - 1];
  const prescription = week.days.find((d) => d.date === dateStr) || null;
  const isHardDay = !!prescription && /Long Run|Back-to-Back/.test(prescription.type);
  const run = runs.find((r) => r.date === dateStr);
  const activityKcal = run ? Math.round(Number(run.durationMin || 0) * 11) : 0;
  const rawDeficit = profile.weightLossMode && !isHardDay ? Number(profile.deficitKcal || 0) : 0;
  const preDeficitTarget = Number(profile.baseTDEE || 0);
  const safetyFloor = Math.max(1200, Number(profile.baseTDEE || 0) * 0.75);
  const targetKcal = Math.round(Math.max(preDeficitTarget - rawDeficit, safetyFloor));
  const appliedDeficit = preDeficitTarget - targetKcal;
  return { targetKcal, activityKcal, appliedDeficit, isHardDay, prescription, phase: week.phase };
}

// Latest value for a body-comp field (weightLb / bodyFatPct / muscleMassLb),
// plus how it's changed vs the reading from roughly a week earlier — used
// to show "gaining/losing" direction, not just a raw current number.
function latestWithTrend(weightLogs, field) {
  const withField = (weightLogs || [])
    .filter((w) => w[field] != null)
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  if (withField.length === 0) return null;
  const latest = withField[0];
  const cutoff = new Date(latest.date + "T00:00:00");
  cutoff.setDate(cutoff.getDate() - 6);
  const older = withField.find((w) => new Date(w.date + "T00:00:00") <= cutoff);
  const delta = older ? Math.round((latest[field] - older[field]) * 10) / 10 : null;
  return { value: latest[field], delta, date: latest.date };
}

// Suggested macro split for a given day's calorie target. Protein anchors to
// bodyweight when known (0.8 g/lb is a solid endurance+strength number,
// comfortably covers muscle maintenance even in a deficit). Fat holds a
// smaller share on hard/long-run days, leaving more of the budget for carbs
// to fuel and refill glycogen; the deficit itself is already baked into
// targetKcal by the time it gets here.
function calcMacroTargets(targetKcal, weightLb, isHardDay) {
  const proteinG = weightLb ? Math.round(Number(weightLb) * 0.8) : Math.round((targetKcal * 0.25) / 4);
  const fatPct = isHardDay ? 0.2 : 0.25;
  const proteinKcal = proteinG * 4;
  const fatG = Math.round((targetKcal * fatPct) / 9);
  const fatKcal = fatG * 9;
  const carbsG = Math.max(Math.round((targetKcal - proteinKcal - fatKcal) / 4), 0);
  return { proteinG, carbsG, fatG };
}

// ---------- elevation profile (signature element) ----------
function ElevationProfile({ plan }) {
  const w = 720,
    h = 130,
    pad = 10;
  const n = plan.weeks.length;
  const maxLR = Math.max(...plan.weeks.map((wk) => wk.longRun), 1);
  const pts = plan.weeks.map((wk, i) => {
    const x = pad + (i / (n - 1)) * (w - pad * 2);
    const y = h - pad - (wk.longRun / maxLR) * (h - pad * 2);
    return [x, y];
  });
  const path =
    `M ${pad},${h - pad} ` +
    pts.map((p) => `L ${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ") +
    ` L ${w - pad},${h - pad} Z`;

  const today = new Date();
  const start = new Date(plan.startDate + "T00:00:00");
  const totalDays = n * 7;
  const elapsed = Math.max(0, Math.min(totalDays, daysBetween(start, today)));
  const todayX = pad + (elapsed / totalDays) * (w - pad * 2);

  const phaseChanges = [];
  let lastPhase = null;
  plan.weeks.forEach((wk, i) => {
    if (wk.phase !== lastPhase) {
      phaseChanges.push({ i, phase: wk.phase });
      lastPhase = wk.phase;
    }
  });

  return (
    <svg viewBox={`0 0 ${w} ${h + 26}`} style={{ width: "100%", height: "auto", display: "block" }}>
      <defs>
        <linearGradient id="ridge" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={COLORS.amber} stopOpacity="0.35" />
          <stop offset="100%" stopColor={COLORS.amber} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={path} fill="url(#ridge)" stroke={COLORS.amber} strokeWidth="2" strokeLinejoin="round" />
      {phaseChanges.map((pc, idx) => {
        const x = pad + (pc.i / (n - 1)) * (w - pad * 2);
        return (
          <g key={idx}>
            <line x1={x} y1={pad} x2={x} y2={h - pad} stroke={COLORS.line} strokeWidth="1" strokeDasharray="3,3" />
            <text x={x + 4} y={h + 16} fill={COLORS.inkSoft} fontSize="11" fontFamily="Inter, sans-serif">
              {pc.phase}
            </text>
          </g>
        );
      })}
      {elapsed >= 0 && elapsed <= totalDays && (
        <g>
          <line x1={todayX} y1={pad - 4} x2={todayX} y2={h - pad} stroke={COLORS.rust} strokeWidth="2" />
          <circle cx={todayX} cy={h - pad - ((plan.weeks[Math.min(n - 1, Math.floor(elapsed / 7))]?.longRun || 0) / maxLR) * (h - pad * 2)} r="4" fill={COLORS.rust} />
          <text x={todayX + 6} y={pad + 8} fill={COLORS.rust} fontSize="11" fontFamily="IBM Plex Mono, monospace" fontWeight="600">
            TODAY
          </text>
        </g>
      )}
    </svg>
  );
}

// ---------- storage helpers ----------
// Uses browser localStorage — data lives on this device/browser only, keyed
// under "ridgeline:<key>" so it won't collide with anything else on the domain.
async function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem("ridgeline:" + key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
async function saveJSON(key, value) {
  try {
    localStorage.setItem("ridgeline:" + key, JSON.stringify(value));
  } catch (e) {
    console.error("storage save failed", e);
  }
}

const ALL_STORAGE_KEYS = ["race-date", "plan-start-date", "profile", "runs", "strength-logs", "meals", "saved-meals", "saved-meal-sets"];

function exportAllData() {
  const dump = {};
  ALL_STORAGE_KEYS.forEach((k) => {
    const raw = localStorage.getItem("ridgeline:" + k);
    if (raw) dump[k] = JSON.parse(raw);
  });
  const blob = new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ridgeline-backup-${todayStr()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importAllData(file, onDone) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const dump = JSON.parse(e.target.result);
      ALL_STORAGE_KEYS.forEach((k) => {
        if (dump[k] !== undefined) localStorage.setItem("ridgeline:" + k, JSON.stringify(dump[k]));
      });
      onDone(true);
    } catch {
      onDone(false);
    }
  };
  reader.readAsText(file);
}

// ---------- shared UI bits ----------
function Card({ children, style }) {
  return (
    <div
      style={{
        background: COLORS.surface,
        border: `1px solid ${COLORS.line}`,
        borderRadius: 10,
        padding: 18,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
function Eyebrow({ children }) {
  return (
    <div
      style={{
        fontFamily: "IBM Plex Mono, monospace",
        fontSize: 11,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: COLORS.amber,
        marginBottom: 6,
      }}
    >
      {children}
    </div>
  );
}
function Stat({ label, value, unit }) {
  return (
    <div>
      <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 26, color: COLORS.paper, fontWeight: 600, lineHeight: 1.1 }}>
        {value}
        {unit && <span style={{ fontSize: 13, color: COLORS.inkSoft, marginLeft: 4 }}>{unit}</span>}
      </div>
      <div style={{ fontSize: 12, color: COLORS.inkSoft, marginTop: 2 }}>{label}</div>
    </div>
  );
}

// All three macros as one circle — concentric rings (protein outer, carbs
// middle, fat inner), each filling with its own color as you log food, plus
// a shared center readout and a legend with exact grams underneath.
function MacroRingsCombined({ macros, centerLabel, centerValue }) {
  const bands = [
    { outer: 96, inner: 80 }, // protein — outermost
    { outer: 75, inner: 59 }, // carbs — middle
    { outer: 54, inner: 38 }, // fat — innermost
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      <div style={{ width: 220, height: 220, position: "relative" }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            {macros.map((m, i) => {
              const filled = Math.min(m.have, m.target);
              const remain = Math.max(m.target - m.have, 0);
              const data = remain > 0 ? [{ v: filled }, { v: remain }] : [{ v: m.target || 1 }];
              return (
                <Pie
                  key={m.label}
                  data={data}
                  dataKey="v"
                  innerRadius={bands[i].inner}
                  outerRadius={bands[i].outer}
                  startAngle={90}
                  endAngle={-270}
                  stroke="none"
                >
                  <Cell fill={m.color} />
                  {remain > 0 && <Cell fill={COLORS.line} />}
                </Pie>
              );
            })}
          </PieChart>
        </ResponsiveContainer>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
          <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 20, fontWeight: 600, color: COLORS.paper }}>{centerValue}</div>
          <div style={{ fontSize: 11, color: COLORS.inkSoft, marginTop: 2 }}>{centerLabel}</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "center" }}>
        {macros.map((m) => {
          const over = Math.max(m.have - m.target, 0);
          const pct = m.target > 0 ? Math.min(100, Math.round((m.have / m.target) * 100)) : 0;
          return (
            <div key={m.label} style={{ textAlign: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: m.color }} />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: COLORS.ink }}>{m.label}</span>
              </div>
              <div style={{ fontSize: 11.5, color: COLORS.inkSoft, fontFamily: "IBM Plex Mono, monospace", marginTop: 2 }}>
                {Math.round(m.have)}g / {m.target}g · {pct}%
              </div>
              {over > 0 && <div style={{ fontSize: 10.5, color: COLORS.rust }}>+{Math.round(over)}g over</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
function Input(props) {
  return (
    <input
      {...props}
      style={{
        background: COLORS.bg,
        border: `1px solid ${COLORS.line}`,
        borderRadius: 6,
        padding: "8px 10px",
        color: COLORS.ink,
        fontFamily: "Inter, sans-serif",
        fontSize: 14,
        width: "100%",
        boxSizing: "border-box",
        ...(props.style || {}),
      }}
    />
  );
}
function Button({ children, onClick, variant = "primary", style }) {
  const base = {
    fontFamily: "Inter, sans-serif",
    fontWeight: 600,
    fontSize: 13,
    padding: "9px 16px",
    borderRadius: 6,
    cursor: "pointer",
    border: "none",
    letterSpacing: "0.01em",
  };
  const variants = {
    primary: { background: COLORS.amber, color: "#1B140A" },
    ghost: { background: "transparent", color: COLORS.ink, border: `1px solid ${COLORS.line}` },
    danger: { background: "transparent", color: COLORS.rust, border: `1px solid ${COLORS.rust}55` },
  };
  return (
    <button onClick={onClick} style={{ ...base, ...variants[variant], ...style }}>
      {children}
    </button>
  );
}

// Shared day-picker used by Training Log and Nutrition — lets you page
// back/forward a day at a time, jump via the date input, or snap to today.
function DateNav({ date, setDate }) {
  const shift = (delta) => {
    const d = new Date(date + "T00:00:00");
    d.setDate(d.getDate() + delta);
    setDate(fmtDate(d));
  };
  const isToday = date === todayStr();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <Button variant="ghost" onClick={() => shift(-1)} style={{ padding: "8px 12px" }}>‹</Button>
      <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ maxWidth: 160 }} />
      <Button variant="ghost" onClick={() => shift(1)} style={{ padding: "8px 12px" }}>›</Button>
      {!isToday && (
        <Button variant="ghost" onClick={() => setDate(todayStr())}>Today</Button>
      )}
      <div style={{ color: COLORS.inkSoft, fontSize: 12.5, marginLeft: 4 }}>
        {isToday ? "Today" : fmtShort(date)}
      </div>
    </div>
  );
}

// ---------- main app ----------
export default function UltraTrainingApp() {
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState("dashboard");
  const [raceDate, setRaceDate] = useState("2027-01-30");
  const [planStartDate, setPlanStartDate] = useState("2026-07-27");
  const [profile, setProfile] = useState({ baseTDEE: 2400, weightLb: "", weightLossMode: false, deficitKcal: 400, reducedFrequency: false, usdaApiKey: "", withingsClientId: "" });
  const [runs, setRuns] = useState([]);
  const [strengthLogs, setStrengthLogs] = useState([]);
  const [meals, setMeals] = useState({}); // { 'YYYY-MM-DD': [ {id,name,cal,protein,carbs,fat} ] }
  const [savedMealSets, setSavedMealSets] = useState([]); // [ {id,name,items:[{name,cal,protein,carbs,fat}]} ]
  const [stravaAuth, setStravaAuth] = useState(null); // { accessToken, refreshToken, expiresAt, athleteName, lastSyncAt }
  const [stravaSyncStatus, setStravaSyncStatus] = useState(null);
  const [stravaConnecting, setStravaConnecting] = useState(false);
  const [withingsAuth, setWithingsAuth] = useState(null); // { accessToken, refreshToken, expiresAt, lastSyncAt }
  const [withingsSyncStatus, setWithingsSyncStatus] = useState(null);
  const [withingsConnecting, setWithingsConnecting] = useState(false);
  const [weightLogs, setWeightLogs] = useState([]); // [ {id, date, weightLb, bodyFatPct, muscleMassLb, stravaId?} ]
  const [mealClipboard, setMealClipboard] = useState([]); // [ {name,cal,protein,carbs,fat} ] — copy/paste working clipboard, not persisted

  useEffect(() => {
    (async () => {
      const rd = await loadJSON("race-date", "2027-01-30");
      const psd = await loadJSON("plan-start-date", "2026-07-27");
      const pr = await loadJSON("profile", { baseTDEE: 2400, weightLb: "", weightLossMode: false, deficitKcal: 400, reducedFrequency: false, usdaApiKey: "", withingsClientId: "" });
      const rn = await loadJSON("runs", []);
      const sl = await loadJSON("strength-logs", []);
      const ml = await loadJSON("meals", {});
      const sms = await loadJSON("saved-meal-sets", []);
      const sa = await loadJSON("strava-auth", null);
      const wa = await loadJSON("withings-auth", null);
      const wl = await loadJSON("weight-logs", []);
      setRaceDate(rd);
      setPlanStartDate(psd);
      setProfile(pr);
      setRuns(rn);
      setStrengthLogs(sl);
      setMeals(ml);
      setSavedMealSets(sms);
      setStravaAuth(sa);
      setWithingsAuth(wa);
      setWeightLogs(wl);
      setReady(true);

      // If Strava or Withings just redirected back with ?code=..., exchange
      // it for tokens. Both flows land on the same URL, so `state` (set when
      // the redirect was sent out) is what tells us which one this is.
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const state = params.get("state");
      if (code && state === "withings") {
        setWithingsConnecting(true);
        try {
          const redirectUri = window.location.origin + window.location.pathname;
          const res = await fetch(`/api/withings-exchange?code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent(redirectUri)}`);
          const data = await res.json();
          if (res.ok) {
            const newAuth = { accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt: data.expires_at, lastSyncAt: null };
            setWithingsAuth(newAuth);
            saveJSON("withings-auth", newAuth);
          }
        } catch (e) {
          console.error("Withings connect failed", e);
        } finally {
          setWithingsConnecting(false);
          window.history.replaceState({}, "", window.location.pathname);
        }
      } else if (code) {
        setStravaConnecting(true);
        try {
          const res = await fetch(`/api/strava-exchange?code=${encodeURIComponent(code)}`);
          const data = await res.json();
          if (res.ok) {
            const newAuth = {
              accessToken: data.access_token,
              refreshToken: data.refresh_token,
              expiresAt: data.expires_at,
              athleteName: data.athlete_name,
              lastSyncAt: null,
            };
            setStravaAuth(newAuth);
            saveJSON("strava-auth", newAuth);
          }
        } catch (e) {
          console.error("Strava connect failed", e);
        } finally {
          setStravaConnecting(false);
          window.history.replaceState({}, "", window.location.pathname);
        }
      }
    })();
  }, []);

  useEffect(() => {
    if (ready) saveJSON("race-date", raceDate);
  }, [raceDate, ready]);
  useEffect(() => {
    if (ready) saveJSON("plan-start-date", planStartDate);
  }, [planStartDate, ready]);
  useEffect(() => {
    if (ready) saveJSON("profile", profile);
  }, [profile, ready]);
  useEffect(() => {
    if (ready) saveJSON("runs", runs);
  }, [runs, ready]);
  useEffect(() => {
    if (ready) saveJSON("strength-logs", strengthLogs);
  }, [strengthLogs, ready]);
  useEffect(() => {
    if (ready) saveJSON("meals", meals);
  }, [meals, ready]);
  useEffect(() => {
    if (ready) saveJSON("saved-meal-sets", savedMealSets);
  }, [savedMealSets, ready]);
  useEffect(() => {
    if (ready) saveJSON("strava-auth", stravaAuth);
  }, [stravaAuth, ready]);
  useEffect(() => {
    if (ready) saveJSON("withings-auth", withingsAuth);
  }, [withingsAuth, ready]);
  useEffect(() => {
    if (ready) saveJSON("weight-logs", weightLogs);
  }, [weightLogs, ready]);

  const connectStrava = () => {
    const redirectUri = window.location.origin + window.location.pathname;
    const url = `https://www.strava.com/oauth/authorize?client_id=${STRAVA_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&approval_prompt=auto&scope=activity:read_all&state=strava`;
    window.location.href = url;
  };
  const disconnectStrava = () => {
    setStravaAuth(null);
    setStravaSyncStatus(null);
  };

  const syncStrava = async () => {
    if (!stravaAuth) return;
    setStravaSyncStatus("Syncing…");
    try {
      // Always re-request a rolling window rather than "since last sync" —
      // an incremental cutoff means anything that happened before your last
      // sync can never be picked up later (e.g. if a filter changes, or an
      // activity's type gets edited on Strava afterward). Re-fetching the
      // last 45 days every time costs one extra API call, and stravaId
      // de-duping below makes the overlap free — nothing gets duplicated.
      const after = Math.floor((Date.now() - 45 * 24 * 60 * 60 * 1000) / 1000);
      const res = await fetch("/api/strava-activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken: stravaAuth.accessToken,
          refreshToken: stravaAuth.refreshToken,
          expiresAt: stravaAuth.expiresAt,
          after,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStravaSyncStatus(`Sync failed: ${data.error?.message || JSON.stringify(data.error) || "unknown error"}`);
        return;
      }
      const existingIds = new Set(runs.map((r) => r.stravaId).filter(Boolean));
      const newRuns = (data.activities || [])
        .filter((a) => (a.type === "Run" || a.type === "Walk") && !existingIds.has(a.id))
        .map((a) => ({
          id: uid(),
          stravaId: a.id,
          date: (a.start_date_local || a.start_date || "").slice(0, 10),
          type: a.type === "Walk" ? "Walk" : "Easy",
          distance: Math.round((a.distance / 1609.34) * 100) / 100,
          durationMin: Math.round(a.moving_time / 60),
          elevation: Math.round((a.total_elevation_gain || 0) * 3.28084),
          avgHR: a.average_heartrate ? Math.round(a.average_heartrate) : "",
          notes: a.name || "",
        }));
      if (newRuns.length > 0) setRuns([...newRuns, ...runs]);

      const existingStrengthIds = new Set(strengthLogs.map((s) => s.stravaId).filter(Boolean));
      const newStrength = (data.activities || [])
        .filter((a) => a.type === "WeightTraining" && !existingStrengthIds.has(a.id))
        .map((a) => ({
          id: uid(),
          stravaId: a.id,
          date: (a.start_date_local || a.start_date || "").slice(0, 10),
          durationMin: Math.round(a.moving_time / 60),
          avgHR: a.average_heartrate ? Math.round(a.average_heartrate) : "",
          maxHR: a.max_heartrate ? Math.round(a.max_heartrate) : "",
          calories: a.calories ? Math.round(a.calories) : "",
          notes: a.name || "",
        }));
      if (newStrength.length > 0) setStrengthLogs([...newStrength, ...strengthLogs]);

      const totalNew = newRuns.length + newStrength.length;
      const updatedAuth = { ...stravaAuth, accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt: data.expires_at, lastSyncAt: new Date().toISOString() };
      setStravaAuth(updatedAuth);
      setStravaSyncStatus(totalNew > 0 ? `Synced ${totalNew} new session${totalNew !== 1 ? "s" : ""}.` : "Up to date — nothing new.");
    } catch (e) {
      setStravaSyncStatus("Sync failed — check your connection and try again.");
    }
  };

  const connectWithings = () => {
    if (!profile.withingsClientId) return;
    const redirectUri = window.location.origin + window.location.pathname;
    const url = `https://account.withings.com/oauth2_user/authorize2?response_type=code&client_id=${encodeURIComponent(profile.withingsClientId)}&state=withings&scope=user.metrics&redirect_uri=${encodeURIComponent(redirectUri)}`;
    window.location.href = url;
  };
  const disconnectWithings = () => {
    setWithingsAuth(null);
    setWithingsSyncStatus(null);
  };

  const syncWithings = async () => {
    if (!withingsAuth) return;
    setWithingsSyncStatus("Syncing…");
    try {
      const after = Math.floor((Date.now() - 45 * 24 * 60 * 60 * 1000) / 1000);
      const res = await fetch("/api/withings-measurements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken: withingsAuth.accessToken,
          refreshToken: withingsAuth.refreshToken,
          expiresAt: withingsAuth.expiresAt,
          after,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setWithingsSyncStatus(`Sync failed: ${data.error?.message || JSON.stringify(data.error) || "unknown error"}`);
        return;
      }
      const KG_TO_LB = 2.20462;
      const existingGrpIds = new Set(weightLogs.map((w) => w.grpid).filter(Boolean));
      const newEntries = (data.measuregrps || [])
        .filter((g) => !existingGrpIds.has(g.grpid))
        .map((g) => {
          const rec = { id: uid(), grpid: g.grpid, date: fmtDate(new Date(g.date * 1000)) };
          (g.measures || []).forEach((m) => {
            const value = m.value * Math.pow(10, m.unit);
            if (m.type === 1) rec.weightLb = Math.round(value * KG_TO_LB * 10) / 10;
            if (m.type === 6) rec.bodyFatPct = Math.round(value * 10) / 10;
            if (m.type === 76) rec.muscleMassLb = Math.round(value * KG_TO_LB * 10) / 10;
          });
          return rec;
        })
        .filter((r) => r.weightLb || r.bodyFatPct || r.muscleMassLb);

      let updatedLogs = weightLogs;
      if (newEntries.length > 0) {
        updatedLogs = [...newEntries, ...weightLogs].sort((a, b) => new Date(b.date) - new Date(a.date));
        setWeightLogs(updatedLogs);
        const mostRecentWeight = updatedLogs.find((r) => r.weightLb);
        if (mostRecentWeight) setProfile((p) => ({ ...p, weightLb: mostRecentWeight.weightLb }));
      }
      const updatedAuth = { ...withingsAuth, accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt: data.expires_at, lastSyncAt: new Date().toISOString() };
      setWithingsAuth(updatedAuth);
      setWithingsSyncStatus(newEntries.length > 0 ? `Synced ${newEntries.length} new reading${newEntries.length !== 1 ? "s" : ""}.` : "Up to date — nothing new.");
    } catch (e) {
      setWithingsSyncStatus("Sync failed — check your connection and try again.");
    }
  };

  const plan = useMemo(() => buildPlan(raceDate, planStartDate, profile.reducedFrequency), [raceDate, planStartDate, profile.reducedFrequency]);
  const daysToRace = daysBetween(new Date(), new Date(raceDate + "T00:00:00"));
  const weeksToRace = Math.max(0, Math.ceil(daysToRace / 7));

  const currentWeek = useMemo(() => {
    const elapsed = daysBetween(new Date(plan.startDate + "T00:00:00"), new Date());
    const idx = Math.floor(elapsed / 7);
    return plan.weeks[Math.min(Math.max(idx, 0), plan.weeks.length - 1)];
  }, [plan]);

  const todaysMeals = meals[todayStr()] || [];
  const todaysCalories = todaysMeals.reduce((s, m) => s + Number(m.cal || 0), 0);
  const todaysRun = runs.find((r) => r.date === todayStr());
  const todayEnergy = useMemo(() => computeDayEnergy(todayStr(), profile, plan, runs), [profile, plan, runs]);
  const { targetKcal, activityKcal } = todayEnergy;

  const thisWeekMiles = useMemo(() => {
    const wkStart = new Date(currentWeek.start + "T00:00:00");
    const wkEnd = new Date(wkStart);
    wkEnd.setDate(wkEnd.getDate() + 7);
    return runs
      .filter((r) => {
        const d = new Date(r.date + "T00:00:00");
        return d >= wkStart && d < wkEnd;
      })
      .reduce((s, r) => s + Number(r.distance || 0), 0);
  }, [runs, currentWeek]);

  const thisWeekVert = useMemo(() => {
    const wkStart = new Date(currentWeek.start + "T00:00:00");
    const wkEnd = new Date(wkStart);
    wkEnd.setDate(wkEnd.getDate() + 7);
    return runs
      .filter((r) => {
        const d = new Date(r.date + "T00:00:00");
        return d >= wkStart && d < wkEnd;
      })
      .reduce((s, r) => s + Number(r.elevation || 0), 0);
  }, [runs, currentWeek]);

  if (!ready) {
    return (
      <div style={{ background: COLORS.bg, color: COLORS.inkSoft, padding: 40, fontFamily: "Inter, sans-serif" }}>
        Loading trail data…
      </div>
    );
  }

  return (
    <div style={{ background: COLORS.bg, minHeight: "100%", fontFamily: "Inter, sans-serif", color: COLORS.ink }}>
      <style>{`${FONT_IMPORT} * { box-sizing: border-box; } ::selection { background: ${COLORS.amber}55; }`}</style>

      {/* header */}
      <div style={{ padding: "26px 28px 0", maxWidth: 980, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
          <div>
            <Eyebrow>50-Mile Build</Eyebrow>
            <h1 style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 30, margin: 0, color: COLORS.paper, letterSpacing: "0.01em" }}>
              Ridge Line
            </h1>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 28, color: COLORS.amber, fontWeight: 600 }}>
              {daysToRace}d
            </div>
            <div style={{ fontSize: 12, color: COLORS.inkSoft }}>to race day · {weeksToRace} weeks</div>
          </div>
        </div>

        {/* tabs */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 22, paddingBottom: 14, borderBottom: `1px solid ${COLORS.line}` }}>
          {[
            ["dashboard", "Dashboard"],
            ["log", "Log"],
            ["plan", "Plan"],
            ["strength", "Strength"],
            ["progress", "Progress"],
            ["nutrition", "Nutrition"],
            ["settings", "Settings"],
          ].map(([key, label]) => (
            <div
              key={key}
              onClick={() => setTab(key)}
              style={{
                padding: "8px 12px",
                borderRadius: 20,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
                color: tab === key ? "#1B140A" : COLORS.inkSoft,
                background: tab === key ? COLORS.amber : "transparent",
                border: `1px solid ${tab === key ? COLORS.amber : COLORS.line}`,
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: "22px 28px 60px", maxWidth: 980, margin: "0 auto" }}>
        {tab === "dashboard" && (
          <Dashboard
            plan={plan}
            currentWeek={currentWeek}
            thisWeekMiles={thisWeekMiles}
            thisWeekVert={thisWeekVert}
            todaysCalories={todaysCalories}
            targetKcal={targetKcal}
            todaysRun={todaysRun}
            runs={runs}
            weightLogs={weightLogs}
            reducedFrequency={profile.reducedFrequency}
          />
        )}
        {tab === "log" && (
          <TrainingLog
            runs={runs}
            setRuns={setRuns}
            strengthLogs={strengthLogs}
            setStrengthLogs={setStrengthLogs}
            stravaAuth={stravaAuth}
            onSyncStrava={syncStrava}
            stravaSyncStatus={stravaSyncStatus}
          />
        )}
        {tab === "plan" && <PlanView plan={plan} />}
        {tab === "strength" && <Strength currentPhase={currentWeek.phase} />}
        {tab === "progress" && (
          <Progress
            plan={plan}
            currentWeek={currentWeek}
            runs={runs}
            strengthLogs={strengthLogs}
            weightLogs={weightLogs}
            withingsAuth={withingsAuth}
            onSyncWithings={syncWithings}
            withingsSyncStatus={withingsSyncStatus}
          />
        )}
        {tab === "nutrition" && (
          <Nutrition
            meals={meals}
            setMeals={setMeals}
            savedMealSets={savedMealSets}
            setSavedMealSets={setSavedMealSets}
            profile={profile}
            plan={plan}
            runs={runs}
            mealClipboard={mealClipboard}
            setMealClipboard={setMealClipboard}
          />
        )}
        {tab === "settings" && (
          <Settings
            raceDate={raceDate}
            setRaceDate={setRaceDate}
            planStartDate={planStartDate}
            setPlanStartDate={setPlanStartDate}
            profile={profile}
            setProfile={setProfile}
            onDataImported={() => window.location.reload()}
            stravaAuth={stravaAuth}
            onConnectStrava={connectStrava}
            onDisconnectStrava={disconnectStrava}
            stravaConnecting={stravaConnecting}
            withingsAuth={withingsAuth}
            onConnectWithings={connectWithings}
            onDisconnectWithings={disconnectWithings}
            withingsConnecting={withingsConnecting}
          />
        )}
      </div>
    </div>
  );
}

function strengthKeyForPhase(phase) {
  if (phase === "Build II" || phase === "Peak") return "Build II / Peak";
  if (phase === "Taper" || phase === "Race Week") return "Taper";
  if (phase === "Build I") return "Build I";
  return "Foundation";
}

function ExerciseBlock({ title, subtitle, exercises, highlighted }) {
  return (
    <Card style={highlighted ? { borderColor: COLORS.amber + "77" } : undefined}>
      {highlighted && <Eyebrow>Current phase</Eyebrow>}
      <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 18, color: COLORS.paper, fontWeight: 600 }}>{title}</div>
      <div style={{ color: COLORS.inkSoft, fontSize: 13, marginTop: 2, marginBottom: 14 }}>{subtitle}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {exercises.map((ex, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 12, borderBottom: `1px solid ${COLORS.line}`, paddingBottom: 10 }}>
            <div>
              <div style={{ color: COLORS.ink, fontSize: 14, fontWeight: 600 }}>{ex.name}</div>
              <div style={{ color: COLORS.inkSoft, fontSize: 12, marginTop: 2 }}>{ex.note}</div>
            </div>
            <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 13, color: COLORS.amber, whiteSpace: "nowrap" }}>{ex.sets}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Strength({ currentPhase }) {
  const currentKey = strengthKeyForPhase(currentPhase);
  const order = ["Foundation", "Build I", "Build II / Peak", "Taper"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <Card style={{ borderColor: COLORS.amber + "55" }}>
        <Eyebrow>Why hips</Eyebrow>
        <div style={{ color: COLORS.inkSoft, fontSize: 13, lineHeight: 1.6 }}>
          Late-race hip fatigue in ultras is almost always the glute medius and hip abductors losing their ability to
          stabilize the pelvis with each stride — that's what shows up as hip drop, IT band pain, or that "my legs just
          won't hold form anymore" feeling past mile 30. Every phase below leads with abductor and posterior-hip work first,
          then layers in the rest.
        </div>
      </Card>

      {order.map((key) => (
        <ExerciseBlock
          key={key}
          title={key}
          subtitle={STRENGTH_LIBRARY[key].subtitle}
          exercises={STRENGTH_LIBRARY[key].exercises}
          highlighted={key === currentKey}
        />
      ))}
    </div>
  );
}

function Dashboard({ plan, currentWeek, thisWeekMiles, thisWeekVert, todaysCalories, targetKcal, todaysRun, runs, weightLogs, reducedFrequency }) {
  const today = todayStr();
  const todaysPrescription = currentWeek.days.find((d) => d.date === today);
  const todaysMilesRun = useMemo(() => runs.filter((r) => r.date === today).reduce((s, r) => s + Number(r.distance || 0), 0), [runs, today]);
  const remainingCal = targetKcal - todaysCalories;

  const weight = useMemo(() => latestWithTrend(weightLogs, "weightLb"), [weightLogs]);
  const bodyFat = useMemo(() => latestWithTrend(weightLogs, "bodyFatPct"), [weightLogs]);
  const muscle = useMemo(() => latestWithTrend(weightLogs, "muscleMassLb"), [weightLogs]);

  const trendArrow = (delta, invert) => {
    if (delta == null || Math.abs(delta) < 0.3) return { symbol: "→", color: COLORS.inkSoft, label: "steady" };
    const up = delta > 0;
    return { symbol: up ? "↑" : "↓", color: COLORS.ink, label: `${up ? "+" : ""}${delta}` };
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <Card>
        <Eyebrow>Training profile · week {currentWeek.week} of {plan.weeks.length}</Eyebrow>
        <ElevationProfile plan={plan} />
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14 }}>
        <Card><Stat label="Current phase" value={currentWeek.phase} /></Card>

        <Card style={{ borderColor: todaysPrescription && todaysPrescription.type !== "Rest" ? COLORS.amber + "66" : COLORS.line }}>
          <Eyebrow>{todaysPrescription ? todaysPrescription.type : "Today"}</Eyebrow>
          {todaysPrescription && todaysPrescription.type === "Rest" && todaysMilesRun === 0 ? (
            <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 20, color: COLORS.inkSoft, fontWeight: 600 }}>Rest day</div>
          ) : (
            <div style={{ display: "flex", gap: 18 }}>
              <div>
                <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 22, color: COLORS.paper, fontWeight: 600 }}>
                  {todaysMilesRun.toFixed(1)}
                </div>
                <div style={{ fontSize: 11, color: COLORS.inkSoft }}>completed</div>
              </div>
              <div>
                <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 22, color: COLORS.inkSoft, fontWeight: 600 }}>
                  {todaysPrescription ? todaysPrescription.miles : 0}
                </div>
                <div style={{ fontSize: 11, color: COLORS.inkSoft }}>prescribed (mi)</div>
              </div>
            </div>
          )}
          {todaysPrescription?.strength && <div style={{ color: COLORS.amber, fontSize: 12, marginTop: 4, fontWeight: 600 }}>+ Strength session</div>}
        </Card>

        <Card><Stat label="This week's mileage so far" value={thisWeekMiles.toFixed(1)} unit={`/ ${currentWeek.totalMiles} mi`} /></Card>
        <Card><Stat label="Elevation gain this week" value={Math.round(thisWeekVert)} unit="ft" /></Card>
        <Card style={{ borderColor: remainingCal < 0 ? COLORS.rust + "77" : COLORS.line }}>
          <Stat label={remainingCal < 0 ? "Over target" : "Remaining today"} value={Math.abs(Math.round(remainingCal))} unit="kcal" />
        </Card>
      </div>

      <Card>
        <Eyebrow>Body composition</Eyebrow>
        {!weight && !bodyFat && !muscle ? (
          <div style={{ color: COLORS.inkSoft, fontSize: 14 }}>No Withings data yet — connect and sync in Settings and the Progress tab.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px,1fr))", gap: 14 }}>
            {weight && (
              <div>
                <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 22, color: COLORS.paper, fontWeight: 600 }}>
                  {weight.value.toFixed(1)}
                  <span style={{ fontSize: 13, color: COLORS.inkSoft, marginLeft: 4 }}>lb</span>
                </div>
                <div style={{ fontSize: 12, marginTop: 2, color: trendArrow(weight.delta).color }}>
                  {trendArrow(weight.delta).symbol} {trendArrow(weight.delta).label} lb / 7d
                </div>
                <div style={{ fontSize: 11, color: COLORS.inkSoft, marginTop: 2 }}>Weight</div>
              </div>
            )}
            {bodyFat && (
              <div>
                <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 22, color: COLORS.paper, fontWeight: 600 }}>
                  {bodyFat.value.toFixed(1)}
                  <span style={{ fontSize: 13, color: COLORS.inkSoft, marginLeft: 4 }}>%</span>
                </div>
                <div style={{ fontSize: 12, marginTop: 2, color: trendArrow(bodyFat.delta).color }}>
                  {trendArrow(bodyFat.delta).symbol} {trendArrow(bodyFat.delta).label}% / 7d
                </div>
                <div style={{ fontSize: 11, color: COLORS.inkSoft, marginTop: 2 }}>Body fat</div>
              </div>
            )}
            {muscle && (
              <div>
                <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 22, color: COLORS.paper, fontWeight: 600 }}>
                  {muscle.value.toFixed(1)}
                  <span style={{ fontSize: 13, color: COLORS.inkSoft, marginLeft: 4 }}>lb</span>
                </div>
                <div style={{ fontSize: 12, marginTop: 2, color: trendArrow(muscle.delta).color }}>
                  {trendArrow(muscle.delta).symbol} {trendArrow(muscle.delta).label} lb / 7d
                </div>
                <div style={{ fontSize: 11, color: COLORS.inkSoft, marginTop: 2 }}>Muscle mass</div>
              </div>
            )}
          </div>
        )}
      </Card>

      <Card>
        <Eyebrow>This week — {currentWeek.phase} phase</Eyebrow>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(64px, 1fr))", gap: 5 }}>
          {currentWeek.days.map((d) => {
            const isToday = d.date === today;
            const isRest = d.type === "Rest";
            return (
              <div
                key={d.date}
                title={d.type}
                style={{
                  background: isToday ? COLORS.raised : "transparent",
                  border: `1px solid ${isToday ? COLORS.amber : COLORS.line}`,
                  borderRadius: 6,
                  padding: "5px 3px",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 9.5, color: COLORS.inkSoft, textTransform: "uppercase", letterSpacing: "0.03em" }}>{d.short}</div>
                <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 14, fontWeight: 600, color: isRest ? COLORS.inkSoft : COLORS.paper, marginTop: 2 }}>
                  {isRest ? "—" : `${d.miles}`}
                </div>
                {d.strength && <div style={{ fontSize: 9, color: COLORS.amber, marginTop: 1 }}>+S</div>}
              </div>
            );
          })}
        </div>
        <div style={{ color: COLORS.inkSoft, fontSize: 11, marginTop: 8 }}>
          {currentWeek.isCutback ? "Cutback week. " : ""}{reducedFrequency && (currentWeek.phase === "Foundation" || currentWeek.phase === "Build I") ? "5-day mode active." : ""}
        </div>
      </Card>

      {!todaysRun && todaysPrescription && todaysPrescription.type !== "Rest" && (
        <Card style={{ borderColor: COLORS.amber + "66" }}>
          <div style={{ color: COLORS.inkSoft, fontSize: 14 }}>No run logged today yet — head to the Training Log tab once you're done.</div>
        </Card>
      )}
    </div>
  );
}

function TrainingLog({ runs, setRuns, strengthLogs, setStrengthLogs, stravaAuth, onSyncStrava, stravaSyncStatus }) {
  const [viewDate, setViewDate] = useState(todayStr());
  const [form, setForm] = useState({ date: viewDate, type: "Easy", distance: "", durationMin: "", elevation: "", avgHR: "", notes: "" });
  const [editRunId, setEditRunId] = useState(null);
  const [editRunForm, setEditRunForm] = useState(null);
  const [editStrengthId, setEditStrengthId] = useState(null);
  const [editStrengthForm, setEditStrengthForm] = useState(null);

  // Keep the add-form's date in sync with whichever day you're viewing —
  // still overridable by hand if you want to log for a different day.
  useEffect(() => {
    setForm((f) => ({ ...f, date: viewDate }));
  }, [viewDate]);

  const addRun = () => {
    if (!form.distance || !form.durationMin) return;
    setRuns([{ id: uid(), ...form }, ...runs]);
    setForm({ date: viewDate, type: "Easy", distance: "", durationMin: "", elevation: "", avgHR: "", notes: "" });
  };
  const removeRun = (id) => setRuns(runs.filter((r) => r.id !== id));
  const startEditRun = (r) => {
    setEditRunId(r.id);
    setEditRunForm({ ...r });
  };
  const saveEditRun = () => {
    setRuns(runs.map((r) => (r.id === editRunId ? { ...editRunForm } : r)));
    setEditRunId(null);
    setEditRunForm(null);
  };

  const removeStrength = (id) => setStrengthLogs(strengthLogs.filter((s) => s.id !== id));
  const startEditStrength = (s) => {
    setEditStrengthId(s.id);
    setEditStrengthForm({ ...s });
  };
  const saveEditStrength = () => {
    setStrengthLogs(strengthLogs.map((s) => (s.id === editStrengthId ? { ...editStrengthForm } : s)));
    setEditStrengthId(null);
    setEditStrengthForm(null);
  };

  const pace = (r) => {
    const d = Number(r.distance),
      m = Number(r.durationMin);
    if (!d || !m) return "—";
    const p = m / d;
    const min = Math.floor(p);
    const sec = Math.round((p - min) * 60);
    return `${min}:${sec.toString().padStart(2, "0")}/mi`;
  };

  const runTypeOptions = ["Easy", "Long Run", "Tempo", "Hill/Vert", "Back-to-Back", "Race Sim", "Walk"];

  const dayRuns = runs.filter((r) => r.date === viewDate);
  const dayStrength = strengthLogs.filter((s) => s.date === viewDate);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <Card>
        <Eyebrow>Viewing</Eyebrow>
        <DateNav date={viewDate} setDate={setViewDate} />
        {stravaAuth && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${COLORS.line}`, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <Button variant="ghost" onClick={onSyncStrava}>Sync Strava</Button>
            <div style={{ color: COLORS.inkSoft, fontSize: 12 }}>
              {stravaSyncStatus || (stravaAuth.lastSyncAt ? `Last synced ${fmtShort(fmtDate(new Date(stravaAuth.lastSyncAt)))}` : "Not synced yet")}
            </div>
          </div>
        )}
      </Card>

      <Card>
        <Eyebrow>Log a run — {fmtShort(viewDate)}</Eyebrow>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px,1fr))", gap: 10 }}>
          <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            style={{ background: COLORS.bg, border: `1px solid ${COLORS.line}`, borderRadius: 6, padding: "8px 10px", color: COLORS.ink }}
          >
            {runTypeOptions.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <Input placeholder="Distance (mi)" type="number" value={form.distance} onChange={(e) => setForm({ ...form, distance: e.target.value })} />
          <Input placeholder="Duration (min)" type="number" value={form.durationMin} onChange={(e) => setForm({ ...form, durationMin: e.target.value })} />
          <Input placeholder="Elevation gain (ft)" type="number" value={form.elevation} onChange={(e) => setForm({ ...form, elevation: e.target.value })} />
          <Input placeholder="Avg HR" type="number" value={form.avgHR} onChange={(e) => setForm({ ...form, avgHR: e.target.value })} />
        </div>
        <Input placeholder="Notes — terrain, effort, fueling…" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={{ marginTop: 10 }} />
        <Button onClick={addRun} style={{ marginTop: 12 }}>Add run</Button>
      </Card>

      <Card>
        <Eyebrow>Runs — {fmtShort(viewDate)}</Eyebrow>
        {dayRuns.length === 0 && <div style={{ color: COLORS.inkSoft, fontSize: 14 }}>No runs logged for this day.</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {dayRuns.map((r) =>
            editRunId === r.id ? (
              <div key={r.id} style={{ padding: "10px 0", borderBottom: `1px solid ${COLORS.line}` }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px,1fr))", gap: 8 }}>
                  <Input type="date" value={editRunForm.date} onChange={(e) => setEditRunForm({ ...editRunForm, date: e.target.value })} />
                  <select
                    value={editRunForm.type}
                    onChange={(e) => setEditRunForm({ ...editRunForm, type: e.target.value })}
                    style={{ background: COLORS.bg, border: `1px solid ${COLORS.line}`, borderRadius: 6, padding: "8px 10px", color: COLORS.ink }}
                  >
                    {runTypeOptions.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                  <Input placeholder="Distance (mi)" type="number" value={editRunForm.distance} onChange={(e) => setEditRunForm({ ...editRunForm, distance: e.target.value })} />
                  <Input placeholder="Duration (min)" type="number" value={editRunForm.durationMin} onChange={(e) => setEditRunForm({ ...editRunForm, durationMin: e.target.value })} />
                  <Input placeholder="Elevation (ft)" type="number" value={editRunForm.elevation} onChange={(e) => setEditRunForm({ ...editRunForm, elevation: e.target.value })} />
                  <Input placeholder="Avg HR" type="number" value={editRunForm.avgHR} onChange={(e) => setEditRunForm({ ...editRunForm, avgHR: e.target.value })} />
                </div>
                <Input placeholder="Notes" value={editRunForm.notes} onChange={(e) => setEditRunForm({ ...editRunForm, notes: e.target.value })} style={{ marginTop: 8 }} />
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <Button onClick={saveEditRun}>Save</Button>
                  <Button variant="ghost" onClick={() => setEditRunId(null)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${COLORS.line}` }}>
                <div>
                  <div style={{ color: COLORS.paper, fontSize: 14, fontWeight: 600 }}>
                    {r.type}
                    {r.stravaId && <span style={{ color: COLORS.amber, fontSize: 11, fontWeight: 400 }}> · Strava</span>}
                  </div>
                  <div style={{ color: COLORS.inkSoft, fontSize: 12 }}>
                    {r.distance || 0} mi · {r.durationMin || 0} min · {pace(r)}
                    {Number(r.elevation) > 0 ? ` · ${r.elevation} ft gain` : ""}
                    {r.avgHR ? ` · ${r.avgHR} bpm` : ""}
                  </div>
                  {r.notes && <div style={{ color: COLORS.inkSoft, fontSize: 12, marginTop: 2 }}>{r.notes}</div>}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Button variant="ghost" onClick={() => startEditRun(r)}>Edit</Button>
                  <Button variant="danger" onClick={() => removeRun(r.id)}>Remove</Button>
                </div>
              </div>
            )
          )}
        </div>
      </Card>

      <Card>
        <Eyebrow>Strength — {fmtShort(viewDate)}</Eyebrow>
        <div style={{ color: COLORS.inkSoft, fontSize: 12, marginBottom: 10, lineHeight: 1.5 }}>
          Exercises are already prescribed in the Strength tab — this just tracks that a session happened and how it felt, pulled in from Strava (duration, heart rate, calories). {!stravaAuth && "Connect Strava in Settings to start populating this automatically."}
        </div>
        {dayStrength.length === 0 && <div style={{ color: COLORS.inkSoft, fontSize: 14 }}>No strength session logged for this day.</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {dayStrength.map((s) =>
            editStrengthId === s.id ? (
              <div key={s.id} style={{ padding: "10px 0", borderBottom: `1px solid ${COLORS.line}` }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px,1fr))", gap: 8 }}>
                  <Input type="date" value={editStrengthForm.date} onChange={(e) => setEditStrengthForm({ ...editStrengthForm, date: e.target.value })} />
                  <Input placeholder="Duration (min)" type="number" value={editStrengthForm.durationMin} onChange={(e) => setEditStrengthForm({ ...editStrengthForm, durationMin: e.target.value })} />
                  <Input placeholder="Avg HR" type="number" value={editStrengthForm.avgHR} onChange={(e) => setEditStrengthForm({ ...editStrengthForm, avgHR: e.target.value })} />
                  <Input placeholder="Max HR" type="number" value={editStrengthForm.maxHR} onChange={(e) => setEditStrengthForm({ ...editStrengthForm, maxHR: e.target.value })} />
                  <Input placeholder="Calories" type="number" value={editStrengthForm.calories} onChange={(e) => setEditStrengthForm({ ...editStrengthForm, calories: e.target.value })} />
                </div>
                <Input placeholder="Notes" value={editStrengthForm.notes} onChange={(e) => setEditStrengthForm({ ...editStrengthForm, notes: e.target.value })} style={{ marginTop: 8 }} />
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <Button onClick={saveEditStrength}>Save</Button>
                  <Button variant="ghost" onClick={() => setEditStrengthId(null)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${COLORS.line}` }}>
                <div>
                  <div style={{ color: COLORS.paper, fontSize: 14, fontWeight: 600 }}>
                    {s.notes || "Strength session"}
                    {s.stravaId && <span style={{ color: COLORS.amber, fontSize: 11, fontWeight: 400 }}> · Strava</span>}
                  </div>
                  <div style={{ color: COLORS.inkSoft, fontSize: 12 }}>
                    {s.durationMin || 0} min
                    {s.avgHR ? ` · ${s.avgHR} bpm avg` : ""}
                    {s.maxHR ? ` (max ${s.maxHR})` : ""}
                    {s.calories ? ` · ${s.calories} cal` : ""}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Button variant="ghost" onClick={() => startEditStrength(s)}>Edit</Button>
                  <Button variant="danger" onClick={() => removeStrength(s.id)}>Remove</Button>
                </div>
              </div>
            )
          )}
        </div>
      </Card>
    </div>
  );
}

function fmtShort(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function Progress({ plan, currentWeek, runs, strengthLogs, weightLogs, withingsAuth, onSyncWithings, withingsSyncStatus }) {
  const weeklyData = useMemo(() => {
    return plan.weeks
      .filter((w) => w.week <= currentWeek.week)
      .map((w) => {
        const wkStart = new Date(w.start + "T00:00:00");
        const wkEnd = new Date(wkStart);
        wkEnd.setDate(wkEnd.getDate() + 7);
        const weekRuns = runs.filter((r) => {
          const d = new Date(r.date + "T00:00:00");
          return d >= wkStart && d < wkEnd;
        });
        // Miles include walks (they count toward weekly volume); elevation
        // excludes walks — that chart is about trained vert, not strolling.
        const actualMiles = weekRuns.reduce((s, r) => s + Number(r.distance || 0), 0);
        const actualVert = weekRuns.filter((r) => r.type !== "Walk").reduce((s, r) => s + Number(r.elevation || 0), 0);
        return { week: `Wk ${w.week}`, planned: w.totalMiles, actual: Math.round(actualMiles * 10) / 10, vert: Math.round(actualVert) };
      });
  }, [plan, currentWeek, runs]);

  const longRunTrend = useMemo(() => {
    return runs
      .filter((r) => r.type === "Long Run" || r.type === "Back-to-Back")
      .slice()
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map((r) => ({ date: fmtShort(r.date), miles: Number(r.distance || 0) }));
  }, [runs]);

  const hrPaceTrend = useMemo(() => {
    return runs
      .filter((r) => r.type !== "Walk" && Number(r.distance) > 0 && Number(r.durationMin) > 0 && Number(r.avgHR) > 0)
      .slice()
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map((r) => ({
        date: fmtShort(r.date),
        paceMin: Math.round((Number(r.durationMin) / Number(r.distance)) * 100) / 100,
        hr: Number(r.avgHR),
      }));
  }, [runs]);

  const fmtPace = (p) => {
    if (p == null) return "—";
    const min = Math.floor(p);
    const sec = Math.round((p - min) * 60);
    return `${min}:${sec.toString().padStart(2, "0")}/mi`;
  };

  const weightTrend = useMemo(() => {
    return (weightLogs || [])
      .slice()
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map((w) => ({ date: fmtShort(w.date), weight: w.weightLb || null, bodyFat: w.bodyFatPct || null, muscle: w.muscleMassLb || null }));
  }, [weightLogs]);

  const totalMiles = useMemo(() => runs.reduce((s, r) => s + Number(r.distance || 0), 0), [runs]);
  const totalVert = useMemo(() => runs.reduce((s, r) => s + Number(r.elevation || 0), 0), [runs]);
  const totalRuns = runs.length;
  const totalStrengthSessions = strengthLogs.length;

  const strengthSummarySessions = useMemo(
    () => strengthLogs.filter((s) => !s.exercise).sort((a, b) => new Date(b.date) - new Date(a.date)),
    [strengthLogs]
  );
  const strengthSummaryStats = useMemo(() => {
    const withHR = strengthSummarySessions.filter((s) => s.avgHR);
    return {
      count: strengthSummarySessions.length,
      totalMin: strengthSummarySessions.reduce((s, x) => s + Number(x.durationMin || 0), 0),
      avgHR: withHR.length ? Math.round(withHR.reduce((s, x) => s + Number(x.avgHR), 0) / withHR.length) : null,
    };
  }, [strengthSummarySessions]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px,1fr))", gap: 14 }}>
        <Card><Stat label="Total miles logged" value={totalMiles.toFixed(1)} unit="mi" /></Card>
        <Card><Stat label="Total elevation" value={Math.round(totalVert)} unit="ft" /></Card>
        <Card><Stat label="Runs logged" value={totalRuns} /></Card>
        <Card><Stat label="Strength sessions" value={totalStrengthSessions} /></Card>
      </div>

      <Card>
        <Eyebrow>Weekly mileage — actual vs planned</Eyebrow>
        {weeklyData.length === 0 ? (
          <div style={{ color: COLORS.inkSoft, fontSize: 14 }}>Nothing to show yet — log a few runs first.</div>
        ) : (
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeklyData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={COLORS.line} strokeDasharray="3 3" />
                <XAxis dataKey="week" stroke={COLORS.inkSoft} fontSize={11} />
                <YAxis stroke={COLORS.inkSoft} fontSize={11} width={34} />
                <Tooltip contentStyle={{ background: COLORS.surface, border: `1px solid ${COLORS.line}`, fontSize: 12 }} labelStyle={{ color: COLORS.paper }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="planned" name="Planned" stroke={COLORS.inkSoft} strokeDasharray="4 4" dot={false} />
                <Line type="monotone" dataKey="actual" name="Actual" stroke={COLORS.amber} strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card>
        <Eyebrow>Weekly elevation gain</Eyebrow>
        {weeklyData.length === 0 ? (
          <div style={{ color: COLORS.inkSoft, fontSize: 14 }}>No elevation logged yet.</div>
        ) : (
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={COLORS.line} strokeDasharray="3 3" />
                <XAxis dataKey="week" stroke={COLORS.inkSoft} fontSize={11} />
                <YAxis stroke={COLORS.inkSoft} fontSize={11} width={40} />
                <Tooltip contentStyle={{ background: COLORS.surface, border: `1px solid ${COLORS.line}`, fontSize: 12 }} labelStyle={{ color: COLORS.paper }} />
                <Bar dataKey="vert" name="Elevation (ft)" fill={COLORS.moss} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card>
        <Eyebrow>Long run / back-to-back progression</Eyebrow>
        {longRunTrend.length === 0 ? (
          <div style={{ color: COLORS.inkSoft, fontSize: 14 }}>Log a "Long Run" or "Back-to-Back" session to see this trend.</div>
        ) : (
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={longRunTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={COLORS.line} strokeDasharray="3 3" />
                <XAxis dataKey="date" stroke={COLORS.inkSoft} fontSize={11} />
                <YAxis stroke={COLORS.inkSoft} fontSize={11} width={34} />
                <Tooltip contentStyle={{ background: COLORS.surface, border: `1px solid ${COLORS.line}`, fontSize: 12 }} labelStyle={{ color: COLORS.paper }} />
                <Line type="monotone" dataKey="miles" name="Miles" stroke={COLORS.rust} strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card>
        <Eyebrow>Heart rate vs pace — aerobic efficiency</Eyebrow>
        {hrPaceTrend.length < 2 ? (
          <div style={{ color: COLORS.inkSoft, fontSize: 14 }}>Log at least two runs with avg HR to see this trend.</div>
        ) : (
          <>
            <div style={{ height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={hrPaceTrend} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={COLORS.line} strokeDasharray="3 3" />
                  <XAxis dataKey="date" stroke={COLORS.inkSoft} fontSize={11} />
                  <YAxis
                    yAxisId="pace"
                    stroke={COLORS.amber}
                    fontSize={11}
                    reversed
                    tickFormatter={(v) => fmtPace(v)}
                    width={50}
                  />
                  <YAxis yAxisId="hr" orientation="right" stroke={COLORS.rust} fontSize={11} width={38} />
                  <Tooltip
                    contentStyle={{ background: COLORS.surface, border: `1px solid ${COLORS.line}`, fontSize: 12 }}
                    labelStyle={{ color: COLORS.paper }}
                    formatter={(value, name) => (name === "Pace" ? [fmtPace(value), name] : [`${value} bpm`, name])}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line yAxisId="pace" type="monotone" dataKey="paceMin" name="Pace" stroke={COLORS.amber} strokeWidth={2} dot={{ r: 3 }} />
                  <Line yAxisId="hr" type="monotone" dataKey="hr" name="Avg HR" stroke={COLORS.rust} strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div style={{ color: COLORS.inkSoft, fontSize: 12, marginTop: 8 }}>
              Pace axis is reversed so "up" always means faster. If pace is dropping (going up on the chart) while HR holds steady or falls, that's your aerobic fitness improving — you're covering more ground for the same effort.
            </div>
          </>
        )}
      </Card>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
          <Eyebrow>Body composition</Eyebrow>
          {withingsAuth && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Button variant="ghost" onClick={onSyncWithings}>Sync Withings</Button>
              <div style={{ color: COLORS.inkSoft, fontSize: 12 }}>{withingsSyncStatus || ""}</div>
            </div>
          )}
        </div>
        {!withingsAuth ? (
          <div style={{ color: COLORS.inkSoft, fontSize: 14, marginTop: 6 }}>Connect Withings in Settings to start tracking weight and body composition automatically.</div>
        ) : weightTrend.length === 0 ? (
          <div style={{ color: COLORS.inkSoft, fontSize: 14, marginTop: 6 }}>No readings yet — tap "Sync Withings" above.</div>
        ) : (
          <div style={{ height: 250, marginTop: 10 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weightTrend} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={COLORS.line} strokeDasharray="3 3" />
                <XAxis dataKey="date" stroke={COLORS.inkSoft} fontSize={11} />
                <YAxis yAxisId="weight" stroke={COLORS.amber} fontSize={11} width={38} domain={["dataMin - 3", "dataMax + 3"]} />
                <YAxis yAxisId="pct" orientation="right" stroke={COLORS.moss} fontSize={11} width={34} domain={["dataMin - 2", "dataMax + 2"]} />
                <Tooltip contentStyle={{ background: COLORS.surface, border: `1px solid ${COLORS.line}`, fontSize: 12 }} labelStyle={{ color: COLORS.paper }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line yAxisId="weight" type="monotone" dataKey="weight" name="Weight (lb)" stroke={COLORS.amber} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                <Line yAxisId="pct" type="monotone" dataKey="bodyFat" name="Body fat %" stroke={COLORS.moss} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                <Line yAxisId="weight" type="monotone" dataKey="muscle" name="Muscle mass (lb)" stroke={COLORS.rust} strokeWidth={2} strokeDasharray="4 3" dot={{ r: 2 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card>
        <Eyebrow>Strength sessions</Eyebrow>
        {strengthSummarySessions.length === 0 ? (
          <div style={{ color: COLORS.inkSoft, fontSize: 14 }}>No strength sessions synced yet — connect Strava in Settings, then Sync from the Log tab.</div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px,1fr))", gap: 14, marginBottom: 14 }}>
              <Stat label="Sessions" value={strengthSummaryStats.count} />
              <Stat label="Total time" value={Math.round(strengthSummaryStats.totalMin / 6) / 10} unit="hrs" />
              {strengthSummaryStats.avgHR && <Stat label="Avg HR" value={strengthSummaryStats.avgHR} unit="bpm" />}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {strengthSummarySessions.slice(0, 10).map((s) => (
                <div key={s.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${COLORS.line}` }}>
                  <div style={{ color: COLORS.ink, fontSize: 13 }}>{fmtShort(s.date)}{s.notes ? ` — ${s.notes}` : ""}</div>
                  <div style={{ color: COLORS.inkSoft, fontSize: 12.5, fontFamily: "IBM Plex Mono, monospace" }}>
                    {s.durationMin || 0} min{s.avgHR ? ` · ${s.avgHR} bpm` : ""}{s.calories ? ` · ${s.calories} cal` : ""}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

function PlanView({ plan }) {
  const today = todayStr();
  return (
    <Card>
      <Eyebrow>Periodization · starts {fmtShort(plan.startDate)} · race {plan.raceDate}</Eyebrow>
      <div style={{ color: COLORS.inkSoft, fontSize: 12, marginBottom: 12 }}>
        Sunday is always off. Long run is Wednesday. During Build II and Peak, Thursday becomes a back-to-back long effort (next-day fatigue, closer to real race legs). Every 4th week is a cutback — volume drops ~25-30% to let the adaptation land.
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ textAlign: "left", color: COLORS.inkSoft, borderBottom: `1px solid ${COLORS.line}` }}>
              {["Wk", "Week of", "Phase", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Total"].map((h) => (
                <th key={h} style={{ padding: "8px 6px", fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {plan.weeks.map((w) => (
              <tr key={w.week} style={{ borderBottom: `1px solid ${COLORS.line}33` }}>
                <td style={{ padding: "8px 6px", color: COLORS.paper, fontFamily: "IBM Plex Mono, monospace" }}>{w.week}</td>
                <td style={{ padding: "8px 6px", color: COLORS.inkSoft, fontFamily: "IBM Plex Mono, monospace", whiteSpace: "nowrap" }}>{fmtShort(w.start)}</td>
                <td style={{ padding: "8px 6px", whiteSpace: "nowrap" }}>
                  <span style={{ color: w.color, fontWeight: 600 }}>{w.phase}</span>
                  {w.isCutback && <span style={{ color: COLORS.inkSoft, fontSize: 11 }}> · cutback</span>}
                </td>
                {w.days.map((d) => {
                  const isToday = d.date === today;
                  const isRest = d.type === "Rest";
                  return (
                    <td
                      key={d.date}
                      title={`${fmtShort(d.date)} — ${d.type}${d.strength ? " + Strength" : ""}`}
                      style={{
                        padding: "8px 6px",
                        color: isRest ? COLORS.inkSoft : COLORS.ink,
                        background: isToday ? COLORS.raised : "transparent",
                        fontFamily: "IBM Plex Mono, monospace",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {isRest ? "—" : `${d.miles}${d.strength ? "+S" : ""}`}
                    </td>
                  );
                })}
                <td style={{ padding: "8px 6px", color: COLORS.paper, fontFamily: "IBM Plex Mono, monospace", fontWeight: 600 }}>{w.totalMiles}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ color: COLORS.inkSoft, fontSize: 11, marginTop: 10 }}>"+S" indicates a strength session paired with that day's run.</div>
    </Card>
  );
}

function FoodSearch({ onAdd, usdaApiKey }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [unit, setUnit] = useState("oz");
  const [amount, setAmount] = useState("");
  const [usdaResults, setUsdaResults] = useState([]);
  const [usdaLoading, setUsdaLoading] = useState(false);
  const [usdaError, setUsdaError] = useState(null);
  const [usdaSearchedFor, setUsdaSearchedFor] = useState(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const qWords = q.split(/\s+/).filter(Boolean);
    const scored = FOOD_DB.map((f) => {
      const key = f.name.split(",")[0].toLowerCase().trim();
      const keyWords = key.split(/\s+/).filter(Boolean);
      let score = 0;
      if (key === q) score = 100;
      else if (q.startsWith(key) || key.startsWith(q)) score = 80;
      else if (keyWords.every((w) => qWords.includes(w))) score = 60;
      else if (keyWords.some((w) => qWords.includes(w))) score = 30;
      return { food: f, score };
    });
    return scored
      .filter((s) => s.score >= 30)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map((s) => s.food);
  }, [query]);

  const bestMatchScore = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || results.length === 0) return 0;
    const key = results[0].name.split(",")[0].toLowerCase().trim();
    if (key === q) return 100;
    if (q.startsWith(key) || key.startsWith(q)) return 80;
    return 30;
  }, [query, results]);

  const pick = (food) => {
    setSelected(food);
    setUnit("g");
    setAmount("100");
  };

  const grams = selected ? gramsForUnit(selected, unit, amount) : 0;
  const macros = selected ? macrosForGrams(selected, grams) : null;

  const add = () => {
    if (!selected || !amount) return;
    const baseName = `${selected.name}${selected.isOnline ? " (USDA)" : ""}`;
    const label = `${amount} ${unit}${Number(amount) !== 1 ? (unit === "serving" ? "s" : "") : ""} ${baseName}`;
    const entry = {
      name: label,
      baseName,
      amount,
      unit,
      cal: macros.cal,
      protein: macros.protein,
      carbs: macros.carbs,
      fat: macros.fat,
      // Per-100g rate + any food-specific unit conversions, carried forward
      // so the portion can be rescaled later — directly, or after copying.
      calPerG: selected.cal / 100,
      proteinPerG: selected.protein / 100,
      carbsPerG: selected.carbs / 100,
      fatPerG: selected.fat / 100,
    };
    if (selected.gramsPerCup) entry.gramsPerCup = selected.gramsPerCup;
    if (selected.servingGrams) entry.servingGrams = selected.servingGrams;
    onAdd(entry);
    setSelected(null);
    setAmount("");
    setQuery("");
    setUsdaResults([]);
    setUsdaSearchedFor(null);
  };

  const searchUsda = async () => {
    const rawQ = query.trim();
    if (!rawQ || !usdaApiKey) return;
    // "/" (and a couple of other search-operator characters) can make the
    // USDA gateway reject the request outright before it even runs a
    // search — e.g. "80/20 ground beef" fails where "80 20 ground beef"
    // works fine. Swap them for spaces rather than let that surprise you.
    const q = rawQ.replace(/[\/\\]/g, " ").replace(/\s+/g, " ").trim();
    setUsdaLoading(true);
    setUsdaError(null);
    try {
      const params = new URLSearchParams();
      params.set("api_key", usdaApiKey.trim());
      params.set("query", q);
      params.set("pageSize", "15");
      const url = `https://api.nal.usda.gov/fdc/v1/foods/search?${params.toString()}`;
      const res = await fetch(url);
      const bodyText = await res.text();
      if (!res.ok) {
        let detail = bodyText.slice(0, 200);
        try {
          const j = JSON.parse(bodyText);
          detail = j.error?.message || j.message || detail;
        } catch {}
        throw new Error(`HTTP ${res.status} — ${detail}`);
      }
      const data = JSON.parse(bodyText);
      const parsed = (data.foods || [])
        .filter((item) => item.dataType !== "Branded") // branded items report per-serving, not per-100g — skip rather than risk wrong math
        .slice(0, 8)
        .map((item) => {
          const get = (nameFrag) => {
            const n = (item.foodNutrients || []).find((fn) => (fn.nutrientName || "").toLowerCase().includes(nameFrag));
            return n ? Number(n.value) || 0 : 0;
          };
          return {
            name: item.description,
            cal: Math.round(get("energy")),
            protein: Math.round(get("protein") * 10) / 10,
            carbs: Math.round(get("carbohydrate") * 10) / 10,
            fat: Math.round(get("total lipid") * 10) / 10,
            isOnline: true,
          };
        }).filter((f) => f.cal > 0);
      setUsdaResults(parsed);
      setUsdaSearchedFor(rawQ);
      if (parsed.length === 0) setUsdaError("No results found — try a simpler or more generic term.");
    } catch (e) {
      setUsdaError(`Couldn't reach the USDA database: ${e.message || "network error"}`);
    } finally {
      setUsdaLoading(false);
    }
  };

  return (
    <Card>
      <Eyebrow>Search foods</Eyebrow>
      <Input
        placeholder="e.g. chicken breast, white rice, butter…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setSelected(null);
          setUsdaResults([]);
          setUsdaSearchedFor(null);
          setUsdaError(null);
        }}
      />
      {results.length > 0 && (
        <div style={{ marginTop: 8, border: `1px solid ${COLORS.line}`, borderRadius: 6, overflow: "hidden" }}>
          {results.map((f) => (
            <div
              key={f.name}
              onClick={() => pick(f)}
              style={{ padding: "9px 12px", cursor: "pointer", fontSize: 13.5, color: COLORS.ink, borderBottom: `1px solid ${COLORS.line}` }}
            >
              {f.name} <span style={{ color: COLORS.inkSoft, fontSize: 12 }}>· {f.cal} kcal / 100g</span>
            </div>
          ))}
        </div>
      )}

      {usdaResults.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ color: COLORS.inkSoft, fontSize: 11.5, marginBottom: 4 }}>From the USDA database:</div>
          <div style={{ border: `1px solid ${COLORS.line}`, borderRadius: 6, overflow: "hidden" }}>
            {usdaResults.map((f, i) => (
              <div
                key={i}
                onClick={() => pick(f)}
                style={{ padding: "9px 12px", cursor: "pointer", fontSize: 13.5, color: COLORS.ink, borderBottom: `1px solid ${COLORS.line}` }}
              >
                {f.name} <span style={{ color: COLORS.inkSoft, fontSize: 12 }}>· {f.cal} kcal / 100g</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {selected && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${COLORS.line}` }}>
          <div style={{ color: COLORS.paper, fontSize: 15, fontWeight: 600, marginBottom: 10 }}>
            {selected.name}
            {selected.isOnline && <span style={{ color: COLORS.amber, fontSize: 12, fontWeight: 400 }}> · USDA</span>}
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ maxWidth: 90 }} />
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              style={{ background: COLORS.bg, border: `1px solid ${COLORS.line}`, borderRadius: 6, padding: "8px 10px", color: COLORS.ink }}
            >
              {unitsForFood(selected).map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
            {macros && (
              <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 13, color: COLORS.amber }}>
                {macros.cal} kcal · P{macros.protein} C{macros.carbs} F{macros.fat}
              </div>
            )}
          </div>
          <Button onClick={add} style={{ marginTop: 12 }}>Add to today's log</Button>
        </div>
      )}

      {!selected && query.trim() && bestMatchScore < 60 && usdaSearchedFor !== query.trim() && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${COLORS.line}` }}>
          <div style={{ color: COLORS.inkSoft, fontSize: 12.5, marginBottom: 10 }}>
            {results.length === 0
              ? "Not in the local database."
              : "Nothing above is an exact match."}
            {usdaApiKey
              ? " Search the full USDA nutrition database instead, or use \"+ Add a custom food\" below."
              : " Add a free USDA API key in Settings to search hundreds of thousands of foods, or use \"+ Add a custom food\" below."}
          </div>
          {usdaApiKey && (
            <Button onClick={searchUsda} variant="ghost">
              {usdaLoading ? "Searching…" : `Search USDA database for "${query.trim()}"`}
            </Button>
          )}
          {usdaError && <div style={{ color: COLORS.rust, fontSize: 12.5, marginTop: 8 }}>{usdaError}</div>}
        </div>
      )}

      {!selected && !query.trim() && (
        <div style={{ color: COLORS.inkSoft, fontSize: 12, marginTop: 10 }}>
          {FOOD_DB.length} foods in the local database, plus the full USDA database if you've added an API key in Settings. Anything not found can always be added manually with the custom entry below.
        </div>
      )}
    </Card>
  );
}

const MEAL_CATEGORIES = ["Breakfast", "Lunch", "Dinner", "Snacks"];

function mealGuidance(category, prescription, phase) {
  const isLongDay = !!prescription && /Long Run|Back-to-Back/.test(prescription.type);
  const isRest = !!prescription && prescription.type === "Rest";
  const isTempo = !!prescription && /Tempo/.test(prescription.type);

  if (category === "Breakfast") {
    if (isLongDay) return "Long run today — go easy-digesting carbs (oatmeal, banana, toast, honey). Keep fat and fiber low so nothing sits heavy before you head out.";
    if (isRest) return "Rest day — lead with protein (eggs, Greek yogurt). No need to carb-load when you're not training.";
    if (isTempo) return "Moderate carbs + a bit of protein — oatmeal with fruit or toast with eggs sets up a quality effort without feeling heavy.";
    return "Balanced carbs + protein to start the day — nothing today needs special timing.";
  }
  if (category === "Lunch") {
    if (isLongDay) return "If this lands after the long run, prioritize recovery: aim for roughly 3-4x more carbs than protein (e.g. rice + chicken) to start refilling glycogen.";
    if (phase === "Peak" || phase === "Build II") return "Volume is high this phase — don't skimp on carbs at lunch even on a lighter day; you're still recovering from the week.";
    return "Standard balanced plate — lean protein, complex carbs, vegetables.";
  }
  if (category === "Dinner") {
    if (isLongDay) return "Second recovery meal of the day — keep protein high and replenish glycogen with starchy carbs (potatoes, rice, pasta).";
    if (isRest) return "Lighter on carbs tonight since today's load was low — lead with protein and vegetables.";
    return "Balanced dinner — protein + complex carbs, lighter on fat if it's late.";
  }
  // Snacks
  if (isLongDay) return "Extra recovery snack is reasonable today — a carb+protein combo (chocolate milk, Greek yogurt + fruit) within an hour or two of the long run helps recovery.";
  if (isRest) return "Snacks aren't doing much work today — have one if hungry, but there's no training demand to fuel around.";
  return "Use snacks to fill any real gap toward today's target — not to hit a number for its own sake.";
}

function Nutrition({
  meals,
  setMeals,
  savedMealSets,
  setSavedMealSets,
  profile,
  plan,
  runs,
  mealClipboard,
  setMealClipboard,
}) {
  const [viewDate, setViewDate] = useState(todayStr());
  const [form, setForm] = useState({ name: "", amount: "", unit: "oz", cal: "", protein: "", carbs: "", fat: "" });
  const [showCustom, setShowCustom] = useState(false);
  const [activeCategory, setActiveCategory] = useState("Breakfast");
  const [savingSetCategory, setSavingSetCategory] = useState(null);
  const [setNameDraft, setSetNameDraft] = useState("");
  const [editMealId, setEditMealId] = useState(null);
  const [editMealForm, setEditMealForm] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const list = meals[viewDate] || [];

  // Selecting items is a per-view action — clear the checkboxes whenever the
  // viewed day changes so stale selections from a previous day don't linger.
  useEffect(() => {
    setSelectedIds([]);
  }, [viewDate]);

  const energy = useMemo(() => computeDayEnergy(viewDate, profile, plan, runs), [viewDate, profile, plan, runs]);
  const { targetKcal, activityKcal, appliedDeficit, isHardDay, prescription, phase } = energy;

  const addFromSearch = (entry) => {
    setMeals({ ...meals, [viewDate]: [{ id: uid(), ...entry, category: activeCategory }, ...list] });
  };

  const addMeal = () => {
    if (!form.name || !form.cal) return;
    const entry = {
      id: uid(),
      name: form.name,
      cal: Number(form.cal) || 0,
      protein: Number(form.protein) || 0,
      carbs: Number(form.carbs) || 0,
      fat: Number(form.fat) || 0,
      category: activeCategory,
    };
    // If a portion was given, remember the per-gram rate so the amount can
    // be changed later (directly, or after copying elsewhere) and have
    // calories/macros rescale automatically instead of staying frozen.
    const amt = Number(form.amount);
    const grams = amt > 0 ? amt * (GRAMS_PER_UNIT[form.unit] || 1) : 0;
    if (grams > 0) {
      entry.amount = amt;
      entry.unit = form.unit;
      entry.calPerG = entry.cal / grams;
      entry.proteinPerG = entry.protein / grams;
      entry.carbsPerG = entry.carbs / grams;
      entry.fatPerG = entry.fat / grams;
    }
    setMeals({ ...meals, [viewDate]: [entry, ...list] });
    setForm({ name: "", amount: "", unit: "oz", cal: "", protein: "", carbs: "", fat: "" });
  };
  const removeMeal = (id) => setMeals({ ...meals, [viewDate]: list.filter((m) => m.id !== id) });
  const startEditMeal = (m) => {
    setEditMealId(m.id);
    setEditMealForm({ ...m });
  };
  // Changing amount/unit on a portion-tracked entry rescales cal/protein/
  // carbs/fat live, using the per-gram rate captured when it was created —
  // that rate never changes, only the displayed totals do.
  const updateEditPortion = (newAmount, newUnit) => {
    setEditMealForm((f) => {
      const grams = gramsForUnit(f, newUnit, newAmount);
      const updated = {
        ...f,
        amount: newAmount,
        unit: newUnit,
        cal: Math.round(f.calPerG * grams),
        protein: Math.round(f.proteinPerG * grams * 10) / 10,
        carbs: Math.round(f.carbsPerG * grams * 10) / 10,
        fat: Math.round(f.fatPerG * grams * 10) / 10,
      };
      if (f.baseName) {
        const plural = Number(newAmount) !== 1 && newUnit === "serving" ? "s" : "";
        updated.name = `${newAmount} ${newUnit}${plural} ${f.baseName}`;
      }
      return updated;
    });
  };
  const saveEditMeal = () => {
    setMeals({ ...meals, [viewDate]: list.map((m) => (m.id === editMealId ? { ...editMealForm } : m)) });
    setEditMealId(null);
    setEditMealForm(null);
  };

  const snapshotForClipboard = (m) => {
    const base = { name: m.name, cal: m.cal, protein: m.protein, carbs: m.carbs, fat: m.fat };
    if (m.calPerG !== undefined) {
      base.amount = m.amount;
      base.unit = m.unit;
      base.calPerG = m.calPerG;
      base.proteinPerG = m.proteinPerG;
      base.carbsPerG = m.carbsPerG;
      base.fatPerG = m.fatPerG;
      if (m.baseName) base.baseName = m.baseName;
      if (m.gramsPerCup) base.gramsPerCup = m.gramsPerCup;
      if (m.servingGrams) base.servingGrams = m.servingGrams;
    }
    return base;
  };
  const toggleSelected = (id) => {
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  };
  const copySelected = () => {
    const items = list.filter((m) => selectedIds.includes(m.id)).map(snapshotForClipboard);
    if (items.length === 0) return;
    setMealClipboard(items);
    setSelectedIds([]);
  };
  const copyOne = (m) => {
    setMealClipboard([snapshotForClipboard(m)]);
  };
  const pasteClipboard = () => {
    if (mealClipboard.length === 0) return;
    const newItems = mealClipboard.map((it) => ({ id: uid(), ...it, category: activeCategory }));
    setMeals({ ...meals, [viewDate]: [...newItems, ...list] });
  };
  const clearClipboard = () => setMealClipboard([]);

  const startSaveSet = (category, items) => {
    setSavingSetCategory(category);
    setSetNameDraft(`${category} — ${fmtShort(viewDate)}`);
  };
  const confirmSaveSet = (items) => {
    if (!setNameDraft.trim() || items.length === 0) return;
    const snapshot = items.map(({ name, cal, protein, carbs, fat }) => ({ name, cal, protein, carbs, fat }));
    setSavedMealSets([{ id: uid(), name: setNameDraft.trim(), items: snapshot }, ...savedMealSets]);
    setSavingSetCategory(null);
    setSetNameDraft("");
  };
  const removeMealSet = (id) => setSavedMealSets(savedMealSets.filter((s) => s.id !== id));
  const applyMealSet = (set) => {
    const newItems = set.items.map((it) => ({ id: uid(), ...it, category: activeCategory }));
    setMeals({ ...meals, [viewDate]: [...newItems, ...list] });
  };

  const dayTotals = list.reduce(
    (acc, m) => ({
      cal: acc.cal + Number(m.cal || 0),
      protein: acc.protein + Number(m.protein || 0),
      carbs: acc.carbs + Number(m.carbs || 0),
      fat: acc.fat + Number(m.fat || 0),
    }),
    { cal: 0, protein: 0, carbs: 0, fat: 0 }
  );
  const remaining = targetKcal - dayTotals.cal;
  const macroTargets = calcMacroTargets(targetKcal, profile.weightLb, isHardDay);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <Card>
        <Eyebrow>Viewing</Eyebrow>
        <DateNav date={viewDate} setDate={setViewDate} />
      </Card>

      {profile.weightLossMode && (
        <Card style={{ borderColor: COLORS.amber + "55" }}>
          <Eyebrow>Weight-loss mode</Eyebrow>
          <div style={{ color: COLORS.inkSoft, fontSize: 13, lineHeight: 1.6 }}>
            {isHardDay
              ? "This is a long run / back-to-back day — the deficit is paused so you're fully fueled for it."
              : appliedDeficit > 0
              ? `A ${Math.round(appliedDeficit)} kcal deficit is applied to this day's target.`
              : "Deficit isn't being applied on this day (check your base TDEE isn't already near the safety floor)."}
          </div>
        </Card>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px,1fr))", gap: 14 }}>
        <Card><Stat label="Base TDEE" value={profile.baseTDEE} unit="kcal" /></Card>
        <Card><Stat label="Activity this day" value={activityKcal} unit="kcal" /></Card>
        <Card><Stat label="Target this day" value={targetKcal} unit="kcal" /></Card>
        <Card style={{ borderColor: remaining < 0 ? COLORS.rust + "77" : COLORS.line }}>
          <Stat label={remaining < 0 ? "Over target" : "Remaining"} value={Math.abs(remaining)} unit="kcal" />
        </Card>
      </div>

      <Card>
        <Eyebrow>Macro targets — {fmtShort(viewDate)}</Eyebrow>
        <div style={{ color: COLORS.inkSoft, fontSize: 12, marginBottom: 14, lineHeight: 1.5 }}>
          Protein is set from your bodyweight (0.8 g/lb) so it holds steady whether or not you're in a deficit. Fat and carbs split the rest of the target — carbs get a bigger share on long run / back-to-back days for fueling. Each ring fills up as you log food, from outside in: protein, carbs, fat.
        </div>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <MacroRingsCombined
            macros={[
              { label: "Protein", have: dayTotals.protein, target: macroTargets.proteinG, color: COLORS.rust },
              { label: "Carbs", have: dayTotals.carbs, target: macroTargets.carbsG, color: COLORS.amber },
              { label: "Fat", have: dayTotals.fat, target: macroTargets.fatG, color: COLORS.moss },
            ]}
            centerValue={`${Math.round(dayTotals.cal)}`}
            centerLabel={`of ${targetKcal} kcal`}
          />
        </div>
      </Card>

      <Card>
        <Eyebrow>Log to</Eyebrow>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {MEAL_CATEGORIES.map((c) => (
            <div
              key={c}
              onClick={() => setActiveCategory(c)}
              style={{
                padding: "8px 14px",
                borderRadius: 20,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                background: activeCategory === c ? COLORS.amber : "transparent",
                color: activeCategory === c ? "#1B140A" : COLORS.inkSoft,
                border: `1px solid ${activeCategory === c ? COLORS.amber : COLORS.line}`,
              }}
            >
              {c}
            </div>
          ))}
        </div>
        <div style={{ color: COLORS.inkSoft, fontSize: 12, marginTop: 10 }}>
          Everything you add below — search, saved combos, or custom entry — gets logged under <b style={{ color: COLORS.ink }}>{activeCategory}</b> for <b style={{ color: COLORS.ink }}>{fmtShort(viewDate)}</b>.
        </div>
      </Card>

      <Card style={mealClipboard.length > 0 ? { borderColor: COLORS.amber + "55" } : undefined}>
        <Eyebrow>Clipboard {mealClipboard.length > 0 ? `· ${mealClipboard.length}` : ""}</Eyebrow>
        {mealClipboard.length === 0 ? (
          <div style={{ color: COLORS.inkSoft, fontSize: 13 }}>
            Nothing copied — check items below (or use "Copy" on a single item) to copy them here, then come back to any meal, any day, and paste.
          </div>
        ) : (
          <div>
            <div style={{ color: COLORS.inkSoft, fontSize: 12.5, marginBottom: 10 }}>{mealClipboard.map((m) => m.name).join(" · ")}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button onClick={pasteClipboard}>Paste to {activeCategory} — {fmtShort(viewDate)}</Button>
              <Button variant="ghost" onClick={clearClipboard}>Clear</Button>
            </div>
          </div>
        )}
      </Card>

      <Card>
        <Eyebrow>Saved meal combos · {savedMealSets.length}</Eyebrow>
        {savedMealSets.length === 0 ? (
          <div style={{ color: COLORS.inkSoft, fontSize: 13 }}>
            No combos saved yet — below, each meal section has a "Save this meal" button once it has items in it. Save a whole plate and re-add all of it at once to any meal, any day.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {savedMealSets.map((set) => {
              const setTotals = set.items.reduce(
                (acc, m) => ({
                  cal: acc.cal + Number(m.cal || 0),
                  protein: acc.protein + Number(m.protein || 0),
                  carbs: acc.carbs + Number(m.carbs || 0),
                  fat: acc.fat + Number(m.fat || 0),
                }),
                { cal: 0, protein: 0, carbs: 0, fat: 0 }
              );
              return (
                <div key={set.id} style={{ padding: "10px 0", borderBottom: `1px solid ${COLORS.line}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ color: COLORS.paper, fontSize: 14, fontWeight: 600 }}>{set.name}</div>
                      <div style={{ color: COLORS.inkSoft, fontSize: 12 }}>
                        {set.items.length} item{set.items.length !== 1 ? "s" : ""} · {Math.round(setTotals.cal)} kcal · P{Math.round(setTotals.protein)} C{Math.round(setTotals.carbs)} F{Math.round(setTotals.fat)}
                      </div>
                      <div style={{ color: COLORS.inkSoft, fontSize: 11.5, marginTop: 4 }}>{set.items.map((i) => i.name).join(" · ")}</div>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                      <Button onClick={() => applyMealSet(set)}>Add to {activeCategory}</Button>
                      <Button variant="danger" onClick={() => removeMealSet(set.id)}>Remove</Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <FoodSearch onAdd={addFromSearch} usdaApiKey={profile.usdaApiKey} />

      {!showCustom && (
        <Button variant="ghost" onClick={() => setShowCustom(true)}>+ Add a custom food not in the database</Button>
      )}

      {showCustom && (
        <Card>
          <Eyebrow>Custom entry — {activeCategory}</Eyebrow>
          <Input placeholder="Meal / food" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={{ marginBottom: 10 }} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(80px,1fr))", gap: 10 }}>
            <Input placeholder="Portion amount" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            <select
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              style={{ background: COLORS.bg, border: `1px solid ${COLORS.line}`, borderRadius: 6, padding: "8px 10px", color: COLORS.ink }}
            >
              <option value="g">g</option>
              <option value="oz">oz</option>
              <option value="lb">lb</option>
            </select>
            <Input placeholder="Calories" type="number" value={form.cal} onChange={(e) => setForm({ ...form, cal: e.target.value })} />
            <Input placeholder="Protein g" type="number" value={form.protein} onChange={(e) => setForm({ ...form, protein: e.target.value })} />
            <Input placeholder="Carbs g" type="number" value={form.carbs} onChange={(e) => setForm({ ...form, carbs: e.target.value })} />
            <Input placeholder="Fat g" type="number" value={form.fat} onChange={(e) => setForm({ ...form, fat: e.target.value })} />
          </div>
          <div style={{ color: COLORS.inkSoft, fontSize: 11.5, marginTop: 8 }}>
            Portion amount is optional — but fill it in (e.g. "1" + "oz") and the calories/macros above should be for that exact amount. That lets you rescale this item later (directly, or after copying it) just by changing the portion.
          </div>
          <Button onClick={addMeal} style={{ marginTop: 12 }}>Add meal</Button>
        </Card>
      )}

      {MEAL_CATEGORIES.map((category) => {
        const items = list.filter((m) => (m.category || "Snacks") === category);
        const totals = items.reduce(
          (acc, m) => ({
            cal: acc.cal + Number(m.cal || 0),
            protein: acc.protein + Number(m.protein || 0),
            carbs: acc.carbs + Number(m.carbs || 0),
            fat: acc.fat + Number(m.fat || 0),
          }),
          { cal: 0, protein: 0, carbs: 0, fat: 0 }
        );
        return (
          <Card key={category}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <Eyebrow>{category}</Eyebrow>
              {items.length > 0 && (
                <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 12.5, color: COLORS.amber }}>
                  {totals.cal} kcal · P{Math.round(totals.protein)} C{Math.round(totals.carbs)} F{Math.round(totals.fat)}
                </div>
              )}
            </div>
            <div style={{ color: COLORS.inkSoft, fontSize: 12, marginTop: 2, marginBottom: 10, lineHeight: 1.5 }}>
              {mealGuidance(category, prescription, phase)}
            </div>
            {items.length === 0 ? (
              <div style={{ color: COLORS.inkSoft, fontSize: 13 }}>Nothing logged yet.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {items.map((m) =>
                  editMealId === m.id ? (
                    <div key={m.id} style={{ padding: "8px 0", borderBottom: `1px solid ${COLORS.line}` }}>
                      {editMealForm.calPerG !== undefined && (
                        <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
                          <Input
                            placeholder="Amount"
                            type="number"
                            value={editMealForm.amount}
                            onChange={(e) => updateEditPortion(e.target.value, editMealForm.unit)}
                            style={{ maxWidth: 90 }}
                          />
                          <select
                            value={editMealForm.unit}
                            onChange={(e) => updateEditPortion(editMealForm.amount, e.target.value)}
                            style={{ background: COLORS.bg, border: `1px solid ${COLORS.line}`, borderRadius: 6, padding: "8px 10px", color: COLORS.ink }}
                          >
                            {unitsForFood(editMealForm).map((u) => (
                              <option key={u} value={u}>{u}</option>
                            ))}
                          </select>
                          <div style={{ color: COLORS.inkSoft, fontSize: 11.5 }}>Change the portion and macros rescale automatically</div>
                        </div>
                      )}
                      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: 8 }}>
                        <Input value={editMealForm.name} onChange={(e) => setEditMealForm({ ...editMealForm, name: e.target.value })} />
                        <Input placeholder="Cal" type="number" value={editMealForm.cal} onChange={(e) => setEditMealForm({ ...editMealForm, cal: e.target.value })} />
                        <Input placeholder="P" type="number" value={editMealForm.protein} onChange={(e) => setEditMealForm({ ...editMealForm, protein: e.target.value })} />
                        <Input placeholder="C" type="number" value={editMealForm.carbs} onChange={(e) => setEditMealForm({ ...editMealForm, carbs: e.target.value })} />
                        <Input placeholder="F" type="number" value={editMealForm.fat} onChange={(e) => setEditMealForm({ ...editMealForm, fat: e.target.value })} />
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        <Button onClick={saveEditMeal}>Save</Button>
                        <Button variant="ghost" onClick={() => setEditMealId(null)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "8px 0", borderBottom: `1px solid ${COLORS.line}`, gap: 10 }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(m.id)}
                          onChange={() => toggleSelected(m.id)}
                          style={{ marginTop: 4 }}
                        />
                        <div>
                          <div style={{ color: COLORS.paper, fontSize: 14, fontWeight: 600 }}>
                            {m.name}
                            {m.calPerG !== undefined && <span style={{ color: COLORS.inkSoft, fontSize: 11.5, fontWeight: 400 }}> · {m.amount}{m.unit}</span>}
                          </div>
                          <div style={{ color: COLORS.inkSoft, fontSize: 12 }}>{m.cal} kcal · P{m.protein || 0} C{m.carbs || 0} F{m.fat || 0}</div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                        <Button variant="ghost" onClick={() => copyOne(m)}>Copy</Button>
                        <Button variant="ghost" onClick={() => startEditMeal(m)}>Edit</Button>
                        <Button variant="danger" onClick={() => removeMeal(m.id)}>Remove</Button>
                      </div>
                    </div>
                  )
                )}
                {items.some((m) => selectedIds.includes(m.id)) && (
                  <Button
                    onClick={copySelected}
                    style={{ alignSelf: "flex-start", marginTop: 4 }}
                  >
                    Copy {items.filter((m) => selectedIds.includes(m.id)).length} selected
                  </Button>
                )}
                {items.length > 1 && savingSetCategory !== category && (
                  <Button variant="ghost" onClick={() => startSaveSet(category, items)} style={{ alignSelf: "flex-start", marginTop: 4 }}>
                    Save this meal as a combo
                  </Button>
                )}
                {savingSetCategory === category && (
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6, flexWrap: "wrap" }}>
                    <Input value={setNameDraft} onChange={(e) => setSetNameDraft(e.target.value)} style={{ maxWidth: 220 }} />
                    <Button onClick={() => confirmSaveSet(items)}>Save combo</Button>
                    <Button variant="ghost" onClick={() => setSavingSetCategory(null)}>Cancel</Button>
                  </div>
                )}
              </div>
            )}
          </Card>
        );
      })}

      <Card style={{ borderColor: COLORS.amber + "55" }}>
        <Eyebrow>Day total — {fmtShort(viewDate)}</Eyebrow>
        <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 18, color: COLORS.paper, fontWeight: 600 }}>
          {dayTotals.cal} <span style={{ fontSize: 13, color: COLORS.inkSoft, fontWeight: 400 }}>/ {targetKcal} kcal</span>
        </div>
        <div style={{ color: COLORS.inkSoft, fontSize: 13, marginTop: 4 }}>
          P{Math.round(dayTotals.protein)}g · C{Math.round(dayTotals.carbs)}g · F{Math.round(dayTotals.fat)}g
        </div>
      </Card>
    </div>
  );
}

function Settings({
  raceDate,
  setRaceDate,
  planStartDate,
  setPlanStartDate,
  profile,
  setProfile,
  onDataImported,
  stravaAuth,
  onConnectStrava,
  onDisconnectStrava,
  stravaConnecting,
  withingsAuth,
  onConnectWithings,
  onDisconnectWithings,
  withingsConnecting,
}) {
  const [importMsg, setImportMsg] = useState(null);
  const fileInputRef = React.useRef(null);

  const handleImportFile = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    importAllData(file, (ok) => {
      setImportMsg(ok ? "Restored — reloading…" : "That file didn't look like a Ridge Line backup.");
      if (ok) setTimeout(() => onDataImported(), 800);
    });
    e.target.value = "";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <Card>
        <Eyebrow>Race</Eyebrow>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, maxWidth: 400 }}>
          <div>
            <label style={{ fontSize: 12, color: COLORS.inkSoft }}>Plan start (Monday)</label>
            <Input type="date" value={planStartDate} onChange={(e) => setPlanStartDate(e.target.value)} style={{ marginTop: 4 }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: COLORS.inkSoft }}>Race date</label>
            <Input type="date" value={raceDate} onChange={(e) => setRaceDate(e.target.value)} style={{ marginTop: 4 }} />
          </div>
        </div>
        <div style={{ color: COLORS.inkSoft, fontSize: 12, marginTop: 10 }}>
          Week 1 always snaps to the Monday on or before whatever date you enter here.
        </div>
      </Card>
      <Card>
        <Eyebrow>Training frequency</Eyebrow>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: COLORS.ink, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={!!profile.reducedFrequency}
            onChange={(e) => setProfile({ ...profile, reducedFrequency: e.target.checked })}
          />
          5-day week (knee-friendly mode)
        </label>
        <div style={{ color: COLORS.inkSoft, fontSize: 12, marginTop: 10, lineHeight: 1.6 }}>
          Drops Thursday to a full rest day in Foundation and Build I (that day's mileage gets redistributed across Mon/Tue/Fri/Sat, not just deleted), and slows how fast the long run grows week to week during those two phases. Doesn't touch Build II or Peak, since Thursday there is the deliberate back-to-back long effort — too load-bearing to drop. Flip this on or off any week; the plan rebuilds immediately either way.
        </div>
      </Card>
      <Card>
        <Eyebrow>Nutrition baseline</Eyebrow>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, maxWidth: 400 }}>
          <div>
            <label style={{ fontSize: 12, color: COLORS.inkSoft }}>Base TDEE (rest-day calories)</label>
            <Input type="number" value={profile.baseTDEE} onChange={(e) => setProfile({ ...profile, baseTDEE: e.target.value })} style={{ marginTop: 4 }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: COLORS.inkSoft }}>Current weight (lb)</label>
            <Input type="number" value={profile.weightLb} onChange={(e) => setProfile({ ...profile, weightLb: e.target.value })} style={{ marginTop: 4 }} />
          </div>
        </div>
        <div style={{ color: COLORS.inkSoft, fontSize: 12, marginTop: 10 }}>
          Activity calories are estimated from logged run duration and shown for reference, but are not added to today's target — your target stays at your base TDEE (minus any deficit below) regardless of how much you ran. Don't know your TDEE precisely — a rough estimate is fine to start; it improves as your weight trend comes in.
        </div>
      </Card>
      <Card>
        <Eyebrow>Food search</Eyebrow>
        <div style={{ maxWidth: 420 }}>
          <label style={{ fontSize: 12, color: COLORS.inkSoft }}>USDA FoodData Central API key</label>
          <Input
            type="text"
            placeholder="Paste your free API key here"
            value={profile.usdaApiKey}
            onChange={(e) => setProfile({ ...profile, usdaApiKey: e.target.value })}
            style={{ marginTop: 4 }}
          />
        </div>
        <div style={{ color: COLORS.inkSoft, fontSize: 12, marginTop: 10, lineHeight: 1.6 }}>
          The built-in database has ~40 common foods. Adding a free USDA key unlocks searching their full nutrition database (hundreds of thousands of foods) right from the search box — no cost, no billing, just a personal rate limit. Get one instantly at{" "}
          <span style={{ color: COLORS.amber }}>fdc.nal.usda.gov/api-key-signup</span> (just an email address, no credit card) and paste it above.
        </div>
      </Card>
      <Card>
        <Eyebrow>Weight loss</Eyebrow>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: COLORS.ink, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={!!profile.weightLossMode}
            onChange={(e) => setProfile({ ...profile, weightLossMode: e.target.checked })}
          />
          Apply a daily calorie deficit
        </label>
        {profile.weightLossMode && (
          <div style={{ marginTop: 12, maxWidth: 220 }}>
            <label style={{ fontSize: 12, color: COLORS.inkSoft }}>Daily deficit (kcal)</label>
            <Input
              type="number"
              value={profile.deficitKcal}
              onChange={(e) => setProfile({ ...profile, deficitKcal: e.target.value })}
              style={{ marginTop: 4 }}
            />
          </div>
        )}
        <div style={{ color: COLORS.inkSoft, fontSize: 12, marginTop: 10, lineHeight: 1.6 }}>
          The deficit is automatically skipped on Long Run and Back-to-Back days so you're fully fueled for the sessions that matter most — it only applies on easier days. A 400-500 kcal/day deficit is roughly 1 lb/week, so 15 lb is about 15 weeks; going much faster than that while training volume is climbing raises injury and under-fueling risk. There's also a floor so the target never drops below a safe minimum regardless of the deficit you set.
        </div>
      </Card>
      <Card>
        <Eyebrow>Strava</Eyebrow>
        {stravaAuth ? (
          <div>
            <div style={{ color: COLORS.ink, fontSize: 13.5 }}>
              Connected{stravaAuth.athleteName ? ` as ${stravaAuth.athleteName}` : ""}.
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
              <Button variant="danger" onClick={onDisconnectStrava}>Disconnect</Button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ color: COLORS.inkSoft, fontSize: 12.5, marginBottom: 12, lineHeight: 1.6 }}>
              Connect your Strava account to pull runs in automatically instead of entering them by hand. You'll be sent to Strava to approve access, then back here.
            </div>
            <Button onClick={onConnectStrava}>{stravaConnecting ? "Connecting…" : "Connect Strava"}</Button>
          </div>
        )}
      </Card>
      <Card>
        <Eyebrow>Withings</Eyebrow>
        {withingsAuth ? (
          <div>
            <div style={{ color: COLORS.ink, fontSize: 13.5 }}>Connected.</div>
            <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
              <Button variant="danger" onClick={onDisconnectWithings}>Disconnect</Button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ color: COLORS.inkSoft, fontSize: 12.5, marginBottom: 12, lineHeight: 1.6 }}>
              Connect Withings to pull in weight, body fat %, and muscle mass automatically from your scale. Needs a free Withings developer app first — register at{" "}
              <span style={{ color: COLORS.amber }}>account.withings.com/partner/add_oauth2</span>, set the callback URI to this site's full URL, and paste the Client ID below (keep the Client Secret out of here — that one goes into Vercel's environment variables instead).
            </div>
            <div style={{ maxWidth: 320, marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: COLORS.inkSoft }}>Withings Client ID</label>
              <Input
                type="text"
                placeholder="Paste your Withings Client ID"
                value={profile.withingsClientId}
                onChange={(e) => setProfile({ ...profile, withingsClientId: e.target.value })}
                style={{ marginTop: 4 }}
              />
            </div>
            <Button onClick={onConnectWithings}>{withingsConnecting ? "Connecting…" : "Connect Withings"}</Button>
          </div>
        )}
      </Card>
      <Card>
        <Eyebrow>Backup &amp; restore</Eyebrow>
        <div style={{ color: COLORS.inkSoft, fontSize: 12.5, marginBottom: 12, lineHeight: 1.6 }}>
          Your data lives in this browser only. Export a backup file occasionally (e.g. before switching phones, clearing browser data, or just for peace of mind), and you can restore it here any time.
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Button onClick={exportAllData}>Export backup</Button>
          <Button variant="ghost" onClick={() => fileInputRef.current?.click()}>Restore from backup</Button>
          <input ref={fileInputRef} type="file" accept="application/json" onChange={handleImportFile} style={{ display: "none" }} />
        </div>
        {importMsg && <div style={{ color: COLORS.amber, fontSize: 12.5, marginTop: 10 }}>{importMsg}</div>}
      </Card>
      <Card style={{ borderColor: COLORS.amber + "55" }}>
        <Eyebrow>Coming next</Eyebrow>
        <div style={{ color: COLORS.inkSoft, fontSize: 13, lineHeight: 1.6 }}>
          Garmin (pending API approval) · smarter meal-plan suggestions tied to weekly training load.
        </div>
      </Card>
    </div>
  );
}
