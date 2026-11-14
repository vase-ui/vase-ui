// eslint-disable-next-line no-restricted-imports -- Only a render function reads the vnodes of a slot without rendering them. A slot of Vapor mode gives DOM nodes, and it mounts the components of the slot.
import { Comment, defineComponent, isVNode, onMounted, onUpdated, Static } from 'vue';
import type { PropType } from 'vue';

// The text of the vnodes of a slot: text vnodes, and the children of element and fragment vnodes.
// A component keeps its content in its own slots. A scoped slot can need props that a call here
// does not give, so the text of a component is empty.
function slotText(node: unknown): string {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(slotText).join('');
  }
  if (!isVNode(node) || node.type === Comment || node.type === Static) {
    return '';
  }
  if (typeof node.type === 'object' || typeof node.type === 'function') {
    return '';
  }
  return slotText(node.children);
}

/**
 * Reads the text of the default slot of a filtered-out item and renders nothing.
 * The item has no element then, so it cannot read the text from the DOM. A slot is a function
 * that a render must call, so this component calls it in its own render. Vue then renders it again
 * when a value that the slot reads changes.
 *
 * @internal
 */
export const FilterDropdownHiddenItemText = defineComponent({
  name: 'FilterDropdownHiddenItemText',
  props: {
    setText: { type: Function as PropType<(text: string) => void>, required: true },
  },
  setup(props, { slots }) {
    let text = '';
    onMounted(() => props.setText(text));
    onUpdated(() => props.setText(text));

    return () => {
      // eslint-disable-next-line no-restricted-syntax -- The call is in a render function, so Vue gives no warning and renders this component again when the slot reads a changed value.
      text = slotText(slots.default?.());
      return null;
    };
  },
});
