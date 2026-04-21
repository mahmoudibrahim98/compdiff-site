# CompDiff project & site — agent briefing

**TL;DR.** This repo is the public project site for **CompDiff** (MICCAI 2026 under review, arXiv 2603.16551), a fair medical-image diffusion model. The site is a single static HTML page hosted on GitHub Pages at <https://mahmoudibrahim98.github.io/compdiff-site/>. No build step, no framework. All images ship with the repo.

---

## 1. What the paper does (30-second version)

- **Problem.** Standard text-conditioned diffusion models inherit demographic imbalances from their training data. Rare subgroups get worse image quality, and *unseen* demographic intersections (e.g., Age 80+ Asian patients with no training examples) can't be generated at all. Loss-reweighting methods like FairDiffusion help a bit but can't synthesize combinations they never saw.
- **Method.** CompDiff fixes this at the **representation** level with a **Hierarchical Conditioner Network (HCN)**:
  1. Age, sex, and race each get their own learned embedding.
  2. A small network composes them into a single **demographic token `c`**.
  3. `c` is concatenated with CLIP text embeddings and fed into Stable Diffusion 2.1's cross-attention as extra context. The UNet is LoRA-fine-tuned.
  4. Auxiliary classifiers regularise `c` so each attribute signal is preserved.
- **Result (test-set FID).**
  - Chest X-ray (MIMIC-CXR): Baseline **82.8** → FairDiffusion **75.1** → **CompDiff 64.3**
  - Fundus (FairGenMed): **72.2 → 64.3 → 54.6**
  - Up to **21% FID improvement** on held-out intersectional subgroups the model never saw in training.

## 2. Site structure

```
compdiff-site/
  index.html                 ≈ all content for the one-page site
  assets/
    css/style.css            ≈ 700 lines — site-wide styles
    js/gallery.js            ≈ 430 lines — all interactive behaviour
    img/
      architecture.png       paper's original method figure
      cross_modality_quality_metrics.png   legacy PNG, no longer rendered
      og-image.png           1200x630 social-preview image
      favicon.{ico,svg,-32.png}
      gallery/
        prompts.json?        superseded by per-modality files below
        chest/
          prompts.json       cell-id → prompt text (CompDiff)
          baseline/          24 PNGs: <age>_<sex>_<race>.png (256x256)
          fairdiffusion/     24 PNGs
          compdiff/          24 PNGs
        fundus/
          prompts.json
          baseline/          18 PNGs (no Hispanic — FairGenMed lacks it)
          fairdiffusion/     18
          compdiff/          18
  docs/
    AGENT_BRIEFING.md        this file
  README.md
  robots.txt
```

Sections on the page (top → bottom): hero, summary, abstract, method (blueprint + paper figure + 3-step walkthrough), intersectional gallery (modality + method toggles + lightbox), results (8 interactive bar charts + Table 1 + Table 2 + Table 3 + takeaways), BibTeX (copy button), footer.

## 3. Key interactive components (read these in `assets/js/gallery.js`)

- **Gallery** — nested tabs (modality outside, method inside); each method change swaps 24 `<img src>` via `srcFor(modality, method, age, sex, race)`. Missing cells (fundus Hispanic) trigger `img.onerror → cell.classList.add('gallery__cell--missing')`, which shows a hatched "no data" placeholder.
- **Lightbox** — click a cell → fullscreen modal with full-res image + prompt. `prompts.json` is fetched per-modality on first view.
- **Results tables** — any `<table data-enhance="true">` with `data-value` / `data-col` / `data-direction` on cells auto-gets: inline comparison bars, best-in-column ★ + teal outline, crosshair hover (row + column). Tables with `<tfoot tr data-compute="delta-vs-baseline">` get a "CompDiff vs Baseline" delta row auto-computed.
- **Bar charts** — 2 × 4 grid matching the paper's metrics figure (FID, FID-RadImageNet, MS-SSIM, Mean AUROC across modalities; BioViL, Sex/Race accuracy, Age RMSE chest-only). Method colours fixed; value labels inside bars; best bar gets teal ring + ★; animates in. Values hard-coded from each run's `test_manifest.json`.
- **BibTeX copy** — `navigator.clipboard.writeText(...)`.

