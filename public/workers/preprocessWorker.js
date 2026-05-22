// preprocessWorker.js
// OpenCV preprocessing pipeline for OCR — runs inside a dedicated Web Worker.
//
// Changes vs original:
//  • Luminance-aware adaptive threshold: dark-background images are auto-inverted
//    before binarisation so text always comes out black-on-white for Tesseract.
//  • estimateLuminance() helper (ported from UPI SnapPay's useOcr.ts).
//  • Deskew guard is unchanged but uses the same safe clone path.

let cvLoaded = false
console.log('[Preprocess Worker] Starting...')

self.Module = {
  onRuntimeInitialized() {
    console.log('[Preprocess Worker] OpenCV WASM ready')
    cvLoaded = true
  }
}

self.importScripts('/opencv.js')

async function waitForOpenCV() {
  return new Promise((resolve, reject) => {
    if (cvLoaded && typeof cv !== 'undefined') return resolve(true)
    const start = Date.now()
    const check = setInterval(() => {
      if (cvLoaded && typeof cv !== 'undefined') {
        clearInterval(check)
        resolve(true)
      }
      if (Date.now() - start > 20000) {
        clearInterval(check)
        reject(new Error('OpenCV load timeout'))
      }
    }, 50)
  })
}

// ---------------------------------------------------------------------------
// Luminance helper — ported from UPI SnapPay's useOcr.ts
// Samples the top-left 80×80 pixels of an OffscreenCanvas.
// Returns 0–255; values < 128 indicate a dark background.
// ---------------------------------------------------------------------------

function estimateLuminance(canvas) {
  const ctx = canvas.getContext('2d')
  const sw  = Math.min(80, canvas.width)
  const sh  = Math.min(80, canvas.height)
  const data = ctx.getImageData(0, 0, sw, sh).data
  let total = 0
  let count = 0
  for (let i = 0; i < data.length; i += 4) {
    total += (data[i] ?? 0) * 0.299 + (data[i + 1] ?? 0) * 0.587 + (data[i + 2] ?? 0) * 0.114
    count++
  }
  return count ? total / count : 255
}

// ---------------------------------------------------------------------------
// Worker message handler
// ---------------------------------------------------------------------------

self.onmessage = async (e) => {
  const { imageDataURL } = e.data
  if (!imageDataURL) {
    self.postMessage({ error: 'no_image', detail: 'No imageDataURL provided' })
    return
  }

  try {
    if (!cvLoaded || typeof cv === 'undefined') {
      await waitForOpenCV()
    }

    const cleaned = await preprocess(imageDataURL)
    if (!cleaned) throw new Error('preprocess returned null')

    self.postMessage({ cleanedImage: cleaned })
  } catch (err) {
    console.error('[Preprocess Worker] Error:', err)
    self.postMessage({ error: 'preprocess_failed', detail: String(err) })
  }
}

// ---------------------------------------------------------------------------
// Full preprocessing pipeline
// ---------------------------------------------------------------------------

