// The input types of a field that blocks the implicit submission of a form (HTML Standard).
const blocksImplicitSubmission = new Set([
  'text',
  'search',
  'tel',
  'url',
  'email',
  'password',
  'date',
  'month',
  'week',
  'time',
  'datetime-local',
  'number',
]);

/**
 * Does the implicit submission of Enter in one text field, for a part whose inputs are more than
 * one field for the browser. With a submit button, the browser clicks it. With none, the form
 * submits when no input other than `own` blocks the implicit submission. Call it in the `keydown`
 * listener of the input.
 */
export function submitAtEnter(event: KeyboardEvent, own: readonly (Element | null)[]) {
  const { form } = event.currentTarget as HTMLInputElement;
  // A later listener, of the input or of an ancestor, can still prevent the key, as for one text
  // input. So the part waits for the end of the event.
  setTimeout(() => {
    if (!form || event.defaultPrevented) return;
    // `form.elements` has no image button (HTML Standard), and the browser clicks one too.
    const root = form.getRootNode() as ParentNode;
    const images = root.querySelectorAll<HTMLInputElement>('input[type=image]');
    if ([...images].some((image) => image.form === form)) return;
    for (const element of form.elements) {
      const { type } = element as HTMLInputElement;
      if (type === 'submit') return;
      if (
        element.localName === 'input' &&
        blocksImplicitSubmission.has(type) &&
        !own.includes(element)
      ) {
        return;
      }
    }
    form.requestSubmit();
  });
}
