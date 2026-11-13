"use client";

import { ImagePlus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, buttonClass } from "@/components/ui";
import { useI18n } from "@/i18n/client";
import { REFERENCE_EXTENSIONS } from "@/lib/reference-image";

async function upload(file: File) {
  const res = await fetch(`/api/uploads/image?name=${encodeURIComponent(file.name)}`, { method: "POST", body: file });
  const body = (await res.json().catch(() => ({}))) as { key?: string; error?: string };
  if (!res.ok || !body.key) throw new Error(body.error ?? `Upload failed (${res.status})`);
  return body.key;
}

/**
 * Optional photo of the place. Inside a form, `name` carries the storage key; `onChange`
 * reports a new key, or null when the photo is removed.
 */
export function ReferenceImageUpload({
  name,
  initialUrl,
  onChange,
  disabled,
  value,
  product = false,
  onUploadingChange,
}: {
  name?: string;
  initialUrl?: string | null;
  onChange?: (key: string | null) => void;
  disabled?: boolean;
  value?: string | null;
  product?: boolean;
  onUploadingChange?: (uploading: boolean) => void;
}) {
  const { t, locale } = useI18n();
  const r = t.newProject.reference;
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(initialUrl ?? null);
  const [key, setKey] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => () => { if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview); }, [preview]);
  const displayed = uploading ? preview : value !== undefined ? (value ? `/api/files/${value}` : null) : preview;

  const onPick = async (file: File | undefined) => {
    const el = input.current;
    if (!file || !el) return;
    setError(null);
    setPreview(URL.createObjectURL(file));
    setUploading(true);
    onUploadingChange?.(true);
    el.setCustomValidity(r.uploading);
    try {
      const uploaded = await upload(file);
      setKey(uploaded);
      el.setCustomValidity("");
      onChange?.(uploaded);
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      setError(text);
      setPreview(initialUrl ?? null);
      el.setCustomValidity("");
      el.value = "";
    } finally {
      setUploading(false);
      onUploadingChange?.(false);
    }
  };

  const remove = () => {
    setError(null);
    if (input.current) input.current.value = "";
    setPreview(null);
    setKey("");
    onChange?.(null);
  };

  return (
    <div className="flex flex-col gap-3">
      {name && <input type="hidden" name={name} value={value !== undefined ? value ?? "" : key} />}
      {displayed && (
        <div className="relative self-start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={displayed}
            alt={product ? (locale === "vi" ? "Ảnh sản phẩm tham chiếu" : "Product reference") : r.alt}
            className={`max-h-56 max-w-full rounded-2xl object-contain ring-1 ring-gold/25 ${uploading ? "animate-pulse opacity-60" : ""}`}
          />
          <div className="absolute top-2 right-2"><Button
            variant="secondary"
            size="icon"
            onClick={remove}
            disabled={disabled || uploading}
            title={r.remove}
            aria-label={r.remove}
          >
            <X />
          </Button></div>
        </div>
      )}
      <label className={`${buttonClass("secondary")} cursor-pointer self-start ${disabled || uploading ? "pointer-events-none opacity-45" : ""}`}>
        <ImagePlus /> {uploading ? r.uploading : displayed ? r.replace : product ? (locale === "vi" ? "Thêm ảnh sản phẩm" : "Attach product image") : r.choose}
        <input
          ref={input}
          type="file"
          accept={REFERENCE_EXTENSIONS.join(",")}
          disabled={disabled || uploading}
          onChange={(e) => onPick(e.target.files?.[0])}
          className="sr-only"
        />
      </label>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
