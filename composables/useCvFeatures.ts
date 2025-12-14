export async function extractCvFeatures(imageDataUrl: string) {
  const img = new Image()
  img.src = imageDataUrl

  return new Promise<{
    aspectRatio: number
    isPortrait: boolean
    isLikelyDocument: boolean
  }>((resolve) => {
    img.onload = () => {
      const aspectRatio = img.width / img.height

      resolve({
        aspectRatio,
        isPortrait: aspectRatio < 1,
        // A4 / Letter docs fall roughly in this range
        isLikelyDocument: aspectRatio > 0.6 && aspectRatio < 0.85
      })
    }
  })
}
