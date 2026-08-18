/**
 * A passage in a document, the answer that used it, and the marker tying them
 * together.
 *
 * Inline rather than a file so one asset follows the theme (ADR 018). Decorative:
 * the heading beside it says this in words.
 */

const ROWS = [0, 1, 2, 4, 5, 6, 7] as const;
const CITED_Y = 68 + 3 * 30;

export function HeroGraphic({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 480 360"
      aria-hidden="true"
      role="presentation"
      className={className}
    >
      <rect
        x="24"
        y="28"
        width="248"
        height="304"
        rx="14"
        className="fill-card stroke-border"
        strokeWidth="2"
      />

      {ROWS.map((row) => (
        <rect
          key={row}
          x="52"
          y={68 + row * 30}
          width={row % 3 === 2 ? 132 : 192}
          height="9"
          rx="4.5"
          className="fill-muted-foreground/25"
        />
      ))}

      {/* The cited passage. Tinted *and* underlined, like the real one — the
          tint alone would carry the whole claim in colour. */}
      <rect
        x="44"
        y={CITED_Y - 8}
        width="208"
        height="30"
        rx="6"
        className="fill-primary/20"
      />
      <rect
        x="52"
        y={CITED_Y}
        width="176"
        height="9"
        rx="4.5"
        className="fill-foreground/75"
      />
      <rect
        x="52"
        y={CITED_Y + 14}
        width="176"
        height="3"
        rx="1.5"
        className="fill-primary"
      />

      <rect
        x="212"
        y="196"
        width="244"
        height="136"
        rx="14"
        className="fill-card stroke-border"
        strokeWidth="2"
      />

      <rect
        x="240"
        y="228"
        width="188"
        height="9"
        rx="4.5"
        className="fill-muted-foreground/25"
      />
      <rect
        x="240"
        y="254"
        width="150"
        height="9"
        rx="4.5"
        className="fill-muted-foreground/25"
      />

      <rect
        x="240"
        y="284"
        width="30"
        height="22"
        rx="6"
        className="fill-primary"
      />
      <text
        x="255"
        y="300"
        textAnchor="middle"
        fontSize="14"
        fontWeight="600"
        className="fill-primary-foreground"
      >
        1
      </text>
      <rect
        x="280"
        y="290"
        width="104"
        height="9"
        rx="4.5"
        className="fill-muted-foreground/25"
      />
    </svg>
  );
}
