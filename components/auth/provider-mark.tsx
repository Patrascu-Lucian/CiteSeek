import type { ReactNode } from "react";

/** Deliberately not a field on `AUTH_PROVIDERS`: `auth.ts` imports that constant
 * to configure the auth library, and a JSX icon has no business in the module a
 * server boots from. The drift its comment guards against does not apply here —
 * a missing mark is visible on the page, a missing callback is not. */
const MARKS: Record<string, ReactNode> = {
  // Google forbids recoloring the G, so these fills are literal rather than
  // token-driven, unlike `brand-mark.tsx`.
  google: (
    <>
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.63h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.8Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.94-2.91l-3.88-3.01c-1.08.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.73-4.95H1.26v3.09A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.28a7.2 7.2 0 0 1 0-4.56V6.63H1.26a12 12 0 0 0 0 10.74l4.01-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.26 6.63l4.01 3.09C6.22 6.88 8.87 4.75 12 4.75Z"
      />
    </>
  ),
  github: (
    <path
      fill="currentColor"
      d="M12 .3a12 12 0 0 0-3.79 23.4c.6.1.82-.26.82-.58v-2.23c-3.34.72-4.04-1.42-4.04-1.42-.55-1.38-1.34-1.75-1.34-1.75-1.09-.75.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5.99.1-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.14-.3-.54-1.52.1-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.64 1.66.24 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.8 5.63-5.48 5.92.43.37.82 1.1.82 2.22v3.29c0 .32.21.69.82.57A12 12 0 0 0 12 .3Z"
    />
  ),
};

/** Renders nothing for an unknown id rather than throwing: a button with no logo
 * still signs you in, and the unit test is what stops one shipping.
 *
 * Sized by the enclosing `Button`, whose cva carries
 * `[&_svg:not([class*='size-'])]:size-4`, and spaced by it too —
 * `data-icon="inline-start"` is what triggers its `pl-2`. Outside a Button this
 * renders at the replaced-element default with no padding. */
export function ProviderMark({
  provider,
  className,
}: {
  provider: string;
  className?: string;
}) {
  const mark = MARKS[provider];
  if (!mark) return null;

  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      role="presentation"
      data-icon="inline-start"
      className={className}
    >
      {mark}
    </svg>
  );
}
