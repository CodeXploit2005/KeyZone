/** Deterministic import only: never calls a model or rewrites scene contents. */
export const MAX_IMPORTED_SCENES = 48;
export const MAX_SCRIPT_CHARS = 100_000;
export type ImportedScene = { visualPrompt: string; narration: string; camera: string; continuesPrevious?: boolean };
export type ImportedScript = { title: string; scenes: ImportedScene[]; errors: string[]; structureErrors?: string[]; needsExpansion?: boolean };

/** A writing request is not itself a finished shot, even when it contains numbered acts. */
export function storyboardRequest(input: string) {
  const request = /(?:hãy|vui lòng|đóng vai|giúp tôi|please|act as|create|write|generate)/iu.test(input)
    && /(?:chia.*(?:cảnh|shot)|storyboard|shot.by.shot|mỗi shot|mỗi cảnh|write.*scenes|generate.*scenes)/iu.test(input);
  const count = input.match(/(?:tổng\s*cộng|total(?:\s+of)?|khoảng)?\s*\[?(\d+)\s*(?:[–—-]\s*(\d+))?\]?\s*(?:shot|cảnh|scenes?)/iu);
  const lower = count ? Number(count[1]) : null;
  const upper = count?.[2] ? Number(count[2]) : lower;
  const suggestedCount = lower && upper ? Math.round((lower + upper) / 2) : 12;
  const ratio = input.match(/\b(16:9|9:16)\b/)?.[1] as "16:9" | "9:16" | undefined;
  return { request, suggestedCount, ratio };
}

