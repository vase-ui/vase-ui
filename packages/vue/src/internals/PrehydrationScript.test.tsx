import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { createApp, nextTick } from 'vue';
import { hydrate, renderOnServer } from '#test-utils';
import PrehydrationScriptPart from '../../test/fixtures/PrehydrationScriptPart.vue';

const PART = 'test/fixtures/PrehydrationScriptPart.vue';

// `innerHTML` does not run an inline script. A fragment of a range does, as `hydrate` does.
function insertServerHtml(html: string, targetDocument: Document = document) {
  const container = targetDocument.createElement('div');
  targetDocument.body.append(container);
  onTestFinished(() => container.remove());
  const range = targetDocument.createRange();
  range.selectNodeContents(container);
  container.append(range.createContextualFragment(html));
  return container;
}

function mountPart() {
  const container = document.createElement('div');
  document.body.append(container);
  const app = createApp(PrehydrationScriptPart);
  onTestFinished(() => {
    app.unmount();
    container.remove();
  });
  app.mount(container);
  return container;
}

// A page that requires Trusted Types for scripts and has no `vue` entry in its `trusted-types` list
// makes Vue throw when it assigns an `innerHTML` prop. A frame with that policy does not show it,
// because Vue creates the element in the document of the test. The spy shows the assignment in each
// engine.
function recordScriptHtmlAssignments() {
  const setter = vi.spyOn(Element.prototype, 'innerHTML', 'set');
  onTestFinished(() => setter.mockRestore());
  return () => setter.mock.contexts.filter((element) => element instanceof HTMLScriptElement);
}

function readElement(container: Element) {
  const element = container.querySelector<HTMLElement>('[data-testid="element"]')!;
  return {
    hidden: element.hasAttribute('hidden'),
    prehydrated: element.style.getPropertyValue('--prehydrated'),
  };
}

describe('PrehydrationScript', () => {
  it('runs the script of the server HTML with no app', async () => {
    const container = insertServerHtml(await renderOnServer(PART));

    expect(readElement(container)).toEqual({ hidden: false, prehydrated: '1' });
  });

  it('hydrates with no message and removes the script after the mount', async () => {
    const { container } = await hydrate(PrehydrationScriptPart, {
      serverHtml: await renderOnServer(PART),
    });

    expect(readElement(container)).toEqual({ hidden: false, prehydrated: '1' });
    expect(container.querySelector('script')).toBe(null);
  });

  it('renders an empty script that does not run in a mount with no server HTML', async () => {
    const container = mountPart();

    expect(container.querySelector('script')?.textContent).toBe('');
    expect(readElement(container)).toEqual({ hidden: true, prehydrated: '' });

    await nextTick();

    expect(container.querySelector('script')).toBe(null);
  });

  it('assigns no innerHTML to the script in a mount with no server HTML', async () => {
    const readAssignments = recordScriptHtmlAssignments();

    mountPart();
    await nextTick();

    expect(readAssignments()).toEqual([]);
  });

  it('assigns no innerHTML to the script while the part hydrates', async () => {
    const serverHtml = await renderOnServer(PART);
    const readAssignments = recordScriptHtmlAssignments();

    await hydrate(PrehydrationScriptPart, { serverHtml });

    expect(readAssignments()).toEqual([]);
  });

  it('sets the nonce, so that a policy that needs the nonce runs the script', async () => {
    const frame = document.createElement('iframe');
    frame.srcdoc =
      '<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="script-src \'nonce-test-nonce\'"></head><body></body></html>';
    const loaded = new Promise((resolve) => {
      frame.addEventListener('load', resolve, { once: true });
    });
    document.body.append(frame);
    onTestFinished(() => frame.remove());
    await loaded;
    const frameDocument = frame.contentDocument!;
    const violations: string[] = [];
    const violated = new Promise<void>((resolve) => {
      frameDocument.addEventListener('securitypolicyviolation', (event) => {
        violations.push(event.violatedDirective);
        resolve();
      });
    });
    const serverHtml = await renderOnServer(PART);
    const serverHtmlWithNonce = await renderOnServer(PART, { nonce: 'test-nonce' });

    // A script with no nonce does not run when the policy is in force.
    const refused = insertServerHtml(serverHtml, frameDocument);
    const accepted = insertServerHtml(serverHtmlWithNonce, frameDocument);
    await violated;

    expect(readElement(accepted)).toEqual({ hidden: false, prehydrated: '1' });
    expect(readElement(refused)).toEqual({ hidden: true, prehydrated: '' });
    expect(violations).toEqual(['script-src-elem']);
  });
});
