import { z } from "zod";
import { MAX_IMPORTED_SCENES, validateImportedScenes } from "./imported-script";
import { limitChains, parseReply } from "./pipeline/prompts";
import { PRODUCT_REFERENCE_PLANNING } from "./product-reference";

const outlineSchema = z.object({ title: z.string().trim().min(1).max(200), beats: z.array(z.string().trim().min(1)).min(1).max(MAX_IMPORTED_SCENES) });
const shotSchema = z.object({ scenes: z.array(z.object({
  visualPrompt: z.string().trim().min(1).max(12_000),
  camera: z.string().trim().max(12_000),
  narration: z.string().trim().max(12_000),
  continuesPrevious: z.boolean().default(false),
})) });

/** No niche defaults: the supplied brief is the source of creative requirements. */
export async function expandStoryboard(brief: string, count: number | null, ratio: string, chat: (prompt: string) => Promise<string>, productReference = false) {
  if (count !== null && (!Number.isInteger(count) || count < 1 || count > MAX_IMPORTED_SCENES)) throw new Error("Invalid shot count");
  const countRule = count === null
    ? `Choose a sensible number of shots (1–${MAX_IMPORTED_SCENES}) from the actual content. Read explicit shot counts or ranges in the brief and honor them when possible. If only runtime is given, budget about 10 seconds per clip. Otherwise split at meaningful changes in action, location, time, or viewpoint. Keep a simple moment short; allow complex stories enough shots to reach their ending. Never mistake numbered acts or output requirements for completed shots. Do not pad or invent unrelated events.`
    : `Use exactly ${count} shots.`;
  const context = `You are an animation director. Develop the user's creative brief into production shots.
${countRule} Aspect ratio ${ratio}. Keep character appearance, setting, visual style and story continuity consistent.
Follow all story acts and required camera moments. Do not add niche characters, style or a presenter.
${productReference ? PRODUCT_REFERENCE_PLANNING : ""}
The renderer currently makes approximately 10-second clips per shot; do not promise custom durations or total runtime.
USER BRIEF:\n${brief}`;
  const outline = parseReply(await chat(`${context}
Return JSON only: {"title":"short title","beats":["shot 1 story beat and continuity notes", "..."]}.
${count === null ? "One beat per planned shot, choosing the count according to the above rules" : `Exactly ${count} beats`}, covering the entire story through its ending. No Markdown or summary table.`), outlineSchema);
  if (count !== null && outline.beats.length !== count) throw new Error("AI chưa lập đủ số cảnh đã chọn. Hãy thử lại.");
  const shotCount = outline.beats.length;
  const scenes: z.infer<typeof shotSchema>["scenes"] = [];
  for (let start = 0; start < shotCount; start += 8) {
    const beats = outline.beats.slice(start, start + 8);
    const reply = parseReply(await chat(`${context}
COMPLETE STORY OUTLINE:\n${outline.beats.map((beat, index) => `${index + 1}. ${beat}`).join("\n")}
The plan contains exactly ${shotCount} shots. Follow this plan; do not re-plan the count.
Write ONLY shots ${start + 1} through ${start + beats.length}, exactly ${beats.length} scenes, in order.
Return JSON only: {"scenes":[{"visualPrompt":"...","camera":"...","narration":"","continuesPrevious":false}]}.
visualPrompt: detailed English production prompt with recurring character appearance, setting, shot framing, action, expression, effects, lighting, style, and sound/music cues requested by the brief. Repeat appearance details so each shot works independently.
camera: English camera movement and pacing. narration: only actual spoken dialogue/voice-over requested for this shot, in the user's language; empty string for silent shots. Never narrate production notes.
continuesPrevious: true only for an uninterrupted continuation of the preceding shot, in the same place and moment with the same subject and framing. This starts from the previous clip's LAST frame. Preserve movement direction and speed, without a freeze, pose reset, fade-in or establishing shot. False for the first shot or a change in time, location or camera angle. Use the complete outline to check the preceding shot even at batch boundaries. Do not force continuity across intentional cuts.
No shot headings, summary tables, or additional fields.`), shotSchema);
    if (reply.scenes.length !== beats.length) throw new Error("AI trả thiếu hoặc thừa cảnh. Hãy thử lại.");
    scenes.push(...reply.scenes);
  }
  const errors = validateImportedScenes(scenes);
  if (errors.length) throw new Error(errors[0]);
  const chained = limitChains(scenes.map(scene => scene.continuesPrevious));
  return { title: outline.title, scenes: scenes.map((scene, index) => ({ ...scene, continuesPrevious: chained[index] })) };
}
