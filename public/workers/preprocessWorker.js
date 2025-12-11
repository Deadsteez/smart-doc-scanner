// -----------------------------
// OpenCV Worker (Nuxt 4 Compatible)
// -----------------------------

let cvLoaded = false;

console.log("Worker: start");

// Load OpenCV.js once
self.Module = {
  onRuntimeInitialized() {
    console.log("Worker: OpenCV runtime initialized");
    cvLoaded = true;
  }
};

self.importScripts('/opencv.js');
console.log("Worker: importScripts('/opencv.js') returned");

// Wait for OpenCV WASM
async function waitForOpenCV() {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = setInterval(() => {
      if (cvLoaded && typeof cv !== "undefined") {
        clearInterval(check);
        resolve(true);
      }
      if (Date.now() - start > 20000) {
        clearInterval(check);
        reject("OpenCV timeout");
      }
    }, 50);
  });
}

self.onmessage = async (e) => {
  console.log("Worker: onmessage received", e.data);

  const { imageDataURL } = e.data;

  try {
    if (!cvLoaded || typeof cv === "undefined") {
      console.log("Worker: waiting for OpenCV...");
      await waitForOpenCV();
      console.log("Worker: OpenCV is ready");
    }

    const cleaned = await preprocess(imageDataURL);
    if (!cleaned) throw new Error("preprocess returned null");

    self.postMessage({ cleanedImage: cleaned });

  } catch (err) {
    console.error("Worker: preprocess error", err);
    self.postMessage({ error: "preprocess_failed", detail: String(err) });
  }
};

// -----------------------------
// Preprocess Pipeline (Worker-safe)
// -----------------------------
async function preprocess(dataURL) {
  console.log("Worker: preprocess() start");

  // --- 1. Convert DataURL → Blob → ImageBitmap ---
  const res = await fetch(dataURL);
  const blob = await res.blob();
  const bitmap = await createImageBitmap(blob);
  console.log("Worker: bitmap created", bitmap.width, bitmap.height);

  // --- 2. Draw bitmap onto OffscreenCanvas ---
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0);

  // --- 3. Convert canvas → ImageData (Worker-compatible) ---
  const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);

  // --- 4. Convert to cv.Mat safely ---
  let src = cv.matFromImageData(imageData);
  let dst = new cv.Mat();

// --- 5. Run OpenCV operations ---
cv.cvtColor(src, dst, cv.COLOR_RGBA2GRAY);
cv.GaussianBlur(dst, dst, new cv.Size(3, 3), 0);
cv.threshold(dst, dst, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);

// --- 6. Convert grayscale → RGBA and draw ---
const outCanvas = new OffscreenCanvas(bitmap.width, bitmap.height);
const outCtx = outCanvas.getContext("2d");

const gray = dst.data; // 1 channel
const rgba = new Uint8ClampedArray(bitmap.width * bitmap.height * 4);

for (let i = 0, j = 0; i < gray.length; i++, j += 4) {
  const v = gray[i];
  rgba[j] = v;       // R
  rgba[j + 1] = v;   // G
  rgba[j + 2] = v;   // B
  rgba[j + 3] = 255; // A
}

const outImageData = new ImageData(rgba, bitmap.width, bitmap.height);
outCtx.putImageData(outImageData, 0, 0);


  // Memory cleanup
  src.delete();
  dst.delete();

  // --- 7. Convert output canvas → DataURL ---
  const processedBlob = await outCanvas.convertToBlob();
  const reader = new FileReader();

  return new Promise((resolve) => {
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(processedBlob);
  });
}
