<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { cleanOcrText, isValidOcrOutput } from '~/composables/useOcrCleanup'
import { extractCvFeatures } from '~/composables/useCvFeatures'
import NlpWorkerClass from '~/workers/nlpWorker.js?worker'


interface GroundTruth {
  company?: string
  date?: string
  total?: string
  address?: string
}

interface SampleResult {
  id: string
  groundTruth: GroundTruth
  predicted?: { vendor?: string; date?: string; total?: string }
  predictedCategory?: string
  ocrConfidence?: number
  ocrText?: string
  vendorMatch?: boolean
  dateMatch?: boolean
  totalMatch?: boolean
  categoryMatch?: boolean
  allMatch?: boolean
  error?: string
}

interface Summary {
  avgOcrConfidence: number
  vendorP: number; vendorR: number; vendorF1: number
  dateP:   number; dateR:   number; dateF1:   number
  totalP:  number; totalR:  number; totalF1:  number
  macroF1: number
  categoryAccuracy: number
}

const phase = ref<'setup' | 'running' | 'done'>('setup')

const imageFiles      = ref<File[]>([])
const entityFiles     = ref<File[]>([])
const maxSamples      = ref(50)
const fuzzyThreshold  = ref(80)
const skipPreprocess  = ref(false)
const setupError      = ref('')

const samples         = ref<{ id: string; imageFile: File; gt: GroundTruth }[]>([])
const results         = ref<SampleResult[]>([])
const currentIdx      = ref(0)
const currentStage    = ref('')
const stagesDone      = ref<string[]>([])
const overallProgress = ref(0)
const activeFilter    = ref<'all' | 'pass' | 'fail' | 'error'>('all')

const stages = [
  { key: 'preprocess', label: 'Preprocess', icon: '⚙️' },
  { key: 'ocr',        label: 'OCR',        icon: '🔍' },
  { key: 'nlp',        label: 'NLP',        icon: '🧠' },
  { key: 'score',      label: 'Score',      icon: '✅' },
]


let preprocessWorker: Worker | null = null
let ocrWorker:        Worker | null = null
let nlpWorker:        Worker | null = null
let nlpReady = false
let nlpInitPromise: Promise<void> | null = null

function spawnWorkers() {
  preprocessWorker = new Worker('/workers/preprocessWorker.js')
  ocrWorker        = new Worker('/workers/ocrWorker.js')
  nlpWorker        = new NlpWorkerClass()
  nlpInitPromise = new Promise<void>((resolve, reject) => {
    const readyHandler = (e: MessageEvent) => {
      if (e.data.type === 'progress' && e.data.stage === 'ready') {
        nlpReady = true
        nlpWorker!.removeEventListener('message', readyHandler)
        resolve()
      }
      if (e.data.type === 'error' && !nlpReady) {
        nlpWorker!.removeEventListener('message', readyHandler)
        reject(new Error(e.data.error))
      }
    }
    nlpWorker!.addEventListener('message', readyHandler)
    nlpWorker!.onerror = (err) => reject(err)
  })
}

function terminateWorkers() {
  preprocessWorker?.terminate(); preprocessWorker = null
  ocrWorker?.terminate();        ocrWorker = null
  nlpWorker?.terminate();        nlpWorker = null
  nlpReady = false
  nlpInitPromise = null
}

onBeforeUnmount(terminateWorkers)
function onImages(e: Event)   { imageFiles.value  = Array.from((e.target as HTMLInputElement).files ?? []) }
function onEntities(e: Event) { entityFiles.value = Array.from((e.target as HTMLInputElement).files ?? []) }

const matchedCount = computed(() => {
  if (!imageFiles.value.length || !entityFiles.value.length) return 0
  const gtIds = new Set(entityFiles.value.map(f => f.name.replace(/\.txt$/, '')))
  return imageFiles.value.filter(f => gtIds.has(f.name.replace(/\.(jpg|jpeg)$/i, ''))).length
})

