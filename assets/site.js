(function(){
  var data = JSON.parse(document.getElementById('site-data').textContent);
  var isAndroid = /android/i.test(navigator.userAgent);
  if (isAndroid && data.android) document.documentElement.classList.add('android');
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function(id){ return document.getElementById(id); };
  var setRoll = function(el, text){
    if (el.textContent === text) return;
    el.innerHTML = '';
    var s = document.createElement('span'); s.textContent = text; el.appendChild(s);
  };

  // Hero status line: the app's own lines while checking an email.
  var lines = data.lines;
  var li = 0;
  if (!reduced) setInterval(function(){ li = (li + 1) % lines.length; setRoll($('heroRoll'), lines[li]); }, 2600);

  // "Simple help with": one phrase at a time, like the film.
  var rw = $('rw').children, ri = 0;
  if (!reduced) setInterval(function(){
    var a = rw[ri]; ri = (ri + 1) % rw.length; var b = rw[ri];
    a.classList.remove('on'); a.classList.add('out');
    b.classList.remove('out'); b.classList.add('on');
    setTimeout(function(){ a.classList.remove('out'); }, 620);
  }, 2400);

  var items = data.items;
  var done = 0, TOTAL = 8, CIRC = 283;
  function drawBox(){
    var left = items.slice(done);
    var count = function(k){ return left.filter(function(i){ return i.k === k; }).length; };
    var chip = function(el, n, word){ el.hidden = !n; el.textContent = n + ' ' + word; };
    $('bxN').textContent = left.length;
    chip($('cH'), count('high'), data.high); chip($('cM'), count('med'), data.medium); chip($('cL'), count('low'), data.low);
    chip($('cF'), 3 + done, data.fixed);
    $('bxRing').style.strokeDashoffset = CIRC * (1 - (3 + done) / TOTAL);
    if (left.length) {
      var c = left[0];
      $('box').classList.remove('clear');
      $('bxNext').textContent = c.next; $('bxKind').textContent = c.kind; $('bxWhy').textContent = c.why;
      $('bxIc').firstElementChild.setAttribute('href', '#i-' + c.ic);
      $('bxTitle').textContent = data.title;
      $('bxBtn').textContent = data.markDone;
    } else {
      $('bxTitle').textContent = data.clearTitle;
      $('box').classList.add('clear');
      $('bxNext').textContent = data.clearNext; $('bxKind').textContent = data.clearKind;
      $('bxWhy').textContent = data.clearWhy;
      $('bxIc').firstElementChild.setAttribute('href', '#i-check');
      $('bxBtn').textContent = data.startOver;
    }
  }
  function burst(){
    if (reduced) return;
    var cols = ['#A070FF','#6E8CF7','#3DB5F0','#7448EC','#FFC857','#7FD3FA','#C9B2FF'], box = $('box');
    for (var i = 0; i < 44; i++) {
      var b = document.createElement('span'); b.className = 'bit'; b.style.background = cols[i % cols.length];
      box.appendChild(b);
      var a = Math.random() * 6.28, d = 90 + Math.random() * 220;
      var an = b.animate([{transform:'translate(0,0) rotate(0)',opacity:1},{transform:'translate(' + Math.cos(a)*d + 'px,' + (Math.sin(a)*d - 40) + 'px) rotate(' + (Math.random()*540) + 'deg)',opacity:0}],{duration:900 + Math.random()*500,easing:'cubic-bezier(.15,.7,.3,1)'});
      an.onfinish = (function(n){ return function(){ n.remove(); }; })(b);
    }
  }
  $('bxBtn').addEventListener('click', function(){
    if (done >= items.length) done = 0; else { done++; if (done === items.length) burst(); }
    drawBox();
  });
  requestAnimationFrame(function(){ setTimeout(drawBox, 500); });

  // Film: nothing downloads until Play.
  var FILM = isAndroid && data.android ? data.film.play : data.film.app;
  function playFilm(){
    var p = $('player'); if (p.classList.contains('on')) return;
    p.classList.add('on');
    var v = document.createElement('video');
    v.src = FILM; v.controls = true; v.playsInline = true; v.poster = data.film.poster; v.autoplay = true;
    v.setAttribute('aria-label', data.filmLabel);
    p.innerHTML = ''; p.appendChild(v); v.focus(); var r = v.play(); if (r && r.catch) r.catch(function(){});
  }
  $('playBtn').addEventListener('click', playFilm);
  $('movieBtn').addEventListener('click', function(){ $('film').scrollIntoView({behavior: reduced ? 'auto' : 'smooth', block: 'center'}); playFilm(); });

  // Scenes: load a clip only near the screen, play only while visible.
  var clips = document.querySelectorAll('video[data-src]');
  if ('IntersectionObserver' in window && !reduced) {
    var io = new IntersectionObserver(function(es){ es.forEach(function(e){
      var v = e.target, scene = v.closest('[data-scene]');
      if (e.isIntersecting && !(scene && scene.classList.contains('paused'))) {
        if (!v.src) v.src = v.dataset.src;
        var r = v.play(); if (r && r.catch) r.catch(function(){});
      } else v.pause();
    }); }, {threshold:.25});
    clips.forEach(function(v){ io.observe(v); });
  }
  document.querySelectorAll('.pause').forEach(function(b){
    b.addEventListener('click', function(){
      var scene = b.closest('[data-scene]'), v = scene.querySelector('video');
      var paused = scene.classList.toggle('paused');
      b.setAttribute('aria-label', paused ? data.play : data.pause);
      b.querySelector('use').setAttribute('href', paused ? '#i-play' : '#i-pause');
      if (paused) v.pause(); else { if (!v.src) v.src = v.dataset.src; v.play().catch(function(){}); }
    });
  });

  // Password slip: the code scrambles once when it comes into view.
  var hash = $('hash');
  if ('IntersectionObserver' in window && !reduced) {
    var finalRest = hash.lastChild.textContent, HEX = '0123456789ABCDEF';
    var once = new IntersectionObserver(function(es, ob){
      if (!es[0].isIntersecting) return; ob.disconnect();
      var t0 = performance.now();
      (function tick(now){
        var p = Math.max(0, Math.min(1, (now - t0) / 1100)), keep = Math.floor(finalRest.length * p), out = finalRest.slice(0, keep);
        for (var i = keep; i < finalRest.length; i++) out += HEX[Math.floor(Math.random() * 16)];
        hash.lastChild.textContent = out;
        if (p < 1) requestAnimationFrame(tick);
      })(t0);
    }, {threshold:.6});
    once.observe(hash);
  }

  // Follow pill: appears after the hero, gone at the final panel, status follows the section.
  var follow = $('follow');
  if ('IntersectionObserver' in window) {
    var heroGone = false, endIn = false;
    var upd = function(){ follow.classList.toggle('in', heroGone && !endIn); };
    new IntersectionObserver(function(e){ heroGone = !e[0].isIntersecting; upd(); }, {threshold:0}).observe(document.querySelector('.hero-grid'));
    new IntersectionObserver(function(e){ endIn = e[0].isIntersecting; upd(); }, {threshold:.15}).observe($('get'));
    var st = new IntersectionObserver(function(es){ es.forEach(function(e){ if (e.isIntersecting) setRoll($('followRoll'), e.target.dataset.status); }); }, {rootMargin:'-45% 0px -45% 0px'});
    document.querySelectorAll('[data-status]').forEach(function(s){ st.observe(s); });
  }
})();
