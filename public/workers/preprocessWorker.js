// OpenCV preprocessing pipeline for OCR cleanup
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

// Full preprocessing pipeline 
async function preprocess(dataURL) {

  const res = await fetch(dataURL)
  const blob = await res.blob()
  const bitmap = await createImageBitmap(blob)

  const origW = bitmap.width
  const origH = bitmap.height
  console.log(`[Preprocess Worker] Input: ${origW}x${origH}`)

  // Target OCR-friendly resolution without overscaling
  const TARGET_LONG_SIDE = 2400
  const scale = Math.min(TARGET_LONG_SIDE / Math.max(origW, origH), 2.0)
  const scaledW = Math.round(origW * scale)
  const scaledH = Math.round(origH * scale)

  const canvas = new OffscreenCanvas(scaledW, scaledH)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(bitmap, 0, 0, scaledW, scaledH)

  const imageData = ctx.getImageData(0, 0, scaledW, scaledH)

  let src = cv.matFromImageData(imageData)
  let gray = new cv.Mat()
  let denoised = new cv.Mat()
  let sharpened = new cv.Mat()
  let binary = new cv.Mat()
  let deskewed = new cv.Mat()

  try {
    
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY)

    // Mild blur removes sensor noise
    cv.GaussianBlur(gray, denoised, new cv.Size(5, 5), 0)

    const kernel = cv.matFromArray(3, 3, cv.CV_32F, [0, -1,  0,-1,  5, -1,0, -1,  0])
    cv.filter2D(denoised, sharpened, cv.CV_8U, kernel)
    kernel.delete()

    // Adaptive threshold handles uneven lighting
    cv.adaptiveThreshold(
      sharpened,
      binary,
      255,
      cv.ADAPTIVE_THRESH_GAUSSIAN_C,
      cv.THRESH_BINARY,
      31,
      10
    )

    deskewed = deskewImage(binary)

    const PADDING = 40
    const padded = new cv.Mat()
    cv.copyMakeBorder(
      deskewed,
      padded,
      PADDING, PADDING, PADDING, PADDING,
      cv.BORDER_CONSTANT,
      new cv.Scalar(255, 255, 255, 255)
    )

    const finalW = padded.cols
    const finalH = padded.rows
    const outCanvas = new OffscreenCanvas(finalW, finalH)
    const outCtx = outCanvas.getContext('2d')

    const grayData = padded.data
    const rgba = new Uint8ClampedArray(finalW * finalH * 4)
    for (let i = 0, j = 0; i < grayData.length; i++, j += 4) {
      const value = grayData[i]
      rgba[j] = value
      rgba[j + 1] = value
      rgba[j + 2] = value
      rgba[j + 3] = 255
    }

    outCtx.putImageData(new ImageData(rgba, finalW, finalH), 0, 0)
    padded.delete()

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
    if (deskewed && !deskewed.isDeleted?.()) deskewed.delete()
  }
}

// Correct dominant text skew before OCR
function deskewImage(binaryMat) {
  const MAX_SKEW_ANGLE = 15 
  try {
    const points = []
    for (let y = 0; y < binaryMat.rows; y++) {
      for (let x = 0; x < binaryMat.cols; x++) {
        if (binaryMat.ucharAt(y, x) === 0) {
          points.push({ x, y })
        }
      }
    }

    if (points.length < 100) {
      console.log('[Preprocess Worker] Not enough points for deskew, skipping')
      return binaryMat.clone()
    }

    const sampled = points.length > 5000
      ? points.filter((_, i) => i % Math.floor(points.length / 5000) === 0)
      : points

    const pointsMat = cv.matFromArray(sampled.length, 1, cv.CV_32FC2,
      sampled.flatMap(point => [point.x, point.y])
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