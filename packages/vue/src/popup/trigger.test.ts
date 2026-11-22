import { describe, expect, onTestFinished, test, vi } from 'vitest';
import { server, userEvent } from 'vitest/browser';
import { touchDrag } from '../../test/pointer';
import { isVirtualPress } from './trigger';

const platform = vi.hoisted(() => ({ android: false }));

vi.mock('../common/platform', async () => {
  const actual = await vi.importActual<typeof import('../common/platform')>('../common/platform');
  return {
    ...actual,
    platform: {
      ...actual.platform,
      os: {
        ...actual.platform.os,
        get android() {
          return platform.android;
        },
      },
    },
  };
});

const press = (init: PointerEventInit) =>
  new PointerEvent('pointerdown', {
    pointerType: 'mouse',
    width: 1,
    height: 1,
    pressure: 0,
    buttons: 0,
    ...init,
  });

describe('isVirtualPress', () => {
  function pressedButton() {
    const button = document.body.appendChild(document.createElement('button'));
    button.textContent = 'Press';
    button.style.cssText = 'position: fixed; left: 20px; top: 20px; width: 100px; height: 40px';
    onTestFinished(() => button.remove());
    const presses: boolean[] = [];
    button.addEventListener('pointerdown', (event) => presses.push(isVirtualPress(event)));
    return { button, presses };
  }

  test('a real mouse press is no press of a screen reader', async () => {
    const { button, presses } = pressedButton();
    await userEvent.click(button);
    expect(presses).toEqual([false]);
  });

  test.skipIf(server.browser !== 'chromium')(
    'a real touch is no press of a screen reader',
    async () => {
      const { presses } = pressedButton();
      await touchDrag({ x: 70, y: 40 }, { x: 70, y: 40 }, 0);
      expect(presses).toEqual([false]);
    },
  );

  test.each([
    { name: 'of a mouse with no size', init: { width: 0, height: 0 }, virtual: true },
    { name: 'of a mouse of 1 by 1 pixel with no pressure and no button', init: {}, virtual: true },
    { name: 'of a mouse with pressure', init: { pressure: 0.5, buttons: 1 }, virtual: false },
    {
      name: 'of a mouse with a pressed button and no pressure',
      init: { buttons: 1 },
      virtual: false,
    },
    { name: 'of a touch of 1 by 1 pixel', init: { pointerType: 'touch' }, virtual: false },
    {
      name: 'of a touch of VoiceOver on iOS',
      init: { pointerType: 'touch', width: 0.333, height: 0.333 },
      virtual: true,
    },
    {
      name: 'of a small touch with pressure',
      init: { pointerType: 'touch', width: 0.333, height: 0.333, pressure: 0.5 },
      virtual: false,
    },
    {
      name: 'of a pen with no size',
      init: { pointerType: 'pen', width: 0, height: 0 },
      virtual: false,
    },
  ])('a press $name is a press of a screen reader: $virtual', ({ init, virtual }) => {
    expect(isVirtualPress(press(init))).toBe(virtual);
  });

  test('on Android, a press of 1 by 1 pixel with a pressed button and no pressure is a press of TalkBack', () => {
    platform.android = true;
    onTestFinished(() => {
      platform.android = false;
    });
    expect(isVirtualPress(press({ buttons: 1 }))).toBe(true);
    expect(isVirtualPress(press({ buttons: 1, pressure: 0.5 }))).toBe(false);
  });
});
