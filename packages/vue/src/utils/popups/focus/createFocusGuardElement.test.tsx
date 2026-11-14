import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { createRenderer, screen } from '#test-utils';
import { platform } from '../../../common/platform';
import { createFocusGuardElement } from './createFocusGuardElement';
import FocusGuard from './FocusGuard.vue';

// A module namespace is read-only. The mock gives `screenReader` and `engine` as plain objects, so
// a case can set a flag.
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

function setPlatform(flag: boolean) {
  function define(value: boolean) {
    Object.defineProperty(platform.screenReader, 'voiceOver', { value, configurable: true });
    Object.defineProperty(platform.engine, 'webkit', { value, configurable: true });
  }

  define(flag);
  onTestFinished(() => define(false));
}

describe('createFocusGuardElement', () => {
  const { render } = createRenderer();

  it.each([
    { name: 'the hidden form', voiceOverInWebKit: false },
    { name: 'the form of a button', voiceOverInWebKit: true },
  ])('makes the element of FocusGuard in $name', async ({ voiceOverInWebKit }) => {
    setPlatform(voiceOverInWebKit);
    await render(<FocusGuard data-testid="guard" />);
    const guard = screen.getByTestId('guard');
    guard.removeAttribute('data-testid');

    const element = createFocusGuardElement(document);

    expect(element.isEqualNode(guard)).toBe(true);
    expect(element.hasAttribute('role')).toBe(voiceOverInWebKit);
  });
});
