export interface CvFeatures {
  width: number
  height: number
  aspectRatio: number
  isPortrait: boolean
  isLandScape: boolean
  isLikelyDocument: boolean
}

export async function extractCvFeatures(imageDataUrl: string, timeoutMS: number = 5000): Promise<CvFeatures> {
  if (!imageDataUrl?.startsWith('data:image/')) {
    throw new Error('Invalid image data URL format')
  }

  return new Promise((resolve, reject) => {
    const img = new Image()

    const timeout = setTimeout(() => {
      reject(new Error("Image load timeout"));
    }, timeoutMS);

    img.onload = () => {
      clearTimeout(timeout);

      const { naturalWidth: width, naturalHeight: height } = img

      if (!width || !height) {
        reject(new Error("Invalid image dimensions"))
        return
      }

      const aspectRatio = width / height

      resolve({
        width,
        height,
        aspectRatio,

        isPortrait: aspectRatio < 1,
        isLandScape: aspectRatio >= 1,

        isLikelyDocument: (aspectRatio > 0.6 && aspectRatio < 0.85) || (aspectRatio > 1.18 && aspectRatio < 1.67)
      })
    }

    img.onerror = () => {
      clearTimeout(timeout);
      reject(new Error("Failed to load image"))
    }
    img.src = imageDataUrl;
  })
}
