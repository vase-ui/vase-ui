// Measurements with native elements and plain Vue, with no code of the library. Each one states
// what the browser or Vue does, so that a part has code only where they do not do it.
import { afterEach, describe, expect, test } from 'vitest';
import { nextTick, reactive } from 'vue';
import MeasureFieldsetToggle from '../fixtures/MeasureFieldsetToggle.vue';
import { mount, settle } from '../render';

let root: HTMLElement;

function html(markup: string) {
  root = document.body.appendChild(document.createElement('div'));
  root.innerHTML = markup;
  return root;
}

afterEach(() => root?.remove());

describe('a disabled fieldset', () => {
  test(':disabled matches a fieldset that a disabled fieldset holds, but not one in its first legend', () => {
    html(`
      <fieldset disabled><div><fieldset id="nested"><input id="in-nested"></fieldset></div></fieldset>
      <fieldset disabled><legend><fieldset id="in-legend"></fieldset></legend></fieldset>
      <fieldset disabled><legend>A</legend><legend><fieldset id="in-second-legend"></fieldset></legend></fieldset>`);
    const disabled = (id: string) => root.querySelector(`#${id}`)!.matches(':disabled');
    expect(disabled('nested')).toBe(true);
    expect(disabled('in-nested')).toBe(true);
    expect(disabled('in-legend')).toBe(false);
    expect(disabled('in-second-legend')).toBe(true);
  });

  test('takes its controls out of constraint validation and out of the FormData', () => {
    html(
      `<form><fieldset disabled><input name="a" required></fieldset><input name="b" value="b"></form>`,
    );
    const form = root.querySelector('form')!;
    expect(root.querySelector<HTMLInputElement>('[name=a]')!.willValidate).toBe(false);
    expect(form.checkValidity()).toBe(true);
    expect([...new FormData(form).keys()]).toEqual(['b']);
  });

  test('renders no component again when it becomes disabled', async () => {
    const scene = reactive({ disabled: false });
    const { root: mounted } = mount(MeasureFieldsetToggle, { scene });
    await nextTick();
    const shown = () => mounted.querySelector('.shown')!.textContent;
    expect(shown()).toBe('false');
    scene.disabled = true;
    await settle();
    expect(mounted.querySelector('input')!.matches(':disabled')).toBe(true);
    expect(shown()).toBe('false');
  });
});
