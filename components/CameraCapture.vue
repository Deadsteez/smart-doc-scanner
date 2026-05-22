<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { cleanOcrText, isValidOcrOutput } from '~/composables/useOcrCleanup'
import { useDocumentStore } from '~/stores/documentStore'
import { extractCvFeatures } from '~/composables/useCvFeatures'
import { usePdfProcessor } from '~/composables/usePdfProcessor'
import PdfUploader from '~/components/scanner/PdfUploader.vue'
import NlpWorker from '~/workers/nlpWorker.js?worker'
import LanguageSelector from '~/components/LanguageSelector.vue'
import { getCategoryLabel } from '~/composables/useDocumentClassifier'
import { getVendorSemantic, EXPENSE_CATEGORY_LABELS } from '~/services/vendorIntelligence'

const videoEl = ref(null)
const fileInputEl = ref(null)
const stream = ref(null)

const capturedImage = ref(null)
const processedImage = ref(null)
const ocrText = ref(null)
const ocrProgress = ref(0)
const ocrConfidence = ref(null)
const selectedLanguage = ref('eng+hin+mar')

// Interactive Preprocessing state variables
const rotation = ref(0)
const brightness = ref(0)
const contrast = ref(1.0)
const cropX = ref(10)
const cropY = ref(10)
const cropW = ref(80)
const cropH = ref(80)
const isEditing = ref(false)
const activeDrag = ref(null)
const cropImageEl = ref(null)

const cameraError = ref(null)
const captureError = ref(null)
const isSaving = ref(false)
const isSaved = ref(false)
const saveError = ref(null)
const nlpStatus = ref(null)
const smartSuggestions = ref([])

const showPdfUploader = ref(false)
const pdfPages = ref([])
const currentPdfPageIndex = ref(0)
const { isPdfFile } = usePdfProcessor()

const nlpReady = ref(false)
const nlpBusy = ref(false)
const nlpQueue = []
const currentNlpJob = ref(null)

const isRegionPassPending = ref(false)

// Multi-page PDF processing state
const isMultiPagePdf = ref(false)
const multiPagePdfPages = ref([])
const multiPageCurrentIndex = ref(0)
const multiPageText = ref([])

let firstPassTextSnapshot = null

let preprocessWorker = null
let ocrWorker = null
let nlpWorker = null
let documentStore = null

onMounted(() => {
  documentStore = useDocumentStore()

  preprocessWorker = new Worker('/workers/preprocessWorker.js')
  preprocessWorker.onmessage = (e) => {
    if (e.data.cleanedImage) {
      processedImage.value = e.data.cleanedImage
      if (isMultiPagePdf.value) {
        runOCR()
      }
    }
  }
  preprocessWorker.onerror = (err) => console.error('Preprocess worker error:', err)

  ocrWorker = new Worker('/workers/ocrWorker.js')
  ocrWorker.onmessage = async (e) => {
    const msg = e.data

    if (msg.type === 'progress') {
      if (isMultiPagePdf.value) {
        const pageWeight = 100 / multiPagePdfPages.value.length
        const baseProgress = multiPageCurrentIndex.value * pageWeight
        ocrProgress.value = Math.min(99, Math.floor(baseProgress + (msg.progress * pageWeight)))
      } else {
        ocrProgress.value = isRegionPassPending.value
          ? Math.min(99, Math.floor(msg.progress * 100))
          : Math.floor(msg.progress * 100)
      }
      return
    }

    if (msg.type === 'error') {
      console.error('OCR error:', msg.error)
      ocrProgress.value = 0
      isRegionPassPending.value = false
      return
    }

    if (msg.type !== 'result') return

    
    if (msg.isRegionPass) {
      isRegionPassPending.value = false
      ocrProgress.value = 100

      
      const regionText = msg.text ?? ''
      const shouldMerge = isRegionPassUseful(regionText, msg.detectedAmount, ocrText.value ?? '')

      if (!shouldMerge) {
        console.warn(
          '[CameraCapture] Region pass output was worse than pass 1 — discarding, keeping pass-1 text.'
        )
        isRegionPassPending.value = false
       
        await saveDocument(ocrText.value ?? '',true)
        return
      }

    
      const combined = mergeOcrResults(
        firstPassTextSnapshot ?? ocrText.value ?? '',
        regionText,
        msg.detectedAmount
      )
      ocrText.value = combined

      await saveDocument(combined,true)
      return
    }

    if (isMultiPagePdf.value) {
      multiPageText.value.push(msg.text)
      multiPageCurrentIndex.value++
      
      if (multiPageCurrentIndex.value < multiPagePdfPages.value.length) {
        const nextPageImage = multiPagePdfPages.value[multiPageCurrentIndex.value].image
        processImage(nextPageImage, true)
      } else {
        isMultiPagePdf.value = false
        const combinedText = multiPageText.value.join('\n\n--- Page Break ---\n\n')
        ocrText.value = combinedText
        firstPassTextSnapshot = combinedText
        ocrProgress.value = 100
        
        // Restore first page image for saving
        processedImage.value = multiPagePdfPages.value[0].image
        capturedImage.value = multiPagePdfPages.value[0].image
        
        await saveDocument(combinedText)
      }
      return
    }

    ocrText.value = msg.text
   
    firstPassTextSnapshot = msg.text
    ocrConfidence.value = msg.confidence ? Math.round(msg.confidence) : null
    ocrProgress.value = 100
    await saveDocument(msg.text)
  }

  ocrWorker.onerror = (err) => {
    console.error('OCR worker error:', err)
    ocrProgress.value = 0
    isRegionPassPending.value = false
  }

  nlpWorker = new NlpWorker()

  nlpWorker.onmessage = async (e) => {
    const msg = e.data

    if (msg.type === 'progress') {
      nlpStatus.value = msg.status
      if (msg.stage === 'ready') {
        nlpReady.value = true
        console.log('[CameraCapture] NLP ready, draining queue:', nlpQueue.length)
        while (nlpQueue.length > 0) {
          const job = nlpQueue.shift()
          nlpWorker.postMessage(job)
        }
      }
      return
    }

    if (msg.type === 'error') {
      console.error('[NLP] Error:', msg.error)
      nlpStatus.value = null
      nlpBusy.value = false
      const job = currentNlpJob.value
      if (job) {
        await saveDocumentFallback(job.text, job.cvFeatures)
        currentNlpJob.value = null
      }
      processNextNlpJob()
      return
    }

    if (msg.type === 'result') {
      nlpStatus.value = null
      nlpBusy.value   = false
      const job = currentNlpJob.value

      if (job) {
        const docType = msg.category?.type ?? 'other'

      
        if (
          processedImage.value &&
          docType !== 'other' &&
          !job.isRefinement &&
          !isRegionPassPending.value &&
          pdfPages.value.length <= 1 // disable region pass for multi-page PDFs
        ) {
          fireRegionPass(processedImage.value, docType)
        }

        await saveDocumentWithNlp(job.text, msg.extracted, msg.category, job.isRefinement)
        currentNlpJob.value = null
      }

      processNextNlpJob()
    }
  }

  nlpWorker.onerror = (err) => {
    console.error('NLP worker error:', err)
    nlpStatus.value = null
    nlpBusy.value = false
    currentNlpJob.value = null
    processNextNlpJob()
  }

  startCamera()
})

