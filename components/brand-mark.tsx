/** Inline and token-colored rather than the committed file: it carries
 * `--primary`, so `invert` has a hue to distort (ADR 018). */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 512 512"
      aria-hidden="true"
      role="presentation"
      className={className}
    >
      <rect className="fill-primary" width="512" height="512" rx="112" />
      <path
        className="stroke-primary-foreground"
        fill="none"
        strokeWidth="62"
        strokeLinecap="butt"
        transform="translate(16 0)"
        d="M 355 157 A 140 140 0 1 0 355 355"
      />
    </svg>
  );
}