async function preprocess(dataURL) {
  const res    = await fetch(dataURL)
  const blob   = await res.blob()
  const bitmap = await createImageBitmap(blob)

  const origW = bitmap.width
  const origH = bitmap.height
  console.log(`[Preprocess Worker] Input: ${origW}x${origH}`)

  // ── Scale to OCR-friendly resolution without over-enlarging ────────────────
  const TARGET_LONG_SIDE = 2400
  const scale  = Math.max(1.0, Math.min(TARGET_LONG_SIDE / Math.max(origW, origH), 2.0))
  const scaledW = Math.round(origW * scale)
  const scaledH = Math.round(origH * scale)

  const canvas = new OffscreenCanvas(scaledW, scaledH)
  const ctx    = canvas.getContext('2d')
  ctx.drawImage(bitmap, 0, 0, scaledW, scaledH)

  // ── Luminance check BEFORE handing off to OpenCV ───────────────────────────
  // If the document has a dark background (e.g. night-mode screenshot, dark
  // receipt paper) we need to invert so adaptive threshold produces
  // black text on white — which is what Tesseract expects.
  const luminance    = estimateLuminance(canvas)
  const isDarkBg     = luminance < 128
  console.log(`[Preprocess Worker] Luminance: ${luminance.toFixed(1)} isDarkBg:${isDarkBg}`)

  const imageData = ctx.getImageData(0, 0, scaledW, scaledH)

  let src       = cv.matFromImageData(imageData)
  let gray      = new cv.Mat()
  let denoised  = new cv.Mat()
  let sharpened = new cv.Mat()
  let binary    = new cv.Mat()
  let inverted  = new cv.Mat()   // used only when isDarkBg
  let deskewed  = null
  let padded    = null

  try {
    // 1. Convert to grayscale
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY)

    // 2. Mild Gaussian blur to suppress sensor/JPEG noise
    cv.GaussianBlur(gray, denoised, new cv.Size(5, 5), 0)

    // 3. Unsharp-mask sharpening (same 3×3 kernel as original)
    const kernel = cv.matFromArray(3, 3, cv.CV_32F, [0, -1, 0, -1, 5, -1, 0, -1, 0])
    cv.filter2D(denoised, sharpened, cv.CV_8U, kernel)
    kernel.delete()

    // 4. Luminance-aware inversion before thresholding
    //    Dark-background images: invert so text is dark on light background,
    //    then the adaptive threshold will produce the correct black-on-white result.
    let threshInput = sharpened
    if (isDarkBg) {
      cv.bitwise_not(sharpened, inverted)
      threshInput = inverted
    }

    // 5. Adaptive threshold — handles uneven lighting / shadows on the page
    cv.adaptiveThreshold(
      threshInput,
      binary,
      255,
      cv.ADAPTIVE_THRESH_GAUSSIAN_C,
      cv.THRESH_BINARY,
      31,   // block size (must be odd)
      10    // constant subtracted from mean
    )

    // 6. Deskew
    self.postMessage({ type: 'progress', status: 'Deskewing...' })
    deskewed = deskewImage(binary)

    // 7. Padding — white border so Tesseract doesn't clip text at edges
    const PADDING = 40
    padded = new cv.Mat()
    cv.copyMakeBorder(
      deskewed,
      padded,
      PADDING, PADDING, PADDING, PADDING,
      cv.BORDER_CONSTANT,
      new cv.Scalar(255, 255, 255, 255)
    )

    // 8. Convert grayscale Mat back to RGBA ImageData for OffscreenCanvas
    const finalW = padded.cols
    const finalH = padded.rows
    const outCanvas = new OffscreenCanvas(finalW, finalH)
    const outCtx    = outCanvas.getContext('2d')

    const grayData = padded.data
    const rgba     = new Uint8ClampedArray(finalW * finalH * 4)
    for (let i = 0, j = 0; i < grayData.length; i++, j += 4) {
      const v = grayData[i]
      rgba[j] = rgba[j + 1] = rgba[j + 2] = v
      rgba[j + 3] = 255
    }

    outCtx.putImageData(new ImageData(rgba, finalW, finalH), 0, 0)
    console.log(`[Preprocess Worker] Output: ${finalW}x${finalH}`)

    const processedBlob = await outCanvas.convertToBlob({ type: 'image/png' })
    const reader = new FileReader()
    return new Promise((resolve) => {
      reader.onload = () => resolve(reader.result)
      reader.readAsDataURL(processedBlob)
    })

  } finally {
    src.delete()
    gray.delete()
    denoised.delete()
    sharpened.delete()
    binary.delete()
    if (!inverted.isDeleted?.()) inverted.delete()
    if (deskewed && !deskewed.isDeleted?.()) deskewed.delete()
    if (padded  && !padded.isDeleted?.())   padded.delete()
  }
}

// ---------------------------------------------------------------------------
// Deskew — correct dominant text skew before OCR
// Identical logic to original; extracted here for clarity.
// ---------------------------------------------------------------------------

function deskewImage(binaryMat) {
  const MAX_SKEW_ANGLE = 15
  try {
    const points = []
    const data   = binaryMat.data
    const cols   = binaryMat.cols

    for (let i = 0; i < data.length; i++) {
      if (data[i] === 0) {
        points.push({ x: i % cols, y: Math.floor(i / cols) })
      }
    }

    if (points.length < 100) {
      console.log('[Preprocess Worker] Not enough points for deskew, skipping')
      return binaryMat.clone()
    }

    // Sample at most 5000 points for speed
    const sampled = points.length > 5000
      ? points.filter((_, i) => i % Math.floor(points.length / 5000) === 0)
      : points

    const pointsMat = cv.matFromArray(
      sampled.length, 1, cv.CV_32FC2,
      sampled.flatMap(p => [p.x, p.y])
    )

    const rect = cv.minAreaRect(pointsMat)
    pointsMat.delete()

    let angle = rect.angle
    if (angle < -45) angle += 90

    console.log(`[Preprocess Worker] Detected skew angle: ${angle.toFixed(2)}°`)

    if (Math.abs(angle) < 0.5 || Math.abs(angle) > MAX_SKEW_ANGLE) {
      return binaryMat.clone()
    }

    const center = new cv.Point(binaryMat.cols / 2, binaryMat.rows / 2)
    const matrix = cv.getRotationMatrix2D(center, angle, 1.0)

    const rotated = new cv.Mat()
    cv.warpAffine(
      binaryMat,
      rotated,
      matrix,
      new cv.Size(binaryMat.cols, binaryMat.rows),
      cv.INTER_LINEAR,
      cv.BORDER_CONSTANT,
      new cv.Scalar(255)
    )

    matrix.delete()
    return rotated

  } catch (err) {
    console.warn('[Preprocess Worker] Deskew failed, using original:', err)
    return binaryMat.clone()
  }
}