// Measurements with native elements and plain Vue, with no code of the library. Each one states
// what the browser or Vue does, so that a part has code only where they do not do it.
import { afterEach, describe, expect, test } from 'vitest';
import { server } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import { chromiumNodes } from '../accessibilityTree';
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

describe('a legend', () => {
  // The CSS of the demo of Fieldset.
  const css = `<style>
    .Fieldset { border: 0; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 1rem; width: 16rem; }
    .Legend { border-bottom: 1px solid; padding: 0; font-size: 1rem; line-height: 1.5rem; }
    .Field { display: flex; flex-direction: column; gap: 0.25rem; }
  </style>`;

  test('a <legend> is not a flex item of its fieldset: no gap follows it, and in Chromium and Firefox it is as wide as its text; a <div> is', () => {
    const measure = (tag: string) => {
      html(`${css}<fieldset class="Fieldset"><${tag} class="Legend">Billing details</${tag}>
        <div class="Field"><label>Company <input></label></div></fieldset>`);
      const legend = root.querySelector('.Legend')!.getBoundingClientRect();
      const field = root.querySelector('.Field')!.getBoundingClientRect();
      root.remove();
      return { width: Math.round(legend.width), gap: Math.round(field.top - legend.bottom) };
    };
    const legend = measure('legend');
    expect(legend.gap).toBe(0);
    if (server.browser === 'webkit') {
      expect(legend.width).toBe(256);
    } else {
      expect(legend.width).toBeLessThan(128);
    }
    expect(measure('div')).toEqual({ width: 256, gap: 16 });
  });

  // Playwright reads the accessibility tree of Chromium only.
  test.runIf(server.browser === 'chromium')(
    'a fieldset takes its name from aria-labelledby that names a <div>, and from no <legend> in a wrapper; aria-labelledby wins over aria-label',
    async () => {
      html(`
        <fieldset aria-labelledby="div"><div id="div">By a div</div></fieldset>
        <fieldset><div><legend>In a wrapper</legend></div></fieldset>
        <fieldset aria-labelledby="native"><legend id="native">By a legend</legend></fieldset>
        <fieldset aria-labelledby="both" aria-label="By aria-label"><div id="both">By aria-labelledby</div></fieldset>`);
      expect(await chromiumGroupNames()).toEqual([
        'By a div',
        '',
        'By a legend',
        'By aria-labelledby',
      ]);
    },
  );
});

/** The names of the groups in the accessibility tree of Chromium. */
async function chromiumGroupNames() {
  const nodes = await chromiumNodes();
  return nodes.filter((node) => node.role?.value === 'group').map((node) => node.name?.value ?? '');
}
