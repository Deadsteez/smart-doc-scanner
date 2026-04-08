# SmartDoc Scanner

> AI-Powered Document Scanner & Intelligent Management System

A production-ready Progressive Web Application (PWA) that transforms physical documents into structured, searchable digital records using advanced Computer Vision, OCR, and Natural Language Processing.

---

## 🎯 Executive Summary

SmartDoc Scanner is an enterprise-grade document digitization platform that combines cutting-edge AI technologies to automate document capture, text extraction, field recognition, and intelligent classification. Built with modern web technologies, it operates entirely offline-first with cloud synchronization capabilities.

### Key Differentiators
- **100% Client-Side AI Processing** - No server-side dependencies for core functionality
- **Multi-Language OCR Support** - English, Hindi, and Marathi recognition
- **Intelligent Document Classification** - Automatic categorization using NLP models
- **Offline-First Architecture** - Full functionality without internet connectivity
- **Real-Time Field Extraction** - Automatic detection of vendors, dates, amounts, and line items

---

## 🏗️ System Architecture

### Technology Stack

#### Frontend Framework
- **Nuxt 3** (v4.2.1) - Vue.js meta-framework with SSR/SSG capabilities
- **Vue 3** (v3.5.25) - Composition API for reactive UI components
- **TypeScript** - Type-safe development environment
- **Tailwind CSS** - Utility-first styling with dark mode support

#### AI & Machine Learning
- **Tesseract.js** (v6.0.1) - OCR engine with multi-language support
- **OpenCV.js** - Computer vision for image preprocessing
- **Transformers.js** (@xenova/transformers v2.17.2) - Browser-based NLP models
  - BERT-based Named Entity Recognition (NER)
  - Zero-shot document classification
  - Semantic text analysis

#### Data Management
- **Dexie.js** (v4.2.1) - IndexedDB wrapper for local storage
- **Pinia** (v2.3.1) - State management with persistence
- **Supabase** (v2.95.3) - PostgreSQL backend for cloud sync

#### Progressive Web App
- **@vite-pwa/nuxt** - Service worker & offline capabilities
- **Workbox** - Advanced caching strategies

---

## 🔬 Core Features & Capabilities

### 1. Document Capture System
- **Multi-Source Input**
  - Real-time camera capture with environment-facing mode
  - File upload (JPEG, PNG)
  - PDF document processing with page-by-page extraction
- **Adaptive Resolution** - Automatic scaling to OCR-optimal dimensions (2400px long side)
- **Camera Controls** - 1920x1080 ideal resolution with fallback support

### 2. Advanced Image Preprocessing Pipeline
Implemented in Web Workers for non-blocking performance:

```
Raw Image → Grayscale Conversion → Gaussian Blur (5x5) → 
Sharpening (Laplacian Kernel) → Adaptive Thresholding → 
Skew Correction → Border Padding → OCR-Ready Output
```

**Preprocessing Techniques:**
- **Denoising** - Gaussian blur removes sensor noise
- **Sharpening** - Laplacian filter enhances text edges
- **Adaptive Thresholding** - Handles uneven lighting (31x31 kernel)
- **Deskewing** - Automatic rotation correction (±15° max)
- **Border Padding** - 40px white borders for edge text recognition

### 3. Optical Character Recognition (OCR)
- **Multi-Language Support** - English, Hindi (Devanagari), Marathi
- **Confidence Filtering** - 40% threshold for word acceptance
- **Adaptive Engine** - Language-specific model loading
- **Progress Tracking** - Real-time recognition status updates

### 4. Natural Language Processing (NLP)
**Named Entity Recognition (NER):**
- Organization extraction (vendors/merchants)
- Date/time detection
- Monetary value identification
- Location recognition

**Document Classification:**
- Zero-shot classification across 8 categories:
  - Invoice
  - Receipt
  - Bank Statement
  - Payment Slip
  - Utility Bill
  - Tax Document
  - Contract
  - Other

**Hybrid Classification Algorithm:**
```
Final Score = (NLP Confidence × 0.8) + (CV Heuristics × 0.2)
```

### 5. Intelligent Field Extraction
**Automatic Detection:**
- Vendor/Merchant Name
- Transaction Date (multiple formats)
- Total Amount
- Tax/GST/VAT
- Receipt/Invoice Number
- Payment Method
- Line Items (description + amount)

**Extraction Methods:**
- Primary: NER entity recognition
- Fallback: Regex pattern matching
- Validation: Confidence scoring & format verification

### 6. Data Persistence & Synchronization
**Local Storage (IndexedDB):**
- Offline-first architecture
- Structured document records
- Image data as base64
- Extracted fields & metadata

**Cloud Sync (Supabase):**
- User authentication (email/password)
- Automatic background sync
- Conflict resolution
- Multi-device support

---

## 📁 Project Structure

