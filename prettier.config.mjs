/** @type {import("prettier").Config} */
const config = {
  // Prettier's defaults, stated explicitly so the file documents the house style
  // rather than depending on what a future major decides the defaults are.
  semi: true,
  singleQuote: false,
  trailingComma: "all",
  printWidth: 80,
  tabWidth: 2,

  // Markdown prose is hand-wrapped in docs/ and the ADRs. "preserve" leaves those
  // line breaks alone -- reflowing them would produce enormous diffs on every edit
  // and defeat the point of wrapping deliberately.
  proseWrap: "preserve",

  // Sorts Tailwind utility classes into a canonical order. Worth having from the
  // start: without it, class order drifts per-author and every touched element
  // shows up as a diff.
  plugins: ["prettier-plugin-tailwindcss"],
};

export default config;
