// public/workers/ocrWorker.js

console.log("OCR Worker: start");

importScripts("/tesseract/tesseract.min.js");

onmessage = async (e) => {
  const { image } = e.data;
  console.log("OCR Worker: message received");

  try {
    const result = await Tesseract.recognize(
      image,
      "eng",
      {
        logger: m => {
          if (m.status === "recognizing text" && m.progress !== undefined) {
            postMessage({
              type: "progress",
              progress: m.progress
            });
          }
        }
      }
    );

    postMessage({
      type: "result",
      text: result.data.text
    });

  } catch (err) {
    postMessage({
      type: "error",
      error: String(err)
    });
  }
};
