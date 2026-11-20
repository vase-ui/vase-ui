// Measurements with native elements and plain script, with no code of the library. Each one states
// what the browser does, so that a part has code only where the browser does not do it. Where the
// browsers differ, the measurement states each one. Measured on macOS 27.
import { afterEach, describe, expect, test } from 'vitest';
import { server, userEvent } from 'vitest/browser';

let root: HTMLElement | undefined;

afterEach(() => {
  root?.remove();
  root = undefined;
});

/**
 * Three buttons a, b and c between two inputs. With `roving`, a has the tab stop, and a `focusin`
 * listener gives the tab stop to the button that gets the focus, as a toggle group does.
 */
function row(roving: boolean) {
  root = document.body.appendChild(document.createElement('div'));
  const tabindex = (stop: boolean) => (roving ? (stop ? '0' : '-1') : '0');
  root.innerHTML = `<input id="before" aria-label="Before">
    <div id="row">
      <button id="a" tabindex="${tabindex(true)}">A</button>
      <button id="b" tabindex="${tabindex(false)}">B</button>
      <button id="c" tabindex="${tabindex(false)}">C</button>
    </div>
    <input id="after" aria-label="After">`;
  const buttons = [...root.querySelectorAll('button')];
  if (roving) {
    root.querySelector('#row')!.addEventListener('focusin', (event) => {
      for (const button of buttons) button.tabIndex = button === event.target ? 0 : -1;
    });
  }
  return { buttons, b: buttons[1]! };
}

const focused = () => (document.activeElement as HTMLElement).id || 'none';

// The WebKit projects run with full keyboard access: the test setup turns it on in macOS. A button
// with a `tabindex` gets the focus at a click in each browser.
describe('a row of buttons with one tab stop', () => {
  test('a click gives the clicked button the focus, and Tab then leaves the row', async () => {
    const { b } = row(true);
    await userEvent.click(b);
    const atClick = focused();
    await userEvent.keyboard('{Tab}');
    expect([atClick, focused()]).toEqual(['b', 'after']);
  });

  // WebKit starts the search of Shift+Tab at the point of the click, inside the clicked button, and
  // finds that button again. A script focus starts at the focused element.
  test('after a click, Shift+Tab leaves the row, and in WebKit keeps the focus on the clicked button', async () => {
    const { b } = row(true);
    await userEvent.click(b);
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
    const afterClick = focused();
    root!.remove();
    row(true).b.focus();
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
    expect([afterClick, focused()]).toEqual([
      server.browser === 'webkit' ? 'b' : 'before',
      'before',
    ]);
  });

  test('WebKit keeps the focus at Shift+Tab after a click also with no tab stop: each button has tabindex="0"', async () => {
    const { b } = row(false);
    await userEvent.click(b);
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
    expect(focused()).toBe(server.browser === 'webkit' ? 'b' : 'a');
  });

  test('a focused button that becomes disabled keeps the focus until the next key, and Tab then leaves the row', async () => {
    const { buttons, b } = row(true);
    b.focus();
    b.disabled = true;
    // The group gives the tab stop to the first enabled button.
    buttons[0]!.tabIndex = 0;
    const atDisable = focused();
    await userEvent.keyboard('{Tab}');
    expect([atDisable, focused()]).toEqual(['b', 'after']);
  });
});
