/*  SpeakSmart Bootstrap - Asset Preloader with Beautiful Neuron Animation */
(function () {
  if (window.__speakSmartPatched) return;
  window.__speakSmartPatched = true;

  console.log('SpeakSmart bootstrap loaded');

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
    prebuiltOverlay: null
  };

  /* -----------------------------------------------------------------------
   *  ASSET PRELOAD & CACHE WARMING (images for bubbles, badges, etc.)
   *  Host is different from where this bootstrap lives.
   * -------------------------------------------------------------------- */

  var assetPreloadState = {
    HOST: 'https://richmond-english-wheel-32e9771e3e5a.herokuapp.com',
    BASE: 'https://richmond-english-wheel-32e9771e3e5a.herokuapp.com/assets/',
    MANIFEST_URL: 'https://richmond-english-wheel-32e9771e3e5a.herokuapp.com/assets/manifest.json',
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
   *  Beautiful Brain Animation (neuron firing effect)
   * -------------------------------------------------------------------- */
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

  function startBrainAnimation(canvas) {
    var ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    setupBrainPaths();

    function draw(ms) {
      var t = ms / 1000;

      if (ms - brainState.lastFlash > FLASH_MS + GAP_MS) {
        brainState.flickIdx = Math.floor(Math.random() * brainState.paths.length);
        brainState.lastFlash = ms;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      brainState.paths.forEach(function(pts, i) {
        var pulse = (Math.sin(t * brainState.speeds[i] + brainState.phases[i]) + 1) / 2;

        if (i === brainState.flickIdx && ms - brainState.lastFlash < FLASH_MS) {
          pulse = 1.25;
        }

        var base = 25;
        var peak = 78;
        var light = base + (peak - base) * pulse;
        ctx.strokeStyle = 'hsl(191, 60%, ' + light + '%)';
        ctx.lineWidth = brainState.widths[i] + 3 * pulse;
        spline(ctx, pts);
      });

      if (brainState.canvas === canvas) {
        brainState.animationId = requestAnimationFrame(draw);
      }
    }

    brainState.animationId = requestAnimationFrame(draw);
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
    img.src = 'SpeakSmart-loader.png';
    img.style.width = '100%';
    img.style.display = 'block';
    img.onerror = function() { 
      console.log('Brain loader background image not found, proceeding without it');
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
      startBrainAnimation(brainState.canvas);
      
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
    startBrainAnimation(brainState.canvas);
    
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
  
  /* -----------------------------------------------------------------------
   *  CLICK-TO-SHOW (Adobe Captivate wrapper trigger)
   *  Show the brain overlay for 3s every time the Captivate wrapper is clicked.
   *  Non-invasive: append a transient overlay with pointer-events: none so it
   *  does not block interaction or replace existing DOM nodes.
   * -------------------------------------------------------------------- */
  function startBrainAnimationInstance(canvas) {
    // Independent animation instance (doesn't touch brainState.animationId)
    var ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Ensure path data exists
    try { setupBrainPaths(); } catch (e) { /* ignore */ }

    var animId = null;
    var localLastFlash = -Infinity;
    var localFlickIdx = null;

    function draw(ms) {
      var t = ms / 1000;

      if (ms - localLastFlash > FLASH_MS + GAP_MS) {
        localFlickIdx = Math.floor(Math.random() * (brainState.paths && brainState.paths.length || 1));
        localLastFlash = ms;
      }

      try {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        (brainState.paths || []).forEach(function(pts, i) {
          if (!pts || !pts.length) return;
          var pulse = (Math.sin(t * (brainState.speeds && brainState.speeds[i] || 3) + (brainState.phases && brainState.phases[i] || 0)) + 1) / 2;

          if (i === localFlickIdx && ms - localLastFlash < FLASH_MS) {
            pulse = 1.25;
          }

          var base = 25;
          var peak = 78;
          var light = base + (peak - base) * pulse;
          ctx.strokeStyle = 'hsl(191, 60%, ' + light + '%)';
          ctx.lineWidth = (brainState.widths && brainState.widths[i] || 8) + 3 * pulse;
          spline(ctx, pts);
        });
      } catch (err) { /* drawing errors are non-fatal */ }

      animId = requestAnimationFrame(draw);
    }

    animId = requestAnimationFrame(draw);

    return function stopInstance() {
      if (animId) cancelAnimationFrame(animId);
    };
  }

  function showTransientOverlay(durationMs) {
    durationMs = typeof durationMs === 'number' ? durationMs : 3000;

    if (!brainState.prebuiltOverlay) buildBrainOverlay();

    // Clone prebuilt overlay so we don't mutate the cached one
    var clone = brainState.prebuiltOverlay.cloneNode(true);

    // Ensure the canvas has a unique id and won't collide
    var canvas = clone.querySelector('canvas');
    if (canvas) {
      canvas.id = 'brainCanvas-' + Math.floor(Math.random() * 1000000);
      // Make sure it's non-interactive so it doesn't block clicks to Captivate
      canvas.style.pointerEvents = 'none';
      // Reset drawing surface size to ensure crispness on clone
      try { canvas.width = canvas.width; } catch (e) {}
    }

    clone.style.pointerEvents = 'none';
    clone.style.zIndex = '9999';

    document.body.appendChild(clone);

    var stopAnim = null;
    if (canvas) stopAnim = startBrainAnimationInstance(canvas);

    // Remove after duration
    setTimeout(function() {
      try {
        if (stopAnim) stopAnim();
      } catch (e) {}
      try { if (clone.parentNode) clone.parentNode.removeChild(clone); } catch (e) {}
    }, durationMs);
  }

  function attachCaptivateClickTrigger() {
    // Common Captivate wrapper selectors - extend if your wrapper uses another id/class
    var selectors = ['#cpRoot', '#CP', '#Captivate', '.captivate', '.cp-stage', '.cp-root', '.cp-container'];

    document.addEventListener('click', function (e) {
      try {
        for (var i = 0; i < selectors.length; i++) {
          if (e.target.closest && e.target.closest(selectors[i])) {
            // Show overlay for 3 seconds on every click inside the wrapper
            showTransientOverlay(3000);
            return;
          }
        }
      } catch (err) { /* ignore */ }
    }, true);
  }

  // Activate the click trigger so the brain shows every time the Captivate wrapper is clicked.
  attachCaptivateClickTrigger();

  console.log('SpeakSmart bootstrap with beautiful neuron animation ready');
})();
