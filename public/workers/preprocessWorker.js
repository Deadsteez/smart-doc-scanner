// public/workers/preprocessWorker.js
// Optimized OpenCV preprocessing pipeline for financial document OCR

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

// ─── Full preprocessing pipeline ─────────────────────────────
async function preprocess(dataURL) {
  // 1. Decode image
  const res = await fetch(dataURL)
  const blob = await res.blob()
  const bitmap = await createImageBitmap(blob)

  const origW = bitmap.width
  const origH = bitmap.height
  console.log(`[Preprocess Worker] Input: ${origW}x${origH}`)

  // 2. Scale to optimal size for Tesseract
  // Tesseract accuracy peaks at ~300 DPI equivalent.
  // For typical document scans we target 2400px on the longest side.
  // Too large = slow; too small = inaccurate.
  const TARGET_LONG_SIDE = 2400
  const scale = Math.min(TARGET_LONG_SIDE / Math.max(origW, origH), 2.0)
  const scaledW = Math.round(origW * scale)
  const scaledH = Math.round(origH * scale)

  const canvas = new OffscreenCanvas(scaledW, scaledH)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(bitmap, 0, 0, scaledW, scaledH)

  const imageData = ctx.getImageData(0, 0, scaledW, scaledH)

  // 3. Convert to OpenCV Mat
  let src = cv.matFromImageData(imageData)
  let gray = new cv.Mat()
  let denoised = new cv.Mat()
  let sharpened = new cv.Mat()
  let binary = new cv.Mat()
  let deskewed = new cv.Mat()

  try {
    // 4. Grayscale
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY)

    // 5. Denoise — larger kernel than before for high-res images
    // fastNlMeansDenoising is ideal but not available in WASM build.
    // GaussianBlur 5x5 removes sensor noise without destroying text edges.
    cv.GaussianBlur(gray, denoised, new cv.Size(5, 5), 0)

    // 6. Sharpen — unsharp mask to restore edge crispness lost in blur
    // This dramatically improves character edge definition for OCR.
    const kernel = cv.matFromArray(3, 3, cv.CV_32F, [
       0, -1,  0,
      -1,  5, -1,
       0, -1,  0
    ])
    cv.filter2D(denoised, sharpened, cv.CV_8U, kernel)
    kernel.delete()

    // 7. Adaptive threshold — better than Otsu for uneven lighting
    // (e.g. phone camera with shadow across receipt)
    // ADAPTIVE_THRESH_GAUSSIAN_C uses a weighted mean of the neighbourhood.
    // Block size 31 works well for text at our target resolution.
    // C=10 is the constant subtracted — tune up if text is breaking up.
    cv.adaptiveThreshold(
      sharpened,
      binary,
      255,
      cv.ADAPTIVE_THRESH_GAUSSIAN_C,
      cv.THRESH_BINARY,
      31,
      10
    )

    // 8. Deskew — correct document rotation for better line segmentation
    // Uses minAreaRect on the thresholded image to find the text angle.
    deskewed = deskewImage(binary)

    // 9. Add white border padding around the document
    // Tesseract requires whitespace margin around text to correctly
    // detect line boundaries and avoid clipping edge characters.
    const PADDING = 40
    const padded = new cv.Mat()
    cv.copyMakeBorder(
      deskewed,
      padded,
      PADDING, PADDING, PADDING, PADDING,
      cv.BORDER_CONSTANT,
      new cv.Scalar(255, 255, 255, 255)
    )

    // 10. Convert single-channel binary → RGBA for canvas output
    const finalW = padded.cols
    const finalH = padded.rows
    const outCanvas = new OffscreenCanvas(finalW, finalH)
    const outCtx = outCanvas.getContext('2d')

    const grayData = padded.data
    const rgba = new Uint8ClampedArray(finalW * finalH * 4)
    for (let i = 0, j = 0; i < grayData.length; i++, j += 4) {
      const v = grayData[i]
      rgba[j] = v
      rgba[j + 1] = v
      rgba[j + 2] = v
      rgba[j + 3] = 255
    }

    outCtx.putImageData(new ImageData(rgba, finalW, finalH), 0, 0)
    padded.delete()

    console.log(`[Preprocess Worker] Output: ${finalW}x${finalH}`)

    // 11. Export as PNG (lossless — JPEG artifacts hurt OCR accuracy)
    const processedBlob = await outCanvas.convertToBlob({ type: 'image/png' })
    const reader = new FileReader()
    return new Promise((resolve) => {
      reader.onload = () => resolve(reader.result)
      reader.readAsDataURL(processedBlob)
    })

  } finally {
    // Always clean up OpenCV Mats to prevent memory leaks
    src.delete()
    gray.delete()
    denoised.delete()
    sharpened.delete()
    binary.delete()
    if (deskewed && !deskewed.isDeleted?.()) deskewed.delete()
  }
}

// ─── Deskew ───────────────────────────────────────────────────
// Finds the dominant text angle and rotates the image to correct it.
// Improves Tesseract line segmentation significantly on tilted captures.
function deskewImage(binaryMat) {
  const MAX_SKEW_ANGLE = 15 // ignore rotations beyond 15° (likely wrong crop)

  try {
    // Find all non-zero (text) pixel coordinates
    const points = []
    for (let y = 0; y < binaryMat.rows; y++) {
      for (let x = 0; x < binaryMat.cols; x++) {
        // In a binary image, text pixels are 0 (black), background is 255
        if (binaryMat.ucharAt(y, x) === 0) {
          points.push({ x, y })
        }
      }
    }

    // Need enough text pixels to reliably estimate angle
    if (points.length < 100) {
      console.log('[Preprocess Worker] Not enough points for deskew, skipping')
      return binaryMat.clone()
    }

    // Sample a subset for performance on large images
    const sampled = points.length > 5000
      ? points.filter((_, i) => i % Math.floor(points.length / 5000) === 0)
      : points

    // Convert to cv.Mat of points for minAreaRect
    const pointsMat = cv.matFromArray(sampled.length, 1, cv.CV_32FC2,
      sampled.flatMap(p => [p.x, p.y])
    )

    const rect = cv.minAreaRect(pointsMat)
    pointsMat.delete()

    let angle = rect.angle

    // minAreaRect returns angle in [-90, 0) — normalize to [-45, 45]
    if (angle < -45) angle += 90

    console.log(`[Preprocess Worker] Detected skew angle: ${angle.toFixed(2)}°`)

    // Skip correction for small angles or implausible large ones
    if (Math.abs(angle) < 0.5 || Math.abs(angle) > MAX_SKEW_ANGLE) {
      return binaryMat.clone()
    }

    // Build rotation matrix around image center
    const center = new cv.Point(binaryMat.cols / 2, binaryMat.rows / 2)
    const M = cv.getRotationMatrix2D(center, angle, 1.0)

    const rotated = new cv.Mat()
    cv.warpAffine(
      binaryMat,
      rotated,
      M,
      new cv.Size(binaryMat.cols, binaryMat.rows),
      cv.INTER_LINEAR,
      cv.BORDER_CONSTANT,
      new cv.Scalar(255) // fill with white
    )

    M.delete()
    return rotated

  } catch (err) {
    console.warn('[Preprocess Worker] Deskew failed, using original:', err)
    return binaryMat.clone()
  }
}