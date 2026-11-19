// Measurements with native elements and plain Vue, with no code of the library. Each one states
// what the browser or Vue does, so that a part has code only where they do not do it.
import { afterEach, describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import MeasureControlledCheckbox from '../fixtures/MeasureControlledCheckbox.vue';
import { hydrate, mount, renderOnServer, settle } from '../render';

let root: HTMLElement | undefined;

function html(markup: string) {
  root = document.body.appendChild(document.createElement('div'));
  root.innerHTML = markup;
  return root;
}

afterEach(() => {
  root?.remove();
  root = undefined;
});

function mountBox(model: { checked: boolean; indeterminate: boolean; accept: boolean }) {
  const mounted = mount(MeasureControlledCheckbox, { model }).root;
  return { form: mounted.querySelector('form')!, box: mounted.querySelector('input')! };
}

describe('a native checkbox with :checked and :indeterminate', () => {
  test('stays checked after a click that its listener does not write to the model', async () => {
    const model = reactive({ checked: false, indeterminate: false, accept: false });
    const { box } = mountBox(model);
    box.click();
    await settle();
    expect(model.checked).toBe(false);
    expect(box.checked).toBe(true);
  });

  test('loses the indeterminate property at a click, and a prop that stays true does not set it again', async () => {
    const model = reactive({ checked: false, indeterminate: true, accept: true });
    const { box } = mountBox(model);
    await nextTick();
    expect(box.indeterminate).toBe(true);
    box.click();
    await settle();
    expect(model.indeterminate).toBe(true);
    expect(box.indeterminate).toBe(false);
  });

  test('gets the checked attribute at each value from :checked, so a reset gives the last value', async () => {
    const model = reactive({ checked: true, indeterminate: false, accept: true });
    const { form, box } = mountBox(model);
    await nextTick();
    expect(box.hasAttribute('checked')).toBe(true);
    model.checked = false;
    await nextTick();
    expect(box.hasAttribute('checked')).toBe(false);
    box.checked = true;
    form.reset();
    expect(box.checked).toBe(false);
  });

  test('has an indeterminate attribute in the server HTML that :indeterminate does not match, and gets the property at the hydration', async () => {
    const props = { model: { checked: false, indeterminate: true, accept: false } };
    const rendered = await renderOnServer('MeasureControlledCheckbox', props);
    const box = rendered.querySelector('input')!;
    expect(box.hasAttribute('indeterminate')).toBe(true);
    expect(box.matches(':indeterminate')).toBe(false);
    hydrate(MeasureControlledCheckbox, props, rendered);
    await nextTick();
    expect(box.indeterminate).toBe(true);
  });
});

describe('a native checkbox', () => {
  test('keeps its state and fires no change when a click listener prevents the default, also from a label and Space', async () => {
    html('<label>Box <input type="checkbox" id="box"></label>');
    const box = root!.querySelector('input')!;
    box.indeterminate = true;
    const changes: boolean[] = [];
    box.addEventListener('click', (event) => event.preventDefault());
    box.addEventListener('change', () => changes.push(box.checked));
    box.click();
    await userEvent.click(root!.querySelector('label')!);
    box.focus();
    await userEvent.keyboard(' ');
    expect(box.checked).toBe(false);
    expect(box.indeterminate).toBe(true);
    expect(changes).toEqual([]);
  });

  test('with aria-readonly, still blocks the submit of its form while it is required and unchecked', () => {
    html('<form><input type="checkbox" required aria-readonly="true"></form>');
    const box = root!.querySelector('input')!;
    expect(box.willValidate).toBe(true);
    expect(box.validity.valueMissing).toBe(true);
    expect(root!.querySelector('form')!.checkValidity()).toBe(false);
  });

  test('gives one reset event to the listener of each checkbox of a form', () => {
    html('<form><input type="checkbox"><input type="checkbox"></form>');
    const form = root!.querySelector('form')!;
    const events: Event[] = [];
    for (const _ of root!.querySelectorAll('input')) {
      form.addEventListener('reset', (event) => events.push(event));
    }
    form.reset();
    expect(events).toHaveLength(2);
    expect(events[0]).toBe(events[1]);
  });

  test('gets no change or input event from a reset', () => {
    html('<form><input type="checkbox" checked></form>');
    const box = root!.querySelector('input')!;
    const events: string[] = [];
    box.addEventListener('change', () => events.push('change'));
    box.addEventListener('input', () => events.push('input'));
    box.checked = false;
    root!.querySelector('form')!.reset();
    expect(box.checked).toBe(true);
    expect(events).toEqual([]);
  });

  test('changes and fires change although a click listener stops the propagation', () => {
    html('<input type="checkbox">');
    const box = root!.querySelector('input')!;
    const changes: boolean[] = [];
    box.addEventListener('click', (event) => event.stopPropagation());
    box.addEventListener('change', () => changes.push(box.checked));
    box.click();
    expect(changes).toEqual([true]);
  });

  test('changes one time at Space, and not at Enter; the change listeners have run when click() returns', async () => {
    html('<input type="checkbox">');
    const box = root!.querySelector('input')!;
    const changes: boolean[] = [];
    box.addEventListener('change', () => changes.push(box.checked));
    box.focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    expect(changes).toEqual([true]);
    box.click();
    expect(changes).toEqual([true, false]);
  });

  // WebKit on macOS moves no focus to a checkbox with Tab, so the focus moves by script here.
  test('gives the next checkbox as relatedTarget of focusout when the focus moves between two', () => {
    html('<div><input type="checkbox" id="a"><input type="checkbox" id="b"></div>');
    const targets: (string | null)[] = [];
    root!.querySelector('div')!.addEventListener('focusout', (event) => {
      targets.push((event.relatedTarget as Element | null)?.id ?? null);
    });
    root!.querySelector<HTMLInputElement>('#a')!.focus();
    root!.querySelector<HTMLInputElement>('#b')!.focus();
    root!.querySelector<HTMLInputElement>('#b')!.blur();
    expect(targets).toEqual(['b', null]);
  });
});
