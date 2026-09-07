/* Classification binaire dans le plan, par un perceptron multicouche.
   Propagation avant, rétropropagation et optimiseurs écrits à la main :
   aucune dépendance, tout tourne dans l'onglet du visiteur. */

(function () {
  'use strict';

  var root = document.querySelector('[data-lab]');
  if (!root) return;

  // ------------------------------------------------------------- paramètres

  var DOMAIN = 1.25;          // la carte couvre [-1.25, 1.25] dans les deux axes
  var GRID = 60;              // résolution de la frontière de décision
  var BATCH = 24;
  var STEPS_PER_FRAME = 12;
  var POINTS = 220;

  var WARM = [180, 83, 31];   // classe 1
  var COOL = [63, 106, 148];  // classe 0
  var PAPER = [247, 244, 237];

  var ACTIVATIONS = {
    tanh: { f: Math.tanh, d: function (a) { return 1 - a * a; } },
    relu: { f: function (z) { return z > 0 ? z : 0; }, d: function (a) { return a > 0 ? 1 : 0; } }
  };

  // ------------------------------------------------------------- jeux de points

  function gaussian() {
    var u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  var DATASETS = {
    spiral: function (n) {
      var pts = [];
      for (var i = 0; i < n; i++) {
        var t = (i % (n / 2)) / (n / 2);
        var label = i < n / 2 ? 1 : 0;
        var angle = t * 3.2 * Math.PI + (label ? 0 : Math.PI);
        var r = 0.12 + t * 0.82;
        pts.push({
          x: r * Math.cos(angle) + gaussian() * 0.035,
          y: r * Math.sin(angle) + gaussian() * 0.035,
          label: label
        });
      }
      return pts;
    },
    circles: function (n) {
      var pts = [];
      for (var i = 0; i < n; i++) {
        var label = i % 2;
        var r = label ? Math.sqrt(Math.random()) * 0.42 : 0.66 + Math.random() * 0.3;
        var a = Math.random() * 2 * Math.PI;
        pts.push({
          x: r * Math.cos(a) + gaussian() * 0.035,
          y: r * Math.sin(a) + gaussian() * 0.035,
          label: label
        });
      }
      return pts;
    },
    moons: function (n) {
      var pts = [];
      for (var i = 0; i < n; i++) {
        var label = i % 2;
        var a = Math.random() * Math.PI;
        var x = Math.cos(a) * 0.72, y = Math.sin(a) * 0.72;
        if (!label) { x = -x + 0.36; y = -y + 0.3; } else { x -= 0.36; y -= 0.3; }
        pts.push({ x: x + gaussian() * 0.06, y: y + gaussian() * 0.06, label: label });
      }
      return pts;
    },
    xor: function (n) {
      var pts = [];
      for (var i = 0; i < n; i++) {
        var x = (Math.random() * 2 - 1) * 0.95;
        var y = (Math.random() * 2 - 1) * 0.95;
        if (Math.abs(x) < 0.06) x += 0.12;
        if (Math.abs(y) < 0.06) y += 0.12;
        pts.push({ x: x, y: y, label: x * y > 0 ? 1 : 0 });
      }
      return pts;
    }
  };

  // ------------------------------------------------------------------ réseau

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

  function sigmoid(z) {
    return z >= 0 ? 1 / (1 + Math.exp(-z)) : Math.exp(z) / (1 + Math.exp(z));
  }

  var input = new Float64Array(2);

  function forward(net, x, y, act) {
    input[0] = x; input[1] = y;
    var prev = input;
    for (var l = 0; l < net.length; l++) {
      var L = net[l], last = l === net.length - 1;
      for (var j = 0; j < L.nout; j++) {
        var s = L.b[j];
        for (var i = 0; i < L.nin; i++) s += L.w[i * L.nout + j] * prev[i];
        L.a[j] = last ? sigmoid(s) : act.f(s);
      }
      prev = L.a;
    }
    return net[net.length - 1].a[0];
  }

  /* La dérivée de l'entropie croisée composée avec la sigmoïde se simplifie
     en (prédiction − cible) : c'est ce qui amorce la rétropropagation. */
  function backward(net, target, act) {
    var out = net[net.length - 1];
    out.d[0] = out.a[0] - target;

    for (var l = net.length - 1; l >= 0; l--) {
      var L = net[l];
      var prev = l === 0 ? input : net[l - 1].a;
      for (var j = 0; j < L.nout; j++) {
        var d = L.d[j];
        L.gb[j] += d;
        for (var i = 0; i < L.nin; i++) L.gw[i * L.nout + j] += d * prev[i];
      }
      if (l > 0) {
        var P = net[l - 1];
        for (var p = 0; p < P.nout; p++) {
          var s = 0;
          for (var q = 0; q < L.nout; q++) s += L.w[p * L.nout + q] * L.d[q];
          P.d[p] = s * act.d(P.a[p]);
        }
      }
    }
  }

  function zeroGrad(net) {
    for (var l = 0; l < net.length; l++) {
      net[l].gw.fill(0);
      net[l].gb.fill(0);
    }
  }

  function applyUpdate(net, opt, lr, scale, t) {
    var b1 = 0.9, b2 = 0.999, eps = 1e-8;
    var c1 = 1 - Math.pow(b1, t), c2 = 1 - Math.pow(b2, t);

    for (var l = 0; l < net.length; l++) {
      var L = net[l];
      update(L.w, L.gw, L.mw, L.vw);
      update(L.b, L.gb, L.mb, L.vb);
    }

    function update(p, g, m, v) {
      for (var i = 0; i < p.length; i++) {
        var grad = g[i] * scale;
        if (opt === 'sgd') {
          p[i] -= lr * grad;
        } else if (opt === 'momentum') {
          m[i] = b1 * m[i] + grad;
          p[i] -= lr * m[i];
        } else {
          m[i] = b1 * m[i] + (1 - b1) * grad;
          v[i] = b2 * v[i] + (1 - b2) * grad * grad;
          p[i] -= lr * (m[i] / c1) / (Math.sqrt(v[i] / c2) + eps);
        }
      }
    }
  }

  // -------------------------------------------------------------------- état

  var el = {
    canvas: root.querySelector('[data-lab-canvas]'),
    curve: root.querySelector('[data-lab-curve]'),
    steps: root.querySelector('[data-lab-steps]'),
    loss: root.querySelector('[data-lab-loss]'),
    acc: root.querySelector('[data-lab-acc]'),
    run: root.querySelector('[data-lab-run]'),
    reset: root.querySelector('[data-lab-reset]'),
    lrOut: root.querySelector('[data-lab-lrout]')
  };

  var ctx = el.canvas.getContext('2d');
  var curveCtx = el.curve.getContext('2d');

  var opts = {};
  root.querySelectorAll('[data-lab-control]').forEach(function (node) {
    opts[node.getAttribute('data-lab-control')] = node;
  });

  var state = {
    points: [],
    net: null,
    act: ACTIVATIONS.tanh,
    losses: [],
    step: 0,
    running: false,
    paintClass: 1,
    frame: 0
  };

  var field = new Float64Array(GRID * GRID);
  var fieldCanvas = document.createElement('canvas');
  fieldCanvas.width = fieldCanvas.height = GRID;
  var fieldCtx = fieldCanvas.getContext('2d');
  var fieldImage = fieldCtx.createImageData(GRID, GRID);

  function learningRate() {
    return Math.pow(10, parseFloat(opts.lr.value));
  }

  function rebuild(newPoints) {
    var widths = opts.arch.value.split(',').map(Number);
    state.net = createNet([2].concat(widths, [1]));
    state.act = ACTIVATIONS[opts.activation.value];
    state.losses = [];
    state.step = 0;
    if (newPoints) state.points = DATASETS[opts.dataset.value](POINTS);
    el.lrOut.textContent = learningRate().toFixed(3).replace('.', ',');
    render();
    updateReadouts();
  }

  // -------------------------------------------------------------- entraînement

  function trainStep() {
    var pts = state.points;
    if (!pts.length) return;

    zeroGrad(state.net);
    var n = Math.min(BATCH, pts.length);
    for (var k = 0; k < n; k++) {
      var p = pts[(Math.random() * pts.length) | 0];
      forward(state.net, p.x, p.y, state.act);
      backward(state.net, p.label, state.act);
    }
    state.step++;
    applyUpdate(state.net, opts.optimizer.value, learningRate(), 1 / n, state.step);
  }

  function evaluate() {
    var pts = state.points, loss = 0, right = 0;
    for (var i = 0; i < pts.length; i++) {
      var p = forward(state.net, pts[i].x, pts[i].y, state.act);
      var q = Math.min(Math.max(p, 1e-7), 1 - 1e-7);
      loss -= pts[i].label * Math.log(q) + (1 - pts[i].label) * Math.log(1 - q);
      if ((p >= 0.5 ? 1 : 0) === pts[i].label) right++;
    }
    return { loss: pts.length ? loss / pts.length : 0, acc: pts.length ? right / pts.length : 0 };
  }

  function updateReadouts() {
    var m = evaluate();
    state.losses.push(m.loss);
    if (state.losses.length > 600) state.losses.shift();
    el.steps.textContent = state.step.toLocaleString('fr-BE');
    el.loss.textContent = m.loss.toFixed(3).replace('.', ',');
    el.acc.textContent = Math.round(m.acc * 100) + ' %';
    drawCurve();
  }

  // ------------------------------------------------------------------ rendu

  function mix(a, b, t) {
    return [
      Math.round(a[0] + (b[0] - a[0]) * t),
      Math.round(a[1] + (b[1] - a[1]) * t),
      Math.round(a[2] + (b[2] - a[2]) * t)
    ];
  }

  function drawField() {
    var data = fieldImage.data;
    for (var gy = 0; gy < GRID; gy++) {
      var y = DOMAIN - (gy + 0.5) / GRID * 2 * DOMAIN;
      for (var gx = 0; gx < GRID; gx++) {
        var x = -DOMAIN + (gx + 0.5) / GRID * 2 * DOMAIN;
        var p = forward(state.net, x, y, state.act);
        field[gy * GRID + gx] = p;
        // Le blanc du papier au milieu, la teinte de la classe aux extrêmes.
        var c = p >= 0.5 ? mix(PAPER, WARM, (p - 0.5) * 1.15) : mix(PAPER, COOL, (0.5 - p) * 1.15);
        var o = (gy * GRID + gx) * 4;
        data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2]; data[o + 3] = 255;
      }
    }
    fieldCtx.putImageData(fieldImage, 0, 0);
  }

  function toScreen(v, size) {
    return (v + DOMAIN) / (2 * DOMAIN) * size;
  }

  /* Marching squares sur la grille déjà calculée : dans chaque cellule, on
     interpole les points où la prédiction vaut exactement 0,5 sur les arêtes,
     et on les relie deux à deux. */
  function traceBoundary(cell) {
    var edge = [0, 0, 0, 0, 0, 0, 0, 0];
    ctx.beginPath();
    for (var gy = 0; gy < GRID - 1; gy++) {
      for (var gx = 0; gx < GRID - 1; gx++) {
        var a = field[gy * GRID + gx] - 0.5;
        var b = field[gy * GRID + gx + 1] - 0.5;
        var c = field[(gy + 1) * GRID + gx + 1] - 0.5;
        var d = field[(gy + 1) * GRID + gx] - 0.5;
        var x0 = (gx + 0.5) * cell, y0 = (gy + 0.5) * cell;
        var n = 0;

        if (a * b < 0) { edge[n++] = x0 + cell * (-a / (b - a)); edge[n++] = y0; }
        if (b * c < 0) { edge[n++] = x0 + cell; edge[n++] = y0 + cell * (-b / (c - b)); }
        if (d * c < 0) { edge[n++] = x0 + cell * (-d / (c - d)); edge[n++] = y0 + cell; }
        if (a * d < 0) { edge[n++] = x0; edge[n++] = y0 + cell * (-a / (d - a)); }

        for (var k = 0; k + 3 < n; k += 4) {
          ctx.moveTo(edge[k], edge[k + 1]);
          ctx.lineTo(edge[k + 2], edge[k + 3]);
        }
      }
    }
    ctx.stroke();
  }

  function render(recompute) {
    var size = el.canvas.width;
    if (recompute !== false) drawField();

    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(fieldCanvas, 0, 0, size, size);
    ctx.restore();

    ctx.strokeStyle = 'rgba(23, 23, 26, 0.5)';
    ctx.lineWidth = Math.max(1.2, size / 420);
    traceBoundary(size / GRID);

    // Axes.
    ctx.strokeStyle = 'rgba(23, 23, 26, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(size / 2, 0); ctx.lineTo(size / 2, size);
    ctx.moveTo(0, size / 2); ctx.lineTo(size, size / 2);
    ctx.stroke();

    var radius = Math.max(3.5, size / 92);
    ctx.lineWidth = Math.max(1, size / 340);
    ctx.strokeStyle = 'rgba(247, 244, 237, 0.9)';
    for (var i = 0; i < state.points.length; i++) {
      var p = state.points[i];
      var col = p.label ? WARM : COOL;
      ctx.beginPath();
      ctx.arc(toScreen(p.x, size), size - toScreen(p.y, size), radius, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgb(' + col.join(',') + ')';
      ctx.fill();
      ctx.stroke();
    }
  }

  /* Le canvas est dimensionné en CSS ; on aligne la résolution interne sur la
     densité de l'écran pour que les points et le contour restent nets. */
  function fit() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = el.canvas.clientWidth;
    if (w) {
      var size = Math.round(w * dpr);
      if (el.canvas.width !== size) {
        el.canvas.width = size;
        el.canvas.height = size;
      }
    }
    var cw = el.curve.clientWidth, ch = el.curve.clientHeight;
    if (cw) {
      el.curve.width = Math.round(cw * dpr);
      el.curve.height = Math.round(ch * dpr);
    }
  }

  function drawCurve() {
    var w = el.curve.width, h = el.curve.height;
    curveCtx.clearRect(0, 0, w, h);
    var n = state.losses.length;
    if (n < 2) return;

    var top = 0;
    for (var i = 0; i < n; i++) top = Math.max(top, state.losses[i]);
    top = Math.max(top, 0.1) * 1.08;

    curveCtx.strokeStyle = 'rgba(23, 23, 26, 0.12)';
    curveCtx.lineWidth = 1;
    curveCtx.beginPath();
    curveCtx.moveTo(0, h - 1); curveCtx.lineTo(w, h - 1);
    curveCtx.stroke();

    curveCtx.strokeStyle = 'rgb(' + WARM.join(',') + ')';
    curveCtx.lineWidth = 2;
    curveCtx.beginPath();
    for (var j = 0; j < n; j++) {
      var x = (j / (n - 1)) * w;
      var y = h - 3 - (state.losses[j] / top) * (h - 8);
      if (j === 0) curveCtx.moveTo(x, y); else curveCtx.lineTo(x, y);
    }
    curveCtx.stroke();
  }

  // ------------------------------------------------------------------ boucle

  function loop() {
    if (!state.running) return;
    for (var k = 0; k < STEPS_PER_FRAME; k++) trainStep();
    state.frame++;
    // Le champ coûte GRID² passes avant : on le recalcule une image sur deux.
    render(state.frame % 2 === 0);
    if (state.frame % 4 === 0) updateReadouts();
    requestAnimationFrame(loop);
  }

  function setRunning(on) {
    state.running = on;
    el.run.textContent = on ? 'Mettre en pause' : 'Entraîner';
    if (on) requestAnimationFrame(loop);
  }

  // -------------------------------------------------------------- événements

  el.run.addEventListener('click', function () { setRunning(!state.running); });

  el.reset.addEventListener('click', function () {
    setRunning(false);
    rebuild(true);
  });

  opts.dataset.addEventListener('change', function () {
    setRunning(false);
    rebuild(true);
  });

  ['optimizer', 'arch', 'activation'].forEach(function (key) {
    opts[key].addEventListener('change', function () {
      var wasRunning = state.running;
      setRunning(false);
      rebuild(false);
      if (wasRunning) setRunning(true);
    });
  });

  opts.lr.addEventListener('input', function () {
    el.lrOut.textContent = learningRate().toFixed(3).replace('.', ',');
  });

  root.querySelectorAll('[data-lab-class]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      state.paintClass = Number(btn.getAttribute('data-lab-class'));
      root.querySelectorAll('[data-lab-class]').forEach(function (other) {
        other.classList.toggle('is-active', other === btn);
      });
    });
  });

  el.canvas.addEventListener('click', function (event) {
    var rect = el.canvas.getBoundingClientRect();
    var size = el.canvas.width;
    var px = (event.clientX - rect.left) / rect.width * size;
    var py = (event.clientY - rect.top) / rect.height * size;
    state.points.push({
      x: px / size * 2 * DOMAIN - DOMAIN,
      y: DOMAIN - py / size * 2 * DOMAIN,
      label: state.paintClass
    });
    render();
    updateReadouts();
  });

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      fit();
      render();
      drawCurve();
    }, 120);
  });

  fit();
  rebuild(true);

  // On n'entraîne que si la démo est visible : inutile de faire chauffer un
  // portable pour une section restée hors de l'écran. L'état choisi par le
  // visiteur est conservé lorsqu'il revient dessus.
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
    el.run.addEventListener('click', function () { wanted = state.running; });
  } else {
    setRunning(true);
  }
})();
