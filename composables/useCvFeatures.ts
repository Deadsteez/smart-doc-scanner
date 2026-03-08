/** This interface cvFeatures stores metadata about image .*/

export interface CvFeatures
{
    //aspectratio calculated as width/height
    aspectRatio: number 

    //whether the image is in portrait orientation(width<height)
    isPortrait: boolean 

    //whether the image is in landscape orientation(width>height)
    isLandScape: boolean 

    //whether image frame looks like a document based on aspect ratio
    isLikelyDocument: boolean 

    //width of image in pixels
    width:number 

    //height of image in pixels
    height: number 
}

/** 
This async function extracts important features from image frame.
params: raw image (as a Data URL)
returns: promise resolving to extracted features from image
throws: error if failed to load image or invalid dimensions
*/
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
  //Image object
  const img = new Image()

  const timeout= setTimeout(()=>
  {
     reject(new Error("Image load timeout"));
  },timeoutMS);
  
  //extracts the width and height of the image once loaded.
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
      
      /*width/height <1*/
      isPortrait: aspectRatio<1,
      isLandScape: aspectRatio>=1,

      /*aspectRatio tells if image is an document -A4:0.707 US Letter:0.77*/
      isLikelyDocument:(aspectRatio>0.6 && aspectRatio<0.85 )||(aspectRatio>1.18 && aspectRatio<1.67)
    });
  };
  
  //if error occured in loading image
  img.onerror=()=>
  {
      clearTimeout(timeout);
      reject(new Error("Failed to load image"))
  };
    img.src=imageDataUrl;
  });
}
