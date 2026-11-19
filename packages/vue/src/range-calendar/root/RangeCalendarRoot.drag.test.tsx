import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { createRenderer, fireEvent, screen, touchDrag } from '#test-utils';
import { platform } from '../../common/platform';
import * as RangeCalendar from '../index.parts';
import RangeCalendarAncestors from './RangeCalendarAncestors.test.vue';
import RangeCalendarAnatomy from './RangeCalendarAnatomy.test.vue';

const day = (text: string) => Temporal.PlainDate.from(text);

// 2026-11-14 is a Saturday. With `en-US`, the weeks start on Sunday and 2026-11-01 is a Sunday.
const today = () => day('2026-11-14');

function button(iso: string) {
  return document.querySelector<HTMLElement>(`[data-date="${iso}"] button`)!;
}

function centerOf(element: Element) {
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

// The cells that have each range attribute, as the text of their dates.
function shown() {
  const find = (name: string) =>
    [...document.querySelectorAll(`td[${name}]`)].map((element) =>
      element.getAttribute('data-date'),
    );
  return {
    start: find('data-range-start'),
    middle: find('data-range-middle'),
    end: find('data-range-end'),
  };
}

function ends(call: readonly unknown[]) {
  return (call[0] as (Temporal.PlainDate | null)[]).map((end) => end?.toString() ?? null);
}

// The pointer of the browser stays where a case leaves it, for each later test.
function releasePointerAfterTest() {
  onTestFinished(async () => {
    await userEvent.pointer({ coords: { x: 0, y: 0 }, keys: '[/MouseLeft]' });
  });
}

describe('<RangeCalendar.Root /> with a drag', () => {
  const { render } = createRenderer();

  async function renderRange(props: Record<string, unknown> = {}) {
    const onValueChange = vi.fn();
    const result = await render(
      <RangeCalendarAnatomy {...{ today: today(), locale: 'en-US', onValueChange, ...props }} />,
    );
    return { ...result, onValueChange };
  }

  // The events of a pointer that a script dispatches. A real drag holds the pointer on the button
  // where it started, so the events go to that button, with the point where the pointer is.
  const pointer = (pointerType: string, target: Element, buttons = 1) => ({
    button: 0,
    buttons,
    pointerId: 7,
    pointerType,
    clientX: centerOf(target).x,
    clientY: centerOf(target).y,
  });

  describe('with the events of a pointer', () => {
    it.each([{ pointerType: 'mouse' }, { pointerType: 'touch' }, { pointerType: 'pen' }])(
      'makes a range with a drag of a $pointerType, in one change',
      async ({ pointerType }) => {
        const { onValueChange } = await renderRange();
        const first = button('2026-11-10');

        await fireEvent.pointerDown(first, pointer(pointerType, first));
        await fireEvent.pointerMove(first, pointer(pointerType, button('2026-11-12')));

        expect(shown()).toEqual({
          start: ['2026-11-10'],
          middle: ['2026-11-11'],
          end: ['2026-11-12'],
        });
        expect(screen.getByRole('group')).toHaveAttribute('data-selecting');
        expect(onValueChange).not.toHaveBeenCalled();

        await fireEvent.pointerMove(first, pointer(pointerType, button('2026-11-14')));
        await fireEvent.pointerUp(first, pointer(pointerType, button('2026-11-14'), 0));

        expect(onValueChange).toHaveBeenCalledTimes(1);
        expect(ends(onValueChange.mock.calls[0]!)).toEqual(['2026-11-10', '2026-11-14']);
        expect(onValueChange.mock.calls[0]![1].reason).toBe('drag');
        expect(onValueChange.mock.calls[0]![1].event).toBeInstanceOf(PointerEvent);
        expect(shown().end).toEqual(['2026-11-14']);
        expect(screen.getByRole('group')).not.toHaveAttribute('data-selecting');
      },
    );

    it('makes the range in the order of the calendar when the drag goes back', async () => {
      const { onValueChange } = await renderRange();
      const first = button('2026-11-14');

      await fireEvent.pointerDown(first, pointer('mouse', first));
      await fireEvent.pointerMove(first, pointer('mouse', button('2026-11-10')));
      await fireEvent.pointerUp(first, pointer('mouse', button('2026-11-10'), 0));

      expect(ends(onValueChange.mock.calls[0]!)).toEqual(['2026-11-10', '2026-11-14']);
    });

    it('swallows the click that follows a drag, and not the next press', async () => {
      const { onValueChange } = await renderRange();
      const first = button('2026-11-10');

      await fireEvent.pointerDown(first, pointer('mouse', first));
      await fireEvent.pointerMove(first, pointer('mouse', button('2026-11-12')));
      await fireEvent.pointerUp(first, pointer('mouse', button('2026-11-12'), 0));
      await fireEvent.click(first, { detail: 1 });

      expect(onValueChange).toHaveBeenCalledTimes(1);

      await fireEvent.click(button('2026-11-20'), { detail: 1 });

      expect(ends(onValueChange.mock.calls[1]!)).toEqual(['2026-11-20', null]);
    });

    it('leaves a press and a release on one day to the click that follows', async () => {
      const { onValueChange } = await renderRange();
      const first = button('2026-11-10');

      await fireEvent.pointerDown(first, pointer('mouse', first));
      await fireEvent.pointerUp(first, pointer('mouse', first, 0));
      expect(onValueChange).not.toHaveBeenCalled();
      await fireEvent.click(first, { detail: 1 });

      expect(ends(onValueChange.mock.calls[0]!)).toEqual(['2026-11-10', null]);
      expect(onValueChange.mock.calls[0]![1].reason).toBe('day-press');
    });

    it('ends the range at the last day of the drag when the pointer is over no day', async () => {
      const { onValueChange } = await renderRange();
      const first = button('2026-11-10');

      await fireEvent.pointerDown(first, pointer('mouse', first));
      await fireEvent.pointerMove(first, pointer('mouse', button('2026-11-12')));
      await fireEvent.pointerUp(first, { ...pointer('mouse', first, 0), clientX: 0, clientY: 0 });

      expect(ends(onValueChange.mock.calls[0]!)).toEqual(['2026-11-10', '2026-11-12']);
    });

    it('does not move the range over a day that cannot be selected', async () => {
      const { onValueChange } = await renderRange({ unavailableDates: day('2026-11-12') });
      const first = button('2026-11-10');

      await fireEvent.pointerDown(first, pointer('mouse', first));
      await fireEvent.pointerMove(first, pointer('mouse', button('2026-11-11')));
      await fireEvent.pointerMove(first, pointer('mouse', button('2026-11-12')));

      expect(shown().end).toEqual(['2026-11-11']);

      await fireEvent.pointerMove(first, pointer('mouse', button('2026-11-13')));

      expect(shown().end).toEqual(['2026-11-11']);

      await fireEvent.pointerUp(first, pointer('mouse', button('2026-11-13'), 0));

      expect(ends(onValueChange.mock.calls[0]!)).toEqual(['2026-11-10', '2026-11-11']);
    });

    it('ends the drag at its last day when a move comes with no button pressed', async () => {
      const { onValueChange } = await renderRange();
      const first = button('2026-11-10');

      await fireEvent.pointerDown(first, pointer('mouse', first));
      await fireEvent.pointerMove(first, pointer('mouse', button('2026-11-12')));
      // Another element got the release, so the next move goes to the day under the pointer.
      await fireEvent.pointerMove(button('2026-11-14'), pointer('mouse', button('2026-11-14'), 0));

      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(ends(onValueChange.mock.calls[0]!)).toEqual(['2026-11-10', '2026-11-12']);
      expect(onValueChange.mock.calls[0]![1].reason).toBe('drag');
      expect(screen.getByRole('group')).not.toHaveAttribute('data-selecting');

      await fireEvent.pointerMove(button('2026-11-20'), pointer('mouse', button('2026-11-20'), 0));

      expect(shown().end).toEqual(['2026-11-12']);
    });

    it('finds the day of a button whose slot renders an element', async () => {
      await render(
        <RangeCalendarAncestors level="month">
          <RangeCalendar.Grid>
            <RangeCalendar.GridBody
              v-slots={{
                week: ({ week }: { week: RangeCalendar.Week.Props['week'] }) => (
                  <RangeCalendar.Week
                    week={week}
                    v-slots={{
                      day: ({ day: date }: { day: Temporal.PlainDate }) => (
                        <RangeCalendar.Day day={date}>
                          <RangeCalendar.DayButton
                            v-slots={{
                              default: ({ text }: { text: string }) => (
                                <span style={{ display: 'block', padding: '8px' }}>{text}</span>
                              ),
                            }}
                          />
                        </RangeCalendar.Day>
                      ),
                    }}
                  />
                ),
              }}
            />
          </RangeCalendar.Grid>
        </RangeCalendarAncestors>,
      );
      const first = button('2026-11-10');
      const last = button('2026-11-12');
      expect(document.elementFromPoint(centerOf(last).x, centerOf(last).y)?.tagName).toBe('SPAN');

      await fireEvent.pointerDown(first, pointer('mouse', first));
      await fireEvent.pointerMove(first, pointer('mouse', last));

      expect(shown()).toEqual({
        start: ['2026-11-10'],
        middle: ['2026-11-11'],
        end: ['2026-11-12'],
      });
    });

    it('stops the drag when the browser cancels the pointer', async () => {
      const { onValueChange } = await renderRange();
      const first = button('2026-11-10');

      await fireEvent.pointerDown(first, pointer('touch', first));
      await fireEvent.pointerMove(first, pointer('touch', button('2026-11-12')));
      await fireEvent.pointerCancel(first, pointer('touch', first, 0));

      expect(onValueChange).not.toHaveBeenCalled();
      expect(shown()).toEqual({ start: [], middle: [], end: [] });
      expect(screen.getByRole('group')).not.toHaveAttribute('data-selecting');
    });

    it('follows one pointer only', async () => {
      const { onValueChange } = await renderRange();
      const first = button('2026-11-10');

      await fireEvent.pointerDown(first, pointer('touch', first));
      await fireEvent.pointerMove(first, {
        ...pointer('touch', button('2026-11-12')),
        pointerId: 8,
      });
      await fireEvent.pointerUp(first, {
        ...pointer('touch', button('2026-11-12'), 0),
        pointerId: 8,
      });

      expect(onValueChange).not.toHaveBeenCalled();
      expect(shown()).toEqual({ start: [], middle: [], end: [] });
    });

    it('ends a drag with Escape, and the click after the release makes no press', async () => {
      const { onValueChange } = await renderRange();
      const first = button('2026-11-10');

      await fireEvent.pointerDown(first, pointer('mouse', first));
      await fireEvent.pointerMove(first, pointer('mouse', button('2026-11-12')));
      expect(await fireEvent.keyDown(first, { key: 'Escape' })).toBe(false);
      await fireEvent.pointerUp(first, pointer('mouse', button('2026-11-12'), 0));
      // The button that holds the pointer gets the click of the release.
      await fireEvent.click(first, { detail: 1 });

      expect(onValueChange).not.toHaveBeenCalled();
      expect(shown()).toEqual({ start: [], middle: [], end: [] });
    });

    it.each([
      { name: 'a day that cannot be selected', props: { disabledDates: day('2026-11-10') } },
      { name: 'a read-only calendar', props: { readOnly: true } },
      { name: 'a disabled calendar', props: { disabled: true } },
    ])('does not start a drag on $name', async ({ props }) => {
      const { onValueChange } = await renderRange(props);
      const first = button('2026-11-10');

      await fireEvent.pointerDown(first, pointer('mouse', first));
      await fireEvent.pointerMove(first, pointer('mouse', button('2026-11-12')));
      await fireEvent.pointerUp(first, pointer('mouse', button('2026-11-12'), 0));

      expect(onValueChange).not.toHaveBeenCalled();
      expect(shown()).toEqual({ start: [], middle: [], end: [] });
    });

    it('discards the drag if the calendar becomes read-only before release', async () => {
      const { onValueChange, setProps } = await renderRange();
      const first = button('2026-11-10');
      const last = button('2026-11-12');
      await fireEvent.pointerDown(first, pointer('mouse', first));
      await fireEvent.pointerMove(first, pointer('mouse', last));

      await setProps({ readOnly: true });
      await fireEvent.pointerUp(first, pointer('mouse', last, 0));
      await fireEvent.click(first, { detail: 1 });

      expect(onValueChange).not.toHaveBeenCalled();
      expect(shown()).toEqual({ start: [], middle: [], end: [] });
    });

    it('does not start a drag with another button than the main button', async () => {
      const { onValueChange } = await renderRange();
      const first = button('2026-11-10');

      await fireEvent.pointerDown(first, { ...pointer('mouse', first), button: 2, buttons: 2 });
      await fireEvent.pointerUp(first, { ...pointer('mouse', button('2026-11-12'), 0), button: 2 });

      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('holds the pointer on the first button, and lets it go at the release', async () => {
      await renderRange();
      const first = button('2026-11-10');
      const setPointerCapture = vi.spyOn(first, 'setPointerCapture').mockImplementation(() => {});
      const releasePointerCapture = vi
        .spyOn(first, 'releasePointerCapture')
        .mockImplementation(() => {});
      vi.spyOn(first, 'hasPointerCapture').mockReturnValue(true);

      await fireEvent.pointerDown(first, pointer('mouse', first));
      expect(setPointerCapture).toHaveBeenCalledWith(7);

      await fireEvent.pointerUp(first, pointer('mouse', first, 0));
      expect(releasePointerCapture).toHaveBeenCalledWith(7);
    });

    it('gives the days a style that stops the scroll of a finger', async () => {
      await renderRange();

      expect(button('2026-11-10').style.touchAction).toBe('none');
    });
  });

  describe('with the real pointer of the browser', () => {
    it('makes a range with a drag of the mouse, and the click after it makes no press', async () => {
      const { onValueChange } = await renderRange();
      releasePointerAfterTest();

      await userEvent.pointer({ coords: centerOf(button('2026-11-10')), keys: '[MouseLeft>]' });
      await userEvent.pointer({ coords: centerOf(button('2026-11-12')) });
      expect(shown().end).toEqual(['2026-11-12']);
      await userEvent.pointer({ coords: centerOf(button('2026-11-14')) });
      await userEvent.pointer({ keys: '[/MouseLeft]' });

      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(ends(onValueChange.mock.calls[0]!)).toEqual(['2026-11-10', '2026-11-14']);
      expect(onValueChange.mock.calls[0]![1].reason).toBe('drag');
    });

    it('ends the drag when the mouse is released outside of the calendar', async () => {
      const { onValueChange } = await renderRange();
      releasePointerAfterTest();

      await userEvent.pointer({ coords: centerOf(button('2026-11-10')), keys: '[MouseLeft>]' });
      await userEvent.pointer({ coords: centerOf(button('2026-11-12')) });
      await userEvent.pointer({ coords: { x: 2, y: 2 } });
      await userEvent.pointer({ keys: '[/MouseLeft]' });

      expect(ends(onValueChange.mock.calls[0]!)).toEqual(['2026-11-10', '2026-11-12']);
    });

    it('makes a range with two clicks of the mouse', async () => {
      const { onValueChange, user } = await renderRange();

      await user.click(button('2026-11-10'));
      await user.click(button('2026-11-14'));

      expect(onValueChange).toHaveBeenCalledTimes(2);
      expect(ends(onValueChange.mock.calls[1]!)).toEqual(['2026-11-10', '2026-11-14']);
    });

    it.skipIf(!platform.engine.blink)(
      'makes a range with a drag of a finger, and the browser does not cancel the pointer',
      async () => {
        const onPointercancel = vi.fn();
        const { onValueChange } = await renderRange({ onPointercancel });

        await touchDrag(centerOf(button('2026-11-10')), centerOf(button('2026-11-14')));

        expect(ends(onValueChange.mock.calls[0]!)).toEqual(['2026-11-10', '2026-11-14']);
        expect(onPointercancel).not.toHaveBeenCalled();
      },
    );
  });
});
