/** Uses the supplied KeyZone artwork unchanged; transparent padding is cropped in CSS. */
export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`brand-logo ${compact ? "brand-logo--compact" : ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- original local brand artwork */}
      <img src="/brand/keyzone-logo.png" alt="KeyZone Video Studio" width={2172} height={724} draggable={false} />
    </span>
  );
}
