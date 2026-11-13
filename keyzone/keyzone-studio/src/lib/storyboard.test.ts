import assert from "node:assert/strict";
import test from "node:test";
import { expandStoryboard } from "./storyboard";

test("long briefs expand in bounded batches with exact count and full continuity", async () => {
  const prompts: string[] = [];
  let index = 0;
  const result = await expandStoryboard("Naruto and Sasuke, waterfall, five acts, emotional dawn ending", 25, "16:9", async prompt => {
    prompts.push(prompt);
    if (prompts.length === 1) return JSON.stringify({ title: "Dawn", beats: Array.from({length:25}, (_, i) => `Beat ${i + 1}`) });
    const length = Math.min(8, 25 - index);
    return JSON.stringify({ scenes: Array.from({length}, () => ({ visualPrompt: `Exact shot ${++index}`, camera: "dolly", narration: "" })) });
  });
  assert.equal(prompts.length, 5);
  assert.equal(result.scenes.length, 25);
  assert.equal(result.scenes[24].visualPrompt, "Exact shot 25");
  assert.ok(prompts.every(prompt => prompt.includes("Naruto and Sasuke") && prompt.includes("16:9")));
  assert.ok(prompts.slice(1).every(prompt => prompt.includes("25. Beat 25")));
});

test("incomplete model output fails instead of silently accepting fewer shots", async () => {
  await assert.rejects(expandStoryboard("Test", 25, "16:9", async () => JSON.stringify({title:"Test",beats:["Only one"]})));
  let turn = 0;
  await assert.rejects(expandStoryboard("Test", 2, "16:9", async () => ++turn === 1
    ? JSON.stringify({title:"Test",beats:["First","Last"]})
    : JSON.stringify({scenes:[{visualPrompt:"Only one",camera:"",narration:""}]})));
});

test("automatic planning follows the content instead of a fixed default count", async () => {
  for (const planned of [1, 5, 25]) {
    let turn = 0;
    let written = 0;
    const result = await expandStoryboard("A user story with its own pacing", null, "16:9", async prompt => {
      assert.ok(prompt.includes("meaningful changes in action"));
      if (++turn === 1) return JSON.stringify({title:"Story",beats:Array.from({length:planned}, (_,i)=>`Beat ${i+1}`)});
      const batch = Math.min(8, planned-written);
      return JSON.stringify({scenes:Array.from({length:batch},()=>({visualPrompt:`Shot ${++written}`,camera:"static",narration:""}))});
    });
    assert.equal(result.scenes.length, planned);
  }
});

test("automatic plans cannot exceed the production limit", async () => {
  await assert.rejects(expandStoryboard("Story", null, "16:9", async () => JSON.stringify({title:"Too long",beats:Array(49).fill("Beat")})));
});

test("storyboard continuity survives batch boundaries, respects cuts and starts unchained", async () => {
  let turn = 0;
  let index = 0;
  const flags = [true, true, false, false, false, false, false, false, true, false];
  const result = await expandStoryboard("One uninterrupted mopping motion, then a new room", 10, "9:16", async prompt => {
    if (++turn === 1) return JSON.stringify({ title: "Mopping", beats: flags.map((_, i) => `Beat ${i + 1}`) });
    assert.ok(prompt.includes("LAST frame"));
    const length = Math.min(8, flags.length - index);
    return JSON.stringify({ scenes: Array.from({ length }, () => {
      const i = index++;
      return { visualPrompt: `Shot ${i + 1}`, camera: "steady tracking", narration: "", continuesPrevious: flags[i] };
    }) });
  });
  assert.deepEqual(result.scenes.map(scene => scene.continuesPrevious), [false, ...flags.slice(1)]);
  assert.equal(result.scenes[8].visualPrompt, "Shot 9");
});
