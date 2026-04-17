# compdiff-site

Project site for **CompDiff: Hierarchical Compositional Diffusion for Fair and Zero-Shot Intersectional Medical Image Generation** (MICCAI 2026 submission, arXiv [2603.16551](https://arxiv.org/abs/2603.16551)).

Live (after Pages is enabled): https://mahmoudibrahim98.github.io/compdiff-site/

## Local preview

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Structure

```
index.html
robots.txt
assets/
  css/style.css           # all site styles
  js/gallery.js           # method toggle + lightbox + bibtex copy
  img/
    architecture.png
    cross_modality_quality_metrics.png
    og-image.png          # 1200x630 social preview
    favicon.{ico,svg,-32.png}
    gallery/
      prompts.json        # per-cell prompts for the lightbox
      compdiff/           # 24 curated PNGs (real)
      baseline/           # 24 placeholder PNGs (regenerate with curate_gallery.py)
      fairdiffusion/      # 24 placeholder PNGs (regenerate with curate_gallery.py)
```

## Replacing placeholder images

Baseline and FairDiffusion gallery cells currently show gray placeholders. To replace with real generations, run the curation script in the `RoentGen-v2` repo:

```bash
cd /path/to/RoentGen-v2
python3 scripts/curate_gallery.py \
  --baseline-run outputs_summarized/v0/<baseline_run_dir> \
  --fairdiff-run outputs_summarized/fairdiffusion/<fairdiff_run_dir> \
  --compdiff-run outputs_summarized/v7/6_train_hcn_age_from_promt_run2 \
  --checkpoint-step 18500 \
  --output-dir /path/to/compdiff-site/assets/img/gallery
```

## Design + plan

See `docs/superpowers/specs/2026-04-17-compdiff-project-site-design.md` and `docs/superpowers/plans/2026-04-17-compdiff-project-site.md` in the RoentGen-v2 repo.
