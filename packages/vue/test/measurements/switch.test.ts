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

  test.runIf(server.browser === 'chromium')(
    'with aria-readonly, has no readonly or disabled property in the accessibility tree of Chromium; with aria-disabled, has disabled and focusable',
    async () => {
      html(`<label>ReadOnly <input type="checkbox" role="switch" aria-readonly="true"></label>
        <label>AriaDisabled <input type="checkbox" role="switch" aria-disabled="true"></label>`);
      const nodes = await chromiumNodes();
      const found = ['ReadOnly', 'AriaDisabled'].map((name) => {
        const node = byName(nodes, name);
        return {
          role: node?.role?.value,
          readonly: propertyOf(node, 'readonly') ?? false,
          disabled: propertyOf(node, 'disabled') ?? false,
          focusable: propertyOf(node, 'focusable') ?? false,
        };
      });
      expect(found).toEqual([
        { role: 'switch', readonly: false, disabled: false, focusable: true },
        { role: 'switch', readonly: false, disabled: true, focusable: true },
      ]);
    },
  );

  test('loses the focus to body when disabled is set, and keeps it with aria-disabled', async () => {
    html(`<input type="checkbox" role="switch" id="native">
      <input type="checkbox" role="switch" id="aria">`);
    const native = root!.querySelector<HTMLInputElement>('#native')!;
    const aria = root!.querySelector<HTMLInputElement>('#aria')!;
    const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
    native.focus();
    native.disabled = true;
    await nextFrame();
    await nextFrame();
    const afterNative = document.activeElement?.tagName;
    aria.focus();
    aria.setAttribute('aria-disabled', 'true');
    await nextFrame();
    await nextFrame();
    expect([afterNative, document.activeElement?.id]).toEqual(['BODY', 'aria']);
  });

  test('a press on a native disabled switch gives pointer events and no mouse or click events; a click on its label sends no click to the switch', async () => {
    html(
      '<div id="ancestor"><label id="label">Wifi <input type="checkbox" role="switch" id="sw" disabled></label></div>',
    );
    const ancestor = root!.querySelector('#ancestor')!;
    const label = root!.querySelector('#label')!;
    const input = root!.querySelector<HTMLInputElement>('#sw')!;
    const log: string[] = [];
    for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
      ancestor.addEventListener(type, () => log.push(`${type} capture`), true);
      ancestor.addEventListener(type, () => log.push(`${type} ancestor`));
      input.addEventListener(type, () => log.push(`${type} input`));
    }
    await userEvent.click(input, { force: true });
    const direct = [...log];
    log.length = 0;
    await userEvent.click(label, { force: true, position: { x: 2, y: 2 } });
    const viaLabel = log.filter((entry) => entry.endsWith('input'));
    expect(direct).toEqual([
      'pointerdown capture',
      'pointerdown input',
      'pointerdown ancestor',
      'pointerup capture',
      'pointerup input',
      'pointerup ancestor',
    ]);
    expect(viaLabel).toEqual([]);
  });

  test('with aria-disabled, still joins FormData with a name, blocks validity when required or with custom validity, and submits on Enter unless keydown prevents default', async () => {
    html(`<form>
      <input type="checkbox" role="switch" id="named" name="a" value="1" checked aria-disabled="true">
      <input type="checkbox" role="switch" id="unnamed" value="2" checked aria-disabled="true">
      <input type="checkbox" role="switch" id="req" required aria-disabled="true">
      <button type="submit">Go</button>
    </form>`);
    const form = root!.querySelector('form')!;
    const named = root!.querySelector<HTMLInputElement>('#named')!;
    const req = root!.querySelector<HTMLInputElement>('#req')!;
    expect([...new FormData(form)]).toEqual([['a', '1']]);
    expect(form.checkValidity()).toBe(false);
    req.required = false;
    expect(form.checkValidity()).toBe(true);
    named.setCustomValidity('No.');
    expect([named.willValidate, named.matches(':invalid'), form.checkValidity()]).toEqual([
      true,
      true,
      false,
    ]);
    named.disabled = true;
    expect([named.willValidate, named.matches(':invalid'), form.checkValidity()]).toEqual([
      false,
      false,
      true,
    ]);
    named.disabled = false;
    named.setCustomValidity('');
    let submits = 0;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submits += 1;
    });
    named.focus();
    await userEvent.keyboard('{Enter}');
    const afterPlainEnter = submits;
    named.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') event.preventDefault();
    });
    await userEvent.keyboard('{Enter}');
    expect([afterPlainEnter, submits]).toEqual([1, 1]);
  });
});
