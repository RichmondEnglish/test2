/*  SpeakSmart Race-Condition-Proof Bootstrap with Marketing Safety Net */
(function () {
  if (window.__speakSmartPatched) return;
  window.__speakSmartPatched = true;

  console.log('SpeakSmart robust bootstrap loaded');

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
    prebuiltOverlay: null  // Pre-built overlay ready for instant swap
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
      link.crossOrigin = 'anonymous'; // safe if any canvas usage later
      head.appendChild(link);
    } catch (e) {}
  }

  function ssWarmImage(href) {
    var img = new Image();
    img.crossOrigin = 'anonymous'; // Match preload credentials mode
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
        // Handle the new manifest structure with assets array
        var list = [];
        if (json.assets && Array.isArray(json.assets)) {
          list = json.assets.map(function(asset) {
            return asset.name || asset.path;
          }).filter(Boolean);
        } else if (Array.isArray(json)) {
          list = json;
        } else if (json.files) {
          list = json.files;
        }

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
   *  Perfect Brain Animation (from your version 4, ES5 compatible)
   * -------------------------------------------------------------------- */
  function lerp(a, b, t) { return a + (b - a) * t; }

  function rand(a, b) {
    return Math.random() * (b - a) + a;
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
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    ctx.stroke();
  }

  function setupBrainPaths() {
    var W = 200;
    var H = 230;
    var sizeFactor = 0.65;
    var s = 0.4 * sizeFactor;
    
    function scale(p) {
      return { x: p.x * s, y: p.y * s };
    }

    var baseLeftTop = [
      { x: 140, y: 55 }, { x: 95, y: 80 }, { x: 140, y: 105 }, 
      { x: 95, y: 130 }, { x: 140, y: 155 }
    ];
    var baseLeftBot = [
      { x: 145, y: 180 }, { x: 95, y: 220 }, { x: 140, y: 255 }, { x: 105, y: 295 }
    ];
    var baseRightBot = [
      { x: 360, y: 175 }, { x: 410, y: 220 }, { x: 360, y: 255 }, { x: 390, y: 295 }
    ];

    var leftTop = baseLeftTop.map(scale).map(function(p) {
      return { x: p.x - 40, y: p.y - 10 };
    });
    var leftBot = baseLeftBot.map(scale).map(function(p) {
      return { x: p.x - 40, y: p.y - 42 };
    });
    var rightTop = leftTop.map(function(p) {
      return { x: W - p.x, y: p.y };
    });
    var rightBot = baseRightBot.map(scale).map(function(p) {
      return { x: p.x - 40, y: p.y - 42 };
    }).map(function(p) {
      return { x: W - p.x, y: p.y };
    });

    var bottomLeft = leftBot.map(function(p) {
      return rotate(p, { x: 70, y: 100 }, 10);
    });
    var bottomRight = rightBot.map(function(p) {
      return rotate(p, { x: 130, y: 100 }, -10);
    });

    brainState.paths = [leftTop, bottomLeft, rightTop, bottomRight];

    var targetCenters = [
      { x: 67, y: 143 }, { x: 60, y: 188 }, 
      { x: 125, y: 143 }, { x: 132, y: 188 }
    ];

    var offsets = brainState.paths.map(function(pts, i) {
      var xs = pts.map(function(p) { return p.x; });
      var ys = pts.map(function(p) { return p.y; });
      var cx = (Math.min.apply(Math, xs) + Math.max.apply(Math, xs)) / 2;
      var cy = (Math.min.apply(Math, ys) + Math.max.apply(Math, ys)) / 2;
      return {
        x: targetCenters[i].x - cx,
        y: targetCenters[i].y - cy
      };
    });

    brainState.paths = brainState.paths.map(function(orig, i) {
      return orig.map(function(p) {
        return {
          x: p.x + offsets[i].x,
          y: p.y + offsets[i].y
        };
      });
    });

    brainState.phases = brainState.paths.map(function() { return rand(0, Math.PI * 2); });
    brainState.speeds = brainState.paths.map(function() { return rand(2.5, 5.0); });
    brainState.widths = brainState.paths.map(function() { return rand(8, 11); });
  }

  function startBrainAnimation(canvas, pathsData) {
    try {
      var ctx = canvas.getContext('2d');
      var last = performance.now();

      // Use local copies of animation data to avoid race conditions
      var localPaths = pathsData.paths.map(p => p.slice()); // Deep copy
      var localPhases = pathsData.phases.slice();
      var localSpeeds = pathsData.speeds.slice();
      var localWidths = pathsData.widths.slice();
      var lastFlash = -Infinity;
      var flickIdx = null;

      function tick(now) {
        brainState.animationId = requestAnimationFrame(tick);
        var dt = Math.min(33, now - last);
        last = now;

        ctx.clearRect(0,0,canvas.width,canvas.height);

        // animate phases
        for (var i=0;i<localPhases.length;i++){
          localPhases[i] = (localPhases[i] + localSpeeds[i] * dt/1000) % 1;
        }

        // Flash effect
        if (now - lastFlash > GAP_MS) {
          lastFlash = now;
          flickIdx = (flickIdx === null ? 0 : (flickIdx + 1) % localPaths.length);
        }

        for (var p=0;p<localPaths.length;p++){
          var pts = localPaths[p];
          if (!pts || pts.length === 0) continue; // Safety check

          ctx.lineWidth = localWidths[p];
          var alpha = (p === flickIdx) ? 1 : 0.6;
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
          var t = localPhases[p];
          var idx = Math.floor(lerp(0, pts.length-1, t));
          var a = pts[idx];
          var b = pts[(idx+1) % pts.length];
          if (!a || !b) continue; // Safety check
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
   *  PRE-BUILD STRATEGY: Create overlay BEFORE it's needed
   * -------------------------------------------------------------------- */
  function buildBrainOverlay() {
    console.log('Pre-building brain overlay for instant swap');

    var brainOverlay = document.createElement('div');
    brainOverlay.id = 'pronunciation-loading-overlay';
    brainOverlay.className = 'speaksmart-brain-overlay';
    
    brainOverlay.style.position = 'fixed';
    brainOverlay.style.top = '0';
    brainOverlay.style.left = '0';
    brainOverlay.style.right = '0';
    brainOverlay.style.bottom = '0';
    brainOverlay.style.display = 'flex';
    brainOverlay.style.justifyContent = 'center';
    brainOverlay.style.alignItems = 'center';
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
    canvas.style.top = '35px';
    canvas.style.width = '200px';
    canvas.style.height = '230px';
    canvas.style.marginLeft = '-100px';
    canvas.style.background = 'transparent';
    
    var clipPath = 'path("M 20 5 Q 60 -15 100 5 Q 140 -15 180 5 Q 200 55 170 100 Q 200 145 180 195 Q 140 225 100 215 Q 60 225 20 195 Q -5 145 20 100 Q -5 55 20 5 Z")';
    canvas.style.clipPath = clipPath;

    loaderDiv.appendChild(canvas);
    brainOverlay.appendChild(loaderDiv);

    // Store references for instant activation
    brainState.prebuiltOverlay = brainOverlay;
    brainState.canvas = canvas;

    return brainOverlay;
  }

  /* -----------------------------------------------------------------------
   *  INSTANT REPLACEMENT STRATEGY: No delays, immediate swap
   * -------------------------------------------------------------------- */
  function instantReplacement(grayCircle) {
    console.log('Attempting INSTANT replacement of gray circle');

    // Quick validation
    if (!grayCircle || !grayCircle.parentNode) {
      console.log('Gray circle already gone, instant replacement aborted');
      return false;
    }

    // Skip if it's our own overlay
    if (grayCircle.className && grayCircle.className.includes('speaksmart-brain-overlay')) {
      console.log('Ignoring our own brain overlay');
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
      // Pass animation data to avoid race condition
      startBrainAnimation(brainState.canvas, {
        paths: brainState.paths,
        phases: brainState.phases,
        speeds: brainState.speeds,
        widths: brainState.widths
      });
      
      console.log('INSTANT brain replacement successful!');
      
      // Pre-build next overlay for subsequent attempts
      setTimeout(function() {
        if (!brainState.prebuiltOverlay || brainState.prebuiltOverlay === brainOverlay) {
          buildBrainOverlay();
        }
      }, 100);
      
      return true;
    } catch (error) {
      console.log('Instant replacement failed:', error.message);
      return false;
    }
  }

  /* -----------------------------------------------------------------------
   *  PROACTIVE MARKETING TRIGGER: Show animation when pronunciation starts
   * -------------------------------------------------------------------- */
  function showMarketingBrainAnimation() {
    // Only if we don't already have a brain overlay active
    if (brainState.overlay && brainState.overlay.parentNode) {
      console.log('Brain animation already active, skipping marketing trigger');
      return;
    }

    console.log('Proactive marketing brain animation triggered');
    
    var brainOverlay = buildBrainOverlay();
    document.body.appendChild(brainOverlay);
    
    brainState.overlay = brainOverlay;
    // Pass animation data to avoid race condition
    startBrainAnimation(brainState.canvas, {
      paths: brainState.paths,
      phases: brainState.phases,
      speeds: brainState.speeds,
      widths: brainState.widths
    });
    
    // Marketing display duration - keep it visible for impact
    setTimeout(function() {
      console.log('Marketing brain animation auto-cleanup after display duration');
      if (brainState.overlay === brainOverlay && brainState.overlay.parentNode) {
        cleanup();
      }
    }, 1800); // 1.8 seconds for marketing impact
  }

  // Watch for pronunciation process starting (trigger for fast-loading scenarios)
  var originalConsoleLog = console.log;
  console.log = function() {
    originalConsoleLog.apply(console, arguments);
    
    // Detect when pronunciation starts but we missed the gray circle
    var message = Array.prototype.slice.call(arguments).join(' ');
    if (message.includes('Starting pronunciation process') || 
        message.includes('Loading animation displayed')) {
      
      // Small delay to see if normal replacement worked
      setTimeout(function() {
        if (!brainState.overlay || !brainState.overlay.parentNode) {
          console.log('No brain animation detected after pronunciation start - triggering marketing display');
          showMarketingBrainAnimation();
        }
      }, 200);
    }
  };

  /* -----------------------------------------------------------------------
   *  BACKUP MONITORING STRATEGY: Continuously watch for brief appearances
   * -------------------------------------------------------------------- */
  var monitoringInterval = null;
  
  function startBackupMonitoring() {
    if (monitoringInterval) return;
    
    console.log('Starting backup monitoring for missed gray circles');
    
    monitoringInterval = setInterval(function() {
      var grayCircle = document.getElementById('pronunciation-loading-overlay');
      
      if (grayCircle && (!grayCircle.className || !grayCircle.className.includes('speaksmart-brain-overlay'))) {
        console.log('Backup monitor caught gray circle!');
        clearInterval(monitoringInterval);
        monitoringInterval = null;
        
        if (instantReplacement(grayCircle)) {
          // Success - restart monitoring for next time
          setTimeout(startBackupMonitoring, 1000);
        } else {
          // Failed - try again soon
          setTimeout(startBackupMonitoring, 100);
        }
      }
    }, 10); // Check every 10ms during active periods
  }

  function stopBackupMonitoring() {
    if (monitoringInterval) {
      clearInterval(monitoringInterval);
      monitoringInterval = null;
      console.log('Backup monitoring stopped');
    }
  }

  /* -----------------------------------------------------------------------
   *  ENHANCED DOM OBSERVER: Multi-level watching
   * -------------------------------------------------------------------- */
  var primaryObserver = new MutationObserver(function (mutations) {
    mutations.forEach(function (m) {
      m.addedNodes.forEach(function (node) {
        if (node.nodeType !== 1) return;
        
        if (node.id === 'pronunciation-loading-overlay') {
          // IMMEDIATE attempt - no delays
          if (instantReplacement(node)) {
            // Success - start backup monitoring for subsequent attempts
            setTimeout(startBackupMonitoring, 500);
          } else {
            // Failed - start aggressive backup monitoring immediately
            startBackupMonitoring();
          }
        }
      });

      m.removedNodes.forEach(function (node) {
        if (node.nodeType !== 1) return;
        
        if (node.id === 'pronunciation-loading-overlay') {
          if (node === brainState.overlay) {
            console.log('Brain overlay removed - cleaning up');
            cleanup();
          } else {
            console.log('Gray circle removed - preparing for next attempt');
            // Start monitoring in case another appears soon
            setTimeout(startBackupMonitoring, 100);
          }
        }
      });
    });
  });

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

  function cleanup() {
    console.log('Cleaning up brain animation');
    
    stopBackupMonitoring();
    
    if (brainState.animationId) {
      cancelAnimationFrame(brainState.animationId);
    }
    
    if (brainState.overlay && brainState.overlay.parentNode) {
      brainState.overlay.parentNode.removeChild(brainState.overlay);
    }

    // Reset state but keep prebuilt overlay for next attempt
    brainState.animationId = null;
    brainState.canvas = null;
    brainState.overlay = null;
    brainState.paths = [];
    brainState.phases = [];
    brainState.speeds = [];
    brainState.widths = [];
    brainState.lastFlash = -Infinity;
    brainState.flickIdx = null;
    brainState.isReplacing = false;
    
    // Rebuild overlay for next attempt
    setTimeout(function() {
      buildBrainOverlay();
    }, 200);
    
    console.log('Cleanup complete - ready for next attempt');
  }

  /* -----------------------------------------------------------------------
   *  INITIALIZATION: Start all monitoring systems
   * -------------------------------------------------------------------- */
  function startAllMonitoring() {
    if (document.body) {
      // Primary observer on body
      primaryObserver.observe(document.body, { 
        childList: true, 
        subtree: true 
      });
      
      // Secondary observer on documentElement for broader coverage
      secondaryObserver.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
      
      // Pre-build first overlay
      buildBrainOverlay();
      
      console.log('Multi-layer monitoring system active');
    } else {
      document.addEventListener('DOMContentLoaded', startAllMonitoring);
    }
  }

  // Initialize the robust system
  startAllMonitoring();
  
  console.log('SpeakSmart race-condition-proof bootstrap with marketing safety net ready');
})();