```
smart-doc-scanner/
├── components/
│   ├── scanner/              # Modular scanner UI components
│   │   ├── CameraPreview.vue
│   │   ├── FileUploader.vue
│   │   ├── ImagePreview.vue
│   │   ├── OcrOutput.vue
│   │   ├── OcrProgress.vue
│   │   ├── PdfUploader.vue
│   │   └── ProcessedImage.vue
│   ├── CameraCapture.vue     # Main capture orchestrator
│   ├── DocumentCard.vue      # Document list item
│   └── LanguageSelector.vue  # OCR language switcher
│
├── composables/              # Reusable logic hooks
│   ├── useAuth.ts           # Authentication state
│   ├── useCvFeatures.ts     # Image analysis utilities
│   ├── useOcrCleanup.ts     # Text cleaning & validation
│   ├── usePdfProcessor.ts   # PDF parsing logic
│   └── useTheme.ts          # Dark mode management
│
├── pages/
│   ├── index.vue            # Document library
│   ├── scan.vue             # Capture interface
│   ├── login.vue            # Authentication
│   ├── register.vue         # User registration
│   └── doc/[id].vue         # Document detail view
│
├── stores/
│   └── documentStore.ts     # Pinia store with sync logic
│
├── services/
│   ├── db.ts                # Dexie database schema
│   ├── supabaseClient.ts    # Backend connection
│   ├── extractFields.ts     # Field extraction utilities
│   ├── exportCsv.ts         # CSV export functionality
│   └── exportPdf.ts         # PDF generation
│
├── public/
│   ├── workers/             # Web Workers for parallel processing
│   │   ├── preprocessWorker.js  # OpenCV pipeline
│   │   ├── ocrWorker.js         # Tesseract OCR
│   │   └── nlpWorker.js         # Transformers NLP
│   ├── models/              # Pre-trained AI models
│   │   └── Xenova/
│   │       ├── bert-base-NER/
│   │       ├── nli-deberta-v3-small/
│   │       └── all-MiniLM-L6-v2/
│   ├── tesseract/           # OCR language data
│   │   └── lang-data/
│   │       ├── eng.traineddata
│   │       ├── hin.traineddata
│   │       └── mar.traineddata
│   └── opencv.js            # Computer vision library
│
├── middleware/
│   └── auth.global.ts       # Route protection
│
├── nuxt.config.ts           # Application configuration
├── tailwind.config.js       # Styling configuration
└── package.json             # Dependencies
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ or Bun runtime
- Modern browser with WebAssembly support
- Camera access (for live capture)

### Installation

```bash
# Clone repository
git clone <repository-url>
cd smart-doc-scanner

# Install dependencies
npm install
# or
pnpm install
# or
bun install
```

### Environment Configuration

Create `.env` file in project root:

```env
NUXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NUXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Development Server

```bash
npm run dev
# Application runs on http://localhost:3000
```

### Production Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

### Static Site Generation

```bash
npm run generate
```

---

## 🔧 Configuration

### PWA Settings (nuxt.config.ts)
```typescript
pwa: {
  registerType: 'autoUpdate',
  manifest: {
    name: 'SmartDoc Scanner',
    short_name: 'SmartScan',
    theme_color: '#000000',
    display: 'standalone',
    orientation: 'portrait'
  }
}
```

### Caching Strategy
- **Network First** for Supabase API calls
- **Cache First** for static assets
- 24-hour cache expiration for API responses

---

## 🎨 User Interface

### Design System
- **Responsive Layout** - Mobile-first design
- **Dark Mode** - System preference detection with manual toggle
- **Accessibility** - WCAG 2.1 compliant
- **Progressive Enhancement** - Graceful degradation for older browsers

### Key Screens
1. **Document Library** - Grid/list view with search & filters
2. **Scanner Interface** - Live camera preview with capture controls
3. **Processing View** - Real-time progress indicators
4. **Document Detail** - Extracted fields with edit capabilities
5. **Authentication** - Secure login/registration

---

## 🔐 Security Features

- **Client-Side Encryption** - Sensitive data never leaves device unencrypted
- **Secure Authentication** - Supabase Auth with JWT tokens
- **Row-Level Security** - Database policies enforce user isolation
- **No PII Exposure** - All processing happens locally
- **HTTPS Enforcement** - Production deployment requires SSL

---

## 🔄 Data Flow Architecture

```
User Input (Camera/File)
    ↓
Image Preprocessing (OpenCV Worker)
    ↓
OCR Recognition (Tesseract Worker)
    ↓
Text Cleaning & Validation
    ↓
NLP Processing (Transformers Worker)
    ├── Named Entity Recognition
    └── Document Classification
    ↓
Field Extraction & Structuring
    ↓
Local Storage (IndexedDB)
    ↓
Background Sync (Supabase)
```

---

## 📦 Database Schema

### IndexedDB (Local)
```typescript
documents: {
  id: number (auto-increment)
  supabaseId: string (cloud reference)
  userId: string
  createdAt: number (timestamp)
  image: string (base64)
  ocrText: string (raw)
  cleanedText: string (processed)
  extracted: {
    vendor, date, total, tax,
    receiptNumber, paymentMethod, items[]
  }
  category: {
    type, nlpLabel, confidence, scores
  }
  synced: boolean
}
```

### Supabase (Cloud)
- User authentication table
- Documents table with RLS policies
- Automatic timestamp triggers
- Foreign key constraints

---