const canStart      = computed(() => matchedCount.value > 0 && maxSamples.value >= 1)
const currentSample = computed(() => samples.value[currentIdx.value] ?? null)
async function parseGroundTruth(file: File): Promise<GroundTruth> {
  const text = (await file.text()).trim()
  const gt: GroundTruth = {}

  if (text.startsWith('{')) {
    try {
      const data = JSON.parse(text) as Record<string, string>
      if (data.company) gt.company = String(data.company).trim()
      if (data.date)    gt.date    = String(data.date).trim()
      if (data.total)   gt.total   = String(data.total).trim()
      if (data.address) gt.address = String(data.address).trim()
      return gt
    } catch {
      
    }
  }

  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const [key, ...rest] = trimmed.split(',')
    const val = rest.join(',').trim()
    if (!val) continue
    const k = key?.trim().toLowerCase()
    if (k === 'company') gt.company = val
    if (k === 'date')    gt.date    = val
    if (k === 'total')   gt.total   = val
    if (k === 'address') gt.address = val
  }
  return gt
}

function normalise(s?: string): string {
  return (s ?? '').toLowerCase().replace(/[^a-z0-9.]/g, '').trim()
}

function fuzzyMatch(a?: string, b?: string): boolean {
  const na = normalise(a)
  const nb = normalise(b)
  if (!na || !nb) return false
  if (na === nb || na.includes(nb) || nb.includes(na)) return true
  const longer  = na.length > nb.length ? na : nb
  const shorter = na.length > nb.length ? nb : na
  let matches = 0
  for (const ch of shorter) if (longer.includes(ch)) matches++
  return (matches / longer.length) * 100 >= fuzzyThreshold.value
}

function runPreprocess(imageDataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const w = preprocessWorker!
    const handler = (e: MessageEvent) => {
      if (e.data.cleanedImage) { w.removeEventListener('message', handler); resolve(e.data.cleanedImage) }
      else if (e.data.error)   { w.removeEventListener('message', handler); reject(new Error(e.data.detail ?? e.data.error)) }
    }
    w.addEventListener('message', handler)
    w.postMessage({ imageDataURL: imageDataUrl })
  })
}

function runOCR(imageDataUrl: string): Promise<{ text: string; confidence: number }> {
  return new Promise((resolve, reject) => {
    const w = ocrWorker!
    const handler = (e: MessageEvent) => {
      const msg = e.data
      if (msg.type === 'result') { w.removeEventListener('message', handler); resolve({ text: msg.text ?? '', confidence: msg.confidence ?? 0 }) }
      if (msg.type === 'error')  { w.removeEventListener('message', handler); reject(new Error(msg.error)) }
    }
    w.addEventListener('message', handler)
    w.postMessage({ image: imageDataUrl, language: 'eng' })
  })
}

function runNLP(text: string, cvFeatures: any): Promise<{ extracted: any; category: any }> {
  return new Promise((resolve, reject) => {
    const w = nlpWorker!
    const handler = (e: MessageEvent) => {
      const msg = e.data
      if (msg.type === 'result') { w.removeEventListener('message', handler); resolve({ extracted: msg.extracted, category: msg.category }) }
      if (msg.type === 'error')  { w.removeEventListener('message', handler); reject(new Error(msg.error)) }
    }
    w.addEventListener('message', handler)
    w.postMessage({ text, cvFeatures })
  })
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('FileReader failed'))
    reader.readAsDataURL(file)
  })
}

