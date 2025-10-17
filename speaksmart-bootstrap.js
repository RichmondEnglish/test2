/*  SpeakSmart Race-Condition-Proof Bootstrap with Marketing Safety Net */
(function () {
  if (window.__speakSmartPatched) return;
  window.__speakSmartPatched = true;

  console.log('SpeakSmart robust bootstrap loaded');

  // === [ANCHOR: SPEAKSMART ELEMENT MARKER SYSTEM] ===
  // Marker system to identify elements created by SpeakSmart scripts
  window.SpeakSmartElementMarker = {
    marker: 'data-speaks-smart-element',
    _currentType: 'speaksmart', // default until router sets it

    // Set the current script type (called by router before init)
    setType: function (type) {
      this._currentType = String(type || 'speaksmart');
      console.log(`[SPEAKSMART-MARKER] Type set to: ${this._currentType}`);
    },

    // Mark an element as created by a specific script
    markElement: function (element, explicitType) {
      if (element && element.setAttribute) {
        const t = explicitType || this._currentType;
        element.setAttribute(this.marker, t);
        console.log(`[SPEAKSMART-MARKER] Marked ${t} element:`, element.tagName, element.id || element.className);
      }
    },

    // Mark all child elements of a container
    markContainer: function (container, explicitType) {
      if (!container || !container.querySelectorAll) return;
      const t = explicitType || this._currentType;
      container.querySelectorAll('*').forEach(el => this.markElement(el, t));
    },

    // Check if element is marked
    isMarked: function (element) {
      return element && element.hasAttribute && element.hasAttribute(this.marker);
    },

    // Enhanced cleanup - optionally target specific script type
    cleanupMarkedElements: function (type /* optional */) {
      const sel = type
        ? `[${this.marker}="${type}"]`
        : `[${this.marker}]`;
      const nodes = document.querySelectorAll(sel);
      let n = 0;
      nodes.forEach(el => { 
        if (el.parentNode) { 
          el.parentNode.removeChild(el); 
          n++; 
        } 
      });
      console.log(`[SPEAKSMART-MARKER] Removed ${n} ${type || 'all'} marked elements`);
      return n;
    },

    // Enhanced pre-script cleanup function
    comprehensivePreScriptCleanup: function () {
      console.log('[BOOTSTRAP-CLEANUP] Starting comprehensive cleanup before script loading');
      let totalCleaned = 0;

      // Only remove previously marked stuff (any type)
      totalCleaned += this.cleanupMarkedElements();

      // Targeted ID sweep for known leftovers (safe)
      ['reading-container','reading-backdrop','circularPrompt','expected-phrase-bubble',
       'grammar-container','pronunciation-container','feedback-popup','pronunciation-feedback']
        .forEach(id => { 
          const el = document.getElementById(id);
          if (el && el.parentNode) { 
            el.parentNode.removeChild(el); 
            totalCleaned++; 
          }
        });

      // Reset registry flags
      if (window.SpeakSmartScriptRegistry) {
        window.SpeakSmartScriptRegistry.reading = null;
        window.SpeakSmartScriptRegistry.grammar = null;
        window.SpeakSmartScriptRegistry.pronunciation = null;
        window.SpeakSmartScriptRegistry.currentScript = null;
      }
      window.SPEAKSMART_READING_LOADED = false;
      window.SPEAKSMART_GRAMMAR_LOADED = false;

      console.log(`[BOOTSTRAP-CLEANUP] Comprehensive cleanup completed, removed ${totalCleaned} elements`);
      return totalCleaned;
    }
  };

  // === [ANCHOR: COMPREHENSIVE SCRIPT LOADING INTERCEPTION] ===
  window.__SS_PENDING_SCRIPT = null;
  window.__SS_SCRIPT_DETECTION_ATTEMPTS = 0;
  window.__SS_MAX_DETECTION_ATTEMPTS = 10;

  // Enhanced script creation interception
  const originalCreateElement = document.createElement;
  document.createElement = function(tagName, options) {
    const element = originalCreateElement.call(document, tagName, options);

    if (tagName.toLowerCase() === 'script' && element.src) {
      const src = element.src.toLowerCase();
      if (src.includes('speaksmart-reading-gpt.js') ||
          src.includes('speaksmart-grammar-gpt.js') ||
          src.includes('speaksmart-pron-gpt.js')) {

        console.log('🔍 BOOTSTRAP: Detected script creation:', src);
        window.__SS_PENDING_SCRIPT = src;
        setScriptDetectionTimeout(src);
      }
    }

    return element;
  };

  // Enhanced appendChild interception
  const originalAppendChild = Element.prototype.appendChild;
  Element.prototype.appendChild = function(child) {
    if (child.tagName && child.tagName.toLowerCase() === 'script' && child.src) {
      const src = child.src.toLowerCase();
      if (src.includes('speaksmart-reading-gpt.js') ||
          src.includes('speaksmart-grammar-gpt.js') ||
          src.includes('speaksmart-pron-gpt.js')) {

        console.log('🔍 BOOTSTRAP: Detected script append:', src);
        window.__SS_PENDING_SCRIPT = src;
        setScriptDetectionTimeout(src);
      }
    }

    return originalAppendChild.call(this, child);
  };

  // Enhanced insertBefore interception
  const originalInsertBefore = Element.prototype.insertBefore;
  Element.prototype.insertBefore = function(newNode, referenceNode) {
    if (newNode.tagName && newNode.tagName.toLowerCase() === 'script' && newNode.src) {
      const src = newNode.src.toLowerCase();
      if (src.includes('speaksmart-reading-gpt.js') ||
          src.includes('speaksmart-grammar-gpt.js') ||
          src.includes('speaksmart-pron-gpt.js')) {

        console.log('🔍 BOOTSTRAP: Detected script insertBefore:', src);
        window.__SS_PENDING_SCRIPT = src;
        setScriptDetectionTimeout(src);
      }
    }

    return originalInsertBefore.call(this, newNode, referenceNode);
  };

  // Monitor for script loading via MutationObserver
  if (typeof MutationObserver !== 'undefined') {
    const scriptObserver = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        mutation.addedNodes.forEach(function(node) {
          if (node.tagName && node.tagName.toLowerCase() === 'script' && node.src) {
            const src = node.src.toLowerCase();
            if (src.includes('speaksmart-reading-gpt.js') ||
                src.includes('speaksmart-grammar-gpt.js') ||
                src.includes('speaksmart-pron-gpt.js')) {

              console.log('🔍 BOOTSTRAP: Detected script via MutationObserver:', src);
              window.__SS_PENDING_SCRIPT = src;
              setScriptDetectionTimeout(src);
            }
          }
        });
      });
    });

    scriptObserver.observe(document.head, { childList: true, subtree: true });
  }

  // Fallback: Monitor for script loading indicators every 100ms
  setInterval(function() {
    if (window.__SS_PENDING_SCRIPT) return; // Already detected

    const scripts = document.querySelectorAll('script[src]');
    for (let script of scripts) {
      const src = script.src.toLowerCase();
      if (src.includes('speaksmart-reading-gpt.js') ||
          src.includes('speaksmart-grammar-gpt.js') ||
          src.includes('speaksmart-pron-gpt.js')) {

        if (script !== window.__SS_LAST_DETECTED_SCRIPT) {
          console.log('🔍 BOOTSTRAP: Detected script via polling:', src);
          window.__SS_PENDING_SCRIPT = src;
          window.__SS_LAST_DETECTED_SCRIPT = script;
          setScriptDetectionTimeout(src);
          break;
        }
      }
    }
  }, 100);

  function setScriptDetectionTimeout(scriptSrc) {
    // Set a timeout to handle the script after a brief delay
    setTimeout(() => {
      handleDetectedScript(scriptSrc);
    }, 100);
  }

  function handleDetectedScript(scriptSrc) {
    console.log('🚨 BOOTSTRAP: Handling detected script:', scriptSrc);

    // Perform extended cleanup
    performExtendedCleanupForScriptLoading(
      scriptSrc.includes('grammar') ? 'grammar' :
      scriptSrc.includes('reading') ? 'reading' : 'pronunciation'
    );

    // Wait for cleanup to complete, then trigger detection
    setTimeout(() => {
      window.detectAndInitializeSpeakSmartScript();
    }, 500);
  }

  // === [ANCHOR: CONTEXT-BASED SCRIPT TYPE DETECTION] ===
  function detectScriptTypeFromContext() {
    // Check if we can infer from pronunciationConfig
    if (window.pronunciationConfig && window.pronunciationConfig.expectedPhrase) {
      const phrase = window.pronunciationConfig.expectedPhrase.toLowerCase();

      // Grammar phrases often contain grammar-specific words
      if (phrase.includes('they are') || phrase.includes('it is') || phrase.includes('this is')) {
        return 'grammar';
      }

      // Reading phrases are often longer sentences for pronunciation practice
      if (phrase.length > 20) {
        return 'reading';
      }

      // Default to pronunciation for shorter phrases
      return 'pronunciation';
    }

    // Check for existing function availability
    if (typeof window.initWheelGrammarChecker === 'function') {
      return 'grammar';
    }
    if (typeof window.initWheelReadingChecker === 'function') {
      return 'reading';
    }

    return 'pronunciation'; // Default
  }

  // === [ANCHOR: ENHANCED SCRIPT LOADING] ===
  // REMOVED: Body-wide marking was over-marking everything
  // Elements will be marked at creation time by individual scripts

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
   *  Host is different from where this bootstrap lives. 1
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
      // Run comprehensive cleanup before loading any script
      if (window.SpeakSmartElementMarker && window.SpeakSmartElementMarker.comprehensivePreScriptCleanup) {
        window.SpeakSmartElementMarker.comprehensivePreScriptCleanup();
      }

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
          // Guard against undefined points
          if (!a || !b || a.x === undefined || a.y === undefined || b.x === undefined || b.y === undefined) {
            continue;
          }
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
        (message.includes('Loading animation hidden') && !window.__SS_EXTENDED_LOADING)
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
    // Use type-specific cleanup if we know the active script
    if (window.SpeakSmartElementMarker) {
      const suppressionCleanup = window.SpeakSmartElementMarker.cleanupMarkedElements(window.__SS_ACTIVE_SCRIPT);
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
    // Use type-specific cleanup if we know the active script
    if (window.SpeakSmartElementMarker) {
      const markedCleanup = window.SpeakSmartElementMarker.cleanupMarkedElements(window.__SS_ACTIVE_SCRIPT);
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

  // Restore original functions
  document.createElement = originalCreateElement;
  Element.prototype.appendChild = originalAppendChild;

  console.log('✅ BOOTSTRAP: Script loading interception installed');

  // ========================================================
  // SMART SCRIPT DETECTION & ROUTING
  // ========================================================
  // Detects which SpeakSmart script is loaded and calls the correct init function
  window.detectAndInitializeSpeakSmartScript = function() {
    console.log('🔍 BOOTSTRAP: Starting strict script detection...');

    // First priority: Check for pending script from interception
    if (window.__SS_PENDING_SCRIPT) {
      const pendingScript = window.__SS_PENDING_SCRIPT;
      console.log('📄 BOOTSTRAP: Using pending script:', pendingScript);
      window.__SS_PENDING_SCRIPT = null;

      // Determine script type
      const scriptType = pendingScript.includes('grammar') ? 'grammar' :
                         pendingScript.includes('reading') ? 'reading' : 'pronunciation';

      // Wait for script to load and define its init function
      waitForInitFunction(scriptType, 0);
      return;
    }

    // Second priority: Context-based detection
    const contextScriptType = detectScriptTypeFromContext();
    console.log('🔍 BOOTSTRAP: Context suggests script type:', contextScriptType);

    // Wait for script to load
    waitForInitFunction(contextScriptType, 0);
  };

  function waitForInitFunction(scriptType, attempt) {
    const maxAttempts = 80; // 80 attempts × 100ms = 8 seconds (3 second cleanup + 5 second retry)
    const retryDelay = 100; // 100ms between attempts

    console.log(`🔍 BOOTSTRAP: Waiting for ${scriptType} init function (attempt ${attempt + 1}/${maxAttempts})...`);

    const initFunctions = {
      'grammar': 'initWheelGrammarChecker',
      'reading': 'initWheelReadingChecker',
      'pronunciation': '_originalInitWheelPronunciationChecker'
    };

    const initFunctionName = initFunctions[scriptType];
    const initFunction = window[initFunctionName];

    // Check if the init function exists
    if (typeof initFunction === 'function') {
      console.log(`✅ BOOTSTRAP: Found ${scriptType} init function after ${attempt + 1} attempts, calling it now`);

      // Set marker type
      if (window.SpeakSmartElementMarker) {
        window.SpeakSmartElementMarker.setType(scriptType);
        window.__SS_ACTIVE_SCRIPT = scriptType;
      }

      // Call the init function
      initFunction();
      return;
    }

    // If not found and we have attempts left
    if (attempt < maxAttempts - 1) {
      setTimeout(() => {
        waitForInitFunction(scriptType, attempt + 1);
      }, retryDelay);
      return;
    }

    // Final failure - show error message
    console.error(`❌ BOOTSTRAP: ${scriptType} init function not found after ${maxAttempts} attempts (${maxAttempts * retryDelay}ms)`);
    showErrorMessage(`${scriptType.charAt(0).toUpperCase() + scriptType.slice(1)} script not found - please refresh and try again`);
  }

  // Store the original initWheelPronunciationChecker if it exists (for pronunciation-only scripts)
  if (window.initWheelPronunciationChecker && !window._originalInitWheelPronunciationChecker) {
    window._originalInitWheelPronunciationChecker = window.initWheelPronunciationChecker;
  }

  // Override the generic initWheelPronunciationChecker to use smart routing
  window.initWheelPronunciationChecker = function() {
    console.log('🔀 BOOTSTRAP: Generic init called - routing to correct script...');
    window.detectAndInitializeSpeakSmartScript();
  };

  // === [ANCHOR: ERROR MESSAGE FUNCTION] ===
  function showErrorMessage(message) {
    // Hide any existing animations
    if (brainState.overlay && brainState.overlay.parentNode) {
      brainState.overlay.parentNode.removeChild(brainState.overlay);
    }

    // Create error overlay
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      background: rgba(220, 53, 69, 0.95); color: white; padding: 30px;
      border-radius: 15px; font-size: 18px; text-align: center;
      z-index: 10000; max-width: 500px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    `;
    errorDiv.innerHTML = `
      <div style="margin-bottom: 20px;">🚨</div>
      <strong>SpeakSmart Error</strong><br><br>
      ${message}<br><br>
      <button onclick="location.reload()" style="
        background: #007bff; color: white; border: none;
        padding: 10px 20px; border-radius: 5px; cursor: pointer;
        font-size: 16px;
      ">
        🔄 Refresh Page
      </button>
    `;

    document.body.appendChild(errorDiv);
    console.log('🚨 BOOTSTRAP: Error message displayed to user');
  }

  // === [ANCHOR: EXTENDED CLEANUP FUNCTION] ===
  function performExtendedCleanupForScriptLoading(scriptType) {
    console.log('🧹 BOOTSTRAP: Performing extended cleanup for', scriptType);

    // Show/extend loader animation for cleanup duration
    if (!brainState.overlay || !brainState.overlay.parentNode) {
      showMarketingBrainAnimation();
    }

    // Set extended loading flag
    window.__SS_EXTENDED_LOADING = true;

    // Set a timeout to end extended loading (3 seconds)
    setTimeout(() => {
      window.__SS_EXTENDED_LOADING = false;
      console.log('⏰ BOOTSTRAP: Extended loading period ended');
    }, 3000);

    let cleanupCount = 0;

    // Remove all SpeakSmart marked elements
    if (window.SpeakSmartElementMarker) {
      cleanupCount += window.SpeakSmartElementMarker.cleanupMarkedElements();
    }

    // Remove OLD script tags (but NOT the one currently loading)
    ['speaksmart-reading-gpt.js', 'speaksmart-grammar-gpt.js', 'speaksmart-pron-gpt.js'].forEach(scriptName => {
      document.querySelectorAll(`script[src*="${scriptName}"]`).forEach(script => {
        // Don't remove the script that's currently trying to load!
        const scriptSrc = script.src.toLowerCase();
        if (window.__SS_PENDING_SCRIPT && scriptSrc.includes(scriptName.toLowerCase())) {
          const pendingSrc = window.__SS_PENDING_SCRIPT.toLowerCase();
          if (scriptSrc.includes(pendingSrc.split('?')[0].split('/').pop())) {
            console.log('💾 BOOTSTRAP: Preserving currently loading script:', script.src);
            return; // Skip this one
          }
        }
        
        if (script.parentNode) {
          script.parentNode.removeChild(script);
          cleanupCount++;
          console.log('🗑️ BOOTSTRAP: Removed old script:', script.src);
        }
      });
    });

    // Remove known UI elements (including wrapper's reusable mic elements)
    const elementsToRemove = [
      'reading-container', 
      'grammar-container', 
      'circularPrompt', 
      'expected-phrase-bubble',
      'micContainer'  // ← Force removal so each script creates fresh mic elements
    ];
    
    elementsToRemove.forEach(id => {
      const el = document.getElementById(id);
      if (el && el.parentNode) {
        el.parentNode.removeChild(el);
        cleanupCount++;
        console.log('🗑️ BOOTSTRAP: Removed element:', id);
      }
    });

    // DELETE ALL OLD INIT FUNCTIONS (they'll be recreated when new script loads)
    const initFunctionsToDelete = [
      'initWheelReadingChecker',
      'initWheelGrammarChecker', 
      '_originalInitWheelPronunciationChecker'
    ];
    
    initFunctionsToDelete.forEach(funcName => {
      if (window[funcName]) {
        delete window[funcName];
        cleanupCount++;
        console.log('🗑️ BOOTSTRAP: Deleted old init function:', funcName);
      }
    });

    // Clear OLD global state flags
    ['SPEAKSMART_READING_LOADED', 'SPEAKSMART_GRAMMAR_LOADED', 'SPEAKSMART_PRON_LOADED'].forEach(varName => {
      if (window[varName]) {
        delete window[varName];
      }
    });

    // PRESERVE pronunciationConfig - wrapper just set it fresh for the new script
    console.log('💾 BOOTSTRAP: Preserved fresh pronunciationConfig:', window.pronunciationConfig?.expectedPhrase);

    console.log(`🧹 BOOTSTRAP: Cleanup completed - removed ${cleanupCount} items`);
  }

  console.log('✅ BOOTSTRAP: Smart script detection and routing installed');
})();