onBeforeUnmount(() => {
  stopCamera()
  preprocessWorker?.terminate()
  ocrWorker?.terminate()
  nlpWorker?.terminate()
})


async function startCamera() {
  cameraError.value = null
  try {
    stream.value = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
    })
    videoEl.value.srcObject = stream.value
    await videoEl.value.play()
  } catch (err) {
    cameraError.value = err.name === 'NotAllowedError'
      ? 'Camera permission denied. Please allow camera access and refresh.'
      : 'Could not start camera: ' + err.message
  }
}

function stopCamera() {
  stream.value?.getTracks().forEach(t => t.stop())
}

function captureFrame() {
  captureError.value = null

  if (!videoEl.value) {
    captureError.value = 'Video not ready.'
    return
  }

  if (!stream.value?.active) {
    captureError.value = 'Camera stream not active. Please wait and try again.'
    return
  }

  const width  = videoEl.value.videoWidth  || videoEl.value.clientWidth
  const height = videoEl.value.videoHeight || videoEl.value.clientHeight

  if (!width || !height) {
    captureError.value = 'Camera not ready yet — please wait a moment and try again.'
    return
  }

  const canvas = document.createElement('canvas')
  canvas.width  = width
  canvas.height = height
  canvas.getContext('2d').drawImage(videoEl.value, 0, 0, width, height)
  processImage(canvas.toDataURL('image/jpeg', 0.92))
}


function triggerFileInput() {
  fileInputEl.value?.click()
}

function handleFileUpload(event) {
  const file = event?.target?.files?.[0]
  if (!file) return

  if (isPdfFile(file)) {
    showPdfUploader.value = true
    return
  }

  const reader = new FileReader()
  reader.onload = (e) => processImage(e.target.result)
  reader.readAsDataURL(file)
  event.target.value = ''
}

function handlePdfPagesSelected(pages) {
  pdfPages.value = pages
  currentPdfPageIndex.value = 0
  showPdfUploader.value = false
  
  if (pages.length === 0) return

  if (pages.length === 1) {
    isMultiPagePdf.value = false
    processImage(pages[0].image, true)
  } else {
    isMultiPagePdf.value = true
    multiPagePdfPages.value = pages
    multiPageCurrentIndex.value = 0
    multiPageText.value = []
    
    // Start processing first page
    processImage(pages[0].image, true)
  }
}

function handlePdfCancel() {
  showPdfUploader.value = false
  pdfPages.value = []
  currentPdfPageIndex.value = 0
}

function processPreviousPdfPage() {
  if (currentPdfPageIndex.value > 0) {
    currentPdfPageIndex.value--
    processImage(pdfPages.value[currentPdfPageIndex.value].image)
  }
}

