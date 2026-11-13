"use client";

import { useActionState, useMemo, useState, useTransition, type ReactNode } from "react";
import { FileText, Sparkles } from "lucide-react";
import { createImportedProject } from "@/app/actions";
import { developStoryboard } from "@/app/storyboard-actions";
import { parseImportedScript, storyboardRequest, validateImportedScenes, MAX_SCRIPT_CHARS, MAX_IMPORTED_SCENES, type ImportedScene } from "@/lib/imported-script";
import { useI18n } from "@/i18n/client";
import { ContinuesPrevious } from "./continues-previous";
import { CastPicker, type CastOption } from "./cast-picker";
import { Card, ErrorNote, inputClass } from "./ui";
import { SubmitButton } from "./submit-button";
import { ProductReferenceProvider, PromptComposer, useProductReference } from "./product-reference";

export function ProjectCreationModes({ children, niche, characters }: {
  children: ReactNode;
  niche: { id: string; name: string; defaultAspectRatio: "9:16" | "16:9" };
  characters: CastOption[];
}) {
  const { locale } = useI18n();
  const vi = locale === "vi";
  const [mode, setMode] = useState("idea");
  return <ProductReferenceProvider><div className="min-w-0">
    <div role="tablist" aria-label={vi ? "Cách tạo video" : "Video creation mode"} className="mb-6 grid grid-cols-2 gap-2 rounded-2xl border border-border bg-surface p-1.5">
      {[{ id: "idea", label: vi ? "Nhập ý tưởng" : "From an idea", Icon: Sparkles }, { id: "import", label: vi ? "Dán prompt có sẵn" : "Import a script", Icon: FileText }].map(({ id, label, Icon }) =>
        <button key={id} type="button" role="tab" id={`creation-tab-${id}`} aria-selected={mode === id} aria-controls={`creation-panel-${id}`} onClick={() => setMode(id)} className={`flex min-h-12 items-center justify-center gap-2 rounded-xl px-2 text-center text-sm font-medium transition ${mode === id ? "bg-accent-soft text-gold" : "text-muted hover:bg-surface-soft"}`}><Icon className="hidden size-4 shrink-0 sm:block" />{label}</button>)}
    </div>
    <div role="tabpanel" id="creation-panel-idea" aria-labelledby="creation-tab-idea" hidden={mode !== "idea"}>{children}</div>
    <div role="tabpanel" id="creation-panel-import" aria-labelledby="creation-tab-import" hidden={mode !== "import"}><ImportForm niche={niche} characters={characters} /></div>
  </div></ProductReferenceProvider>;
}