async function startEval() {
  setupError.value    = ''
  results.value       = []
  stagesDone.value    = []
  currentIdx.value    = 0
  overallProgress.value = 0

  const gtMap = new Map<string, File>()
  for (const f of entityFiles.value) gtMap.set(f.name.replace(/\.txt$/, ''), f)

  const matched = imageFiles.value
    .map(f => ({ img: f, id: f.name.replace(/\.(jpg|jpeg)$/i, '') }))
    .filter(({ id }) => gtMap.has(id))
    .slice(0, maxSamples.value)

  if (!matched.length) {
    setupError.value = 'No matched image/entity pairs found. Make sure filenames match.'
    return
  }

  const parsedSamples: typeof samples.value = []
  for (const { img, id } of matched) {
    const gt = await parseGroundTruth(gtMap.get(id)!)
    parsedSamples.push({ id, imageFile: img, gt })
  }
  samples.value = parsedSamples
  phase.value   = 'running'
  spawnWorkers()

 for (let i = 0; i < parsedSamples.length; i++) {
    currentIdx.value = i
    stagesDone.value = []
    const sample = parsedSamples[i]
    if (!sample) continue
    const result: SampleResult = { id: sample.id, groundTruth: sample.gt }

   
    let rawObjectUrl: string | null = null
    let rawDataUrl:   string | null = null

    try {
   
      rawObjectUrl = URL.createObjectURL(sample.imageFile)
      rawDataUrl   = await fileToDataUrl(sample.imageFile)

      let imageForOcr = rawDataUrl
      if (!skipPreprocess.value) {
        currentStage.value = 'preprocess'
        try { imageForOcr = await runPreprocess(rawDataUrl) } catch { /* fall back to raw */ }
      }
      stagesDone.value = skipPreprocess.value ? [] : ['preprocess']

     
      rawDataUrl = null

      currentStage.value = 'ocr'
      const { text: rawText, confidence } = await runOCR(imageForOcr)
      result.ocrConfidence = confidence
      result.ocrText       = rawText
      stagesDone.value = [...stagesDone.value, 'ocr']

      imageForOcr = ''

      currentStage.value = 'nlp'
      const cleanedText = isValidOcrOutput(rawText) ? cleanOcrText(rawText) : rawText

      const cvFeatures = await extractCvFeatures(rawObjectUrl).catch(() => null)

      await nlpInitPromise
      const { extracted, category } = await runNLP(cleanedText, cvFeatures)
      stagesDone.value = [...stagesDone.value, 'nlp']

      currentStage.value       = 'score'
      result.predicted         = { vendor: extracted?.vendor, date: extracted?.date, total: extracted?.total }
      result.predictedCategory = category?.type ?? 'other'
      result.vendorMatch       = fuzzyMatch(extracted?.vendor, sample.gt.company)
      result.dateMatch         = fuzzyMatch(extracted?.date,   sample.gt.date)
      result.totalMatch        = fuzzyMatch(extracted?.total,  sample.gt.total)
      result.categoryMatch     = result.predictedCategory === 'receipt'
      result.allMatch          = result.vendorMatch && result.dateMatch && result.totalMatch
      stagesDone.value = [...stagesDone.value, 'score']

    } catch (err: any) {
      result.error = err?.message ?? String(err)
    } finally {
      
      if (rawObjectUrl) URL.revokeObjectURL(rawObjectUrl)
      rawDataUrl   = null
    }

   
    delete result.ocrText

    results.value.push(result)
    overallProgress.value = Math.round(((i + 1) / samples.value.length) * 100)

    await new Promise(r => setTimeout(r, 50))
  }

  terminateWorkers()
  phase.value = 'done'
  publishEvalExport()
}

function publishEvalExport() {
  if (typeof window === 'undefined') return
  ;(window as Window & { __SROIE_EVAL_EXPORT__?: object }).__SROIE_EVAL_EXPORT__ = {
    summary: { ...summary.value },
    results: results.value.map((r) => ({ ...r })),
  }
}

watch(phase, (p) => {
  if (p === 'done') publishEvalExport()
})

const summary = computed<Summary>(() => {
  const valid = results.value.filter(r => !r.error)
  const n = valid.length || 1
  const avgOcrConfidence = valid.reduce((s, r) => s + (r.ocrConfidence ?? 0), 0) / n

  
  function prf(
    matchKey: 'vendorMatch' | 'dateMatch' | 'totalMatch',
    gtKey: 'company' | 'date' | 'total'
  ) {
    const tp = valid.filter(r =>  r[matchKey]).length
   
    const fp = valid.filter(r => !r[matchKey] && !!r.groundTruth[gtKey] && !!r.predicted?.[matchKey === 'vendorMatch' ? 'vendor' : matchKey === 'dateMatch' ? 'date' : 'total']).length
    
    const fn = valid.filter(r => !r[matchKey] && !!r.groundTruth[gtKey]).length - fp
    const p  = tp + fp > 0 ? tp / (tp + fp) : 0
    const r  = tp + fn > 0 ? tp / (tp + fn) : 0
    return { p, r, f1: p + r > 0 ? 2 * p * r / (p + r) : 0 }
  }

  const vendor = prf('vendorMatch', 'company')
  const date   = prf('dateMatch',   'date')
  const total  = prf('totalMatch',  'total')

  return {
    avgOcrConfidence,
    vendorP: vendor.p, vendorR: vendor.r, vendorF1: vendor.f1,
    dateP:   date.p,   dateR:   date.r,   dateF1:   date.f1,
    totalP:  total.p,  totalR:  total.r,  totalF1:  total.f1,
    macroF1: (vendor.f1 + date.f1 + total.f1) / 3,
    categoryAccuracy: valid.filter(r => r.categoryMatch).length / n,
  }
})

