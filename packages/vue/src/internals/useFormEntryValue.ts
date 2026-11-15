import { onActivated, shallowRef, watch } from 'vue';
import type { Ref } from 'vue';
import { addEventListener } from '../common/addEventListener';
import { isTextControl } from '../common/hydration';

// A disabled control, and a checkbox or a radio that is not checked, add no entry to a form.
const NO_ENTRY_SELECTOR =
  ':disabled, input:is([type="checkbox" i], [type="radio" i]):not(:checked)';

/**
 * Gives the value of `control` after a write of `value`. The function writes to a copy of
 * `control`. The value sanitization of a text input removes CR and LF, and a `<textarea>` changes
 * CR and CR LF to LF.
 */
export function sanitizeValue(
  control: HTMLInputElement | HTMLTextAreaElement,
  value: string,
): string {
  const copy = control.cloneNode(false) as HTMLInputElement | HTMLTextAreaElement;
  copy.value = value;
  return copy.value;
}

/**
 * Gives the form entry of `input` the value of the part, when the input has that value after the
 * value sanitization. Call it in `setup`.
 *
 * A text input removes CR and LF from its value, so the form gets other text than the value of
 * the part. Each submission and each `new FormData(form)` sends `formdata` to the form, and a
 * listener of that event can change the entries.
 * @param input The element of the control. A ref that a `ref` setter writes.
 * @param getValue Gives the value of the part as text.
 */
export function useFormEntryValue(
  input: Readonly<Ref<Element | null>>,
  getValue: () => string,
): void {
  function handleFormData(event: Event) {
    const element = input.value;
    if (!isTextControl(element)) {
      return;
    }

    const { form, name, value: text } = element;
    if (form === null || event.target !== form) {
      return;
    }

    const value = getValue();
    if (value === text || sanitizeValue(element, value) !== text) {
      return;
    }

    // An entry does not refer to its control. Each control in `controls` adds one entry, in the
    // order of the controls. The listener of another part can already have given its entry its
    // value, so the entries are compared after the sanitization. A disabled input of the part is
    // not in `controls`. An input with no name adds no entry, so the counts below differ.
    const controls = Array.from(form.elements).filter(
      (control) =>
        isTextControl(control) &&
        control.name === name &&
        !control.matches(NO_ENTRY_SELECTOR) &&
        sanitizeValue(element, control.value) === text,
    );
    const { formData } = event as FormDataEvent;
    const entries = Array.from(formData);
    const places = entries.flatMap(([key, entry], index) =>
      key === name && typeof entry === 'string' && sanitizeValue(element, entry) === text
        ? [index]
        : [],
    );
    // Another control, such as a `<select>`, or a listener of the consumer can add or remove such
    // an entry. The entry of the input is then not certain.
    const index = places.length === controls.length ? places[controls.indexOf(element)] : undefined;
    if (index === undefined) {
      return;
    }

    // FormData has no write at a place, so the list is written again in its order.
    entries[index] = [name, value];
    for (const [key] of entries) {
      formData.delete(key);
    }
    for (const [key, entry] of entries) {
      formData.append(key, entry);
    }
  }

  // `KeepAlive` mounts a part in a held branch in an element outside the document. It moves the
  // element into the document at the next show, and it calls no `ref` setter.
  const rootNode = shallowRef<Node | null>(null);
  function readRootNode() {
    rootNode.value = input.value?.getRootNode() ?? null;
  }
  watch(input, readRootNode, { flush: 'post' });
  onActivated(readRootNode);

  watch(
    rootNode,
    (node, _previous, onCleanup) => {
      if (node === null) {
        return;
      }

      // A `formdata` event does not leave a shadow root, so the listener is on the root node. In the
      // capture phase, it changes the entry before the listeners of the consumer on the form.
      onCleanup(addEventListener(node, 'formdata', handleFormData, { capture: true }));
    },
    { flush: 'sync' },
  );
}
