import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { createRenderer, expectNoAxeViolations, hydrate, renderOnServer } from '#test-utils';
import { platform } from '../../../common/platform';
import { visuallyHidden } from '../../../common/visuallyHidden';
import { createAttribute } from '../createAttribute';
import FocusGuard from './FocusGuard.vue';

// A module namespace is read-only. The mock gives `screenReader` and `engine` as plain objects, so
// a case can set a flag. Each flag starts `false`, so a case does not depend on the engine that
// runs it.
vi.mock('../../../common/platform', async () => {
  const actual = await vi.importActual<typeof import('../../../common/platform')>(
    '../../../common/platform',
  );
  return {
    platform: {
      ...actual.platform,
      screenReader: { ...actual.platform.screenReader, voiceOver: false },
      engine: { ...actual.platform.engine, webkit: false },
    },
  };
});

function setPlatform({ voiceOver, webkit }: { voiceOver: boolean; webkit: boolean }) {
  function define(flags: { voiceOver: boolean; webkit: boolean }) {
    Object.defineProperty(platform.screenReader, 'voiceOver', {
      value: flags.voiceOver,
      configurable: true,
    });
    Object.defineProperty(platform.engine, 'webkit', { value: flags.webkit, configurable: true });
  }

  define({ voiceOver, webkit });
  onTestFinished(() => define({ voiceOver: false, webkit: false }));
}

interface FocusGuardInstance {
  element: HTMLElement | null;
}

describe('FocusGuard', () => {
  const { render } = createRenderer();

  it('is a span with the focus guard attribute and the style of visuallyHidden', async () => {
    const { getByTestId } = await render(<FocusGuard data-testid="guard" />);
    const guard = getByTestId('guard');
    const reference = document.createElement('span');
    Object.assign(reference.style, visuallyHidden);

    expect(guard.tagName).toBe('SPAN');
    expect(guard).toHaveAttribute(createAttribute('focus-guard'), '');
    expect(guard.style.cssText).toBe(reference.style.cssText);
  });

  it('is a stop of the Tab key', async () => {
    const { getByTestId } = await render(
      <div>
        <input data-testid="before" />
        <FocusGuard data-testid="guard" />
        <input data-testid="after" />
      </div>,
    );
    getByTestId('before').focus();

    await userEvent.tab();
    expect(getByTestId('guard')).toHaveFocus();

    await userEvent.tab();
    expect(getByTestId('after')).toHaveFocus();
  });

  it('passes its attributes and its focus listener to the span', async () => {
    const handleFocusin = vi.fn();
    const { getByTestId } = await render(
      <div>
        <input data-testid="before" />
        <FocusGuard data-testid="guard" data-type="outside" {...{ onFocusin: handleFocusin }} />
      </div>,
    );
    const before = getByTestId('before');
    before.focus();

    getByTestId('guard').focus();

    expect(getByTestId('guard')).toHaveAttribute('data-type', 'outside');
    expect(handleFocusin).toHaveBeenCalledTimes(1);
    expect(handleFocusin.mock.lastCall?.[0].relatedTarget).toBe(before);
  });

  it('exposes its span as `element`', async () => {
    let guard: FocusGuardInstance | null = null;
    const Test = () => (
      <FocusGuard
        ref={(value) => {
          guard = value as FocusGuardInstance | null;
        }}
      />
    );

    const { container } = await render(<Test />);

    expect(guard!.element).toBe(container.firstElementChild);
  });

  describe('accessibility tree', () => {
    it.each([
      { name: 'VoiceOver and WebKit are off', voiceOver: false, webkit: false },
      { name: 'only VoiceOver is on', voiceOver: true, webkit: false },
      { name: 'only WebKit is on', voiceOver: false, webkit: true },
    ])('hides the guard when $name', async ({ voiceOver, webkit }) => {
      setPlatform({ voiceOver, webkit });
      const { getByTestId } = await render(<FocusGuard data-testid="guard" />);
      const guard = getByTestId('guard');

      expect(guard).toHaveAttribute('aria-hidden', 'true');
      expect(guard).not.toHaveAttribute('role');
      expect(guard).not.toHaveAttribute('aria-label');
    });

    it('BUG-5237: names the guard that WebKit exposes as a button', async () => {
      setPlatform({ voiceOver: true, webkit: true });
      const { getByTestId } = await render(<FocusGuard data-testid="guard" />);
      const guard = getByTestId('guard');

      expect(guard).toHaveAttribute('role', 'button');
      expect(guard).not.toHaveAttribute('aria-hidden');
      await expectNoAxeViolations(guard);
    });
  });

  describe('hydration', () => {
    it('hydrates the hidden form and then sets the role, with no message', async () => {
      setPlatform({ voiceOver: true, webkit: true });
      const serverHtml = await renderOnServer('src/utils/popups/focus/FocusGuard.vue');
      const template = document.createElement('template');
      template.innerHTML = serverHtml;
      const serverGuard = template.content.firstElementChild;

      expect(serverGuard?.getAttribute('aria-hidden')).toBe('true');
      expect(serverGuard?.hasAttribute('role')).toBe(false);

      const { container } = await hydrate(FocusGuard, { serverHtml });

      expect(container.firstElementChild).toHaveAttribute('role', 'button');
      expect(container.firstElementChild).not.toHaveAttribute('aria-hidden');
    });
  });
});