function processNextPdfPage() {
  if (currentPdfPageIndex.value < pdfPages.value.length - 1) {
    currentPdfPageIndex.value++
    processImage(pdfPages.value[currentPdfPageIndex.value].image)
  }
}


function processImage(dataUrl, skipEdit = false) {
  capturedImage.value        = dataUrl
  processedImage.value       = null
  ocrText.value              = null
  firstPassTextSnapshot      = null   
  ocrProgress.value          = 0
  isRegionPassPending.value  = false
  isSaved.value              = false
  saveError.value            = null
  captureError.value         = null

  if (skipEdit) {
    isEditing.value = false
    preprocessWorker.postMessage({ imageDataURL: dataUrl })
  } else {
    // Reset adjustments for a new capture/upload
    brightness.value = 0
    contrast.value = 1.0
    rotation.value = 0
    cropX.value = 10
    cropY.value = 10
    cropW.value = 80
    cropH.value = 80
    isEditing.value = true
  }
}

// Drag & Drop Crop box logic
let startX = 0
let startY = 0
let startCropX = 0
let startCropY = 0
let startCropW = 0
let startCropH = 0

function onCropImageLoad() {
  // Triggers measurement when needed
}

function startDrag(event, handle) {
  event.preventDefault()
  activeDrag.value = handle
  
  const clientX = event.touches ? event.touches[0].clientX : event.clientX
  const clientY = event.touches ? event.touches[0].clientY : event.clientY
  
  startX = clientX
  startY = clientY
  
  startCropX = cropX.value
  startCropY = cropY.value
  startCropW = cropW.value
  startCropH = cropH.value
  
  window.addEventListener('mousemove', onDrag)
  window.addEventListener('touchmove', onDrag, { passive: false })
  window.addEventListener('mouseup', endDrag)
  window.addEventListener('touchend', endDrag)
}

function onDrag(event) {
  if (!activeDrag.value || !cropImageEl.value) return
  event.preventDefault()
  
  const clientX = event.touches ? event.touches[0].clientX : event.clientX
  const clientY = event.touches ? event.touches[0].clientY : event.clientY
  
  const deltaX = clientX - startX
  const deltaY = clientY - startY
  
  const imgW = cropImageEl.value.clientWidth
  const imgH = cropImageEl.value.clientHeight
  if (!imgW || !imgH) return
  
  const pctDeltaX = (deltaX / imgW) * 100
  const pctDeltaY = (deltaY / imgH) * 100
  
  if (activeDrag.value === 'move') {
    let newX = startCropX + pctDeltaX
    let newY = startCropY + pctDeltaY
    
    if (newX < 0) newX = 0
    if (newY < 0) newY = 0
    if (newX + startCropW > 100) newX = 100 - startCropW
    if (newY + startCropH > 100) newY = 100 - startCropH
    
    cropX.value = Math.round(newX)
    cropY.value = Math.round(newY)
  } else {
    let newX = startCropX
    let newY = startCropY
    let newW = startCropW
    let newH = startCropH
    
    const minSize = 10
    
    if (activeDrag.value.includes('left')) {
      const maxX = startCropX + startCropW - minSize
      let targetX = startCropX + pctDeltaX
      targetX = Math.max(0, Math.min(targetX, maxX))
      newW = startCropX + startCropW - targetX
      newX = targetX
    } else if (activeDrag.value.includes('right')) {
      let targetW = startCropW + pctDeltaX
      targetW = Math.max(minSize, Math.min(targetW, 100 - startCropX))
      newW = targetW
    }
    
    if (activeDrag.value.includes('top')) {
      const maxY = startCropY + startCropH - minSize
      let targetY = startCropY + pctDeltaY
      targetY = Math.max(0, Math.min(targetY, maxY))
      newH = startCropY + startCropH - targetY
      newY = targetY
    } else if (activeDrag.value.includes('bottom')) {
      let targetH = startCropH + pctDeltaY
      targetH = Math.max(minSize, Math.min(targetH, 100 - startCropY))
      newH = targetH
    }
    
    cropX.value = Math.round(newX)
    cropY.value = Math.round(newY)
    cropW.value = Math.round(newW)
    cropH.value = Math.round(newH)
  }
}

function endDrag() {
  activeDrag.value = null
  window.removeEventListener('mousemove', onDrag)
  window.removeEventListener('touchmove', onDrag)
  window.removeEventListener('mouseup', endDrag)
  window.removeEventListener('touchend', endDrag)
}

function rotateCapturedImage(clockwise = true) {
  if (!capturedImage.value) return
  
  const img = new Image()
  img.onload = () => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    
    canvas.width = img.height
    canvas.height = img.width
    
    ctx.translate(canvas.width / 2, canvas.height / 2)
    ctx.rotate((clockwise ? 90 : -90) * Math.PI / 180)
    ctx.drawImage(img, -img.width / 2, -img.height / 2)
    
    capturedImage.value = canvas.toDataURL('image/jpeg', 0.95)
    
    // Reset crop bounds on rotate
    cropX.value = 10
    cropY.value = 10
    cropW.value = 80
    cropH.value = 80
  }
  img.src = capturedImage.value
}

