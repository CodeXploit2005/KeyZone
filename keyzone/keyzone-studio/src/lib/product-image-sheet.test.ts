import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { productImageSheet } from "./product-image-sheet";
import { productImagePaths } from "./product-reference";

test("six references retain their order and content in one sheet", async () => {
  const colors = ["#ff0000","#00ff00","#0000ff","#ffff00","#ff00ff","#00ffff"];
  const photos = await Promise.all(colors.map(background=>sharp({create:{width:80,height:160,channels:3,background}}).png().toBuffer()));
  const sheet = await productImageSheet(photos);
  const metadata = await sharp(sheet).metadata();
  assert.equal(metadata.width,1560);
  assert.equal(metadata.height,1036);
  const expected = [[255,0,0],[0,255,0],[0,0,255],[255,255,0],[255,0,255],[0,255,255]];
  for (let i=0;i<6;i++) {
    const pixel = await sharp(sheet).extract({left:(i%3)*524+256,top:Math.floor(i/3)*524+256,width:1,height:1}).raw().toBuffer();
    expected[i].forEach((value,c)=>assert.ok(Math.abs(pixel[c]-value)<8,`Missing or misplaced reference ${i+1}`));
  }
  assert.deepEqual(await productImageSheet([photos[0]]),photos[0]);
  await assert.rejects(productImageSheet([]));
  await assert.rejects(productImageSheet(Array(7).fill(photos[0])));
});

test("new image lists and legacy single references resolve without mixing place photos", () => {
  assert.deepEqual(productImagePaths({referenceImageKind:"product",referenceImagePath:"old",productImagePaths:["a","b","a"]}),["a","b"]);
  assert.deepEqual(productImagePaths({referenceImageKind:"product",referenceImagePath:"old",productImagePaths:[]}),["old"]);
  assert.deepEqual(productImagePaths({referenceImageKind:"place",referenceImagePath:"old",productImagePaths:["a"]}),[]);
});
