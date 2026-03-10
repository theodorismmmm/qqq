'use strict';

/* ══════════════════════════════════════════════
   PWA & INIT
══════════════════════════════════════════════ */
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  document.getElementById('andInstr').style.display = 'block';
  document.getElementById('iosInstr').style.display = 'none';
  document.getElementById('tutTitle').textContent = '📲 Web App installieren (Android / Chrome)';
  document.getElementById('andBtn').classList.add('show');
});

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true
      || document.referrer.startsWith('android-app://')
      || new URLSearchParams(location.search).has('dev');
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
}

function promptInstall() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(() => { deferredPrompt = null; });
  }
}

function dismissWarning() {
  document.getElementById('warnOverlay').style.display = 'none';
  sessionStorage.setItem('warned', '1');
}

function launchApp() {
  document.getElementById('installScreen').style.display = 'none';
  document.getElementById('webUseBtn').style.display = 'none';
  document.getElementById('app').style.display = 'flex';

  // ── Determine if this is first-use or a returning user ──────────────────
  // ?onboard in URL forces the onboarding to show (useful for re-testing)
  const forceOnboard = new URLSearchParams(location.search).has('onboard');
  if (forceOnboard) localStorage.removeItem('ms_prefs_done');

  const prefsDone   = localStorage.getItem('ms_prefs_done') === '1';
  const teacherMode = isTeacher() || getLicenseType() === 'teacher';
  const showingOnboard = !teacherMode && !prefsDone;

  // Only show the data-loss warning if we're NOT about to show the onboarding
  if (!showingOnboard && !sessionStorage.getItem('warned')) {
    document.getElementById('warnOverlay').style.display = 'flex';
  }

  // Show onboarding FIRST so an init error below can't block it
  if (showingOnboard) {
    showOnboarding(false);
  }

  // ── App initialisation ──────────────────────────────────────────────────
  initCoordCanvas();
  initLcColorRow();
  renderCoordSysTabs();
  bildSetupDropZone();
  initPhysRulerDrag();

  // ── Restore saved settings ──────────────────────────────────────────────
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) applyTheme(savedTheme);
  const savedAccent = localStorage.getItem('accentColor');
  if (savedAccent) setAccentColor(savedAccent);
  const savedAdvanced = localStorage.getItem('advancedMode') === '1';
  document.getElementById('advancedModeToggle').checked = savedAdvanced;
  toggleAdvancedMode(savedAdvanced);

  // ── Restore mode / preferences ──────────────────────────────────────────
  // License system handles feature enabling; legacy teacher mode is bridged inside checkLicenseOnStartup
  checkLicenseOnStartup();
  if (getLicenseType() === 'free' && prefsDone) {
    // free mode: onboarding already done but no license → show prefs anyway as user set them
    // But limit the visible tabs via applyLicense(null) already called
  } else if (getLicenseType() !== 'free' && prefsDone && getLicenseType() !== 'teacher') {
    // pro / student already applied by checkLicenseOnStartup → ensure grade prefs are loaded
    if (getLicenseType() === 'pro') loadAndApplyPreferences();
  }
  // (onboarding already opened above if neither condition is true)

  if (window._hideLoadingScreen) window._hideLoadingScreen();
}

window.addEventListener('load', () => {
  // Service Worker registration
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  // After loading animation finishes (min 1.2s), show the actual app/install screen
  const showUI = () => {
    if (isStandalone() || window._autoLaunch) {
      launchApp();
      // If a specific tab was requested (e.g. from coordinates.html), switch to it
      if (window._autoLaunch) setTimeout(() => switchTab(window._autoLaunch), 0);
    } else {
      // Hide loading screen first, then show install screen
      const ls = document.getElementById('loadingScreen');
      if (ls && ls.style.display !== 'none') {
        ls.classList.add('fade-out');
        setTimeout(() => {
          ls.style.display = 'none';
          document.getElementById('installScreen').style.display = 'flex';
        }, 520);
      } else {
        document.getElementById('installScreen').style.display = 'flex';
      }
      if (!isIOS() && !deferredPrompt) {
        // Desktop or non-iOS non-Android – update tutorial title
        document.getElementById('tutTitle').textContent = '🖥️ Web-App installieren';
      }
    }
  };

  // Wait at least 1.4s for the loading animation to play through
  setTimeout(showUI, 1400);

  // Listen for display-mode change (after install)
  window.matchMedia('(display-mode: standalone)').addEventListener('change', e => {
    if (e.matches) launchApp();
  });
});

/* ══════════════════════════════════════════════
   NAVIGATION
══════════════════════════════════════════════ */
let currentTab = 'rechner';
let currentSub = 'grundrechner';

function switchTab(tab) {
  currentTab = tab;
  document.getElementById('tabRechner').classList.toggle('active', tab === 'rechner');
  document.getElementById('tabKoord').classList.toggle('active', tab === 'koordinaten');
  document.getElementById('tabNotizen').classList.toggle('active', tab === 'notizen');
  document.getElementById('tabKlasse').classList.toggle('active', tab === 'klasse');
  document.getElementById('tabBild').classList.toggle('active', tab === 'bild');
  document.getElementById('tabAgent').classList.toggle('active', tab === 'agent');
  document.getElementById('tabHandbuch').classList.toggle('active', tab === 'handbuch');
  document.getElementById('tabSettings').classList.toggle('active', tab === 'settings');
  document.getElementById('nbRechner').classList.toggle('active', tab === 'rechner');
  document.getElementById('nbKoord').classList.toggle('active', tab === 'koordinaten');
  document.getElementById('nbNotizen').classList.toggle('active', tab === 'notizen');
  document.getElementById('nbKlasse').classList.toggle('active', tab === 'klasse');
  document.getElementById('nbBild').classList.toggle('active', tab === 'bild');
  document.getElementById('nbAgent').classList.toggle('active', tab === 'agent');
  document.getElementById('nbHandbuch').classList.toggle('active', tab === 'handbuch');
  document.getElementById('nbSettings').classList.toggle('active', tab === 'settings');
  if (tab === 'koordinaten') { resizeCanvas(); applyRangeSettings(); }
  if (tab === 'klasse') { initKlasse(); }
  if (tab === 'handbuch') { initHandbuch(); }
}

