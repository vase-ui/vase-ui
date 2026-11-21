import { describe, expect, test } from 'vitest';
import { alignedPlace, grownPlace, pinnedPlace, type Box } from './alignment';

function box(left: number, top: number, width: number, height: number): Box {
  return { left, top, width, height, right: left + width, bottom: top + height };
}

const view = { width: 400, height: 720 };
const margin = { top: 10, bottom: 10 };

describe('alignedPlace', () => {
  test('puts the text of the item over the text of the value: the same middle and inline start', () => {
    const place = alignedPlace({
      trigger: box(10, 300, 80, 30),
      positioner: box(10, 0, 108, 160),
      value: box(10, 300, 60, 30),
      text: box(14, 105, 80, 30),
      view,
      margin,
      rtl: false,
    });
    // The text is 105 px below the top of the positioner, so the popup starts 105 px above it.
    expect(place).toEqual({
      left: 6,
      height: 515,
      scrollTop: 0,
      idealHeight: 515,
      room: 700,
      margins: 20,
    });
  });

  test('aligns the inline end in a right-to-left popup, and keeps 5 px from the edges of the view', () => {
    const place = alignedPlace({
      trigger: box(300, 300, 90, 30),
      positioner: box(0, 0, 108, 200),
      value: box(320, 300, 70, 30),
      text: box(20, 0, 80, 30),
      view,
      margin,
      rtl: true,
    });
    // 0 + (390 - 100) = 290, and the positioner must end 5 px before the edge: 400 - 5 - 108.
    expect(place.left).toBe(287);
  });

  test('with no text, starts at the inline start of the trigger', () => {
    const place = alignedPlace({
      trigger: box(10, 300, 80, 30),
      positioner: box(50, 0, 108, 0),
      value: box(10, 300, 60, 30),
      text: undefined,
      view,
      margin,
      rtl: false,
    });
    expect(place.left).toBe(10);
    // From the top of the trigger to the bottom margin of the view.
    expect(place.idealHeight).toBe(720 - 300 - 10);
  });

  test('with another margin at the top than at the bottom, the place puts the text over the value', () => {
    const place = alignedPlace({
      trigger: box(10, 300, 80, 30),
      positioner: box(10, 0, 108, 160),
      value: box(10, 300, 60, 30),
      text: box(14, 105, 80, 30),
      view,
      margin: { top: 30, bottom: 10 },
      rtl: false,
    });
    const pin = pinnedPlace({
      place,
      trigger: box(10, 300, 80, 30),
      positionerHeight: 160,
      maxScrollTop: 0,
      scrollHeight: 160,
      minHeight: 100,
      maxHeight: Infinity,
    });
    // The top margin, the top of the place and the text in the positioner end at the trigger.
    expect(30 + pin!.top! + 105).toBe(300);
  });
});

describe('pinnedPlace', () => {
  const trigger = box(10, 300, 80, 30);
  const bottom = alignedPlace({
    trigger,
    positioner: box(10, 0, 108, 200),
    value: box(10, 300, 60, 30),
    text: box(10, 0, 80, 30),
    view,
    margin,
    rtl: false,
  });

  test('pins the popup to the bottom of the view when the item is near the top of the list', () => {
    expect(
      pinnedPlace({
        place: bottom,
        trigger,
        positionerHeight: 200,
        maxScrollTop: 200,
        scrollHeight: 400,
        minHeight: 100,
        maxHeight: Infinity,
      }),
    ).toEqual({ height: 410, top: undefined, scrollTop: 0, pinned: 'bottom', full: false });
  });

  test('pins the popup to the top of the view and scrolls the list to its end when the item is far down', () => {
    const top = alignedPlace({
      trigger: box(10, 200, 80, 30),
      positioner: box(10, 0, 108, 200),
      value: box(10, 200, 60, 30),
      text: box(10, 300, 80, 30),
      view: { width: 400, height: 400 },
      margin,
      rtl: false,
    });
    expect(
      pinnedPlace({
        place: top,
        trigger: box(10, 200, 80, 30),
        positionerHeight: 200,
        maxScrollTop: 100,
        scrollHeight: 400,
        minHeight: 100,
        maxHeight: Infinity,
      }),
    ).toEqual({ height: 190, top: 0, scrollTop: 'max', pinned: 'top', full: false });
  });

  test('is full when the popup reaches its max-height', () => {
    expect(
      pinnedPlace({
        place: bottom,
        trigger,
        positionerHeight: 200,
        maxScrollTop: 200,
        scrollHeight: 400,
        minHeight: 100,
        maxHeight: 100,
      })?.full,
    ).toBe(true);
  });

  test.each([
    { name: 'the trigger is near the top', trigger: box(10, 15, 80, 30), minHeight: 100 },
    { name: 'the trigger is near the bottom', trigger: box(10, 670, 80, 30), minHeight: 100 },
    { name: 'the height is less than min-height', trigger, minHeight: 500 },
  ])('gives null when $name', ({ trigger: at, minHeight }) => {
    expect(
      pinnedPlace({
        place: bottom,
        trigger: at,
        positionerHeight: 200,
        maxScrollTop: 200,
        scrollHeight: 600,
        minHeight,
        maxHeight: Infinity,
      }),
    ).toBe(null);
  });
});

describe('grownPlace', () => {
  test('a popup pinned to the bottom grows by the scroll, and the list goes back to its top', () => {
    expect(
      grownPlace({
        height: 200,
        room: 700,
        maxHeight: Infinity,
        pinned: 'bottom',
        scrollTop: 100,
        maxScrollTop: 200,
      }),
    ).toEqual({ height: 300, scrollTop: 0, full: false });
  });

  test('takes a scroll of less than 1 px into the height', () => {
    expect(
      grownPlace({
        height: 200,
        room: 700,
        maxHeight: Infinity,
        pinned: 'bottom',
        scrollTop: 0.5,
        maxScrollTop: 200,
      }),
    ).toEqual({ height: 200.5, scrollTop: 0, full: false });
  });

  test('leaves the height for a list at the pinned edge', () => {
    expect(
      grownPlace({
        height: 200,
        room: 700,
        maxHeight: Infinity,
        pinned: 'bottom',
        scrollTop: 0,
        maxScrollTop: 200,
      }),
    ).toEqual({ height: undefined, scrollTop: 0, full: false });
  });

  test('a popup pinned to the top grows up to the room, and is then full', () => {
    expect(
      grownPlace({
        height: 300,
        room: 380,
        maxHeight: Infinity,
        pinned: 'top',
        scrollTop: 0,
        maxScrollTop: 100,
      }),
    ).toEqual({ height: 380, scrollTop: undefined, full: true });
  });

  test('gives no height of 0 when the view is smaller than the margins', () => {
    expect(
      grownPlace({
        height: 200,
        room: 0,
        maxHeight: Infinity,
        pinned: 'bottom',
        scrollTop: 100,
        maxScrollTop: 200,
      }),
    ).toMatchObject({ height: undefined, full: true });
  });
});
