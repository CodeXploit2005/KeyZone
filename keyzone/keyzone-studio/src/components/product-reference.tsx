"use client";

import { createContext, useContext, useRef, useState, type ReactNode, type ComponentProps } from "react";
import { LoaderCircle, Paperclip, X } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { SubmitButton } from "./submit-button";
import { MAX_PRODUCT_IMAGES } from "@/lib/product-reference";
import { REFERENCE_EXTENSIONS, REFERENCE_MAX_BYTES } from "@/lib/reference-image";

const ProductContext = createContext<{
  keys: string[]; uploading: boolean;
  setKeys: React.Dispatch<React.SetStateAction<string[]>>; setUploading: (busy: boolean) => void;
} | null>(null);

export function ProductReferenceProvider({ children }: { children: ReactNode }) {
  const [keys, setKeys] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  return <ProductContext value={{keys, setKeys, uploading, setUploading}}>{children}</ProductContext>;
}

export function useProductReference() {
  const value = useContext(ProductContext);
  if (!value) throw new Error("Missing product reference provider");
  return value;
}

export function ProductSubmitButton(props: ComponentProps<typeof SubmitButton>) {
  const ref = useProductReference();
  return <SubmitButton {...props} disabled={props.disabled || ref.uploading} />;
}

/** One input surface: text above, attachment thumbnails and paperclip below. */
export function PromptComposer({ children, attachments = true, disabled }: { children: ReactNode; attachments?: boolean; disabled?: boolean }) {
  return <div className="min-w-0 rounded-lg border border-border bg-surface focus-within:border-gold/60 focus-within:ring-2 focus-within:ring-gold/15 [&_textarea]:border-0 [&_textarea]:bg-transparent [&_textarea]:shadow-none [&_textarea]:focus:ring-0">
    {children}
    {attachments && <ProductReferenceUpload disabled={disabled} />}
  </div>;
}

export function ProductReferenceUpload({ disabled }: { disabled?: boolean }) {
  const { locale } = useI18n();
  const ref = useProductReference();
  const picker = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const vi = locale === "vi";
  const label = vi ? `Đính kèm ảnh (tối đa ${MAX_PRODUCT_IMAGES} ảnh)` : `Attach images (up to ${MAX_PRODUCT_IMAGES})`;
  async function pick(files: File[]) {
    if (!files.length || ref.uploading) return;
    setError("");
    if (files.length + ref.keys.length > MAX_PRODUCT_IMAGES) { setError(vi ? `Tối đa ${MAX_PRODUCT_IMAGES} ảnh. Hãy xóa bớt trước khi thêm.` : `Maximum ${MAX_PRODUCT_IMAGES} images. Remove some before adding more.`); return; }
    if (files.some(file => file.size > REFERENCE_MAX_BYTES || !REFERENCE_EXTENSIONS.some(ext => file.name.toLowerCase().endsWith(ext)))) {
      setError(vi ? "Chọn ảnh JPG, PNG hoặc WebP, tối đa 25 MB mỗi ảnh." : "Use JPG, PNG or WebP, up to 25 MB per image."); return;
    }
    ref.setUploading(true);
    try {
      for (const file of files) {
        const response = await fetch(`/api/uploads/image?name=${encodeURIComponent(file.name)}`, {method:"POST",body:file,signal:AbortSignal.timeout(60_000)});
        const body = await response.json().catch(() => ({}));
        if (!response.ok || typeof body.key !== "string") throw new Error("upload");
        ref.setKeys(keys => [...keys, body.key]);
      }
    } catch { setError(vi ? "Có ảnh chưa tải được. Các ảnh tải thành công vẫn được giữ lại; hãy thử thêm ảnh còn thiếu." : "Some images could not upload. Successful uploads are preserved; retry the missing ones."); }
    finally { ref.setUploading(false); }
  }
  return <div className="min-w-0" data-product-attachments>
    <input type="hidden" name="referenceImageKind" value="product" />
    <input type="hidden" name="referenceImagePath" value={ref.keys[0] ?? ""} />
    <input type="hidden" name="productImagePaths" value={JSON.stringify(ref.keys)} />
    {ref.keys.length > 0 && <div className="flex flex-wrap gap-2 px-3 pb-2 pt-1">{ref.keys.map((key,index) => <div key={key} className="relative size-16 shrink-0 rounded-lg border border-border bg-surface-soft">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/api/files/${key}`} alt={vi ? `Ảnh sản phẩm ${index+1}` : `Product image ${index+1}`} className="size-full rounded-lg object-contain" />
      <button type="button" aria-label={vi ? `Xóa ảnh ${index+1}` : `Remove image ${index+1}`} title={vi ? "Xóa ảnh" : "Remove image"} disabled={disabled || ref.uploading} onClick={() => {ref.setKeys(keys => keys.filter(item => item!==key));setError("");}} className="absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full border border-border bg-surface text-muted hover:text-danger disabled:opacity-40"><X className="size-3.5" /></button>
    </div>)}</div>}
    <div className="flex items-center gap-2 px-2 pb-2">
      <button type="button" title={label} aria-label={label} disabled={disabled || ref.uploading || ref.keys.length>=MAX_PRODUCT_IMAGES} onClick={() => picker.current?.click()} className="flex size-10 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-surface-soft hover:text-gold focus-visible:outline-2 focus-visible:outline-gold disabled:opacity-40">
        {ref.uploading ? <LoaderCircle className="size-4 animate-spin" /> : <Paperclip className="size-4" />}
      </button>
      <input ref={picker} type="file" multiple accept={REFERENCE_EXTENSIONS.join(",")} disabled={disabled || ref.uploading} onChange={event => {const files=Array.from(event.target.files ?? []);event.target.value="";void pick(files);}} className="sr-only" aria-label={label} />
      {(ref.uploading || ref.keys.length>0) && <span role="status" className="text-xs text-subtle">{ref.uploading ? (vi ? "Đang tải ảnh…" : "Uploading…") : `${ref.keys.length}/${MAX_PRODUCT_IMAGES}`}</span>}
    </div>
    {error && <p role="alert" className="px-3 pb-3 text-xs text-danger">{error}</p>}
  </div>;
}