function switchSub(id) {
  currentSub = id;
  document.querySelectorAll('#tabRechner .spanel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('#tabRechner .stab').forEach(b => b.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  const idx = ['grundrechner','gleichungen','brueche','einheiten'].indexOf(id);
  if (idx >= 0) document.querySelectorAll('#tabRechner .stab')[idx].classList.add('active');
  if (id === 'einheiten') initUnitConverter();
}

/* ══════════════════════════════════════════════
   BASIC CALCULATOR
══════════════════════════════════════════════ */
const calc = { expr: '', result: '0', history: [] };
let calcAngleMode = 'deg';   // 'deg' | 'rad'
let calcSciMode   = false;
const calcVars = { x: 0, y: 0 };

function updateCalcVars() {
  calcVars.x = parseFloat(document.getElementById('calcVarX').value) || 0;
  calcVars.y = parseFloat(document.getElementById('calcVarY').value) || 0;
  // Keep kbVars in sync
  if (typeof kbVars !== 'undefined') {
    const kx = kbVars.find(v => v.name === 'x');
    const ky = kbVars.find(v => v.name === 'y');
    if (kx) kx.value = calcVars.x;
    if (ky) ky.value = calcVars.y;
    renderMkVarBtns();
  }
  // Refresh live preview if there's an expression
  if (calc.expr) {
    try { calc.result = String(evalSafe(calc.expr)); } catch { calc.result = '...'; }
    updateCalcDisplay();
  }
}

function calcInput(ch) {
  const last = calc.expr.slice(-1);
  const ops = ['+','-','×','÷','^'];

  if (ch === '√') {
    calc.expr += 'sqrt(';
    updateCalcDisplay();
    return;
  }
  // Smart parenthesis toggle
  if (ch === '()') {
    const opens = (calc.expr.match(/\(/g) || []).length;
    const closes = (calc.expr.match(/\)/g) || []).length;
    ch = opens > closes ? ')' : '(';
  }
  // Prevent double operators
  if (ops.includes(ch) && ops.includes(last) && last !== ')') {
    calc.expr = calc.expr.slice(0, -1);
  }
  calc.expr += ch;
  // Live preview
  try { calc.result = String(evalSafe(calc.expr)); } catch { calc.result = '...'; }
  updateCalcDisplay();
}

function calcClear() {
  calc.expr = ''; calc.result = '0';
  updateCalcDisplay();
}

function calcBackspace() {
  const fns = ['asin(','acos(','atan(','sqrt(','sin(','cos(','tan(','log(','exp(','ln('];
  const matched = fns.find(fn => calc.expr.endsWith(fn));
  if (matched) { calc.expr = calc.expr.slice(0, -matched.length); }
  else { calc.expr = calc.expr.slice(0, -1); }
  try { calc.result = calc.expr ? String(evalSafe(calc.expr)) : '0'; } catch { calc.result = '...'; }
  updateCalcDisplay();
}

function calcEval() {
  if (!calc.expr) return;
  try {
    const res = evalSafe(calc.expr);
    const entry = calc.expr + ' = ' + formatNum(res);
    calc.history.unshift(entry);
    if (calc.history.length > 3) calc.history.pop();
    calc.result = formatNum(res);
    calc.expr = '';
  } catch {
    calc.result = 'Fehler';
    calc.expr = '';
  }
  updateCalcDisplay();
}

function formatNum(n) {
  if (typeof n !== 'number' || !isFinite(n)) return 'Fehler';
  if (Number.isInteger(n)) return String(n);
  // Round to 10 decimal places to avoid float artifacts
  return parseFloat(n.toFixed(10)).toString();
}

function evalSafe(expr) {
  // Build variable map from kbVars (fallback to calcVars for x/y)
  const varMap = {};
  if (typeof kbVars !== 'undefined') {
    kbVars.forEach(v => { varMap[v.name] = v.value; });
  } else {
    if (typeof calcVars !== 'undefined') {
      varMap.x = calcVars.x;
      varMap.y = calcVars.y;
    }
  }
  // Build a stripped version for safety check, replacing known vars
  let stripped = expr.replace(/asin|acos|atan|sqrt|log|exp|sin|cos|tan|ln/gi, '').replace(/[πe]/g, '0');
  Object.keys(varMap).forEach(name => {
    stripped = stripped.replace(new RegExp('\\b' + name + '\\b', 'g'), '0');
  });
  if (!/^[0-9\s\+\-\*\/\.\(\)\^×÷%,]+$/.test(stripped)) throw new Error('unsafe');
  const ci = calcAngleMode === 'deg' ? `*${Math.PI}/180` : '';   // input → radians
  const co = calcAngleMode === 'deg' ? `*${180 / Math.PI}` : ''; // radians → output
  let e = expr
    .replace(/×/g, '*').replace(/÷/g, '/')
    .replace(/\^/g, '**')
    // Function replacements (longest first to avoid partial matches)
    .replace(/asin\(/gi, '_asin(').replace(/acos\(/gi, '_acos(').replace(/atan\(/gi, '_atan(')
    .replace(/sqrt\(/gi, 'Math.sqrt(')
    // Use negative lookbehind to avoid re-matching 'sin' inside already-replaced '_asin' etc.
    .replace(/(?<!a)sin\(/gi, '_sin(').replace(/(?<!a)cos\(/gi, '_cos(').replace(/(?<!a)tan\(/gi, '_tan(')
    .replace(/log\(/gi,  'Math.log10(').replace(/ln\(/gi, 'Math.log(').replace(/exp\(/gi, 'Math.exp(')
    // Constant replacements
    .replace(/π/g, String(Math.PI)).replace(/\be\b/g, String(Math.E));
  // Replace variables (longer names first to avoid partial replacement)
  Object.keys(varMap).sort((a, b) => b.length - a.length).forEach(name => {
    e = e.replace(new RegExp('\\b' + name + '\\b', 'g'), `(${varMap[name]})`);
  });
  // Percentage
  e = e.replace(/(\d)(%)/g, '($1/100)').replace(/(%)/g, '/100');
  // eslint-disable-next-line no-new-func
  return Function(`"use strict";
    const _sin=x=>Math.sin(x${ci});
    const _cos=x=>Math.cos(x${ci});
    const _tan=x=>Math.tan(x${ci});
    const _asin=x=>Math.asin(x)${co};
    const _acos=x=>Math.acos(x)${co};
    const _atan=x=>Math.atan(x)${co};
    return (${e});`)();
}

function updateCalcDisplay() {
  const histEl = document.getElementById('calcHist');
  histEl.innerHTML = calc.history.map(h =>
    `<div class="chistrow">${escHtml(h)}</div>`).join('');
  const exprEl = document.getElementById('calcExpr');
  exprEl.textContent = calc.expr || '';
  // Always scroll to show the latest (rightmost) characters
  exprEl.scrollLeft = exprEl.scrollWidth;
  document.getElementById('calcRes').textContent = calc.result;
}

function toggleSciMode() {
  calcSciMode = !calcSciMode;
  document.getElementById('sciRows').style.display = calcSciMode ? 'block' : 'none';
  document.getElementById('sciToggleBtn').classList.toggle('active', calcSciMode);
  document.getElementById('angleBtn').style.display = calcSciMode ? 'inline-block' : 'none';
}

function toggleAngle() {
  calcAngleMode = calcAngleMode === 'deg' ? 'rad' : 'deg';
  const btn = document.getElementById('angleBtn');
  btn.textContent = calcAngleMode.toUpperCase();
  btn.classList.toggle('rad', calcAngleMode === 'rad');
  // Refresh live preview
  try { calc.result = calc.expr ? String(evalSafe(calc.expr)) : '0'; } catch { calc.result = '...'; }
  updateCalcDisplay();
}

/* Also handle keyboard input */
document.addEventListener('keydown', e => {
  if (currentSub !== 'grundrechner' || currentTab !== 'rechner') return;
  if (e.key === 'Backspace') { calcBackspace(); e.preventDefault(); }
  else if (e.key === 'Enter') { calcEval(); e.preventDefault(); }
  else if (e.key === 'Escape') { calcClear(); e.preventDefault(); }
  else if ('0123456789+-*/.()%^'.includes(e.key)) {
    calcInput(e.key === '*' ? '×' : e.key === '/' ? '÷' : e.key);
    e.preventDefault();
  } else if (e.key.length === 1) {
    // Block all other printable characters (letters, etc.)
    e.preventDefault();
  }
});

/* ══════════════════════════════════════════════
   EQUATION SOLVER
══════════════════════════════════════════════ */
function solveEquation() {
  const raw = document.getElementById('eqInput').value.trim();
  const sol = document.getElementById('eqSol');
  if (!raw) return;
  sol.classList.add('vis');

  try {
    const steps = parseAndSolve(raw);
    sol.innerHTML = renderSteps(steps);
  } catch (err) {
    sol.innerHTML = `<div class="errmsg">⚠️ ${escHtml(err.message)}</div>`;
  }
}

function parseAndSolve(raw) {
  // Normalize
  let eq = raw.replace(/\s/g, '').replace(/²/g, '^2').replace(/×/g, '*').replace(/÷/g, '/');
  const eqIdx = eq.indexOf('=');
  if (eqIdx < 0) throw new Error('Kein Gleichheitszeichen (=) gefunden.');

  const lhsStr = eq.slice(0, eqIdx);
  const rhsStr = eq.slice(eqIdx + 1);

  const lhs = parsePoly(lhsStr);
  const rhs = parsePoly(rhsStr);

  // Move rhs to lhs: lhs - rhs = 0
  const a = round(lhs.a - rhs.a);
  const b = round(lhs.b - rhs.b);
  const c = round(lhs.c - rhs.c);

  const steps = [];
  steps.push({ desc: 'Originalgleichung', math: raw });
  steps.push({ desc: 'Alle Terme auf die linke Seite', math: `${polyStr(a,b,c)} = 0` });

  if (a !== 0) {
    // Quadratic
    steps.push({ desc: 'Erkannt: Quadratische Gleichung (ax² + bx + c = 0)', math: `a = ${a},  b = ${b},  c = ${c}` });
    const D = round(b*b - 4*a*c);
    steps.push({ desc: 'Diskriminante berechnen: D = b² − 4ac', math: `D = (${b})² − 4·(${a})·(${c}) = ${D}` });

    if (D < 0) {
      steps.push({ desc: 'D < 0 → Keine reellen Lösungen', math: 'Keine Lösung in ℝ' });
      return steps;
    } else if (D === 0) {
      const x = round(-b / (2*a));
      steps.push({ desc: 'D = 0 → Eine Lösung (doppelte Nullstelle)', math: `x = -b / (2a) = ${-b} / ${2*a} = ${x}` });
      steps.push({ desc: '✅ Ergebnis', math: `x = ${x}`, result: true });
    } else {
      const sqrtD = round(Math.sqrt(D));
      steps.push({ desc: '√D berechnen', math: `√D = √${D} ≈ ${sqrtD}` });
      const x1 = round((-b + Math.sqrt(D)) / (2*a));
      const x2 = round((-b - Math.sqrt(D)) / (2*a));
      steps.push({ desc: 'Lösungsformel: x₁,₂ = (−b ± √D) / (2a)', math: `x₁ = (${-b} + ${sqrtD}) / ${2*a} = ${x1}` });
      steps.push({ desc: '', math: `x₂ = (${-b} − ${sqrtD}) / ${2*a} = ${x2}` });
      steps.push({ desc: '✅ Ergebnis', math: `x₁ = ${x1},   x₂ = ${x2}`, result: true });
    }
  } else if (b !== 0) {
    // Linear
    steps.push({ desc: 'Erkannt: Lineare Gleichung (bx + c = 0)', math: `${b}x + (${c}) = 0` });
    steps.push({ desc: 'x-Term isolieren: bx = −c', math: `${b}x = ${-c}` });
    const x = round(-c / b);
    steps.push({ desc: 'Beide Seiten durch b dividieren: x = −c/b', math: `x = ${-c} ÷ ${b} = ${x}` });
    steps.push({ desc: '✅ Ergebnis', math: `x = ${x}`, result: true });
  } else {
    if (c === 0) steps.push({ desc: '⚠️ Jede Zahl ist eine Lösung (unendlich viele Lösungen)', math: 'x ∈ ℝ' });
    else steps.push({ desc: '⚠️ Keine Lösung (Widerspruch)', math: `${c} ≠ 0` });
  }
  return steps;
}

function parsePoly(expr) {
  // Returns {a, b, c} for ax² + bx + c
  // Normalize signs
  let e = expr.replace(/\-/g, '+-').replace(/^\+/, '');
  let terms = e.split('+').filter(t => t !== '');
  let a = 0, b = 0, c = 0;
  for (let t of terms) {
    t = t.trim();
    if (t === '') continue;
    if (/x\^?2/.test(t)) {
      let coef = t.replace(/x\^?2/, '');
      if (coef === '' || coef === '+') coef = '1';
      else if (coef === '-') coef = '-1';
      a += parseFloat(coef) || 0;
    } else if (/x/.test(t)) {
      let coef = t.replace(/x/, '');
      if (coef === '' || coef === '+') coef = '1';
      else if (coef === '-') coef = '-1';
      b += parseFloat(coef) || 0;
    } else {
      if (t !== '') c += parseFloat(t) || 0;
    }
  }
  return { a, b, c };
}

function polyStr(a, b, c) {
  let parts = [];
  if (a !== 0) parts.push(`${a}x²`);
  if (b !== 0) parts.push(`${b > 0 && parts.length ? '+' : ''}${b}x`);
  if (c !== 0) parts.push(`${c > 0 && parts.length ? '+' : ''}${c}`);
  return parts.length ? parts.join('') : '0';
}

function renderSteps(steps) {
  let html = '<div class="psect" style="margin-bottom:8px">Lösungsweg</div>';
  let num = 1;
  const result = steps.filter(s => s.result);
  const regular = steps.filter(s => !s.result);
  for (const s of regular) {
    html += `<div class="solstep">
      <div class="ssn">${num++}</div>
      <div><div class="ssd">${escHtml(s.desc)}</div><div class="ssm">${escHtml(s.math)}</div></div>
    </div>`;
  }
  for (const s of result) {
    html += `<div class="solres"><div class="rl">${escHtml(s.desc)}</div><div class="rv">${escHtml(s.math)}</div></div>`;
  }
  return html;
}

/* ══════════════════════════════════════════════
   FRACTION CALCULATOR
══════════════════════════════════════════════ */
let fracOp = '+';

function setFracOp(op) {
  fracOp = op;
  ['Add','Sub','Mul','Div'].forEach(id => document.getElementById('op'+id).classList.remove('sel'));
  const map = {'+':'Add','-':'Sub','*':'Mul','/':'Div'};
  document.getElementById('op'+map[op]).classList.add('sel');
}

function solveFraction() {
  const n1 = parseInt(document.getElementById('fn1').value);
  const d1 = parseInt(document.getElementById('fd1').value);
  const n2 = parseInt(document.getElementById('fn2').value);
  const d2 = parseInt(document.getElementById('fd2').value);
  const sol = document.getElementById('fracSol');

  if (!d1 || !d2) { sol.classList.add('vis'); sol.innerHTML = '<div class="errmsg">Nenner darf nicht 0 sein</div>'; return; }

  const steps = [];
  const opSymbols = { '+': '+', '-': '−', '*': '×', '/': '÷' };
  steps.push({ desc: 'Aufgabe', math: `${n1}/${d1}  ${opSymbols[fracOp]}  ${n2}/${d2}` });

  let rn, rd;
  if (fracOp === '+' || fracOp === '-') {
    const lcm = LCM(Math.abs(d1), Math.abs(d2));
    const f1 = lcm / d1, f2 = lcm / d2;
    const en1 = n1 * f1, en2 = n2 * f2;
    steps.push({ desc: 'Gemeinsamer Nenner (kgV)', math: `kgV(${Math.abs(d1)}, ${Math.abs(d2)}) = ${lcm}` });
    steps.push({ desc: 'Brüche erweitern', math: `${en1}/${lcm}  ${opSymbols[fracOp]}  ${en2}/${lcm}` });
    rn = fracOp === '+' ? en1 + en2 : en1 - en2;
    rd = lcm;
    steps.push({ desc: 'Zähler addieren/subtrahieren', math: `${rn}/${rd}` });
  } else if (fracOp === '*') {
    rn = n1 * n2; rd = d1 * d2;
    steps.push({ desc: 'Zähler × Zähler, Nenner × Nenner', math: `(${n1}×${n2}) / (${d1}×${d2}) = ${rn}/${rd}` });
  } else {
    rn = n1 * d2; rd = d1 * n2;
    steps.push({ desc: 'Durch Kehrwert multiplizieren', math: `${n1}/${d1} × ${d2}/${n2} = (${n1}×${d2}) / (${d1}×${n2}) = ${rn}/${rd}` });
  }

  const g = GCD(Math.abs(rn), Math.abs(rd));
  const sn = rn / g, sd = rd / g;
  if (g !== 1) steps.push({ desc: `Kürzen mit ggT(${Math.abs(rn)},${Math.abs(rd)}) = ${g}`, math: `${sn}/${sd}` });

  const dec = parseFloat((sn / sd).toFixed(8));
  steps.push({ desc: '✅ Ergebnis', math: `${sn}/${sd}  =  ${dec}`, result: true });

  sol.classList.add('vis');
  sol.innerHTML = renderSteps(steps);
}

function GCD(a, b) { return b === 0 ? a : GCD(b, a % b); }
function LCM(a, b) { return a / GCD(a, b) * b; }

/* ══════════════════════════════════════════════
   COORDINATE SYSTEM
══════════════════════════════════════════════ */
const COLORS = ['#cc0000','#0055cc','#007700','#cc6600','#770077','#005577','#cc4400','#004466'];
let colorIdx = 0;

const coord = {
  ox: 0, oy: 0,  // canvas pixel coords of math origin
  scale: 50,     // pixels per unit
  functions: [], // {expr, color, id}
  points: [],    // {x, y, name, id}
  strokes: [],   // [{mode, color, width, pts:[{cx,cy}]}]
  connectors: [], // [{pts:[{id,x,y,name}], color, type, id}]
  currentConnector: null, // {pts:[...], color, type}
  lineConnectMode: false,
  currentStroke: null,
  drawMode: 'none',
  canvasMode: 'pan',   // 'pan' | 'select' | 'draw' | 'snap' | 'text' | 'delete' | 'edit'
  drawColor: '#cc0000',
  showGrid: true,
  showLabels: true,
  showAxes: true,
  panStart: null,
  isPanning: false,
  pinchDist: 0,
  nextId: 1,
  lcConnType: 'straight',  // 'straight' | 'curved' | 'hyperbola'
  dragPoint: null,         // {id, ...} – point being dragged in select mode
  editPointId: null,       // id of point being edited
};

/* ══════════════════════════════════════════════
   MULTIPLE COORDINATE SYSTEMS
══════════════════════════════════════════════ */
// Each entry is a serializable snapshot of the coord state.
// Index 0 starts as null because the live `coord` object IS system 0 – it gets snapshotted on first switch.
let coordSystems = [null]; // index 0 = "live" coord (snapshotted on first switch away from it)
let coordSystemNames = ['System 1'];
let activeCoordIdx = 0;

function _snapshotCoord() {
  return {
    ox: coord.ox, oy: coord.oy, scale: coord.scale,
    functions: JSON.parse(JSON.stringify(coord.functions)),
    points: JSON.parse(JSON.stringify(coord.points)),
    strokes: JSON.parse(JSON.stringify(coord.strokes)),
    connectors: JSON.parse(JSON.stringify(coord.connectors)),
    drawMode: coord.drawMode,
    canvasMode: coord.canvasMode,
    drawColor: coord.drawColor,
    showGrid: coord.showGrid,
    showLabels: coord.showLabels,
    showAxes: coord.showAxes,
    nextId: coord.nextId,
    lcConnType: coord.lcConnType,
  };
}

function _applySnapshot(snap) {
  coord.ox = snap.ox; coord.oy = snap.oy; coord.scale = snap.scale;
  coord.functions = JSON.parse(JSON.stringify(snap.functions));
  coord.points = JSON.parse(JSON.stringify(snap.points));
  coord.strokes = JSON.parse(JSON.stringify(snap.strokes));
  coord.connectors = JSON.parse(JSON.stringify(snap.connectors));
  coord.drawMode = snap.drawMode;
  coord.canvasMode = snap.canvasMode || 'pan';
  coord.drawColor = snap.drawColor;
  coord.showGrid = snap.showGrid;
  coord.showLabels = snap.showLabels;
  coord.showAxes = snap.showAxes;
  coord.nextId = snap.nextId;
  coord.lcConnType = snap.lcConnType || 'straight';
  coord.currentConnector = null;
  coord.lineConnectMode = false;
  coord.currentStroke = null;
  coord.dragPoint = null;
  coord.editPointId = null;
}

function renderCoordSysTabs() {
  const container = document.getElementById('coordSysTabs');
  if (!container) return;
  container.innerHTML = '';
  coordSystemNames.forEach((name, i) => {
    const btn = document.createElement('button');
    btn.className = 'csys-tab' + (i === activeCoordIdx ? ' active' : '');
    btn.textContent = name;
    btn.title = 'Zu ' + name + ' wechseln';
    btn.addEventListener('click', () => switchCoordSystem(i));
    // Long-press to rename
    let pressTimer;
    btn.addEventListener('pointerdown', () => {
      pressTimer = setTimeout(() => renameCoordSystem(i), 600);
    });
    btn.addEventListener('pointerup', () => clearTimeout(pressTimer));
    btn.addEventListener('pointercancel', () => clearTimeout(pressTimer));
    container.appendChild(btn);
  });
}

function switchCoordSystem(idx) {
  if (idx === activeCoordIdx) return;
  // Save current
  coordSystems[activeCoordIdx] = _snapshotCoord();
  activeCoordIdx = idx;
  // Load new
  if (coordSystems[idx]) {
    _applySnapshot(coordSystems[idx]);
  }
  renderCoordSysTabs();
  renderFnList();
  renderPtList();
  renderLcConnectors();
  renderLcPointList();
  // Sync settings UI
  document.getElementById('gridStep') && (document.getElementById('gridStep').value = 1);
  setCanvasMode(coord.canvasMode || 'pan');
  document.getElementById('togGrid').classList.toggle('active', coord.showGrid);
  document.getElementById('togLabels').classList.toggle('active', coord.showLabels);
  document.getElementById('togAxes').classList.toggle('active', coord.showAxes);
  drawCanvas();
}

function addCoordSystem() {
  // Save current
  coordSystems[activeCoordIdx] = _snapshotCoord();
  // Create new empty system
  const newSnap = {
    ox: 0, oy: 0, scale: 50,
    functions: [], points: [], strokes: [], connectors: [],
    drawMode: 'none', drawColor: '#cc0000',
    showGrid: true, showLabels: true, showAxes: true, nextId: 1,
  };
  const newIdx = coordSystems.length;
  coordSystems.push(newSnap);
  coordSystemNames.push('System ' + (newIdx + 1));
  activeCoordIdx = newIdx;
  _applySnapshot(newSnap);
  resizeCanvas();  // re-center origin
  renderCoordSysTabs();
  renderFnList();
  renderPtList();
  renderLcConnectors();
  drawCanvas();
}

function renameCoordSystem(idx) {
  const name = prompt('Name für dieses Koordinatensystem:', coordSystemNames[idx]);
  if (name && name.trim()) {
    coordSystemNames[idx] = name.trim();
    renderCoordSysTabs();
  }
}


function initCoordCanvas() {
  const cvs = document.getElementById('cvs');
  resizeCanvas();

  // Setup color picker
  const cr = document.getElementById('colorRow');
  COLORS.forEach(c => {
    const b = document.createElement('div');
    b.className = 'colopt' + (c === coord.drawColor ? ' sel' : '');
    b.style.background = c;
    b.onclick = () => {
      coord.drawColor = c;
      cr.querySelectorAll('.colopt').forEach(o => o.classList.remove('sel'));
      b.classList.add('sel');
    };
    cr.appendChild(b);
  });

  // Canvas events
  cvs.addEventListener('pointerdown', onPointerDown);
  cvs.addEventListener('pointermove', onPointerMove);
  cvs.addEventListener('pointerup', onPointerUp);
  cvs.addEventListener('pointercancel', onPointerUp);
  cvs.addEventListener('wheel', onWheel, { passive: false });

  // Auto-dim toolbars when canvas is in active use
  let _canvasBusyTimer = null;
  cvs.addEventListener('pointerdown', () => {
    document.getElementById('tabKoord').classList.add('canvas-busy');
  });
  const _clearCanvasBusy = () => {
    clearTimeout(_canvasBusyTimer);
    _canvasBusyTimer = setTimeout(() => {
      document.getElementById('tabKoord').classList.remove('canvas-busy');
    }, 600);
  };
  cvs.addEventListener('pointerup', _clearCanvasBusy);
  cvs.addEventListener('pointercancel', _clearCanvasBusy);

  window.addEventListener('resize', () => { resizeCanvas(); applyRangeSettings(); });
  // Don't call drawCanvas here - canvas has 0 size since tabKoord is hidden on init
}

function resizeCanvas() {
  const cvs = document.getElementById('cvs');
  const container = document.getElementById('tabKoord');
  const rect = container.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  cvs.width = rect.width * dpr;
  cvs.height = rect.height * dpr;
  cvs.style.width = rect.width + 'px';
  cvs.style.height = rect.height + 'px';
  // Keep origin centered (in CSS pixels)
  coord.ox = cvs.width / dpr / 2;
  coord.oy = cvs.height / dpr / 2;
}

/* ─ Math ↔ Canvas transforms ─ */
function m2c(mx, my) {
  return { cx: coord.ox + mx * coord.scale, cy: coord.oy - my * coord.scale };
}
function c2m(cx, cy) {
  return { mx: (cx - coord.ox) / coord.scale, my: (coord.oy - cy) / coord.scale };
}
function snapToGrid(mx, my) {
  const gs = parseFloat(document.getElementById('gridStep').value) || 1;
  return { mx: Math.round(mx / gs) * gs, my: Math.round(my / gs) * gs };
}

/* ─ Draw Canvas ─ */
function applyRangeSettings() {
  const cvs = document.getElementById('cvs');
  const dpr = window.devicePixelRatio || 1;
  const W = cvs.width / dpr, H = cvs.height / dpr;
  if (!W || !H) return;
  const xMin = parseFloat(document.getElementById('xMin').value) || -10;
  const xMax = parseFloat(document.getElementById('xMax').value) || 10;
  const yMin = parseFloat(document.getElementById('yMin').value) || -8;
  const yMax = parseFloat(document.getElementById('yMax').value) || 8;
  const rangeW = xMax - xMin;
  const rangeH = yMax - yMin;
  if (rangeW > 0 && rangeH > 0) {
    coord.scale = Math.min(W / rangeW, H / rangeH) * 0.88;
    coord.ox = W / 2 - (xMin + xMax) / 2 * coord.scale;
    coord.oy = H / 2 + (yMin + yMax) / 2 * coord.scale;
  }
  // Sync table range with coordinate system x-range
  const tblFrom = document.getElementById('tblXFrom');
  const tblTo   = document.getElementById('tblXTo');
  if (tblFrom && tblTo) {
    tblFrom.value = xMin;
    tblTo.value   = xMax;
  }
  drawCanvas();
  autoSyncTable();
}

let _rafPending = false;
function drawCanvas() {
  if (_rafPending) return;
  _rafPending = true;
  requestAnimationFrame(() => { _rafPending = false; _drawCanvasNow(); });
}
function _drawCanvasNow() {
  const cvs = document.getElementById('cvs');
  if (!cvs) return;
  const ctx = cvs.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const W = cvs.width / dpr, H = cvs.height / dpr;
  if (!W || !H) return;  // Guard: skip render on zero-size canvas

  ctx.save();
  ctx.scale(dpr, dpr);

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  const gs = parseFloat(document.getElementById('gridStep').value) || 1;

  // Grid
  if (coord.showGrid) {
    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 1;
    const xStart = Math.floor(c2m(0, 0).mx / gs) * gs;
    const xEnd = Math.ceil(c2m(W, 0).mx / gs) * gs;
    const yStart = Math.floor(c2m(0, H).my / gs) * gs;
    const yEnd = Math.ceil(c2m(0, 0).my / gs) * gs;
    for (let x = xStart; x <= xEnd; x += gs) {
      const {cx} = m2c(x, 0);
      ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, H); ctx.stroke();
    }
    for (let y = yStart; y <= yEnd; y += gs) {
      const {cy} = m2c(0, y);
      ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(W, cy); ctx.stroke();
    }
  }

  // Axes
  if (coord.showAxes) {
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1.5;
    // X axis
    ctx.beginPath(); ctx.moveTo(0, coord.oy); ctx.lineTo(W, coord.oy); ctx.stroke();
    // Y axis
    ctx.beginPath(); ctx.moveTo(coord.ox, 0); ctx.lineTo(coord.ox, H); ctx.stroke();
    // Arrow tips
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    drawArrow(ctx, W-4, coord.oy, 8, 4, 'right');
    drawArrow(ctx, coord.ox, 4, 8, 4, 'up');
    // Axis labels
    if (coord.showLabels) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.font = '12px -apple-system, sans-serif';
      ctx.fillText('x', W - 16, coord.oy - 8);
      ctx.fillText('y', coord.ox + 8, 16);
    }
  }

  // Axis tick labels
  if (coord.showLabels && coord.showAxes) {
    const xStart2 = Math.floor(c2m(0, 0).mx / gs) * gs;
    const xEnd2 = Math.ceil(c2m(W, 0).mx / gs) * gs;
    const yStart2 = Math.floor(c2m(0, H).my / gs) * gs;
    const yEnd2 = Math.ceil(c2m(0, 0).my / gs) * gs;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.font = '10px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    for (let x = xStart2; x <= xEnd2; x += gs) {
      if (Math.abs(x) < gs * 0.1) continue;
      const {cx, cy} = m2c(x, 0);
      ctx.fillText(round(x), cx, Math.min(Math.max(cy + 14, 14), H - 4));
    }
    ctx.textAlign = 'right';
    for (let y = yStart2; y <= yEnd2; y += gs) {
      if (Math.abs(y) < gs * 0.1) continue;
      const {cx, cy} = m2c(0, y);
      ctx.fillText(round(y), Math.max(cx - 5, 20), Math.min(Math.max(cy + 4, 4), H - 4));
    }
    ctx.textAlign = 'left';
  }

  // Draw functions
  coord.functions.forEach(fn => plotFunction(ctx, fn.expr, fn.color));

  // Draw points
  coord.points.forEach(pt => drawPoint(ctx, pt));

  // Draw freehand strokes
  coord.strokes.forEach(stroke => drawStroke(ctx, stroke));
  if (coord.currentStroke) drawStroke(ctx, coord.currentStroke);

  // Draw saved connectors
  coord.connectors.forEach(con => drawConnector(ctx, con.pts, con.color, false, con.type));
  // Draw current connector being built
  if (coord.currentConnector && coord.currentConnector.pts.length >= 1) {
    drawConnector(ctx, coord.currentConnector.pts, coord.currentConnector.color, true, coord.currentConnector.type);
  }

  ctx.restore();
}

function drawArrow(ctx, x, y, size, halfW, dir) {
  ctx.beginPath();
  if (dir === 'right') {
    ctx.moveTo(x, y); ctx.lineTo(x-size, y-halfW); ctx.lineTo(x-size, y+halfW);
  } else {
    ctx.moveTo(x, y); ctx.lineTo(x-halfW, y+size); ctx.lineTo(x+halfW, y+size);
  }
  ctx.closePath(); ctx.fill();
}

function plotFunction(ctx, exprRaw, color) {
  const cvs = document.getElementById('cvs');
  const dpr = window.devicePixelRatio || 1;
  const W = cvs.width / dpr;
  const steps = W * 2;
  const xLeft = c2m(0, 0).mx;
  const xRight = c2m(W, 0).mx;
  const dx = (xRight - xLeft) / steps;

  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';

  let started = false;
  let prevY = null;

  for (let i = 0; i <= steps; i++) {
    const mx = xLeft + i * dx;
    const my = evalFn(exprRaw, mx);
    if (!isFinite(my) || isNaN(my)) { started = false; prevY = null; continue; }
    // Discontinuity detection
    if (prevY !== null && Math.abs(my - prevY) > Math.abs(c2m(0, 0).my - c2m(0, cvs.height / dpr).my) * 2) {
      started = false;
    }
    const {cx, cy} = m2c(mx, my);
    if (!started) { ctx.moveTo(cx, cy); started = true; }
    else { ctx.lineTo(cx, cy); }
    prevY = my;
  }
  ctx.stroke();
}

const _evalCache = new Map();
function evalFn(expr, x) {
  // Sanitize: only allow math-safe chars ('e' permits scientific notation like 1e3)
  if (!/^[0-9x\s\+\-\*\/\^\.\(\)πe]+$/i.test(expr.replace(/sqrt|sin|cos|tan|abs|log|exp|pi/gi, ''))) return NaN;
  let fn = _evalCache.get(expr);
  if (fn === undefined) {
    try {
      let e = expr
        .replace(/²/g, '**2').replace(/\^/g, '**')
        .replace(/\bpi\b/gi, Math.PI).replace(/π/g, Math.PI)
        .replace(/\bsqrt\b/gi, 'Math.sqrt').replace(/\bsin\b/gi, 'Math.sin')
        .replace(/\bcos\b/gi, 'Math.cos').replace(/\btan\b/gi, 'Math.tan')
        .replace(/\babs\b/gi, 'Math.abs').replace(/\blog\b/gi, 'Math.log10')
        .replace(/\bexp\b/gi, 'Math.exp')
        .replace(/([0-9π\)])\s*x/g, '$1*x');  // implicit multiply
      // Fix unary minus directly before exponentiation (JS syntax error: can't write -x**n)
      e = e.replace(/(^|\()-([^+\-*/^()\s]+)\*\*/g, '$10-$2**');
      // eslint-disable-next-line no-new-func
      fn = new Function('x', '"use strict"; return (' + e + ')');
      _evalCache.set(expr, fn);
    } catch {
      return NaN;  // don't cache compile failures (likely a transient/partial expression)
    }
  }
  if (!fn) return NaN;
  try { return fn(x); } catch { return NaN; }
}

function drawPoint(ctx, pt) {
  const {cx, cy} = m2c(pt.x, pt.y);
  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#cc0000';
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  if (coord.showLabels) {
    ctx.fillStyle = '#cc0000';
    ctx.font = 'bold 12px -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${pt.name}(${round(pt.x)},${round(pt.y)})`, cx + 8, cy - 5);
  }
}

function drawStroke(ctx, stroke) {
  if (!stroke.pts || stroke.pts.length < 2) return;
  ctx.beginPath();
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.moveTo(stroke.pts[0].cx, stroke.pts[0].cy);
  for (let i = 1; i < stroke.pts.length; i++) ctx.lineTo(stroke.pts[i].cx, stroke.pts[i].cy);
  ctx.stroke();
}

function drawConnector(ctx, pts, color, inProgress, type) {
  if (!pts || pts.length === 0) return;
  const canvasPts = pts.map(p => m2c(p.x, p.y));
  const connType = type || 'straight';

  // Draw connection
  if (canvasPts.length >= 2) {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (inProgress) ctx.setLineDash([6, 4]);

    if (connType === 'curved' && canvasPts.length >= 2) {
      // Smooth bezier curve through all points
      ctx.moveTo(canvasPts[0].cx, canvasPts[0].cy);
      if (canvasPts.length === 2) {
        const mx = (canvasPts[0].cx + canvasPts[1].cx) / 2;
        const my = (canvasPts[0].cy + canvasPts[1].cy) / 2 - Math.abs(canvasPts[1].cx - canvasPts[0].cx) * 0.3;
        ctx.quadraticCurveTo(mx, my, canvasPts[1].cx, canvasPts[1].cy);
      } else {
        for (let i = 1; i < canvasPts.length - 1; i++) {
          const xc = (canvasPts[i].cx + canvasPts[i+1].cx) / 2;
          const yc = (canvasPts[i].cy + canvasPts[i+1].cy) / 2;
          ctx.quadraticCurveTo(canvasPts[i].cx, canvasPts[i].cy, xc, yc);
        }
        const last = canvasPts[canvasPts.length - 1];
        const prev = canvasPts[canvasPts.length - 2];
        ctx.quadraticCurveTo(prev.cx, prev.cy, last.cx, last.cy);
      }
    } else if (connType === 'hyperbola' && canvasPts.length === 2) {
      // Hyperbola-like arc connector between two points
      const p1 = canvasPts[0], p2 = canvasPts[1];
      const dx = p2.cx - p1.cx, dy = p2.cy - p1.cy;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const nx = -dy / dist, ny = dx / dist; // normal vector
      const bulge = dist * 0.4;
      const cp1x = p1.cx + dx * 0.25 + nx * bulge;
      const cp1y = p1.cy + dy * 0.25 + ny * bulge;
      const cp2x = p1.cx + dx * 0.75 + nx * bulge;
      const cp2y = p1.cy + dy * 0.75 + ny * bulge;
      ctx.moveTo(p1.cx, p1.cy);
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.cx, p2.cy);
      // Draw the "other branch" of the hyperbola going below
      ctx.moveTo(p1.cx, p1.cy);
      ctx.bezierCurveTo(
        p1.cx + dx * 0.25 - nx * bulge, p1.cy + dy * 0.25 - ny * bulge,
        p1.cx + dx * 0.75 - nx * bulge, p1.cy + dy * 0.75 - ny * bulge,
        p2.cx, p2.cy
      );
    } else if (connType === 'hyperbola' && canvasPts.length > 2) {
      // Multi-point: smooth arc through each segment
      ctx.moveTo(canvasPts[0].cx, canvasPts[0].cy);
      for (let i = 1; i < canvasPts.length; i++) {
        const p1 = canvasPts[i-1], p2 = canvasPts[i];
        const mx2 = (p1.cx + p2.cx) / 2;
        const my2 = (p1.cy + p2.cy) / 2 - Math.abs(p2.cx - p1.cx) * 0.35;
        ctx.quadraticCurveTo(mx2, my2, p2.cx, p2.cy);
      }
    } else {
      // Straight polyline
      ctx.moveTo(canvasPts[0].cx, canvasPts[0].cy);
      for (let i = 1; i < canvasPts.length; i++) ctx.lineTo(canvasPts[i].cx, canvasPts[i].cy);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw arrows at midpoints of each segment
    for (let i = 1; i < canvasPts.length; i++) {
      const x1 = canvasPts[i-1].cx, y1 = canvasPts[i-1].cy;
      const x2 = canvasPts[i].cx,   y2 = canvasPts[i].cy;
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const as = 7;
      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.moveTo(mx + Math.cos(angle) * as, my + Math.sin(angle) * as);
      ctx.lineTo(mx + Math.cos(angle + 2.5) * as * 0.7, my + Math.sin(angle + 2.5) * as * 0.7);
      ctx.lineTo(mx + Math.cos(angle - 2.5) * as * 0.7, my + Math.sin(angle - 2.5) * as * 0.7);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Draw highlighted circles on connector points
  if (coord.showConnectorDots !== false) {
    canvasPts.forEach((cp, i) => {
      ctx.beginPath();
      ctx.arc(cp.cx, cp.cy, 7, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.35;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
      // Order number label
      ctx.fillStyle = color;
      ctx.font = 'bold 11px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(i + 1), cp.cx, cp.cy - 11);
      ctx.textAlign = 'left';
    });
  }
}

/* ─ Pointer Events ─ */
const activeTouches = new Map();

function onPointerDown(e) {
  e.preventDefault();
  const cvs = document.getElementById('cvs');
  activeTouches.set(e.pointerId, {x: e.clientX, y: e.clientY});
  cvs.setPointerCapture(e.pointerId);

  const rect = cvs.getBoundingClientRect();
  const cx = e.clientX - rect.left;
  const cy = e.clientY - rect.top;

  // Text placement mode
  if (coord.canvasMode === 'text') {
    placeTextLabel(cx, cy);
    setCanvasMode('pan');
    return;
  }

  // Line connector mode: click near a point to add it to the connector
  if (coord.lineConnectMode) {
    const hitR = 20; // pixels hit radius
    let nearest = null, nearDist = Infinity;
    coord.points.forEach(pt => {
      const {cx: pcx, cy: pcy} = m2c(pt.x, pt.y);
      const d = Math.sqrt((cx - pcx) ** 2 + (cy - pcy) ** 2);
      if (d < hitR && d < nearDist) { nearest = pt; nearDist = d; }
    });
    if (nearest) {
      if (!coord.currentConnector) {
        coord.currentConnector = { pts: [], color: coord.lcColor || '#4ecdc4', type: coord.lcConnType };
      }
      // Avoid adding the same point twice in a row
      const last = coord.currentConnector.pts[coord.currentConnector.pts.length - 1];
      if (!last || last.id !== nearest.id) {
        coord.currentConnector.pts.push({ id: nearest.id, x: nearest.x, y: nearest.y, name: nearest.name });
        renderLcPointList();
        drawCanvas();
      }
    }
    return;
  }

  // Delete mode: click near a point or stroke to delete it
  if (coord.canvasMode === 'delete') {
    const hitR = 18;
    // Try to hit a point first
    let hitPt = null;
    coord.points.forEach(pt => {
      const {cx: pcx, cy: pcy} = m2c(pt.x, pt.y);
      const d = Math.sqrt((cx - pcx) ** 2 + (cy - pcy) ** 2);
      if (d < hitR) hitPt = pt;
    });
    if (hitPt) { deletePoint(hitPt.id); return; }
    // Try to hit a connector
    let hitConn = null;
    coord.connectors.forEach(con => {
      if (isPointNearPolyline(cx, cy, con.pts.map(p => m2c(p.x, p.y)), hitR)) hitConn = con;
    });
    if (hitConn) { deleteConnector(hitConn.id); return; }
    // Delete last stroke if clicked anywhere (within hitR of a stroke point)
    for (let i = coord.strokes.length - 1; i >= 0; i--) {
      const st = coord.strokes[i];
      if (st.pts.some(p => Math.sqrt((cx - p.cx) ** 2 + (cy - p.cy) ** 2) < hitR)) {
        coord.strokes.splice(i, 1);
        drawCanvas();
        return;
      }
    }
    return;
  }

  // Edit mode: click near a point to open edit panel
  if (coord.canvasMode === 'edit') {
    const hitR = 20;
    let hitPt = null;
    coord.points.forEach(pt => {
      const {cx: pcx, cy: pcy} = m2c(pt.x, pt.y);
      const d = Math.sqrt((cx - pcx) ** 2 + (cy - pcy) ** 2);
      if (d < hitR) hitPt = pt;
    });
    if (hitPt) { openPtEdit(hitPt, cx, cy); }
    return;
  }

  // Select mode: start dragging a point
  if (coord.canvasMode === 'select') {
    const hitR = 20;
    let hitPt = null;
    coord.points.forEach(pt => {
      const {cx: pcx, cy: pcy} = m2c(pt.x, pt.y);
      const d = Math.sqrt((cx - pcx) ** 2 + (cy - pcy) ** 2);
      if (d < hitR) hitPt = pt;
    });
    if (hitPt) {
      coord.dragPoint = hitPt;
      return;
    }
    // If no point hit, start panning instead
    if (!coord.locked) {
      coord.isPanning = true;
      coord.panStart = { cx, cy, ox: coord.ox, oy: coord.oy };
      cvs.classList.add('panning', 'dragging');
    }
    return;
  }

  if (activeTouches.size === 2) {
    // Pinch zoom setup
    const pts = [...activeTouches.values()];
    const dx = pts[0].x - pts[1].x, dy = pts[0].y - pts[1].y;
    coord.pinchDist = Math.sqrt(dx*dx + dy*dy);
    coord.isPanning = false;
    if (coord.currentStroke) { coord.strokes.push(coord.currentStroke); coord.currentStroke = null; }
    return;
  }

  if (coord.canvasMode === 'pan') {
    if (!coord.locked) {
      coord.isPanning = true;
      coord.panStart = { cx, cy, ox: coord.ox, oy: coord.oy };
      cvs.classList.add('panning', 'dragging');
    }
  } else if (coord.canvasMode === 'draw' || coord.canvasMode === 'snap') {
    let {mx, my} = c2m(cx, cy);
    if (coord.canvasMode === 'snap') { const s = snapToGrid(mx, my); mx = s.mx; my = s.my; }
    const {cx: scx, cy: scy} = m2c(mx, my);
    const w = parseInt(document.getElementById('lineWidth').value) || 3;
    coord.currentStroke = { mode: coord.canvasMode, color: coord.drawColor, width: w, pts: [{cx: scx, cy: scy}] };
  }
}

function onPointerMove(e) {
  e.preventDefault();
  const cvs = document.getElementById('cvs');
  activeTouches.set(e.pointerId, {x: e.clientX, y: e.clientY});

  const rect = cvs.getBoundingClientRect();
  const cx = e.clientX - rect.left;
  const cy = e.clientY - rect.top;

  // Update coord info
  const {mx, my} = c2m(cx, cy);
  document.getElementById('coordInfo').textContent = `x=${mx.toFixed(2)}  y=${my.toFixed(2)}`;

  if (activeTouches.size === 2) {
    // Pinch zoom
    const pts = [...activeTouches.values()];
    const dx = pts[0].x - pts[1].x, dy = pts[0].y - pts[1].y;
    const newDist = Math.sqrt(dx*dx + dy*dy);
    if (coord.pinchDist > 0) {
      const factor = newDist / coord.pinchDist;
      const midX = (pts[0].x + pts[1].x) / 2 - rect.left;
      const midY = (pts[0].y + pts[1].y) / 2 - rect.top;
      zoomAt(factor, midX, midY);
    }
    coord.pinchDist = newDist;
    return;
  }

  // Drag point in select mode
  if (coord.dragPoint) {
    const {mx: dmx, my: dmy} = c2m(cx, cy);
    coord.dragPoint.x = parseFloat(dmx.toFixed(4));
    coord.dragPoint.y = parseFloat(dmy.toFixed(4));
    // Update connectors that reference this point
    coord.connectors.forEach(con => {
      con.pts.forEach(cp => {
        if (cp.id === coord.dragPoint.id) { cp.x = coord.dragPoint.x; cp.y = coord.dragPoint.y; }
      });
    });
    if (coord.currentConnector) {
      coord.currentConnector.pts.forEach(cp => {
        if (cp.id === coord.dragPoint.id) { cp.x = coord.dragPoint.x; cp.y = coord.dragPoint.y; }
      });
    }
    renderPtList();
    drawCanvas();
    return;
  }

  if (coord.isPanning && coord.panStart) {
    coord.ox = coord.panStart.ox + (cx - coord.panStart.cx);
    coord.oy = coord.panStart.oy + (cy - coord.panStart.cy);
    drawCanvas();
    if (coord.showRuler) drawRulers();
  } else if (coord.currentStroke) {
    let {mx: pmx, my: pmy} = c2m(cx, cy);
    if (coord.canvasMode === 'snap') { const s = snapToGrid(pmx, pmy); pmx = s.mx; pmy = s.my; }
    const {cx: scx, cy: scy} = m2c(pmx, pmy);
    coord.currentStroke.pts.push({cx: scx, cy: scy});
    drawCanvas();
  }
}

function onPointerUp(e) {
  e.preventDefault();
  activeTouches.delete(e.pointerId);
  const cvs = document.getElementById('cvs');
  coord.isPanning = false;
  cvs.classList.remove('panning', 'dragging');
  coord.panStart = null;
  if (coord.dragPoint) {
    coord.dragPoint = null;
    renderPtList();
    drawCanvas();
    return;
  }
  if (coord.currentStroke) {
    if (coord.currentStroke.pts.length >= 2) coord.strokes.push(coord.currentStroke);
    coord.currentStroke = null;
    drawCanvas();
  }
}

function onWheel(e) {
  e.preventDefault();
  if (coord.locked) return;
  const cvs = document.getElementById('cvs');
  const rect = cvs.getBoundingClientRect();
  const cx = e.clientX - rect.left;
  const cy = e.clientY - rect.top;
  const factor = e.deltaY < 0 ? 1.1 : 0.9;
  zoomAt(factor, cx, cy);
}

function zoomAt(factor, cx, cy) {
  if (coord.locked) return;
  const {mx, my} = c2m(cx, cy);
  coord.scale = Math.min(Math.max(coord.scale * factor, 5), 2000);
  coord.ox = cx - mx * coord.scale;
  coord.oy = cy + my * coord.scale;
  drawCanvas();
  if (coord.showRuler) drawRulers();
}

function zoomBy(factor) {
  const cvs = document.getElementById('cvs');
  const dpr = window.devicePixelRatio || 1;
  zoomAt(factor, cvs.width / 2 / dpr, cvs.height / 2 / dpr);
}

function resetView() {
  document.getElementById('xMin').value = -10;
  document.getElementById('xMax').value = 10;
  document.getElementById('yMin').value = -8;
  document.getElementById('yMax').value = 8;
  applyRangeSettings();
}

function applyScaleInput() {
  const s = parseFloat(document.getElementById('scaleInput').value);
  if (s >= 5) {
    const cvs = document.getElementById('cvs');
    const dpr = window.devicePixelRatio || 1;
    coord.scale = s;
    coord.ox = cvs.width / 2 / dpr;
    coord.oy = cvs.height / 2 / dpr;
    drawCanvas();
  }
}

/* ─ Functions ─ */
function addFunction() {
  const raw = document.getElementById('fnInput').value.trim();
  const errEl = document.getElementById('fnErr');
  if (!raw) return;

  // Normalize: strip "y=" prefix
  let expr = raw.replace(/^y\s*=\s*/i, '').replace(/\s/g, '');
  if (!expr) { showErr(errEl, 'Bitte eine Funktion eingeben'); return; }

  // Validate by evaluating at x=1
  const test = evalFn(expr, 1);
  if (isNaN(test)) { showErr(errEl, 'Ungültige Funktion. Beispiel: 2x+1 oder x^2-3'); return; }

  errEl.style.display = 'none';
  const color = COLORS[colorIdx % COLORS.length]; colorIdx++;
  const id = coord.nextId++;
  coord.functions.push({ expr, color, id, raw });
  document.getElementById('fnInput').value = '';
  renderFnList();
  renderCoordFnChips();
  drawCanvas();
  autoSyncTable();
}

function renderFnList() {
  const list = document.getElementById('fnList');
  list.innerHTML = coord.functions.map(fn =>
    `<div class="listitem">
      <div class="clrdot" style="background:${fn.color}"></div>
      <span class="lbl">y = ${escHtml(fn.expr)}</span>
      <button class="delbtn" onclick="deleteFunction(${fn.id})">✕</button>
    </div>`).join('');
}

function deleteFunction(id) {
  coord.functions = coord.functions.filter(f => f.id !== id);
  renderFnList(); renderCoordFnChips(); drawCanvas();
  autoSyncTable();
}

/* ─ Value Table ─ */
function generateTable() {
  const errEl = document.getElementById('tblErr');
  const output = document.getElementById('tblOutput');
  errEl.style.display = 'none';
  output.innerHTML = '';

  if (coord.functions.length === 0) {
    showErr(errEl, 'Bitte zuerst eine Funktion hinzufügen');
    return;
  }

  const xFrom = parseFloat(document.getElementById('tblXFrom').value);
  const xTo   = parseFloat(document.getElementById('tblXTo').value);
  const step  = parseFloat(document.getElementById('tblStep').value);

  if (isNaN(xFrom) || isNaN(xTo) || isNaN(step) || step <= 0) {
    showErr(errEl, 'Bitte gültige Werte eingeben (Schrittweite > 0)');
    return;
  }
  if (xFrom >= xTo) {
    showErr(errEl, '"x von" muss kleiner als "x bis" sein');
    return;
  }
  const maxRows = 500;
  const count = Math.round((xTo - xFrom) / step) + 1;
  if (count > maxRows) {
    showErr(errEl, `Zu viele Zeilen (max ${maxRows}). Schrittweite vergrößern`);
    return;
  }

  // Build header
  let header = '<tr><th>x</th>' +
    coord.functions.map(fn =>
      `<th style="color:${fn.color}">f(x) = ${escHtml(fn.expr)}</th>`
    ).join('') + '</tr>';

  // Build rows
  let rows = '';
  for (let i = 0; i < count; i++) {
    const x = parseFloat((xFrom + i * step).toFixed(10));
    if (x > xTo + step * 1e-9) break;
    const cells = coord.functions.map(fn => {
      const y = evalFn(fn.expr, x);
      if (!isFinite(y) || isNaN(y)) return '<td class="vt-nan">—</td>';
      return `<td>${round(y)}</td>`;
    }).join('');
    rows += `<tr><td class="vt-x">${round(x)}</td>${cells}</tr>`;
  }

  output.innerHTML =
    '<div class="vt-wrap"><table class="vt"><thead>' +
    header + '</thead><tbody>' + rows + '</tbody></table></div>';
}

/* Auto-sync table when pTabelle tab is active */
function autoSyncTable() {
  const tblPanel = document.getElementById('pTabelle');
  if (tblPanel && tblPanel.classList.contains('active')) {
    generateTable();
  }
}

/* ─ Points ─ */
function addPoint() {
  const name = document.getElementById('ptName').value.trim() || `P${coord.nextId}`;
  const x = parseFloat(document.getElementById('ptX').value);
  const y = parseFloat(document.getElementById('ptY').value);
  const errEl = document.getElementById('ptErr');
  if (isNaN(x) || isNaN(y)) { showErr(errEl, 'Bitte gültige x- und y-Koordinaten eingeben'); return; }
  errEl.style.display = 'none';
  const id = coord.nextId++;
  coord.points.push({ x, y, name, id });
  document.getElementById('ptName').value = '';
  document.getElementById('ptX').value = '';
  document.getElementById('ptY').value = '';
  renderPtList(); drawCanvas();
}

function renderPtList() {
  const list = document.getElementById('ptList');
  list.innerHTML = coord.points.map(pt =>
    `<div class="listitem">
      <div class="clrdot" style="background:#ffd93d"></div>
      <span class="lbl">${escHtml(pt.name)} (${round(pt.x)}, ${round(pt.y)})</span>
      <button class="delbtn" onclick="deletePoint(${pt.id})">✕</button>
    </div>`).join('');
}

function deletePoint(id) {
  coord.points = coord.points.filter(p => p.id !== id);
  renderPtList(); drawCanvas();
}

/* ─ Line Connector ─ */
const LC_COLORS = ['#cc0000','#0055cc','#007700','#cc6600','#770077','#005577','#555555'];
let lcColorIdx = 0;
coord.lcColor = LC_COLORS[0];

function initLcColorRow() {
  const row = document.getElementById('lcColorRow');
  if (!row || row.children.length > 0) return;
  LC_COLORS.forEach((c, i) => {
    const d = document.createElement('div');
    d.className = 'lc-colopt' + (i === 0 ? ' sel' : '');
    d.style.background = c;
    d.onclick = () => {
      coord.lcColor = c;
      if (coord.currentConnector) coord.currentConnector.color = c;
      row.querySelectorAll('.lc-colopt').forEach(o => o.classList.remove('sel'));
      d.classList.add('sel');
    };
    row.appendChild(d);
  });
}

function toggleLineConnectMode() {
  coord.lineConnectMode = !coord.lineConnectMode;
  const btn = document.getElementById('lcActivateBtn');
  const hint = document.getElementById('lcHint');
  btn.classList.toggle('active', coord.lineConnectMode);
  btn.textContent = coord.lineConnectMode ? '🔗 Verbinder aktiv – Punkte anklicken' : '🔗 Linienverbinder aktivieren';
  if (coord.lineConnectMode) {
    hint.textContent = 'Klicke Punkte im Koordinatensystem in der gewünschten Reihenfolge an.';
    // Switch to coordinate system tab so the canvas is visible
    if (currentTab !== 'koordinaten') switchTab('koordinaten');
    // Close the slide-up panel so it doesn't block the canvas while connecting
    document.getElementById('kpanel').classList.remove('open');
    syncPanelBodyClass();
  } else {
    hint.textContent = 'Verbinder deaktiviert. Klicke "Aktivieren" um Punkte zu verbinden.';
  }
  // Sync quick button state
  const qbtn = document.getElementById('lcQuickBtn');
  if (qbtn) qbtn.classList.toggle('act', coord.lineConnectMode);
  // Reset canvas cursor
  const cvs = document.getElementById('cvs');
  if (cvs) cvs.style.cursor = 'crosshair';
}

// Quick toggle from toolbar button (syncs with sidebar toggle)
function toggleLineConnectModeQuick() {
  toggleLineConnectMode();
}

function renderLcPointList() {
  const list = document.getElementById('lcPointList');
  if (!list) return;
  const pts = coord.currentConnector ? coord.currentConnector.pts : [];
  if (pts.length === 0) {
    list.innerHTML = '<div class="lc-hint">Noch keine Punkte gewählt.</div>';
    return;
  }
  list.innerHTML = pts.map((p, i) =>
    `<div class="lc-pt-item">
      <div class="lc-pt-num">${i + 1}</div>
      <span class="lc-pt-lbl">${escHtml(p.name)} (${round(p.x)}, ${round(p.y)})</span>
      <button class="lc-pt-del" onclick="removeLcPoint(${i})">✕</button>
    </div>`).join('');
}

function removeLcPoint(idx) {
  if (!coord.currentConnector) return;
  coord.currentConnector.pts.splice(idx, 1);
  renderLcPointList();
  drawCanvas();
}

function finishConnector() {
  if (!coord.currentConnector || coord.currentConnector.pts.length < 2) {
    document.getElementById('lcHint').textContent = '⚠️ Bitte mindestens 2 Punkte auswählen.';
    return;
  }
  const id = coord.nextId++;
  coord.connectors.push({
    id,
    pts: [...coord.currentConnector.pts],
    color: coord.currentConnector.color,
    type: coord.currentConnector.type || coord.lcConnType || 'straight',
  });
  coord.currentConnector = null;
  coord.lineConnectMode = false;
  const btn = document.getElementById('lcActivateBtn');
  btn.classList.remove('active');
  btn.textContent = '🔗 Linienverbinder aktivieren';
  document.getElementById('lcHint').textContent = 'Verbindung gespeichert!';
  renderLcPointList();
  renderLcConnectors();
  drawCanvas();
}

function clearCurrentConnector() {
  coord.currentConnector = null;
  renderLcPointList();
  drawCanvas();
}

function deleteConnector(id) {
  coord.connectors = coord.connectors.filter(c => c.id !== id);
  renderLcConnectors();
  drawCanvas();
}

function clearAllConnectors() {
  coord.connectors = [];
  coord.currentConnector = null;
  renderLcConnectors();
  renderLcPointList();
  drawCanvas();
}

function renderLcConnectors() {
  const list = document.getElementById('lcConnectors');
  if (!list) return;
  if (coord.connectors.length === 0) {
    list.innerHTML = '<div class="lc-hint">Keine gespeicherten Verbindungen.</div>';
    return;
  }
  const typeIcon = { straight: '━', curved: '∿', hyperbola: '⋈' };
  list.innerHTML = coord.connectors.map(con =>
    `<div class="lc-conn-item">
      <div class="lc-conn-dot" style="background:${con.color}"></div>
      <span class="lc-conn-lbl">${typeIcon[con.type || 'straight'] || '━'} ${con.pts.map(p => escHtml(p.name)).join(' → ')}</span>
      <button class="lc-conn-del" onclick="deleteConnector(${con.id})">✕</button>
    </div>`).join('');
}

/* ─ Canvas Mode (replaces draw mode) ─ */
function setCanvasMode(mode) {
  coord.canvasMode = mode;
  // Map draw modes for backward compat
  if (mode === 'draw') coord.drawMode = 'free';
  else if (mode === 'snap') coord.drawMode = 'snap';
  else coord.drawMode = 'none';

  const cvs = document.getElementById('cvs');
  // Remove all mode classes and reset inline cursor
  cvs.classList.remove('panning', 'dragging', 'mode-select', 'mode-delete', 'mode-edit', 'ruler-draw');
  cvs.style.cursor = '';
  // Apply class or inline cursor for each mode
  if (mode === 'pan') cvs.classList.add('panning');
  else if (mode === 'select') cvs.classList.add('mode-select');
  else if (mode === 'delete') cvs.classList.add('mode-delete');
  else if (mode === 'edit') cvs.classList.add('mode-edit');
  else if (mode === 'text') cvs.style.cursor = 'text';
  else cvs.style.cursor = 'crosshair'; // draw / snap

  // Update button states
  const modeMap = {
    pan: 'modePanBtn', select: 'modeSelectBtn', draw: 'modeDrawBtn',
    snap: 'modeSnapBtn', text: 'modeTextBtn', delete: 'modeDeleteBtn', edit: 'modeEditBtn',
  };
  Object.values(modeMap).forEach(id => { const b = document.getElementById(id); if (b) b.classList.remove('act'); });
  const activeBtn = modeMap[mode];
  if (activeBtn) { const b = document.getElementById(activeBtn); if (b) b.classList.add('act'); }

  // Also sync old pZeichnen buttons if they exist
  ['modeNone','modeFree','modeSnap'].forEach((id, i) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('active', ['none','free','snap'][i] === coord.drawMode);
  });

  // Close pt edit overlay if switching away from edit mode
  if (mode !== 'edit') closePtEdit();
}

/* ─ Draw Mode (legacy, called from pZeichnen panel buttons) ─ */
function setDrawMode(mode) {
  if (mode === 'none') setCanvasMode('pan');
  else if (mode === 'free') setCanvasMode('draw');
  else if (mode === 'snap') setCanvasMode('snap');
}

/* ─ Left Toolbar Collapse ─ */
function toggleLtoolbar() {
  const tb = document.getElementById('ltoolbar');
  const btn = document.getElementById('ltoolbarCollapseBtn');
  const collapsed = tb.classList.toggle('collapsed');
  btn.textContent = collapsed ? '›' : '‹';
  btn.title = collapsed ? 'Modi anzeigen' : 'Modi ausblenden';
}

/* ─ Connector Type ─ */
function setLcType(type) {
  coord.lcConnType = type;
  if (coord.currentConnector) coord.currentConnector.type = type;
  ['lcTypeStraight','lcTypeCurved','lcTypeHyperbola'].forEach(id => {
    const el = document.getElementById(id); if (el) el.classList.remove('active');
  });
  const map = { straight: 'lcTypeStraight', curved: 'lcTypeCurved', hyperbola: 'lcTypeHyperbola' };
  if (map[type]) { const el = document.getElementById(map[type]); if (el) el.classList.add('active'); }
}

/* ─ Helper: point near polyline ─ */
function isPointNearPolyline(px, py, polylinePts, hitR) {
  for (let i = 1; i < polylinePts.length; i++) {
    const ax = polylinePts[i-1].cx, ay = polylinePts[i-1].cy;
    const bx = polylinePts[i].cx, by = polylinePts[i].cy;
    const dx = bx - ax, dy = by - ay;
    const len2 = dx*dx + dy*dy;
    if (len2 === 0) continue;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
    const nearX = ax + t * dx, nearY = ay + t * dy;
    if (Math.sqrt((px - nearX)**2 + (py - nearY)**2) < hitR) return true;
  }
  return false;
}

/* ─ Point Edit Overlay ─ */
let _ptEditId = null;
function openPtEdit(pt, cx, cy) {
  _ptEditId = pt.id;
  const overlay = document.getElementById('ptEditOverlay');
  const container = document.getElementById('tabKoord');
  const rect = container.getBoundingClientRect();
  // Position near the clicked point but keep within bounds
  let left = cx + 10, top = cy - 10;
  if (left + 190 > rect.width) left = cx - 200;
  if (top + 130 > rect.height) top = cy - 130;
  overlay.style.left = Math.max(4, left) + 'px';
  overlay.style.top  = Math.max(4, top)  + 'px';
  document.getElementById('ptEditName').textContent = `Punkt ${escHtml(pt.name)}`;
  document.getElementById('ptEditX').value = pt.x;
  document.getElementById('ptEditY').value = pt.y;
  overlay.classList.add('vis');
}

function applyPtEdit() {
  if (_ptEditId === null) return;
  const pt = coord.points.find(p => p.id === _ptEditId);
  if (!pt) { closePtEdit(); return; }
  const newX = parseFloat(document.getElementById('ptEditX').value);
  const newY = parseFloat(document.getElementById('ptEditY').value);
  if (!isNaN(newX)) pt.x = newX;
  if (!isNaN(newY)) pt.y = newY;
  // Sync connectors
  coord.connectors.forEach(con => con.pts.forEach(cp => {
    if (cp.id === _ptEditId) { cp.x = pt.x; cp.y = pt.y; }
  }));
  closePtEdit();
  renderPtList();
  drawCanvas();
}

function closePtEdit() {
  _ptEditId = null;
  const overlay = document.getElementById('ptEditOverlay');
  if (overlay) overlay.classList.remove('vis');
}

/* ─ Template Previews ─ */
function initTemplatePreviewsIfNeeded() {
  const canvases = document.querySelectorAll('.vtpl-prev');
  canvases.forEach(cvs => {
    if (cvs.dataset.drawn) return;
    cvs.dataset.drawn = '1';
    const expr = cvs.dataset.expr;
    if (!expr) return;
    drawTemplatePreview(cvs, expr);
  });
}

function drawTemplatePreview(cvs, expr) {
  const dpr = window.devicePixelRatio || 1;
  const W = cvs.offsetWidth || 52;
  const H = cvs.offsetHeight || 38;
  cvs.width = W * dpr;
  cvs.height = H * dpr;
  const ctx = cvs.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // Draw light grid
  ctx.strokeStyle = 'rgba(0,0,0,0.07)';
  ctx.lineWidth = 0.5;
  for (let x = 0; x <= W; x += W/4) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
  for (let y = 0; y <= H; y += H/3) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

  // Determine range
  const scale = Math.min(W, H) / 5.5;
  const ox = W / 2, oy = H / 2;

  // Draw axes
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 0.7;
  ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(W, oy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(ox, 0); ctx.lineTo(ox, H); ctx.stroke();

  // Plot function
  ctx.beginPath();
  ctx.strokeStyle = '#cc0000';
  ctx.lineWidth = 1.5;
  ctx.lineJoin = 'round';
  let started = false, prevY2 = null;
  const steps = W * 2;
  const xLeft = -ox / scale, xRight = (W - ox) / scale;
  const dx = (xRight - xLeft) / steps;
  for (let i = 0; i <= steps; i++) {
    const mx2 = xLeft + i * dx;
    const my2 = evalFn(expr, mx2);
    if (!isFinite(my2) || isNaN(my2)) { started = false; prevY2 = null; continue; }
    if (prevY2 !== null && Math.abs(my2 - prevY2) > H / scale * 1.5) { started = false; }
    const pcx = ox + mx2 * scale;
    const pcy = oy - my2 * scale;
    if (!started) { ctx.moveTo(pcx, pcy); started = true; }
    else ctx.lineTo(pcx, pcy);
    prevY2 = my2;
  }
  ctx.stroke();
}
function undoStroke() { coord.strokes.pop(); drawCanvas(); }
function clearStrokes() { coord.strokes = []; drawCanvas(); }

function saveCanvas() {
  const cvs = document.getElementById('cvs');
  const a = document.createElement('a');
  a.download = 'rechner-koordinaten.png';
  a.href = cvs.toDataURL();
  a.click();
}

/* ─ Panel & settings ─ */
function syncPanelBodyClass() {
  const p = document.getElementById('kpanel');
  const tab = document.getElementById('tabKoord');
  if (!p || !tab) return;
  tab.classList.remove('kp-open', 'kp-hidden');
  if (p.classList.contains('hidden')) tab.classList.add('kp-hidden');
  else if (p.classList.contains('open')) tab.classList.add('kp-open');
}

function togglePanel() {
  const p = document.getElementById('kpanel');
  // If fully hidden, un-hide first (show as peek)
  if (p.classList.contains('hidden')) {
    openPanelFromBtn();
    return;
  }
  p.classList.toggle('open');
  syncPanelBodyClass();
}

function closePanelFully() {
  const p = document.getElementById('kpanel');
  p.classList.remove('open');
  p.classList.add('hidden');
  document.getElementById('kOpenBtn').classList.add('vis');
  syncPanelBodyClass();
}

function openPanelFromBtn() {
  const p = document.getElementById('kpanel');
  p.classList.remove('hidden');
  p.classList.add('open');
  document.getElementById('kOpenBtn').classList.remove('vis');
  syncPanelBodyClass();
}

function openPanelForInput() {
  const p = document.getElementById('kpanel');
  if (!p) return;
  p.classList.remove('hidden');
  p.classList.add('open');
  const btn = document.getElementById('kOpenBtn');
  if (btn) btn.classList.remove('vis');
  syncPanelBodyClass();
}

function switchPTab(id) {
  document.querySelectorAll('.psec').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.ptab').forEach(b => b.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  const tabs = ['pFunktionen','pPunkte','pVorlagen','pZeichnen','pTabelle','pEinst'];
  document.querySelectorAll('.ptab')[tabs.indexOf(id)].classList.add('active');
  if (id === 'pTabelle') generateTable();
  if (id === 'pVorlagen') setTimeout(initTemplatePreviewsIfNeeded, 50);
}

function toggleSetting(s) {
  const map = { grid: 'showGrid', labels: 'showLabels', axes: 'showAxes' };
  const btn = document.getElementById('tog' + s.charAt(0).toUpperCase() + s.slice(1));
  coord[map[s]] = !coord[map[s]];
  btn.classList.toggle('active', coord[map[s]]);
  drawCanvas();
}

/* ══════════════════════════════════════════════
   UNIT CONVERTER
══════════════════════════════════════════════ */
const UNIT_CATS = {
  length: {
    label: 'Länge',
    units: { 'mm': 1e-3, 'cm': 1e-2, 'm': 1, 'km': 1e3, 'Zoll (in)': 0.0254, 'Fuß (ft)': 0.3048, 'Yard (yd)': 0.9144, 'Meile (mi)': 1609.344 }
  },
  weight: {
    label: 'Gewicht',
    units: { 'mg': 1e-6, 'g': 1e-3, 'kg': 1, 't': 1e3, 'Unze (oz)': 0.0283495, 'Pfund (lb)': 0.453592 }
  },
  temp: {
    label: 'Temperatur',
    units: ['°C', '°F', 'K']
  },
  area: {
    label: 'Fläche',
    units: { 'mm²': 1e-6, 'cm²': 1e-4, 'm²': 1, 'km²': 1e6, 'Hektar (ha)': 1e4, 'Acre': 4046.856, 'ft²': 0.092903 }
  },
  speed: {
    label: 'Geschwindigkeit',
    units: { 'm/s': 1, 'km/h': 1 / 3.6, 'mph': 0.44704, 'Knoten (kn)': 0.514444 }
  }
};

let ucCurrentCat = 'length';
let ucInited = false;

function initUnitConverter() {
  if (ucInited) return;
  ucInited = true;
  populateUnitSelects();
}

function setUCat(cat) {
  ucCurrentCat = cat;
  document.querySelectorAll('#ucatBtns .modbtn').forEach((b, i) => {
    b.classList.toggle('active', Object.keys(UNIT_CATS)[i] === cat);
  });
  populateUnitSelects();
  doUnitConvert();
}

function populateUnitSelects() {
  const cat = UNIT_CATS[ucCurrentCat];
  const units = Array.isArray(cat.units) ? cat.units : Object.keys(cat.units);
  const fromSel = document.getElementById('ucFromUnit');
  const toSel = document.getElementById('ucToUnit');
  fromSel.innerHTML = units.map(u => `<option value="${escHtml(u)}">${escHtml(u)}</option>`).join('');
  toSel.innerHTML   = units.map(u => `<option value="${escHtml(u)}">${escHtml(u)}</option>`).join('');
  if (units.length > 1) toSel.value = units[1];
  document.getElementById('ucResult').classList.remove('vis');
}

function doUnitConvert() {
  const val = parseFloat(document.getElementById('ucValue').value);
  const from = document.getElementById('ucFromUnit').value;
  const to   = document.getElementById('ucToUnit').value;
  const resEl = document.getElementById('ucResult');
  const valEl = document.getElementById('ucResultVal');

  if (isNaN(val)) { resEl.classList.remove('vis'); return; }

  let result;
  if (ucCurrentCat === 'temp') {
    let k;
    if (from === '°C') k = val + 273.15;
    else if (from === '°F') k = (val + 459.67) * 5 / 9;
    else k = val;
    if (to === '°C') result = k - 273.15;
    else if (to === '°F') result = k * 9 / 5 - 459.67;
    else result = k;
  } else {
    const u = UNIT_CATS[ucCurrentCat].units;
    result = val * u[from] / u[to];
  }

  const formatted = !isFinite(result) ? '—' :
    Math.abs(result) < 1e-9 || Math.abs(result) >= 1e12
      ? result.toExponential(6)
      : parseFloat(result.toFixed(8)).toString();

  valEl.textContent = `${formatted} ${to}`;
  resEl.classList.add('vis');
}

/* ══════════════════════════════════════════════
   UTILITIES
══════════════════════════════════════════════ */
function round(n) {
  const r = parseFloat(n.toFixed(6));
  return r === 0 ? 0 : r;
}
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function showErr(el, msg) { el.textContent = msg; el.style.display = 'block'; }

/* ══════════════════════════════════════════════
   HIDE UI
══════════════════════════════════════════════ */
function toggleHideUI() {
  const hidden = document.body.classList.toggle('hide-ui');
  document.getElementById('hideUIBtn').textContent = hidden ? 'UI an' : 'UI aus';
}

/* ══════════════════════════════════════════════
   FULLSCREEN POPUP MENU
══════════════════════════════════════════════ */
function openFsMenu() {
  // Sync fsMenu button visibility with nav buttons (respects license/feature restrictions)
  Object.entries(FS_NAV_MAP).forEach(([navId, fsId]) => {
    const navBtn = document.getElementById(navId);
    const fsBtn  = document.getElementById(fsId);
    if (navBtn && fsBtn) fsBtn.style.display = navBtn.style.display;
  });

  // Highlight the currently active tab button
  const tabs = ['rechner','koordinaten','notizen','klasse','bild','agent','handbuch'];
  const ids  = ['fsModeRechner','fsModeKoord','fsModeNotizen','fsModeKlasse','fsModeBild','fsModeAgent','fsModeHandbuch'];
  ids.forEach((id, i) => {
    document.getElementById(id).classList.toggle('active', tabs[i] === currentTab);
  });
  document.getElementById('fsMenuOverlay').classList.add('open');
  document.getElementById('fsMenu').style.display = 'block';
}
function closeFsMenu() {
  document.getElementById('fsMenuOverlay').classList.remove('open');
  document.getElementById('fsMenu').style.display = 'none';
}
function fsSwitchTab(tab) {
  closeFsMenu();
  switchTab(tab);
}
function closeFsMenuAndExit() {
  closeFsMenu();
  toggleHideUI();
}

/* ══════════════════════════════════════════════
   SIDEBAR
══════════════════════════════════════════════ */
function _onSidebarTransitionEnd() {
  resizeCanvas();
  if (typeof applyRangeSettings === 'function') applyRangeSettings();
}
function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  const open = sb.classList.toggle('open');
  document.body.classList.toggle('sidebar-open', open);
  setTimeout(_onSidebarTransitionEnd, 290);
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.body.classList.remove('sidebar-open');
  setTimeout(_onSidebarTransitionEnd, 290);
}
function switchSideTab(id) {
  document.querySelectorAll('.sdpanel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sdtab').forEach(b => b.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  const tabs = ['sdMiniCalc','sdTimer','sdSideNotes','sdLineConn'];
  const idx = tabs.indexOf(id);
  if (idx >= 0) document.querySelectorAll('.sdtab')[idx].classList.add('active');
  if (id === 'sdLineConn') { initLcColorRow(); renderLcPointList(); renderLcConnectors(); }
}

/* ══════════════════════════════════════════════
   MINI CALCULATOR
══════════════════════════════════════════════ */
const mc = { expr: '', result: '0' };

function mcInput(ch) {
  if (ch === 'AC') { mc.expr = ''; mc.result = '0'; updateMcDisplay(); return; }
  if (ch === '⌫') {
    mc.expr = mc.expr.slice(0, -1);
    try { mc.result = mc.expr ? String(evalSafe(mc.expr)) : '0'; } catch { mc.result = '...'; }
    updateMcDisplay(); return;
  }
  if (ch === '=') {
    if (!mc.expr) return;
    try {
      mc.result = formatNum(evalSafe(mc.expr));
      mc.expr = '';
    } catch { mc.result = 'Fehler'; mc.expr = ''; }
    updateMcDisplay(); return;
  }
  const ops = ['+','-','×','÷'];
  const last = mc.expr.slice(-1);
  if (ops.includes(ch) && ops.includes(last)) mc.expr = mc.expr.slice(0, -1);
  mc.expr += ch;
  try { mc.result = String(evalSafe(mc.expr)); } catch { mc.result = '...'; }
  updateMcDisplay();
}

function updateMcDisplay() {
  document.getElementById('mcExpr').textContent = mc.expr || '';
  document.getElementById('mcRes').textContent = mc.result;
}

/* ══════════════════════════════════════════════
   RTOOLBAR COLLAPSE
══════════════════════════════════════════════ */
function toggleRtoolbar() {
  const tb = document.getElementById('rtoolbar');
  const btn = document.getElementById('rtoolbarCollapseBtn');
  const collapsed = tb.classList.toggle('collapsed');
  btn.textContent = collapsed ? '›' : '‹';
  btn.title = collapsed ? 'Werkzeuge anzeigen' : 'Werkzeuge ausblenden';
}

/* ══════════════════════════════════════════════
   COORDINATE SYSTEM LOCK
══════════════════════════════════════════════ */
coord.locked = false;

function toggleLock() {
  coord.locked = !coord.locked;
  const btn = document.getElementById('lockBtn');
  btn.textContent = coord.locked ? '🔒' : '🔓';
  btn.classList.toggle('act', coord.locked);
}

/* ══════════════════════════════════════════════
   RULER
══════════════════════════════════════════════ */
coord.showRuler = false;

function toggleRuler() {
  coord.showRuler = !coord.showRuler;
  const container = document.getElementById('tabKoord');
  container.classList.toggle('ruler-visible', coord.showRuler);
  document.getElementById('rulerBtn').classList.toggle('act', coord.showRuler);
  drawCanvas();
  if (coord.showRuler) drawRulers();
}

function drawRulers() {
  const rulerH = document.getElementById('rulerH');
  const rulerV = document.getElementById('rulerV');
  const container = document.getElementById('tabKoord');
  const rect = container.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const W = rect.width - 20;
  const H = rect.height - 20;

  rulerH.width = W * dpr;
  rulerH.height = 20 * dpr;
  rulerH.style.width = W + 'px';
  rulerH.style.height = '20px';
  rulerV.width = 20 * dpr;
  rulerV.height = H * dpr;
  rulerV.style.width = '20px';
  rulerV.style.height = H + 'px';

  const ctxH = rulerH.getContext('2d');
  const ctxV = rulerV.getContext('2d');

  ctxH.save(); ctxH.scale(dpr, dpr);
  ctxV.save(); ctxV.scale(dpr, dpr);

  // H ruler background
  ctxH.fillStyle = 'rgba(245,245,245,0.97)';
  ctxH.fillRect(0, 0, W, 20);
  ctxH.strokeStyle = '#cccccc';
  ctxH.lineWidth = 1;
  ctxH.strokeRect(0, 0, W, 20);

  // V ruler background
  ctxV.fillStyle = 'rgba(245,245,245,0.97)';
  ctxV.fillRect(0, 0, 20, H);
  ctxV.strokeStyle = '#cccccc';
  ctxV.lineWidth = 1;
  ctxV.strokeRect(0, 0, 20, H);

  const gs = parseFloat(document.getElementById('gridStep').value) || 1;
  const xLeft  = c2m(0, 0).mx;
  const xRight = c2m(rect.width, 0).mx;
  const yTop   = c2m(0, 0).my;
  const yBot   = c2m(0, rect.height).my;

  ctxH.fillStyle = 'rgba(0,0,0,0.65)';
  ctxH.font = '9px -apple-system, sans-serif';
  ctxH.textAlign = 'center';

  // H tick marks
  const xStart = Math.floor(xLeft / gs) * gs;
  const xEnd   = Math.ceil(xRight / gs) * gs;
  for (let x = xStart; x <= xEnd; x += gs) {
    const { cx } = m2c(x, 0);
    const px = cx - 20; // offset for ruler left margin
    if (px < 0 || px > W) continue;
    const isMajor = Math.abs(x % (gs * 5)) < gs * 0.01;
    ctxH.fillRect(px, isMajor ? 11 : 14, 1, isMajor ? 9 : 6);
    if (isMajor || gs >= 1) {
      ctxH.fillText(round(x), px, 10);
    }
  }

  // V tick marks
  ctxV.fillStyle = 'rgba(0,0,0,0.65)';
  ctxV.font = '9px -apple-system, sans-serif';
  ctxV.textAlign = 'right';
  const yStart = Math.floor(yBot / gs) * gs;
  const yEnd   = Math.ceil(yTop / gs) * gs;
  for (let y = yStart; y <= yEnd; y += gs) {
    const { cy } = m2c(0, y);
    const py = cy - 20;
    if (py < 0 || py > H) continue;
    const isMajor = Math.abs(y % (gs * 5)) < gs * 0.01;
    ctxV.fillRect(isMajor ? 11 : 14, py, isMajor ? 9 : 6, 1);
    if (isMajor || gs >= 1) {
      ctxV.save();
      ctxV.translate(10, py);
      ctxV.rotate(-Math.PI / 2);
      ctxV.fillText(round(y), 0, 0);
      ctxV.restore();
    }
  }

  ctxH.restore();
  ctxV.restore();
}

/* ══════════════════════════════════════════════
   QUADRANT VIEW
══════════════════════════════════════════════ */
coord.quadrant = 0; // 0=all, 1–4=quadrants

function toggleQuadPanel() {
  const p = document.getElementById('quadrantPanel');
  p.classList.toggle('vis');
  document.getElementById('quadBtn').classList.toggle('act', p.classList.contains('vis'));
}

function setQuadrant(q) {
  coord.quadrant = q;
  ['qI','qII','qIII','qIV','qAll'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('active');
  });
  const ids = { 0:'qAll', 1:'qI', 2:'qII', 3:'qIII', 4:'qIV' };
  if (ids[q]) document.getElementById(ids[q]).classList.add('active');
  applyQuadrant();
  drawCanvas();
  if (coord.showRuler) drawRulers();
}

function applyQuadrant() {
  const q = coord.quadrant;
  if (q === 0) return; // no restriction
  const cvs = document.getElementById('cvs');
  const dpr = window.devicePixelRatio || 1;
  const W = cvs.width / dpr, H = cvs.height / dpr;
  const margin = 0.5; // small extra units visible
  const range = Math.max(W, H) / coord.scale / 2 + margin;
  // Place origin at corner based on quadrant
  switch (q) {
    case 1: coord.ox = 20; coord.oy = H - 20; break; // origin bottom-left
    case 2: coord.ox = W - 20; coord.oy = H - 20; break; // origin bottom-right
    case 3: coord.ox = W - 20; coord.oy = 20; break; // origin top-right
    case 4: coord.ox = 20; coord.oy = 20; break; // origin top-left
  }
}

/* ══════════════════════════════════════════════
   TEXTBOX TOOL
══════════════════════════════════════════════ */
coord.textMode = false;
const textLabels = []; // {id, x, y, text, el}
let textLabelId = 1;

function toggleTextMode() {
  if (coord.canvasMode === 'text') {
    setCanvasMode('pan');
  } else {
    setCanvasMode('text');
    const cvs = document.getElementById('cvs');
    cvs.style.cursor = 'text';
  }
}

function placeTextLabel(cx, cy) {
  const container = document.getElementById('tabKoord');
  const text = prompt('Text eingeben:');
  if (!text) return;
  const { mx, my } = c2m(cx, cy);
  const el = document.createElement('div');
  el.className = 'canvas-label';
  el.textContent = text;
  el.style.left = cx + 'px';
  el.style.top  = cy + 'px';
  const id = textLabelId++;
  el.dataset.id = id;

  // Drag support
  let dragging = false, startX, startY, origLeft, origTop;
  el.addEventListener('pointerdown', ev => {
    ev.stopPropagation();
    dragging = true;
    startX = ev.clientX; startY = ev.clientY;
    origLeft = parseInt(el.style.left); origTop = parseInt(el.style.top);
    el.setPointerCapture(ev.pointerId);
  });
  el.addEventListener('pointermove', ev => {
    if (!dragging) return;
    el.style.left = (origLeft + ev.clientX - startX) + 'px';
    el.style.top  = (origTop  + ev.clientY - startY) + 'px';
  });
  el.addEventListener('pointerup', () => { dragging = false; });

  // Double-click to delete
  el.addEventListener('dblclick', ev => {
    ev.stopPropagation();
    el.remove();
  });

  container.appendChild(el);
  textLabels.push({ id, mx, my, el });
}

/* ══════════════════════════════════════════════
   NOTIZEN (NOTES)
══════════════════════════════════════════════ */
const NOTE_COLORS = ['#ffd93d','#6c63ff','#ff6b6b','#4ecdc4','#ff9f43'];
const notes = [];
let noteId = 1;

function addNote(color) {
  const id = noteId++;
  const c = color || NOTE_COLORS[0];
  const note = { id, title: '', body: '', color: c };
  notes.push(note);
  renderNotes();
}

function deleteNote(id) {
  const idx = notes.findIndex(n => n.id === id);
  if (idx >= 0) notes.splice(idx, 1);
  renderNotes();
}

function renderNotes() {
  const list = document.getElementById('notesList');
  if (notes.length === 0) {
    list.innerHTML = '<div style="text-align:center;color:var(--dim);padding:40px 20px;font-size:14px">📝 Noch keine Notizen.<br>Erstelle eine neue Notiz!</div>';
    return;
  }
  list.innerHTML = '';
  notes.forEach(note => {
    const card = document.createElement('div');
    card.className = 'note-card';
    card.style.borderLeftColor = note.color;

    const titleInput = document.createElement('input');
    titleInput.className = 'note-title';
    titleInput.placeholder = 'Titel…';
    titleInput.value = note.title;
    titleInput.addEventListener('input', () => updateNote(note.id, 'title', titleInput.value));

    const bodyTA = document.createElement('textarea');
    bodyTA.placeholder = 'Notiz eingeben…';
    bodyTA.textContent = note.body;
    bodyTA.addEventListener('input', () => updateNote(note.id, 'body', bodyTA.value));

    const footer = document.createElement('div');
    footer.className = 'note-footer';

    const colorStrip = document.createElement('div');
    colorStrip.className = 'note-color-strip';
    NOTE_COLORS.forEach(c => {
      const dot = document.createElement('div');
      dot.className = 'ncol' + (c === note.color ? ' sel' : '');
      dot.style.background = c;
      dot.addEventListener('click', () => updateNote(note.id, 'color', c));
      colorStrip.appendChild(dot);
    });

    const delBtn = document.createElement('button');
    delBtn.className = 'note-del';
    delBtn.textContent = '🗑 Löschen';
    delBtn.addEventListener('click', () => deleteNote(note.id));

    footer.appendChild(colorStrip);
    footer.appendChild(delBtn);
    card.appendChild(titleInput);
    card.appendChild(bodyTA);
    card.appendChild(footer);
    list.appendChild(card);
  });
}

function updateNote(id, field, value) {
  const note = notes.find(n => n.id === id);
  if (note) {
    note[field] = value;
    if (field === 'color') renderNotes();
  }
}

/* Initialize notes list on first render */
document.addEventListener('DOMContentLoaded', () => { renderNotes(); });

/* ══════════════════════════════════════════════
   KLASSE TOOLS
══════════════════════════════════════════════ */
let geoMode = 'kreis';
let physMode = 'kraft';
let klasseInited = false;

function initKlasse() {
  if (klasseInited) return;
  klasseInited = true;
  setGeoMode('kreis');
  setPhysMode('kraft');
  set3DMode('wuerfel');
}

function calcVorlagen(type) {
  function v(id) { return parseFloat(document.getElementById(id).value); }
  function sv(id) { return document.getElementById(id).value; }
  function show(id, html) { const el = document.getElementById(id); if(el){ el.innerHTML = html; el.style.display='block'; } }
  function fmt(n) { return isFinite(n) ? (Math.abs(n) < 0.001 && n !== 0 ? n.toExponential(4) : parseFloat(n.toPrecision(8)).toString()) : '—'; }
  if (type === 'quad') {
    const a=v('vtQa'),b=v('vtQb'),c=v('vtQc');
    if (isNaN(a)||isNaN(b)||isNaN(c)||a===0) { show('vtQRes','<span style="color:var(--dim)">a, b, c eingeben (a ≠ 0)</span>'); return; }
    const D=b*b-4*a*c;
    if (D>0) show('vtQRes',`x₁ = <b>${fmt((-b+Math.sqrt(D))/(2*a))}</b> &nbsp; x₂ = <b>${fmt((-b-Math.sqrt(D))/(2*a))}</b>  &nbsp;<small>(D=${fmt(D)})</small>`);
    else if(D===0) show('vtQRes',`x = <b>${fmt(-b/(2*a))}</b> &nbsp;<small>(doppelte Lösung)</small>`);
    else show('vtQRes',`<span style="color:var(--dim)">Keine reellen Lösungen (D=${fmt(D)} &lt; 0)</span>`);
  } else if (type === 'lin') {
    const a=v('vtLa'),b=v('vtLb');
    if (isNaN(a)||isNaN(b)) { show('vtLRes','<span style="color:var(--dim)">a und b eingeben</span>'); return; }
    if (a===0) { show('vtLRes', b===0 ? '<span style="color:var(--dim)">Unendlich viele Lösungen</span>' : '<span style="color:var(--dim)">Keine Lösung</span>'); return; }
    show('vtLRes',`x = <b>${fmt(-b/a)}</b>`);
  } else if (type === 'dist') {
    const x1=v('vtDx1'),y1=v('vtDy1'),x2=v('vtDx2'),y2=v('vtDy2');
    if ([x1,y1,x2,y2].some(isNaN)) { show('vtDRes','<span style="color:var(--dim)">Alle 4 Werte eingeben</span>'); return; }
    show('vtDRes',`d = <b>${fmt(Math.sqrt((x2-x1)**2+(y2-y1)**2))}</b>`);
  } else if (type === 'mid') {
    const x1=v('vtMx1'),y1=v('vtMy1'),x2=v('vtMx2'),y2=v('vtMy2');
    if ([x1,y1,x2,y2].some(isNaN)) { show('vtMRes','<span style="color:var(--dim)">Alle 4 Werte eingeben</span>'); return; }
    show('vtMRes',`M = (<b>${fmt((x1+x2)/2)}</b> | <b>${fmt((y1+y2)/2)}</b>)`);
  } else if (type === 'pct') {
    const G=v('vtPG'),p=v('vtPP');
    if (isNaN(G)||isNaN(p)) { show('vtPRes','<span style="color:var(--dim)">Grundwert und % eingeben</span>'); return; }
    show('vtPRes',`Prozentwert = <b>${fmt(G*p/100)}</b> &nbsp; Gesamtwert = <b>${fmt(G*(1+p/100))}</b>`);
  } else if (type === 'chg') {
    const o=v('vtCO'),n=v('vtCN');
    if (isNaN(o)||isNaN(n)||o===0) { show('vtCRes','<span style="color:var(--dim)">Alten und neuen Wert eingeben</span>'); return; }
    const ch=(n-o)/Math.abs(o)*100;
    show('vtCRes',`Änderung = <b>${fmt(ch)} %</b> (${ch>=0?'▲':'▼'})`);
  } else if (type === 'si') {
    const P=v('vtSIP'),r=v('vtSIR'),t=v('vtSIT');
    if (isNaN(P)||isNaN(r)||isNaN(t)) { show('vtSIRes','<span style="color:var(--dim)">P, r und t eingeben</span>'); return; }
    const I=P*r/100*t;
    show('vtSIRes',`Zinsen I = <b>${fmt(I)}</b> &nbsp; Endkapital = <b>${fmt(P+I)}</b>`);
  } else if (type === 'ci') {
    const P=v('vtCIP'),r=v('vtCIR'),t=v('vtCIT');
    if (isNaN(P)||isNaN(r)||isNaN(t)) { show('vtCIRes','<span style="color:var(--dim)">P, r und t eingeben</span>'); return; }
    const A=P*Math.pow(1+r/100,t);
    show('vtCIRes',`Endkapital A = <b>${fmt(A)}</b> &nbsp; Gewinn = <b>${fmt(A-P)}</b>`);
  } else if (type === 'pyth') {
    const a=v('vtPya'),b=v('vtPyb');
    if (isNaN(a)||isNaN(b)) { show('vtPyRes','<span style="color:var(--dim)">a und b eingeben</span>'); return; }
    show('vtPyRes',`c = <b>${fmt(Math.sqrt(a*a+b*b))}</b>`);
  } else if (type === 'circ') {
    const r=v('vtCR');
    if (isNaN(r)) { show('vtCRRes','<span style="color:var(--dim)">Radius eingeben</span>'); return; }
    show('vtCRRes',`Fläche A = <b>${fmt(Math.PI*r*r)}</b> &nbsp; Umfang U = <b>${fmt(2*Math.PI*r)}</b>`);
  } else if (type === 'bmi') {
    const w=v('vtBMIw'),h=v('vtBMIh');
    if (isNaN(w)||isNaN(h)||h===0) { show('vtBMIRes','<span style="color:var(--dim)">Gewicht (kg) und Größe (m) eingeben</span>'); return; }
    const bmi=w/(h*h);
    const cat=bmi<18.5?'Untergewicht':bmi<25?'Normalgewicht':bmi<30?'Übergewicht':'Adipositas';
    show('vtBMIRes',`BMI = <b>${fmt(bmi)}</b> &nbsp; <small>(${cat})</small>`);
  } else if (type === 'ohm') {
    const Ustr=document.getElementById('vtOhmU').value.trim();
    const Rstr=document.getElementById('vtOhmR').value.trim();
    const Istr=document.getElementById('vtOhmI').value.trim();
    const U=parseFloat(Ustr),R=parseFloat(Rstr),I=parseFloat(Istr);
    const hasU=Ustr!=='',hasR=Rstr!=='',hasI=Istr!=='';
    if (!hasR&&!hasI) { show('vtOhmRes','<span style="color:var(--dim)">Mindestens 2 Werte eingeben (leer=gesucht)</span>'); return; }
    if (!hasU&&hasR&&hasI) show('vtOhmRes',`U = <b>${fmt(R*I)} V</b>`);
    else if (hasU&&!hasR&&hasI&&I!==0) show('vtOhmRes',`R = <b>${fmt(U/I)} Ω</b>`);
    else if (hasU&&hasR&&!hasI&&R!==0) show('vtOhmRes',`I = <b>${fmt(U/R)} A</b>`);
    else show('vtOhmRes','<span style="color:var(--dim)">Genau einen Wert leer lassen</span>');
  } else if (type === 'speed') {
    const s=v('vtVs'),t=v('vtVt');
    if (isNaN(s)||isNaN(t)||t===0) { show('vtVRes','<span style="color:var(--dim)">Strecke und Zeit eingeben</span>'); return; }
    const vms=s/t;
    show('vtVRes',`v = <b>${fmt(vms)} m/s</b> &nbsp; = <b>${fmt(vms*3.6)} km/h</b>`);
  } else if (type === 'ke') {
    const m=v('vtKEm'),vel=v('vtKEv');
    if (isNaN(m)||isNaN(vel)) { show('vtKERes','<span style="color:var(--dim)">m und v eingeben</span>'); return; }
    show('vtKERes',`E_kin = <b>${fmt(0.5*m*vel*vel)} J</b>`);
  } else if (type === 'pe') {
    const m=v('vtPEm'),h=v('vtPEh');
    if (isNaN(m)||isNaN(h)) { show('vtPERes','<span style="color:var(--dim)">m und h eingeben</span>'); return; }
    show('vtPERes',`E_pot = <b>${fmt(m*9.81*h)} J</b>`);
  } else if (type === 'temp') {
    const val=v('vtTempIn'), unit=sv('vtTempUnit');
    if (isNaN(val)) { show('vtTempRes','<span style="color:var(--dim)">Temperaturwert eingeben</span>'); return; }
    let C,F,K;
    if(unit==='C'){C=val;F=C*9/5+32;K=C+273.15;}
    else if(unit==='F'){F=val;C=(F-32)*5/9;K=C+273.15;}
    else{K=val;C=K-273.15;F=C*9/5+32;}
    show('vtTempRes',`°C = <b>${fmt(C)}</b> &nbsp; °F = <b>${fmt(F)}</b> &nbsp; K = <b>${fmt(K)}</b>`);
  } else if (type === 'gl') {
    const buy=v('vtGLbuy'),sell=v('vtGLsell');
    if (isNaN(buy)||isNaN(sell)||buy===0) { show('vtGLRes','<span style="color:var(--dim)">Kauf- und Verkaufspreis eingeben</span>'); return; }
    const pct=(sell-buy)/buy*100;
    show('vtGLRes',`${pct>=0?'Gewinn':'Verlust'} = <b>${fmt(Math.abs(pct))} %</b> &nbsp; (${fmt(sell-buy)})`);
  } else if (type === 'cyl') {
    const r=v('vtCylR'),h=v('vtCylH');
    if (isNaN(r)||isNaN(h)) { show('vtCylRes','<span style="color:var(--dim)">r und h eingeben</span>'); return; }
    show('vtCylRes',`V = <b>${fmt(Math.PI*r*r*h)}</b> &nbsp; Mantelfläche = <b>${fmt(2*Math.PI*r*h)}</b>`);
  } else if (type === 'sph') {
    const r=v('vtSphR');
    if (isNaN(r)) { show('vtSphRes','<span style="color:var(--dim)">Radius eingeben</span>'); return; }
    show('vtSphRes',`V = <b>${fmt(4/3*Math.PI*r*r*r)}</b> &nbsp; O = <b>${fmt(4*Math.PI*r*r)}</b>`);
  } else if (type === 'tri') {
    const g=v('vtTriG'),h=v('vtTriH');
    if (isNaN(g)||isNaN(h)) { show('vtTriRes','<span style="color:var(--dim)">g und h eingeben</span>'); return; }
    show('vtTriRes',`Fläche A = <b>${fmt(g*h/2)}</b>`);
  } else if (type === 'slope') {
    const x1=v('vtSlx1'),y1=v('vtSly1'),x2=v('vtSlx2'),y2=v('vtSly2');
    if ([x1,y1,x2,y2].some(isNaN)) { show('vtSlRes','<span style="color:var(--dim)">Alle 4 Werte eingeben</span>'); return; }
    if (x2===x1) { show('vtSlRes','<span style="color:var(--dim)">Vertikale Gerade (m undefiniert)</span>'); return; }
    const m=(y2-y1)/(x2-x1);
    const b2=y1-m*x1;
    show('vtSlRes',`m = <b>${fmt(m)}</b> &nbsp; Gleichung: y = ${fmt(m)}x + ${fmt(b2)}`);
  } else if (type === 'sec') {
    const r=v('vtSecR'),alpha=v('vtSecA');
    if (isNaN(r)||isNaN(alpha)) { show('vtSecRes','<span style="color:var(--dim)">r und α eingeben</span>'); return; }
    const rad=alpha*Math.PI/180;
    show('vtSecRes',`Bogenlänge = <b>${fmt(r*rad)}</b> &nbsp; Sektorfläche = <b>${fmt(0.5*r*r*rad)}</b>`);
  }
}

/* ─ Coordinate System Template Insertion ─ */
function insertCoordTemplate(expr) {
  const color = COLORS[colorIdx % COLORS.length]; colorIdx++;
  const id = coord.nextId++;
  coord.functions.push({ expr, color, id, raw: 'y = ' + expr });
  switchTab('koordinaten');
  renderFnList();
  renderCoordFnChips();
  setTimeout(() => { resizeCanvas(); drawCanvas(); }, 80);
}

/* ─ Quick-add function from the top bar ─ */
function quickAddFn() {
  const inp = document.getElementById('coordFnInput');
  if (!inp) return;
  const raw = inp.value.trim();
  if (!raw) return;
  const expr = raw.replace(/^y\s*=\s*/i, '').replace(/\s/g, '');
  if (!expr) return;
  const color = COLORS[colorIdx % COLORS.length]; colorIdx++;
  const id = coord.nextId++;
  coord.functions.push({ expr, color, id, raw: 'y = ' + expr });
  inp.value = '';
  renderFnList();
  renderCoordFnChips();
  drawCanvas();
}

/* ─ Render active function chips in the top bar ─ */
function renderCoordFnChips() {
  const chips = document.getElementById('coordFnChips');
  if (!chips) return;
  chips.innerHTML = '';
  coord.functions.slice(-4).forEach(fn => {  // show last 4 max
    const chip = document.createElement('div');
    chip.className = 'fn-chip';
    chip.style.background = fn.color;
    chip.title = fn.raw || ('y = ' + fn.expr);
    chip.innerHTML = `<span style="overflow:hidden;text-overflow:ellipsis;max-width:90px">${escHtml(fn.expr)}</span>` +
      `<button class="fn-chip-del" onclick="deleteFunction(${fn.id})" title="Entfernen" aria-label="Funktion entfernen">✕</button>`;
    chips.appendChild(chip);
  });
}

function insertCoordTemplateCustom() {
  const raw = document.getElementById('vtplCustomInput').value.trim();
  const errEl = document.getElementById('vtplErr');
  if (!raw) return;
  const expr = raw.replace(/^y\s*=\s*/i, '').replace(/\s/g, '');
  if (!expr) { showErr(errEl, 'Bitte eine Funktion eingeben'); return; }
  const test = evalFn(expr, 1);
  if (isNaN(test)) { showErr(errEl, 'Ungültige Funktion. Beispiel: 2x+1 oder x^2-3'); return; }
  errEl.style.display = 'none';
  document.getElementById('vtplCustomInput').value = '';
  insertCoordTemplate(expr);
}

function insertCoordPoint(x, y, name) {
  const n = name || ('P' + coord.nextId);
  coord.points.push({ x, y, name: n, id: coord.nextId++ });
  switchTab('koordinaten');
  renderPtList();
  setTimeout(() => { resizeCanvas(); drawCanvas(); }, 80);
}

function insertUnitPoints() {
  insertCoordPoint(1, 0, 'E₁');
  insertCoordPoint(0, 1, 'E₂');
}

function insertUnitCirclePoints() {
  insertCoordPoint(1, 0, 'E');
  insertCoordPoint(0, 1, 'N');
  insertCoordPoint(-1, 0, 'W');
  insertCoordPoint(0, -1, 'S');
}

/* ─ 3D Calculator ─ */
let mode3D = 'wuerfel';

function set3DMode(mode) {
  mode3D = mode;
  const modeList = ['wuerfel','quader','zylinder3d','kegel','kugel3d','pyramide'];
  document.querySelectorAll('#btn3D .modbtn').forEach((b, i) => {
    b.classList.toggle('active', modeList[i] === mode);
  });
  const inp = document.getElementById('inp3D');
  const defs = {
    wuerfel:    [['Seite a', 'd3A']],
    quader:     [['Seite a', 'd3A'], ['Seite b', 'd3B'], ['Seite c', 'd3C']],
    zylinder3d: [['Radius r', 'd3R'], ['Höhe h', 'd3H']],
    kegel:      [['Radius r', 'd3R'], ['Höhe h', 'd3H']],
    kugel3d:    [['Radius r', 'd3R']],
    pyramide:   [['Seite a (Grundf.)', 'd3A'], ['Höhe h', 'd3H']],
  };
  inp.innerHTML = (defs[mode] || []).map(([lbl, id]) =>
    `<div class="srow"><span class="slbl">${lbl}</span>
     <input class="sinput" id="${id}" type="number" placeholder="Wert" step="0.1" style="-webkit-user-select:text;user-select:text"></div>`
  ).join('');
  const sol = document.getElementById('sol3D');
  sol.classList.remove('vis');
  sol.innerHTML = '';
}

function calc3D() {
  const sol = document.getElementById('sol3D');
  const get = id => { const el = document.getElementById(id); return el ? parseFloat(el.value) : NaN; };
  const PI = Math.PI;
  let res = '';
  switch (mode3D) {
    case 'wuerfel': {
      const a = get('d3A');
      if (isNaN(a)) { sol.innerHTML = '<div class="errmsg">Seite a eingeben</div>'; sol.classList.add('vis'); return; }
      const V = a**3, O = 6*a*a, d = Math.sqrt(3)*a;
      res = `<div class="solres"><div class="rl">Würfel · a = ${a}</div>
        <div class="rv">V = ${round(V)}</div>
        <div class="rv" style="font-size:16px;margin-top:4px">O = ${round(O)}</div>
        <div class="rv" style="font-size:16px">Raumdiagonale d = ${round(d)}</div></div>`;
      break;
    }
    case 'quader': {
      const a = get('d3A'), b = get('d3B'), c = get('d3C');
      if (isNaN(a)||isNaN(b)||isNaN(c)) { sol.innerHTML = '<div class="errmsg">a, b und c eingeben</div>'; sol.classList.add('vis'); return; }
      const V = a*b*c, O = 2*(a*b+b*c+a*c), d = Math.sqrt(a*a+b*b+c*c);
      res = `<div class="solres"><div class="rl">Quader · a=${a}, b=${b}, c=${c}</div>
        <div class="rv">V = ${round(V)}</div>
        <div class="rv" style="font-size:16px;margin-top:4px">O = ${round(O)}</div>
        <div class="rv" style="font-size:16px">Raumdiagonale d = ${round(d)}</div></div>`;
      break;
    }
    case 'zylinder3d': {
      const r = get('d3R'), h = get('d3H');
      if (isNaN(r)||isNaN(h)) { sol.innerHTML = '<div class="errmsg">r und h eingeben</div>'; sol.classList.add('vis'); return; }
      const V = PI*r*r*h, M = 2*PI*r*h, O = M + 2*PI*r*r;
      res = `<div class="solres"><div class="rl">Zylinder · r=${r}, h=${h}</div>
        <div class="rv">V = ${round(V)}</div>
        <div class="rv" style="font-size:16px;margin-top:4px">Mantelfläche = ${round(M)}</div>
        <div class="rv" style="font-size:16px">Oberfläche O = ${round(O)}</div></div>`;
      break;
    }
    case 'kegel': {
      const r = get('d3R'), h = get('d3H');
      if (isNaN(r)||isNaN(h)) { sol.innerHTML = '<div class="errmsg">r und h eingeben</div>'; sol.classList.add('vis'); return; }
      const s = Math.sqrt(r*r+h*h);
      const V = PI*r*r*h/3, M = PI*r*s, O = M + PI*r*r;
      res = `<div class="solres"><div class="rl">Kegel · r=${r}, h=${h}</div>
        <div class="rv">V = ${round(V)}</div>
        <div class="rv" style="font-size:16px;margin-top:4px">Mantelfläche = ${round(M)}</div>
        <div class="rv" style="font-size:16px">Oberfläche O = ${round(O)}</div>
        <div class="rv" style="font-size:16px">Mantellinie s = ${round(s)}</div></div>`;
      break;
    }
    case 'kugel3d': {
      const r = get('d3R');
      if (isNaN(r)) { sol.innerHTML = '<div class="errmsg">Radius eingeben</div>'; sol.classList.add('vis'); return; }
      const V = 4/3*PI*r**3, O = 4*PI*r*r;
      res = `<div class="solres"><div class="rl">Kugel · r=${r}</div>
        <div class="rv">V = ${round(V)}</div>
        <div class="rv" style="font-size:16px;margin-top:4px">O = ${round(O)}</div></div>`;
      break;
    }
    case 'pyramide': {
      const a = get('d3A'), h = get('d3H');
      if (isNaN(a)||isNaN(h)) { sol.innerHTML = '<div class="errmsg">a und h eingeben</div>'; sol.classList.add('vis'); return; }
      const s = Math.sqrt(h*h + (a/2)**2);
      const V = a*a*h/3, G = a*a, M = 4*(a*s/2), O = G+M;
      res = `<div class="solres"><div class="rl">Pyramide (quad.) · a=${a}, h=${h}</div>
        <div class="rv">V = ${round(V)}</div>
        <div class="rv" style="font-size:16px;margin-top:4px">Grundfläche G = ${round(G)}</div>
        <div class="rv" style="font-size:16px">Mantelfläche = ${round(M)}</div>
        <div class="rv" style="font-size:16px">Oberfläche O = ${round(O)}</div></div>`;
      break;
    }
  }
  if (res) { sol.innerHTML = res; sol.classList.add('vis'); }
}

/* ─ 3D Coordinate Calculator ─ */
function calc3DCoord() {
  const v = id => parseFloat(document.getElementById(id).value);
  const fmt = n => isFinite(n) ? (Math.abs(n) < 0.001 && n !== 0 ? n.toExponential(4) : parseFloat(n.toPrecision(8)).toString()) : '—';
  const x1=v('p3x1'),y1=v('p3y1'),z1=v('p3z1'),x2=v('p3x2'),y2=v('p3y2'),z2=v('p3z2');
  const res = document.getElementById('res3DCoord');
  if ([x1,y1,z1,x2,y2,z2].some(isNaN)) {
    res.innerHTML = '<span style="color:var(--dim)">Alle 6 Koordinaten eingeben</span>';
    return;
  }
  const d = Math.sqrt((x2-x1)**2+(y2-y1)**2+(z2-z1)**2);
  const mx=(x1+x2)/2, my=(y1+y2)/2, mz=(z1+z2)/2;
  res.innerHTML = `Abstand d = <b>${fmt(d)}</b><br>Mittelpunkt M = (<b>${fmt(mx)}</b> | <b>${fmt(my)}</b> | <b>${fmt(mz)}</b>)`;
}

function switchKlasseSub(id) {
  document.querySelectorAll('#tabKlasse .spanel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('#tabKlasse .stab').forEach(b => b.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  const tabs = ['kFormeln','kVorlagen','kGeometrie','kPhysik','k3D'];
  document.querySelectorAll('#tabKlasse .stab')[tabs.indexOf(id)].classList.add('active');
}

function setGeoMode(mode) {
  geoMode = mode;
  document.querySelectorAll('#geoBtns .modbtn').forEach((b, i) => {
    b.classList.toggle('active', ['kreis','rechteck','dreieck','zylinder'][i] === mode);
  });
  const inp = document.getElementById('geoInputs');
  const defs = {
    kreis:    [['Radius r (m)', 'geoR']],
    rechteck: [['Seite a (m)', 'geoA'], ['Seite b (m)', 'geoB']],
    dreieck:  [['Grundlinie g (m)', 'geoG'], ['Höhe h (m)', 'geoHH']],
    zylinder: [['Radius r (m)', 'geoR'], ['Höhe h (m)', 'geoHH']],
  };
  inp.innerHTML = (defs[mode] || []).map(([lbl, id]) =>
    `<div class="srow"><span class="slbl">${lbl}</span>
     <input class="sinput" id="${id}" type="number" placeholder="Wert" step="0.1" style="-webkit-user-select:text;user-select:text"></div>`
  ).join('');
  document.getElementById('geoSol').classList.remove('vis');
  document.getElementById('geoSol').innerHTML = '';
}

function calcGeo() {
  const sol = document.getElementById('geoSol');
  const get = id => { const el = document.getElementById(id); return el ? parseFloat(el.value) : NaN; };
  let res = '';
  const PI = Math.PI;
  switch (geoMode) {
    case 'kreis': {
      const r = get('geoR');
      if (isNaN(r)) { sol.innerHTML = '<div class="errmsg">Radius eingeben</div>'; break; }
      const A = PI * r * r, U = 2 * PI * r;
      res = `<div class="solres"><div class="rl">Kreis · r = ${r} m</div>
        <div class="rv">A = ${round(A)} m²</div>
        <div class="rv" style="font-size:16px;margin-top:4px">U = ${round(U)} m</div></div>`;
      break;
    }
    case 'rechteck': {
      const a = get('geoA'), b = get('geoB');
      if (isNaN(a)||isNaN(b)) { sol.innerHTML = '<div class="errmsg">Seiten eingeben</div>'; break; }
      const A = a*b, U = 2*(a+b);
      res = `<div class="solres"><div class="rl">Rechteck · a=${a} m, b=${b} m</div>
        <div class="rv">A = ${round(A)} m²</div>
        <div class="rv" style="font-size:16px;margin-top:4px">U = ${round(U)} m</div></div>`;
      break;
    }
    case 'dreieck': {
      const g = get('geoG'), h = get('geoHH');
      if (isNaN(g)||isNaN(h)) { sol.innerHTML = '<div class="errmsg">Grundlinie und Höhe eingeben</div>'; break; }
      const A = g*h/2;
      res = `<div class="solres"><div class="rl">Dreieck · g=${g} m, h=${h} m</div>
        <div class="rv">A = ${round(A)} m²</div></div>`;
      break;
    }
    case 'zylinder': {
      const r = get('geoR'), h = get('geoHH');
      if (isNaN(r)||isNaN(h)) { sol.innerHTML = '<div class="errmsg">Radius und Höhe eingeben</div>'; break; }
      const V = PI*r*r*h, M = 2*PI*r*h, G = 2*PI*r*r;
      res = `<div class="solres"><div class="rl">Zylinder · r=${r} m, h=${h} m</div>
        <div class="rv">V = ${round(V)} m³</div>
        <div class="rv" style="font-size:16px;margin-top:4px">Mantel = ${round(M)} m²</div>
        <div class="rv" style="font-size:16px">Oberfläche = ${round(M+G)} m²</div></div>`;
      break;
    }
  }
  if (res) { sol.innerHTML = res; sol.classList.add('vis'); }
  else { sol.classList.add('vis'); }
}

function setPhysMode(mode) {
  physMode = mode;
  document.querySelectorAll('#physBtns .modbtn').forEach((b, i) => {
    b.classList.toggle('active', ['kraft','arbeit','leistung','geschw'][i] === mode);
  });
  const inp = document.getElementById('physInputs');
  const defs = {
    kraft:    [['Masse m (kg)', 'phM'],  ['Beschleunigung a (m/s²)', 'phA']],
    arbeit:   [['Kraft F (N)', 'phF'],   ['Strecke s (m)', 'phS']],
    leistung: [['Arbeit W (J)', 'phW'],  ['Zeit t (s)', 'phT']],
    geschw:   [['Strecke s (m)', 'phS'], ['Zeit t (s)', 'phT']],
  };
  inp.innerHTML = (defs[mode] || []).map(([lbl, id]) =>
    `<div class="srow"><span class="slbl">${lbl}</span>
     <input class="sinput" id="${id}" type="number" placeholder="Wert" step="0.01" style="-webkit-user-select:text;user-select:text"></div>`
  ).join('');
  document.getElementById('physSol').classList.remove('vis');
  document.getElementById('physSol').innerHTML = '';
}

function calcPhys() {
  const sol = document.getElementById('physSol');
  const get = id => { const el = document.getElementById(id); return el ? parseFloat(el.value) : NaN; };
  let res = '';
  switch (physMode) {
    case 'kraft': {
      const m = get('phM'), a = get('phA');
      if (isNaN(m)||isNaN(a)) { sol.innerHTML = '<div class="errmsg">Werte eingeben</div>'; break; }
      res = `<div class="solres"><div class="rl">F = m · a</div>
        <div class="rv">F = ${round(m*a)} N</div></div>`;
      break;
    }
    case 'arbeit': {
      const F = get('phF'), s = get('phS');
      if (isNaN(F)||isNaN(s)) { sol.innerHTML = '<div class="errmsg">Werte eingeben</div>'; break; }
      res = `<div class="solres"><div class="rl">W = F · s</div>
        <div class="rv">W = ${round(F*s)} J</div></div>`;
      break;
    }
    case 'leistung': {
      const W = get('phW'), t = get('phT');
      if (isNaN(W)||isNaN(t)||t===0) { sol.innerHTML = '<div class="errmsg">Werte eingeben (t ≠ 0)</div>'; break; }
      res = `<div class="solres"><div class="rl">P = W / t</div>
        <div class="rv">P = ${round(W/t)} W</div></div>`;
      break;
    }
    case 'geschw': {
      const s = get('phS'), t = get('phT');
      if (isNaN(s)||isNaN(t)||t===0) { sol.innerHTML = '<div class="errmsg">Werte eingeben (t ≠ 0)</div>'; break; }
      res = `<div class="solres"><div class="rl">v = s / t</div>
        <div class="rv">v = ${round(s/t)} m/s</div>
        <div class="rv" style="font-size:16px;margin-top:4px">= ${round(s/t*3.6)} km/h</div></div>`;
      break;
    }
  }
  if (res) { sol.innerHTML = res; sol.classList.add('vis'); }
  else { sol.classList.add('vis'); }
}

/* ═══════════════════════════════════════════════════════
   IMAGE SCANNER  (Tesseract.js – client-side OCR, no API)
══════════════════════════════════════════════════════════ */
let bildFile = null;

function bildSetupDropZone() {
  const zone   = document.getElementById('bildDropZone');
  const fileIn = document.getElementById('bildFileInput');

  zone.addEventListener('click', () => fileIn.click());
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) bildLoadFile(file);
  });
  fileIn.addEventListener('change', e => {
    if (e.target.files[0]) bildLoadFile(e.target.files[0]);
  });
}

function bildLoadFile(file) {
  bildFile = file;
  const reader = new FileReader();
  reader.onload = ev => {
    document.getElementById('bildPreview').src = ev.target.result;
    document.getElementById('bildPreviewWrap').style.display = 'block';
    document.getElementById('bildScanBtn').style.display = '';
    document.getElementById('bildResults').innerHTML = '';
    document.getElementById('bildStatus').classList.remove('vis');
  };
  reader.readAsDataURL(file);
}

function bildClear() {
  bildFile = null;
  document.getElementById('bildPreview').src = '';
  document.getElementById('bildPreviewWrap').style.display = 'none';
  document.getElementById('bildScanBtn').style.display = 'none';
  document.getElementById('bildResults').innerHTML = '';
  document.getElementById('bildStatus').classList.remove('vis');
  document.getElementById('bildFileInput').value = '';
}

async function bildScan() {
  if (!bildFile) return;

  const statusEl = document.getElementById('bildStatus');
  const statusTxt = document.getElementById('bildStatusText');
  const bar = document.getElementById('bildProgressBar');
  const resultsEl = document.getElementById('bildResults');

  statusEl.classList.add('vis');
  statusTxt.textContent = 'OCR-Engine laden…';
  bar.style.width = '5%';
  resultsEl.innerHTML = '';

  try {
    // Lazily load Tesseract.js from CDN (free, runs 100% in the browser, no API key needed)
    if (typeof Tesseract === 'undefined') {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
        s.onload = resolve;
        s.onerror = () => reject(new Error('OCR-Engine konnte nicht geladen werden. Bitte überprüfe deine Internetverbindung.'));
        document.head.appendChild(s);
      });
    }

    statusTxt.textContent = 'Erkennung starten…';
    bar.style.width = '15%';

    // Use English only and whitelist math/number characters for better accuracy
    const worker = await Tesseract.createWorker(['eng'], 1, {
      logger: m => {
        if (m.status === 'recognizing text') {
          bar.style.width = Math.round(15 + m.progress * 75) + '%';
          statusTxt.textContent = 'Erkennung… ' + Math.round(m.progress * 100) + '%';
        }
      }
    });

    // Configure Tesseract to focus on numbers and math symbols
    await worker.setParameters({
      tessedit_char_whitelist: '0123456789+-*/=^().,:;[]{}|\\/<>!?%xXyYzZabcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ²³√πΣ∫∞≤≥≠±×÷',
      preserve_interword_spaces: '1'
    });

    const { data: { text } } = await worker.recognize(document.getElementById('bildPreview'));
    await worker.terminate();

    bar.style.width = '100%';
    statusTxt.textContent = '✅ Fertig!';

    bildParseAndShow(text);
  } catch (err) {
    statusTxt.textContent = '⚠️ ' + err.message;
    bar.style.width = '0%';
  }
}

/* ─ Parse OCR text for equations and coordinates ─ */
// Module-level storage so onclick handlers can safely reference items by index
let bildDetectedEqs = [];
let bildDetectedPts = [];

function bildParseAndShow(rawText) {
  const resultsEl = document.getElementById('bildResults');

  // Normalise common OCR substitutions
  const text = rawText
    .replace(/[—–]/g, '-').replace(/×/g, '*').replace(/÷/g, '/')
    .replace(/['']/g, "'").replace(/[""]/g, '"')
    .replace(/\bx2\b/g, 'x^2').replace(/²/g, '^2');

  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 1);

  const equations  = [];
  const coordPoints = [];

  for (const line of lines) {
    // Coordinates first (so e.g. "A(1,2)" is not also treated as an equation)
    const pts = bildExtractCoords(line);
    coordPoints.push(...pts);
    // Equations
    if (bildIsEquation(line)) equations.push(line);
  }

  // De-duplicate coordinates by (x,y) value
  const seen = new Set();
  const uniquePts = coordPoints.filter(p => {
    const key = p.x + ',' + p.y;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });

  // Store in module-level arrays so onclick indices are safe (no user text in HTML attributes)
  bildDetectedEqs = equations;
  bildDetectedPts = uniquePts;

  let html = '';

  if (equations.length === 0 && uniquePts.length === 0) {
    html = `<div class="bild-empty">
      <div style="font-size:32px;margin-bottom:8px">🔍</div>
      <div>Keine Gleichungen oder Koordinaten erkannt.</div>
      <div style="font-size:12px;margin-top:4px;color:var(--dim)">Tipp: Verwende ein scharfes, kontrastreiches Bild.</div>
    </div>`;
    if (rawText.trim()) {
      html += `<div class="bild-sec-title" style="margin:0 14px 4px">Erkannter Rohtext</div>
        <div class="bild-raw">${escHtml(rawText.trim())}</div>`;
    }
    resultsEl.innerHTML = html;
    return;
  }

  // OCR-Genauigkeitshinweis anzeigen
  html += `<div class="bild-ocr-notice">⚠️ Der erkannte Text kann Fehler enthalten – bitte Ergebnisse überprüfen.</div>`;

  if (equations.length > 0) {
    html += `<div class="bild-sec-title">Erkannte Gleichungen (${equations.length})</div>`;
    equations.forEach((eq, idx) => {
      let solHtml = '';
      try {
        const steps = parseAndSolve(eq);
        const res = steps.find(s => s.result);
        if (res) solHtml = `<div class="bild-item-sol">Lösung: <strong>${escHtml(res.math)}</strong></div>`;
      } catch { /* unsolvable – still show it */ }
      // Check if equation can be plotted as y = f(x)
      const fnExpr = bildExtractFnExpr(eq);

      html += `<div class="bild-eq-item">
        <div class="bild-item-text">${escHtml(eq)}</div>
        ${solHtml}
        <div class="bild-item-actions">
          <button class="bi-btn" onclick="bildSendToSolver(${idx})">→ Löser</button>
          <button class="bi-btn" onclick="bildSendToCalc(${idx})">→ Rechner</button>
          ${fnExpr !== null ? `<button class="bi-btn" onclick="bildSendToCoordFn(${idx})">→ Graph</button>` : ''}
          <button class="bi-btn" onclick="bildSendToAgent(${idx})">→ Agent</button>
          <button class="bi-btn" onclick="bildCopyEq(${idx})">📋 Kopieren</button>
        </div>
      </div>`;
    });
  }

  if (uniquePts.length > 0) {
    html += `<div class="bild-sec-title" style="margin-top:${equations.length ? '10px' : '0'}">Erkannte Koordinaten (${uniquePts.length})</div>`;
    uniquePts.forEach((pt, idx) => {
      const disp = (pt.label ? pt.label + ' = ' : '') + '(' + pt.x + ', ' + pt.y + ')';
      html += `<div class="bild-pt-item">
        <div class="bild-item-text">${escHtml(disp)}</div>
        <div class="bild-item-actions">
          <button class="bi-btn" onclick="bildAddPoint(${idx})">→ Graph</button>
          <button class="bi-btn" onclick="bildCopyPt(${idx})">📋 Kopieren</button>
        </div>
      </div>`;
    });
  }

  // „Alle zum Agent hinzufügen"-Leiste unten
  if (equations.length > 0) {
    html += `<div class="bild-agent-bar">
      <button onclick="bildSendAllToAgent()">🤖 Alle Gleichungen zum Agent hinzufügen</button>
    </div>`;
  }

  resultsEl.innerHTML = html;
}

/* ─ Helpers ─ */
function bildIsEquation(line) {
  if (!line.includes('=')) return false;
  if (line.length > 80) return false;
  if (/https?:|www\.|\.com|\.de/.test(line)) return false;
  // Require at least one digit or lowercase letter (variable)
  if (!/\d/.test(line) && !/[a-z]/i.test(line)) return false;
  // Ratio of math characters must be high enough
  const mathLen = (line.match(/[0-9a-zA-Z+\-*/=().^²]/g) || []).length;
  return mathLen / line.length >= 0.4;
}

function bildExtractCoords(line) {
  const results = [];
  // Labeled: A(1, 2)  B(-3, 4.5)  P(0, -7)
  const labeled = /\b([A-Z])\s*\(\s*(-?\d+(?:[.,]\d+)?)\s*[,;]\s*(-?\d+(?:[.,]\d+)?)\s*\)/g;
  let m;
  while ((m = labeled.exec(line)) !== null) {
    results.push({ label: m[1], x: parseFloat(m[2].replace(',', '.')), y: parseFloat(m[3].replace(',', '.')) });
  }
  // Unlabeled: (1, 2)  (-3.5, 4)  – avoid re-matching already labeled ones
  const unlabeled = /(?<![A-Za-z])\(\s*(-?\d+(?:[.,]\d+)?)\s*[,;]\s*(-?\d+(?:[.,]\d+)?)\s*\)/g;
  while ((m = unlabeled.exec(line)) !== null) {
    const x = parseFloat(m[1].replace(',', '.'));
    const y = parseFloat(m[2].replace(',', '.'));
    // Skip if already captured as labeled at same position
    const already = results.some(r => r.x === x && r.y === y);
    if (!already) results.push({ x, y });
  }
  return results;
}

function bildSendToSolver(idx) {
  const eq = bildDetectedEqs[idx];
  if (!eq) return;
  document.getElementById('eqInput').value = eq;
  switchTab('rechner');
  switchSub('gleichungen');
  setTimeout(solveEquation, 120); // short delay to let panel switch complete
}

function bildSendToCalc(idx) {
  const eq = bildDetectedEqs[idx];
  if (!eq) return;
  // Strip the "= rhs" part so it goes into the expression field
  const lhs = eq.split('=')[0].trim();
  calc.expr = lhs;
  try { calc.result = String(evalSafe(lhs)); } catch { calc.result = '...'; }
  updateCalcDisplay();
  switchTab('rechner');
  switchSub('grundrechner');
}

function bildAddPoint(idx) {
  const pt = bildDetectedPts[idx];
  if (!pt) return;
  const name = pt.label || ('P' + coord.nextId);
  coord.points.push({ x: pt.x, y: pt.y, name, id: coord.nextId++ });
  switchTab('koordinaten');
  setTimeout(() => { resizeCanvas(); drawCoord(); }, 120); // short delay to let panel switch complete
}

function bildCopyEq(idx) {
  const eq = bildDetectedEqs[idx];
  if (eq && navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(eq).catch(() => {});
  }
}

function bildCopyPt(idx) {
  const pt = bildDetectedPts[idx];
  if (!pt) return;
  const text = '(' + pt.x + ', ' + pt.y + ')';
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(() => {});
  }
}

/* ─ Extract plottable function expression from an equation ─
   Returns the right-hand side expression (in x) if the equation
   has the form  y = …  /  f(x) = …  /  y = constant, otherwise null. */
function bildExtractFnExpr(eq) {
  // Strip "y =" / "f(x) =" / "y=" prefix
  const m = eq.match(/^(?:y|f\s*\(\s*x\s*\))\s*=\s*(.+)$/i);
  if (!m) return null;
  const expr = m[1].replace(/\s/g, '');
  if (!expr) return null;
  // Validate: must evaluate to a finite number at x = 1
  const val = evalFn(expr, 1);
  if (!isFinite(val)) return null;
  return expr;
}

function bildSendToCoordFn(idx) {
  const eq = bildDetectedEqs[idx];
  if (!eq) return;
  const expr = bildExtractFnExpr(eq);
  if (!expr) return;
  const color = COLORS[colorIdx % COLORS.length]; colorIdx++;
  const id = coord.nextId++;
  coord.functions.push({ expr, color, id, raw: eq });
  switchTab('koordinaten');
  setTimeout(() => { renderFnList(); resizeCanvas(); drawCoord(); }, 120);
}

/* ─ Send single OCR equation to agent ─ */
function bildSendToAgent(idx) {
  const eq = bildDetectedEqs[idx];
  if (!eq) return;
  agentAddTask();
  const taskIdx = agentTasks.length - 1;
  agentTasks[taskIdx].items[0] = eq;
  agentRenderTasks();
  switchTab('agent');
}

/* ─ Send all OCR equations to agent as one task ─ */
function bildSendAllToAgent() {
  if (!bildDetectedEqs.length) return;
  agentAddTask();
  const taskIdx = agentTasks.length - 1;
  agentTasks[taskIdx].name = 'OCR-Aufgaben';
  // Fill up to max total items
  const space = agentGetMax() - agentTotalItems();
  const eqs = bildDetectedEqs.slice(0, Math.max(0, space));
  if (eqs.length === 0) { agentTasks.pop(); agentRenderTasks(); switchTab('agent'); return; }
  agentTasks[taskIdx].items = eqs.slice();
  agentRenderTasks();
  switchTab('agent');
}

/* ═══════════════════════════════════════════════════════
   MATH AGENT
═══════════════════════════════════════════════════════ */
const AGENT_MAX = 50;

// Data model: array of task objects, each with { name, items[] }
let agentTasks = [];
// Stored results after run: array of { taskIdx, itemIdx, eq, steps, error }
let agentResultData = [];

function agentTotalItems() {
  return agentTasks.reduce((s, t) => s + t.items.length, 0);
}

function agentAddTask() {
  const max = agentGetMax();
  if (agentTasks.length >= max) {
    showPremiumModal('Als Free-Nutzer kannst du maximal 5 Aufgaben erstellen. Werde Premium für bis zu 50!');
    return;
  }
  const n = agentTasks.length + 1;
  agentTasks.push({ name: 'Aufgabe ' + n, items: [''] });
  agentRenderTasks();
}

function agentRemoveTask(taskIdx) {
  agentTasks.splice(taskIdx, 1);
  agentRenderTasks();
}

function agentAddItem(taskIdx) {
  if (agentTotalItems() >= agentGetMax()) return;
  agentTasks[taskIdx].items.push('');
  agentRenderTasks();
}

function agentRemoveItem(taskIdx, itemIdx) {
  agentTasks[taskIdx].items.splice(itemIdx, 1);
  if (agentTasks[taskIdx].items.length === 0) agentTasks[taskIdx].items = [''];
  agentRenderTasks();
}

function agentUpdateItem(taskIdx, itemIdx, value) {
  if (agentTasks[taskIdx]) agentTasks[taskIdx].items[itemIdx] = value;
  // Update counter
  const max = agentGetMax();
  document.getElementById('agentCounter').textContent = agentTotalItems() + ' / ' + max;
}

function agentUpdateTaskName(taskIdx, value) {
  if (agentTasks[taskIdx]) agentTasks[taskIdx].name = value;
}

function agentRenderTasks() {
  const wrap = document.getElementById('agentTasksWrap');
  const empty = document.getElementById('agentEmpty');
  const total = agentTotalItems();
  const max = agentGetMax();
  document.getElementById('agentCounter').textContent = total + ' / ' + max;

  if (agentTasks.length === 0) {
    empty.style.display = '';
    wrap.querySelectorAll('.agent-task-card').forEach(el => el.remove());
    return;
  }
  empty.style.display = 'none';

  // Re-build all task cards
  wrap.querySelectorAll('.agent-task-card').forEach(el => el.remove());
  agentTasks.forEach((task, ti) => {
    const card = document.createElement('div');
    card.className = 'agent-task-card';
    card.id = 'agentCard_' + ti;

    let itemsHtml = task.items.map((item, ii) => `
      <div class="agent-item-row">
        <input class="agent-item-input" type="text" placeholder="Gleichung oder Aufgabe, z.B. 2x+3=7"
          value="${escHtml(item)}"
          oninput="agentUpdateItem(${ti},${ii},this.value)"
          onblur="agentUpdateItem(${ti},${ii},this.value)">
        <button class="agent-item-del" onclick="agentRemoveItem(${ti},${ii})" title="Entfernen">✕</button>
      </div>`).join('');

    const canAdd = total < max;
    card.innerHTML = `
      <div class="agent-task-head">
        <input class="agent-task-name" type="text" value="${escHtml(task.name)}"
          oninput="agentUpdateTaskName(${ti},this.value)"
          onblur="agentUpdateTaskName(${ti},this.value)">
        <button class="agent-task-del" onclick="agentRemoveTask(${ti})" title="Aufgabe löschen">🗑</button>
      </div>
      <div class="agent-items-list">${itemsHtml}</div>
      <button class="agent-add-item" onclick="agentAddItem(${ti})" ${canAdd ? '' : 'disabled'}>
        ${canAdd ? '+ Gleichung / Aufgabe hinzufügen' : 'Limit erreicht (' + max + ')'}
      </button>`;
    wrap.appendChild(card);
  });
}

async function agentRun() {
  if (agentTasks.length === 0) return;

  const statusEl = document.getElementById('agentStatus');
  const statusTxt = document.getElementById('agentStatusText');
  const bar = document.getElementById('agentProgressBar');
  const resultsWrap = document.getElementById('agentResultsWrap');
  const runBtn = document.getElementById('agentRunBtn');

  // Collect all items
  const allItems = [];
  agentTasks.forEach((task, ti) => {
    task.items.forEach((item, ii) => {
      if (item.trim()) allItems.push({ taskIdx: ti, itemIdx: ii, eq: item.trim() });
    });
  });

  if (allItems.length === 0) return;

  runBtn.disabled = true;
  statusEl.classList.add('vis');
  resultsWrap.innerHTML = '';
  agentResultData = [];

  const total = allItems.length;

  // Solve each item with a tiny async delay so the UI stays responsive
  for (let i = 0; i < allItems.length; i++) {
    const { taskIdx, itemIdx, eq } = allItems[i];
    statusTxt.textContent = `Löse ${i + 1} / ${total}: ${eq.length > 40 ? eq.slice(0, 40) + '…' : eq}`;
    bar.style.width = Math.round(((i + 1) / total) * 100) + '%';

    await new Promise(r => setTimeout(r, 0)); // yield to UI

    let steps = null, error = null;
    try {
      // Try equation solver first
      steps = parseAndSolve(eq);
    } catch (e1) {
      // Fall back to direct numeric evaluation
      try {
        const val = evalSafe(eq);
        steps = [
          { desc: 'Aufgabe', math: eq },
          { desc: '✅ Ergebnis', math: String(round(val)), result: true }
        ];
      } catch (e2) {
        error = e1.message || 'Unbekannter Fehler';
      }
    }
    agentResultData.push({ taskIdx, itemIdx, eq, steps, error });
  }

  bar.style.width = '100%';
  statusTxt.textContent = '✅ Fertig! ' + total + ' Aufgabe(n) gelöst.';
  runBtn.disabled = false;

  agentRenderResults();
}

function agentRenderResults() {
  const wrap = document.getElementById('agentResultsWrap');
  if (!agentResultData.length) { wrap.innerHTML = ''; return; }

  // Group results by taskIdx
  const byTask = {};
  agentResultData.forEach(r => {
    if (!byTask[r.taskIdx]) byTask[r.taskIdx] = [];
    byTask[r.taskIdx].push(r);
  });

  let html = '<div class="agent-results-wrap">';
  Object.keys(byTask).forEach(ti => {
    const taskName = escHtml(agentTasks[ti] ? agentTasks[ti].name : ('Aufgabe ' + (Number(ti) + 1)));
    html += `<div class="agent-res-task">
      <div class="agent-res-task-title">📋 ${taskName}</div>`;
    byTask[ti].forEach(r => {
      const rIdx = agentResultData.indexOf(r);
      html += `<div class="agent-res-item">
        <div class="agent-res-eq">📌 ${escHtml(r.eq)}</div>`;
      if (r.error) {
        html += `<div class="agent-res-error">⚠️ ${escHtml(r.error)}</div>`;
      } else if (r.steps) {
        // Steps (excluding result step)
        const regularSteps = r.steps.filter(s => !s.result);
        const resultSteps = r.steps.filter(s => s.result);
        if (regularSteps.length > 0) {
          html += `<div class="agent-res-steps">`;
          let num = 1;
          regularSteps.forEach(s => {
            html += `<div class="solstep">
              <div class="ssn">${num++}</div>
              <div><div class="ssd">${escHtml(s.desc)}</div><div class="ssm">${escHtml(s.math)}</div></div>
            </div>`;
          });
          html += `</div>`;
        }
        resultSteps.forEach(s => {
          html += `<div class="agent-res-answer">
            <div class="rl">${escHtml(s.desc)}</div>
            <div class="rv">${escHtml(s.math)}</div>
          </div>`;
        });
        // "Generate in coordinate system" button – only for plottable equations
        const fnExpr = bildExtractFnExpr(r.eq);
        if (fnExpr !== null) {
          html += `<button class="agent-res-coord-btn" onclick="agentSendToCoord(${rIdx})">📐 Im Koordinatensystem generieren</button>`;
        }
      }
      html += `</div>`; // end agent-res-item
    });
    html += `</div>`; // end agent-res-task
  });
  html += '</div>';
  wrap.innerHTML = html;
}

function agentSendToCoord(rIdx) {
  const r = agentResultData[rIdx];
  if (!r) return;
  const expr = bildExtractFnExpr(r.eq);
  if (!expr) return;
  const color = COLORS[colorIdx % COLORS.length]; colorIdx++;
  const id = coord.nextId++;
  coord.functions.push({ expr, color, id, raw: r.eq });
  switchTab('koordinaten');
  setTimeout(() => { renderFnList(); resizeCanvas(); drawCoord(); }, 120);
}

/* ─ Statistics calculator ─ */
function calcStat() {
  const raw = document.getElementById('statInput').value.trim();
  const sol = document.getElementById('statSol');
  if (!raw) { sol.innerHTML = '<div class="errmsg">Bitte Zahlen eingeben</div>'; sol.classList.add('vis'); return; }
  const nums = raw.split(/[,;\s]+/).map(s => parseFloat(s)).filter(n => !isNaN(n));
  if (nums.length === 0) { sol.innerHTML = '<div class="errmsg">Bitte gültige Zahlen eingeben</div>'; sol.classList.add('vis'); return; }
  const n = nums.length;
  const sum = nums.reduce((a,b)=>a+b, 0);
  const mean = sum / n;
  const sorted = [...nums].sort((a,b)=>a-b);
  const median = n % 2 === 0 ? (sorted[n/2-1]+sorted[n/2])/2 : sorted[Math.floor(n/2)];
  const variance = nums.reduce((a,b)=>a+(b-mean)**2, 0) / n;
  const stddev = Math.sqrt(variance);
  const min = sorted[0], max = sorted[n-1];
  sol.innerHTML = `<div class="solres">
    <div class="rl">n = ${n} Werte</div>
    <div class="rv" style="font-size:16px">Summe: ${round(sum)}</div>
    <div class="rv" style="font-size:16px">Mittelwert: ${round(mean)}</div>
    <div class="rv" style="font-size:16px">Median: ${round(median)}</div>
    <div class="rv" style="font-size:16px">Standardabw.: ${round(stddev)}</div>
    <div class="rv" style="font-size:16px">Min: ${min}  |  Max: ${max}</div>
  </div>`;
  sol.classList.add('vis');
}

/* ══════════════════════════════════════════════
   LOADING SCREEN ANIMATION
══════════════════════════════════════════════ */
(function initLoadingScreen() {
  const cvs = document.getElementById('loadingBar');
  if (!cvs) return;
  const ctx = cvs.getContext('2d');
  const W = 260, H = 70;
  const dpr = window.devicePixelRatio || 1;
  cvs.width = W * dpr; cvs.height = H * dpr;
  ctx.scale(dpr, dpr);

  // Pick a random function for the loading animation
  const fns = [
    x => Math.sin(x * 1.5) * 0.7,
    x => x * x * 0.18 - 0.5,
    x => Math.cos(x * 2) * 0.6,
    x => Math.sin(x) * Math.cos(x * 0.5) * 0.8,
    x => (x * x * x) * 0.05
  ];
  const fn = fns[Math.floor(Math.random() * fns.length)];

  let progress = 0; // 0..1
  let done = false;

  function drawLoadingBar(p) {
    ctx.clearRect(0, 0, W, H);

    // Background mini coordinate system
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    // Grid lines
    for (let gx = 0; gx <= W; gx += W/8) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
    }
    for (let gy = 0; gy <= H; gy += H/4) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
    }

    // Axes
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, H/2); ctx.lineTo(W, H/2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(14, H); ctx.stroke();

    // Axis arrow tips
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath(); ctx.moveTo(W, H/2); ctx.lineTo(W-6, H/2-4); ctx.lineTo(W-6, H/2+4); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(10, 6); ctx.lineTo(18, 6); ctx.closePath(); ctx.fill();

    // Draw function line up to progress
    const maxX = p * (W - 14);
    ctx.beginPath();
    ctx.strokeStyle = '#cc0000';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#ff3333';
    ctx.shadowBlur = 6;
    let started = false;
    for (let px = 14; px <= 14 + maxX; px += 1) {
      const t = (px - 14) / (W - 14) * 6 - 3; // math x from -3 to 3
      const fy = fn(t);
      const cy = H/2 - fy * (H/3);
      if (!started) { ctx.moveTo(px, Math.max(2, Math.min(H-2, cy))); started = true; }
      else ctx.lineTo(px, Math.max(2, Math.min(H-2, cy)));
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Leading dot
    if (p > 0.01 && p < 1) {
      const px = 14 + maxX;
      const t = (px - 14) / (W - 14) * 6 - 3;
      const fy = fn(t);
      const cy = H/2 - fy * (H/3);
      ctx.beginPath();
      ctx.arc(px, Math.max(4, Math.min(H-4, cy)), 4, 0, Math.PI*2);
      ctx.fillStyle = '#ff6666';
      ctx.shadowColor = '#ff3333'; ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  function animate() {
    if (done) return;
    progress = Math.min(1, progress + 0.012);
    drawLoadingBar(progress);
    if (progress >= 1) {
      done = true;
      // Animation complete – keep the finished frame visible.
      // Dismissal is handled exclusively by _hideLoadingScreen()
      // (called from launchApp / showUI) to avoid a race where the
      // loading overlay disappears before #app is visible.
      return;
    }
    requestAnimationFrame(animate);
  }

  function hideLoadingScreen() {
    const el = document.getElementById('loadingScreen');
    if (!el || el.style.display === 'none') return;
    el.classList.add('fade-out');
    setTimeout(() => { el.style.display = 'none'; }, 520);
  }

  // Start animation after a tiny delay so DOM is ready
  setTimeout(() => {
    requestAnimationFrame(animate);
  }, 80);

  // Expose for dismissal when app is ready
  window._hideLoadingScreen = hideLoadingScreen;
})();

/* ══════════════════════════════════════════════
   CUSTOM MATH KEYBOARD
══════════════════════════════════════════════ */
let _mkTarget = null;  // currently focused input
const _pointInputIds = ['ptName', 'ptX', 'ptY'];
let _ptKbdTimer = null;  // debounce timer for point-keyboard padding

function _setPointKbdPadding(on) {
  clearTimeout(_ptKbdTimer);
  const kcontent = document.querySelector('#kpanel .kcontent');
  if (kcontent) kcontent.classList.toggle('kbd-open', on);
}

function mkInsert(ch) {
  if (!_mkTarget) return;
  // selectionStart/selectionEnd are null for type="number" inputs in most browsers
  // Fall back to end-of-value when null
  function getSel() {
    const s = _mkTarget.selectionStart;
    const e = _mkTarget.selectionEnd;
    const len = _mkTarget.value.length;
    return { s: s != null ? s : len, e: e != null ? e : len };
  }
  function trySetSel(pos) {
    // setSelectionRange throws on type="number" inputs — silently ignore (expected browser behaviour)
    try { _mkTarget.setSelectionRange(pos, pos); } catch (_selErr) { /* intentional: number inputs */ }
  }
  if (ch === '⌫') {
    const v = _mkTarget.value;
    const { s, e } = getSel();
    if (s !== e) {
      _mkTarget.value = v.slice(0, s) + v.slice(e);
      trySetSel(s);
    } else if (s > 0) {
      _mkTarget.value = v.slice(0, s - 1) + v.slice(s);
      trySetSel(s - 1);
    }
    _mkTarget.dispatchEvent(new Event('input', { bubbles: true }));
    _mkTarget.focus({ preventScroll: true });
  } else if (ch === 'ENTER') {
    // Use data-mk-confirm attribute for any "confirm" action to avoid hardcoding IDs
    const confirmAction = _mkTarget.dataset.mkConfirm;
    _mkTarget.blur();
    closeMathKbd();
    if (confirmAction === 'solve') solveEquation();
    else if (confirmAction === 'fraction') solveFraction();
  } else {
    const v = _mkTarget.value;
    const { s, e } = getSel();
    const ins = ch === '√' ? 'sqrt(' : ch;
    _mkTarget.value = v.slice(0, s) + ins + v.slice(e);
    const newPos = s + ins.length;
    trySetSel(newPos);
    _mkTarget.dispatchEvent(new Event('input', { bubbles: true }));
    _mkTarget.focus({ preventScroll: true });
  }
}

function openMathKbd(input) {
  _mkTarget = input;
  document.getElementById('mathKbd').classList.add('open');
  // If editing point coordinate fields, ensure the inputs are scrolled above the keyboard
  if (_pointInputIds.includes(input.id)) {
    const kpanel = document.getElementById('kpanel');
    if (kpanel) openPanelForInput();
    _setPointKbdPadding(true);
    setTimeout(() => { input.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 80);
  }
}

function closeMathKbd() {
  document.getElementById('mathKbd').classList.remove('open');
  _mkTarget = null;
  _setPointKbdPadding(false);
}

function openFracPicker() {
  document.getElementById('fracPicker').classList.add('open');
  document.getElementById('fpNum').value = '';
  document.getElementById('fpDen').value = '';
  setTimeout(() => document.getElementById('fpNum').focus(), 80);
}

function closeFracPicker() {
  document.getElementById('fracPicker').classList.remove('open');
}

function insertFraction() {
  const n = document.getElementById('fpNum').value.trim() || '1';
  const d = document.getElementById('fpDen').value.trim() || '2';
  closeFracPicker();
  if (_mkTarget) {
    mkInsert('(' + n + '/' + d + ')');
  }
}

// Attach math keyboard to math-input elements
document.addEventListener('DOMContentLoaded', () => {
  // Inputs that should use math keyboard
  const mathInputIds = ['eqInput', 'fnInput', 'ptX', 'ptY', 'vtplCustomInput', 'xMin','xMax','yMin','yMax','gridStep','scaleInput','tblXFrom','tblXTo','tblXStep'];
  mathInputIds.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.setAttribute('inputmode', 'none');
    el.setAttribute('autocomplete', 'off');
    el.addEventListener('focus', () => openMathKbd(el));
    el.addEventListener('click', () => openMathKbd(el));
  });
  // Also fraction number inputs
  ['fn1','fd1','fn2','fd2'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.setAttribute('inputmode', 'none');
    el.addEventListener('focus', () => openMathKbd(el));
    el.addEventListener('click', () => openMathKbd(el));
  });
  // Unit converter value
  const ucv = document.getElementById('ucValue');
  if (ucv) {
    ucv.setAttribute('inputmode', 'none');
    ucv.addEventListener('focus', () => openMathKbd(ucv));
    ucv.addEventListener('click', () => openMathKbd(ucv));
  }
  // Point name input: ensure kpanel is open and scroll into view above native keyboard
  const ptNameEl = document.getElementById('ptName');
  if (ptNameEl) {
    ptNameEl.addEventListener('focus', () => {
      clearTimeout(_ptKbdTimer);
      const kpanel = document.getElementById('kpanel');
      if (kpanel) openPanelForInput();
      _setPointKbdPadding(true);
      setTimeout(() => { ptNameEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 300);
    });
    ptNameEl.addEventListener('blur', () => {
      // Defer removal so switching between point fields doesn't flicker
      _ptKbdTimer = setTimeout(() => {
        if (!_mkTarget || !_pointInputIds.includes(_mkTarget.id)) {
          _setPointKbdPadding(false);
        }
      }, 150);
    });
  }
});

/* ══════════════════════════════════════════════
   PHYSICAL RULER
══════════════════════════════════════════════ */
const physRulerState = {
  active: false,
  x: 60, y: 120,    // position (left, top) inside tabKoord
  angle: 0,          // degrees
  len: 280,
  dragging: false,
  rotating: false,
  startX: 0, startY: 0,
  startAngle: 0
};

function togglePhysRuler() {
  physRulerState.active = !physRulerState.active;
  const el = document.getElementById('physRuler');
  const btn = document.getElementById('physRulerBtn');
  el.style.display = physRulerState.active ? 'block' : 'none';
  if (physRulerState.active) {
    el.classList.add('active');
    // Position in centre of canvas initially
    const cont = document.getElementById('tabKoord');
    const r = cont.getBoundingClientRect();
    physRulerState.x = r.width / 2 - physRulerState.len / 2;
    physRulerState.y = r.height / 2;
    physRulerState.angle = 0;
    renderPhysRuler();
    btn.classList.add('act');
  } else {
    el.classList.remove('active');
    btn.classList.remove('act');
  }
}

function renderPhysRuler() {
  const el = document.getElementById('physRuler');
  const cvs = document.getElementById('physRulerCanvas');
  const L = physRulerState.len;
  const H = 28;
  const dpr = window.devicePixelRatio || 1;
  cvs.width = L * dpr; cvs.height = H * dpr;
  cvs.style.width = L + 'px'; cvs.style.height = H + 'px';
  el.style.left = physRulerState.x + 'px';
  el.style.top = (physRulerState.y - H/2) + 'px';
  el.style.transform = 'rotate(' + physRulerState.angle + 'deg)';

  const ctx = cvs.getContext('2d');
  ctx.save(); ctx.scale(dpr, dpr);
  // Ruler body
  ctx.fillStyle = 'rgba(255,220,80,0.88)';
  ctx.strokeStyle = 'rgba(180,120,0,0.9)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  // roundRectCompat: draw rounded rect with fallback for older browsers
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(0, 0, L, H, 4);
  } else {
    const r = 4;
    ctx.moveTo(r, 0); ctx.lineTo(L-r, 0); ctx.arcTo(L, 0, L, r, r);
    ctx.lineTo(L, H-r); ctx.arcTo(L, H, L-r, H, r);
    ctx.lineTo(r, H); ctx.arcTo(0, H, 0, H-r, r);
    ctx.lineTo(0, r); ctx.arcTo(0, 0, r, 0, r);
    ctx.closePath();
  }
  ctx.fill(); ctx.stroke();

  // Tick marks every 10px (representing 1 grid unit equivalent)
  ctx.strokeStyle = 'rgba(100,60,0,0.8)';
  ctx.fillStyle = 'rgba(100,60,0,0.9)';
  ctx.font = '7px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  for (let i = 0; i <= L; i += 10) {
    const isMajor = i % 50 === 0;
    const isMid   = i % 25 === 0 && !isMajor;
    const tickH = isMajor ? 12 : isMid ? 9 : 5;
    ctx.lineWidth = isMajor ? 1.2 : 0.8;
    ctx.beginPath(); ctx.moveTo(i, H - tickH); ctx.lineTo(i, H); ctx.stroke();
    if (isMajor && i > 0 && i < L) ctx.fillText(String(i/10), i, H - 13);
  }
  // Edge ticks at top too
  for (let i = 0; i <= L; i += 10) {
    const isMajor = i % 50 === 0;
    const tickH = isMajor ? 8 : 4;
    ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, tickH); ctx.stroke();
  }
  ctx.restore();
}

function initPhysRulerDrag() {
  const handle = document.getElementById('physRulerHandle');
  const cvs = document.getElementById('physRulerCanvas');

  // Move ruler by dragging the handle
  handle.addEventListener('pointerdown', e => {
    e.stopPropagation(); e.preventDefault();
    physRulerState.dragging = true;
    physRulerState.startX = e.clientX - physRulerState.x;
    physRulerState.startY = e.clientY - physRulerState.y;
    handle.setPointerCapture(e.pointerId);
  });
  handle.addEventListener('pointermove', e => {
    if (!physRulerState.dragging) return;
    physRulerState.x = e.clientX - physRulerState.startX;
    physRulerState.y = e.clientY - physRulerState.startY;
    renderPhysRuler();
  });
  handle.addEventListener('pointerup', () => { physRulerState.dragging = false; });

  // Rotate ruler by dragging the ruler body
  cvs.addEventListener('pointerdown', e => {
    e.stopPropagation(); e.preventDefault();
    const el = document.getElementById('physRuler');
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width/2, cy = r.top + r.height/2;
    physRulerState.rotating = true;
    physRulerState.startAngle = physRulerState.angle - Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI;
    cvs.setPointerCapture(e.pointerId);
  });
  cvs.addEventListener('pointermove', e => {
    if (!physRulerState.rotating) return;
    const el = document.getElementById('physRuler');
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width/2, cy = r.top + r.height/2;
    physRulerState.angle = physRulerState.startAngle + Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI;
    renderPhysRuler();
  });
  cvs.addEventListener('pointerup', () => { physRulerState.rotating = false; });
}

/* ══════════════════════════════════════════════
   CONNECTOR DOTS TOGGLE
══════════════════════════════════════════════ */
coord.showConnectorDots = true;

function toggleConnectorDots() {
  coord.showConnectorDots = !coord.showConnectorDots;
  document.getElementById('togConnDots').classList.toggle('active', coord.showConnectorDots);
  drawCanvas();
}

/* ══════════════════════════════════════════════
   SIDEBAR TIMER
══════════════════════════════════════════════ */
const sdTimer = { total: 0, remaining: 0, running: false, interval: null };

function sdTimerSetPreset(minutes) {
  sdTimerReset();
  document.getElementById('sdTimerMin').value = minutes;
  document.getElementById('sdTimerSec').value = 0;
  sdTimer.total = minutes * 60;
  sdTimer.remaining = sdTimer.total;
  sdTimerUpdateDisplay();
}

function sdTimerToggle() {
  if (sdTimer.running) {
    sdTimerPause();
  } else {
    sdTimerStart();
  }
}

function sdTimerStart() {
  if (sdTimer.remaining <= 0) {
    const m = parseInt(document.getElementById('sdTimerMin').value) || 0;
    const s = parseInt(document.getElementById('sdTimerSec').value) || 0;
    sdTimer.total = m * 60 + s;
    sdTimer.remaining = sdTimer.total;
  }
  if (sdTimer.total <= 0) return;
  sdTimer.running = true;
  document.getElementById('sdTimerStartBtn').textContent = '⏸ Pause';
  document.getElementById('sdTimerStartBtn').classList.replace('start','pause');
  sdTimer.interval = setInterval(() => {
    sdTimer.remaining--;
    sdTimerUpdateDisplay();
    if (sdTimer.remaining <= 0) {
      clearInterval(sdTimer.interval);
      sdTimer.running = false;
      timerAlarm('sd');
    }
  }, 1000);
}

function sdTimerPause() {
  clearInterval(sdTimer.interval);
  sdTimer.running = false;
  document.getElementById('sdTimerStartBtn').textContent = '▶ Weiter';
  document.getElementById('sdTimerStartBtn').classList.replace('pause','start');
}

function sdTimerReset() {
  clearInterval(sdTimer.interval);
  sdTimer.running = false;
  const m = parseInt(document.getElementById('sdTimerMin').value) || 0;
  const s = parseInt(document.getElementById('sdTimerSec').value) || 0;
  sdTimer.total = m * 60 + s;
  sdTimer.remaining = sdTimer.total;
  document.getElementById('sdTimerStartBtn').textContent = '▶ Start';
  document.getElementById('sdTimerStartBtn').classList.remove('pause');
  document.getElementById('sdTimerStartBtn').classList.add('start');
  sdTimerUpdateDisplay();
}

function sdTimerUpdateDisplay() {
  const m = Math.floor(sdTimer.remaining / 60);
  const s = sdTimer.remaining % 60;
  const disp = document.getElementById('sdTimerDisplay');
  const fill = document.getElementById('sdTimerFill');
  const lbl = document.getElementById('sdTimerLabel');
  disp.textContent = String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
  disp.className = 'timer-display';
  if (sdTimer.running) {
    if (sdTimer.remaining <= 60) { disp.classList.add('warning'); lbl.textContent = 'Fast vorbei!'; }
    else { disp.classList.add('running'); lbl.textContent = 'Läuft…'; }
  } else if (sdTimer.remaining <= 0 && sdTimer.total > 0) {
    disp.classList.add('done'); lbl.textContent = 'Zeit abgelaufen!';
  } else {
    lbl.textContent = 'Bereit';
  }
  const pct = sdTimer.total > 0 ? (sdTimer.remaining / sdTimer.total) * 100 : 100;
  if (fill) fill.style.width = pct + '%';
}

/* ══════════════════════════════════════════════
   FLOATING TIMER
══════════════════════════════════════════════ */
const ftTimer = { total: 0, remaining: 0, running: false, interval: null };

function openFloatingTimer() {
  const el = document.getElementById('floatingTimer');
  el.classList.add('visible');
  ftTimerUpdateDisplay();
}

function closeFloatingTimer() {
  document.getElementById('floatingTimer').classList.remove('visible');
}

function ftTimerSetPreset(minutes) {
  ftTimerReset();
  document.getElementById('ftTimerMin').value = minutes;
  document.getElementById('ftTimerSec').value = 0;
  ftTimer.total = minutes * 60;
  ftTimer.remaining = ftTimer.total;
  ftTimerUpdateDisplay();
}

function ftTimerToggle() {
  if (ftTimer.running) { ftTimerPause(); } else { ftTimerStart(); }
}

function ftTimerStart() {
  if (ftTimer.remaining <= 0) {
    const m = parseInt(document.getElementById('ftTimerMin').value) || 0;
    const s = parseInt(document.getElementById('ftTimerSec').value) || 0;
    ftTimer.total = m * 60 + s;
    ftTimer.remaining = ftTimer.total;
  }
  if (ftTimer.total <= 0) return;
  ftTimer.running = true;
  document.getElementById('ftTimerStartBtn').textContent = '⏸ Pause';
  document.getElementById('ftTimerStartBtn').classList.replace('start','pause');
  ftTimer.interval = setInterval(() => {
    ftTimer.remaining--;
    ftTimerUpdateDisplay();
    if (ftTimer.remaining <= 0) {
      clearInterval(ftTimer.interval);
      ftTimer.running = false;
      timerAlarm('ft');
    }
  }, 1000);
}

function ftTimerPause() {
  clearInterval(ftTimer.interval);
  ftTimer.running = false;
  document.getElementById('ftTimerStartBtn').textContent = '▶ Weiter';
  document.getElementById('ftTimerStartBtn').classList.replace('pause','start');
}

function ftTimerReset() {
  clearInterval(ftTimer.interval);
  ftTimer.running = false;
  const m = parseInt(document.getElementById('ftTimerMin').value) || 0;
  const s = parseInt(document.getElementById('ftTimerSec').value) || 0;
  ftTimer.total = m * 60 + s;
  ftTimer.remaining = ftTimer.total;
  document.getElementById('ftTimerStartBtn').textContent = '▶ Start';
  document.getElementById('ftTimerStartBtn').classList.remove('pause');
  document.getElementById('ftTimerStartBtn').classList.add('start');
  ftTimerUpdateDisplay();
}

function ftTimerUpdateDisplay() {
  const m = Math.floor(ftTimer.remaining / 60);
  const s = ftTimer.remaining % 60;
  const disp = document.getElementById('ftTimerDisplay');
  const fill = document.getElementById('ftTimerFill');
  const lbl = document.getElementById('ftTimerLabel');
  disp.textContent = String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
  disp.className = 'timer-display';
  if (ftTimer.running) {
    if (ftTimer.remaining <= 60) { disp.classList.add('warning'); lbl.textContent = 'Fast vorbei!'; }
    else { disp.classList.add('running'); lbl.textContent = 'Läuft…'; }
  } else if (ftTimer.remaining <= 0 && ftTimer.total > 0) {
    disp.classList.add('done'); lbl.textContent = 'Zeit abgelaufen!';
  } else {
    lbl.textContent = 'Bereit';
  }
  const pct = ftTimer.total > 0 ? (ftTimer.remaining / ftTimer.total) * 100 : 100;
  if (fill) fill.style.width = pct + '%';
}

function timerAlarm(prefix) {
  // Visual alarm
  const disp = document.getElementById((prefix === 'sd' ? 'sd' : 'ft') + 'TimerDisplay');
  if (!disp) return;
  disp.classList.add('done');
  let blinks = 0;
  const blink = setInterval(() => {
    disp.style.opacity = disp.style.opacity === '0.3' ? '1' : '0.3';
    blinks++;
    if (blinks > 10) { clearInterval(blink); disp.style.opacity = '1'; }
  }, 300);
  // Audio alarm
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 200, 400].forEach(delay => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.4, ctx.currentTime + delay/1000);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay/1000 + 0.4);
      osc.start(ctx.currentTime + delay/1000);
      osc.stop(ctx.currentTime + delay/1000 + 0.4);
    });
  } catch(e) {}
}

