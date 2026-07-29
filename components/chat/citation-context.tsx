"use client";

import { createContext, useContext } from "react";

import type { ChatSource } from "@/lib/ai/types";

/**
 * Citation state, passed by context rather than by props.
 *
 * This is not a style preference. `Streamdown` wraps its output in `React.memo`
 * with a comparator that only looks at `translations`, `prefix` and `dir` — so a
 * changed `components` prop never reaches the DOM. Passing the selected chunk
 * down that way compiles, renders, and silently freezes: the chip opens the
 * passage but never shows itself as pressed, and nothing anywhere reports an
 * error.
 *
 * Context sidesteps it, because a context update re-renders consumers even when
 * a memoized ancestor declines to re-render. It also lets the `components` map
 * be a module-level constant with a stable identity, which is what the memo
 * wanted in the first place.
 */

type CitationContextValue = {
  sources: readonly ChatSource[];
  selectedChunkId: string | null;
  onSelect: (source: ChatSource) => void;
};

const CitationContext = createContext<CitationContextValue>({
  sources: [],
  selectedChunkId: null,
  onSelect: () => undefined,
});

export const CitationProvider = CitationContext.Provider;

export function useCitations(): CitationContextValue {
  return useContext(CitationContext);
}
