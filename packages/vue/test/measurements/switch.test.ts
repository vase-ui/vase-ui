// Measurements with native elements, with no code of the library. Each one states what the
// browser does with `role="switch"` on a native checkbox, so that `Switch` has code only where
// the browser does not do it. The measurements of a native checkbox in `checkbox.test.ts` hold
// for the same element: the write-back after a refused change, a reset, and read-only.
import { afterEach, describe, expect, test } from 'vitest';
import { cdp, server, userEvent } from 'vitest/browser';

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

type AXNode = {
  role?: { value: string };
  name?: { value: string };
  properties?: { name: string; value: { value: unknown } }[];
};

/** The nodes of the accessibility tree of Chromium, in each frame, by their name. */
async function chromiumNodes(names: string[]) {
  const session = cdp();
  await session.send('Accessibility.enable');
  const { frameTree } = (await session.send('Page.getFrameTree')) as { frameTree: FrameTree };
  const found: Record<string, { role?: string; checked?: unknown }> = {};
  const visit = async (tree: FrameTree) => {
    const { nodes } = (await session.send('Accessibility.getFullAXTree', {
      frameId: tree.frame.id,
    })) as { nodes: AXNode[] };
    for (const node of nodes) {
      const name = node.name?.value ?? '';
      if (names.includes(name)) {
        const checked = node.properties?.find((property) => property.name === 'checked');
        found[name] = { role: node.role?.value, checked: checked?.value.value };
      }
    }
    for (const child of tree.childFrames ?? []) await visit(child);
  };
  await visit(frameTree);
  return found;
}

type FrameTree = { frame: { id: string }; childFrames?: FrameTree[] };

describe('a native checkbox with role="switch"', () => {
  // Playwright reads the accessibility tree of Chromium only. Its role queries compute a role
  // of their own, so they measure no browser.
  test.runIf(server.browser === 'chromium')(
    'has the role switch and the checked state of the input in the accessibility tree of Chromium, with no aria-checked',
    async () => {
      html(`<label>Wifi <input type="checkbox" role="switch" checked></label>
        <label>Sound <input type="checkbox" role="switch"></label>`);
      expect(await chromiumNodes(['Wifi', 'Sound'])).toEqual({
        Wifi: { role: 'switch', checked: 'true' },
        Sound: { role: 'switch', checked: 'false' },
      });
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