/* ══════════════════════════════════════════════
   FLOATING MINI CALCULATOR
══════════════════════════════════════════════ */
const fmc = { expr: '', result: '0' };

function openFloatingCalc() {
  document.getElementById('floatingCalc').classList.add('visible');
}

function closeFloatingCalc() {
  document.getElementById('floatingCalc').classList.remove('visible');
}

function fmcInput(ch) {
  if (ch === 'AC') { fmc.expr = ''; fmc.result = '0'; updateFmcDisplay(); return; }
  if (ch === '⌫') {
    fmc.expr = fmc.expr.slice(0,-1);
    try { fmc.result = fmc.expr ? String(evalSafe(fmc.expr.replace(/÷/g,'/').replace(/×/g,'*'))) : '0'; } catch { fmc.result = '...'; }
    updateFmcDisplay(); return;
  }
  if (ch === '=') {
    try {
      const expr = fmc.expr.replace(/÷/g,'/').replace(/×/g,'*').replace(/−/g,'-');
      fmc.result = formatNum(evalSafe(expr));
      fmc.expr = fmc.result === 'Fehler' ? '' : fmc.result;
    } catch { fmc.result = 'Fehler'; fmc.expr = ''; }
    updateFmcDisplay(); return;
  }
  if (ch === '%') {
    try { fmc.expr = String(evalSafe(fmc.expr.replace(/÷/g,'/').replace(/×/g,'*')) / 100); } catch {}
    updateFmcDisplay(); return;
  }
  fmc.expr += ch;
  try { fmc.result = String(evalSafe(fmc.expr.replace(/÷/g,'/').replace(/×/g,'*').replace(/−/g,'-'))); } catch { fmc.result = '...'; }
  updateFmcDisplay();
}

