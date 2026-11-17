// eslint-disable-next-line no-restricted-imports -- Only a render function reads the vnodes of a slot without a mount. An SFC mounts each slot that it renders.
import { defineComponent } from 'vue';
import {
  Comment,
  Fragment,
  h,
  isVNode,
  onBeforeUnmount,
  onMounted,
  onUpdated,
  Static,
  Teleport,
  Text,
} from 'vue';
import type { PropType } from 'vue';
import { ownerDocument } from '../../common/owner';

// The text of the vnodes of a slot: text vnodes, and the children of element and fragment vnodes.
// A component keeps its content in its own slots. A scoped slot can need props that a call here
// does not give, so the text of a component is empty.
// The result is `undefined` when a vnode gives its text only at a mount. The slot of a Vapor
// component is such a vnode: it holds a function, and only a mount gives its nodes. Vue 3.5 does
// not export the symbol of its type, so the test is for a symbol that is not `Fragment`, `Text`,
// `Comment` or `Static`.
function slotText(node: unknown): string | undefined {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }
  if (Array.isArray(node)) {
    let text = '';
    for (const child of node) {
      const childText = slotText(child);
      if (childText === undefined) {
        return undefined;
      }
      text += childText;
    }
    return text;
  }
  if (!isVNode(node) || node.type === Comment || node.type === Static) {
    return '';
  }
  if (typeof node.type === 'string' || node.type === Fragment || node.type === Text) {
    return slotText(node.children);
  }
  // Each other vnode is a component, or has a type that is a symbol.
  return typeof node.type === 'symbol' ? undefined : '';
}

/**
 * Reads the text of the default slot of an item that the query hides.
 * The item has no element then, so it cannot read the text from the DOM. A slot is a function
 * that a render must call, so this component calls it in its own render. Vue then renders it again
 * when a value that the slot reads changes.
 *
 * A virtual DOM slot gives vnodes. The component reads their text and renders nothing.
 * The slot of a Vapor component gives its nodes only at a mount. The component mounts that slot in
 * an element that is not in the document, and reads the text of the element.
 * The filter matches the `label` of an item that has one, so the component does not mount the slot
 * of such an item. It still gives the text of the vnodes of that item. The item can then tell that
 * its content changed when its `label` becomes `undefined`.
 *
 * @internal
 */
export const FilterDropdownHiddenItemText = defineComponent({
  name: 'FilterDropdownHiddenItemText',
  props: {
    setText: { type: Function as PropType<(text: string) => void>, required: true },
    /** The `label` prop of the item. */
    label: { type: String, default: undefined },
  },
  setup(props, { slots }) {
    // `undefined` while the slot has a vnode that gives its text only at a mount.
    let text: string | undefined = '';
    let mountElement: HTMLElement | undefined;
    let observer: MutationObserver | undefined;

    function stopObserver() {
      observer?.disconnect();
      observer = undefined;
    }

    function giveText() {
      if (text !== undefined) {
        stopObserver();
        props.setText(text);
        return;
      }
      const element = mountElement;
      if (props.label != null || element === undefined) {
        stopObserver();
        return;
      }
      if (observer === undefined) {
        // A Vapor slot changes its nodes with no render of this component.
        observer = new MutationObserver(() => props.setText(element.textContent ?? ''));
        observer.observe(element, { subtree: true, childList: true, characterData: true });
      }
      props.setText(element.textContent ?? '');
    }

    onMounted(giveText);
    onUpdated(giveText);
    onBeforeUnmount(stopObserver);

    return () => {
      // eslint-disable-next-line no-restricted-syntax -- The call is in a render function, so Vue gives no warning and renders this component again when the slot reads a changed value.
      const nodes = slots.default?.();
      text = slotText(nodes);
      if (nodes === undefined || text !== undefined || props.label != null) {
        return null;
      }
      // Vue makes each node in the global document, so this element is in that document too.
      mountElement ??= ownerDocument(null).createElement('div');
      return h(Teleport, { to: mountElement }, nodes);
    };
  },
});
