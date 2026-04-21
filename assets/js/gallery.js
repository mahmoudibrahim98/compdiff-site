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
  var lightboxSize = lightbox.querySelector(".lightbox__size");
  var lightboxPrompt = lightbox.querySelector(".lightbox__prompt");
  var lightboxClose = lightbox.querySelector(".lightbox__close");

  var currentMethod = "compdiff";
  var currentModality = "chest";
  var promptsByModality = { chest: {}, fundus: {} };
  var samplesByModality = { chest: {}, fundus: {} };   // cell-key -> count available
  var sampleIdxByCell = {};                            // cell-key -> current sample index
  var lastFocused = null;

  var MODALITY_NOTES = {
    chest:  "MIMIC-CXR · test-set generations",
    fundus: "FairGenMed · test-set generations · no Hispanic samples in dataset (those cells shown as “no data”)"
  };

  function srcFor(modality, method, age, sex, race, idx) {
    return "assets/img/gallery/" + modality + "/" + method + "/" + age + "_" + sex + "_" + race + "_" + (idx || 0) + ".png";
  }

  function keyFor(cell) {
    return cell.dataset.age + "_" + cell.dataset.sex + "_" + cell.dataset.race;
  }

  function currentIdxForKey(key) {
    return sampleIdxByCell[key] || 0;
  }

  // Internal "80plus" → user-visible "80+" (URL-safe filename stays "80plus")
  function ageLabel(age) {
    return age === "80plus" ? "80+" : age;
  }

  // Per-subgroup training-data representation (MIMIC-CXR chest; counts from
  // the test split, which mirrors training distribution). Used to show a
  // rarity chip on each cell.
  var SIZE_BY_MODALITY = {
    chest: {
      "18-40_F_Asian": 48,    "18-40_F_Black": 280,  "18-40_F_Hispanic": 71,   "18-40_F_White": 295,
      "18-40_M_Asian": 18,    "18-40_M_Black": 80,   "18-40_M_Hispanic": 73,   "18-40_M_White": 294,
      "40-60_F_Asian": 39,    "40-60_F_Black": 296,  "40-60_F_Hispanic": 140,  "40-60_F_White": 686,
      "40-60_M_Asian": 62,    "40-60_M_Black": 277,  "40-60_M_Hispanic": 153,  "40-60_M_White": 807,
      "60-80_F_Asian": 53,    "60-80_F_Black": 294,  "60-80_F_Hispanic": 90,   "60-80_F_White": 811,
      "60-80_M_Asian": 55,    "60-80_M_Black": 194,  "60-80_M_Hispanic": 62,   "60-80_M_White": 1232,
      "80plus_F_Asian": 18,   "80plus_F_Black": 46,  "80plus_F_Hispanic": 16,  "80plus_F_White": 224,
      "80plus_M_Asian": 5,    "80plus_M_Black": 22,  "80plus_M_Hispanic": 6,   "80plus_M_White": 292,
    },
    fundus: {}   // counts not provided — chips omitted for fundus
  };

  function rarityTier(pct) {
    if (pct < 1)   return "rare";
    if (pct < 3)   return "moderate";
    if (pct < 8)   return "common";
    return "majority";
  }

  // Stamp a display-safe age label on each cell + (on chest) add a count chip
  cells.forEach(function (cell) {
    cell.dataset.ageLabel = ageLabel(cell.dataset.age);
    var chip = document.createElement("span");
    chip.className = "gallery__cell-count";
    cell.appendChild(chip);
  });

  function updateCountChips() {
    var sizes = SIZE_BY_MODALITY[currentModality] || {};
    var total = 0;
    Object.keys(sizes).forEach(function (k) { total += sizes[k]; });
    var legend = document.getElementById("gallery-legend");
    if (legend) legend.classList.toggle("is-hidden", total === 0);
    cells.forEach(function (cell) {
      var chip = cell.querySelector(".gallery__cell-count");
      if (!chip) return;
      var key = keyFor(cell);
      var n = sizes[key];
      if (typeof n !== "number" || total === 0) {
        chip.style.display = "none";
        delete cell.dataset.rarity;
        return;
      }
      var pct = (n / total) * 100;
      var tier = rarityTier(pct);
      chip.style.display = "";
      chip.textContent = pct < 0.1 ? "<0.1%" : pct.toFixed(pct < 1 ? 2 : 1) + "%";
      chip.title = "n = " + n + " (" + pct.toFixed(2) + "% of the dataset)";
      cell.dataset.rarity = tier;
    });
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
    updateCountChips();
    refreshGrid();
    modalityTabs.forEach(function (tab) {
      var active = tab.dataset.modality === modality;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
    });
    // Lazy-load prompts + samples manifest for the active modality
    if (Object.keys(promptsByModality[modality]).length === 0) {
      fetch("assets/img/gallery/" + modality + "/prompts.json")
        .then(function (r) { return r.ok ? r.json() : {}; })
        .then(function (data) { promptsByModality[modality] = data; })
        .catch(function () { /* ignore */ });
    }
    if (Object.keys(samplesByModality[modality]).length === 0) {
      fetch("assets/img/gallery/" + modality + "/samples.json")
        .then(function (r) { return r.ok ? r.json() : {}; })
        .then(function (data) { samplesByModality[modality] = data; })
        .catch(function () { /* ignore */ });
    }
  }

  function refreshGrid() {
    gridEl.classList.add("gallery--fading");
    cells.forEach(function (cell) {
      var img = cell.querySelector("img");
      var key = keyFor(cell);
      var idx = currentIdxForKey(key);
      // Reset any previous missing state before loading new src
      cell.classList.remove("gallery__cell--missing");
      img.src = srcFor(currentModality, currentMethod, cell.dataset.age, cell.dataset.sex, cell.dataset.race, idx);
    });
    setTimeout(function () {
      gridEl.classList.remove("gallery--fading");
    }, 200);
  }

  function shuffleAll() {
    var counts = samplesByModality[currentModality] || {};
    cells.forEach(function (cell) {
      var key = keyFor(cell);
      var n = counts[key] || 0;
      if (n > 1) {
        var cur = sampleIdxByCell[key] || 0;
        // Pick a new index different from the current one if possible
        var next;
        do { next = Math.floor(Math.random() * n); } while (n > 1 && next === cur);
        sampleIdxByCell[key] = next;
      } else if (n === 1) {
        sampleIdxByCell[key] = 0;
      }
    });
    refreshGrid();
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
    var idx = currentIdxForKey(key);
    var methodLabel = {
      "baseline": "Baseline SD",
      "fairdiffusion": "FairDiffusion",
      "compdiff": "CompDiff"
    }[currentMethod];
    var modalityLabel = currentModality === "chest" ? "Chest X-ray" : "Fundus";
    lightboxImg.src = srcFor(currentModality, currentMethod, cell.dataset.age, cell.dataset.sex, cell.dataset.race, idx);
    lightboxImg.alt = cell.querySelector("img").alt;
    lightboxTitle.textContent = methodLabel + " · " + modalityLabel + " — " + ageLabel(cell.dataset.age) + " · " + cell.dataset.sex + " · " + cell.dataset.race;
    var promptKey = key + "_" + idx;
    var prompts = promptsByModality[currentModality] || {};
    var sizes = SIZE_BY_MODALITY[currentModality] || {};

    // Size chip (separate from prompt text)
    if (typeof sizes[key] === "number") {
      var total = 0;
      Object.keys(sizes).forEach(function (k) { total += sizes[k]; });
      var pct = (sizes[key] / total * 100);
      var rarity = rarityTier(pct);
      lightboxSize.style.display = "";
      lightboxSize.dataset.rarity = rarity;
      lightboxSize.innerHTML =
        '<span class="lightbox__size-label">Subgroup size:</span> ' +
        '<span class="lightbox__size-value">n = ' + sizes[key] + '</span>' +
        '<span class="lightbox__size-sep">·</span>' +
        '<span class="lightbox__size-pct">' + pct.toFixed(2) + '% of dataset</span>' +
        '<span class="lightbox__size-tier">' + rarity + '</span>';
    } else {
      lightboxSize.style.display = "none";
      lightboxSize.textContent = "";
    }

    lightboxPrompt.textContent = prompts[promptKey] || prompts[key] || "";
    lightboxPrompt.style.display = lightboxPrompt.textContent ? "" : "none";
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

  var shuffleBtn = document.getElementById("gallery-shuffle");
  if (shuffleBtn) {
    shuffleBtn.addEventListener("click", function () {
      shuffleBtn.classList.add("is-spinning");
      shuffleAll();
      setTimeout(function () { shuffleBtn.classList.remove("is-spinning"); }, 600);
    });
  }

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

  // -------------------------------------------------------------
  // Interactive bar charts for Results section (replaces static PNG).
  // 8 metrics, 2x4 grid. Values sourced from each run's
  // test_manifest.json (documented beside each number).
  // -------------------------------------------------------------
  (function renderCharts() {
    var grid = document.getElementById("charts-grid");
    if (!grid) return;

    // Values from test_manifest.json per method/modality (canonical checkpoints):
    //   chest: baseline step-10k / FairDiffusion step-7.5k / CompDiff step-20k
    //   fundus: all three at step-11k
    var METRICS = [
      // ---------- Top row: both modalities ----------
      {
        label: "FID", dir: "lower", prec: 1,
        chest:  { baseline: 78.4, fairdiffusion: 75.3, compdiff: 63.9 },
        fundus: { baseline: 76.2, fairdiffusion: 63.3, compdiff: 55.3 },
      },
      {
        label: "FID-RadImageNet", dir: "lower", prec: 2,
        chest:  { baseline: 8.44, fairdiffusion: 6.15, compdiff: 6.70 },
        fundus: { baseline: 6.31, fairdiffusion: 4.91, compdiff: 4.68 },
      },
      {
        label: "MS-SSIM", dir: null, prec: 2,       // range metric — no "best"
        chest:  { baseline: 0.32, fairdiffusion: 0.36, compdiff: 0.33 },
        fundus: { baseline: 0.35, fairdiffusion: 0.33, compdiff: 0.35 },
      },
      {
        label: "Mean AUROC", dir: "higher", prec: 2,
        chest:  { baseline: 0.80, fairdiffusion: 0.69, compdiff: 0.82 },
        fundus: { baseline: 0.94, fairdiffusion: 0.93, compdiff: 0.96 },
      },
      // ---------- Bottom row: chest only ----------
      {
        label: "BioViL", dir: "higher", prec: 2, chestOnly: true,
        chest:  { baseline: 0.27, fairdiffusion: 0.28, compdiff: 0.40 },
      },
      {
        label: "Sex accuracy", dir: "higher", prec: 2, chestOnly: true,
        chest:  { baseline: 1.00, fairdiffusion: 1.00, compdiff: 0.99 },
      },
      {
        label: "Race accuracy", dir: "higher", prec: 2, chestOnly: true,
        chest:  { baseline: 0.98, fairdiffusion: 0.98, compdiff: 0.94 },
      },
      {
        label: "Age RMSE", dir: "lower", prec: 2, chestOnly: true,
        chest:  { baseline: 5.64, fairdiffusion: 5.10, compdiff: 8.75 },
      },
    ];

    var METHODS = [
      { id: "baseline",      short: "Baseline"      },
      { id: "fairdiffusion", short: "FairDiffusion" },
      { id: "compdiff",      short: "CompDiff"      },
    ];
    var MODALITY_LABELS = { chest: "Chest", fundus: "Fundus" };

    function pickBest(values, dir) {
      if (!dir) return null;
      var valid = values.filter(function (v) { return typeof v === "number" && !isNaN(v); });
      if (!valid.length) return null;
      return dir === "higher" ? Math.max.apply(null, valid) : Math.min.apply(null, valid);
    }

    function buildGroup(metric, modalityKey) {
      var vals = METHODS.map(function (m) { return (metric[modalityKey] || {})[m.id]; });
      // Choose scale: floor >0 for AUROC/accuracy/MS-SSIM so tiny differences are visible
      var label = metric.label;
      var floorMap = { "Mean AUROC": 0.5, "BioViL": 0, "Sex accuracy": 0, "Race accuracy": 0, "MS-SSIM": 0 };
      var baseline = label in floorMap ? floorMap[label] : 0;
      var maxV = Math.max.apply(null, vals.filter(function (v) { return typeof v === "number"; }));
      var span = Math.max(maxV - baseline, 1e-6);
      var best = pickBest(vals, metric.dir);

      var group = document.createElement("div");
      group.className = "plot__group";

      var bars = document.createElement("div");
      bars.className = "plot__bars";
      METHODS.forEach(function (m, i) {
        var v = vals[i];
        var bar = document.createElement("div");
        var isBest = (best !== null) && (v === best);
        bar.className = "plot__bar plot__bar--" + m.id + (isBest ? " plot__bar--best" : "");
        var pct = typeof v === "number" ? Math.max(3, (v - baseline) / span * 100) : 0;
        bar.style.setProperty("--h-target", pct.toFixed(1) + "%");
        bar.title = m.short + " — " + metric.label + ": " + v.toFixed(metric.prec);
        bar.setAttribute("aria-label", m.short + " " + metric.label + " " + v.toFixed(metric.prec));

        var val = document.createElement("span");
        val.className = "plot__value";
        val.textContent = v.toFixed(metric.prec);
        bar.appendChild(val);

        bars.appendChild(bar);
      });
      group.appendChild(bars);

      var gLabel = document.createElement("div");
      gLabel.className = "plot__group-label";
      gLabel.textContent = MODALITY_LABELS[modalityKey] || modalityKey;
      group.appendChild(gLabel);
      return group;
    }

    function buildPlot(metric) {
      var plot = document.createElement("figure");
      plot.className = "plot" + (metric.chestOnly ? " plot--single" : "");

      var title = document.createElement("figcaption");
      title.className = "plot__title";
      var arrow = metric.dir === "higher" ? " ↑" : metric.dir === "lower" ? " ↓" : "";
      title.textContent = metric.label + arrow;
      plot.appendChild(title);

      var groups = document.createElement("div");
      groups.className = "plot__groups";
      groups.appendChild(buildGroup(metric, "chest"));
      if (!metric.chestOnly) groups.appendChild(buildGroup(metric, "fundus"));
      plot.appendChild(groups);
      return plot;
    }

    grid.innerHTML = "";
    METRICS.forEach(function (m) {
      grid.appendChild(buildPlot(m));
    });

    // Animate bars from 0 to target height on next frame
    requestAnimationFrame(function () {
      grid.querySelectorAll(".plot__bar").forEach(function (b) {
        b.classList.add("plot__bar--in");
      });
    });
  })();

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
