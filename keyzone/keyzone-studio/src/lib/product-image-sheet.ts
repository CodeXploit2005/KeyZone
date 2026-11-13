import sharp from "sharp";
import { MAX_PRODUCT_IMAGES } from "./product-reference";

/** Muse accepts one reference: retain all uploaded views in one non-cropping sheet. */
export async function productImageSheet(images: Buffer[]) {
  if (!images.length || images.length > MAX_PRODUCT_IMAGES) throw new Error("Invalid product reference count");
  if (images.length === 1) return images[0];
  const tile = 512, gap = 12;
  const columns = Math.min(3, images.length), rows = Math.ceil(images.length / columns);
  const tiles = await Promise.all(images.map(image => sharp(image).rotate().resize(tile,tile,{fit:"contain",background:"#ffffff"}).flatten({background:"#ffffff"}).jpeg().toBuffer()));
  return sharp({create:{width:columns*tile+(columns-1)*gap,height:rows*tile+(rows-1)*gap,channels:3,background:"#e5e7eb"}})
    .composite(tiles.map((input,index)=>({input,left:(index%columns)*(tile+gap),top:Math.floor(index/columns)*(tile+gap)}))).jpeg({quality:92}).toBuffer();
}
