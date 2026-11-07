// Language menu: remembers the visitor's pick and closes when they click elsewhere.
(function(){
  var menu = document.querySelector('.langs');
  if (!menu) return;
  menu.addEventListener('click', function(e){
    var link = e.target.closest('a[data-lang]');
    if (link) { try { localStorage.setItem('spamlock-lang', link.dataset.lang); } catch (err) {} }
  });
  document.addEventListener('click', function(e){ if (!menu.contains(e.target)) menu.open = false; });
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape') menu.open = false; });
})();
