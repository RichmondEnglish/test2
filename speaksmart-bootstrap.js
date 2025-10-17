/*  SpeakSmart Race-Condition-Proof Bootstrap with Marketing Safety Net */
(function () {
  if (window.__speakSmartPatched) return;
  window.__speakSmartPatched = true;

  console.log('SpeakSmart robust bootstrap loaded');

  // === [ANCHOR: SPEAKSMART ELEMENT MARKER SYSTEM] ===
  // Marker system to identify elements created by SpeakSmart scripts
  window.SpeakSmartElementMarker = {
    marker: 'data-speaks-smart-element',
    markerValue: 'speaksmart-loaded',

    // Mark an element as created by SpeakSmart system
    markElement: function(element) {
      if (element && element.setAttribute) {
        element.setAttribute(this.marker, this.markerValue);
        console.log('[SPEAKSMART-MARKER] Marked element:', element.tagName, element.id || element.className);
      }
    },

    // Mark all child elements of a container
    markContainer: function(container) {
      if (container && container.querySelectorAll) {
        const elements = container.querySelectorAll('*');
        elements.forEach(element => {
          this.markElement(element);
        });
      }
    },

    // Check if element is marked as SpeakSmart
    isMarked: function(element) {
      return element && element.hasAttribute && element.hasAttribute(this.marker);
    },

    // Enhanced cleanup that only removes marked elements
    cleanupMarkedElements: function() {
      console.log('[SPEAKSMART-MARKER] Starting cleanup of marked elements');

      const markedElements = document.querySelectorAll(`[${this.marker}="${this.markerValue}"]`);
      let removedCount = 0;

      markedElements.forEach(element => {
        if (element.parentNode) {
          element.parentNode.removeChild(element);
          removedCount++;
        }
      });

      console.log(`[SPEAKSMART-MARKER] Removed ${removedCount} marked elements`);
      return removedCount;
    }
  };

  // === [ANCHOR: ENHANCED SCRIPT LOADING] ===
  // Override the original script loading to add markers
  const originalCreateElement = document.createElement;
  document.createElement = function(tagName, options) {
    const element = originalCreateElement.call(document, tagName, options);

    // Mark script elements that are loaded through our system
    if (tagName.toLowerCase() === 'script' &&
        element.src &&
        (element.src.includes('speaksmart') || element.src.includes('pronunciation'))) {

      // Add a load listener to mark elements created by this script
      element.onload = function() {
        console.log('[SPEAKSMART-MARKER] Script loaded, will mark its elements');

        // Set a timeout to mark elements after they're created
        setTimeout(() => {
          window.SpeakSmartElementMarker.markContainer(document.body);
        }, 100);
      };
    }

    return element;
  };

  // Brain animation state
  var brainState = {
    animationId: null,
    canvas: null,
    overlay: null,
    paths: [],
    phases: [],
    speeds: [],
    widths: [],
    lastFlash: -Infinity,
    flickIdx: null,
    isReplacing: false,
    prebuiltOverlay: null,  // Pre-built overlay ready for instant swap
    // --- NEW ---
    suppressed: false,       // once external checker is ready, never show overlay again
    originalConsoleLog: null,
    primaryObserver: null
  };

  /* -----------------------------------------------------------------------
   *  ASSET PRELOAD & CACHE WARMING (images for bubbles, badges, etc.)
   *  Host is different from where this bootstrap lives.
   * -------------------------------------------------------------------- */

  var assetPreloadState = {
    HOST: 'https://richmond-english-wheel-32e9771e3e5a.herokuapp.com',
    BASE: 'https://richmond-english-wheel-32e9771e3e5a.herokuapp.com/assets/',
    MANIFEST_URL: 'https://richmond-english-wheel-32e9771e3e5a.herokuapp.com/assets/manifest.json',
    MANIFEST_JS_URL: 'https://richmond-english-wheel-32e9771e3e5a.herokuapp.com/assets/manifest.js',
    // If manifest/index scrape fail, we'll still warm these:
    CRITICAL_HINTS: [
      'SpeakSmart-loader.png',
      'speaksmart-loading.png','rich-e.png','rich-e-detective.png',
      'rich-e-coach.png','rich-e-mechanic.png',
      'rich-e-reading-tips.png','rich-e-reading-tips2.png','rich-e-OP1.png', 'rich-e-2star.png', 'rich-e-3star.png', 'rich-e-4star.png', 'rich-e-5star.png'
    ],
    LOADER_IMAGE: 'SpeakSmart-loader.png',
    imgRefs: [],
    lastList: []
  };

  (function preconnectToAssets() {
    try {
      var head = document.head || document.getElementsByTagName('head')[0];
      if (!head) return;
      var l1 = document.createElement('link');
      l1.rel = 'preconnect';
      l1.href = assetPreloadState.HOST;
      l1.crossOrigin = 'anonymous';
      head.appendChild(l1);

      var l2 = document.createElement('link');
      l2.rel = 'dns-prefetch';
      l2.href = assetPreloadState.HOST;
      head.appendChild(l2);
    } catch (e) {}
  })();

  function ssInsertPreloadLink(href) {
    try {
      var head = document.head || document.getElementsByTagName('head')[0];
      if (!head) return;
      var link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = href;
      link.crossOrigin = 'anonymous'; // safe if any canvas draws later
      head.appendChild(link);
    } catch (e) {}
  }

  function ssWarmImage(href) {
    var img = new Image();
    // img.crossOrigin = 'anonymous'; // uncomment if you draw to <canvas>
    img.decoding = 'async';
    img.loading = 'eager';
    img.fetchPriority = 'high';
    img.src = href;
    assetPreloadState.imgRefs.push(img); // keep ref to avoid GC
  }

  function ssIsImageFile(name) {
    return /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(name);
  }

  function ssFetchManifestList() {
    return fetch(assetPreloadState.MANIFEST_URL, { mode: 'cors' })
      .then(function(r){ if (!r.ok) throw new Error('no manifest'); return r.json(); })
      .then(function(json){
        var list = Array.isArray(json) ? json : (json.files || []);
        return list.filter(ssIsImageFile).map(function(name){
          return assetPreloadState.BASE + name.replace(/^\//,'');
        });
      });
  }
  function ssFetchManifestViaScript() {
    return new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      var done = false;
      function cleanup() {
        try { if (script && script.parentNode) script.parentNode.removeChild(script); } catch (e) {}
        try { delete window.SPEAKSMART_ASSETS; } catch (e) {}
        try { delete window.SpeakSmartAssets; } catch (e) {}
      }
      script.async = true;
      script.src = assetPreloadState.MANIFEST_JS_URL + '?cb=' + Date.now();
      script.onload = function () {
        if (done) return;
        done = true;
        try {
          var arr = window.SPEAKSMART_ASSETS || window.SpeakSmartAssets;
          if (Array.isArray(arr) && arr.length) {
            var list = arr.filter(ssIsImageFile).map(function (name) {
              return assetPreloadState.BASE + String(name).replace(/^\//, '');
            });
            cleanup();
            resolve(list);
            return;
          }
          cleanup();
          reject(new Error('manifest.js loaded but no usable array found'));
        } catch (err) {
          cleanup();
          reject(err);
        }
      };
      script.onerror = function () {
        if (done) return;
        done = true;
        cleanup();
        reject(new Error('manifest.js failed to load'));
      };
      (document.head || document.documentElement).appendChild(script);
    });
  }


  function ssScrapeDirectoryIndex() {
    return fetch(assetPreloadState.BASE, { mode: 'cors' })
      .then(function(r){ if (!r.ok) throw new Error('no index'); return r.text(); })
      .then(function(html){
        var out = [];
        var re = /href\s*=\s*"(.*?)"/ig, m;
        while ((m = re.exec(html))) {
          var href = m[1];
          if (ssIsImageFile(href)) {
            if (!/^https?:\/\//i.test(href)) href = assetPreloadState.BASE + href.replace(/^\//,'');
            out.push(href);
          }
        }
        if (!out.length) throw new Error('no images in index');
        return out;
      });
  }

  function ssFallbackList() {
    var list = (assetPreloadState.CRITICAL_HINTS || []).filter(ssIsImageFile).map(function(n){
      return assetPreloadState.BASE + n.replace(/^\//,'');
    });
    return Promise.resolve(list);
  }

  function ssUnique(list) {
    var seen = Object.create(null), out = [];
    for (var i=0;i<list.length;i++){
      var x = list[i];
      if (!seen[x]) { seen[x] = 1; out.push(x); }
    }
    return out;
  }

  function ssPreloadImages(urls, opts) {
    opts = opts || {};
    var criticalCount = Math.min(urls.length, opts.criticalLimit || 24);

    // Preload the first N aggressively
    for (var i=0; i<criticalCount; i++) {
      ssInsertPreloadLink(urls[i]);
      ssWarmImage(urls[i]);
    }

    // Warm the rest during idle time
    var rest = urls.slice(criticalCount);
    var idle = window.requestIdleCallback || function(cb){ return setTimeout(function(){ cb({didTimeout:true,timeRemaining:function(){return 0;}}); }, 250); };
    idle(function(){
      for (var j=0; j<rest.length; j++) ssWarmImage(rest[j]);
    });
  }

  function startAssetPrewarm() {
    if (navigator.connection && navigator.connection.saveData) {
      console.log('SpeakSmart: saveData on; skipping heavy preloads');
      return;
    }

    ssFetchManifestList()
      .catch(function(){ return ssFetchManifestViaScript(); })
      .catch(function(){ return ssScrapeDirectoryIndex(); })
      .catch(function(){ return ssFallbackList(); })
      .then(function(list){
        list = ssUnique(list);

        // If manifest/js/scrape returned empty, fall back to critical hints
        if (!list.length) {
          var fb = (assetPreloadState.CRITICAL_HINTS || [])
            .filter(ssIsImageFile)
            .map(function(n){ return assetPreloadState.BASE + String(n).replace(/^\//,''); });
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
      .catch(function(err){
        console.log('SpeakSmart: asset prewarm error:', err && err.message);
      });
  }

  // Debug hook (optional)
  window.SpeakSmartPreload = {
    status: function(){
      return {
        discovered: assetPreloadState.lastList.slice(),
        refsHeld: assetPreloadState.imgRefs.length
      };
    }
  };

  // Kick off asset warmup ASAP without blocking anything critical
  try { setTimeout(startAssetPrewarm, 0); } catch(e) {}

  // Animation constants
  var FLASH_MS = 90;
  var GAP_MS = 240;

  /* -----------------------------------------------------------------------
   *  BRAIN ANIMATION (overlay that replaces the gray circle loader)
   * -------------------------------------------------------------------- */

  function lerp(a, b, t) { return a + (b - a) * t; }

  function scale(pt) {
    var W = 480, H = 360;
    return { x: pt.x / 480 * W, y: pt.y / 360 * H };
  }

  function rotate(pt, pivot, deg) {
    var r = deg * Math.PI / 180;
    var c = Math.cos(r);
    var s = Math.sin(r);
    var dx = pt.x - pivot.x;
    var dy = pt.y - pivot.y;
    return {
      x: pivot.x + dx * c - dy * s,
      y: pivot.y + dx * s + dy * c
    };
  }

  function spline(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (var i = 1; i < pts.length; i++) {
      var mx = (pts[i - 1].x + pts[i].x) / 2;
      var my = (pts[i - 1].y + pts[i].y) / 2;
      ctx.quadraticCurveTo(pts[i - 1].x, pts[i - 1].y, mx, my);
    }
    ctx.stroke();
  }

  function buildBrainOverlay() {
    var brainOverlay = document.createElement('div');
    brainOverlay.className = 'speaksmart-brain-overlay';
    brainOverlay.style.position = 'fixed';
    brainOverlay.style.left = '50%';
    brainOverlay.style.top = '50%';
    brainOverlay.style.transform = 'translate(-50%, -50%)';
    brainOverlay.style.width = '480px';
    brainOverlay.style.height = '360px';
    brainOverlay.style.background = 'transparent';
    brainOverlay.style.zIndex = '9999';
    brainOverlay.style.pointerEvents = 'none';

    var loaderDiv = document.createElement('div');
    loaderDiv.style.position = 'relative';
    loaderDiv.style.width = '480px';
    loaderDiv.style.background = 'transparent';

    var img = document.createElement('img');
    img.src = assetPreloadState.BASE + assetPreloadState.LOADER_IMAGE;
    img.style.width = '100%';
    img.style.display = 'block';
    img.onerror = function() { 
      console.log('Brain loader background image not found at Heroku, falling back to local file');
      try { img.src = 'SpeakSmart-loader.png'; } catch(e) {}
    };
    loaderDiv.appendChild(img);

    var canvas = document.createElement('canvas');
    canvas.id = 'brainCanvas';
    canvas.width = 200;
    canvas.height = 230;
    canvas.style.position = 'absolute';
    canvas.style.left = '50%';
    canvas.style.top = '125px';
    canvas.style.width = '200px';
    canvas.style.height = '230px';
    canvas.style.marginLeft = '-100px';
    canvas.style.background = 'transparent';
    
    var clipPath = 'path("M 20 5 Q 60 -15 100 5 Q 140 -15 180 5 ...0 225 100 215 Q 60 225 20 195 Q -5 145 20 100 Q -5 55 20 5 Z")';
    canvas.style.clipPath = clipPath;

    loaderDiv.appendChild(canvas);
    brainOverlay.appendChild(loaderDiv);

    // Store references for instant activation
    brainState.prebuiltOverlay = brainOverlay;
    brainState.canvas = canvas;

    // Build path sets
    var ctx = canvas.getContext('2d');
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(0, 200, 255, 0.9)';

    var W = 200, H = 230;
    var pivot = { x: W / 2, y: H / 2 };

    // Base paths (rough "brain" clusters)
    var baseLeftTop = [
      { x: 110, y: 75 }, { x: 75, y: 30 }, { x: 45, y: 45 }, { x: 75, y: 75 }
    ];
    var baseLeftBot = [
      { x: 100, y: 90 }, { x: 75, y: 120 }, { x: 45, y: 105 }, { x: 65, y: 80 }
    ];
    var baseRightTop = [
      { x: 100, y: 75 }, { x: 135, y: 30 }, { x: 165, y: 45 }, { x: 135, y: 75 }
    ];
    var baseRightBot = [
      { x: 100, y: 90 }, { x: 125, y: 120 }, { x: 155, y: 105 }, { x: 135, y: 80 }
    ];

    // Mirror & nudge
    function mirrorPath(path) {
      return path.map(function(p){ return { x: W - (p.x), y: p.y }; });
    }

    var leftTop = baseLeftTop;
    var leftBot = baseLeftBot;
    var rightTop = mirrorPath(baseLeftTop);
    var rightBot = mirrorPath(baseLeftBot);

    brainState.paths = [leftTop, leftBot, rightTop, rightBot];
    brainState.phases = [0, 0.4, 0.2, 0.6];
    brainState.speeds = [1.7, 1.3, 1.6, 1.2];
    brainState.widths = [4, 4, 4, 4];

    return brainOverlay;
  }

  function startBrainAnimation(canvas) {
    try {
      var ctx = canvas.getContext('2d');
      var last = performance.now();

      function tick(now) {
        brainState.animationId = requestAnimationFrame(tick);
        var dt = Math.min(33, now - last);
        last = now;

        ctx.clearRect(0,0,canvas.width,canvas.height);

        // animate phases
        for (var i=0;i<brainState.phases.length;i++){
          brainState.phases[i] = (brainState.phases[i] + brainState.speeds[i] * dt/1000) % 1;
        }

        // Flash effect
        if (now - brainState.lastFlash > GAP_MS) {
          brainState.lastFlash = now;
          brainState.flickIdx = (brainState.flickIdx === null ? 0 : (brainState.flickIdx + 1) % brainState.paths.length);
        }

        for (var p=0;p<brainState.paths.length;p++){
          var pts = brainState.paths[p];
          if (!pts || pts.length < 2) { continue; } // guard against undefined/empty paths

          ctx.lineWidth = brainState.widths[p] || 2;
          var alpha = (p === brainState.flickIdx) ? 1 : 0.6;
          ctx.strokeStyle = 'rgba(0, 200, 255,' + alpha + ')';

          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          for (var i = 1; i < pts.length; i++) {
            var mx = (pts[i - 1].x + pts[i].x) / 2;
            var my = (pts[i - 1].y + pts[i].y) / 2;
            ctx.quadraticCurveTo(pts[i - 1].x, pts[i - 1].y, mx, my);
          }
          ctx.stroke();

          // glow dots
          var t = brainState.phases[p];
          var idx = Math.floor(lerp(0, pts.length-1, t));
          var a = pts[idx], b = pts[(idx+1) % pts.length];
          var dx = b.x - a.x, dy = b.y - a.y;
          var px = a.x + dx * (t % 1), py = a.y + dy * (t % 1);
          ctx.beginPath();
          ctx.arc(px, py, 2.8, 0, Math.PI*2);
          ctx.fillStyle = 'rgba(0, 255, 200, 0.9)';
          ctx.fill();
        }
      }

      brainState.animationId = requestAnimationFrame(tick);
    } catch (e) {
      console.log('Brain animation failed to start', e && e.message);
    }
  }

  /* -----------------------------------------------------------------------
   *  INSTANT REPLACEMENT of the gray circle loader
   * -------------------------------------------------------------------- */

  function instantReplacement(grayCircle) {
    if (!grayCircle || brainState.isReplacing || brainState.suppressed) return false;
    brainState.isReplacing = true;

    // Quick validation
    if (!grayCircle || !grayCircle.parentNode) {
      console.log('No gray circle parent found, aborting instant replacement');
      brainState.isReplacing = false;
      return false;
    }

    // Skip if it's our own overlay
    if (grayCircle.className && grayCircle.className.includes('speaksmart-brain-overlay')) {
      console.log('Ignoring our own brain overlay');
      brainState.isReplacing = false;
      return false;
    }

    try {
      // Use pre-built overlay for instant swap
      var brainOverlay = brainState.prebuiltOverlay;
      if (!brainOverlay) {
        brainOverlay = buildBrainOverlay();
      }

      // INSTANT replacement - no setTimeout
      grayCircle.parentNode.replaceChild(brainOverlay, grayCircle);
      
      brainState.overlay = brainOverlay;
      startBrainAnimation(brainState.canvas);
      
      console.log('INSTANT brain replacement successful!');
      
      // Pre-build next overlay for subsequent attempts
      setTimeout(function() {
        try { buildBrainOverlay(); } catch (e) {}
      }, 0);

    } catch (e) {
      console.log('Instant replacement failed', e && e.message);
    } finally {
      brainState.isReplacing = false;
    }
    return true;
  }

  function showMarketingBrainAnimation() {
    try {
      if (brainState.suppressed) return;
      var existing = document.querySelector('.speaksmart-brain-overlay');
      if (existing) return;

      var overlay = brainState.prebuiltOverlay || buildBrainOverlay();
      document.body.appendChild(overlay);
      brainState.overlay = overlay;
      startBrainAnimation(brainState.canvas);
      console.log('Marketing brain overlay forced on screen');
    } catch (e) {
      console.log('Could not show marketing brain overlay', e && e.message);
    }
  }

  /* -----------------------------------------------------------------------
   *  OBSERVERS: watch for the gray circle (#pronunciation-loading-overlay)
   * -------------------------------------------------------------------- */
  function startAllMonitoring() {
    // Build first overlay upfront
    buildBrainOverlay();

    // Primary observer
    var observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        m.addedNodes.forEach(function (node) {
          if (node.nodeType !== 1) return;

          // Direct match
          if (node.id === 'pronunciation-loading-overlay') {
            instantReplacement(node);
            return;
          }

          // Search subtree
          if (node.querySelector) {
            var t = node.querySelector('#pronunciation-loading-overlay');
            if (t) instantReplacement(t);
          }
        });
      });
    });

    brainState.primaryObserver = observer; // keep a handle for cleanup

    try {
      observer.observe(document.body, { childList: true, subtree: true });
    } catch (e) {
      document.addEventListener('DOMContentLoaded', function(){
        try { observer.observe(document.body, { childList: true, subtree: true }); } catch (e2) {}
      });
    }

    // Console hooks: sometimes the overlay appears so briefly that we miss it
    var originalConsoleLog = console.log;
    brainState.originalConsoleLog = originalConsoleLog;
    console.log = function() {
      originalConsoleLog.apply(console, arguments);

      var message = Array.prototype.slice.call(arguments).join(' ');

      // If external checker is ready/initialized/hidden the loader => suppress & teardown
      if (
        message.includes('External script loaded successfully') ||
        message.includes('Pronunciation checker initialized') ||
        message.includes('Loading animation hidden')
      ) {
        suppressAndCleanup();
        return;
      }

      // If starting and not yet suppressed, ensure something visible
      if (!brainState.suppressed && (
          message.includes('Starting pronunciation process') ||
          message.includes('Loading animation displayed')
      )) {
        setTimeout(function() {
          if (!brainState.overlay || !brainState.overlay.parentNode) {
            console.log('No brain animation detected after pronunciation start - triggering marketing display');
            showMarketingBrainAnimation();
          }
        }, 200);
      }
    };
  }

  /* -----------------------------------------------------------------------
   *  BACKUP MONITORING STRATEGY: Continuously watch for brief appearances
   * -------------------------------------------------------------------- */
  var monitoringInterval = null;
  
  function startBackupMonitoring() {
    if (monitoringInterval) return;
    
    console.log('Starting backup monitoring for missed gray circles');
    
    monitoringInterval = setInterval(function() {
      try {
        var el = document.getElementById('pronunciation-loading-overlay');
        if (el) instantReplacement(el);
      } catch (e) {}
    }, 350);
  }

  function stopBackupMonitoring() {
    if (monitoringInterval) {
      clearInterval(monitoringInterval);
      monitoringInterval = null;
      console.log('Stopped backup monitoring');
    }
  }

  // Secondary observer on document.documentElement for broader coverage
  var secondaryObserver = new MutationObserver(function (mutations) {
    mutations.forEach(function (m) {
      m.addedNodes.forEach(function (node) {
        if (node.nodeType !== 1) return;
        
        // Look for the target element in the added subtree
        if (node.id === 'pronunciation-loading-overlay') {
          instantReplacement(node);
        } else if (node.querySelector) {
          var grayCircle = node.querySelector('#pronunciation-loading-overlay:not(.speaksmart-brain-overlay)');
          if (grayCircle) {
            instantReplacement(grayCircle);
          }
        }
      });
    });
  });

  function suppressAndCleanup() {
    if (brainState.suppressed) return;
    brainState.suppressed = true;

    // Disconnect observers
    try { brainState.primaryObserver && brainState.primaryObserver.disconnect(); } catch(e){}
    try { secondaryObserver && secondaryObserver.disconnect && secondaryObserver.disconnect(); } catch(e){}

    // Stop backup interval + remove overlay/RAF + cleanup marked elements
    cleanup();

    // === [ANCHOR: ENHANCED SUPPRESSION CLEANUP] ===
    // Additional cleanup of SpeakSmart elements when suppressing
    if (window.SpeakSmartElementMarker) {
      const suppressionCleanup = window.SpeakSmartElementMarker.cleanupMarkedElements();
      console.log(`[SUPPRESSION-CLEANUP] Removed ${suppressionCleanup} SpeakSmart marked elements during suppression`);
    }

    // Restore console
    if (brainState.originalConsoleLog) {
      console.log = brainState.originalConsoleLog;
      brainState.originalConsoleLog = null;
    }
  }

  function cleanup() {
    console.log('Cleaning up brain animation');

    stopBackupMonitoring();

    if (brainState.animationId) {
      cancelAnimationFrame(brainState.animationId);
      brainState.animationId = null;
    }
    if (brainState.overlay && brainState.overlay.parentNode) {
      try { brainState.overlay.parentNode.removeChild(brainState.overlay); } catch(e){}
    }
    brainState.overlay = null;
    brainState.canvas = null;

    // === [ANCHOR: ENHANCED CLEANUP WITH MARKER SYSTEM] ===
    // Clean up SpeakSmart marked elements as part of bootstrap cleanup
    if (window.SpeakSmartElementMarker) {
      const markedCleanup = window.SpeakSmartElementMarker.cleanupMarkedElements();
      console.log(`[BOOTSTRAP-CLEANUP] Removed ${markedCleanup} SpeakSmart marked elements`);
    }
  }

  // Kick everything off (DOMContentLoaded guards included)
  function startSystem() {
    try {
      startAllMonitoring();
      startBackupMonitoring();
      
      // Pre-build first overlay
      buildBrainOverlay();
      
      console.log('Multi-layer monitoring system active');
    } catch (e) {
      console.log('Bootstrap error', e && e.message);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startSystem);
  } else {
    startSystem();
  }

  // Initialize the robust system
  console.log('SpeakSmart race-condition-proof bootstrap with marketing safety net ready');
})();
