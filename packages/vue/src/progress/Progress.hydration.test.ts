import { describe, expect, test } from 'vitest';
import ProgressParts from '../../test/fixtures/ProgressParts.vue';
import { hydrate, renderOnServer, settle } from '../../test/render';

/** Renders the parts on the server, then hydrates them, and gives the server HTML of the root. */
async function renderAndHydrate(props: Record<string, unknown>) {
  const root = await renderOnServer('ProgressParts', props);
  const bar = root.querySelector('[role=progressbar]')!;
  const server = bar.cloneNode(true) as Element;
  hydrate(ProgressParts, props, root);
  await settle();
  return { root, bar, server };
}

describe('server render and hydration', () => {
  test.each([null, 30, 100])(
    'the server HTML of a root with a value of %s has the attributes, the text and the width',
    async (value) => {
      const { root, bar, server } = await renderAndHydrate({ root: { value } });
      const text = value === null ? '' : `${value}%`;
      for (const element of [server, bar]) {
        expect(element.getAttribute('aria-valuenow')).toBe(value === null ? null : String(value));
        expect(element.getAttribute('aria-valuetext')).toBe(value === null ? null : text);
        expect(element.querySelector('.value')!.textContent).toBe(text);
        expect(element.querySelector('.indicator')!.getAttribute('style')).toBe(
          value === null ? null : `inset-inline-start:0;height:inherit;width:${value}%;`,
        );
      }
      const status = value === null ? 'indeterminate' : value === 100 ? 'complete' : 'progressing';
      for (const part of root.querySelectorAll('[role=progressbar], [role=progressbar] *')) {
        expect(part).toHaveAttribute(`data-${status}`);
      }
    },
  );

  test('VUE-89: the server HTML of a root names its label that has no id', async () => {
    const { bar, server } = await renderAndHydrate({ root: { value: 30 } });
    const labelId = server.querySelector('.label')!.id;
    expect(labelId).not.toBe('');
    expect(server).toHaveAttribute('aria-labelledby', labelId);
    expect(bar).toHaveAttribute('aria-labelledby', labelId);
  });

  test('a label with an id names the root from the mount on', async () => {
    const { bar, server } = await renderAndHydrate({ root: { value: 30 }, label: { id: 'own' } });
    expect(server.getAttribute('aria-labelledby')).not.toBe('own');
    expect(bar).toHaveAttribute('aria-labelledby', 'own');
  });

  test('a root with no label has the generated id in the server HTML, and no aria-labelledby after the mount', async () => {
    const { bar, server } = await renderAndHydrate({
      root: { value: 30 },
      scene: { label: false },
    });
    expect(server.getAttribute('aria-labelledby')).not.toBeNull();
    expect(bar).not.toHaveAttribute('aria-labelledby');
  });

  test('the aria-label of the developer names a root with a label on both sides, with no aria-labelledby', async () => {
    const { bar, server } = await renderAndHydrate({
      root: { value: 30, 'aria-label': 'Storage' },
    });
    for (const element of [server, bar]) {
      expect(element).toHaveAttribute('aria-label', 'Storage');
      expect(element).not.toHaveAttribute('aria-labelledby');
    }
  });

  test('the text and aria-valuetext of a format and a locale agree on both sides', async () => {
    const format = { style: 'currency', currency: 'EUR' } as const;
    const { bar, server } = await renderAndHydrate({
      root: { value: 2000, min: 1000, max: 5000, locale: 'de-DE', format },
    });
    const text = new Intl.NumberFormat('de-DE', format).format(2000);
    for (const element of [server, bar]) {
      expect(element).toHaveAttribute('aria-valuetext', text);
      expect(element.querySelector('.value')!.textContent).toBe(text);
      expect(element.querySelector<HTMLElement>('.indicator')!.style.width).toBe('25%');
    }
  });
});
