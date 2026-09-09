/* Reconnaissance d'un chiffre tracé à la souris.

   Le modèle est un perceptron 784-128-10 entraîné hors ligne sur MNIST, dont
   les poids sont quantifiés sur 8 bits. L'essentiel du travail n'est pas
   l'inférence (deux produits matriciels) mais le prétraitement : un chiffre
   dessiné dans un grand cadre ne ressemble à une image MNIST qu'une fois
   recadré, mis à l'échelle sur 20 pixels et recentré sur son centre de masse. */

(function () {
  'use strict';

  var root = document.querySelector('[data-digits]');
  if (!root) return;

  // Libelles et format des nombres fournis par le gabarit, une fois par langue.
  var LOCALE = root.getAttribute('data-locale') || 'fr-BE';
  var LABEL_STATUS = root.getAttribute('data-label-status') || '{arch} · {acc} %';
  var LABEL_ERROR = root.getAttribute('data-label-error') || '';

  var SIDE = 28;
  var FIT = 20;              // le chiffre occupe 20 px sur 28, comme dans MNIST
  var THRESHOLD = 24;

  var pad = root.querySelector('[data-digits-canvas]');
  var preview = root.querySelector('[data-digits-preview]');
  var answer = root.querySelector('[data-digits-answer]');
  var status = root.querySelector('[data-digits-status]');
  var rows = root.querySelectorAll('[data-digits-bars] .bar');
  var clearBtn = root.querySelector('[data-digits-clear]');

  var ctx = pad.getContext('2d');
  var previewCtx = preview.getContext('2d');

  // Calque parallèle en blanc sur noir : c'est lui qu'on échantillonne, ce qui
  // évite d'avoir à retrancher la couleur de fond du calque visible.
  var ink = document.createElement('canvas');
  ink.width = pad.width;
  ink.height = pad.height;
  var inkCtx = ink.getContext('2d', { willReadFrequently: true });

  var box = document.createElement('canvas');
  box.width = box.height = SIDE;
  var boxCtx = box.getContext('2d', { willReadFrequently: true });

  var model = null;
  var drawing = false;
  var lastPredict = 0;
  var pixels = new Float32Array(SIDE * SIDE);
  var shifted = new Float32Array(SIDE * SIDE);

  // -------------------------------------------------------------- le modèle

  function decode(entry, length) {
    var bin = atob(entry.data);
    var out = new Float32Array(length);
    for (var i = 0; i < length; i++) {
      var v = bin.charCodeAt(i);
      out[i] = (v > 127 ? v - 256 : v) * entry.scale;
    }
    return out;
  }

  function load() {
    fetch(root.getAttribute('data-weights'))
      .then(function (res) {
        if (!res.ok) throw new Error(res.status);
        return res.json();
      })
      .then(function (raw) {
        var nin = raw.arch[0], hidden = raw.arch[1], nout = raw.arch[2];
        model = {
          hidden: hidden,
          nout: nout,
          w1: decode(raw.w1, nin * hidden),
          b1: Float32Array.from(raw.b1),
          w2: decode(raw.w2, hidden * nout),
          b2: Float32Array.from(raw.b2),
          h: new Float32Array(hidden),
          logits: new Float32Array(nout)
        };
        status.textContent = LABEL_STATUS
          .replace('{arch}', raw.arch.join('-'))
          .replace('{acc}', (Math.round(raw.acc * 1000) / 10).toLocaleString(LOCALE));
        // Le visiteur a pu dessiner pendant le telechargement des poids.
        run();
      })
      .catch(function () {
        status.textContent = LABEL_ERROR;
      });
  }

  function predict(x) {
    var h = model.h, w1 = model.w1, hidden = model.hidden;
    h.set(model.b1);
    for (var i = 0; i < x.length; i++) {
      var v = x[i];
      if (v === 0) continue;              // une image de chiffre est très creuse
      var off = i * hidden;
      for (var j = 0; j < hidden; j++) h[j] += v * w1[off + j];
    }
    for (var k = 0; k < hidden; k++) if (h[k] < 0) h[k] = 0;

    var logits = model.logits, w2 = model.w2, nout = model.nout;
    logits.set(model.b2);
    for (var m = 0; m < hidden; m++) {
      var hv = h[m];
      if (hv === 0) continue;
      var o = m * nout;
      for (var n = 0; n < nout; n++) logits[n] += hv * w2[o + n];
    }

    var top = -Infinity, s = 0, probs = new Float32Array(nout);
    for (var a = 0; a < nout; a++) if (logits[a] > top) top = logits[a];
    for (var b = 0; b < nout; b++) { probs[b] = Math.exp(logits[b] - top); s += probs[b]; }
    for (var c = 0; c < nout; c++) probs[c] /= s;
    return probs;
  }

  // -------------------------------------------------------- prétraitement

  /* Retourne true si un tracé exploitable a été extrait dans `pixels`. */
  function extract() {
    var w = ink.width, h = ink.height;
    var src = inkCtx.getImageData(0, 0, w, h).data;

    var minX = w, minY = h, maxX = -1, maxY = -1;
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        if (src[(y * w + x) * 4] > THRESHOLD) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return false;

    var bw = maxX - minX + 1, bh = maxY - minY + 1;
    var scale = FIT / Math.max(bw, bh);
    var tw = Math.max(1, Math.round(bw * scale));
    var th = Math.max(1, Math.round(bh * scale));

    boxCtx.fillStyle = '#000';
    boxCtx.fillRect(0, 0, SIDE, SIDE);
    boxCtx.imageSmoothingEnabled = true;
    boxCtx.imageSmoothingQuality = 'high';
    boxCtx.drawImage(ink, minX, minY, bw, bh,
      Math.round((SIDE - tw) / 2), Math.round((SIDE - th) / 2), tw, th);

    var cropped = boxCtx.getImageData(0, 0, SIDE, SIDE).data;
    var mass = 0, cx = 0, cy = 0;
    for (var i = 0; i < SIDE * SIDE; i++) {
      var v = cropped[i * 4] / 255;
      pixels[i] = v;
      mass += v;
      cx += v * (i % SIDE);
      cy += v * ((i / SIDE) | 0);
    }
    if (mass === 0) return false;

    // Recentrage sur le centre de masse, comme dans la préparation de MNIST.
    var dx = Math.round(SIDE / 2 - 0.5 - cx / mass);
    var dy = Math.round(SIDE / 2 - 0.5 - cy / mass);
    shifted.fill(0);
    for (var sy = 0; sy < SIDE; sy++) {
      var ty = sy + dy;
      if (ty < 0 || ty >= SIDE) continue;
      for (var sx = 0; sx < SIDE; sx++) {
        var tx = sx + dx;
        if (tx < 0 || tx >= SIDE) continue;
        shifted[ty * SIDE + tx] = pixels[sy * SIDE + sx];
      }
    }
    pixels.set(shifted);
    return true;
  }

  // ------------------------------------------------------------------ rendu

  function paintPreview() {
    var img = previewCtx.createImageData(SIDE, SIDE);
    for (var i = 0; i < SIDE * SIDE; i++) {
      var v = Math.round(pixels[i] * 255);
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = 255 - v;
      img.data[i * 4 + 3] = 255;
    }
    previewCtx.putImageData(img, 0, 0);
  }

  function showProbs(probs) {
    var best = 0;
    for (var i = 1; i < probs.length; i++) if (probs[i] > probs[best]) best = i;
    answer.textContent = String(best);

    for (var k = 0; k < rows.length; k++) {
      var p = probs[k];
      rows[k].querySelector('.bar__fill').style.width = (p * 100).toFixed(1) + '%';
      rows[k].querySelector('.bar__pct').textContent = Math.round(p * 100) + ' %';
      rows[k].classList.toggle('is-best', k === best);
    }
  }

  function reset() {
    ctx.clearRect(0, 0, pad.width, pad.height);
    inkCtx.fillStyle = '#000';
    inkCtx.fillRect(0, 0, ink.width, ink.height);
    pixels.fill(0);
    paintPreview();
    answer.textContent = '?';
    for (var k = 0; k < rows.length; k++) {
      rows[k].querySelector('.bar__fill').style.width = '0%';
      rows[k].querySelector('.bar__pct').textContent = '0 %';
      rows[k].classList.remove('is-best');
    }
  }

  function run() {
    if (!model) return;
    if (!extract()) { reset(); return; }
    paintPreview();
    showProbs(predict(pixels));
  }

  // ------------------------------------------------------------------ tracé

  function at(event) {
    var rect = pad.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / rect.width * pad.width,
      y: (event.clientY - rect.top) / rect.height * pad.height
    };
  }

  function begin(ctx2d, colour, width) {
    ctx2d.strokeStyle = colour;
    ctx2d.lineWidth = width;
    ctx2d.lineCap = 'round';
    ctx2d.lineJoin = 'round';
  }

  var STROKE = pad.width * 0.078;
  begin(ctx, '#17171a', STROKE);
  begin(inkCtx, '#fff', STROKE);

  pad.addEventListener('pointerdown', function (event) {
    event.preventDefault();
    // La capture echoue si le pointeur n'est plus actif : ce n'est pas une
    // raison pour perdre le trait.
    try { pad.setPointerCapture(event.pointerId); } catch (err) { /* sans capture */ }
    drawing = true;
    var p = at(event);
    ctx.beginPath(); ctx.moveTo(p.x, p.y);
    inkCtx.beginPath(); inkCtx.moveTo(p.x, p.y);
    // Un simple clic doit laisser une marque, pas rien.
    ctx.lineTo(p.x + 0.01, p.y); ctx.stroke();
    inkCtx.lineTo(p.x + 0.01, p.y); inkCtx.stroke();
  });

  pad.addEventListener('pointermove', function (event) {
    if (!drawing) return;
    var p = at(event);
    ctx.lineTo(p.x, p.y); ctx.stroke();
    inkCtx.lineTo(p.x, p.y); inkCtx.stroke();
    var now = performance.now();
    if (now - lastPredict > 140) { lastPredict = now; run(); }
  });

  function end(event) {
    if (!drawing) return;
    drawing = false;
    try {
      if (event && pad.hasPointerCapture(event.pointerId)) pad.releasePointerCapture(event.pointerId);
    } catch (err) { /* deja relache */ }
    run();
  }

  pad.addEventListener('pointerup', end);
  pad.addEventListener('pointercancel', end);

  clearBtn.addEventListener('click', reset);

  reset();
  load();
})();
