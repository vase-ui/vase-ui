// Measurements with native elements, with no code of the library. Each one states what the
// browser does, so that a part has code only where it does not do it.
import { expect, test } from 'vitest';

test('form.elements lists the controls of a form in the order of the document', () => {
  const root = document.body.appendChild(document.createElement('div'));
  try {
    root.innerHTML = `
      <input form="f" name="before">
      <form id="f">
        <input name="disabled" disabled>
        <fieldset disabled><input name="in-disabled-fieldset"></fieldset>
        <input name="held">
      </form>
      <input form="f" name="after">
      <form id="g"><input form="f" name="given"><input name="other"></form>`;
    root.querySelector('[name=held]')!.remove();
    const form = root.querySelector<HTMLFormElement>('#f')!;
    const names = [...form.elements].map((element) => (element as HTMLInputElement).name);
    expect(names.filter(Boolean)).toEqual([
      'before',
      'disabled',
      'in-disabled-fieldset',
      'after',
      'given',
    ]);
  } finally {
    root.remove();
  }
});