const liveMetrics = computed(() => {
  const valid = results.value.filter(r => !r.error)
  const n = valid.length || 1
  return [
    { label: 'Processed',    val: results.value.length },
    { label: 'Errors',       val: results.value.filter(r => r.error).length },
    { label: 'Vendor Acc',   val: (valid.filter(r => r.vendorMatch).length / n * 100).toFixed(0) + '%' },
    { label: 'Date Acc',     val: (valid.filter(r => r.dateMatch).length   / n * 100).toFixed(0) + '%' },
    { label: 'Total Acc',    val: (valid.filter(r => r.totalMatch).length  / n * 100).toFixed(0) + '%' },
    { label: 'Avg OCR',      val: (valid.reduce((s, r) => s + (r.ocrConfidence ?? 0), 0) / n).toFixed(0) + '%' },
  ]
})

const tableFilters = computed<{ key: typeof activeFilter.value; label: string; count: number }[]>(() => [
  { key: 'all',   label: 'All',    count: results.value.length },
  { key: 'pass',  label: 'Pass',   count: results.value.filter(r => !r.error && r.allMatch).length },
  { key: 'fail',  label: 'Fail',   count: results.value.filter(r => !r.error && !r.allMatch).length },
  { key: 'error', label: 'Errors', count: results.value.filter(r => r.error).length },
])

const filteredResults = computed(() => {
  if (activeFilter.value === 'pass')  return results.value.filter(r => !r.error && r.allMatch)
  if (activeFilter.value === 'fail')  return results.value.filter(r => !r.error && !r.allMatch)
  if (activeFilter.value === 'error') return results.value.filter(r => r.error)
  return results.value
})

