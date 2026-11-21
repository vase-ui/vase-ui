// Measurements with native elements, with no code of the library. Each one states what the
// browser does with `role="switch"` on a native checkbox, so that `Switch` has code only where
// the browser does not do it. The measurements of a native checkbox in `checkbox.test.ts` hold
// for the same element: the write-back after a refused change, a reset, and read-only.
import { afterEach, describe, expect, test } from 'vitest';
import { server, userEvent } from 'vitest/browser';
import { byName, chromiumNodes, propertyOf } from '../accessibilityTree';

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

describe('a native checkbox with role="switch"', () => {
  // Playwright reads the accessibility tree of Chromium only. Its role queries compute a role
  // of their own, so they measure no browser.
  test.runIf(server.browser === 'chromium')(
    'has the role switch and the checked state of the input in the accessibility tree of Chromium, with no aria-checked',
    async () => {
      html(`<label>Wifi <input type="checkbox" role="switch" checked></label>
        <label>Sound <input type="checkbox" role="switch"></label>`);
      const nodes = await chromiumNodes();
      const found = ['Wifi', 'Sound'].map((name) => {
        const node = byName(nodes, name);
        return { role: node?.role?.value, checked: propertyOf(node, 'checked') };
      });
      expect(found).toEqual([
        { role: 'switch', checked: 'true' },
        { role: 'switch', checked: 'false' },
      ]);
    },
  );

  test('changes one time at Space, at a click on its label and at click() from a script, and not at Enter', async () => {
    html('<label>Wifi <input type="checkbox" role="switch"></label>');
    const input = root!.querySelector('input')!;
    const changes: boolean[] = [];
    input.addEventListener('change', () => changes.push(input.checked));
    input.focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    await userEvent.click(root!.querySelector('label')!);
    input.click();
    expect(changes).toEqual([true, false, true]);
  });
});
