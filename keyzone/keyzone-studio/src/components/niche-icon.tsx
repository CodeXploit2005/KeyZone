// Existing saved emoji values are shared by the picker and all niche displays.
export const NICHE_ICON_OPTIONS = [
  { value: "💰", label: { en: "Finance", vi: "Tài chính" } },
  { value: "🔭", label: { en: "Science", vi: "Khoa học" } },
  { value: "🌙", label: { en: "Stories", vi: "Truyện kể" } },
  { value: "🤖", label: { en: "Technology", vi: "Công nghệ" } },
  { value: "😂", label: { en: "Humour", vi: "Hài hước" } },
  { value: "🍜", label: { en: "Food", vi: "Ẩm thực" } },
  { value: "💪", label: { en: "Fitness", vi: "Thể hình" } },
  { value: "✈️", label: { en: "Travel", vi: "Du lịch" } },
  { value: "📚", label: { en: "Education", vi: "Giáo dục" } },
  { value: "🎮", label: { en: "Gaming", vi: "Trò chơi" } },
  { value: "💄", label: { en: "Beauty", vi: "Làm đẹp" } },
  { value: "🐾", label: { en: "Animals", vi: "Động vật" } },
  { value: "🧠", label: { en: "Knowledge", vi: "Kiến thức" } },
  { value: "⚽", label: { en: "Sport", vi: "Thể thao" } },
  { value: "🎵", label: { en: "Music", vi: "Âm nhạc" } },
  { value: "✦", label: { en: "General", vi: "Tổng hợp" } },
] as const;

/** Show the stored emoji consistently in the sidebar, headings and project forms. */
export function NicheIcon({ value, className = "size-5" }: { value: string; className?: string }) {
  return <span className={`niche-symbol inline-flex shrink-0 items-center justify-center ${className}`} aria-hidden="true">{value}</span>;
}
