import { type RefObject, useEffect, useLayoutEffect, useRef } from "react";

type Kept = { anchor: number; focus: number };

/** Character offset of a DOM point within `root`'s text. */
function offsetIn(root: Node, node: Node, offset: number) {
  const range = document.createRange();
  range.setStart(root, 0);
  range.setEnd(node, offset);
  return range.toString().length;
}

function pointAt(root: Node, offset: number): [Node, number] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let passed = 0;
  let last: Node | null = null;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const length = node.textContent?.length ?? 0;
    if (passed + length >= offset) return [node, offset - passed];
    passed += length;
    last = node;
  }
  return last ? [last, last.textContent?.length ?? 0] : [root, 0];
}

/** Where the selection sits in `root`'s text, or null if it is not inside it. */
function offsetsOf(root: Node, selection: Selection): Kept | null {
  const { anchorNode, focusNode } = selection;
  if (!anchorNode || !focusNode) return null;
  if (!root.contains(anchorNode) || !root.contains(focusNode)) return null;

  return {
    anchor: offsetIn(root, anchorNode, selection.anchorOffset),
    focus: offsetIn(root, focusNode, selection.focusOffset),
  };
}

/**
 * React commits new text by replacing a text node's whole value, and the DOM
 * moves any selection boundary inside replaced text to its start: a selection
 * within the node collapses, one reaching into it loses its tail. Kept as
 * offsets, which a token changes only past its end.
 */
export function useKeptSelection(
  root: RefObject<HTMLElement | null>,
  text: string,
) {
  const kept = useRef<Kept | null>(null);

  useEffect(() => {
    const record = () => {
      const node = root.current;
      const selection = getSelection();
      kept.current =
        node && selection && !selection.isCollapsed
          ? offsetsOf(node, selection)
          : null;
    };

    document.addEventListener("selectionchange", record);
    return () => document.removeEventListener("selectionchange", record);
  }, [root]);

  useLayoutEffect(() => {
    const node = root.current;
    const selection = getSelection();
    const want = kept.current;
    if (!node || !selection || !want) return;

    const now = offsetsOf(node, selection);
    if (now?.anchor === want.anchor && now.focus === want.focus) return;

    selection.setBaseAndExtent(
      ...pointAt(node, want.anchor),
      ...pointAt(node, want.focus),
    );
  }, [root, text]);
}
