// CompDiff site — gallery interactions
(function () {
  "use strict";

  var gridEl = document.getElementById("gallery-grid");
  var lightbox = document.getElementById("lightbox");
  if (!gridEl || !lightbox) return;

  var tabs = document.querySelectorAll(".gallery__tab");
  var modalityTabs = document.querySelectorAll(".gallery__modality-tab");
  var noteEl = document.getElementById("gallery-note");
  var cells = gridEl.querySelectorAll(".gallery__cell");
  var lightboxImg = lightbox.querySelector(".lightbox__img");
  var lightboxTitle = lightbox.querySelector(".lightbox__title");
  var lightboxPrompt = lightbox.querySelector(".lightbox__prompt");
  var lightboxClose = lightbox.querySelector(".lightbox__close");

  var currentMethod = "compdiff";
  var currentModality = "chest";
  var promptsByModality = { chest: {}, fundus: {} };
  var lastFocused = null;

  var MODALITY_NOTES = {
    chest:  "MIMIC-CXR · test-set generations",
    fundus: "FairGenMed · test-set generations · no Hispanic samples in dataset (those cells shown as “no data”)"
  };

  function srcFor(modality, method, age, sex, race) {
    return "assets/img/gallery/" + modality + "/" + method + "/" + age + "_" + sex + "_" + race + ".png";
  }

  function keyFor(cell) {
    return cell.dataset.age + "_" + cell.dataset.sex + "_" + cell.dataset.race;
  }

  function applyMethod(method) {
    currentMethod = method;
    refreshGrid();
    tabs.forEach(function (tab) {
      var active = tab.dataset.method === method;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
    });
  }

  function applyModality(modality) {
    currentModality = modality;
    gridEl.dataset.modality = modality;
    if (noteEl) noteEl.textContent = MODALITY_NOTES[modality] || "";
    refreshGrid();
    modalityTabs.forEach(function (tab) {
      var active = tab.dataset.modality === modality;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
    });
    // Lazy-load prompts for the active modality if not already loaded
    if (Object.keys(promptsByModality[modality]).length === 0) {
      fetch("assets/img/gallery/" + modality + "/prompts.json")
        .then(function (r) { return r.ok ? r.json() : {}; })
        .then(function (data) { promptsByModality[modality] = data; })
        .catch(function () { /* ignore */ });
    }
  }

  function refreshGrid() {
    gridEl.classList.add("gallery--fading");
    cells.forEach(function (cell) {
      var img = cell.querySelector("img");
      // Reset any previous missing state before loading new src
      cell.classList.remove("gallery__cell--missing");
      img.src = srcFor(currentModality, currentMethod, cell.dataset.age, cell.dataset.sex, cell.dataset.race);
    });
    setTimeout(function () {
      gridEl.classList.remove("gallery--fading");
    }, 200);
  }

  // Mark cells whose image fails to load (e.g. fundus Hispanic = no data)
  cells.forEach(function (cell) {
    var img = cell.querySelector("img");
    img.addEventListener("error", function () {
      cell.classList.add("gallery__cell--missing");
    });
  });

  function openLightbox(cell) {
    // Skip lightbox for missing cells
    if (cell.classList.contains("gallery__cell--missing")) return;
    var key = keyFor(cell);
    var methodLabel = {
      "baseline": "Baseline SD",
      "fairdiffusion": "FairDiffusion",
      "compdiff": "CompDiff"
    }[currentMethod];
    var modalityLabel = currentModality === "chest" ? "Chest X-ray" : "Fundus";
    lightboxImg.src = srcFor(currentModality, currentMethod, cell.dataset.age, cell.dataset.sex, cell.dataset.race);
    lightboxImg.alt = cell.querySelector("img").alt;
    lightboxTitle.textContent = methodLabel + " · " + modalityLabel + " — " + cell.dataset.age + " · " + cell.dataset.sex + " · " + cell.dataset.race;
    lightboxPrompt.textContent = (promptsByModality[currentModality] || {})[key] || "";
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

  modalityTabs.forEach(function (tab) {
    tab.addEventListener("click", function () { applyModality(tab.dataset.modality); });
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

  // Initial state: chest modality + compdiff method. applyModality lazy-loads prompts.
  applyModality("chest");
  applyMethod("compdiff");

  // BibTeX copy button
  var copyBtn = document.querySelector(".bibtex__copy");
  if (copyBtn) {
    copyBtn.addEventListener("click", function () {
      var target = document.querySelector(copyBtn.dataset.target);
      if (!target) return;
      var text = target.innerText;
      navigator.clipboard.writeText(text).then(function () {
        copyBtn.classList.add("is-copied");
        copyBtn.textContent = "Copied!";
        setTimeout(function () {
          copyBtn.classList.remove("is-copied");
          copyBtn.textContent = "Copy";
        }, 1500);
      }).catch(function () {
        copyBtn.textContent = "Copy failed";
        setTimeout(function () { copyBtn.textContent = "Copy"; }, 1500);
      });
    });
  }

  // -------------------------------------------------------------
  // Results-table enhancer: inline comparison bars, best-in-column
  // badges, crosshair hover, and a CD-vs-Baseline delta row.
  // -------------------------------------------------------------

  function enhanceResultsTable(table) {
    var headerDir = {};
    table.querySelectorAll("thead th[data-col]").forEach(function (th) {
      if (th.dataset.direction) headerDir[th.dataset.col] = th.dataset.direction;
    });

    var groups = {};
    table.querySelectorAll("tbody td[data-value]").forEach(function (cell) {
      var row = cell.closest("tr");
      var g = (row && row.dataset.group) || "default";
      var col = cell.dataset.col;
      var dir = cell.dataset.direction || headerDir[col] || "lower";
      var key = g + "||" + col;
      if (!groups[key]) groups[key] = { cells: [], direction: dir };
      groups[key].cells.push(cell);
    });

    Object.keys(groups).forEach(function (key) {
      var g = groups[key];
      var values = g.cells.map(function (c) { return parseFloat(c.dataset.value); });
      var min = Math.min.apply(null, values);
      var max = Math.max.apply(null, values);
      var range = max - min || 1;

      g.cells.forEach(function (cell) {
        var v = parseFloat(cell.dataset.value);
        var pct;
        if (g.direction === "higher") {
          pct = ((v - min) / range) * 100;
        } else {
          pct = ((max - v) / range) * 100;
        }
        // Floor so even the worst cell shows a hint of bar.
        pct = Math.max(8, pct);
        cell.style.setProperty("--bar-pct", pct.toFixed(1) + "%");
        var isBest = (g.direction === "higher" && v === max) ||
                     (g.direction === "lower"  && v === min);
        if (isBest) cell.classList.add("is-best");
      });
    });
  }

  function addDeltaRow(table) {
    var tfootRow = table.querySelector('tfoot tr[data-compute="delta-vs-baseline"]');
    if (!tfootRow) return;
    var placeholder = tfootRow.querySelector(".delta-placeholder");
    if (!placeholder) return;

    var bodyRows = table.querySelectorAll("tbody tr");
    var bRow = null, cdRow = null;
    bodyRows.forEach(function (row) {
      var methodEl = row.querySelector(".method");
      var label = methodEl ? methodEl.textContent.trim() : "";
      if (label === "Baseline" || label === "B") bRow = row;
      if (row.classList.contains("row--cd")) cdRow = row;
    });
    if (!bRow || !cdRow) return;

    var bCells = bRow.querySelectorAll("td[data-value]");
    var cdCells = cdRow.querySelectorAll("td[data-value]");
    if (bCells.length !== cdCells.length) return;

    var grid = document.createElement("div");
    grid.className = "delta-grid";
    grid.style.setProperty("--delta-cols", bCells.length);

    for (var i = 0; i < bCells.length; i++) {
      var b = parseFloat(bCells[i].dataset.value);
      var cd = parseFloat(cdCells[i].dataset.value);
      var pct = ((b - cd) / b) * 100;  // positive = CD better (lower FID)
      var cellEl = document.createElement("div");
      cellEl.className = "delta-cell";
      if (pct > 0.1) {
        cellEl.innerHTML = '<span class="arrow">▼</span>' + pct.toFixed(1) + "%";
      } else if (pct < -0.1) {
        cellEl.classList.add("delta-cell--bad");
        cellEl.innerHTML = '<span class="arrow">▲</span>' + Math.abs(pct).toFixed(1) + "%";
      } else {
        cellEl.classList.add("delta-cell--neutral");
        cellEl.textContent = "±0%";
      }
      grid.appendChild(cellEl);
    }
    placeholder.innerHTML = "";
    placeholder.appendChild(grid);
  }

  function bindCrosshair(table) {
    table.addEventListener("mouseover", function (e) {
      var cell = e.target.closest("td[data-col], th[data-col]");
      if (!cell || !table.contains(cell)) return;
      var col = cell.dataset.col;
      table.querySelectorAll('[data-col="' + col + '"]').forEach(function (el) {
        el.classList.add("is-col-hover");
      });
    });
    table.addEventListener("mouseout", function (e) {
      var cell = e.target.closest("td[data-col], th[data-col]");
      if (!cell || !table.contains(cell)) return;
      var col = cell.dataset.col;
      table.querySelectorAll('[data-col="' + col + '"]').forEach(function (el) {
        el.classList.remove("is-col-hover");
      });
    });
  }

  document.querySelectorAll('.results-table[data-enhance="true"]').forEach(function (t) {
    enhanceResultsTable(t);
    addDeltaRow(t);
    bindCrosshair(t);
  });

  // Intersectional-table modality toggle (Chest / Fundus)
  (function () {
    var tabs = document.querySelectorAll(".intersectional-tab");
    var panels = document.querySelectorAll(".intersectional-table");
    if (!tabs.length || !panels.length) return;
    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        var m = tab.dataset.modality;
        tabs.forEach(function (t) { t.classList.toggle("is-active", t === tab); });
        panels.forEach(function (p) {
          p.classList.toggle("is-hidden", p.dataset.modality !== m);
        });
      });
    });
  })();
})();