function downloadJSON() {
  const blob = new Blob(
    [JSON.stringify({ summary: summary.value, results: results.value }, null, 2)],
    { type: 'application/json' }
  )
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `eval-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
<div class="eval-root">

  <header class="eval-header">
    <div class="header-inner">
      <div class="title-block">
        <span class="label-tag">MODEL EVALUATION</span>
        <h1>Pipeline Accuracy <em>Dashboard</em></h1>
        <p class="subtitle">End-to-end test using SROIE 2019 ground truth — real workers, real pipeline</p>
      </div>
      <div class="pipeline-bar">
        <span>Image</span><span class="arr">→</span>
        <span>Preprocess</span><span class="arr">→</span>
        <span>OCR</span><span class="arr">→</span>
        <span>NLP</span><span class="arr">→</span>
        <span class="active-step">Eval</span>
      </div>
    </div>
  </header>

  <main class="eval-main">

    
    <section v-if="phase === 'setup'" class="setup-section">
      <div class="setup-grid">

        <div class="setup-card">
          <div class="card-num">01</div>
          <h3>Drop SROIE Images</h3>
          <p>Select all <code>.jpg</code> files from <code>archive/SROIE2019/test/img/</code></p>
          <label class="file-btn">
            <input type="file" multiple accept=".jpg,.jpeg" @change="onImages" />
            Choose Images
          </label>
          <div v-if="imageFiles.length" class="file-count">{{ imageFiles.length }} images loaded</div>
        </div>

        <div class="setup-card">
          <div class="card-num">02</div>
          <h3>Drop Entities Folder</h3>
          <p>Select all <code>.txt</code> files from <code>archive/SROIE2019/test/entities/</code> (JSON ground truth)</p>
          <label class="file-btn">
            <input type="file" multiple accept=".txt" @change="onEntities" />
            Choose Entities
          </label>
          <div v-if="entityFiles.length" class="file-count">{{ entityFiles.length }} ground truth files loaded</div>
        </div>

        <div class="setup-card">
          <div class="card-num">03</div>
          <h3>Configure</h3>
          <div class="config-row">
            <label>Max samples</label>
            <input type="number" v-model.number="maxSamples" min="1" max="500" />
          </div>
          <div class="config-row">
            <label>Fuzzy threshold</label>
            <input type="number" v-model.number="fuzzyThreshold" min="50" max="100" />
            <span class="hint">{{ fuzzyThreshold }}% match required</span>
          </div>
          <div class="config-row">
            <label>Skip preprocess</label>
            <input type="checkbox" v-model="skipPreprocess" />
            <span class="hint">faster, tests OCR+NLP only</span>
          </div>
        </div>

      </div>

      <div class="start-row">
        <div v-if="setupError" class="setup-error">{{ setupError }}</div>
        <button class="start-btn" :disabled="!canStart" @click="startEval">
          Run Evaluation →
        </button>
        <div class="match-info" v-if="matchedCount > 0">
          {{ matchedCount }} matched pairs ready
        </div>
      </div>
    </section>

    <section v-if="phase === 'running'" class="running-section">
      <div class="run-header">
        <div class="run-title">
          <span class="pulse-dot"></span>
          Evaluating {{ currentIdx + 1 }} / {{ samples.length }}
        </div>
        <div class="current-file">{{ currentSample?.id }}</div>
      </div>

      <div class="progress-track">
        <div class="progress-fill" :style="{ width: overallProgress + '%' }"></div>
      </div>

      <div class="stage-row">
        <div v-for="stage in stages" :key="stage.key" class="stage-pill"
          :class="{ active: currentStage === stage.key, done: stagesDone.includes(stage.key) }">
          <span class="stage-icon">{{ stage.icon }}</span>{{ stage.label }}
        </div>
      </div>

      <div class="live-metrics" v-if="results.length > 0">
        <div class="live-card" v-for="m in liveMetrics" :key="m.label">
          <div class="live-val">{{ m.val }}</div>
          <div class="live-label">{{ m.label }}</div>
        </div>
      </div>

      <div class="sample-log">
        <div v-for="r in results.slice(-8)" :key="r.id" class="log-row" :class="{ error: r.error }">
          <span class="log-id">{{ r.id }}</span>
          <span v-if="r.error" class="log-err">{{ r.error }}</span>
          <template v-else>
            <span class="log-field" :class="r.vendorMatch ? 'ok' : 'fail'">vendor {{ r.vendorMatch ? '✓' : '✗' }}</span>
            <span class="log-field" :class="r.dateMatch   ? 'ok' : 'fail'">date {{ r.dateMatch   ? '✓' : '✗' }}</span>
            <span class="log-field" :class="r.totalMatch  ? 'ok' : 'fail'">total {{ r.totalMatch  ? '✓' : '✗' }}</span>
            <span class="log-field">OCR {{ (r.ocrConfidence ?? 0).toFixed(0) }}%</span>
          </template>
        </div>
      </div>
    </section>

    <!-- ── RESULTS ── -->
    <section v-if="phase === 'done'" class="results-section">

      <div class="results-header">
        <h2>Evaluation Complete</h2>
        <div class="results-meta">{{ results.length }} samples · SROIE 2019 test set</div>
        <div class="btn-row">
          <button class="outline-btn" @click="downloadJSON">Export JSON</button>
          <button class="outline-btn" @click="phase = 'setup'">Run Again</button>
        </div>
      </div>

      <div class="score-grid">
        <div class="score-card highlight">
          <div class="score-label">OCR Confidence</div>
          <div class="score-val">{{ summary.avgOcrConfidence.toFixed(1) }}<span>%</span></div>
          <div class="score-sub">avg Tesseract confidence</div>
        </div>
        <div class="score-card">
          <div class="score-label">Vendor F1</div>
          <div class="score-val">{{ (summary.vendorF1 * 100).toFixed(1) }}<span>%</span></div>
          <div class="score-sub">P={{ (summary.vendorP*100).toFixed(0) }}% R={{ (summary.vendorR*100).toFixed(0) }}%</div>
        </div>
        <div class="score-card">
          <div class="score-label">Date F1</div>
          <div class="score-val">{{ (summary.dateF1 * 100).toFixed(1) }}<span>%</span></div>
          <div class="score-sub">P={{ (summary.dateP*100).toFixed(0) }}% R={{ (summary.dateR*100).toFixed(0) }}%</div>
        </div>
        <div class="score-card">
          <div class="score-label">Total F1</div>
          <div class="score-val">{{ (summary.totalF1 * 100).toFixed(1) }}<span>%</span></div>
          <div class="score-sub">P={{ (summary.totalP*100).toFixed(0) }}% R={{ (summary.totalR*100).toFixed(0) }}%</div>
        </div>
        <div class="score-card highlight">
          <div class="score-label">Macro F1</div>
          <div class="score-val">{{ (summary.macroF1 * 100).toFixed(1) }}<span>%</span></div>
          <div class="score-sub">avg across all fields</div>
        </div>
        <div class="score-card">
          <div class="score-label">Category Acc.</div>
          <div class="score-val">{{ (summary.categoryAccuracy * 100).toFixed(1) }}<span>%</span></div>
          <div class="score-sub">receipt classification</div>
        </div>
      </div>

      <div class="note-box">
        <strong>Note:</strong> SROIE receipts are flat scans. Real-world camera captures will score lower
        due to skew, lighting variation, and blur — which your preprocessing pipeline compensates for.
        These numbers represent an upper bound on clean-input accuracy.
      </div>

      <div class="table-wrap">
        <div class="table-filters">
          <button v-for="f in tableFilters" :key="f.key" class="filter-btn"
            :class="{ active: activeFilter === f.key }" @click="activeFilter = f.key">
            {{ f.label }} ({{ f.count }})
          </button>
        </div>
        <table class="results-table">
          <thead>
            <tr>
              <th>ID</th><th>Vendor</th><th>GT Vendor</th>
              <th>Date</th><th>GT Date</th>
              <th>Total</th><th>GT Total</th>
              <th>Category</th><th>OCR %</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in filteredResults" :key="r.id"
              :class="{ 'row-error': r.error, 'row-partial': !r.error && !r.allMatch }">
              <td class="id-cell">{{ r.id }}</td>
              <template v-if="r.error">
                <td colspan="8" class="error-cell">{{ r.error }}</td>
              </template>
              <template v-else>
                <td :class="r.vendorMatch ? 'ok' : 'fail'">{{ r.predicted?.vendor || '—' }}</td>
                <td class="gt">{{ r.groundTruth?.company || '—' }}</td>
                <td :class="r.dateMatch   ? 'ok' : 'fail'">{{ r.predicted?.date   || '—' }}</td>
                <td class="gt">{{ r.groundTruth?.date    || '—' }}</td>
                <td :class="r.totalMatch  ? 'ok' : 'fail'">{{ r.predicted?.total  || '—' }}</td>
                <td class="gt">{{ r.groundTruth?.total   || '—' }}</td>
                <td :class="r.categoryMatch ? 'ok' : 'fail'">{{ r.predictedCategory || '—' }}</td>
                <td>{{ (r.ocrConfidence ?? 0).toFixed(0) }}%</td>
              </template>
            </tr>
          </tbody>
        </table>
      </div>

    </section>
  </main>
</div>
</template>

<style scoped>
.eval-root {
  --bg:      #0a0c10;
  --surface: #111318;
  --border:  #1e2230;
  --accent:  #4f8ef7;
  --accent2: #7c5cfc;
  --ok:      #22c55e;
  --fail:    #ef4444;
  --warn:    #f59e0b;
  --text:    #e2e8f0;
  --muted:   #64748b;
  --mono:    'JetBrains Mono', 'Fira Code', monospace;
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
  font-family: 'Inter', system-ui, sans-serif;
}


.eval-header { background: linear-gradient(135deg, #0d1117 0%, #111827 100%); border-bottom: 1px solid var(--border); padding: 2rem 2.5rem 1.5rem; }
.header-inner { max-width: 1200px; margin: 0 auto; display: flex; align-items: flex-end; justify-content: space-between; gap: 2rem; flex-wrap: wrap; }
.label-tag { font-size: 0.65rem; font-weight: 700; letter-spacing: 0.15em; color: var(--accent); text-transform: uppercase; display: block; margin-bottom: 0.5rem; }
.title-block h1 { font-size: 1.8rem; font-weight: 800; margin: 0 0 0.4rem; line-height: 1.2; }
.title-block h1 em { font-style: normal; color: var(--accent); }
.subtitle { color: var(--muted); font-size: 0.85rem; margin: 0; }
.pipeline-bar { display: flex; align-items: center; gap: 0.4rem; font-size: 0.78rem; color: var(--muted); flex-shrink: 0; }
.pipeline-bar .arr { color: var(--border); }
.pipeline-bar .active-step { color: var(--accent); font-weight: 700; }


.eval-main { max-width: 1200px; margin: 0 auto; padding: 2rem 2.5rem; }


.setup-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.25rem; margin-bottom: 2rem; }
.setup-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1.5rem; position: relative; }
.card-num { font-family: var(--mono); font-size: 2.5rem; font-weight: 900; color: var(--border); position: absolute; top: 1rem; right: 1.25rem; line-height: 1; }
.setup-card h3 { font-size: 1rem; font-weight: 700; margin: 0 0 0.5rem; }
.setup-card p { color: var(--muted); font-size: 0.83rem; margin: 0 0 1.25rem; line-height: 1.5; }
.setup-card code { font-family: var(--mono); font-size: 0.78rem; background: #1a1f2e; padding: 0.1em 0.35em; border-radius: 4px; color: #93c5fd; }
.file-btn { display: inline-block; background: var(--accent); color: #fff; font-size: 0.82rem; font-weight: 600; padding: 0.5rem 1.1rem; border-radius: 8px; cursor: pointer; transition: opacity 0.15s; }
.file-btn:hover { opacity: 0.85; }
.file-btn input { display: none; }
.file-count { margin-top: 0.75rem; font-size: 0.8rem; color: var(--ok); font-family: var(--mono); }
.config-row { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem; font-size: 0.83rem; }
.config-row label { color: var(--muted); min-width: 110px; }
.config-row input[type="number"] { width: 70px; background: #1a1f2e; border: 1px solid var(--border); border-radius: 6px; color: var(--text); padding: 0.3rem 0.5rem; font-size: 0.83rem; }
.config-row input[type="checkbox"] { width: 16px; height: 16px; accent-color: var(--accent); }
.hint { color: var(--muted); font-size: 0.75rem; }
.start-row { display: flex; align-items: center; gap: 1.25rem; flex-wrap: wrap; }
.start-btn { background: linear-gradient(135deg, var(--accent), var(--accent2)); color: #fff; font-size: 0.95rem; font-weight: 700; padding: 0.75rem 2rem; border: none; border-radius: 10px; cursor: pointer; transition: opacity 0.15s, transform 0.15s; }
.start-btn:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
.start-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.match-info { font-size: 0.82rem; color: var(--ok); font-family: var(--mono); }
.setup-error { font-size: 0.83rem; color: var(--fail); background: #1f0a0a; border: 1px solid #3f1010; padding: 0.5rem 0.85rem; border-radius: 8px; }


.running-section { display: flex; flex-direction: column; gap: 1.5rem; }
.run-header { display: flex; align-items: center; justify-content: space-between; }
.run-title { display: flex; align-items: center; gap: 0.6rem; font-size: 1rem; font-weight: 700; }
.pulse-dot { width: 10px; height: 10px; background: var(--ok); border-radius: 50%; animation: pulse 1.2s ease-in-out infinite; flex-shrink: 0; }
@keyframes pulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.75); } }
.current-file { font-family: var(--mono); font-size: 0.78rem; color: var(--muted); }
.progress-track { height: 6px; background: var(--border); border-radius: 99px; overflow: hidden; }
.progress-fill { height: 100%; background: linear-gradient(90deg, var(--accent), var(--accent2)); border-radius: 99px; transition: width 0.4s ease; }
.stage-row { display: flex; gap: 0.6rem; flex-wrap: wrap; }
.stage-pill { display: flex; align-items: center; gap: 0.4rem; font-size: 0.78rem; padding: 0.3rem 0.8rem; border-radius: 99px; border: 1px solid var(--border); color: var(--muted); transition: all 0.2s; }
.stage-pill.active { border-color: var(--accent); color: var(--accent); background: rgba(79,142,247,0.08); }
.stage-pill.done   { border-color: var(--ok);    color: var(--ok);    background: rgba(34,197,94,0.06); }
.live-metrics { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 0.75rem; }
.live-card { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 0.85rem 1rem; text-align: center; }
.live-val { font-family: var(--mono); font-size: 1.3rem; font-weight: 700; color: var(--accent); }
.live-label { font-size: 0.7rem; color: var(--muted); margin-top: 0.2rem; text-transform: uppercase; letter-spacing: 0.05em; }
.sample-log { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
.log-row { display: flex; align-items: center; gap: 0.75rem; padding: 0.55rem 1rem; border-bottom: 1px solid var(--border); font-size: 0.78rem; font-family: var(--mono); flex-wrap: wrap; }
.log-row:last-child { border-bottom: none; }
.log-row.error { background: rgba(239,68,68,0.05); }
.log-id { color: var(--muted); min-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.log-field { padding: 0.15rem 0.45rem; border-radius: 5px; font-size: 0.72rem; }
.log-field.ok   { background: rgba(34,197,94,0.12);  color: var(--ok); }
.log-field.fail { background: rgba(239,68,68,0.12); color: var(--fail); }
.log-err { color: var(--fail); font-size: 0.75rem; }


.results-section { display: flex; flex-direction: column; gap: 1.75rem; }
.results-header { display: flex; align-items: center; gap: 1.5rem; flex-wrap: wrap; }
.results-header h2 { font-size: 1.4rem; font-weight: 800; margin: 0; }
.results-meta { color: var(--muted); font-size: 0.83rem; }
.btn-row { display: flex; gap: 0.75rem; margin-left: auto; }
.outline-btn { background: transparent; border: 1px solid var(--border); color: var(--text); font-size: 0.82rem; font-weight: 600; padding: 0.5rem 1.1rem; border-radius: 8px; cursor: pointer; transition: border-color 0.15s, background 0.15s; }
.outline-btn:hover { border-color: var(--accent); background: rgba(79,142,247,0.06); }
.score-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 1rem; }
.score-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1.25rem 1.5rem; }
.score-card.highlight { border-color: rgba(79,142,247,0.4); background: linear-gradient(135deg, #111827, #0f1729); }
.score-label { font-size: 0.72rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 0.4rem; }
.score-val { font-family: var(--mono); font-size: 2rem; font-weight: 800; color: var(--text); line-height: 1; }
.score-val span { font-size: 1rem; color: var(--muted); }
.score-sub { font-size: 0.72rem; color: var(--muted); margin-top: 0.3rem; font-family: var(--mono); }
.note-box { background: rgba(245,158,11,0.06); border: 1px solid rgba(245,158,11,0.2); border-radius: 10px; padding: 1rem 1.25rem; font-size: 0.83rem; color: #d97706; line-height: 1.6; }
.note-box strong { color: var(--warn); }


.table-wrap { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
.table-filters { display: flex; gap: 0.5rem; padding: 1rem 1rem 0; }
.filter-btn { font-size: 0.78rem; padding: 0.3rem 0.75rem; border-radius: 6px; border: 1px solid var(--border); background: transparent; color: var(--muted); cursor: pointer; transition: all 0.15s; }
.filter-btn.active { border-color: var(--accent); color: var(--accent); background: rgba(79,142,247,0.08); }
.results-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
.results-table th { text-align: left; padding: 0.7rem 0.9rem; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.07em; color: var(--muted); border-bottom: 1px solid var(--border); white-space: nowrap; }
.results-table td { padding: 0.55rem 0.9rem; border-bottom: 1px solid var(--border); vertical-align: middle; }
.results-table tbody tr:last-child td { border-bottom: none; }
.results-table tbody tr:hover { background: rgba(255,255,255,0.02); }
.id-cell { font-family: var(--mono); font-size: 0.72rem; color: var(--muted); white-space: nowrap; }
.gt   { color: var(--muted); }
.ok   { color: var(--ok); }
.fail { color: var(--fail); }
.row-error td   { background: rgba(239,68,68,0.04); }
.row-partial td { background: rgba(245,158,11,0.03); }
.error-cell { color: var(--fail); font-size: 0.78rem; font-family: var(--mono); }
</style>