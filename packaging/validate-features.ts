import { readFile, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { composeThumbnail } from "../keyzone/keyzone-studio/src/lib/pipeline/thumbnail";
import { renderFinal, probe } from "../keyzone/keyzone-studio/src/lib/pipeline/render";

async function main() {
  const directory = path.resolve(process.argv[2]);
  const base = await sharp({ create: { width: 1280, height: 720, channels: 3, background: "#7057ed" } }).png().toBuffer();
  const thumbnail = await composeThumbnail({ base, headline: "KEYZONE *VIDEO*", style: "impact", accent: "#ad95ff", brand: "KEYZONE", aspectRatio: "16:9" });
  const image = await sharp(thumbnail).metadata();
  if (image.width !== 1280 || image.height !== 720) throw new Error("Incorrect thumbnail dimensions");
  await writeFile(path.join(directory, "thumbnail.jpg"), thumbnail);
  const output = path.join(directory, "final.mp4");
  await renderFinal({ clips: [{ file: path.join(directory, "smoke.mp4"), narration: "" }], aspectRatio: "9:16", outFile: output });
  const video = await probe(output);
  if (video.duration < 0.9 || !(await stat(output)).size) throw new Error("Video render failed");
  console.log(JSON.stringify({ thumbnail: `${image.width}x${image.height}`, videoDuration: video.duration, videoBytes: (await readFile(output)).length }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
