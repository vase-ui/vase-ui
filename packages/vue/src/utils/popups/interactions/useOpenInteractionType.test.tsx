import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { defineComponent, nextTick, shallowRef } from 'vue';
import { createRenderer, fireEvent, flushMicrotasks, screen } from '#test-utils';
import { platform } from '../../../common/platform';
import type { InteractionType } from '../../../common/useEnhancedClickHandler';
import { useOpenInteractionType, useOpenMethodTriggerProps } from './useOpenInteractionType';

// A module namespace is read-only. The mock gives `os` as a plain object, so a case can set `ios`.
vi.mock('../../../common/platform', async () => {
  const actual = await vi.importActual<typeof import('../../../common/platform')>(
    '../../../common/platform',
  );
  return { platform: { ...actual.platform, os: { ...actual.platform.os } } };
});

function setIos(ios: boolean) {
  const actual = platform.os.ios;
  Object.defineProperty(platform.os, 'ios', { value: ios, configurable: true });
  onTestFinished(() => {
    Object.defineProperty(platform.os, 'ios', { value: actual, configurable: true });
  });
}

describe('useOpenInteractionType', () => {
  const { render } = createRenderer();

  /** A button that opens a popup, with the trigger props of the composable. */
  async function renderTrigger() {
    const open = shallowRef(false);
    let openMethod!: Readonly<{ value: InteractionType | null }>;
    const Trigger = defineComponent(() => {
      const result = useOpenInteractionType(open);
      openMethod = result.openMethod;
      return () => (
        <button
          {...result.triggerProps}
          onClick={() => {
            open.value = true;
          }}
        >
          trigger
        </button>
      );
    });
    await render(<Trigger />);
    return { open, openMethod: () => openMethod.value, button: screen.getByRole('button') };
  }

  it('is null at the mount', async () => {
    const { openMethod } = await renderTrigger();

    expect(openMethod()).toBe(null);
  });

  it.each([{ pointerType: 'mouse' }, { pointerType: 'touch' }, { pointerType: 'pen' }] as const)(
    'is $pointerType after a pointerdown of that type that opens the popup',
    async ({ pointerType }) => {
      const { open, openMethod, button } = await renderTrigger();

      await fireEvent.pointerDown(button, { pointerType });
      await fireEvent.click(button, { detail: 1 });

      expect({ open: open.value, openMethod: openMethod() }).toEqual({
        open: true,
        openMethod: pointerType,
      });
    },
  );

  it('is keyboard after a click with no click count', async () => {
    const { openMethod, button } = await renderTrigger();

    await fireEvent.click(button, { detail: 0 });

    expect(openMethod()).toBe('keyboard');
  });

  it('is mouse after a real click in each engine', async () => {
    const { open, openMethod, button } = await renderTrigger();

    await userEvent.click(button);
    await flushMicrotasks();

    expect({ open: open.value, openMethod: openMethod() }).toEqual({
      open: true,
      openMethod: 'mouse',
    });
  });

  it('does not change for a press while the popup is open', async () => {
    const { openMethod, button } = await renderTrigger();
    await fireEvent.pointerDown(button, { pointerType: 'mouse' });
    await fireEvent.click(button, { detail: 1 });

    await fireEvent.pointerDown(button, { pointerType: 'touch' });
    await fireEvent.click(button, { detail: 0 });

    expect(openMethod()).toBe('mouse');
  });

  it('is null after the popup closes', async () => {
    const { open, openMethod, button } = await renderTrigger();
    await fireEvent.pointerDown(button, { pointerType: 'mouse' });
    await fireEvent.click(button, { detail: 1 });
    expect(openMethod()).toBe('mouse');

    open.value = false;
    await nextTick();

    expect(openMethod()).toBe(null);
  });

  it.each([
    { name: 'touch on iOS', ios: true, openMethod: 'touch' },
    { name: 'an empty string off iOS', ios: false, openMethod: '' },
  ] as const)(
    'is $name for a click in the hitslop, which has no pointerdown',
    async ({ ios, openMethod: expected }) => {
      setIos(ios);
      const { openMethod, button } = await renderTrigger();

      await fireEvent.click(button, { detail: 1 });

      expect(openMethod()).toBe(expected);
    },
  );
});

describe('useOpenMethodTriggerProps', () => {
  const { render } = createRenderer();

  it('calls setOpenMethod only while the popup is closed', async () => {
    const open = shallowRef(false);
    const setOpenMethod = vi.fn();
    const Trigger = defineComponent(() => {
      const triggerProps = useOpenMethodTriggerProps(open, setOpenMethod);
      return () => <button {...triggerProps} />;
    });
    await render(<Trigger />);
    const button = screen.getByRole('button');

    await fireEvent.pointerDown(button, { pointerType: 'mouse' });
    expect(setOpenMethod).toHaveBeenCalledTimes(1);
    expect(setOpenMethod).toHaveBeenLastCalledWith('mouse');

    open.value = true;
    await fireEvent.pointerDown(button, { pointerType: 'mouse' });
    expect(setOpenMethod).toHaveBeenCalledTimes(1);
  });
});
