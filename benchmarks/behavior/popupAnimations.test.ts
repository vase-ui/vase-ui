import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isDialogPopup,
  isHoverPopup,
  POPUP_ANIMATIONS,
  withoutWebKitEndReadings,
} from './popupAnimations.ts';
import type { Frame, Recording } from './recorder.ts';

const RECT = { x: 0, y: 0, width: 100, height: 100 };

function recording(...opacities: (number | null | { id: number; opacity: number })[]): Recording {
  const frames: Frame[] = opacities.map((entry, index) => {
    const item =
      entry === null ? null : typeof entry === 'number' ? { id: 0, opacity: entry } : entry;
    return {
      time: index * 16,
      elements: {
        popup:
          item === null ? [] : [{ id: item.id, visible: true, opacity: item.opacity, rect: RECT }],
      },
      focus: {},
      focusInLayer: {},
      active: 'body',
    };
  });
  return { frames, inputs: [] };
}

const opacitiesOf = ({ frames }: Recording) =>
  frames.map((frame) => frame.elements.popup?.[0]?.opacity ?? null);

test('a drop at the end of an enter, back to full opacity in the next frame, leaves WebKit frames', () => {
  const frames = recording(0.94, 0.97, 0.03, 1, 1);
  assert.deepEqual(opacitiesOf(withoutWebKitEndReadings(frames, 'webkit')), [0.94, 0.97, 1, 1]);
});

test('the same drop stays in the frames of Chromium and Firefox', () => {
  const frames = recording(0.94, 0.97, 0.03, 1, 1);
  for (const engine of ['chromium', 'firefox']) {
    assert.deepEqual(withoutWebKitEndReadings(frames, engine), frames);
  }
});

test('a WebKit drop that the next frame does not undo stays', () => {
  const frames = recording(0.5, 0.53, 0.03, 0.06, 1);
  assert.deepEqual(withoutWebKitEndReadings(frames, 'webkit'), frames);
});

test('a rise at the end of an exit, gone or replaced at hidden opacity in the next frame, leaves WebKit frames', () => {
  const frames = recording(0.07, 0.03, 0.97, null);
  assert.deepEqual(opacitiesOf(withoutWebKitEndReadings(frames, 'webkit')), [0.07, 0.03, null]);
  for (const engine of ['chromium', 'firefox']) {
    assert.deepEqual(withoutWebKitEndReadings(frames, engine), frames);
  }
  const replaced = recording(0.07, 0.03, 0.97, { id: 1, opacity: 0 });
  assert.deepEqual(opacitiesOf(withoutWebKitEndReadings(replaced, 'webkit')), [0.07, 0.03, 0]);
  for (const engine of ['chromium', 'firefox']) {
    assert.deepEqual(withoutWebKitEndReadings(replaced, engine), replaced);
  }
});

test('a WebKit rise that stays on the screen, starts above the hidden limit, hits full opacity, or mounts visible stays', () => {
  const stays = recording(0.07, 0.03, 0.97, 0.94);
  assert.deepEqual(withoutWebKitEndReadings(stays, 'webkit'), stays);
  const midway = recording(0.5, 0.47, 0.97, null);
  assert.deepEqual(withoutWebKitEndReadings(midway, 'webkit'), midway);
  const earlyRemoval = recording(0.5, 0.47, null);
  assert.deepEqual(withoutWebKitEndReadings(earlyRemoval, 'webkit'), earlyRemoval);
  const flash = recording(0.07, 0.03, 1, null);
  assert.deepEqual(withoutWebKitEndReadings(flash, 'webkit'), flash);
  const replacedVisible = recording(0.07, 0.03, 0.97, { id: 1, opacity: 1 });
  assert.deepEqual(withoutWebKitEndReadings(replacedVisible, 'webkit'), replacedVisible);
});

test('Tooltip and PreviewCard open and close by hover', () => {
  for (const popup of ['Tooltip', 'PreviewCard']) {
    assert.equal(isHoverPopup(popup), true, popup);
  }
  for (const popup of [
    'Dialog',
    'Popover',
    'Menu',
    'Select',
    'Combobox',
    'NavigationMenu',
    'Drawer',
    null,
  ]) {
    assert.equal(isHoverPopup(popup), false, String(popup));
  }
});

test('Dialog and Drawer take the centered place and have no origin checks', () => {
  for (const popup of ['Dialog', 'Drawer']) {
    assert.equal(isDialogPopup(popup), true, popup);
  }
  for (const popup of [
    'Popover',
    'Menu',
    'Select',
    'Tooltip',
    'PreviewCard',
    'Combobox',
    'NavigationMenu',
    null,
  ]) {
    assert.equal(isDialogPopup(popup), false, String(popup));
  }
  const all = [
    'Dialog',
    'Popover',
    'Menu',
    'Select',
    'Tooltip',
    'PreviewCard',
    'Combobox',
    'NavigationMenu',
    'Drawer',
  ];
  const anchored = all.filter((popup) => !isDialogPopup(popup));
  for (const check of POPUP_ANIMATIONS.checks) {
    assert.deepEqual(check.cases, check.id.startsWith('origin-') ? anchored : all, check.id);
  }
});
