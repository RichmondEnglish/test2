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
    prebuiltOverlay: null,  // Pre-built overlay ready for instant swap
    clickCount: 0,  // Track number of clicks to trigger on second click
    lastScriptLoad: null  // Track which script was last loaded
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
    img.onload = function() {
      console.log('SpeakSmart: image warmed successfully:', href);
    };
    img.onerror = function() {
      console.log('SpeakSmart: failed to warm image:', href);
    };
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
   *  BRAIN ANIMATION LOGIC
   * -------------------------------------------------------------------- */

  function lerp(a, b, t) { return a + (b - a) * t; }

  function setupBrainPaths() {
    console.log('SpeakSmart: Setting up brain animation paths');

    var W = 200; // Canvas width

    // Adjusted base paths for a more neuron-like top shape
    var baseLeftTop = [
      { x: 120, y: 70 },   // Start slightly right, lower
      { x: 80, y: 35 },    // Curve up and left
      { x: 45, y: 55 },    // Curve down, left, like a dendrite
      { x: 70, y: 80 }     // Curve back towards center-right
    ];
    var baseLeftBot = [
      { x: 100, y: 95 }, { x: 75, y: 125 }, { x: 45, y: 110 }, { x: 65, y: 85 }
    ];

    // Function to mirror a path horizontally
    function mirrorPath(path) {
        return path.map(function(p){ return { x: W - p.x, y: p.y }; });
    }

    var leftTop = baseLeftTop;
    var leftBot = baseLeftBot;
    var rightTop = mirrorPath(baseLeftTop); // Mirrored version for the right side
    var rightBot = mirrorPath(baseLeftBot);

    // Set the animation parameters on the state object
    brainState.paths = [leftTop, leftBot, rightTop, rightBot];
    brainState.phases = [0, 0.4, 0.2, 0.6]; // Start at different points
    brainState.speeds = [1.7, 1.3, 1.6, 1.2]; // Travel at different speeds
    brainState.widths = [2, 2, 2, 2];

    console.log('SpeakSmart: Brain paths setup complete -', brainState.paths.length, 'neuron paths ready');
  }

  function startBrainAnimation(canvas, pathsData) {
    try {
      var ctx = canvas.getContext('2d');
      var last = performance.now();

      // Create local copies of data to ensure smooth animation
      var localPaths = pathsData.paths.map(p => p.slice());
      var localPhases = pathsData.phases.slice();
      var localSpeeds = pathsData.speeds.slice();
      var localWidths = pathsData.widths.slice();
      var lastFlash = -Infinity;
      var flickIdx = null;

      function tick(now) {
        brainState.animationId = requestAnimationFrame(tick);
        var dt = Math.min(33, now - last); // Delta time, capped to prevent large jumps
        last = now;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Update the phase (position) of each glow dot
        for (var i = 0; i < localPhases.length; i++) {
          localPhases[i] = (localPhases[i] + localSpeeds[i] * dt / 1000) % 1;
        }

        // Determine which path to "flash" to make it brighter
        if (now - lastFlash > GAP_MS) {
          lastFlash = now;
          flickIdx = (flickIdx === null ? 0 : (flickIdx + 1)) % localPaths.length;
        }

        // Draw each path and its corresponding glow dot
        for (var p = 0; p < localPaths.length; p++) {
          var pts = localPaths[p];
          if (!pts || pts.length < 2) continue; // Safety check

          // --- Draw the static path ---
          ctx.lineWidth = localWidths[p];
          var alpha = (p === flickIdx) ? 1.0 : 0.6; // Flashing path is brighter
          ctx.strokeStyle = 'rgba(0, 200, 255,' + alpha + ')';

          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          for (var i = 1; i < pts.length; i++) {
            var mx = (pts[i - 1].x + pts[i].x) / 2;
            var my = (pts[i - 1].y + pts[i].y) / 2;
            ctx.quadraticCurveTo(pts[i - 1].x, pts[i - 1].y, mx, my);
          }
          ctx.stroke();

          // --- Draw the moving glow dot ---
          var t = localPhases[p];
          var pathProgress = t * (pts.length - 1);
          var idx = Math.floor(pathProgress);
          var segmentProgress = pathProgress - idx;

          var a = pts[idx];
          var b = pts[idx + 1] || pts[0]; // Loop back to the start

          // Interpolate position between two points
          var px = lerp(a.x, b.x, segmentProgress);
          var py = lerp(a.y, b.y, segmentProgress);

          ctx.beginPath();
          ctx.arc(px, py, 2.8, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(0, 255, 200, 0.9)';
          ctx.fill();
        }
      }

      // Start the animation loop
      brainState.animationId = requestAnimationFrame(tick);
    } catch (e) {
      console.error('Brain animation failed to start', e);
    }
  }

  /* -----------------------------------------------------------------------
   *  PRE-BUILD STRATEGY: Create overlay BEFORE it's needed
   * -------------------------------------------------------------------- */
  function buildBrainOverlay() {
    console.log('Pre-building brain overlay for instant swap');

    var brainOverlay = document.createElement('div');
    brainOverlay.className = 'speaksmart-brain-overlay';
    // Styles for perfect centering on mobile and desktop
    brainOverlay.style.position = 'fixed';
    brainOverlay.style.top = '50%';
    brainOverlay.style.left = '50%';
    brainOverlay.style.transform = 'translate(-50%, -50%)';
    brainOverlay.style.width = 'min(480px, 90vw)'; // Responsive width
    brainOverlay.style.height = 'min(360px, 85vh)'; // Responsive height
    brainOverlay.style.background = 'transparent';
    brainOverlay.style.pointerEvents = 'none';
    brainOverlay.style.zIndex = '9999'; // Ensure it's on top

    var loaderDiv = document.createElement('div');
    loaderDiv.style.position = 'relative';
    loaderDiv.style.width = '100%';
    loaderDiv.style.height = '100%';
    loaderDiv.style.background = 'transparent';

    var img = document.createElement('img');
    img.src = assetPreloadState.BASE + assetPreloadState.LOADER_IMAGE;
    img.style.width = '100%';
    img.style.height = 'auto';
    img.style.display = 'block';
    img.style.borderRadius = '1rem'; // Soften the edges of the placeholder
    img.style.maxWidth = '100%'; // Ensure it doesn't overflow
    img.onerror = function() {
      console.log('Brain loader background image not found at Heroku, falling back to local file');
      try { img.src = 'SpeakSmart-loader.png'; } catch(e) {}
    };
    loaderDiv.appendChild(img);

    var canvas = document.createElement('canvas');
    canvas.id = 'brainCanvas';
    canvas.width = 200;
    canvas.height = 215;
    canvas.style.position = 'absolute';
    canvas.style.left = '50%';
    canvas.style.top = '35%'; // Responsive top positioning
    canvas.style.transform = 'translate(-50%, -50%)'; // Center the canvas
    canvas.style.width = '200px';
    canvas.style.height = '215px';
    canvas.style.background = 'transparent';

    // The clipPath value from the original code was incomplete ("...").
    // This is a full, valid SVG path that creates a brain-like shape.
    var clipPath = 'path("M100 0 C40 -10 10 40 20 100 C30 160 50 200 100 215 C150 200 170 160 180 100 C190 40 160 -10 100 0 Z")';
    canvas.style.clipPath = clipPath;
    canvas.style.webkitClipPath = clipPath; // For better browser compatibility

    loaderDiv.appendChild(canvas);
    brainOverlay.appendChild(loaderDiv);

    // Store references for the animation function
    brainState.canvas = canvas;

    // Set up brain paths for animation
    setupBrainPaths();

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
  function loadScriptForClick() {
    var scriptUrl;
    brainState.clickCount++;

    if (brainState.clickCount === 1) {
      // First click - load pronunciation checker script
      scriptUrl = 'pronunciation-checker.js';
      console.log('First click detected - loading pronunciation checker script');
    } else if (brainState.clickCount === 2) {
      // Second click - load grammar script
      scriptUrl = 'speaksmart-grammar-gpt.js';
      console.log('Second click detected - loading grammar script');
    } else {
      // Third click or more - load reading script
      scriptUrl = 'speaksmart-reading-gpt.js';
      console.log('Third+ click detected - loading reading script');
    }

    // Avoid loading the same script multiple times
    if (brainState.lastScriptLoad === scriptUrl) {
      console.log('Script already loaded, skipping:', scriptUrl);
      return;
    }

    // Load the script dynamically
    var script = document.createElement('script');
    script.src = scriptUrl;
    script.onload = function() {
      console.log('Script loaded successfully:', scriptUrl);
      brainState.lastScriptLoad = scriptUrl;
    };
    script.onerror = function() {
      console.error('Failed to load script:', scriptUrl);
    };

    document.head.appendChild(script);
  }

  function showBrainAnimationOnSecondClick() {
    // Only trigger on second click
    if (brainState.clickCount !== 2) {
      console.log('Not second click, current count:', brainState.clickCount);
      return;
    }

    // Only if we don't already have a brain overlay active
    if (brainState.overlay && brainState.overlay.parentNode) {
      console.log('Brain animation already active, skipping trigger');
      return;
    }

    console.log('Second click brain animation triggered');

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

    console.log('Brain animation displayed for second click');
  }

  // Global click tracker for second-click behavior
  function handleGlobalClick(event) {
    // Only count clicks on interactive elements (buttons, links, etc.)
    var target = event.target;
    if (target.tagName === 'BUTTON' || target.tagName === 'A' ||
        target.closest('button') || target.closest('a') ||
        target.onclick || target.getAttribute('role') === 'button') {

      console.log('Interactive element clicked, click count:', brainState.clickCount + 1);

      // Load script for this click
      loadScriptForClick();

      // Show brain animation only on second click
      if (brainState.clickCount === 2) {
        setTimeout(function() {
          showBrainAnimationOnSecondClick();
        }, 100); // Small delay to ensure script has started loading
      }
    }
  }

  // Add global click listener
  document.addEventListener('click', handleGlobalClick, true);

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

  // Observer to detect recording UI elements and hide brain overlay immediately
  var recordingUIObserver = new MutationObserver(function (mutations) {
    mutations.forEach(function (m) {
      m.addedNodes.forEach(function (node) {
        if (node.nodeType !== 1) return;

        // Check if the added node is a recording UI element or contains one
        var recordingElements = [
          'pronunciation-container',
          'pronunciation-backdrop',
          'circularPrompt',
          'speak-prompt',
          'countdown-timer'
        ];

        var isRecordingUI = recordingElements.some(function(id) {
          return node.id === id || (node.querySelector && node.querySelector('#' + id));
        });

        if (isRecordingUI && brainState.overlay && brainState.overlay.parentNode) {
          console.log('Recording UI detected - hiding brain overlay immediately');
          brainState.overlay.parentNode.removeChild(brainState.overlay);
          brainState.overlay = null;
          // Also stop animation if running
          if (brainState.animationId) {
            cancelAnimationFrame(brainState.animationId);
            brainState.animationId = null;
          }
          // Reset click count so the sequence can restart
          brainState.clickCount = 0;
          brainState.lastScriptLoad = null;
          console.log('Click count reset for next sequence');
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
    // Reset click count for next sequence
    brainState.clickCount = 0;
    brainState.lastScriptLoad = null;

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

      // Observer to watch for recording UI elements
      recordingUIObserver.observe(document.body, {
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