function updateFmcDisplay() {
  const ex = document.getElementById('fmcExpr');
  const rs = document.getElementById('fmcRes');
  if (ex) ex.textContent = fmc.expr;
  if (rs) rs.textContent = fmc.result;
}

/* ══════════════════════════════════════════════
   DRAGGABLE + RESIZABLE FLOATING WIDGETS
══════════════════════════════════════════════ */
function initFloatingDrag(widgetId, handleId) {
  const widget = document.getElementById(widgetId);
  const handle = document.getElementById(handleId);
  if (!widget || !handle) return;
  let startX, startY, startLeft, startTop;

  function onMove(e) {
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    let newLeft = startLeft + cx - startX;
    let newTop  = startTop  + cy - startY;
    // Clamp to viewport
    newLeft = Math.max(0, Math.min(window.innerWidth  - widget.offsetWidth,  newLeft));
    newTop  = Math.max(0, Math.min(window.innerHeight - widget.offsetHeight, newTop));
    widget.style.left      = newLeft + 'px';
    widget.style.top       = newTop  + 'px';
    widget.style.transform = 'none';
    widget.style.right     = 'auto';
  }
  function onEnd() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup',   onEnd);
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend',  onEnd);
  }
  handle.addEventListener('mousedown', e => {
    if (e.target.closest('.fw-close')) return;
    startX = e.clientX; startY = e.clientY;
    const rect = widget.getBoundingClientRect();
    startLeft = rect.left; startTop = rect.top;
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onEnd);
    e.preventDefault();
  });
  handle.addEventListener('touchstart', e => {
    if (e.target.closest('.fw-close')) return;
    startX = e.touches[0].clientX; startY = e.touches[0].clientY;
    const rect = widget.getBoundingClientRect();
    startLeft = rect.left; startTop = rect.top;
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend',  onEnd);
    e.preventDefault();
  }, { passive: false });
}

