/* Détection d'anomalies sur un signal de capteur, par un autoencodeur.

   Le modèle ne voit que du fonctionnement normal : il apprend, au chargement
   de la page, à reconstruire une fenêtre de 40 mesures consécutives. Ensuite,
   l'écart entre le signal réel et sa reconstruction sert de score : tant que
   la machine se comporte comme d'habitude il reste bas, et il décroche dès que
   le signal sort du régime appris. Aucune panne n'a jamais été étiquetée, ce
   qui est exactement la situation d'un client qui a des années d'historique
   mais deux incidents documentés.

   Le réseau, sa rétropropagation et son optimiseur sont écrits à la main ici. */

(function () {
  'use strict';

  var root = document.querySelector('[data-monitor]');
  if (!root) return;

  // Les libelles et le format des nombres viennent du gabarit : le script reste
  // le meme dans les deux langues du site.
  var LOCALE = root.getAttribute('data-locale') || 'fr-BE';

  function label(name, fallback) {
    return root.getAttribute('data-label-' + name) || fallback;
  }

  var LABEL_PAUSE = label('pause', 'Pause');
  var LABEL_RESUME = label('resume', 'Reprendre');
  var LABEL_NORMAL = label('normal', 'Normal');
  var LABEL_ALERT = label('alert', 'Alerte');
  var LABEL_CALIB = label('calibrating', 'Calibration…');
  var LABEL_READY = label('ready', '{arch} · {n}');

  function decimal(x, digits) {
    return x.toLocaleString(LOCALE, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    });
  }

  // ------------------------------------------------------------- paramètres

  var WINDOW = 40;            // la fenêtre analysée, en mesures
  var HIDDEN = 20;
  var CODE = 5;               // le goulot : cinq nombres pour résumer 40 mesures
  var HIST = 260;             // ce que la courbe garde à l'écran
  var SAMPLE_MS = 70;         // une mesure toutes les 70 ms

  var MU = 0.5, SIGMA = 0.2;  // normalisation fixe, apprise du régime normal
  var BATCH = 16;
  var LR = 0.012;
  var CALIB_STEPS = 1200;
  var CALIB_CHUNK = 60;       // pas d'entraînement par image, pour ne pas figer l'onglet
  var CALIB_WINDOWS = 500;    // fenêtres normales servant à fixer le seuil

  var INK = [23, 23, 26];
  var ACCENT = [180, 83, 31];

  function rgba(c, a) {
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  }

  // ---------------------------------------------------------------- signal

  function gaussian() {
    var u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /* Un régime de fonctionnement : une lente respiration de la machine, une
     oscillation rapide, un peu de bruit de mesure. Chaque tirage donne une
     machine légèrement différente ; le modèle est entraîné sur beaucoup de
     tirages pour ne pas apprendre par cœur celui de la démonstration. */
  function randomRegime() {
    return {
      base: 0.48 + Math.random() * 0.04,
      a1: 0.13 + Math.random() * 0.04,
      p1: 88 + Math.random() * 16,
      ph1: Math.random() * 2 * Math.PI,
      a2: 0.045 + Math.random() * 0.02,
      p2: 21 + Math.random() * 4,
      ph2: Math.random() * 2 * Math.PI,
      noise: 0.010 + Math.random() * 0.006
    };
  }

  function clean(r, t) {
    return r.base
      + r.a1 * Math.sin(2 * Math.PI * t / r.p1 + r.ph1)
      + r.a2 * Math.sin(2 * Math.PI * t / r.p2 + r.ph2);
  }

  function measure(r, t) {
    return clean(r, t) + gaussian() * r.noise;
  }

  // --------------------------------------------------------------- réseau

  function createNet(sizes) {
    var layers = [];
    for (var l = 0; l < sizes.length - 1; l++) {
      var nin = sizes[l], nout = sizes[l + 1];
      var w = new Float64Array(nin * nout);
      var scale = Math.sqrt(2 / nin);
      for (var k = 0; k < w.length; k++) w[k] = gaussian() * scale;
      layers.push({
        nin: nin, nout: nout, w: w,
        b: new Float64Array(nout),
        gw: new Float64Array(nin * nout), gb: new Float64Array(nout),
        mw: new Float64Array(nin * nout), vw: new Float64Array(nin * nout),
        mb: new Float64Array(nout), vb: new Float64Array(nout),
        a: new Float64Array(nout), d: new Float64Array(nout)
      });
    }
    return layers;
  }

  /* Couches cachées en tanh, sortie linéaire : on reconstruit un signal, pas
     une probabilité. */
  function forward(net, x) {
    var prev = x;
    for (var l = 0; l < net.length; l++) {
      var L = net[l], last = l === net.length - 1;
      for (var j = 0; j < L.nout; j++) {
        var s = L.b[j];
        for (var i = 0; i < L.nin; i++) s += L.w[i * L.nout + j] * prev[i];
        L.a[j] = last ? s : Math.tanh(s);
      }
      prev = L.a;
    }
    return prev;
  }

  /* La cible est l'entrée elle-même : la dérivée de l'erreur quadratique par
     rapport à la sortie linéaire vaut simplement (reconstruction − entrée). */
  function backward(net, x) {
    var out = net[net.length - 1];
    for (var j = 0; j < out.nout; j++) out.d[j] = out.a[j] - x[j];

    for (var l = net.length - 1; l >= 0; l--) {
      var L = net[l];
      var prev = l === 0 ? x : net[l - 1].a;
      for (var n = 0; n < L.nout; n++) {
        var d = L.d[n];
        L.gb[n] += d;
        for (var i = 0; i < L.nin; i++) L.gw[i * L.nout + n] += d * prev[i];
      }
      if (l > 0) {
        var P = net[l - 1];
        for (var p = 0; p < P.nout; p++) {
          var s = 0;
          for (var q = 0; q < L.nout; q++) s += L.w[p * L.nout + q] * L.d[q];
          P.d[p] = s * (1 - P.a[p] * P.a[p]);
        }
      }
    }
  }

  function adam(net, lr, scale, t) {
    var b1 = 0.9, b2 = 0.999, eps = 1e-8;
    var c1 = 1 - Math.pow(b1, t), c2 = 1 - Math.pow(b2, t);

    function update(p, g, m, v) {
      for (var i = 0; i < p.length; i++) {
        var grad = g[i] * scale;
        m[i] = b1 * m[i] + (1 - b1) * grad;
        v[i] = b2 * v[i] + (1 - b2) * grad * grad;
        p[i] -= lr * (m[i] / c1) / (Math.sqrt(v[i] / c2) + eps);
        g[i] = 0;
      }
    }

    for (var l = 0; l < net.length; l++) {
      update(net[l].w, net[l].gw, net[l].mw, net[l].vw);
      update(net[l].b, net[l].gb, net[l].mb, net[l].vb);
    }
  }

  // ---------------------------------------------------------------- état

  var el = {
    signal: root.querySelector('[data-monitor-signal]'),
    score: root.querySelector('[data-monitor-score]'),
    gap: root.querySelector('[data-monitor-gap]'),
    state: root.querySelector('[data-monitor-state]'),
    alerts: root.querySelector('[data-monitor-alerts]'),
    status: root.querySelector('[data-monitor-status]'),
    toggle: root.querySelector('[data-monitor-toggle]'),
    reset: root.querySelector('[data-monitor-reset]')
  };

  var signalCtx = el.signal.getContext('2d');
  var scoreCtx = el.score.getContext('2d');

  var net = createNet([WINDOW, HIDDEN, CODE, HIDDEN, WINDOW]);
  var threshold = 1;
  var trained = 0;

  var win = new Float64Array(WINDOW);   // la fenêtre courante, normalisée
  var scratch = new Float64Array(WINDOW);

  var state = {
    regime: randomRegime(),
    t: 0,
    values: [],
    expected: [],
    ratios: [],
    flags: [],
    events: [],
    alerting: false,
    calm: 0,
    alerts: 0,
    ratio: 0,
    running: false,
    ready: false,
    lo: 0.3, hi: 0.7,
    top: 1.6,
    last: 0
  };

  // ---------------------------------------------------------- entraînement

  /* Remplit `target` avec une fenêtre normalisée tirée d'un régime normal. */
  function normalWindow(target, r, t0) {
    for (var i = 0; i < WINDOW; i++) {
      target[i] = (measure(r, t0 + i) - MU) / SIGMA;
    }
  }

  function trainChunk(steps) {
    var r = null;
    for (var s = 0; s < steps; s++) {
      for (var k = 0; k < BATCH; k++) {
        // Un régime neuf toutes les quelques fenêtres : le modèle doit couvrir
        // la famille des signaux normaux, pas une machine en particulier.
        if (k % 4 === 0) r = randomRegime();
        normalWindow(scratch, r, Math.random() * 1000);
        forward(net, scratch);
        backward(net, scratch);
      }
      trained++;
      adam(net, LR, 1 / BATCH, trained);
    }
  }

  function reconstruct(w) {
    var out = forward(net, w);
    var err = 0;
    for (var i = 0; i < WINDOW; i++) {
      var d = out[i] - w[i];
      err += d * d;
    }
    return { err: err / WINDOW, last: MU + out[WINDOW - 1] * SIGMA };
  }

  /* Le seuil est fixé sur du normal jamais vu à l'entraînement : on prend un
     centile haut des écarts observés, avec une marge. Rien n'est réglé à la
     main, et c'est reproductible sur les données d'un client. */
  function calibrate() {
    var errors = [];
    for (var i = 0; i < CALIB_WINDOWS; i++) {
      normalWindow(scratch, randomRegime(), Math.random() * 1000);
      errors.push(reconstruct(scratch).err);
    }
    errors.sort(function (a, b) { return a - b; });
    threshold = errors[Math.floor(errors.length * 0.995)] * 1.6;
  }

  // ------------------------------------------------------------- anomalies

  var ANOMALIES = {
    spike: { len: 10 },        // un choc mécanique bref
    drop: { len: 70 },         // un décrochage du niveau
    drift: { len: 120 },       // une dérive lente puis un retour
    noise: { len: 90 }         // une vibration parasite
  };

  function ramp(u) {
    // Montée et descente adoucies, plateau au milieu.
    var e = Math.min(1, Math.min(u, 1 - u) / 0.18);
    return e * e * (3 - 2 * e);
  }

  function disturbance(t) {
    var offset = 0, noise = 0;
    for (var i = state.events.length - 1; i >= 0; i--) {
      var ev = state.events[i];
      var u = (t - ev.start) / ev.len;
      if (u >= 1) { state.events.splice(i, 1); continue; }
      if (u < 0) continue;
      if (ev.type === 'spike') {
        var d = (t - ev.start - 2) / 1.4;
        offset += 0.5 * Math.exp(-d * d);
      } else if (ev.type === 'drop') {
        offset -= 0.3 * ramp(u);
      } else if (ev.type === 'drift') {
        offset += 0.42 * (u < 0.78 ? u / 0.78 : (1 - u) / 0.22);
      } else if (ev.type === 'noise') {
        noise += 0.075 * ramp(u);
      }
    }
    return { offset: offset, noise: noise };
  }

  // -------------------------------------------------------------- pipeline

  function step(count) {
    var d = disturbance(state.t);
    var v = measure(state.regime, state.t) + d.offset + gaussian() * d.noise;
    state.t++;

    state.values.push(v);
    if (state.values.length > HIST) state.values.shift();

    var n = state.values.length;
    if (n < WINDOW) {
      // Pas encore de fenêtre complète : rien à reconstruire, donc rien à tracer.
      state.expected.push(NaN);
      state.ratios.push(NaN);
      state.flags.push(0);
      return;
    }

    for (var i = 0; i < WINDOW; i++) {
      win[i] = (state.values[n - WINDOW + i] - MU) / SIGMA;
    }
    var out = reconstruct(win);
    var ratio = out.err / threshold;

    // Un peu de lissage : une mesure isolée ne doit pas déclencher une alerte,
    // mais l'écart doit rester lisible tout de suite.
    state.ratio = state.ratio * 0.6 + ratio * 0.4;

    // Hystérésis : on ne sort de l'alerte qu'après un retour au calme franc et
    // durable, sinon un même incident se compte deux ou trois fois.
    if (state.alerting) {
      state.calm = state.ratio < 0.7 ? state.calm + 1 : 0;
      if (state.calm >= 12) state.alerting = false;
    } else if (state.ratio > 1) {
      state.alerting = true;
      state.calm = 0;
      if (count) state.alerts++;
    }

    state.expected.push(out.last);
    state.ratios.push(state.ratio);
    state.flags.push(state.alerting ? 1 : 0);
    if (state.expected.length > HIST) state.expected.shift();
    if (state.ratios.length > HIST) state.ratios.shift();
    if (state.flags.length > HIST) state.flags.shift();
  }

  function readouts() {
    el.gap.textContent = decimal(state.ratio, 2) + ' ×';
    el.state.textContent = state.alerting ? LABEL_ALERT : LABEL_NORMAL;
    el.state.classList.toggle('is-alert', state.alerting);
    el.alerts.textContent = state.alerts.toLocaleString(LOCALE);
  }

  // ----------------------------------------------------------------- rendu

  function fit() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    [el.signal, el.score].forEach(function (canvas) {
      var w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    });
  }

  function ease(current, target) {
    return current + (target - current) * 0.08;
  }

  /* Indice de la première mesure qui a une reconstruction, ou -1 : au démarrage,
     les mesures antérieures à la première fenêtre complète n'en ont pas. */
  function firstReal(series) {
    for (var i = 0; i < series.length; i++) {
      if (series[i] === series[i]) return i;
    }
    return -1;
  }

  function drawSignal() {
    var w = el.signal.width, h = el.signal.height;
    var n = state.values.length;
    signalCtx.clearRect(0, 0, w, h);
    if (n < 2) return;

    var lo = Infinity, hi = -Infinity;
    for (var i = 0; i < n; i++) {
      if (state.values[i] < lo) lo = state.values[i];
      if (state.values[i] > hi) hi = state.values[i];
    }
    var pad = Math.max(0.08, (hi - lo) * 0.18);
    state.lo = ease(state.lo, lo - pad);
    state.hi = ease(state.hi, hi + pad);

    var span = Math.max(0.05, state.hi - state.lo);
    var dx = w / (HIST - 1);

    function X(i) { return i * dx; }
    function Y(v) { return h - (v - state.lo) / span * h; }

    // Les fenêtres jugées anormales, en fond.
    signalCtx.fillStyle = rgba(ACCENT, 0.1);
    for (var f = 0; f < n; f++) {
      if (state.flags[f]) signalCtx.fillRect(X(f) - dx / 2, 0, dx + 1, h);
    }

    // La fenêtre que le réseau regarde en ce moment.
    if (n >= WINDOW) {
      signalCtx.fillStyle = rgba(INK, 0.04);
      signalCtx.fillRect(X(n - WINDOW), 0, X(n - 1) - X(n - WINDOW), h);
    }

    signalCtx.strokeStyle = rgba(INK, 0.08);
    signalCtx.lineWidth = 1;
    for (var g = 1; g < 4; g++) {
      var gy = Math.round(h * g / 4) + 0.5;
      signalCtx.beginPath();
      signalCtx.moveTo(0, gy);
      signalCtx.lineTo(w, gy);
      signalCtx.stroke();
    }

    // Ce que le modèle attendait, puis ce qui a réellement été mesuré.
    var start = firstReal(state.expected);
    if (start >= 0 && n > start + 1) {
      signalCtx.strokeStyle = rgba(ACCENT, 0.85);
      signalCtx.lineWidth = Math.max(1.4, w / 620);
      signalCtx.setLineDash([Math.max(4, w / 190), Math.max(3, w / 260)]);
      signalCtx.beginPath();
      for (var e = start; e < n; e++) {
        if (e === start) signalCtx.moveTo(X(e), Y(state.expected[e]));
        else signalCtx.lineTo(X(e), Y(state.expected[e]));
      }
      signalCtx.stroke();
      signalCtx.setLineDash([]);
    }

    signalCtx.strokeStyle = rgba(INK, 0.9);
    signalCtx.lineWidth = Math.max(1.6, w / 520);
    signalCtx.lineJoin = 'round';
    signalCtx.beginPath();
    for (var k = 0; k < n; k++) {
      if (k === 0) signalCtx.moveTo(X(k), Y(state.values[k]));
      else signalCtx.lineTo(X(k), Y(state.values[k]));
    }
    signalCtx.stroke();

    signalCtx.fillStyle = state.alerting ? rgba(ACCENT, 1) : rgba(INK, 1);
    signalCtx.beginPath();
    signalCtx.arc(X(n - 1), Y(state.values[n - 1]), Math.max(3, w / 300), 0, 2 * Math.PI);
    signalCtx.fill();
  }

  function drawScore() {
    var w = el.score.width, h = el.score.height;
    var n = state.ratios.length;
    scoreCtx.clearRect(0, 0, w, h);
    if (n < 2) return;

    // L'échelle suit le pic visible, mais plafonne : un écart à trente fois le
    // seuil écraserait la ligne du seuil contre le bas du cadre. Au-delà, la
    // courbe sature en haut du graphe, ce qui dit la même chose.
    var peak = 1.6;
    for (var i = 0; i < n; i++) if (state.ratios[i] > peak) peak = state.ratios[i];
    state.top = ease(state.top, Math.min(peak * 1.12, 6));

    var dx = w / (HIST - 1);
    var scale = Math.sqrt(state.top);

    function X(k) { return k * dx; }

    /* Échelle en racine : un écart à vingt fois le seuil écraserait tout le
       fonctionnement normal contre le bas du cadre. */
    function Y(v) { return h - 1 - (Math.sqrt(Math.max(v, 0)) / scale) * (h - 4); }

    var start = firstReal(state.ratios);
    if (start < 0 || n - start < 2) return;

    var path = new Path2D();
    path.moveTo(X(start), h);
    for (var j = start; j < n; j++) path.lineTo(X(j), Y(state.ratios[j]));
    path.lineTo(X(n - 1), h);
    path.closePath();

    scoreCtx.fillStyle = rgba(INK, 0.07);
    scoreCtx.fill(path);

    // La même aire, mais recoupée au-dessus du seuil : c'est la partie qui
    // déclenche une alerte, et elle se lit d'un coup d'œil.
    scoreCtx.save();
    scoreCtx.beginPath();
    scoreCtx.rect(0, 0, w, Y(1));
    scoreCtx.clip();
    scoreCtx.fillStyle = rgba(ACCENT, 0.22);
    scoreCtx.fill(path);
    scoreCtx.restore();

    scoreCtx.strokeStyle = rgba(INK, 0.55);
    scoreCtx.lineWidth = Math.max(1.2, w / 700);
    scoreCtx.beginPath();
    for (var k = start; k < n; k++) {
      if (k === start) scoreCtx.moveTo(X(k), Y(state.ratios[k]));
      else scoreCtx.lineTo(X(k), Y(state.ratios[k]));
    }
    scoreCtx.stroke();

    scoreCtx.strokeStyle = rgba(ACCENT, 0.75);
    scoreCtx.lineWidth = Math.max(1, w / 800);
    scoreCtx.setLineDash([Math.max(3, w / 220), Math.max(3, w / 220)]);
    scoreCtx.beginPath();
    scoreCtx.moveTo(0, Y(1));
    scoreCtx.lineTo(w, Y(1));
    scoreCtx.stroke();
    scoreCtx.setLineDash([]);
  }

  function render() {
    drawSignal();
    drawScore();
  }

  // ---------------------------------------------------------------- boucle

  function loop(now) {
    if (!state.running) return;
    if (!state.last) state.last = now;

    // On avance d'autant de mesures que le temps écoulé en demande, avec un
    // plafond : un onglet resté en arrière-plan ne doit pas rattraper d'un
    // coup une minute de signal.
    var due = Math.min(6, Math.floor((now - state.last) / SAMPLE_MS));
    if (due > 0) {
      state.last = now;
      for (var i = 0; i < due; i++) step(true);
      readouts();
    }
    render();
    requestAnimationFrame(loop);
  }

  function setRunning(on) {
    if (!state.ready) return;
    if (state.running === on) return;
    state.running = on;
    el.toggle.textContent = on ? LABEL_PAUSE : LABEL_RESUME;
    if (on) {
      state.last = 0;
      requestAnimationFrame(loop);
    }
  }

  function reset() {
    state.regime = randomRegime();
    state.t = 0;
    state.values = [];
    state.expected = [];
    state.ratios = [];
    state.flags = [];
    state.events = [];
    state.alerting = false;
    state.calm = 0;
    state.alerts = 0;
    state.ratio = 0;
    prefill();
    readouts();
    render();
  }

  /* On remplit la fenêtre visible avec du signal normal déjà analysé : la
     démonstration s'ouvre sur une machine qui tourne, pas sur un graphe vide. */
  function prefill() {
    for (var i = 0; i < HIST; i++) step(false);
    state.alerting = false;
    state.alerts = 0;
  }

  // ------------------------------------------------------------ événements

  el.toggle.addEventListener('click', function () { setRunning(!state.running); });
  el.reset.addEventListener('click', reset);

  root.querySelectorAll('[data-monitor-inject]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var type = btn.getAttribute('data-monitor-inject');
      var spec = ANOMALIES[type];
      if (!spec || !state.ready) return;
      state.events.push({ type: type, start: state.t + 2, len: spec.len });
      setRunning(true);
    });
  });

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      fit();
      render();
    }, 120);
  });

  // ------------------------------------------------------------ démarrage

  /* L'entraînement est découpé en petits paquets d'une image à l'autre : il
     dure moins d'une seconde, mais bloquer l'onglet pendant ce temps se voit. */
  function calibration() {
    var done = 0;
    el.status.textContent = LABEL_CALIB;

    function chunk() {
      trainChunk(CALIB_CHUNK);
      done += CALIB_CHUNK;
      if (done < CALIB_STEPS) {
        requestAnimationFrame(chunk);
        return;
      }
      calibrate();
      state.ready = true;
      el.status.textContent = LABEL_READY
        .replace('{arch}', [WINDOW, HIDDEN, CODE, HIDDEN, WINDOW].join('-'))
        .replace('{n}', CALIB_WINDOWS.toLocaleString(LOCALE));
      prefill();
      readouts();
      render();
      setRunning(true);
    }

    requestAnimationFrame(chunk);
  }

  fit();
  calibration();

  // Le signal ne défile que si la démonstration est visible : inutile de faire
  // tourner une animation dans une section restée hors de l'écran.
  if ('IntersectionObserver' in window) {
    // `wanted` ne change que sur un clic du visiteur : sortir la démo de
    // l'écran la met en pause sans effacer son intention.
    var wanted = true;
    new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) {
        if (wanted) setRunning(true);
      } else {
        setRunning(false);
      }
    }, { threshold: 0.15 }).observe(root);
    el.toggle.addEventListener('click', function () { wanted = state.running; });
  }
})();
