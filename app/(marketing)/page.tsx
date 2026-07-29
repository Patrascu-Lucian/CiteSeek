import { getActor } from "@/lib/auth/actor";

import { Landing } from "./landing";
import { callsToAction } from "./calls-to-action";

/**
 * Resolves who is reading, and hands the markup what to offer them.
 *
 * Everything visual lives in `Landing`, which is why this file is three lines:
 * asking for the actor makes the component async and reaches into Auth.js, and
 * a component that does either cannot be rendered by React Testing Library.
 */
export default async function LandingPage() {
  return <Landing {...callsToAction(await getActor())} />;
}
