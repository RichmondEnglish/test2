/*  SpeakSmart Simple Asset Preloader */
(function () {
  if (window.__speakSmartPatched) return;
  window.__speakSmartPatched = true;

  console.log('SpeakSmart asset preloader loaded');

  // Asset configuration
  var ASSETS = {
    scripts: [
      'https://richmond-english-wheel-32e9771e3e5a.herokuapp.com/simple-pron-checker-notext.js',
      'https://richmond-english-wheel-32e9771e3e5a.herokuapp.com/simple-pron-checker.js',
      'https://richmond-english-wheel-32e9771e3e5a.herokuapp.com/pronunciation-checker.js',
      'https://richmond-english-wheel-32e9771e3e5a.herokuapp.com/speaksmart-pron-azure.js',
      'https://richmond-english-wheel-32e9771e3e5a.herokuapp.com/speaksmart-reading-gpt.js',
      'https://richmond-english-wheel-32e9771e3e5a.herokuapp.com/speaksmart-grammar-gpt.js'
    ],
    images: [
      'https://richmond-english-wheel-32e9771e3e5a.herokuapp.com/assets/SpeakSmart-loader.png',
      'https://richmond-english-wheel-32e9771e3e5a.herokuapp.com/assets/speaksmart-loading.png',
      'https://richmond-english-wheel-32e9771e3e5a.herokuapp.com/assets/rich-e.png',
      'https://richmond-english-wheel-32e9771e3e5a.herokuapp.com/assets/rich-e-detective.png',
      'https://richmond-english-wheel-32e9771e3e5a.herokuapp.com/assets/rich-e-coach.png',
      'https://richmond-english-wheel-32e9771e3e5a.herokuapp.com/assets/rich-e-mechanic.png',
      'https://richmond-english-wheel-32e9771e3e5a.herokuapp.com/assets/rich-e-reading-tips.png',
      'https://richmond-english-wheel-32e9771e3e5a.herokuapp.com/assets/rich-e-reading-tips2.png',
      'https://richmond-english-wheel-32e9771e3e5a.herokuapp.com/assets/rich-e-OP1.png',
      'https://richmond-english-wheel-32e9771e3e5a.herokuapp.com/assets/rich-e-2star.png',
      'https://richmond-english-wheel-32e9771e3e5a.herokuapp.com/assets/rich-e-3star.png',
      'https://richmond-english-wheel-32e9771e3e5a.herokuapp.com/assets/rich-e-4star.png',
      'https://richmond-english-wheel-32e9771e3e5a.herokuapp.com/assets/rich-e-5star.png'
    ]
  };

  // Preconnect to server for faster loading
  (function preconnectToAssets() {
    try {
      var head = document.head || document.getElementsByTagName('head')[0];
      if (!head) return;

      var link = document.createElement('link');
      link.rel = 'preconnect';
      link.href = 'https://richmond-english-wheel-32e9771e3e5a.herokuapp.com';
      link.crossOrigin = 'anonymous';
      head.appendChild(link);

      var dnsLink = document.createElement('link');
      dnsLink.rel = 'dns-prefetch';
      dnsLink.href = 'https://richmond-english-wheel-32e9771e3e5a.herokuapp.com';
      head.appendChild(dnsLink);

      console.log('SpeakSmart: Preconnected to asset server');
    } catch (e) {
      console.log('SpeakSmart: Preconnect failed:', e.message);
    }
  })();

  // Simple preloading functions
  function preloadScript(url) {
    try {
      var link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'script';
      link.href = url;
      link.crossOrigin = 'anonymous';
      (document.head || document.documentElement).appendChild(link);
      console.log('SpeakSmart: Preloading script:', url);
    } catch (e) {
      console.log('SpeakSmart: Failed to preload script:', url, e.message);
    }
  }

  function preloadImage(url) {
    try {
      var img = new Image();
      img.onload = function() {
        console.log('SpeakSmart: Image cached successfully:', url);
      };
      img.onerror = function() {
        console.log('SpeakSmart: Failed to cache image:', url);
      };
      img.src = url;
    } catch (e) {
      console.log('SpeakSmart: Error preloading image:', url, e.message);
    }
  }

  // Preload all assets
  function preloadAllAssets() {
    console.log('SpeakSmart: Starting asset preload...');

    // Preload scripts
    ASSETS.scripts.forEach(preloadScript);

    // Preload images
    ASSETS.images.forEach(preloadImage);

    console.log('SpeakSmart: Asset preload complete');
  }

  // Start preloading immediately
  try {
    preloadAllAssets();
  } catch(e) {
    console.log('SpeakSmart: Asset preload error:', e.message);
  }

  console.log('SpeakSmart asset preloader ready');
})();