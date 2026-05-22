# Model evaluation with SROIE 2019 (`eval.vue`)

This guide explains how to run end-to-end evaluation of every model/stage in SmartDoc Scanner using your local SROIE dataset and the **`/eval`** page.

## What gets evaluated

| Stage | Technology | Model / asset |
|-------|------------|----------------|
| **Preprocess** | OpenCV.js (`preprocessWorker.js`) | Deskew, denoise, sharpen, adaptive threshold |
| **OCR** | Tesseract.js (`ocrWorker.js`) | `eng` traineddata (fixed in eval) |
| **NLP – NER** | Transformers.js | `Xenova/bert-base-NER` |
| **NLP – classifier** | Transformers.js | `Xenova/nli-deberta-v3-small` (zero-shot) |
| **CV hints** | `extractCvFeatures` | Aspect-ratio heuristics (not a neural net) |

The eval page runs the **same workers** as production scan, then compares predictions to SROIE ground truth.

## Dataset layout (your `archive` folder)

```
archive/SROIE2019/
├── test/
│   ├── img/        ← receipt images (*.jpg)
│   ├── entities/   ← ground truth (*.txt, JSON inside)
│   └── box/
└── train/
    ├── img/
    ├── entities/
    └── box/
```

For benchmarking, use **`test`** (347 image/label pairs). Use **`train`** only if you want a larger run (change folders accordingly).

Ground truth example (`test/entities/X51009568881.txt`):

```json
{
  "company": "HON HWA HARDWARE TRADING",
  "date": "21/09/2017",
  "total": "10.40"
}
```

Images and entity files are matched by **basename** (e.g. `X51009568881.jpg` ↔ `X51009568881.txt`).

## One-time setup

### 1. Install dependencies

```bash
npm install
```

### 2. Download NLP models (required for NLP stage)

```bash
node scripts/downloadModels.cjs
```

This saves ONNX weights under `public/models/`. Without this step, NLP will fail or download models at runtime (slow, needs network).

### 3. Tesseract English data (required for OCR)

OCR expects:

`public/tesseract/lang-data/eng.traineddata`

If missing, copy from the [tesseract tessdata](https://github.com/tesseract-ocr/tessdata) repo or your Tesseract install into that folder.

### 4. Environment (optional for eval)

Eval does **not** need Supabase. You can open `/eval` without logging in.

For the rest of the app, keep `.env` with `NUXT_PUBLIC_SUPABASE_URL` and `NUXT_PUBLIC_SUPABASE_ANON_KEY`.

## Run the dev server

```bash
npm run dev
```

Open: **http://localhost:3000/eval**

Use **Chrome or Edge** (Web Workers + WASM; avoid very old browsers).

## Step-by-step in the UI

### Step 1 – Load images

1. Click **Choose Images**.
2. Navigate to:
   `d:\TYSEM2\edai\smart-doc-scanner\archive\SROIE2019\test\img`
3. Press **Ctrl+A** to select all `.jpg` files → Open.

You should see e.g. `347 images loaded`.

### Step 2 – Load ground truth

1. Click **Choose Entities**.
2. Navigate to:
   `archive\SROIE2019\test\entities`
3. **Ctrl+A** → Open all `.txt` files.

You should see `347 ground truth files loaded` and **347 matched pairs ready**.

> Browsers cannot pick a folder path directly; you must multi-select all files in each folder.

### Step 3 – Configure

| Setting | Meaning |
|---------|---------|
| **Max samples** | Cap how many matched pairs to run (default 50). Use `347` for full test set. |
| **Fuzzy threshold** | % similarity for vendor/date/total match (default 80). |
| **Skip preprocess** | If checked, runs OCR+NLP on raw images only (ablation test). |

### Step 4 – Run

Click **Run Evaluation →**. Wait for:

1. Preprocess (unless skipped)  
2. OCR  
3. NLP (models load first time — can take 1–3 minutes)  
4. Score vs ground truth  

### Step 5 – Read results

**Summary scores:**

- **Avg OCR conf** – mean Tesseract confidence  
- **Vendor / Date / Total F1** – field extraction vs `company`, `date`, `total`  
- **Macro F1** – average of the three F1 scores  
- **Category accuracy** – predicts `receipt` vs SROIE (all receipts)  

**Download JSON** – exports `summary` + per-sample `results` for reports/plots.

## Metrics mapping (for your report)

| Your model | Eval metric |
|------------|-------------|
| OpenCV preprocess | Indirect: OCR confidence + field F1 (run with/without **Skip preprocess**) |
| Tesseract OCR | `avgOcrConfidence`, OCR text in JSON export |
| BERT NER | Vendor/date/total F1 (fields use NER + regex fallbacks) |
| DeBERTa classifier | `categoryAccuracy` |
| Full pipeline | Macro F1 + per-field F1 |

To compare **preprocess on vs off**, run eval twice and save two JSON files.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `0 matched pairs` | Image and entity **filenames must match** (same ID, `.jpg` vs `.txt`). |
| NLP errors / timeout | Run `node scripts/downloadModels.cjs`; reload page. |
| OCR fails immediately | Add `public/tesseract/lang-data/eng.traineddata`. |
| Redirect to `/scan` while logged in | Fixed: `/eval` is allowed when signed in (only login/register redirect to scan). |
| Redirect to login | Open `/eval` while logged out, or sign in first for other pages. |
| Very slow | Lower **Max samples** to 10–20 for a smoke test first. |
| All vendor/date/total fail | Ground truth must be JSON (Kaggle format); fixed in `parseGroundTruth`. |

## Automated full test run (347 images × 2 ablations)

For thesis/report numbers, run both preprocess settings on the **test** split without clicking through the UI.

**Terminal 1** — dev server:

```bash
npm run dev
```

**Terminal 2** — automation (uses Playwright + `/eval`, may take **several hours**):

```bash
npm install
npx playwright install chromium
npm run eval:full
```

Outputs:

- `eval-results/test-347-skip-preprocess.json` — skip preprocess **checked** (raw OCR)
- `eval-results/test-347-with-preprocess.json` — skip preprocess **unchecked** (OpenCV + OCR)

Run only one ablation:

```bash
node scripts/run-sroie-full-eval.mjs --only skip
node scripts/run-sroie-full-eval.mjs --only preprocess
```

> Use **test/** (347 pairs) for reported metrics. **train/** (626) is for optional extra experiments — change paths in `scripts/run-sroie-full-eval.mjs` if needed.

## Full test set command checklist

```bash
npm install
node scripts/downloadModels.cjs
# ensure eng.traineddata exists
npm run dev
# → http://localhost:3000/eval
# Images: archive/SROIE2019/test/img (Ctrl+A)
# Entities: archive/SROIE2019/test/entities (Ctrl+A)
# Max samples: 347
```

## What eval does *not* measure

- Per-model latency (ms) — not implemented  
- Hindi/Marathi OCR — eval uses `eng` only  
- PDF pipeline — images only  
- Supabase sync — not part of eval  

For those, extend `eval.vue` or add a Node benchmark script later.