const heading = /^\s*(?:#{1,6}\s*)?(?:\*\*)?(?:cảnh|scene|shot)\s+(\d+)\s*(?:\*\*)?\s*(?:[:.)–—-]\s*)?(.*?)\s*$/iu;
const field = /^\s*(?:[-*]\s+)?(?:\*\*)?(prompt|visual\s*prompt|visual|hình ảnh|mô tả|lời thoại|lời dẫn|narration|voice[ -]?over|dialogue|camera|máy quay|chuyển động)(?:\*\*)?\s*:\s*(?:\*\*)?\s*(.*)$/iu;

function sceneFromLines(lines: string[], tail: string): ImportedScene {
  const sections: Record<"visualPrompt" | "narration" | "camera", string[]> = { visualPrompt: [], narration: [], camera: [] };
  let current: keyof typeof sections = "visualPrompt";
  let labeled = false;
  for (const line of lines) {
    const match = line.match(field);
    if (match) {
      labeled = true;
      const label = match[1].toLowerCase();
      current = /^(lời thoại|lời dẫn|narration|voice[ -]?over|dialogue)$/u.test(label) ? "narration"
        : /^(camera|máy quay|chuyển động)$/u.test(label) ? "camera" : "visualPrompt";
      sections[current].push(match[2]);
    } else {
      sections[current].push(line);
    }
  }
  if (tail && !labeled) sections.visualPrompt.unshift(tail);
  return { visualPrompt: sections.visualPrompt.join("\n").trim(), narration: sections.narration.join("\n").trim(), camera: sections.camera.join("\n").trim() };
}

export function validateImportedScenes(scenes: ImportedScene[]): string[] {
  const errors: string[] = [];
  if (!scenes.length) errors.push("Chưa có cảnh để nhập.");
  if (scenes.length > MAX_IMPORTED_SCENES) errors.push(`Tối đa ${MAX_IMPORTED_SCENES} cảnh cho một video.`);
  scenes.forEach((scene, index) => {
    if (!scene.visualPrompt.trim()) errors.push(`Cảnh ${index + 1}: thiếu prompt hình ảnh / mô tả cảnh.`);
    if ([scene.visualPrompt, scene.narration, scene.camera].some(value => value.length > 12_000)) errors.push(`Cảnh ${index + 1}: nội dung quá dài (tối đa 12.000 ký tự mỗi ô).`);
  });
  return errors;
}

export function parseImportedScript(input: string): ImportedScript {
  const raw = input.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim();
  const result: ImportedScript = { title: "", scenes: [], errors: [] };
  if (!raw) return result;
  if (raw.length > MAX_SCRIPT_CHARS) return { ...result, errors: ["Kịch bản quá dài (tối đa 100.000 ký tự)."] };
  const json = raw.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/, "");
  if (/^[\[{]/.test(json)) {
    try {
      const parsed = JSON.parse(json);
      const rows: unknown = Array.isArray(parsed) ? parsed : parsed.scenes;
      if (!Array.isArray(rows)) throw new Error("missing scenes");
      if (!Array.isArray(parsed) && typeof parsed.title === "string") result.title = parsed.title.trim();
      result.scenes = rows.map((row: unknown) => {
        if (typeof row === "string") return { visualPrompt: row.trim(), narration: "", camera: "" };
        if (!row || typeof row !== "object") throw new Error("invalid scene");
        const value = row as Record<string, unknown>;
        if (Object.keys(value).some(key => !["visualPrompt", "prompt", "narration", "camera", "continuesPrevious", "scene", "index", "title"].includes(key))) throw new Error("unsupported scene fields");
        const visual = value.visualPrompt ?? value.prompt;
        if (typeof visual !== "string" || (value.narration !== undefined && typeof value.narration !== "string") || (value.camera !== undefined && typeof value.camera !== "string")) throw new Error("invalid fields");
        if (value.continuesPrevious !== undefined && typeof value.continuesPrevious !== "boolean") throw new Error("invalid continuity flag");
        return { visualPrompt: visual.trim(), narration: (value.narration as string | undefined)?.trim() ?? "", camera: (value.camera as string | undefined)?.trim() ?? "", ...(value.continuesPrevious !== undefined ? { continuesPrevious: value.continuesPrevious as boolean } : {}) };
      });
    } catch {
      result.errors.push('JSON không hợp lệ. Dùng {"title":"...","scenes":[{"visualPrompt":"...","narration":"...","camera":"..."}]} hoặc các tiêu đề Cảnh 1, Cảnh 2.');
      return result;
    }
  } else {
    let block: { number: number; tail: string; lines: string[] } | null = null;
    const prefix: string[] = [];
    const blocks: { number: number; tail: string; lines: string[] }[] = [];
    for (const line of raw.split("\n")) {
      const match = line.match(heading);
      if (match) {
        block = { number: Number(match[1]), tail: match[2].replace(/^\*\*|\*\*$/g, "").trim(), lines: [] };
        blocks.push(block);
      } else if (block) block.lines.push(line);
      else prefix.push(line);
    }
    if (!blocks.length) {
      if (storyboardRequest(raw).request) return { ...result, needsExpansion: true, structureErrors: [], errors: [] };
      result.scenes = [sceneFromLines(raw.split("\n"), "")];
    } else {
      const intro = prefix.join("\n").trim();
      if (intro) {
        const title = intro.match(/^(?:#{1,6}\s*)?(?:tiêu đề|title)\s*:\s*(.+)$/iu);
        if (title) result.title = title[1].trim();
        else result.errors.push("Có nội dung trước Cảnh 1 chưa được gán vào cảnh nào. Hãy đưa phần đó vào cảnh, hoặc dùng dòng Tiêu đề: ...");
      }
      blocks.forEach((entry, index) => {
        if (entry.number !== index + 1) result.errors.push(`Thứ tự cảnh không liên tục: cần Cảnh ${index + 1}, đang có Cảnh ${entry.number}.`);
        result.scenes.push(sceneFromLines(entry.lines, entry.tail));
      });
    }
  }
  if (result.scenes[0]?.continuesPrevious) result.scenes[0].continuesPrevious = false;
  result.structureErrors = [...result.errors];
  result.errors.push(...validateImportedScenes(result.scenes));
  return result;
}

export function importedVideoPrompt(scene: ImportedScene) {
  return [scene.visualPrompt, scene.camera && `Camera: ${scene.camera}`, scene.narration && `Narration: ${scene.narration}`].filter(Boolean).join("\n");
}

export function effectiveImportedNiche<T extends { format: "story" | "ambient" | "wordless" }>(niche: T, source: string): T {
  if (!source.startsWith("imported-")) return niche;
  return { ...niche, format: source === "imported-story" ? "story" : "wordless", sceneSeconds: 10, visualStyle: "", tone: "", narratorVoiceId: null, fixedCamera: false };
}