/* ══════════════════════════════════════════════
   HANDBUCH (HANDBOOK)
══════════════════════════════════════════════ */
const GLOSSAR = {
  'Ausdruck':           'Ein mathematischer Ausdruck ist eine Kombination aus Zahlen, Variablen und Rechenzeichen, z.B. 2x+3 oder sin(π/2).',
  'Trigonometrie':      'Die Trigonometrie befasst sich mit den Winkeln und Seiten von Dreiecken. Wichtige Funktionen: Sinus, Kosinus, Tangens.',
  'Addition':           'Addition bedeutet das Zusammenzählen von Zahlen. Zeichen: +. Beispiel: 3+5=8.',
  'Subtraktion':        'Subtraktion ist das Abziehen einer Zahl von einer anderen. Zeichen: −. Beispiel: 8−3=5.',
  'Multiplikation':     'Multiplikation ist das wiederholte Addieren einer Zahl. Zeichen: ×. Beispiel: 4×3=12.',
  'Division':           'Division teilt eine Zahl durch eine andere. Zeichen: ÷. Beispiel: 12÷4=3.',
  'Sinus':              'Der Sinus (sin) eines Winkels im rechtwinkligen Dreieck ist das Verhältnis Gegenkathete zu Hypotenuse. Beispiel: sin(30°)=0,5.',
  'Kosinus':            'Der Kosinus (cos) eines Winkels ist das Verhältnis Ankathete zu Hypotenuse. Beispiel: cos(60°)=0,5.',
  'Tangens':            'Der Tangens (tan) eines Winkels ist das Verhältnis Gegenkathete zu Ankathete. tan = sin/cos.',
  'Logarithmus':        'Der Logarithmus log(x) gibt an, mit welcher Potenz man die Basis erheben muss, um x zu erhalten. log₁₀(100)=2.',
  'Wurzel':             'Die Wurzel √x ist die Zahl, die mit sich selbst multipliziert x ergibt. Beispiel: √9=3.',
  'Potenz':             'Eine Potenz aⁿ bedeutet, dass a n-mal mit sich selbst multipliziert wird. Beispiel: 2³=8.',
  'Grad':               'Grad (°) ist eine Einheit für Winkel. Ein voller Kreis = 360°.',
  'Bogenmass':          'Das Bogenmass (rad) ist eine Einheit für Winkel. 180° entspricht π rad ≈ 3,14159 rad.',
  'LineareGleichung':   'Eine lineare Gleichung hat die Form ax+b=c. Die Lösung ist x=(c−b)/a. Beispiel: 2x+3=7 → x=2.',
  'QuadratischeGleichung': 'Eine quadratische Gleichung hat die Form ax²+bx+c=0. Die Lösungen werden mit der Lösungsformel berechnet: x=(−b±√(b²−4ac))/(2a).',
  'Bruch':              'Ein Bruch stellt einen Teil eines Ganzen dar. Format: Zähler/Nenner. Beispiel: 3/4 bedeutet 3 von 4 Teilen.',
  'Zaehler':            'Der Zähler ist die Zahl oberhalb des Bruchstrichs. Er gibt an, wie viele Teile gemeint sind.',
  'Nenner':             'Der Nenner ist die Zahl unterhalb des Bruchstrichs. Er gibt an, in wie viele Teile das Ganze aufgeteilt ist.',
  'Kuerzen':            'Kürzen bedeutet, Zähler und Nenner eines Bruchs durch den gleichen Wert zu teilen. Beispiel: 4/6 → 2/3.',
  'KartesischesKS':     'Das kartesische Koordinatensystem hat zwei senkrechte Achsen (x und y). Jeder Punkt wird durch ein Zahlenpaar (x,y) beschrieben.',
  'Tippen':             'Im Tipp-Modus setzt du durch Antippen der Zeichenfläche einen Punkt an der geklickten Stelle.',
  'QuadratischeFormel': 'Die Lösungsformel für quadratische Gleichungen: x = (−b ± √(b²−4ac)) / (2a). Auch „abc-Formel" genannt.',
  'BinomischeFormeln':  'Binomische Formeln sind Kurzformeln für quadratische Ausdrücke: (a+b)²=a²+2ab+b², (a−b)²=a²−2ab+b², (a+b)(a−b)=a²−b².',
  'Steigung':           'Die Steigung m einer Geraden gibt an, wie stark sie ansteigt. m=(y₂−y₁)/(x₂−x₁). Positive m = aufsteigend, negative m = absteigend.',
  'Statistik':          'Die Statistik beschäftigt sich mit dem Sammeln, Auswerten und Darstellen von Daten.',
  'Varianz':            'Die Varianz σ² ist ein Maß für die Streuung von Daten um den Mittelwert. σ²=Σ(xᵢ−x̄)²/n.',
  'Standardabweichung': 'Die Standardabweichung σ ist die Wurzel der Varianz. Sie gibt an, wie stark die Daten vom Mittelwert abweichen.',
  'Zahlentheorie':      'Die Zahlentheorie untersucht Eigenschaften ganzer Zahlen, z.B. Teilbarkeit, Primzahlen, ggT und kgV.',
  'Pythagoras':         'Der Satz des Pythagoras: In einem rechtwinkligen Dreieck gilt a²+b²=c². c ist die Hypotenuse (längste Seite).',
  'Prozentrechnung':    'Prozentrechnung bestimmt Anteile. 1% = 1/100. Prozentwert = Grundwert × Prozentsatz / 100.',
  'Zinsrechnung':       'Zinsrechnung berechnet Zinsen für Kapital. Einfach: Z=K×p/100×t. Zinseszins: A=K×(1+p/100)ᵗ.',
  'BMI':                'BMI (Body-Mass-Index) berechnet das Verhältnis von Körpergewicht zu Körpergröße². BMI=Gewicht(kg)/Größe(m)².',
  'OhmschesGesetz':     'Das Ohmsche Gesetz beschreibt den Zusammenhang zwischen Spannung U (V), Widerstand R (Ω) und Stromstärke I (A): U=R×I.',
  'Kraft':              'Kraft F=m×a. F in Newton (N), m ist Masse (kg), a ist Beschleunigung (m/s²).',
  'kinetischeEnergie':  'Kinetische Energie ist die Energie einer Bewegung. Ekin=½×m×v². Einheit: Joule (J).',
  'potentielleEnergie': 'Potentielle Energie ist gespeicherte Lageenergie. Epot=m×g×h. g≈9,81 m/s², h ist die Höhe.',
  'Countdown':          'Ein Countdown zählt von einer eingestellten Zeit rückwärts bis auf null.',
  'Fachbegriff':        'Ein Fachbegriff ist ein spezifisches Wort aus einem bestimmten Wissensgebiet. In diesem Handbuch werden schwierige Fachbegriffe blau hervorgehoben.',
};