function resetAdjustments() {
  brightness.value = 0
  contrast.value = 1.0
  cropX.value = 10
  cropY.value = 10
  cropW.value = 80
  cropH.value = 80
}

function applyAdjustments() {
  if (!capturedImage.value) return
  
  isSaving.value = true
  saveError.value = null
  
  const img = new Image()
  img.onload = () => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    
    const srcX = (cropX.value / 100) * img.width
    const srcY = (cropY.value / 100) * img.height
    const srcW = (cropW.value / 100) * img.width
    const srcH = (cropH.value / 100) * img.height
    
    canvas.width = srcW
    canvas.height = srcH
    
    ctx.filter = `brightness(${100 + brightness.value}%) contrast(${contrast.value})`
    
    ctx.drawImage(
      img,
      srcX, srcY, srcW, srcH,
      0, 0, srcW, srcH
    )
    
    const finalDataUrl = canvas.toDataURL('image/jpeg', 0.95)
    
    isEditing.value = false
    isSaving.value = false
    
    processImage(finalDataUrl, true)
  }
  img.onerror = (err) => {
    console.error('Error applying adjustments:', err)
    saveError.value = 'Failed to process image adjustments'
    isSaving.value = false
  }
  img.src = capturedImage.value
}

function runOCR() {
  if (!processedImage.value) return
  ocrText.value             = null
  firstPassTextSnapshot     = null   
  ocrProgress.value         = 0
  ocrConfidence.value       = null
  isRegionPassPending.value = false
  isSaved.value             = false
  saveError.value           = null
  ocrWorker.postMessage({
    image:    processedImage.value,
    language: selectedLanguage.value,
    mode:     'full',
  })
}

function fireRegionPass(imageDataUrl, docType) {
  console.log(`[CameraCapture] Firing region pass for docType: ${docType}`)
  isRegionPassPending.value = true
  isSaved.value = false
  ocrWorker.postMessage({
    image:    imageDataUrl,
    language: selectedLanguage.value,
    mode:     'region',
    docType,
  })
}

function isRegionPassUseful(regionText, detectedAmount, firstPassText) {
 
  if (detectedAmount != null) return true

  const rStripped = (regionText ?? '').replace(/\s/g, '')
  const fStripped = (firstPassText ?? '').replace(/\s/g, '')

 
  if (rStripped.length < 10) return false

  
  if (fStripped.length > 0 && rStripped.length / fStripped.length < 0.30) return false

  const regionLines = new Set(
    (regionText ?? '').split('\n').map(l => l.trim().toLowerCase()).filter(Boolean)
  )
  const firstLines = new Set(
    (firstPassText ?? '').split('\n').map(l => l.trim().toLowerCase()).filter(Boolean)
  )

  
  const newLines = [...regionLines].filter(l => !firstLines.has(l)).length
  const retainedRatio = firstLines.size > 0
    ? [...regionLines].filter(l => firstLines.has(l)).length / firstLines.size
    : 1

  if (newLines === 0 && retainedRatio < 0.60) return false

  return true
}

function mergeOcrResults(firstPass, regionPass, detectedAmount) {
 
  const lines = new Map()

  for (const line of (firstPass ?? '').split('\n')) {
    const t = line.trim()
    if (t) lines.set(t.toLowerCase(), t)   
  }

  for (const line of (regionPass ?? '').split('\n')) {
    const t = line.trim()
    if (t) lines.set(t.toLowerCase(), t)  
  }

  const amountPrefix = detectedAmount != null
    ? `Amount ₹${detectedAmount}\n`
    : ''

  return amountPrefix + [...lines.values()].join('\n')
}

function enqueueNlpJob(text, cvFeatures, image, isRefinement = false) {
  const job = { text, cvFeatures, image, isRefinement }

  if (!nlpReady.value) {
    console.log('[CameraCapture] NLP not ready yet, queuing job')
    nlpQueue.push(job)
    return
  }

  if (nlpBusy.value) {
    console.log('[CameraCapture] NLP busy, queuing job. Queue length:', nlpQueue.length)
    nlpQueue.push(job)
    return
  }

  dispatchNlpJob(job)
}

function dispatchNlpJob(job) {
  nlpBusy.value = true
  currentNlpJob.value = job
  nlpWorker.postMessage({
    text:       job.text,
    cvFeatures: job.cvFeatures,
    image:      job.image,
  })
}

function processNextNlpJob() {
  if (nlpQueue.length === 0) return
  dispatchNlpJob(nlpQueue.shift())
}

async function saveDocument(rawText, isRefinement = false) {
  if (!isValidOcrOutput(rawText)) {
    console.warn('OCR output too noisy, skipping save')
    return
  }
  if (!processedImage.value) return

  isSaving.value  = true
  saveError.value = null
  nlpStatus.value = nlpReady.value ? 'Extracting fields...' : 'Loading NLP models...'

  try {
    const cleanedText = cleanOcrText(rawText)
    const cvFeatures  = await extractCvFeatures(processedImage.value)
    enqueueNlpJob(cleanedText, cvFeatures, processedImage.value, isRefinement)
  } catch (err) {
    console.error('Pipeline error:', err)
    saveError.value = 'Processing failed: ' + err.message
    isSaving.value  = false
    nlpStatus.value = null
  }
}

