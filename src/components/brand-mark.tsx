import Link from "next/link";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      className={`brand-mark ${compact ? "brand-mark--compact" : ""}`}
      aria-label="YourThinkingStyle 首页"
    >
      <span className="brand-mark__script">Think</span>
      <span className="brand-mark__name">YourThinkingStyle</span>
    </Link>
  );
}
