// A temporary probe. It runs the old and the new form of the nonce case many times in one test,
// and it fails on purpose with the counts, so that the log of CI shows them. Remove it before the
// pull request is ready.
import { expect, it } from 'vitest';
import { createApp, nextTick } from 'vue';
import type { App } from 'vue';
import { CSPProvider } from '@vase-ui/vue/csp-provider';
import { ScrollArea } from '@vase-ui/vue/scroll-area';
import { nextEvent, waitSingleFrame } from '#test-utils';

const ITERATIONS = 1000;
const POLICY =
  '<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="style-src-elem \'nonce-test-nonce\'"></head><body></body></html>';

async function loadPolicyFrame() {
  const frame = document.createElement('iframe');
  frame.srcdoc = POLICY;
  const loaded = new Promise((resolve) => {
    frame.addEventListener('load', resolve, { once: true });
  });
  document.body.append(frame);
  await loaded;
  return { frame, frameDocument: frame.contentDocument! };
}

function mountScrollArea(frameDocument: Document): App {
  const container = frameDocument.createElement('div');
  frameDocument.body.append(container);
  const app = createApp({
    render: () => (
      <CSPProvider nonce="test-nonce">
        <ScrollArea.Root />
      </CSPProvider>
    ),
  });
  app.mount(container);
  return app;
}

function describeTarget(target: EventTarget | null, control: Element) {
  if (target === control) return 'control';
  if (target instanceof Element) return `element: ${target.textContent?.slice(0, 30)}`;
  return String((target as Node | null)?.nodeName);
}

// The form on main: two frames for the event of the control, then a listener, then the mount.
async function runOldForm() {
  const { frame, frameDocument } = await loadPolicyFrame();
  const control = frameDocument.createElement('style');
  control.textContent = 'body{margin:0}';
  frameDocument.head.append(control);
  await waitSingleFrame();
  await waitSingleFrame();
  const counted: string[] = [];
  frameDocument.addEventListener('securitypolicyviolation', (event) => {
    counted.push(describeTarget(event.target, control));
  });
  const app = mountScrollArea(frameDocument);
  await waitSingleFrame();
  await waitSingleFrame();
  app.unmount();
  frame.remove();
  return counted;
}

// The new form: one capture listener, the mount, then the control, and a wait for its event.
async function runNewForm() {
  const { frame, frameDocument } = await loadPolicyFrame();
  const violations: (EventTarget | null)[] = [];
  frameDocument.addEventListener(
    'securitypolicyviolation',
    (event) => {
      violations.push(event.target);
    },
    { capture: true },
  );
  const app = mountScrollArea(frameDocument);
  await nextTick();
  const control = frameDocument.createElement('style');
  control.textContent = 'body{margin:0}';
  await nextEvent(control, 'securitypolicyviolation', {
    action: () => frameDocument.head.append(control),
  });
  const result = violations.map((target) => describeTarget(target, control));
  app.unmount();
  frame.remove();
  return result;
}

it('counts the faults of the old and the new form', { timeout: 900_000 }, async () => {
  const old: Record<string, number> = {};
  const fresh: Record<string, number> = {};
  for (let index = 0; index < ITERATIONS; index += 1) {
    const counted = await runOldForm();
    if (counted.length > 0) {
      const key = counted.join(' + ');
      old[key] = (old[key] ?? 0) + 1;
    }
    const result = (await runNewForm()).join(' + ');
    if (result !== 'control') {
      fresh[result] = (fresh[result] ?? 0) + 1;
    }
  }
  expect({ iterations: ITERATIONS, oldFormFaults: old, newFormFaults: fresh }).toBe('probe');
});