async function saveDocumentWithNlp(cleanedText, extracted, category, isRefinement = false) {
  try {
    if (isRefinement && documentStore.lastId) {
      await documentStore.update(documentStore.lastId, {
        ocrText:     ocrText.value,
        cleanedText,
        extracted,
        category,
        synced:      false,
      })
    } else {
      const id = await documentStore.add({
        createdAt:   Date.now(),
        image:       processedImage.value,
        ocrText:     ocrText.value,
        cleanedText,
        extracted,
        category,
        synced:      false,
      })
      documentStore.lastId = id
      generateSmartSuggestions(extracted, category, cleanedText)
    }
    isSaved.value = true
  } catch (err) {
    saveError.value = 'Failed to save: ' + err.message
  } finally {
    isSaving.value  = false
    nlpStatus.value = null
  }
}

async function saveDocumentFallback(cleanedText, cvFeatures) {
  console.warn('[CameraCapture] NLP failed, using regex fallback')
  try {
    const { extractFields }    = await import('~/services/extractFields')
    const { classifyDocument } = await import('~/composables/useDocumentClassifier')
    const category  = classifyDocument(cleanedText, cvFeatures)
    const extracted = extractFields(cleanedText, category.type)

    await documentStore.add({
      createdAt:   Date.now(),
      image:       processedImage.value,
      ocrText:     ocrText.value,
      cleanedText,
      extracted,
      category,
      synced:      false,
    })
    documentStore.lastId = id
    generateSmartSuggestions(extracted, category, cleanedText)
    isSaved.value = true
  } catch (err) {
    saveError.value = 'Failed to save: ' + err.message
  } finally {
    isSaving.value  = false
    nlpStatus.value = null
  }
}

function generateSmartSuggestions(extracted, category, text) {
  const suggestions = []
  
  if (category?.type && category.type !== 'other') {
    suggestions.push(`Categorized as: ${getCategoryLabel(category.type)}`)
  }

  if (extracted?.vendor) {
    const semantic = getVendorSemantic(extracted.vendor, text)
    if (semantic) {
      suggestions.push(`Detected ${semantic} vendor`)
    }

    const pastCount = documentStore.documents.filter(d => 
      (d.extracted?.vendor || '').toLowerCase() === extracted.vendor.toLowerCase()
    ).length

    if (pastCount > 1) {
      suggestions.push(`Recurring vendor: you have ${pastCount} documents from ${extracted.vendor}`)
    }
  }

  smartSuggestions.value = suggestions
}

function clearImages() {
  capturedImage.value       = null
  processedImage.value      = null
  ocrText.value             = null
  firstPassTextSnapshot     = null
  ocrProgress.value         = 0
  ocrConfidence.value       = null
  isRegionPassPending.value = false
  isSaved.value             = false
  saveError.value           = null
  captureError.value        = null
  smartSuggestions.value    = []
  pdfPages.value            = []
  currentPdfPageIndex.value = 0
  showPdfUploader.value     = false
}

const showCamera = ref(true)

async function toggleCamera() {
  if (stream.value?.active) {
    stopCamera()
    stream.value  = null
    showCamera.value = false
  } else {
    showCamera.value = true
    await startCamera()
  }
}
</script>

