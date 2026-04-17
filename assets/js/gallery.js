// CompDiff site — gallery interactions
(function () {
  "use strict";

  var gridEl = document.getElementById("gallery-grid");
  var lightbox = document.getElementById("lightbox");
  if (!gridEl || !lightbox) return;

  var tabs = document.querySelectorAll(".gallery__tab");
  var cells = gridEl.querySelectorAll(".gallery__cell");
  var lightboxImg = lightbox.querySelector(".lightbox__img");
  var lightboxTitle = lightbox.querySelector(".lightbox__title");
  var lightboxPrompt = lightbox.querySelector(".lightbox__prompt");
  var lightboxClose = lightbox.querySelector(".lightbox__close");

  var currentMethod = "compdiff";
  var prompts = {};
  var lastFocused = null;

  function srcFor(method, age, sex, race) {
    return "assets/img/gallery/" + method + "/" + age + "_" + sex + "_" + race + ".png";
  }

  function keyFor(cell) {
    return cell.dataset.age + "_" + cell.dataset.sex + "_" + cell.dataset.race;
  }

  function applyMethod(method) {
    currentMethod = method;
    gridEl.classList.add("gallery--fading");
    cells.forEach(function (cell) {
      var img = cell.querySelector("img");
      img.src = srcFor(method, cell.dataset.age, cell.dataset.sex, cell.dataset.race);
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

  function openLightbox(cell) {
    var key = keyFor(cell);
    var methodLabel = {
      "baseline": "Baseline SD",
      "fairdiffusion": "FairDiffusion",
      "compdiff": "CompDiff"
    }[currentMethod];
    lightboxImg.src = srcFor(currentMethod, cell.dataset.age, cell.dataset.sex, cell.dataset.race);
    lightboxImg.alt = cell.querySelector("img").alt;
    lightboxTitle.textContent = methodLabel + " — " + cell.dataset.age + " · " + cell.dataset.sex + " · " + cell.dataset.race;
    lightboxPrompt.textContent = prompts[key] || "";
    lightbox.setAttribute("aria-hidden", "false");
    lastFocused = cell;
    lightboxClose.focus();
  }

  function closeLightbox() {
    lightbox.setAttribute("aria-hidden", "true");
    lightboxImg.src = "";
    if (lastFocused) lastFocused.focus();
  }

  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () { applyMethod(tab.dataset.method); });
  });

  cells.forEach(function (cell) {
    cell.addEventListener("click", function () { openLightbox(cell); });
  });

  lightboxClose.addEventListener("click", closeLightbox);

  lightbox.addEventListener("click", function (e) {
    if (e.target === lightbox) closeLightbox();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && lightbox.getAttribute("aria-hidden") === "false") {
      closeLightbox();
    }
  });

  fetch("assets/img/gallery/prompts.json")
    .then(function (r) { return r.ok ? r.json() : {}; })
    .then(function (data) { prompts = data; })
    .catch(function () { /* ignore */ });

  applyMethod("compdiff");
})();
