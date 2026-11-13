import assert from "node:assert/strict";
import test from "node:test";
import { effectiveImportedNiche, importedVideoPrompt, parseImportedScript, storyboardRequest, validateImportedScenes } from "./imported-script";

test("ten supplied scenes stay ten and keep exact prompt text", () => {
  const text = Array.from({ length: 10 }, (_, index) => `Cảnh ${index + 1}:\nPrompt: Exact scene ${index + 1}. Keep this punctuation!`).join("\n\n");
  const result = parseImportedScript(text);
  assert.deepEqual(result.errors, []);
  assert.equal(result.scenes.length, 10);
  result.scenes.forEach((scene, i) => {
    assert.equal(scene.visualPrompt, `Exact scene ${i + 1}. Keep this punctuation!`);
    assert.equal(importedVideoPrompt(scene), scene.visualPrompt);
    assert.equal(scene.narration, "");
  });
});

test("Markdown and Vietnamese field labels separate prompt, camera and narration", () => {
  const result = parseImportedScript("Tiêu đề: The forest\n\n## **Cảnh 1:**\n**Hình ảnh:** A forest.\nSecond line remains.\nChuyển động: Slow pan\nLời thoại: Xin chào!\n\n### Scene 2: A river at dawn.");
  assert.deepEqual(result.errors, []);
  assert.equal(result.title, "The forest");
  assert.deepEqual(result.scenes[0], { visualPrompt: "A forest.\nSecond line remains.", narration: "Xin chào!", camera: "Slow pan" });
  assert.equal(result.scenes[1].visualPrompt, "A river at dawn.");
});

test("missing or repeated numbers and unassigned instructions require review", () => {
  assert.ok(parseImportedScript("Scene 1: A\nScene 3: B").errors.length);
  assert.ok(parseImportedScript("Scene 1: A\nScene 1: B").errors.length);
  assert.ok(parseImportedScript("Global instruction\nScene 1: A").errors.length);
});

test("JSON and one-scene prompts do not require narration", () => {
  const result = parseImportedScript('```json\n{"title":"Test","scenes":[{"visualPrompt":"A quiet lake.","camera":"static"}]}\n```');
  assert.deepEqual(result.errors, []);
  assert.equal(result.scenes[0].narration, "");
  assert.equal(parseImportedScript("One exact prompt.").scenes[0].visualPrompt, "One exact prompt.");
  assert.ok(parseImportedScript('{"scenes":[null]}').errors.length);
  assert.ok(parseImportedScript('{"scenes":[{"prompt":"A","duration":5}]}').errors.length, "Unsupported timing must not be silently ignored");
  assert.ok(parseImportedScript("Scene 1:\nNarration: Just a voice.").errors.length);
});

test("scene and input limits are enforced", () => {
  assert.ok(parseImportedScript("a".repeat(100_001)).errors.length);
  assert.ok(validateImportedScenes(Array.from({length:49},()=>({visualPrompt:"A",narration:"",camera:""}))).length);
});

test("JSON imports retain explicit continuity without changing prompts and never chain scene one", () => {
  const result = parseImportedScript(JSON.stringify({ scenes: [
    { visualPrompt: "Exact first shot.", continuesPrevious: true },
    { visualPrompt: "Continue mopping at the same pace.", continuesPrevious: true },
    { visualPrompt: "A different room.", continuesPrevious: false },
  ] }));
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.scenes.map(scene => scene.continuesPrevious), [false, true, false]);
  assert.equal(importedVideoPrompt(result.scenes[1]), "Continue mopping at the same pace.");
  assert.ok(parseImportedScript('{"scenes":[{"prompt":"A","continuesPrevious":"false"}]}').errors.length);
});

test("imported scenes opt out of niche voice, style and ambient camera defaults", () => {
  const niche = { format: "ambient" as const, visualStyle: "Cartoon", narratorVoiceId: "voice", sceneSeconds: 6, fixedCamera: true };
  assert.equal(effectiveImportedNiche(niche, "generated"), niche);
  const imported = effectiveImportedNiche(niche, "imported-wordless");
  assert.equal(imported.format, "wordless");
  assert.equal(imported.visualStyle, "");
  assert.equal(imported.narratorVoiceId, null);
  assert.equal(imported.sceneSeconds, 10);
  assert.equal(imported.fixedCamera, false);
});

test("a director brief is not imported as one scene or five numbered acts", () => {
  const brief = `Hãy đóng vai đạo diễn phim hoạt hình kiêm họa sĩ storyboard chuyên nghiệp.
Hãy chia phân cảnh chi tiết (shot-by-shot) cho trận chiến Naruto và Sasuke.
Thời lượng: khoảng [3–5 phút], tổng cộng [20–30] shot
Tỷ lệ khung hình: 16:9
1. Đối mặt
2. Khai chiến
3. Cao trào
4. Kiệt sức
5. Kết thúc
Mỗi shot phải có đủ: Camera, thoại, prompt tiếng Anh.`;
  const parsed = parseImportedScript(brief);
  assert.equal(parsed.needsExpansion, true);
  assert.equal(parsed.scenes.length, 0);
  assert.deepEqual(storyboardRequest(brief), { request: true, suggestedCount: 25, ratio: "16:9" });
  assert.equal(parseImportedScript("Naruto and Sasuke face each other at a waterfall, cinematic anime.").scenes.length, 1);
  assert.equal(parseImportedScript("Shot 1: Naruto waits.\nShot 2: Sasuke arrives.").scenes.length, 2);
});
