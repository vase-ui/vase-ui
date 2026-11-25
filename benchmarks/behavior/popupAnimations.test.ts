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

/** A recording of the marker `popup`, with one element (`null`: absent) and one frame each 16 ms. */
function recording(...opacities: (number | null)[]): Recording {
  const frames: Frame[] = opacities.map((opacity, index) => ({
    time: index * 16,
    elements: {
      popup: opacity === null ? [] : [{ id: 0, visible: true, opacity, rect: RECT }],
    },
    focus: {},
    focusInLayer: {},
    active: 'body',
  }));
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

test('a rise at the end of an exit, gone in the next frame, leaves WebKit frames', () => {
  const frames = recording(0.07, 0.03, 0.97, null);
  assert.deepEqual(opacitiesOf(withoutWebKitEndReadings(frames, 'webkit')), [0.07, 0.03, null]);
  for (const engine of ['chromium', 'firefox']) {
    assert.deepEqual(withoutWebKitEndReadings(frames, engine), frames);
  }
});

test('a WebKit rise that stays on the screen or starts above the hidden limit stays', () => {
  const stays = recording(0.07, 0.03, 0.97, 0.94);
  assert.deepEqual(withoutWebKitEndReadings(stays, 'webkit'), stays);
  const midway = recording(0.5, 0.47, 0.97, null);
  assert.deepEqual(withoutWebKitEndReadings(midway, 'webkit'), midway);
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
