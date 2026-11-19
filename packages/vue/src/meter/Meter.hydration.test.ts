import { describe, expect, test } from 'vitest';
import { nextTick } from 'vue';
import MeterParts from '../../test/fixtures/MeterParts.vue';
import { hydrate, renderOnServer } from '../../test/render';

/** The attributes that the root writes, and the text and the width that the parts show. */
function readMeter(root: Element) {
  const meter = root.querySelector('[role=meter]')!;
  return {
    meter,
    attributes: Object.fromEntries(
      ['aria-valuemin', 'aria-valuemax', 'aria-valuenow', 'aria-valuetext'].map((name) => [
        name,
        meter.getAttribute(name),
      ]),
    ),
    text: meter.querySelector('[aria-hidden]')!.textContent,
    width: meter.querySelector<HTMLElement>('[style]')!.style.width,
  };
}

describe('server render and hydration', () => {
  test('VUE-89: the server HTML has the values, the text, the width, and the name that a label gives', async () => {
    const props = { parts: { root: { value: 30 } } };
    const root = await renderOnServer('MeterParts', props);
    const server = readMeter(root);
    const label = root.querySelector('span[id]')!;
    expect(server.attributes).toEqual({
      'aria-valuemin': '0',
      'aria-valuemax': '100',
      'aria-valuenow': '30',
      'aria-valuetext': '30%',
    });
    expect(server.text).toBe('30%');
    expect(server.width).toBe('30%');
    expect(label.id).not.toBe('');
    expect(server.meter).toHaveAttribute('aria-labelledby', label.id);
    hydrate(MeterParts, props, root);
    await nextTick();
    expect(readMeter(root)).toEqual(server);
    expect(server.meter).toHaveAttribute('aria-labelledby', label.id);
  });

  test('a locale and a format give the same text on the server and in the browser', async () => {
    const format: Intl.NumberFormatOptions = { style: 'currency', currency: 'EUR' };
    const props = {
      parts: { root: { value: 2000, min: 1000, max: 5000, locale: 'de-DE', format } },
    };
    const root = await renderOnServer('MeterParts', props);
    const server = readMeter(root);
    const text = new Intl.NumberFormat('de-DE', format).format(2000);
    expect(server.text).toBe(text);
    expect(server.attributes['aria-valuetext']).toBe(text);
    expect(server.width).toBe('25%');
    hydrate(MeterParts, props, root);
    await nextTick();
    expect(readMeter(root)).toEqual(server);
  });

  test.each([
    { name: 'a label with an id', parts: { label: { id: 'own' } }, server: 'made', after: 'own' },
    { name: 'no label and no name', parts: { label: null }, server: 'made', after: null },
    {
      name: 'an aria-label',
      parts: { root: { 'aria-label': 'Charge' }, label: null },
      server: null,
      after: null,
    },
    {
      name: 'an aria-label and a label',
      parts: { root: { 'aria-label': 'Charge' } },
      server: null,
      after: null,
    },
  ])('a root with $name hydrates with no message', async ({ parts, server, after }) => {
    const root = await renderOnServer('MeterParts', { parts });
    const meter = root.querySelector('[role=meter]')!;
    const labelledBy = meter.getAttribute('aria-labelledby');
    if (server === 'made') {
      // The id that the root made names no element until the mount.
      expect(labelledBy).not.toBeNull();
      expect(root.querySelector(`[id="${labelledBy}"]`)).toBeNull();
    } else {
      expect(labelledBy).toBeNull();
    }
    hydrate(MeterParts, { parts }, root);
    await nextTick();
    expect(meter.getAttribute('aria-labelledby')).toBe(after);
  });
});