## 4. Data sources — where the numbers come from

The paper's canonical runs + checkpoints are documented in each run's `test_manifest.json`. The site's numbers and gallery images all trace back there:

| Method | Run dir | Step | Test FID (chest / fundus) |
|---|---|---|---|
| Baseline | `v0/0_train_baseline` | 10000 / 11000 | 78.4 / 76.2 |
| FairDiffusion | `fairdiffusion/0_train_baseline_fairdiffusion` | 7500 / 11000 | 75.3 / 63.3 |
| CompDiff | `v7/6_train_hcn_age_from_promt` | 20000 / 11000 | 63.9 / 55.3 |

Chest outputs live in `RoentGen-v2/outputs_summarized/...`. Fundus outputs live in `/mnthpc/hpc-intern2/hpccoldstorage/PrecisionHealth/fair_medical_imaging/fair_medical_imaging/mutlimodal-benchmark/outputs/...`. Each run has a `test_images/step_<step>/gpu_<N>/` folder with `synthetic_NNNNNN.png`, `prompt_NNNNNN.txt`, and a `labels.pkl` dict (`{disease, sex, race, age, prompts}`).

The gallery curator is `RoentGen-v2/scripts/curate_gallery.py` — pass `--subdir test_images` to match the paper exactly.

## 5. Gotchas that bit us (fix these first if values look wrong)

1. **Sex encoding is `0 = Male, 1 = Female`.** The docstring in `validation_metrics.py:1306` claims the opposite — **it's wrong**. The authoritative source is `dataset_wds.py:parse_sex` and `src/0_prepare_data/2a_create_validation_dataset.py:131-144`. The gallery images got swapped once before this was caught.
2. **Race encoding:** `0=White, 1=Black, 2=Asian, 3=Hispanic`.
3. **Fundus has no Hispanic samples.** Only `race ∈ {0, 1, 2}` ever appears. Missing cells are an accurate fairness observation — don't silently hide them.
4. **Use `test_images/`, not `validation_images/`.** Validation images are many checkpoints × intermediate training; only `test_images/step_<step>` at the canonical checkpoint matches the paper. Fundus uses `test_images_seed0/` (seed-0 only) for some runs — the curate script handles both.
5. **Paper numbers vs our local test-manifest numbers match within ±2 FID.** This is the std of 3-seed averaging. Don't expect exact equality.
6. **Hard-reload required after a push.** Pages' CDN + browser cache can hold stale JS up to 10 minutes. If the live site looks broken but the served files check out via `curl`, try an incognito window first.

## 6. How to develop / deploy

```bash
# local preview from site repo root
python3 -m http.server 56042     # pick 56000-60000 on slurm compute nodes
# open http://localhost:56042/

# deploy = push to main
git add -A && git commit -m "…" && git push origin main
```

GitHub Pages is enabled on `main` / `/` (root). No Actions workflow; deployment is the default Pages build.

## 7. Skill for scaffolding a new paper site

A reusable skill lives at `~/.claude/skills/creating-project-site/SKILL.md` — it captures every pattern above (dark pill bar with SVG icons, enhanced tables, bar-chart grid, gallery with lightbox, verification protocol, deployment checklist). Invoke it when asked to build a site for a different paper.

## 8. What NOT to do

- Don't introduce a build step (Jekyll/Astro/Vite). Plain HTML has been intentional.
- Don't use emoji icons in the resource pill bar — inline SVGs only.
- Don't abbreviate method names (`B`, `FD`, `CD`) or subgroups (`A2/F/H`) in user-facing labels. Full names (`Baseline`, `FairDiffusion`, `CompDiff`, `Age 40-60, Female, Hispanic`) are required.
- Don't re-generate the OG preview image (`og-image.png`) per push — only rebuild it when `architecture.png` itself changes.
- Don't commit values that weren't extracted from `test_manifest.json` or the paper PDF. If a number isn't sourced, flag it rather than invent it.