let hbInited = false;

function initHandbuch() {
  if (hbInited) return;
  hbInited = true;
  // Build glossar list
  const list = document.getElementById('hbGlossarList');
  if (list) {
    list.innerHTML = Object.entries(GLOSSAR).sort((a,b)=>a[0].localeCompare(b[0])).map(([term, def]) =>
      `<div class="hb-fn"><div class="hb-fn-name" style="color:#0055cc">📌 ${term}</div><div class="hb-fn-desc">${def}</div></div>`
    ).join('');
  }
  // Setup glossary tooltips for handbook hard words
  document.querySelectorAll('.hw').forEach(el => {
    el.addEventListener('click', e => { showGlossary(e, el.dataset.term); e.stopPropagation(); });
  });
}

function showGlossary(e, term) {
  const tip = document.getElementById('glossaryTooltip');
  const def = GLOSSAR[term];
  if (!def) return;
  document.getElementById('gtTerm').textContent = term;
  document.getElementById('gtDef').textContent = def;
  tip.style.display = 'block';
  const x = Math.min(e.clientX + 8, window.innerWidth - 290);
  const y = Math.min(e.clientY + 8, window.innerHeight - tip.offsetHeight - 10);
  tip.style.left = x + 'px';
  tip.style.top  = Math.max(10, y) + 'px';
}