function ImportForm({ niche, characters }: { niche: { id: string; name: string; defaultAspectRatio: "9:16" | "16:9" }; characters: CastOption[] }) {
  const product = useProductReference();
  const { locale, t } = useI18n();
  const vi = locale === "vi";
  const [raw, setRaw] = useState("");
  const [title, setTitle] = useState("");
  const [edits, setEdits] = useState<Record<number, Partial<ImportedScene>>>({});
  const [reviewed, setReviewed] = useState(false);
  const [state, action] = useActionState(createImportedProject, null);
  const [expanded, setExpanded] = useState<{ title: string; scenes: ImportedScene[] } | null>(null);
  const [expansionError, setExpansionError] = useState("");
  const [expanding, startExpansion] = useTransition();
  const [count, setCount] = useState("");
  const [ratio, setRatio] = useState(niche.defaultAspectRatio);
  const detected = useMemo(() => parseImportedScript(raw), [raw]);
  const parsed = expanded ? { ...expanded, errors: [], structureErrors: [] } : detected;
  const draft = parsed.scenes.map((scene, index) => ({ ...scene, ...edits[index] }));
  const errors = detected.needsExpansion && !expanded ? [] : [...(parsed.structureErrors ?? parsed.errors), ...validateImportedScenes(draft)];
  const projectTitle = title.trim() || parsed.title || (draft[0]?.visualPrompt.slice(0, 80) ?? "");
  function changeRaw(value: string) {
    setRaw(value); setEdits({}); setReviewed(false); setExpanded(null); setExpansionError("");
    const request = storyboardRequest(value);
    setCount("");
    if (request.ratio) setRatio(request.ratio);
  }
  function expand() {
    setExpansionError("");
    startExpansion(async () => {
      try {
        const result = await developStoryboard({ brief: raw, count: count === "" ? null : Number(count), ratio, productReference: product.keys.length > 0 });
        if (result.storyboard) { setExpanded(result.storyboard); setEdits({}); setReviewed(false); }
        else setExpansionError(result.error ?? "Chưa chia được cảnh.");
      } catch { setExpansionError(vi ? "Mất kết nối. Nội dung vẫn được giữ lại, bạn có thể thử lại." : "Connection lost. Your text is preserved; please retry."); }
    });
  }
  function edit(index: number, patch: Partial<ImportedScene>) { setEdits(previous => ({ ...previous, [index]: { ...previous[index], ...patch } })); setReviewed(false); }
  return <form action={action} className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
    <input type="hidden" name="nicheId" value={niche.id} />
    <input type="hidden" name="sourceText" value={raw} />
    <input type="hidden" name="title" value={projectTitle} />
    <input type="hidden" name="scenePayload" value={JSON.stringify(draft)} />
    <div className="flex min-w-0 flex-col gap-5">
      <Card className="flex min-w-0 flex-col gap-4 p-4 sm:p-6">
        <div><h2 className="font-semibold">{vi ? "Kịch bản / prompt đã chuẩn bị" : "Your prepared script / prompts"}</h2><p className="mt-2 text-sm leading-relaxed text-muted">{vi ? "Dán kịch bản để giữ nguyên từng cảnh, hoặc dán yêu cầu và chọn AI chia cảnh." : "Paste finished scenes to preserve them, or a brief to develop into scenes with AI."}</p></div>
        <PromptComposer disabled={expanding}><textarea id="import-script-source" disabled={expanding} aria-label={vi ? "Kịch bản có sẵn" : "Prepared script"} value={raw} maxLength={MAX_SCRIPT_CHARS} onChange={e => changeRaw(e.target.value)} rows={12} className={`${inputClass} !text-base leading-relaxed`} placeholder={vi ? "Nhập ý tưởng" : "Enter your idea"} />
        </PromptComposer>
        {raw.trim() && !expanded && <div className="flex flex-col gap-3 rounded-xl border border-border bg-accent-soft p-4">
          <p role="status" className="text-sm leading-relaxed">{vi ? (detected.needsExpansion ? "Đây là yêu cầu viết kịch bản. AI sẽ đọc nội dung, xây dựng mạch truyện và tự chia cảnh hợp lý để bạn kiểm tra." : "Muốn AI phân tích nội dung này? AI sẽ đọc ý tưởng, câu chuyện hoặc prompt của bạn và chia cảnh theo diễn biến.") : "AI can read your idea, story or prompt and plan scenes around its action and pacing."}</p>
          <label className="text-sm">{vi ? "Số cảnh (tùy chọn)" : "Scene count (optional)"}<input aria-label={vi ? "Số cảnh AI" : "AI scene count"} placeholder={vi ? "Để AI tự chọn theo nội dung" : "Let AI choose from your content"} type="number" min={1} max={MAX_IMPORTED_SCENES} value={count} disabled={expanding} onChange={e => setCount(e.target.value)} className={`${inputClass} mt-2`} /></label>
          <button type="button" onClick={expand} disabled={expanding || product.uploading || (count !== "" && (!Number.isInteger(Number(count)) || Number(count) < 1 || Number(count) > MAX_IMPORTED_SCENES))} className="min-h-11 rounded-xl bg-gold px-4 text-sm font-semibold text-white disabled:opacity-50">{expanding ? (vi ? "AI đang phân tích và chia cảnh…" : "Planning scenes…") : (vi ? "AI phân tích & chia cảnh" : "Analyze & plan scenes")}</button>
          <p className="text-xs leading-relaxed text-muted">{vi ? "AI ưu tiên số cảnh và thời lượng bạn yêu cầu trong nội dung. Sau khi duyệt cảnh, bạn có thể tạo video. Clip hiện khoảng 10 giây/cảnh, chưa áp dụng chính xác thời lượng riêng từng shot." : "AI follows requested shot counts and runtime where possible. Review the scenes, then generate your video. Clips are currently about 10 seconds each."}</p>
          {expansionError && <div role="alert"><ErrorNote>{expansionError}</ErrorNote></div>}
        </div>}
        {draft.length > 0 && <p role="status" className="rounded-xl bg-accent-soft px-3 py-2 text-sm font-medium text-gold">{vi ? `${expanded ? "AI đã chia" : "Nhận diện"} ${draft.length} cảnh · khoảng ${draft.length * 10} giây` : `${draft.length} scenes · about ${draft.length * 10} seconds`}</p>}
        {raw.trim() && errors.length > 0 && <div role="alert"><ErrorNote><ul className="list-disc space-y-1 pl-4">{errors.slice(0, 8).map((error, index) => <li key={index}>{error}</li>)}</ul></ErrorNote></div>}
      </Card>
      {draft.length > 0 && <section aria-label={vi ? "Kiểm tra từng cảnh" : "Review scenes"} className="flex min-w-0 flex-col gap-3"><h2 className="font-semibold">{vi ? "Kiểm tra từng cảnh" : "Review each scene"}</h2>
        {draft.map((scene, index) => <details key={index} open={draft.length <= 3} className="min-w-0 rounded-2xl border border-border bg-surface p-4">
          <summary className="cursor-pointer break-words text-sm font-semibold">{vi ? "Cảnh" : "Scene"} {index + 1}<span className="ml-2 font-normal text-muted">{scene.visualPrompt.slice(0, 55)}{scene.visualPrompt.length > 55 ? "…" : ""}</span></summary>
          <div className="mt-4 flex flex-col gap-4">{([{ field: "visualPrompt", label: vi ? "Prompt hình ảnh / mô tả cảnh" : "Visual prompt", rows: 5 }, { field: "camera", label: vi ? "Chuyển động / máy quay (tùy chọn)" : "Camera / movement (optional)", rows: 2 }, { field: "narration", label: vi ? "Lời dẫn / lời thoại (tùy chọn)" : "Narration / dialogue (optional)", rows: 2 }] as const).map(item => <label key={item.field} className="text-xs font-medium text-muted">{item.label}<textarea rows={item.rows} value={scene[item.field]} onChange={e => edit(index, { [item.field]: e.target.value })} className={`${inputClass} mt-2 !text-base leading-relaxed`} /></label>)}
            {index > 0 && <ContinuesPrevious value={scene.continuesPrevious ?? false} onChange={continuesPrevious => edit(index, { continuesPrevious })} />}
          </div>
        </details>)}
      </section>}
    </div>
    <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-8 lg:self-start">
      <Card className="flex flex-col gap-4 p-5">
        <label className="text-sm font-medium">{vi ? "Tên video (tùy chọn)" : "Video title (optional)"}<input id="import-script-title" value={title} onChange={e => setTitle(e.target.value)} maxLength={200} className={`${inputClass} mt-2 !text-base`} placeholder={parsed.title || (vi ? "Tự lấy từ kịch bản" : "Use the script title")} /></label>
        <fieldset disabled={expanding}><legend className="mb-2 text-sm font-medium">{vi ? "Khung hình" : "Aspect ratio"}</legend><div className="grid grid-cols-2 gap-2">{(["9:16", "16:9"] as const).map(value => <label key={value} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border text-sm has-checked:bg-accent-soft has-checked:text-gold"><input type="radio" name="aspectRatio" value={value} checked={ratio === value} onChange={() => setRatio(value)} />{value}</label>)}</div></fieldset>
        <p className="text-xs leading-relaxed text-muted">{vi ? `Lưu trong ngách “${niche.name}”. Số cảnh, giọng kể và phong cách mặc định của ngách không được chèn vào prompt.` : `Filed under “${niche.name}”. Niche scene count, voice and style are not added to your prompts.`}</p>
        <p className="text-xs leading-relaxed text-subtle">{vi ? "Mỗi cảnh tạo một clip khoảng 10 giây. Chia các đoạn dài thành cảnh riêng. Chưa tạo ảnh/video ở bước nhập này." : "Each scene becomes a clip of about 10 seconds. Split long segments into separate scenes. Importing does not generate media."}</p>
      </Card>
      <details className="rounded-2xl border border-border bg-surface p-4"><summary className="text-sm font-medium">{vi ? "Nhân vật tham chiếu (tùy chọn)" : "Reference characters (optional)"}</summary><div className="mt-4"><CastPicker name="castIds" options={characters} defaultIds={[]} layout="list" /></div></details>
      {draft.length > 0 && <label className="flex items-start gap-3 text-sm leading-relaxed"><input type="checkbox" name="reviewed" checked={reviewed} required onChange={e => setReviewed(e.target.checked)} className="mt-1 size-4 shrink-0" />{vi ? `Tôi đã kiểm tra ${draft.length} cảnh và muốn giữ các prompt này.` : `I reviewed these ${draft.length} scenes and want to keep these prompts.`}</label>}
      {state?.error && <div role="alert"><ErrorNote>{state.error}</ErrorNote></div>}
      <SubmitButton disabled={expanding || product.uploading || !draft.length || !raw.trim() || !reviewed || errors.length > 0 || !projectTitle} pendingLabel={t.motion.submitting} size="lg" className="w-full">{vi ? `Nhập ${draft.length} cảnh` : `Import ${draft.length} scenes`}</SubmitButton>
    </aside>
  </form>;
}