<template>
  <div class="w-full p-6 max-w-4xl space-y-5">

    <div class="mb-2">
      <p class="text-text-muted text-sm">Capture or upload a document to extract and classify data.</p>
    </div>

    <div class="bg-bg-secondary border-slate-1/50 rounded-xl overflow-hidden shadow-card">
      <div class="flex items-center justify-between px-4 pt-4 pb-2">
        <p class="text-sm font-medium text-text-secondary">Camera</p>
        <button @click="toggleCamera" class="text-xs px-3 py-1.5 rounded-lg transition-colors" :class="showCamera
          ? 'border-error/40 text-error hover:border-error/70'
          : 'border-success/40 text-success hover:border-success/70'">
          {{ showCamera ? '⏹ Turn Off Camera' : '▶ Turn On Camera' }}
        </button>
      </div>

      <div v-if="cameraError"
        class="m-4 p-3 bg-error/10 border-error/30 rounded-lg text-sm text-error flex items-center gap-2">
        <svg class="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
            clip-rule="evenodd" />
        </svg>
        {{ cameraError }}
      </div>

      <div v-show="showCamera" class="relative bg-bg-primary">
        <video ref="videoEl" class="w-full max-h-[360px] object-cover block" autoplay playsinline muted />
        <div
          class="absolute top-3 left-3 flex items-center gap-1.5 bg-bg-primary/60 backdrop-blur-sm px-2.5 py-1 rounded-full">
          <span class="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
          <span class="text-white text-xs font-medium">LIVE</span>
        </div>
      </div>

      <div v-if="captureError" class="mx-4 mt-4 p-3 bg-warning/10 border-warning/30 rounded-lg text-sm text-warning">
        {{ captureError }}
      </div>

      <div class="p-4 flex gap-3">
        <button @click="captureFrame"
          class="flex-1 bg-accent-primary hover:bg-sky-500 active:scale-95 text-white font-semibold px-5 py-3 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-glow-cyan hover:-translate-y-0.5 hover:shadow-[0_0_25px_rgba(14,165,233,0.4)]">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Capture Photo
        </button>
        <button @click="triggerFileInput"
          class="flex-1 bg-bg-tertiary hover:bg-bg-elevated active:scale-95 text-text-secondary font-semibold px-5 py-3 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 border-slate-1/50 shadow-card hover:-translate-y-0.5 hover:shadow-card-hover">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Upload Photo
        </button>
        <input ref="fileInputEl" type="file" accept="image/*,.pdf,application/pdf" class="hidden"
          @change="handleFileUpload" />
      </div>
    </div>

    <div v-if="showPdfUploader"
      class="fixed inset-0 bg-bg-primary/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div
        class="bg-bg-secondary border-slate-1/50 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-elevated">
        <PdfUploader @pages-selected="handlePdfPagesSelected" @cancel="handlePdfCancel" />
      </div>
    </div>

    <div v-if="pdfPages.length > 1" class="bg-bg-secondary border-slate-1/50 rounded-xl p-4 shadow-card">
      <div class="flex items-center justify-between mb-3">
        <p class="text-text-secondary text-sm font-medium">PDF Page Navigation</p>
        <span class="text-xs text-text-muted">Page {{ currentPdfPageIndex + 1 }} of {{ pdfPages.length }}</span>
      </div>
      <div class="flex gap-3">
        <button @click="processPreviousPdfPage" :disabled="currentPdfPageIndex === 0"
          class="flex-1 bg-bg-tertiary hover:bg-bg-elevated disabled:bg-bg-tertiary disabled:text-text-muted/50 text-text-secondary px-4 py-2 rounded-xl transition flex items-center justify-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
          Previous Page
        </button>
        <button @click="processNextPdfPage" :disabled="currentPdfPageIndex === pdfPages.length - 1"
          class="flex-1 bg-bg-tertiary hover:bg-bg-elevated disabled:bg-bg-tertiary disabled:text-text-muted/50 text-text-secondary px-4 py-2 rounded-xl transition flex items-center justify-center gap-2">
          Next Page
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Progress banner — shown during both first pass and region pass -->
    <div v-if="isSaving || isRegionPassPending"
      class="p-4 bg-accent-primary/10 border-accent-primary/30 rounded-xl text-sm text-accent-primary flex items-center gap-3">
      <div class="w-4 h-4 border-2 border-accent-primary border-t-transparent rounded-full animate-spin flex-shrink-0">
      </div>
      {{ isRegionPassPending
        ? 'Refining extraction with layout analysis…'
        : (nlpStatus ?? 'Saving document and syncing to cloud…') }}
    </div>

    <div v-if="capturedImage" class="bg-bg-secondary border border-slate-700/50 rounded-2xl p-5 shadow-card space-y-5">
      <div class="flex justify-between items-center">
        <div class="flex items-center gap-2">
          <span class="text-lg">🎨</span>
          <p class="text-text-primary font-semibold text-sm">
            {{ isEditing ? 'Edit & Crop Document' : 'Original Snapshot' }}
          </p>
        </div>
        <button class="text-error hover:text-red-400 transition-colors text-sm font-medium flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-error/10" title="Clear image"
          @click="clearImages">
          <span>🗑️</span> Clear
        </button>
      </div>

      <!-- Editing / Adjustments Active Workspace -->
      <div v-if="isEditing" class="space-y-5">
        <!-- Interactive Crop Area -->
        <div class="relative bg-bg-primary rounded-xl overflow-hidden p-2 flex items-center justify-center min-h-[260px] border border-slate-800/80 shadow-inner">
          <div class="relative max-w-full select-none overflow-hidden touch-none" style="width: fit-content;">
            <img
              ref="cropImageEl"
              :src="capturedImage"
              :style="{
                filter: `brightness(${100 + brightness}%) contrast(${contrast})`,
                maxHeight: '360px',
                display: 'block'
              }"
              class="rounded-lg shadow-md max-w-full select-none pointer-events-none"
              @load="onCropImageLoad"
            />

            <!-- Rectangular Crop Overlay Box -->
            <div
              class="absolute border-2 border-dashed border-accent-primary bg-accent-primary/10 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] cursor-move select-none"
              :style="{
                left: `${cropX}%`,
                top: `${cropY}%`,
                width: `${cropW}%`,
                height: `${cropH}%`
              }"
              @mousedown="startDrag($event, 'move')"
              @touchstart="startDrag($event, 'move')"
            >
              <!-- Drag Handles -->
              <div
                class="absolute w-5 h-5 bg-accent-primary border-[3px] border-white rounded-full -top-2.5 -left-2.5 cursor-nwse-resize shadow-md active:scale-125 transition-transform duration-100 flex items-center justify-center"
                @mousedown.stop="startDrag($event, 'top-left')"
                @touchstart.stop="startDrag($event, 'top-left')"
              >
                <div class="w-1.5 h-1.5 bg-white rounded-full"></div>
              </div>
              <div
                class="absolute w-5 h-5 bg-accent-primary border-[3px] border-white rounded-full -top-2.5 -right-2.5 cursor-nesw-resize shadow-md active:scale-125 transition-transform duration-100 flex items-center justify-center"
                @mousedown.stop="startDrag($event, 'top-right')"
                @touchstart.stop="startDrag($event, 'top-right')"
              >
                <div class="w-1.5 h-1.5 bg-white rounded-full"></div>
              </div>
              <div
                class="absolute w-5 h-5 bg-accent-primary border-[3px] border-white rounded-full -bottom-2.5 -left-2.5 cursor-nesw-resize shadow-md active:scale-125 transition-transform duration-100 flex items-center justify-center"
                @mousedown.stop="startDrag($event, 'bottom-left')"
                @touchstart.stop="startDrag($event, 'bottom-left')"
              >
                <div class="w-1.5 h-1.5 bg-white rounded-full"></div>
              </div>
              <div
                class="absolute w-5 h-5 bg-accent-primary border-[3px] border-white rounded-full -bottom-2.5 -right-2.5 cursor-nwse-resize shadow-md active:scale-125 transition-transform duration-100 flex items-center justify-center"
                @mousedown.stop="startDrag($event, 'bottom-right')"
                @touchstart.stop="startDrag($event, 'bottom-right')"
              >
                <div class="w-1.5 h-1.5 bg-white rounded-full"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Preprocessing Control Sliders and Rotator -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 bg-bg-tertiary/50 p-4 rounded-xl border border-slate-700/30">
          
          <!-- Slider Box -->
          <div class="space-y-4">
            <div class="space-y-1.5">
              <div class="flex justify-between text-xs font-semibold text-text-secondary">
                <span>💡 BRIGHTNESS</span>
                <span class="text-accent-primary">{{ brightness > 0 ? `+${brightness}` : brightness }}%</span>
              </div>
              <input
                type="range"
                v-model.number="brightness"
                min="-60"
                max="60"
                step="1"
                class="w-full h-1.5 bg-bg-primary rounded-lg appearance-none cursor-pointer accent-accent-primary border border-slate-700/50"
              />
            </div>
            
            <div class="space-y-1.5">
              <div class="flex justify-between text-xs font-semibold text-text-secondary">
                <span>🌗 CONTRAST</span>
                <span class="text-accent-primary">{{ Math.round(contrast * 100) }}%</span>
              </div>
              <input
                type="range"
                v-model.number="contrast"
                min="0.5"
                max="2.0"
                step="0.05"
                class="w-full h-1.5 bg-bg-primary rounded-lg appearance-none cursor-pointer accent-accent-primary border border-slate-700/50"
              />
            </div>
          </div>

          <!-- Rotation and Reset -->
          <div class="flex flex-col justify-center space-y-4">
            <div class="space-y-1.5">
              <span class="text-xs font-semibold text-text-secondary block">🔄 ROTATION (90° STEPS)</span>
              <div class="flex gap-2">
                <button
                  type="button"
                  @click="rotateCapturedImage(false)"
                  class="flex-1 bg-bg-primary border border-slate-700/50 hover:bg-bg-elevated text-text-secondary px-3.5 py-2 rounded-lg transition-all active:scale-95 text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  ↩️ Rotate Left
                </button>
                <button
                  type="button"
                  @click="rotateCapturedImage(true)"
                  class="flex-1 bg-bg-primary border border-slate-700/50 hover:bg-bg-elevated text-text-secondary px-3.5 py-2 rounded-lg transition-all active:scale-95 text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  ↪️ Rotate Right
                </button>
              </div>
            </div>

            <div class="flex gap-2 pt-1.5">
              <button
                type="button"
                @click="resetAdjustments"
                class="w-full bg-error/10 hover:bg-error/20 text-error border border-error/20 px-3.5 py-2 rounded-lg transition-all active:scale-95 text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                🧹 Reset Edits
              </button>
            </div>
          </div>

        </div>

        <!-- Action Buttons -->
        <div class="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            type="button"
            @click="applyAdjustments"
            class="flex-1 bg-accent-secondary hover:bg-teal-500 active:scale-95 text-white font-semibold px-5 py-3 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-glow-teal hover:-translate-y-0.5 hover:shadow-[0_0_20px_rgba(20,184,166,0.3)]"
          >
            ✅ Apply & Enhance
          </button>
          <button
            type="button"
            @click="processImage(capturedImage, true)"
            class="flex-1 bg-bg-tertiary hover:bg-bg-elevated active:scale-95 text-text-secondary font-semibold px-5 py-3 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 border border-slate-700 hover:-translate-y-0.5"
          >
            ⚡ Skip & Auto-Enhance
          </button>
        </div>
      </div>

      <!-- Passive Preview -->
      <div v-else class="space-y-4">
        <img
          :src="capturedImage"
          class="rounded-xl shadow-md max-h-[300px] mx-auto block border border-slate-800"
        />
        <div class="flex justify-center">
          <button
            type="button"
            @click="isEditing = true"
            class="bg-bg-tertiary border border-slate-700/80 hover:bg-bg-elevated text-text-secondary px-4 py-2 rounded-lg transition-all active:scale-95 text-xs font-semibold flex items-center gap-1.5"
          >
            ✏️ Adjust Image & Re-crop
          </button>
        </div>
      </div>
    </div>

    <div v-if="processedImage" class="bg-bg-secondary border-slate-1/50 rounded-xl p-4 shadow-card">
      <LanguageSelector v-model="selectedLanguage" />
    </div>

    <div v-if="processedImage" class="bg-bg-secondary border-slate-1/50 rounded-xl p-4 shadow-card">
      <p class="text-text-secondary text-sm font-medium mb-3">Preprocessed</p>
      <img :src="processedImage" class="rounded-lg shadow max-h-[300px] mx-auto block mb-4" />
      <button
        class="w-full bg-accent-secondary hover:bg-teal-500 active:scale-95 text-white font-semibold px-4 py-3 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-glow-teal hover:-translate-y-0.5 hover:shadow-[0_0_25px_rgba(20,184,166,0.4)]"
        @click="runOCR">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Run OCR
      </button>
    </div>

    <div v-if="ocrProgress > 0 && ocrProgress < 100 && !ocrText"
      class="bg-bg-secondary border-slate-1/50 rounded-xl p-4 shadow-card">
      <div class="flex items-center gap-3 mb-3">
        <div
          class="w-4 h-4 border-[3px] border-accent-primary border-t-transparent rounded-full animate-spin flex-shrink-0">
        </div>
        <span class="text-sm text-text-secondary">
          {{ isRegionPassPending ? 'Refining text with layout analysis…' : 'Extracting text from document…' }}
        </span>
      </div>
      <div class="w-full bg-bg-tertiary rounded-full h-2 overflow-hidden">
        <div class="h-full bg-accent-primary transition-all duration-300" :style="{ width: `${ocrProgress}%` }"></div>
      </div>
      <p class="text-xs text-text-muted mt-2 text-right">{{ ocrProgress }}%</p>
    </div>

    <div v-if="ocrText" class="bg-bg-secondary border-slate-1/50 rounded-xl p-4 shadow-card">
      <div class="flex items-center justify-between mb-3">
        <p class="font-semibold text-text-primary">OCR Output</p>
        <div class="flex items-center gap-2">
          <span v-if="ocrConfidence !== null" class="text-xs px-2.5 py-1 rounded-full border" :class="ocrConfidence >= 80 ? 'bg-success/15 text-success border-success/30'
            : ocrConfidence >= 60 ? 'bg-warning/15 text-warning border-warning/30'
              : 'bg-error/15 text-error border-error/30'">
            {{ ocrConfidence }}% confidence
          </span>
          <span class="text-xs px-2.5 py-1 bg-success/15 text-success rounded-full border-success/30">
            Complete
          </span>
        </div>
      </div>
      <pre
        class="text-sm whitespace-pre-wrap text-text-secondary font-mono leading-relaxed max-h-96 overflow-y-auto bg-bg-primary border-slate-1/30 p-4 rounded-lg">{{ ocrText }}</pre>
    </div>

    <div v-if="saveError" class="p-4 bg-error/10 border-error/30 rounded-xl text-sm text-error">{{ saveError }}</div>

    <div v-if="isSaved"
      class="p-4 bg-success/10 border-success/30 rounded-xl text-sm text-success flex items-center gap-3">
      <svg class="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
          clip-rule="evenodd" />
      </svg>
      <div>
        <p class="font-medium">Document saved!</p>
        <p class="text-xs opacity-75 mt-0.5">Saved locally and syncing to cloud in background.</p>
      </div>
      <NuxtLink to="/dashboard" class="ml-auto text-success hover:underline font-semibold text-sm whitespace-nowrap">
        View Dashboard →
      </NuxtLink>
    </div>

    <!-- Smart Suggestions -->
    <div v-if="isSaved && smartSuggestions.length > 0" class="space-y-2 mt-4">
      <div v-for="(suggestion, i) in smartSuggestions" :key="i"
        class="bg-bg-secondary border border-accent-primary/20 p-3 rounded-xl flex items-center gap-2.5 shadow-card animate-fade-in"
        :style="{ animationDelay: `${i * 100}ms` }">
        <span class="text-accent-primary text-base">💡</span>
        <span class="text-text-secondary text-sm font-medium">{{ suggestion }}</span>
      </div>
    </div>

    <div v-if="documentStore?.syncing"
      class="text-xs text-text-muted text-center flex items-center justify-center gap-1.5">
      <div class="w-3 h-3 border border-text-muted border-t-transparent rounded-full animate-spin"></div>
      Syncing to Supabase…
    </div>

    <div v-if="documentStore?.syncError" class="text-xs text-error text-center">
      Sync failed: {{ documentStore.syncError }} — saved locally, will retry on next load.
    </div>

  </div>
</template>