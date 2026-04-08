//This interface cvFeatures stores metadata about image 

export interface CvFeatures
{
    aspectRatio: number 
    isPortrait: boolean 
    isLandScape: boolean 
    isLikelyDocument: boolean 
    width:number 
    height: number 
}

// This async function extracts important features from image frame.
export async function extractCvFeatures(imageDataUrl: string,timeoutMS: number=5000): Promise<CvFeatures> 
{
  return new Promise((resolve,reject)=>
  {
  //validate input format
  if(!imageDataUrl || !imageDataUrl.startsWith('data:image/'))
  {
    reject(new Error("Invalid image data url format"));
    return;
  }

  const img = new Image()

  const timeout= setTimeout(()=>
  {
     reject(new Error("Image load timeout"));
  },timeoutMS);
  
 
  img.onload=()=>{
    clearTimeout(timeout);

    const width=img.width;
    const height=img.height;

    if(!width || !height)
    {
       reject(new Error("Invalid image dimensions"))
       return
    }

    const aspectRatio=width/height

    resolve({
      width,
      height,
      aspectRatio,
      
      
      isPortrait: aspectRatio<1,
      isLandScape: aspectRatio>=1,

      //aspectRatio tells if image is an document 
      isLikelyDocument:(aspectRatio>0.6 && aspectRatio<0.85 )||(aspectRatio>1.18 && aspectRatio<1.67)
    });
  };
  
  img.onerror=()=>
  {
      clearTimeout(timeout);
      reject(new Error("Failed to load image"))
  };
    img.src=imageDataUrl;
  });
}
