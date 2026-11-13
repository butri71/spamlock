// Security help pages: scam chat tabs, news filters, and a store-tap event (sent only when Analytics was accepted).
(function(){
  // Scam chat: one stage per scam; picking a tab shows its stage and restarts the animation.
  document.querySelectorAll('.h-tabs').forEach(function(list){
    var tabs = list.querySelectorAll('[role="tab"]');
    tabs.forEach(function(tab){
      tab.addEventListener('click', function(){
        tabs.forEach(function(t){
          var on = t === tab, stage = document.getElementById(t.getAttribute('aria-controls'));
          t.setAttribute('aria-selected', on ? 'true' : 'false');
          t.tabIndex = on ? 0 : -1;
          stage.hidden = !on;
        });
      });
    });
  });

  // News filters: show only the items with the picked tag.
  document.querySelectorAll('.h-filters').forEach(function(bar){
    var buttons = bar.querySelectorAll('button');
    buttons.forEach(function(b){
      b.addEventListener('click', function(){
        buttons.forEach(function(x){ x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        document.querySelectorAll('.h-item').forEach(function(item){
          item.hidden = !!b.dataset.tag && item.dataset.tag !== b.dataset.tag;
        });
      });
    });
  });

  document.addEventListener('click', function(e){
    var link = e.target.closest('a[href*="apps.apple.com"],a[href*="play.google.com"]');
    if (!link || !window.gtag) return;
    var store = link.href.indexOf('apps.apple.com') >= 0 ? 'app_store' : 'google_play';
    gtag('event', 'store_tap', { store: store, page: document.body.dataset.page, place: link.closest('.h-app') ? 'app_card' : 'closing_panel' });
  });
})();
