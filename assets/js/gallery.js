// CompDiff site — gallery interactions
(function () {
  "use strict";

  var gridEl = document.getElementById("gallery-grid");
  if (!gridEl) return;

  var tabs = document.querySelectorAll(".gallery__tab");
  var cells = gridEl.querySelectorAll(".gallery__cell");

  function srcFor(method, age, sex, race) {
    return "assets/img/gallery/" + method + "/" + age + "_" + sex + "_" + race + ".png";
  }

  function applyMethod(method) {
    gridEl.classList.add("gallery--fading");

    cells.forEach(function (cell) {
      var img = cell.querySelector("img");
      var age = cell.dataset.age;
      var sex = cell.dataset.sex;
      var race = cell.dataset.race;
      img.src = srcFor(method, age, sex, race);
    });

    tabs.forEach(function (tab) {
      var active = tab.dataset.method === method;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
    });

    setTimeout(function () {
      gridEl.classList.remove("gallery--fading");
    }, 200);
  }

  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      applyMethod(tab.dataset.method);
    });
  });

  applyMethod("compdiff");
})();
