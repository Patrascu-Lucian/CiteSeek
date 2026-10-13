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

/**
 * React commits new text by replacing a text node's whole value, and the DOM
 * collapses a selection inside replaced text, so one made mid-stream was lost at
 * the next token. Kept as offsets, which a token changes only past its end.
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
      const { anchorNode, focusNode } = selection ?? {};
      kept.current =
        node &&
        selection &&
        !selection.isCollapsed &&
        anchorNode &&
        focusNode &&
        node.contains(anchorNode) &&
        node.contains(focusNode)
          ? {
              anchor: offsetIn(node, anchorNode, selection.anchorOffset),
              focus: offsetIn(node, focusNode, selection.focusOffset),
            }
          : null;
    };

    document.addEventListener("selectionchange", record);
    return () => document.removeEventListener("selectionchange", record);
  }, [root]);

  useLayoutEffect(() => {
    const node = root.current;
    const selection = getSelection();
    if (!node || !selection?.isCollapsed || !kept.current) return;

    selection.setBaseAndExtent(
      ...pointAt(node, kept.current.anchor),
      ...pointAt(node, kept.current.focus),
    );
  }, [root, text]);
}