function hbFilter() {
  const q = document.getElementById('hbSearch').value.toLowerCase().trim();
  document.querySelectorAll('#hbContent .hb-fn').forEach(el => {
    el.style.display = (!q || el.textContent.toLowerCase().includes(q)) ? '' : 'none';
  });
  document.querySelectorAll('#hbContent .hb-section').forEach(sec => {
    const visible = [...sec.querySelectorAll('.hb-fn')].some(e => e.style.display !== 'none');
    sec.style.display = visible ? '' : 'none';
  });
}

function hbScrollTo(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Init drag/glossary tooltips after DOM ready
window.addEventListener('load', () => {
  setTimeout(() => {
    initFloatingDrag('floatingTimer', 'floatingTimerHandle');
    initFloatingDrag('floatingCalc', 'floatingCalcHandle');
    document.addEventListener('click', () => {
      const tip = document.getElementById('glossaryTooltip');
      if (tip) tip.style.display = 'none';
    });
    document.querySelectorAll('.hw').forEach(el => {
      el.addEventListener('click', e => { showGlossary(e, el.dataset.term); e.stopPropagation(); });
    });
    renderMkVarBtns();
  }, 500);
});

/* ══════════════════════════════════════════════
   KEYBOARD VARIABLES
══════════════════════════════════════════════ */
// kbVars: array of {name, value}
const kbVars = [
  { name: 'x', value: 0 },
  { name: 'y', value: 0 }
];

function openVarPicker() {
  renderVarPickerList();
  document.getElementById('varPicker').style.transform = 'translateY(0)';
}

function closeVarPicker() {
  document.getElementById('varPicker').style.transform = 'translateY(100%)';
}

function addKbVar() {
  const nameEl = document.getElementById('varPickerName');
  const valEl  = document.getElementById('varPickerVal');
  const name = nameEl.value.trim();
  const value = parseFloat(valEl.value);
  // Validate: only alphanumeric+underscore, starting with letter, not a reserved/function name
  const blocked = ['sin','cos','tan','asin','acos','atan','sqrt','log','ln','exp','pi','true','false','return'];
  if (!name || !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name) || blocked.includes(name.toLowerCase())) {
    nameEl.style.borderColor = '#cc0000';
    setTimeout(() => nameEl.style.borderColor = '#3a3a6a', 1000);
    return;
  }
  if (isNaN(value)) {
    valEl.style.borderColor = '#cc0000';
    setTimeout(() => valEl.style.borderColor = '#3a3a6a', 1000);
    return;
  }
  const existing = kbVars.find(v => v.name === name);
  if (existing) { existing.value = value; }
  else { kbVars.push({ name, value }); }
  // Sync x/y back to calcVars
  kbVars.forEach(v => {
    if (v.name === 'x' && typeof calcVars !== 'undefined') {
      calcVars.x = v.value;
      const el = document.getElementById('calcVarX');
      if (el) el.value = v.value;
    }
    if (v.name === 'y' && typeof calcVars !== 'undefined') {
      calcVars.y = v.value;
      const el = document.getElementById('calcVarY');
      if (el) el.value = v.value;
    }
  });
  nameEl.value = '';
  valEl.value  = '';
  renderVarPickerList();
  renderMkVarBtns();
}

function deleteKbVar(name) {
  const idx = kbVars.findIndex(v => v.name === name);
  if (idx !== -1) kbVars.splice(idx, 1);
  renderVarPickerList();
  renderMkVarBtns();
}

function renderVarPickerList() {
  const list = document.getElementById('varPickerList');
  if (!list) return;
  if (kbVars.length === 0) {
    list.innerHTML = '<div style="color:#666;font-size:13px;text-align:center">Noch keine Variablen definiert</div>';
    return;
  }
  list.innerHTML = kbVars.map((v, i) =>
    `<div style="display:flex;align-items:center;gap:8px;background:#2a2a4a;border-radius:0;padding:8px 12px">
      <span style="font-weight:700;color:#fff;font-size:15px;min-width:40px">${escHtml(v.name)}</span>
      <span style="color:#888">=</span>
      <input type="number" value="${v.value}" step="any" data-varidx="${i}"
        style="flex:1;background:#1a1a2e;border:1px solid #3a3a6a;border-radius:0;color:#fff;font-size:14px;padding:5px 8px;outline:none;font-family:inherit"
        class="vp-val-input">
      <button data-insert-var="${i}"
        style="background:#00885a;border:none;border-radius:0;color:#fff;font-size:12px;font-weight:700;padding:5px 8px;cursor:pointer;font-family:inherit">Einfügen</button>
      <button data-delete-var="${i}"
        style="background:#cc0000;border:none;border-radius:0;color:#fff;font-size:12px;font-weight:700;padding:5px 8px;cursor:pointer;font-family:inherit">✕</button>
    </div>`
  ).join('');
  // Attach event listeners
  list.querySelectorAll('.vp-val-input').forEach(inp => {
    inp.addEventListener('input', () => {
      const idx = parseInt(inp.dataset.varidx, 10);
      if (!isNaN(idx) && kbVars[idx]) updateKbVar(kbVars[idx].name, inp.value);
    });
  });
  list.querySelectorAll('[data-insert-var]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.insertVar, 10);
      if (!isNaN(idx) && kbVars[idx]) mkInsert(kbVars[idx].name);
    });
  });
  list.querySelectorAll('[data-delete-var]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.deleteVar, 10);
      if (!isNaN(idx) && kbVars[idx]) deleteKbVar(kbVars[idx].name);
    });
  });
}

function updateKbVar(name, rawVal) {
  const value = parseFloat(rawVal);
  if (isNaN(value)) return;
  const v = kbVars.find(v => v.name === name);
  if (v) v.value = value;
  // Keep calcVars in sync
  if (name === 'x' && typeof calcVars !== 'undefined') {
    calcVars.x = value;
    const el = document.getElementById('calcVarX');
    if (el) el.value = value;
  }
  if (name === 'y' && typeof calcVars !== 'undefined') {
    calcVars.y = value;
    const el = document.getElementById('calcVarY');
    if (el) el.value = value;
  }
  renderMkVarBtns();
}

function renderMkVarBtns() {
  const container = document.getElementById('mkVarBtns');
  if (!container) return;
  container.innerHTML = kbVars.map((v, i) =>
    `<button class="mk" data-insert-var="${i}" style="background:#2244aa;font-size:13px;font-weight:700;max-width:60px" title="${escHtml(v.name)} = ${v.value}">${escHtml(v.name)}</button>`
  ).join('');
  container.querySelectorAll('[data-insert-var]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.insertVar, 10);
      if (!isNaN(idx) && kbVars[idx]) mkInsert(kbVars[idx].name);
    });
  });
}

// kbVars initialization is complete above

/* ══════════════════════════════════════════════
   PREMIUM / PRO SYSTEM
══════════════════════════════════════════════ */
const PRO_CODE = 'Kostenlos123';
const PRO_KEY  = 'mathspaces_pro';
const AGENT_MAX_FREE = 5;
const AGENT_MAX_PRO  = 50;

function isPremium() {
  try { return localStorage.getItem(PRO_KEY) === '1'; } catch(e) { return false; }
}

function setPremium(val) {
  try { localStorage.setItem(PRO_KEY, val ? '1' : '0'); } catch(e) {}
}

function agentGetMax() {
  return isPremium() ? AGENT_MAX_PRO : AGENT_MAX_FREE;
}

// ── Premium modal ──────────────────────────────
function showPremiumModal(reason) {
  if (reason) document.getElementById('premiumSubText').textContent = reason;
  else document.getElementById('premiumSubText').textContent = 'Schalte alle Pro-Features frei';
  // Update benefit description with actual pro limit
  const desc = document.getElementById('premBenefitAgentDesc');
  if (desc) desc.textContent = 'Löse beliebig viele Aufgaben auf einmal (bis zu ' + AGENT_MAX_PRO + ')';
  document.getElementById('premiumOverlay').classList.add('open');
}

function hidePremiumModal() {
  document.getElementById('premiumOverlay').classList.remove('open');
}

// ── Activation modal ──────────────────────────
function showActivateModal() {
  hidePremiumModal();
  document.getElementById('activateCodeInput').value = '';
  document.getElementById('activateError').textContent = '';
  document.getElementById('activateOverlay').classList.add('open');
  setTimeout(() => document.getElementById('activateCodeInput').focus(), 200);
}

function hideActivateModal() {
  document.getElementById('activateOverlay').classList.remove('open');
}

// Close modals on Escape key
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (document.getElementById('licenseGate').classList.contains('open')) { closeLicenseGate(); }
    else if (document.getElementById('activateOverlay').classList.contains('open')) { hideActivateModal(); }
    else if (document.getElementById('premiumOverlay').classList.contains('open')) { hidePremiumModal(); }
    else if (document.getElementById('model3dOverlay').classList.contains('open')) { close3DModel(); }
  }
});

function activatePro() {
  const code = document.getElementById('activateCodeInput').value.trim();
  if (code === PRO_CODE) {
    setPremium(true);
    document.getElementById('activateOverlay').classList.remove('open');
    // Update agent counter to reflect new limit
    agentRenderTasks();
    showProWelcome();
  } else {
    document.getElementById('activateError').textContent = '❌ Ungültiger Code. Bitte versuche es erneut.';
    document.getElementById('activateCodeInput').select();
  }
}

function showProWelcome() {
  // Show a simple confirmation toast-style message
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#f5a623;color:#fff;padding:14px 22px;border-radius:0;font-size:15px;font-weight:700;z-index:13000;box-shadow:0 4px 20px rgba(0,0,0,.25);white-space:nowrap;';
  el.textContent = '🎉 MathSpaces Pro aktiviert!';
  document.body.appendChild(el);
  setTimeout(() => { el.style.transition = 'opacity .5s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 500); }, 2800);
}

/* ══════════════════════════════════════════════
   3D MODEL VIEWER
══════════════════════════════════════════════ */
let _3dModel = null;
let _3dAnimFrame = null;
let _3dRotX = 0.4;
let _3dRotY = 0.5;
let _3dDragActive = false;
let _3dDragLast = { x: 0, y: 0 };

const _3dModels = {
  paraboloid: { title: 'Paraboloid – z = x² + y²', fn: (x,y) => x*x + y*y, range: 3, zScale: 0.5 },
  saddle:     { title: 'Sattelfläche – z = x² − y²', fn: (x,y) => x*x - y*y, range: 3, zScale: 0.5 },
  cone:       { title: 'Kegel – z = √(x²+y²)', fn: (x,y) => Math.sqrt(x*x+y*y), range: 3, zScale: 0.5 },
  sincos:     { title: 'Sinus-Fläche – z = sin(x)·cos(y)', fn: (x,y) => Math.sin(x)*Math.cos(y), range: Math.PI*1.5, zScale: 1.2 },
  plane:      { title: 'Ebene – z = x + y', fn: (x,y) => x+y, range: 3, zScale: 0.4 }
};

function open3DModel(modelKey) {
  if (!isPremium()) {
    showPremiumModal('3D-Modelle sind ein Pro-Feature. Schalte sie jetzt frei!');
    return;
  }
  const m = _3dModels[modelKey];
  if (!m) return;
  _3dModel = m;
  _3dRotX = 0.4; _3dRotY = 0.5;
  document.getElementById('model3dTitle').textContent = m.title;
  document.getElementById('model3dOverlay').classList.add('open');
  requestAnimationFrame(_3dStart);
}

function close3DModel() {
  document.getElementById('model3dOverlay').classList.remove('open');
  if (_3dAnimFrame) { cancelAnimationFrame(_3dAnimFrame); _3dAnimFrame = null; }
}

function _3dStart() {
  const cvs = document.getElementById('model3dCanvas');
  const overlay = document.getElementById('model3dOverlay');
  cvs.width  = overlay.clientWidth;
  cvs.height = overlay.clientHeight - 52 - 32; // minus bar and hint
  _3dDraw();

  // Drag handlers
  cvs.onmousedown = e => { _3dDragActive = true; _3dDragLast = { x: e.clientX, y: e.clientY }; };
  cvs.onmousemove = e => {
    if (!_3dDragActive) return;
    _3dRotY += (e.clientX - _3dDragLast.x) * 0.01;
    _3dRotX += (e.clientY - _3dDragLast.y) * 0.01;
    _3dDragLast = { x: e.clientX, y: e.clientY };
    _3dDraw();
  };
  cvs.onmouseup = () => { _3dDragActive = false; };
  cvs.ontouchstart = e => { if (!e.touches || !e.touches.length) return; _3dDragActive = true; _3dDragLast = { x: e.touches[0].clientX, y: e.touches[0].clientY }; e.preventDefault(); };
  cvs.ontouchmove = e => {
    if (!_3dDragActive || !e.touches || !e.touches.length) return;
    _3dRotY += (e.touches[0].clientX - _3dDragLast.x) * 0.01;
    _3dRotX += (e.touches[0].clientY - _3dDragLast.y) * 0.01;
    _3dDragLast = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    _3dDraw();
    e.preventDefault();
  };
  cvs.ontouchend = () => { _3dDragActive = false; };
}

function _3dProject(x, y, z, cx, cy, scale) {
  // Rotate around Y axis then X axis
  const ry = _3dRotY, rx = _3dRotX;
  const x1 = x * Math.cos(ry) + z * Math.sin(ry);
  const z1 = -x * Math.sin(ry) + z * Math.cos(ry);
  const y1 = y * Math.cos(rx) - z1 * Math.sin(rx);
  const z2 = y * Math.sin(rx) + z1 * Math.cos(rx);
  // Simple perspective projection
  const fov = 4;
  const d = fov / (fov + z2 * 0.5);
  return { sx: cx + x1 * scale * d, sy: cy - y1 * scale * d, depth: z2 };
}

function _3dDraw() {
  if (!_3dModel) return;
  const cvs = document.getElementById('model3dCanvas');
  if (!cvs) return;
  const ctx = cvs.getContext('2d');
  const W = cvs.width, H = cvs.height;
  const cx = W / 2, cy = H / 2;
  const scale = Math.min(W, H) * 0.22;

  ctx.fillStyle = '#0a0a1a';
  ctx.fillRect(0, 0, W, H);

  const steps = 22;
  const range = _3dModel.range;
  const zs = _3dModel.zScale;
  const fn = _3dModel.fn;

  // Build grid of quads and sort by depth (painter's algorithm)
  const quads = [];
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < steps; j++) {
      const x0 = -range + (2*range/steps) * i,     y0 = -range + (2*range/steps) * j;
      const x1 = -range + (2*range/steps) * (i+1), y1 = -range + (2*range/steps) * (j+1);
      const z00 = fn(x0, y0) * zs, z10 = fn(x1, y0) * zs;
      const z01 = fn(x0, y1) * zs, z11 = fn(x1, y1) * zs;
      const p00 = _3dProject(x0, y0, z00, cx, cy, scale);
      const p10 = _3dProject(x1, y0, z10, cx, cy, scale);
      const p11 = _3dProject(x1, y1, z11, cx, cy, scale);
      const p01 = _3dProject(x0, y1, z01, cx, cy, scale);
      const avgDepth = (p00.depth + p10.depth + p11.depth + p01.depth) / 4;
      // Color based on z value
      const zAvg = (z00 + z10 + z01 + z11) / 4;
      const zMax = range * zs;
      const t = Math.max(0, Math.min(1, (zAvg + zMax) / (2 * zMax)));
      quads.push({ pts: [p00, p10, p11, p01], depth: avgDepth, t });
    }
  }
  // Sort back to front
  quads.sort((a, b) => a.depth - b.depth);

  // Draw quads
  quads.forEach(q => {
    const r = Math.round(30 + q.t * 80);
    const g = Math.round(60 + q.t * 140);
    const b = Math.round(180 - q.t * 80);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(q.pts[0].sx, q.pts[0].sy);
    q.pts.forEach(p => ctx.lineTo(p.sx, p.sy));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  });

  // Draw axes
  const origin = _3dProject(0, 0, 0, cx, cy, scale);
  const ax = _3dProject(range * 0.8, 0, 0, cx, cy, scale);
  const ay = _3dProject(0, range * 0.8, 0, cx, cy, scale);
  const az = _3dProject(0, 0, range * zs * 0.8, cx, cy, scale);
  [['x', ax, '#ff4444'], ['y', ay, '#44ff44'], ['z', az, '#4488ff']].forEach(([lbl, pt, col]) => {
    ctx.strokeStyle = col; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(origin.sx, origin.sy); ctx.lineTo(pt.sx, pt.sy); ctx.stroke();
    ctx.fillStyle = col; ctx.font = 'bold 13px sans-serif'; ctx.fillText(lbl, pt.sx + 5, pt.sy);
  });
}


function switchSettingsTab(id) {
  document.querySelectorAll('#tabSettings .spanel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('#tabSettings .stab').forEach(b => b.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  const tabs = ['settGeneral','settAdvanced','settLicenses'];
  const idx = tabs.indexOf(id);
  const stabs = document.querySelectorAll('#tabSettings .stab');
  if (idx >= 0 && stabs[idx]) stabs[idx].classList.add('active');
  if (id === 'settLicenses') renderLicenseSettings();
}

function toggleAdvancedMode(enabled) {
  localStorage.setItem('advancedMode', enabled ? '1' : '0');
  const advTabs = ['nbAgent', 'nbHandbuch'];
  advTabs.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = enabled ? '' : 'none';
  });
}

// ─── UI Layer Protocol ───
window._openOverlays = new Set();
const _overlayClosers = {
  'warnOverlay': () => { document.getElementById('warnOverlay').style.display='none'; },
  'fsMenu': () => { closeFsMenu(); },
  'premiumOverlay': () => { hidePremiumModal(); },
  'activateOverlay': () => { hideActivateModal(); },
  'model3dOverlay': () => { close3DModel(); },
  'fracPicker': () => { closeFracPicker(); },
  'varPicker': () => { closeVarPicker(); },
  'mathKbd': () => { typeof closeMathKbd === 'function' && closeMathKbd(); }
};
function openOverlay(id) {
  window._openOverlays.forEach(openId => {
    if (openId !== id && _overlayClosers[openId]) {
      try { _overlayClosers[openId](); } catch(e) { console.warn('Failed to close overlay:', openId, e); }
    }
  });
  window._openOverlays.add(id);
}
function closeOverlay(id) {
  window._openOverlays.delete(id);
}

function applyTheme(theme) {
  if (theme === 'dark') {
    document.documentElement.style.setProperty('--bg', '#111111');
    document.documentElement.style.setProperty('--bg2', '#1a1a1a');
    document.documentElement.style.setProperty('--card', '#222222');
    document.documentElement.style.setProperty('--btn', '#333333');
    document.documentElement.style.setProperty('--btn2', '#444444');
    document.documentElement.style.setProperty('--txt', '#eeeeee');
    document.documentElement.style.setProperty('--dim', '#aaaaaa');
    document.documentElement.style.setProperty('--bdr', '#444444');
  } else {
    document.documentElement.style.setProperty('--bg', '#ffffff');
    document.documentElement.style.setProperty('--bg2', '#f5f5f5');
    document.documentElement.style.setProperty('--card', '#eeeeee');
    document.documentElement.style.setProperty('--btn', '#e0e0e0');
    document.documentElement.style.setProperty('--btn2', '#d0d0d0');
    document.documentElement.style.setProperty('--txt', '#111111');
    document.documentElement.style.setProperty('--dim', '#555555');
    document.documentElement.style.setProperty('--bdr', '#cccccc');
  }
  localStorage.setItem('theme', theme);
}

function setAccentColor(color) {
  document.documentElement.style.setProperty('--acc', color);
  document.documentElement.style.setProperty('--acc2', color);
  document.documentElement.style.setProperty('--acc4', color);
  localStorage.setItem('accentColor', color);
}

/* ══════════════════════════════════════════════
   LICENSE KEY SYSTEM
══════════════════════════════════════════════ */
const LICENSE_SECRET  = 'MSK2025';       // Must match license-manager.html
const LIC_KEY_STORE   = 'ms_lic_key';    // stored key string
const LIC_DATA_STORE  = 'ms_lic_data';  // stored license info JSON
const LIC_CLASS_STORE = 'ms_lic_classes'; // teacher: class data JSON

// Supabase config – replace with your own Project URL and anon public key
const SUPA_URL = 'YOUR_SUPABASE_URL';
const SUPA_KEY = 'YOUR_SUPABASE_ANON_KEY';
// const SUPA_SERVICE_KEY = 'YOUR_SERVICE_ROLE_KEY'; // Server-side only – never in client code
// Lazily initialized so the CDN script (loaded with defer) is ready before first use
let _supabase = undefined;
function getSupabase() {
  if (_supabase === undefined) {
    _supabase = (window.supabase && SUPA_URL !== 'YOUR_SUPABASE_URL' && SUPA_KEY !== 'YOUR_SUPABASE_ANON_KEY')
      ? window.supabase.createClient(SUPA_URL, SUPA_KEY)
      : null;
  }
  return _supabase;
}

async function validateLicenseOnline(key) {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('licenses')
    .select('*')
    .eq('key', key.trim().toUpperCase())
    .single();
  if (error || !data) return null;
  if (data.revoked || data.locked) return null;
  return {
    type:         data.type,
    classId:      data.class_id,
    restrictions: data.restrictions || {},
    note:         data.note
  };
}

/* ── Key validation (offline checksum) ──────── */
function _lmHash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = Math.imul(h, 33) ^ str.charCodeAt(i);
  return Math.abs(h).toString(36).toUpperCase().padStart(4, '0').slice(0, 4);
}

/**
 * validateLicenseKey(key) → { type:'pro'|'teacher'|'student', classId, raw } | null
 */
function validateLicenseKey(key) {
  if (!key) return null;
  const parts = key.trim().toUpperCase().split('-');
  if (parts.length !== 4) return null;
  const [type, classId, random, checksum] = parts;
  if (!['PRO','TCH','STU'].includes(type)) return null;
  if (random.length < 4) return null;
  const expected = _lmHash(type + classId + random + LICENSE_SECRET);
  if (expected !== checksum) return null;
  return { type: type === 'PRO' ? 'pro' : type === 'TCH' ? 'teacher' : 'student', classId, raw: key.trim().toUpperCase() };
}

/* ── License storage ─────────────────────────── */
function getLicenseData() {
  try { return JSON.parse(localStorage.getItem(LIC_DATA_STORE) || 'null'); } catch { return null; }
}

function setLicenseData(data) {
  try {
    if (data) { localStorage.setItem(LIC_DATA_STORE, JSON.stringify(data)); localStorage.setItem(LIC_KEY_STORE, data.raw); }
    else { localStorage.removeItem(LIC_DATA_STORE); localStorage.removeItem(LIC_KEY_STORE); }
  } catch(e) {}
}

function getLicenseType() {
  const d = getLicenseData();
  return d ? d.type : 'free';
}

