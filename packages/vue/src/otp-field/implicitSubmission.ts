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
 * submits when no input other than `own` blocks the implicit submission.
 */
export function submitImplicitly(form: HTMLFormElement, own: readonly Element[]) {
  // `form.elements` has no image button (HTML Standard), and the browser clicks one too.
  const root = form.getRootNode() as ParentNode;
  const images = root.querySelectorAll<HTMLInputElement>('input[type=image]');
  if ([...images].some((image) => image.form === form)) return;
  for (const element of form.elements) {
    const type = (element as HTMLInputElement).type;
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
}
