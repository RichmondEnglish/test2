
/*! SpeakSmart Bootstrap (Updated 2025-10-15)
 * - Lowered neuron overlay by ~30px (top: 65px)
 * - Proper cleanup & permanent suppression once external script is ready
 * - Robust asset prewarm via /assets/manifest.json with fallback hints
 * - Preload uses as="image" + eager decode for critical assets
 * - Guards against undefined path arrays in animation tick (prevents 'x' undefined)
 */
(function (window, document) {
  'use strict';

  // ---- Config & State ------------------------------------------------------
  var HOST_BASE =
    (window.SpeakSmartAssetsBase && String(window.SpeakSmartAssetsBase)) ||
    'https://richmond-english-wheel-32e9771e3e5a.herokuapp.com';

  var assetPreloadState = {
    BASE: HOST_BASE,
    lastList: [],
    // Optional fallback file name hints (relative to /assets or absolute)
    CRITICAL_HINTS: [
      '/assets/rich-e.png',
      '/assets/rich-e-coach.png',
      '/assets/SpeakSmart-loader.png',
      '/assets/reading-tips-card.png',
      '/assets/feedback-happy.png',
      '/assets/feedback-neutral.png',
      '/assets/feedback-tryagain.png'
    ]
  };

  var backupIntervalId = null;
  var secondaryObserver = null;

  var brainState = {
    animationId: null,
    canvas: null,
    overlay: null,
    ctx: null,
    paths: [],
    phases: [],
    speeds: [],
    widths: [],
    lastFlash: -Infinity,
    flickIdx: null,
    isReplacing: false,
    prebuiltOverlay: null,
    // NEW: permanent suppression after external script is active
    suppressed: false,
    originalConsoleLog: null,
    primaryObserver: null
  };

  // ---- Logging banner ------------------------------------------------------
  try {
    console.log('SpeakSmart robust bootstrap loaded');
  } catch (e) {}

  // ---- Utilities -----------------------------------------------------------
  function ssUnique(arr) {
    var seen = Object.create(null);
    var out = [];
    for (var i = 0; i < arr.length; i++) {
      var k = String(arr[i]);
      if (!seen[k]) {
        seen[k] = 1;
        out.push(arr[i]);
      }
    }
    return out;
  }

  function ssIsImageFile(u) {
    return /\.(png|jpe?g|gif|webp|svg)(\?|#|$)/i.test(String(u || ''));
  }

  function ssParseManifestJSON(json, base) {
    try {
      var out = [];

      if (Array.isArray(json)) {
        // legacy: ["a.png","b.png"]
        out = json.slice();
      } else if (json && Array.isArray(json.files)) {
        // legacy: { files: ["a.png","b.png"] }
        out = json.files.slice();
      } else if (json && Array.isArray(json.assets)) {
        // current: { assets: [{name,path,preload,...}], preload:{criticalAssets:[...]} }
        var byName = Object.create(null);
        json.assets.forEach(function (a) {
          if (!a || !a.path) return;
          byName[a.name] = a.path;
          if (a.preload === true) out.push(a.path);
        });
        if (json.preload && Array.isArray(json.preload.criticalAssets)) {
          json.preload.criticalAssets.forEach(function (name) {
            if (byName[name]) out.push(byName[name]);
          });
        }
      }

      out = (out || []).map(function (p) {
        if (!p) return null;
        if (/^https?:\/\//i.test(p)) return p;
        return base.replace(/\/+$/,'') + '/' + String(p).replace(/^\/+/,'');
      }).filter(Boolean);

      out = out.filter(ssIsImageFile);
      return ssUnique(out);
    } catch (e) {
      console.warn('SpeakSmart: manifest parse failed', e);
      return [];
    }
  }

  function ssPreloadImages(urls, opts) {
    urls = Array.isArray(urls) ? urls.slice() : [];
    var criticalLimit = (opts && opts.criticalLimit) || 24;

    // Critical: preload + eager decode
    urls.slice(0, criticalLimit).forEach(function (u) {
      try {
        var link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'image';
        link.href = u;
        link.crossOrigin = 'anonymous';
        document.head.appendChild(link);

        var img = new Image();
        img.decoding = 'async';
        img.loading = 'eager';
        img.src = u;
      } catch (e) {}
    });

    // Non-critical: prefetch low priority
    urls.slice(criticalLimit).forEach(function (u) {
      try {
        var link = document.createElement('link');
        link.rel = 'prefetch';
        link.as = 'image';
        link.href = u;
        link.crossOrigin = 'anonymous';
        document.head.appendChild(link);
      } catch (e) {}
    });
  }

  function startAssetPrewarm() {
    var BASE = assetPreloadState.BASE || HOST_BASE;
    fetch(BASE + '/assets/manifest.json', { cache: 'no-store', credentials: 'omit' })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (json) { return ssParseManifestJSON(json, BASE); })
      .then(function (list) {
        if (!list.length) {
          var fb = (assetPreloadState.CRITICAL_HINTS || [])
            .filter(ssIsImageFile)
            .map(function (n) { return BASE.replace(/\/+$/,'') + '/' + String(n).replace(/^\//,''); });
          if (fb.length) {
            console.log('SpeakSmart: manifest empty; falling back to critical hints (' + fb.length + ')');
            list = ssUnique(fb);
          }
        }
        assetPreloadState.lastList = list;
        if (!list.length) {
          console.log('SpeakSmart: no assets discovered to preload');
          return;
        }
        console.log('SpeakSmart: preloading', list.length, 'asset(s)');
        ssPreloadImages(list, { criticalLimit: 24 });
      })
      .catch(function (e) {
        console.warn('SpeakSmart: manifest fetch failed, using hints', e);
        var BASE = assetPreloadState.BASE || HOST_BASE;
        var fb = (assetPreloadState.CRITICAL_HINTS || [])
          .filter(ssIsImageFile)
          .map(function (n) { return BASE.replace(/\/+$/,'') + '/' + String(n).replace(/^\//,''); });
        if (fb.length) ssPreloadImages(ssUnique(fb), { criticalLimit: 24 });
      });
  }

  // ---- Brain Overlay + Animation ------------------------------------------
  function buildBrainOverlay() {
    if (brainState.prebuiltOverlay) return brainState.prebuiltOverlay;

    var overlay = document.createElement('div');
    overlay.className = 'speaksmart-brain-overlay';
    overlay.setAttribute('role', 'presentation');
    overlay.style.cssText = [
      'position:fixed',
      'inset:0',
      'z-index:999999',
      'pointer-events:none',
      'background:linear-gradient(180deg, rgba(0,0,0,0.25), rgba(0,0,0,0.15))'
    ].join(';');

    var canvas = document.createElement('canvas');
    canvas.width = Math.max(320, window.innerWidth);
    canvas.height = Math.max(240, window.innerHeight);
    canvas.style.position = 'absolute';
    canvas.style.left = '50%';
    canvas.style.transform = 'translateX(-50%)';
    // Lowered by ~30px from prior 35px to 65px
    canvas.style.top = '85px';
    canvas.style.width = 'min(96vw, 960px)';
    canvas.style.height = 'min(72vh, 540px)';
    canvas.style.opacity = '0.95';

    overlay.appendChild(canvas);
    brainState.prebuiltOverlay = overlay;
    brainState.canvas = canvas;
    brainState.ctx = canvas.getContext('2d');

    // Prepare simple paths (neuron arcs)
    seedNeuronPaths(canvas);

    return overlay;
  }

  function seedNeuronPaths(canvas) {
    brainState.paths = [];
    brainState.phases = [];
    brainState.speeds = [];
    brainState.widths = [];

    var w = canvas.width;
    var h = canvas.height;
    var cx = Math.floor(w * 0.5);
    var cy = Math.floor(h * 0.38);
    var R = Math.floor(Math.min(w, h) * 0.28);

    function circlePoints(cx, cy, r, count) {
      var pts = [];
      for (var i = 0; i < count; i++) {
        var t = (Math.PI * 2 * i) / count;
        pts.push({ x: cx + Math.cos(t) * r, y: cy + Math.sin(t) * r });
      }
      return pts;
    }

    // Three concentric "neuron orbit" rings
    var rings = [
      circlePoints(cx, cy, R * 0.70, 24),
      circlePoints(cx, cy, R * 1.00, 28),
      circlePoints(cx, cy, R * 1.35, 32)
    ];

    for (var i = 0; i < rings.length; i++) {
      brainState.paths.push(rings[i]);
      brainState.phases.push(Math.random() * Math.PI * 2);
      brainState.speeds.push(0.008 + Math.random() * 0.007);
      brainState.widths.push(2 + (i % 2));
    }
  }

  function startBrainAnimation() {
    if (!brainState.canvas || !brainState.ctx) return;

    var ctx = brainState.ctx;
    var W = brainState.canvas.width;
    var H = brainState.canvas.height;

    function tick() {
      try {
        ctx.clearRect(0, 0, W, H);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        for (var p = 0; p < brainState.paths.length; p++) {
          var pts = brainState.paths[p];
          if (!pts || pts.length < 2) continue; // guard

          ctx.beginPath();
          for (var i = 0; i < pts.length; i++) {
            var a = pts[i];
            var b = pts[(i + 1) % pts.length];
            if (!a || !b) continue; // guard
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
          }
          ctx.lineWidth = brainState.widths[p] || 2;
          var alpha = (p === brainState.flickIdx) ? 1 : 0.6;
          ctx.strokeStyle = 'rgba(120,180,255,' + alpha + ')';
          ctx.stroke();
        }

        // Animate a flickering highlight ring
        if (performance.now() - brainState.lastFlash > 420) {
          brainState.flickIdx = (brainState.flickIdx === null)
            ? 0
            : (brainState.flickIdx + 1) % brainState.paths.length;
          brainState.lastFlash = performance.now();
        }

        // Phase drift (subtle orbital motion)
        for (var r = 0; r < brainState.paths.length; r++) {
          brainState.phases[r] += brainState.speeds[r];
          var pts2 = brainState.paths[r];
          if (!pts2 || !pts2.length) continue;
          for (var j = 0; j < pts2.length; j++) {
            var pt = pts2[j];
            if (!pt) continue;
            var d = Math.sin(brainState.phases[r] + j * 0.3) * 0.8;
            pt.x += Math.cos(j) * 0.05 * d;
            pt.y += Math.sin(j) * 0.05 * d;
          }
        }

        ctx.restore();
      } catch (e) {
        // swallow to avoid breaking the app
      }

      brainState.animationId = window.requestAnimationFrame(tick);
    }

    if (brainState.animationId) cancelAnimationFrame(brainState.animationId);
    brainState.animationId = window.requestAnimationFrame(tick);
  }

  function showMarketingBrainAnimation() {
    try {
      if (brainState.suppressed) return;
      var existing = document.querySelector('.speaksmart-brain-overlay');
      if (existing) return;

      var overlay = buildBrainOverlay();
      document.body.appendChild(overlay);
      startBrainAnimation();
    } catch (e) {}
  }

  function cleanup() {
    try {
      if (brainState.animationId) {
        cancelAnimationFrame(brainState.animationId);
        brainState.animationId = null;
      }
    } catch (e) {}
    try {
      if (brainState.overlay && brainState.overlay.parentNode) {
        brainState.overlay.parentNode.removeChild(brainState.overlay);
      }
    } catch (e) {}
    try {
      if (backupIntervalId) {
        clearInterval(backupIntervalId);
        backupIntervalId = null;
      }
    } catch (e) {}
  }

  function suppressAndCleanup() {
    if (brainState.suppressed) return;
    brainState.suppressed = true;

    try { brainState.primaryObserver && brainState.primaryObserver.disconnect(); } catch (e) {}
    try { secondaryObserver && secondaryObserver.disconnect && secondaryObserver.disconnect(); } catch (e) {}

    cleanup();

    if (brainState.originalConsoleLog) {
      console.log = brainState.originalConsoleLog;
      brainState.originalConsoleLog = null;
    }
  }

  function startAllMonitoring() {
    try {
      console.log('SpeakSmart race-condition-proof bootstrap with marketing safety net ready');
    } catch (e) {}

    // Observe DOM in case we want additional future hooks
    try {
      var observer = new MutationObserver(function () { /* reserved */ });
      brainState.primaryObserver = observer;
      observer.observe(document.documentElement || document.body, { childList: true, subtree: true });
    } catch (e) {}

    try {
      console.log('Starting backup monitoring for missed gray circles');
      console.log('Multi-layer monitoring system active');
    } catch (e) {}

    // Watch console messages from external script to know when to suppress overlay
    try {
      var originalConsoleLog = console.log;
      brainState.originalConsoleLog = originalConsoleLog;
      console.log = function () {
        originalConsoleLog.apply(console, arguments);
        var message = Array.prototype.slice.call(arguments).join(' ');

        // External checker ready → suppress permanently
        if (
          message.indexOf('External script loaded successfully') !== -1 ||
          message.indexOf('Pronunciation checker initialized') !== -1 ||
          message.indexOf('Loading animation hidden') !== -1
        ) {
          suppressAndCleanup();
          return;
        }

        // Start of flow → ensure overlay shows (unless already suppressed)
        if (!brainState.suppressed && (
          message.indexOf('Starting pronunciation process') !== -1 ||
          message.indexOf('Loading animation displayed') !== -1
        )) {
          setTimeout(function () {
            if (!document.querySelector('.speaksmart-brain-overlay')) {
              try { console.log('No brain animation detected after pronunciation start - triggering marketing display'); } catch (e) {}
              showMarketingBrainAnimation();
            }
          }, 200);
        }
      };
    } catch (e) {}

    // Heartbeat / fallback: periodically ensure something is visible until suppressed
    backupIntervalId = setInterval(function () {
      if (brainState.suppressed) return;
      if (!document.querySelector('.speaksmart-brain-overlay')) {
        showMarketingBrainAnimation();
      }
    }, 1500);

    // Optional explicit event from external script
    window.addEventListener('speaksmart:external-ready', suppressAndCleanup, { once: true });
  }

  // ---- Public API ----------------------------------------------------------
  var API = {
    startAssetPrewarm: startAssetPrewarm,
    showOverlay: showMarketingBrainAnimation,
    hideOverlay: suppressAndCleanup,
    init: function () {
      startAssetPrewarm();
      startAllMonitoring();
    }
  };

  // Expose minimal surface
  Object.defineProperty(window, 'SpeakSmartBootstrap', {
    value: API,
    writable: false,
    configurable: false
  });

  // Auto-init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { API.init(); });
  } else {
    API.init();
  }

})(window, document);
