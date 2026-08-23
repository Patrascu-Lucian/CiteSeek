import { createContext, useContext } from "react";

import type { ChatSource } from "@/lib/ai/types";

/**
 * Context, not props: `Streamdown` wraps its output in `React.memo` with a
 * comparator reading only `translations`, `prefix` and `dir`, so a changed
 * `components` prop never reaches the DOM. Passing the selection down compiles
 * and silently freezes — the chip opens the passage and never shows as pressed.
 * A context update re-renders consumers past a memoized ancestor.
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
