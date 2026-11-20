import { describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick } from 'vue';
import NumberFieldInField from '../../test/fixtures/NumberFieldInField.vue';
import NumberFields from '../../test/fixtures/NumberFields.vue';
import { mockRuntimeLocale } from '../../test/mockRuntimeLocale';
import { hydrate, renderOnServer, settle } from '../../test/render';

/** The attributes of the parts that the server writes and the hydration keeps. */
function readParts(root: Element) {
  const read = (selector: string, names: string[]) => {
    const element = root.querySelector(selector)!;
    return Object.fromEntries(names.map((name) => [name, element.getAttribute(name)]));
  };
  return {
    input: read('[role=spinbutton]', [
      'id',
      'value',
      'inputmode',
      'aria-valuenow',
      'aria-valuetext',
      'aria-valuemin',
      'aria-valuemax',
      'aria-describedby',
      'disabled',
      'readonly',
      'required',
    ]),
    hidden: read('[type=number]', ['name', 'value', 'min', 'max', 'step', 'disabled']),
    root: read('[role=spinbutton]', ['data-filled', 'data-disabled']),
  };
}

describe('server render and hydration', () => {
  test('the server HTML has the text in en-US, the values and the constraints, with no mismatch; a visitor with another locale sees the same text', async () => {
    mockRuntimeLocale('de-DE');
    const props = { root: { name: 'amount', min: 0, max: 5000, step: 0.5, defaultValue: 1234.5 } };
    const root = await renderOnServer('NumberFields', props);
    const server = readParts(root);
    expect(server.input).toMatchObject({
      id: 'amount',
      value: '1,234.5',
      inputmode: 'numeric',
      'aria-valuenow': '1234.5',
      'aria-valuetext': '1,234.5',
      'aria-valuemin': '0',
      'aria-valuemax': '5000',
    });
    expect(server.hidden).toEqual({
      name: 'amount',
      value: '1234.5',
      min: '0',
      max: '5000',
      step: '0.5',
      disabled: null,
    });
    hydrate(NumberFields, props, root);
    await nextTick();
    expect(readParts(root)).toEqual(server);
    const input = root.querySelector<HTMLInputElement>('[role=spinbutton]')!;
    expect(input.value).toBe('1,234.5');
    // The buttons name the input after the hydration.
    expect(root.querySelector('[aria-label=Increase]')).toHaveAttribute('aria-controls', 'amount');
    input.focus();
    await userEvent.keyboard('{ArrowUp}');
    expect(input.value).toBe('1,235');
  });

  test('the server HTML of a disabled, read-only and required field has the native attributes and the data attributes', async () => {
    const props = { root: { disabled: true, readonly: true, required: true } };
    const root = await renderOnServer('NumberFields', props);
    const input = root.querySelector('[role=spinbutton]')!;
    expect(input.matches(':disabled:read-only:required')).toBe(true);
    expect(root.querySelector('[type=number]:disabled')).not.toBeNull();
    expect(root.querySelector('[aria-label=Increase]:disabled')).not.toBeNull();
    const field = root.querySelector('#form > div')!;
    for (const name of ['data-disabled', 'data-readonly', 'data-required']) {
      expect(field).toHaveAttribute(name, '');
    }
    hydrate(NumberFields, props, root);
    await nextTick();
  });

  test('a locale gives the same text on the server and in the browser', async () => {
    const props = { root: { locale: 'de-DE', defaultValue: 1234.5 } };
    const root = await renderOnServer('NumberFields', props);
    const input = root.querySelector<HTMLInputElement>('[role=spinbutton]')!;
    expect(input).toHaveAttribute('value', '1.234,5');
    hydrate(NumberFields, props, root);
    await nextTick();
    expect(input.value).toBe('1.234,5');
  });

  test.each([
    { order: 'before the field', partsAfter: false },
    { order: 'after the field', partsAfter: true },
  ])(
    'a label and a description $order name and describe the input in the server HTML',
    async ({ partsAfter }) => {
      const props = { partsAfter, root: { defaultValue: 1 } };
      const root = await renderOnServer('NumberFieldInField', props);
      const input = root.querySelector('[role=spinbutton]')!;
      const serverId = input.id;
      expect(serverId).not.toBe('');
      expect(root.querySelector('label')).toHaveAttribute('for', serverId);
      expect(input).toHaveAttribute('aria-describedby', 'description');
      hydrate(NumberFieldInField, props, root);
      await settle();
      expect(input.id).toBe(serverId);
      expect(input).toHaveAttribute('aria-describedby', 'description');
    },
  );
});
