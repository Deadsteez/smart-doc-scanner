# SmartDoc Scanner

> AI-Powered Document Management Progressive Web App

[![Nuxt 4](https://img.shields.io/badge/Nuxt-4.x-00DC82?logo=nuxt.js)](https://nuxt.com)
[![Vue 3](https://img.shields.io/badge/Vue-3.x-4FC08D?logo=vue.js)](https://vuejs.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.x-38B2AC?logo=tailwind-css)](https://tailwindcss.com)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres-3ECF8E?logo=supabase)](https://supabase.com)
[![PWA](https://img.shields.io/badge/PWA-Offline--First-5A0FC8)](https://web.dev/progressive-web-apps/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

SmartDoc Scanner is a **privacy-first, offline-capable PWA** that transforms physical documents — receipts, invoices, bank statements, utility bills, contracts — into structured, searchable digital records using entirely **on-device AI**. No document data is sent to any external AI service.

---

## Table of Contents

- [Key Features](#-key-features)
- [System Architecture](#-system-architecture)
- [AI Pipeline](#-ai-pipeline)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Database Schema](#-database-schema)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Deployment](#-deployment)
- [Testing Guide](#-testing-guide)
- [Security](#-security)

---

## ✨ Key Features

### 📸 Document Capture
- **Live camera capture** — real-time viewfinder with environment-facing mode
- **Gallery / file upload** — JPEG, PNG image support
- **PDF processing** — page-by-page rendering to images via PDF.js worker
- **Multi-language OCR** — English, Hindi (Devanagari), Marathi via Tesseract.js

### 🧠 On-Device AI Processing
- **OpenCV.js preprocessing** — grayscale, Gaussian blur, sharpening, adaptive thresholding, deskewing, border padding — all in a Web Worker
- **Tesseract.js OCR** — 40% confidence threshold, progress-tracked, offline-capable
- **Rule-based + CV document classification** — 8 categories with pattern scoring and visual hint overrides
- **NLP field extraction** — vendor, date, total, tax, invoice/receipt number, payment method, line items, currency
- **Semantic embedding** — `all-MiniLM-L6-v2` (384-dim) via `@xenova/transformers` for intelligent search
- **Vendor intelligence** — maps vendor names to 11 expense categories (food, fuel, transport, utilities, shopping, medical, office, entertainment, financial, education, other)
- **Semantic tag extraction** — auto-tags documents with labels like `gst-invoice`, `refund`, `subscription`, `discount-applied`

### 🔍 Semantic Search
- Natural language queries: *"petrol expenses last month"*, *"Swiggy bills above ₹500"*
- NLP query parsing → structured filters (date range, amount range, category, expense type)
- Hybrid search: vector similarity + structured attribute filtering
- Duplicate document detection via cosine similarity
- Results ranked with **% match score** displayed on cards

### 💾 Storage & Sync
- **IndexedDB (Dexie.js)** — offline-first local store; all operations work without internet
- **Supabase** — PostgreSQL cloud sync with Row-Level Security
- **Supabase Storage** — document images uploaded as blobs to `document-images` bucket
- **pgvector** — semantic embeddings stored server-side for cross-device search
- **Background sync** — online/offline events, exponential backoff retry (5s → 5min), periodic 30s sync
- **Service Worker Background Sync API** — registered for `sync-unsynced-documents`

### 📊 Expense Analytics
- Spend breakdown by expense category (food, fuel, transport, etc.)
- Aggregate totals per category across all documents
- Expense Insights panel on the dashboard

### 📤 Export
- **CSV export** — all document fields including line items, confidence scores, sync status
- **PDF export** — multi-document report via jsPDF

### 👥 Multi-User Workspaces
- Create named workspaces with unique slugs
- Invite members via email (Resend API)
- Role-based access: `admin` / `member`
- Document approval workflow (pending → approved / rejected)
- Workspace-scoped documents with RLS enforcement

### 📱 PWA & Offline
- Installable on Android, iOS, desktop
- Workbox caching for all JS/CSS/HTML/models/ONNX files (up to 300MB for large AI models)
- Runtime `CacheFirst` for Supabase media, `NetworkFirst` for Supabase API
- Dark / Light mode with persistent preference

---

## 🏗 System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser / PWA                        │
│                                                             │
│  ┌──────────────┐   ┌──────────────┐   ┌────────────────┐  │
│  │  Vue 3 / UI  │   │  Pinia Store │   │  Dexie (IDB)   │  │
│  └──────┬───────┘   └──────┬───────┘   └───────┬────────┘  │
│         │                  │                    │           │
│  ┌──────▼──────────────────▼────────────────────▼───────┐  │
│  │                   Web Workers                         │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐  │  │
│  │  │  nlpWorker  │  │ embeddingWkr │  │  pdfWorker  │  │  │
│  │  │  Tesseract  │  │  MiniLM-L6   │  │   PDF.js    │  │  │
│  │  │  OpenCV.js  │  │  @xenova/    │  │             │  │  │
│  │  └─────────────┘  └──────────────┘  └─────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
└──────────────────────────────────┬──────────────────────────┘
                                   │ HTTPS (when online)
┌──────────────────────────────────▼──────────────────────────┐
│                      Supabase (Cloud)                        │
│                                                             │
│  ┌────────────────┐  ┌──────────────────┐  ┌─────────────┐ │
│  │  PostgreSQL DB │  │  Storage Bucket  │  │  Auth / JWT │ │
│  │  + pgvector    │  │  document-images │  │             │ │
│  └────────────────┘  └──────────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 🤖 AI Pipeline

Every scanned document passes through this sequential pipeline, all running client-side:

```
Camera / File / PDF
        │
        ▼
┌───────────────────────────────────────────────────────────┐
│  OpenCV.js Preprocessing (Web Worker)                     │
│  Grayscale → Blur (5×5) → Sharpen → Adaptive Threshold   │
│  → Deskew (±15°) → Border Pad (40px) → OCR-ready image   │
└───────────────────────────────┬───────────────────────────┘
                                │
                                ▼
┌───────────────────────────────────────────────────────────┐
│  Tesseract.js OCR (nlpWorker.js)                          │
│  eng + hin + mar | 40% confidence threshold               │
│  → Raw OCR text + word-level confidence scores            │
└───────────────────────────────┬───────────────────────────┘
                                │
                                ▼
┌───────────────────────────────────────────────────────────┐
│  Text Cleanup (useOcrCleanup.ts)                          │
│  Noise removal, line normalization, validity check         │
└───────────────────────────────┬───────────────────────────┘
                                │
              ┌─────────────────┼─────────────────┐
              ▼                 ▼                   ▼
┌─────────────────┐   ┌────────────────┐   ┌──────────────────┐
│  Document       │   │  Field         │   │  Vendor          │
│  Classifier     │   │  Extractor     │   │  Intelligence    │
│                 │   │                │   │                  │
│  Rule patterns  │   │  vendor, date, │   │  Expense cat.    │
│  + CV hints     │   │  total, tax,   │   │  Semantic tags   │
│  8 categories   │   │  ref#, items   │   │  (11 categories) │
└────────┬────────┘   └───────┬────────┘   └──────┬───────────┘
         │                    │                    │
         └────────────────────┼────────────────────┘
                              ▼
┌───────────────────────────────────────────────────────────┐
│  Semantic Embedding (embeddingWorker.js)                  │
│  all-MiniLM-L6-v2 (384-dim) via @xenova/transformers      │
│  → Stored in IndexedDB + synced to Supabase pgvector      │
└───────────────────────────────────────────────────────────┘
```

---

## 🛠 Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Nuxt 4 + Vue 3 | 4.2.1 / 3.5.25 |
| Language | TypeScript | 5.9.x |
| Styling | Tailwind CSS | 3.4.x |
| State Management | Pinia | 2.3.1 |
| OCR | Tesseract.js | 6.0.1 |
| Computer Vision | OpenCV.js | bundled |
| NLP / Embeddings | @xenova/transformers | 2.17.2 |
| NLP (latest) | @huggingface/transformers | 3.8.1 |
| PDF Processing | pdfjs-dist | 3.11.x |
| Local Database | Dexie (IndexedDB) | 4.2.1 |
| Cloud Database | Supabase (PostgreSQL + pgvector) | 2.95.3 |
| PDF Generation | jsPDF | 4.2.1 |
| Email | Resend | 6.12.3 |
| Auth | Supabase Auth (JWT) | — |
| PWA | @vite-pwa/nuxt + Workbox | 1.1.1 |
| Security | nuxt-security | 2.6.0 |
| Deployment | Render | node-server preset |

---

## 📁 Project Structure

```
smart-doc-scanner/
│
├── app.vue                        # Root layout
├── nuxt.config.ts                 # Nuxt, PWA, CSP, Workbox config
├── tailwind.config.js             # Design tokens
│
├── pages/
│   ├── index.vue                  # Landing page (animated canvas hero)
│   ├── login.vue                  # Email/password sign-in
│   ├── register.vue               # New account registration
│   ├── scan.vue                   # Document capture entry point
│   ├── dashboard.vue              # Document library + semantic search
│   ├── profile.vue                # User settings + dark mode toggle
│   ├── invite.vue                 # Accept workspace invite
│   ├── eval.vue                   # Internal OCR/classification eval tool
│   ├── doc/[id].vue               # Document detail view
│   └── workspace/
│       ├── index.vue              # Workspace switcher
│       ├── create.vue             # New workspace form
│       ├── settings.vue           # Workspace admin settings
│       └── approvals.vue          # Document approval queue
│
├── components/
│   ├── CameraCapture.vue          # Main scan orchestrator (camera + upload + OCR pipeline)
│   ├── DocumentCard.vue           # Document grid card
│   ├── ExpenseInsights.vue        # Spend analytics panel
│   ├── AppNavbar.vue              # Top navigation bar
│   ├── BottomNavigation.vue       # Mobile bottom nav
│   ├── LanguageSelector.vue       # Tesseract language picker
│   ├── NotificationBell.vue       # In-app notifications
│   ├── SyncStatus.vue             # Cloud sync indicator
│   └── scanner/
│       ├── cameraPreview.vue      # Live camera viewfinder
│       ├── FileUploader.vue       # Image file input
│       ├── PdfUploader.vue        # PDF file input + page preview
│       ├── ImagePreview.vue       # Captured image review
│       ├── ProcessedImage.vue     # Post-OpenCV image display
│       ├── OcrOutput.vue          # Raw OCR text display
│       ├── ocrProgress.vue        # OCR progress bar
│       └── scannerHeader.vue      # Scan page header
│
├── composables/
│   ├── useAuth.ts                 # Supabase auth state
│   ├── useCvFeatures.ts           # Image feature analysis (aspect ratio, portrait, etc.)
│   ├── useDocumentClassifier.ts   # Rule-based + CV-hint document classification
│   ├── useNlpQuery.ts             # Natural language query parser
│   ├── useOcrCleanup.ts           # OCR text normalization + validation
│   ├── usePdfProcessor.ts         # PDF → image pages (PDF.js worker bridge)
│   ├── usePermissions.ts          # Camera permission helper
│   ├── useSemanticEngine.ts       # Embedding worker + hybrid search orchestrator
│   ├── useSyncManager.ts          # Online/offline sync with exponential backoff
│   └── useTheme.ts                # Dark/light mode toggle
│
├── stores/
│   ├── documentStore.ts           # Document CRUD + Supabase push/pull
│   ├── notificationStore.ts       # In-app notification queue
│   └── workspaceStore.ts          # Workspace state + member management
│
├── services/
│   ├── db.ts                      # Dexie schema (IndexedDB)
│   ├── supabaseClient.ts          # Supabase singleton
│   ├── extractFields.ts           # Regex field extraction (vendor, date, total, tax, etc.)
│   ├── vendorIntelligence.ts      # Vendor → expense category + semantic tag mapping
│   ├── semanticSearch.ts          # Cosine similarity search + hybrid filter logic
│   ├── exportCsv.ts               # CSV generation + download
│   └── exportPdf.ts               # PDF report generation (jsPDF)
│
├── workers/
│   ├── nlpWorker.js               # Tesseract OCR + OpenCV preprocessing (heavy worker)
│   └── embeddingWorker.js         # MiniLM-L6-v2 embedding inference worker
│
├── plugins/
│   ├── auth.client.ts             # Auth state hydration on app boot
│   ├── sync.client.ts             # Sync manager initialization
│   └── sync.manager.ts            # Sync manager plugin wrapper
│
├── middleware/
│   └── auth.global.ts             # Route protection (redirects unauthenticated users)
│
├── public/
│   ├── opencv.js                  # OpenCV WASM (~10MB)
│   ├── sw.js                      # Custom service worker
│   ├── icon-192.png               # PWA icon
│   ├── icon-512.png               # PWA icon
│   ├── models/                    # Pre-downloaded ONNX model files
│   │   └── Xenova/
│   │       ├── all-MiniLM-L6-v2/  # 384-dim sentence embedding model
│   │       ├── bert-base-NER/     # Named entity recognition
│   │       └── nli-deberta-v3-small/ # Zero-shot classification
│   ├── tesseract/                 # Tesseract language data
│   │   └── lang-data/
│   │       ├── eng.traineddata
│   │       ├── hin.traineddata
│   │       └── mar.traineddata
│   ├── pdfjs/                     # PDF.js worker + CMAPS
│   ├── transformers/              # Transformers.js WASM files
│   └── workers/
│       └── pdfWorker.js           # PDF → canvas rendering worker
│
├── supabase/                      # Supabase migrations
├── types/                         # Shared TypeScript types
├── docs/                          # Internal documentation
└── scripts/
    └── downloadModels.cjs         # Pre-download ONNX models locally
```

---

## 🗄 Database Schema

### Supabase (PostgreSQL + pgvector)

The schema is applied via the combined migration in `supabase/`. Run it in **Supabase Dashboard → SQL Editor**.

```sql
-- Required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS vector;
```

#### `documents`
| Column | Type | Description |
|---|---|---|
| `id` | `uuid` PK | Auto-generated UUID |
| `user_id` | `uuid` FK → `auth.users` | Owner |
| `workspace_id` | `uuid` FK → `workspaces` | Optional workspace scope |
| `created_at` | `bigint` | Unix timestamp (ms) from client |
| `created_at_iso` | `timestamptz` | Server timestamp |
| `image` | `text` | Supabase Storage public URL |
| `ocr_text` | `text` | Raw Tesseract output |
| `cleaned_text` | `text` | Normalized OCR text |
| `vendor` | `text` | Extracted vendor name |
| `date` | `text` | Extracted document date |
| `total` | `text` | Extracted total amount |
| `receipt_number` | `text` | Invoice / receipt reference |
| `tax` | `text` | GST / VAT amount |
| `payment_method` | `text` | Cash / UPI / Card / etc. |
| `items` | `jsonb` | Line items array |
| `category` | `text` | Document type (invoice, receipt, …) |
| `nlp_label` | `text` | NLP zero-shot label |
| `category_confidence` | `numeric` | Classification confidence 0–1 |
| `category_scores` | `jsonb` | Per-category score breakdown |
| `ocr_confidence` | `float` | Average OCR word confidence |
| `embedding` | `vector(384)` | MiniLM-L6-v2 semantic embedding |
| `tags` | `text[]` | Semantic tags (gst-invoice, refund, …) |
| `synced` | `boolean` | Cloud sync status |

#### `workspaces`
| Column | Type | Description |
|---|---|---|
| `id` | `uuid` PK | Auto UUID |
| `name` | `text` | Display name |
| `slug` | `text` UNIQUE | URL-safe identifier |
| `owner_id` | `uuid` FK | Creator |
| `settings` | `jsonb` | Workspace-level config |

#### `workspace_members`
| Column | Type | Description |
|---|---|---|
| `id` | `uuid` PK | — |
| `workspace_id` | `uuid` FK | — |
| `user_id` | `uuid` FK | — |
| `role` | `text` | `admin` or `member` |
| `invited_by` | `uuid` FK | Who sent the invite |

#### `document_approvals`
| Column | Type | Description |
|---|---|---|
| `id` | `uuid` PK | — |
| `document_id` | `uuid` FK | Target document |
| `workspace_id` | `uuid` FK | — |
| `status` | `text` | `pending`, `approved`, `rejected` |
| `submitted_by` | `uuid` FK | — |
| `reviewed_by` | `uuid` FK | Admin who reviewed |
| `notes` | `text` | Review comments |

#### Vector Search Functions

Three PostgreSQL RPC functions powered by pgvector:

| Function | Purpose |
|---|---|
| `search_documents_semantic(query_embedding, p_user_id, ...)` | Cosine similarity search with optional category/date/amount filters |
| `find_similar_documents(p_document_id, p_user_id, ...)` | Find documents similar to a given document |
| `find_duplicate_documents(p_user_id, dupe_threshold)` | Detect likely duplicate scans (default ≥ 0.92 similarity) |

### Local (IndexedDB via Dexie)

```typescript
// services/db.ts — DocumentRecord
{
  id:            number          // auto-increment (Dexie key)
  supabaseId:    string          // cloud UUID after sync
  userId:        string
  workspaceId:   string
  createdAt:     number          // Unix ms
  image:         string          // base64 data-URI or Supabase URL
  ocrText:       string
  cleanedText:   string
  embedding:     number[]        // 384-dim vector
  expenseCategory: string        // food | fuel | transport | …
  semanticTags:  string[]
  extracted: {
    vendor, date, total, currency,
    tax, receiptNumber, paymentMethod,
    items: [{ description, amount }]
  }
  category: {
    type, nlpLabel, confidence, scores
  }
  synced:        boolean
}
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project with the migration applied
- A [Resend](https://resend.com) API key (for workspace invite emails)

### Installation

```bash
# Clone the repository
git clone https://github.com/Deadsteez/smart-doc-scanner.git
cd smart-doc-scanner

# Install dependencies
npm install

# (Optional) Pre-download AI models for local development
npm run download-models
```

### Environment Variables

Create a `.env` file in the project root:

```env
# Supabase
NUXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NUXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# App
NUXT_PUBLIC_SITE_URL=http://localhost:3000

# Workspace Invites
RESEND_API_KEY=re_xxxxxxxxxxxx
INVITE_SECRET=your-random-secret-string
```

### Run Locally

```bash
npm run dev
# → http://localhost:3000
```

### Production Build

```bash
npm run build
npm run preview
```

---

## ☁️ Deployment

The app is deployed on **Render** using the `node-server` Nuxt preset.

### Render Setup

1. **New Web Service** → connect your GitHub repo
2. **Build Command:** `npm install && npm run build`
3. **Start Command:** `node .output/server/index.mjs`
4. **Environment Variables:** Add all vars from `.env` above in the Render dashboard

### Supabase Setup

Run the combined migration SQL in **Supabase Dashboard → SQL Editor**:

```sql
-- 1. Enable extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Run the full migration from supabase/migrations/
-- (See the migration file for complete table + RLS + function definitions)
```

**Storage bucket:**
- Create a bucket named `document-images`
- Set it to **Public** (or configure signed URLs)
- Add CORS policy for your domain

### Content Security Policy

The `nuxt.config.ts` enforces a strict CSP. If you change your Supabase project URL, update:

```typescript
// nuxt.config.ts
'img-src': ["'self'", 'data:', 'blob:', 'https://YOUR_PROJECT.supabase.co'],
'connect-src': ["'self'", 'https://YOUR_PROJECT.supabase.co', 'wss://YOUR_PROJECT.supabase.co'],
```

---

## 🧪 Testing Guide

### Core Pipeline Test

1. Go to `/scan`
2. Upload a receipt image (JPG/PNG)
3. Watch the OCR progress bar complete
4. Verify extracted fields: **Vendor · Date · Total · Category badge**
5. Open `/dashboard` → document appears in the grid

### Semantic Search Test

With 3+ documents saved, open `/dashboard` and try:
- `"food expenses this month"` — should surface food/restaurant receipts
- `"invoices above 1000"` — filters by amount and doc type
- `"petrol bills"` — matches fuel vendor category

### Offline Test

1. Open DevTools → Network → set **Offline**
2. Navigate to `/dashboard` — documents load from IndexedDB ✅
3. Go back online — sync dot turns green, pending docs push to Supabase

### PWA Install Test

In Chrome, click the install icon in the address bar → app opens in standalone window.

### Expected Console Output (Healthy State)

```
[Embedding Worker] Starting...
[Embedding Worker] Model ready ✓
[Sync] Initializing sync manager...
[Sync] Sync completed successfully
[SemanticEngine] Enriched doc #1 → food, gst-invoice
```

### Common Issues

| Symptom | Cause | Fix |
|---|---|---|
| OCR spinner never stops | Tesseract WASM not served / MIME issue | Check Network tab for 404 on `.wasm` files |
| Embedding worker crashes | CSP blocking WASM blob | Check console for CSP violations |
| PDF upload does nothing | `pdfWorker.js` missing from `public/workers/` | Verify file exists in that path |
| Images missing after sync | Supabase Storage bucket not public | Set bucket to public in Supabase dashboard |
| Login fails | Supabase env vars not set in Render | Add vars in Render → Environment |

---

## 🔐 Security

- **Row-Level Security (RLS)** on all Supabase tables — users can only access their own documents
- **Workspace RLS** — documents in a workspace are visible only to members
- **On-device processing** — OCR, classification, and embedding run entirely in the browser; no document content is sent to any AI API
- **JWT authentication** via Supabase Auth
- **Content Security Policy** — strict CSP configured via `nuxt-security`
- **HTTPS enforcement** — HSTS in production
- **Rate limiting** — 150 requests/hour via `nuxt-security`

---

## 🗺 Roadmap

- [ ] Multi-page PDF OCR (concatenate all pages)
- [ ] Date range + amount range filter controls on dashboard
- [ ] Manual field editing on document detail page
- [ ] Time-series spend charts (monthly trends)
- [ ] Additional OCR languages (Telugu, Tamil, Kannada, Bengali)
- [ ] QuickBooks / Xero compatible CSV export format
- [ ] Real-time workspace collaboration (Supabase Realtime)
- [ ] Audit trail / document edit history

---

## 📄 License

MIT © 2026 SmartDoc Scanner
