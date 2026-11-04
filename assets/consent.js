// Cookie choice. Google Analytics loads only after Accept; the choice is kept in this browser.
(function(){
  var KEY = 'spamlock-cookies', GA = 'G-L596RVJHDX';
  var box = document.getElementById('cookies'), settings = document.getElementById('cookieSettings');
  var read = function(){ try { return localStorage.getItem(KEY); } catch (e) { return null; } };
  var save = function(v){ try { localStorage.setItem(KEY, v); } catch (e) {} };
  var show = function(on){ box.hidden = !on; document.body.classList.toggle('cookies-open', on); };

  function loadAnalytics(){
    if (window.gtag) return;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function(){ dataLayer.push(arguments); };
    gtag('js', new Date());
    gtag('config', GA);
    var s = document.createElement('script');
    s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA;
    document.head.appendChild(s);
  }
  function clearCookies(){
    var host = location.hostname.replace(/^www\./, '');
    document.cookie.split(';').forEach(function(c){
      var name = c.split('=')[0].trim();
      if (name.indexOf('_ga') !== 0) return;
      ['', ';domain=' + host, ';domain=.' + host].forEach(function(d){
        document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/' + d;
      });
    });
  }

  document.getElementById('cookieAccept').addEventListener('click', function(){ save('yes'); show(false); loadAnalytics(); });
  document.getElementById('cookieDecline').addEventListener('click', function(){
    var had = !!window.gtag;
    save('no'); show(false); clearCookies();
    if (had) location.reload(); // stops a copy of Analytics that's already running
  });
  settings.addEventListener('click', function(){ show(true); });

  var choice = read();
  if (choice === 'yes') loadAnalytics();
  else if (choice !== 'no') show(true);
})();
