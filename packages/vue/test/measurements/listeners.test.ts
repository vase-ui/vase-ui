// Measurements with native elements and plain script, with no code of the library. Each one states
// what the browser does, so that a part has code only where the browser does not do it. Measured on
// macOS 27.
import { afterEach, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick } from 'vue';
import Toggles from '../fixtures/Toggles.vue';
import { mount } from '../render';

let root: HTMLElement | undefined;
let listeners = new AbortController();

afterEach(() => {
  root?.remove();
  root = undefined;
  listeners.abort();
  listeners = new AbortController();
});

// DOM Standard, "dispatch": the capture listeners of each ancestor run before those of the target,
// and a set stop flag ends the dispatch before the bubble listeners. So a developer stops a native
// event before a part gets it with a capture listener on the part, and no code of the library does it.
test('a capture listener on the target that stops the event runs after the capture listeners of its ancestors, and no bubble listener runs', async () => {
  root = document.body.appendChild(document.createElement('div'));
  root.innerHTML = '<div id="outer"><button id="target">Press</button></div>';
  const outer = root.querySelector<HTMLElement>('#outer')!;
  const button = root.querySelector<HTMLButtonElement>('#target')!;
  const log: string[] = [];
  const listen = (target: EventTarget, name: string, capture: boolean) =>
    target.addEventListener('keydown', () => log.push(name), { capture, signal: listeners.signal });
  listen(button, 'button bubble', false);
  listen(outer, 'div bubble', false);
  listen(document, 'document bubble', false);
  listen(outer, 'div capture', true);
  listen(document, 'document capture', true);
  button.addEventListener(
    'keydown',
    (event) => {
      log.push('button capture');
      event.stopPropagation();
    },
    { capture: true, signal: listeners.signal },
  );
  button.focus();
  await userEvent.keyboard('a');
  expect(log).toEqual(['document capture', 'div capture', 'button capture']);
});

test('a capture listener on a part that stops a click keeps the part from the click: the toggle emits no pressedChange', async () => {
  const log: string[] = [];
  const { root: mounted } = mount(Toggles, {
    toggles: [
      {
        onClickCapture: (event: MouseEvent) => event.stopPropagation(),
        onPressedChange: () => log.push('stopped toggle'),
      },
      { onPressedChange: () => log.push('other toggle') },
    ],
  });
  await nextTick();
  const [stopped, other] = mounted.querySelectorAll<HTMLElement>('.Ancestor > button');
  await userEvent.click(stopped!);
  await userEvent.click(other!);
  expect(log).toEqual(['other toggle']);
  expect(stopped).toHaveAttribute('aria-pressed', 'false');
});
