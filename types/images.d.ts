/* Next declares these in `next-env.d.ts`, which a build generates and git
   ignores — so on a clean checkout, lint and typecheck run before it exists and
   an imported screenshot is untyped. Declared here instead, where the toolchain
   finds it without a build having run first. */
declare module "*.png" {
  import type { StaticImageData } from "next/image";

  const image: StaticImageData;
  export default image;
}
