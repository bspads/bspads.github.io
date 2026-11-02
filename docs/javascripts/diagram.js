// Интерактивная схема кнопок (.gp-diagram): клик по кружку подсвечивает
// подсказку и соответствующую строку в списке .gp-diagram__legend, который
// идёт сразу после диаграммы в разметке.
(function () {
  function clear(scope) {
    scope.querySelectorAll(".is-active").forEach(function (el) {
      el.classList.remove("is-active");
    });
  }

  function bind(diagram) {
    var legend = diagram.nextElementSibling;
    if (!legend || !legend.classList.contains("gp-diagram__legend")) legend = null;

    diagram.querySelectorAll(".gp-diagram__dot").forEach(function (dot) {
      dot.addEventListener("click", function () {
        var was = dot.classList.contains("is-active");
        clear(diagram);
        if (legend) clear(legend);
        if (!was) {
          dot.classList.add("is-active");
          if (legend) {
            var row = legend.querySelector('[data-num="' + dot.textContent.trim() + '"]');
            if (row) row.classList.add("is-active");
          }
        }
      });
    });
  }

  document$.subscribe(function () {
    document.querySelectorAll(".gp-diagram").forEach(bind);
  });
})();