/* ── Check if key is revoked/locked (uses lm_keys stored by license-manager) ─── */
function checkKeyStatus(rawKey) {
  try {
    const keys = JSON.parse(localStorage.getItem('lm_keys') || '[]');
    const entry = keys.find(k => k.key === rawKey);
    if (!entry) return 'ok'; // not in manager = ok (manager on different device)
    if (entry.revoked) return 'revoked';
    if (entry.locked) return 'locked';
    return 'ok';
  } catch { return 'ok'; }
}

/* ── Real-time license watching via Supabase ─── */
let _currentKey     = null;
let _currentClassId = null;
let _licWatchChannels = [];

function applyRestrictions(restrictions) {
  const licData = getLicenseData();
  if (!licData) return;
  if (licData.type === 'student') {
    const allowed = Object.entries(restrictions || {})
      .filter(([, v]) => v !== false)
      .map(([k]) => k);
    const uses = allowed.length ? allowed : ['calc','koord','notizen','formeln','bild','agent'];
    applyPreferences('', uses);
  }
}

function _deactivateLicenseForced() {
  setLicenseData(null);
  deactivateTeacherMode();
  setPremium(false);
  applyLicense(null);
  renderLicenseSettings();
}

function stopLicenseWatch() {
  const supabase = getSupabase();
  if (supabase) _licWatchChannels.forEach(ch => { try { supabase.removeChannel(ch); } catch(e) { console.warn('License channel cleanup error:', e); } });
  _licWatchChannels = [];
  _currentKey = null;
  _currentClassId = null;
}

function startLicenseWatch(key, classId) {
  stopLicenseWatch();
  const supabase = getSupabase();
  if (!key || !supabase) return;
  _currentKey = key;
  _currentClassId = classId || null;

  // In der App: auf Änderungen am eigenen Key hören
  const licCh = supabase
    .channel('license-watch')
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'licenses',
      filter: `key=eq.${_currentKey}`
    }, payload => {
      if (payload.new.locked || payload.new.revoked) {
        _deactivateLicenseForced(); // lock the user out immediately
      }
      applyRestrictions(payload.new.restrictions);
    })
    .subscribe();
  _licWatchChannels.push(licCh);

  if (_currentClassId && _currentClassId !== '0000') {
    const clsCh = supabase
      .channel('class-watch')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'licenses',
        filter: `class_id=eq.${_currentClassId}&type=eq.teacher`
      }, payload => {
        applyRestrictions(payload.new.restrictions);
      })
      .subscribe();
    _licWatchChannels.push(clsCh);
  }
}

/* ── Apply license to app ─────────────────────── */
function applyLicense(licData) {
  setLicenseData(licData);
  const type = licData ? licData.type : 'free';

  if (type === 'free') {
    // Limited mode: only basic calculator
    setPremium(false);
    document.getElementById('limitedBanner').style.display = 'flex';
    // Keep only rechner, hide others
    const always = ['nbHandbuch', 'nbSettings'];
    Object.values(FEAT_NAV).forEach(navId => {
      const btn = document.getElementById(navId);
      if (btn) btn.style.display = navId === 'nbRechner' ? '' : 'none';
    });
    switchTab('rechner');
    document.getElementById('teacherBadge').style.display = 'none';
  } else {
    document.getElementById('limitedBanner').style.display = 'none';
    if (type === 'teacher') {
      setPremium(true);
      document.getElementById('teacherBadge').style.display = 'flex';
      document.getElementById('settTeacherActive').style.display = 'block';
      document.getElementById('settTeacherInactive').style.display = 'none';
      document.getElementById('settTeacherBadgeLbl').style.display = 'block';
      document.getElementById('settRoleLabel').textContent = 'Lehrer/in';
      applyPreferences('lehrer', ['calc','koord','notizen','formeln','bild','agent']);
    } else if (type === 'student') {
      const restrictions = getClassRestrictions(licData.classId);
      const allowed = Object.entries(restrictions)
        .filter(([, v]) => v !== false)
        .map(([k]) => k);
      // Default to all features if no restrictions set
      const uses = allowed.length ? allowed : ['calc','koord','notizen','formeln','bild','agent'];
      setPremium(true);
      document.getElementById('teacherBadge').style.display = 'none';
      applyPreferences('', uses);
    } else {
      // pro
      setPremium(true);
      document.getElementById('teacherBadge').style.display = 'none';
      const grade = localStorage.getItem('ms_grade') || '';
      const usesRaw = localStorage.getItem('ms_uses');
      const uses = usesRaw ? usesRaw.split(',') : ['calc','koord','notizen','formeln','bild','agent'];
      applyPreferences(grade, uses);
    }
  }
}

/* ── Get class restrictions (stored by teacher or license manager) ─── */
function getClassRestrictions(classId) {
  if (!classId || classId === '0000') return {};
  try {
    const classes = JSON.parse(localStorage.getItem('lm_classes') || '{}');
    return (classes[classId] && classes[classId].restrictions) ? classes[classId].restrictions : {};
  } catch { return {}; }
}

/* ── Check license on startup ─────────────────── */
function checkLicenseOnStartup() {
  const stored = getLicenseData();
  if (!stored) {
    // No license – check for legacy teacher or pro activation
    if (isTeacher()) {
      const data = { type: 'teacher', classId: null, raw: '_legacy_teacher_', legacyMode: true };
      applyLicense(data);
      return;
    }
    if (isPremium()) {
      const data = { type: 'pro', classId: null, raw: '_legacy_pro_', legacyMode: true };
      applyLicense(data);
      return;
    }
    // Show limited mode
    applyLicense(null);
    // Show license gate on first visit (if prefs not done and not onboarding)
    const prefsDone = localStorage.getItem('ms_prefs_done') === '1';
    if (!prefsDone) {
      // Let onboarding run first; gate will show after user dismisses banner
    } else {
      setTimeout(() => {
        if (getLicenseType() === 'free') openLicenseGate();
      }, 800);
    }
    return;
  }
  // Check if revoked/locked
  if (!stored.legacyMode && stored.raw) {
    const status = checkKeyStatus(stored.raw);
    if (status === 'revoked') {
      setLicenseData(null);
      applyLicense(null);
      alert('⚠️ Dein Lizenzschlüssel wurde widerrufen. Bitte wende dich an deine Lehrperson oder den Administrator.');
      return;
    }
    if (status === 'locked') {
      applyLicense(null);
      document.getElementById('limitedBanner').style.display = 'flex';
      document.getElementById('limitedBanner').querySelector('.lb-text').textContent = '🔒 Dein Zugang wurde von der Lehrperson gesperrt.';
      document.getElementById('limitedBanner').onclick = null;
      return;
    }
  }
  applyLicense(stored);
  if (!stored.legacyMode && stored.raw) startLicenseWatch(stored.raw, stored.classId);
}

/* ── License gate UI ─────────────────────────── */
function openLicenseGate() {
  document.getElementById('licenseKeyInput').value = '';
  document.getElementById('licenseKeyErr').textContent = '';
  document.getElementById('licenseGate').classList.add('open');
  setTimeout(() => document.getElementById('licenseKeyInput').focus(), 200);
}

function closeLicenseGate() {
  document.getElementById('licenseGate').classList.remove('open');
}

function activateLicenseKey() {
  const raw = document.getElementById('licenseKeyInput').value.trim().toUpperCase();
  const errEl = document.getElementById('licenseKeyErr');

  // Support legacy codes
  if (raw === 'KOSTENLOS123' || raw === PRO_CODE.toUpperCase()) {
    const data = { type: 'pro', classId: null, raw: '_legacy_pro_', legacyMode: true };
    setPremium(true);
    applyLicense(data);
    closeLicenseGate();
    _showLicenseToast('🎉 Pro-Lizenz aktiviert!', '#c47400');
    renderLicenseSettings();
    return;
  }
  if (raw === TEACHER_CODE) {
    activateTeacherMode();
    const data = { type: 'teacher', classId: null, raw: '_legacy_teacher_', legacyMode: true };
    setLicenseData(data);
    closeLicenseGate();
    _showLicenseToast('✅ Lehrermodus aktiviert!', '#1a7a1a');
    renderLicenseSettings();
    return;
  }

  const parsed = validateLicenseKey(raw);
  if (!parsed) {
    errEl.textContent = '❌ Ungültiger Schlüssel. Bitte überprüfe die Eingabe.';
    document.getElementById('licenseKeyInput').select();
    return;
  }
  // Check revoked/locked
  const status = checkKeyStatus(parsed.raw);
  if (status === 'revoked') { errEl.textContent = '❌ Dieser Schlüssel wurde widerrufen.'; return; }
  if (status === 'locked') { errEl.textContent = '🔒 Dieser Zugang ist gesperrt. Wende dich an deine Lehrperson.'; return; }

  // Save and apply
  setLicenseData(parsed);
  if (parsed.type === 'teacher') localStorage.setItem(TEACHER_KEY, '1');
  applyLicense(parsed);
  startLicenseWatch(parsed.raw, parsed.classId);
  closeLicenseGate();

  const msgs = { pro: '🎉 Pro-Lizenz aktiviert!', teacher: '✅ Lehrer-Lizenz aktiviert!', student: '🎓 Schüler-Lizenz aktiviert!' };
  const cols = { pro: '#c47400', teacher: '#1a7a1a', student: '#0055cc' };
  _showLicenseToast(msgs[parsed.type], cols[parsed.type]);
  renderLicenseSettings();
  // If student, reload prefs
  if (parsed.type === 'student') applyLicense(parsed);
}

function deactivateLicense() {
  if (!confirm('Lizenz entfernen? Du wechselst dann in den eingeschränkten Modus.')) return;
  stopLicenseWatch();
  setLicenseData(null);
  deactivateTeacherMode();
  setPremium(false);
  applyLicense(null);
  renderLicenseSettings();
}

function _showLicenseToast(msg, color) {
  const el = document.createElement('div');
  el.style.cssText = `position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:${color || 'var(--acc)'};color:#fff;padding:14px 22px;font-size:15px;font-weight:700;z-index:13000;box-shadow:0 4px 20px rgba(0,0,0,.3);white-space:nowrap;`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => { el.style.transition = 'opacity .5s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 500); }, 2800);
}

/* ── License Settings Panel Renderer ─────────── */
const LICENSE_FEATURES = [
  { id: 'calc',    label: '🧮 Rechner'      },
  { id: 'koord',   label: '📐 Koordinaten'  },
  { id: 'notizen', label: '📝 Notizen'      },
  { id: 'formeln', label: '🎓 Formeln+'     },
  { id: 'bild',    label: '📷 Bild/OCR'     },
  { id: 'agent',   label: '🤖 Agent'        }
];

function renderLicenseSettings() {
  const data = getLicenseData();
  const type = data ? data.type : 'free';

  // Status box
  const statusBox = document.getElementById('licStatusBox');
  const statusSub = document.getElementById('licStatusSub');
  const keyDisplay = document.getElementById('licKeyDisplay');
  const deactBtn = document.getElementById('licDeactivateBtn');

  const icons = { free:'🔓', pro:'🌟', teacher:'🎓', student:'📚' };
  const labels = { free:'Freier Modus', pro:'Pro-Lizenz', teacher:'Lehrer-Lizenz', student:'Schüler-Lizenz' };
  const badges = { free:'lic-badge-free', pro:'lic-badge-pro', teacher:'lic-badge-teacher', student:'lic-badge-student' };
  const badgeTxt = { free:'FREE', pro:'PRO', teacher:'LEHRER', student:'SCHÜLER' };
  const subs = {
    free: 'Nur Grundrechner verfügbar – Lizenz eingeben um alle Features freizuschalten',
    pro: 'Alle Features freigeschaltet',
    teacher: 'Alle Features + Klassen-Management freigeschaltet',
    student: 'Features gemäß Klassen-Einstellungen'
  };

  statusBox.innerHTML = `
    <div class="ls-icon">${icons[type]}</div>
    <div>
      <div class="ls-title">${labels[type]} <span class="lic-badge ${badges[type]}">${badgeTxt[type]}</span></div>
      <div class="ls-sub">${subs[type]}</div>
    </div>`;

  if (data && data.raw && !data.legacyMode) {
    keyDisplay.style.display = 'block';
    keyDisplay.textContent = 'Key: ' + data.raw;
  } else { keyDisplay.style.display = 'none'; }

  deactBtn.style.display = (type !== 'free') ? 'block' : 'none';

  // Teacher class panel
  const teacherPanel = document.getElementById('settTeacherClass');
  const studentPanel = document.getElementById('settStudentInfo');
  teacherPanel.style.display = 'none';
  studentPanel.style.display = 'none';

  if (type === 'teacher' && data && data.classId && data.classId !== '0000') {
    teacherPanel.style.display = 'block';
    document.getElementById('teacherClassIdDisplay').textContent = data.classId;
    renderTeacherFeatToggles(data.classId);
    renderTeacherStudentList(data.classId);
  } else if (type === 'teacher' && data && (data.legacyMode || !data.classId || data.classId === '0000')) {
    teacherPanel.style.display = 'block';
    document.getElementById('teacherClassIdDisplay').textContent = 'Kein Klassen-Key (Legacy-Modus)';
    document.getElementById('teacherFeatToggles').innerHTML = '<div style="font-size:12px;color:var(--dim)">Klassen-Features sind nur mit einem TCH-Schlüssel aus dem License Manager verfügbar.</div>';
    document.getElementById('genStuResult').innerHTML = '';
    document.getElementById('teacherStudentList').innerHTML = '';
  }

  if (type === 'student' && data && data.classId) {
    studentPanel.style.display = 'block';
    document.getElementById('stuClassIdDisplay').textContent = data.classId;
  }
}

function renderTeacherFeatToggles(classId) {
  const restrictions = getClassRestrictions(classId);
  const container = document.getElementById('teacherFeatToggles');
  container.innerHTML = LICENSE_FEATURES.map(f => {
    const enabled = restrictions[f.id] !== false; // default: enabled
    return `<div class="feat-toggle-row">
      <div><div class="ftr-label">${f.label}</div><div class="ftr-sub">Schülern erlauben</div></div>
      <label class="toggle-switch" aria-label="${f.label}">
        <input type="checkbox" id="tchr_feat_${f.id}" ${enabled ? 'checked' : ''} aria-label="${f.label}">
        <span class="toggle-slider"></span>
      </label>
    </div>`;
  }).join('');
}

function saveTeacherRestrictions() {
  const data = getLicenseData();
  if (!data || data.type !== 'teacher' || !data.classId || data.classId === '0000') return;
  const classId = data.classId;

  let classes;
  try { classes = JSON.parse(localStorage.getItem('lm_classes') || '{}'); } catch { classes = {}; }
  if (!classes[classId]) classes[classId] = { restrictions: {} };

  const restrictions = {};
  LICENSE_FEATURES.forEach(f => {
    const el = document.getElementById('tchr_feat_' + f.id);
    if (el) restrictions[f.id] = el.checked;
  });
  classes[classId].restrictions = restrictions;
  localStorage.setItem('lm_classes', JSON.stringify(classes));
  _showLicenseToast('💾 Einschränkungen gespeichert', 'var(--acc)');
}

function renderTeacherStudentList(classId) {
  let keys;
  try { keys = JSON.parse(localStorage.getItem('lm_keys') || '[]'); } catch { keys = []; }
  const students = keys.filter(k => k.type === 'STU' && k.classId === classId);
  const el = document.getElementById('teacherStudentList');
  if (!students.length) {
    el.innerHTML = '<div style="font-size:12px;color:var(--dim)">Noch keine Schüler-Keys in dieser Klasse.</div>';
    return;
  }
  el.innerHTML = students.map(s => `
    <div class="cls-student-row">
      <div>
        <div class="csr-key">${s.key}</div>
        ${s.note ? `<div class="csr-name">${s.note}</div>` : ''}
      </div>
      <span class="csr-status ${s.revoked ? 'csr-revoked' : s.locked ? 'csr-locked' : 'csr-active'}">
        ${s.revoked ? 'Widerrufen' : s.locked ? 'Gesperrt' : 'Aktiv'}
      </span>
      <button class="sbtn" style="font-size:11px;padding:4px 10px;margin:0;${s.locked ? 'background:#1a7a1a' : 'background:#7a4400'}"
        onclick="teacherToggleLockStudent('${s.key}')">${s.locked ? '🔓' : '🔒'}</button>
      <button class="sbtn" style="font-size:11px;padding:4px 10px;margin:0;background:#555"
        onclick="teacherCopyKey('${s.key}')">📋</button>
    </div>`).join('');
}

function teacherToggleLockStudent(key) {
  let keys;
  try { keys = JSON.parse(localStorage.getItem('lm_keys') || '[]'); } catch { keys = []; }
  const entry = keys.find(k => k.key === key);
  if (!entry) return;
  entry.locked = !entry.locked;
  localStorage.setItem('lm_keys', JSON.stringify(keys));
  const data = getLicenseData();
  if (data && data.classId) renderTeacherStudentList(data.classId);
}

function teacherCopyKey(key) {
  if (navigator.clipboard) navigator.clipboard.writeText(key).catch(() => {});
  _showLicenseToast('📋 Key kopiert', 'var(--acc)');
}

function teacherGenerateStudentKeys() {
  const data = getLicenseData();
  if (!data || data.type !== 'teacher' || !data.classId || data.classId === '0000') {
    _showLicenseToast('❌ Nur mit TCH-Schlüssel aus dem License Manager möglich.', '#7a0000');
    return;
  }
  const classId = data.classId;
  const name = (document.getElementById('genStuName').value || '').trim();
  const count = Math.min(50, Math.max(1, parseInt(document.getElementById('genStuCount').value) || 1));
  const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  function randomStr(n) { let s=''; for(let i=0;i<n;i++) s+=CHARS[Math.floor(Math.random()*CHARS.length)]; return s; }

  let keys;
  try { keys = JSON.parse(localStorage.getItem('lm_keys') || '[]'); } catch { keys = []; }
  const newKeys = [];
  for (let i = 0; i < count; i++) {
    const random = randomStr(8);
    const cs = _lmHash('STU' + classId + random + LICENSE_SECRET);
    const k = `STU-${classId}-${random}-${cs}`;
    keys.push({ key: k, type: 'STU', classId, note: name, revoked: false, locked: false, created: new Date().toISOString() });
    newKeys.push(k);
  }
  localStorage.setItem('lm_keys', JSON.stringify(keys));
  document.getElementById('genStuName').value = '';

  const resultHtml = newKeys.map(k =>
    `<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
       <code style="font-size:12px;font-family:monospace;color:var(--acc);flex:1;word-break:break-all">${k}</code>
       <button class="sbtn" style="font-size:11px;padding:4px 10px;margin:0" onclick="teacherCopyKey('${k}')">📋</button>
     </div>`).join('');
  document.getElementById('genStuResult').innerHTML = `<div style="margin-top:6px"><div style="font-size:11px;color:var(--dim);margin-bottom:4px">${count} Key(s):</div>${resultHtml}</div>`;
  renderTeacherStudentList(classId);
}

/* ══════════════════════════════════════════════
   TEACHER / STUDENT MODE
══════════════════════════════════════════════ */
const TEACHER_CODE = '1122';
const TEACHER_KEY  = 'ms_teacher_mode';

function isTeacher() {
  try { return localStorage.getItem(TEACHER_KEY) === '1'; } catch(e) { return false; }
}

function activateTeacherMode() {
  localStorage.setItem(TEACHER_KEY, '1');
  setPremium(true);
  // Show teacher badge in header
  document.getElementById('teacherBadge').style.display = 'flex';
  document.getElementById('settTeacherActive').style.display = 'block';
  document.getElementById('settTeacherInactive').style.display = 'none';
  document.getElementById('settTeacherBadgeLbl').style.display = 'block';
  document.getElementById('settRoleLabel').textContent = 'Lehrer/in';
  // Unlock all nav tabs
  applyPreferences('lehrer', ['calc','koord','notizen','formeln','bild','agent']);
  // Toast
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#1a7a1a;color:#fff;padding:14px 22px;font-size:15px;font-weight:700;z-index:13000;white-space:nowrap;';
  el.textContent = '✅ Lehrermodus aktiviert!';
  document.body.appendChild(el);
  setTimeout(() => { el.style.transition = 'opacity .5s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 500); }, 2500);
}

function deactivateTeacherMode() {
  localStorage.removeItem(TEACHER_KEY);
  setPremium(false);
  document.getElementById('teacherBadge').style.display = 'none';
  document.getElementById('settTeacherActive').style.display = 'none';
  document.getElementById('settTeacherInactive').style.display = 'block';
  document.getElementById('settTeacherBadgeLbl').style.display = 'none';
  document.getElementById('settRoleLabel').textContent = 'Schüler/in';
  // Re-apply student preferences, then enforce current license restrictions
  const grade = localStorage.getItem('ms_grade') || '';
  const uses  = (localStorage.getItem('ms_uses') || 'calc').split(',');
  applyPreferences(grade, uses);
  applyLicense(getLicenseData());
}

function activateTeacherFromSettings() {
  const code = document.getElementById('settTeacherCodeInput').value.trim();
  if (code === TEACHER_CODE) {
    document.getElementById('settTeacherCodeInput').value = '';
    activateTeacherMode();
  } else {
    document.getElementById('settTeacherErr').textContent = '❌ Falscher Code.';
  }
}

/* ══════════════════════════════════════════════
   PREFERENCES / NAV VISIBILITY
══════════════════════════════════════════════ */
// featId → navButtonId mapping
const FEAT_NAV = {
  calc:    'nbRechner',
  koord:   'nbKoord',
  notizen: 'nbNotizen',
  formeln: 'nbKlasse',
  bild:    'nbBild',
  agent:   'nbAgent'
};
// Always-visible nav items (never hidden)
const NAV_ALWAYS = ['nbHandbuch', 'nbSettings'];

// navButtonId → fsMenu buttonId (used to sync fullscreen-menu visibility with nav)
const FS_NAV_MAP = {
  nbRechner:  'fsModeRechner',
  nbKoord:    'fsModeKoord',
  nbNotizen:  'fsModeNotizen',
  nbKlasse:   'fsModeKlasse',
  nbBild:     'fsModeBild',
  nbAgent:    'fsModeAgent',
  nbHandbuch: 'fsModeHandbuch',
};

// Grade → recommended default features
const GRADE_DEFAULTS = {
  '5-6':   ['calc', 'notizen'],
  '7-8':   ['calc', 'koord', 'notizen', 'formeln'],
  '9-10':  ['calc', 'koord', 'notizen', 'formeln', 'bild'],
  '11-13': ['calc', 'koord', 'notizen', 'formeln', 'bild', 'agent'],
  'lehrer':['calc', 'koord', 'notizen', 'formeln', 'bild', 'agent']
};

function applyPreferences(grade, uses) {
  // Save
  if (grade) localStorage.setItem('ms_grade', grade);
  if (uses)  localStorage.setItem('ms_uses', uses.join(','));

  // Update settings labels
  const gradeLabels = { '5-6':'Klasse 5 – 6','7-8':'Klasse 7 – 8','9-10':'Klasse 9 – 10','11-13':'Klasse 11 – 13','lehrer':'Lehrermodus' };
  const glEl = document.getElementById('settGradeLabel');
  if (glEl && grade) glEl.textContent = gradeLabels[grade] || grade;

  // Show/hide nav buttons based on selected features
  Object.entries(FEAT_NAV).forEach(([feat, navId]) => {
    const btn = document.getElementById(navId);
    if (!btn) return;
    btn.style.display = uses.includes(feat) ? '' : 'none';
  });

  // If currently active tab is now hidden, switch to rechner
  const activeNb = document.querySelector('#nav .nb.active');
  if (activeNb && activeNb.style.display === 'none') {
    switchTab('rechner');
  }
}

function loadAndApplyPreferences() {
  const grade = localStorage.getItem('ms_grade') || '';
  const usesRaw = localStorage.getItem('ms_uses');
  const uses = usesRaw ? usesRaw.split(',') : null;
  if (uses) applyPreferences(grade, uses);
}

/* ══════════════════════════════════════════════
   ONBOARDING
══════════════════════════════════════════════ */
let _obGrade = '';
let _obReset = false;

function showOnboarding(reset) {
  _obReset = !!reset;
  _obGrade = '';
  // Reset step UI
  document.querySelectorAll('.ob-step').forEach(s => s.classList.remove('active'));
  document.getElementById('obStep0').classList.add('active');
  document.querySelectorAll('.ob-dot').forEach(d => d.classList.remove('active'));
  document.getElementById('obDot0').classList.add('active');
  // Clear grade selection
  document.querySelectorAll('.ob-grade-btn').forEach(b => b.classList.remove('sel'));
  const nextBtn = document.getElementById('obNext0');
  nextBtn.disabled = true;
  nextBtn.style.opacity = '.4';
  // Show overlay
  document.getElementById('onboardOverlay').classList.add('open');
}

function obSelectGrade(grade) {
  _obGrade = grade;
  document.querySelectorAll('.ob-grade-btn').forEach(b => b.classList.remove('sel'));
  const idMap = { '5-6':'obG56','7-8':'obG78','9-10':'obG910','11-13':'obG1113','lehrer':'obGTeacher' };
  if (idMap[grade]) document.getElementById(idMap[grade]).classList.add('sel');
  const nextBtn = document.getElementById('obNext0');
  nextBtn.disabled = false;
  nextBtn.style.opacity = '1';
}

function obGoStep1() {
  if (!_obGrade) return;
  if (_obGrade === 'lehrer') {
    // Show teacher code step
    document.getElementById('obStep0').classList.remove('active');
    document.getElementById('obStep1').classList.add('active');
    document.getElementById('obDot0').classList.remove('active');
    document.getElementById('obDot1').classList.add('active');
    document.getElementById('obTeacherCodeInput').value = '';
    document.getElementById('obTeacherErr').textContent = '';
    setTimeout(() => document.getElementById('obTeacherCodeInput').focus(), 150);
  } else {
    // Pre-check features for grade
    obPreselectFeatures(_obGrade);
    document.getElementById('obStep0').classList.remove('active');
    document.getElementById('obStep2').classList.add('active');
    document.getElementById('obDot0').classList.remove('active');
    document.getElementById('obDot2').classList.add('active');
  }
}

function obPreselectFeatures(grade) {
  const defaults = GRADE_DEFAULTS[grade] || ['calc'];
  const featMap = {
    calc: 'obChkCalc', koord: 'obChkKoord', notizen: 'obChkNotizen',
    formeln: 'obChkFormeln', bild: 'obChkBild', agent: 'obChkAgent'
  };
  const rowMap = {
    calc: 'obFeatCalc', koord: 'obFeatKoord', notizen: 'obFeatNotizen',
    formeln: 'obFeatFormeln', bild: 'obFeatBild', agent: 'obFeatAgent'
  };
  Object.keys(featMap).forEach(feat => {
    const chk = document.getElementById(featMap[feat]);
    const row = document.getElementById(rowMap[feat]);
    const checked = defaults.includes(feat);
    if (chk) chk.checked = checked;
    if (row) row.classList.toggle('sel', checked);
  });
}

function obToggleFeat(chk) {
  const row = chk.closest('.ob-feat-row');
  if (row) row.classList.toggle('sel', chk.checked);
}

function _obFinish() {
  document.getElementById('onboardOverlay').classList.remove('open');
  // Show the data-loss warning now (deferred from launchApp)
  if (!sessionStorage.getItem('warned')) {
    document.getElementById('warnOverlay').style.display = 'flex';
  }
}

function obCheckTeacherCode() {
  const code = document.getElementById('obTeacherCodeInput').value.trim();
  if (code === TEACHER_CODE) {
    localStorage.setItem('ms_prefs_done', '1');
    _obFinish();
    activateTeacherMode();
  } else {
    document.getElementById('obTeacherErr').textContent = '❌ Falscher Code. Bitte erneut versuchen.';
    document.getElementById('obTeacherCodeInput').select();
  }
}

function obClearTeacherErr() {
  document.getElementById('obTeacherErr').textContent = '';
}

function obComplete() {
  const uses = [];
  ['calc','koord','notizen','formeln','bild','agent'].forEach(feat => {
    const chkId = 'obChk' + feat.charAt(0).toUpperCase() + feat.slice(1);
    const chk = document.getElementById(chkId);
    if (chk && chk.checked) uses.push(feat);
  });
  if (uses.length === 0) uses.push('calc');
  applyPreferences(_obGrade, uses);
  localStorage.setItem('ms_prefs_done', '1');
  const rl = document.getElementById('settRoleLabel');
  if (rl) rl.textContent = 'Schüler/in';
  applyLicense(getLicenseData());
  _obFinish();
}

function obBack() {
  document.getElementById('obStep1').classList.remove('active');
  document.getElementById('obStep0').classList.add('active');
  document.getElementById('obDot1').classList.remove('active');
  document.getElementById('obDot0').classList.add('active');
}

function obBackToGrade() {
  document.getElementById('obStep2').classList.remove('active');
  document.getElementById('obStep0').classList.add('active');
  document.getElementById('obDot2').classList.remove('active');
  document.getElementById('obDot0').classList.add('active');
}

function obSkip() {
  applyPreferences('', ['calc','koord','notizen','formeln','bild','agent']);
  localStorage.setItem('ms_prefs_done', '1');
  applyLicense(getLicenseData());
  _obFinish();
}
