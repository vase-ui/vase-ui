import { describe, expect, it, vi } from 'vitest';
import { defineComponent, KeepAlive, nextTick, shallowRef } from 'vue';
import { DirectionProvider } from '@vase-ui/vue/direction-provider';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  hydrate,
  mockBrowserToday,
  renderOnServer,
  screen,
  setAttributeInHtml,
} from '#test-utils';
import { getMonthPage } from '../../internals/date-time/calendar/monthGrid';
import * as RangeCalendar from '../index.parts';
import RangeCalendarAnatomy from './RangeCalendarAnatomy.test.vue';
import RangeCalendarRootHydration from './RangeCalendarRootHydration.test.vue';

const day = (text: string) => Temporal.PlainDate.from(text);

// 2026-11-14 is a Saturday. With `en-US`, the weeks start on Sunday and 2026-11-01 is a Sunday.
const today = () => day('2026-11-14');

function cell(iso: string) {
  return document.querySelector<HTMLElement>(`[data-date="${iso}"]`)!;
}

function button(iso: string) {
  return cell(iso).querySelector<HTMLElement>('button')!;
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

describe('<RangeCalendar.Root />', () => {
  const { render } = createRenderer();

  // The props go through a spread, because the fixture declares none.
  function renderRange(props: Record<string, unknown> = {}) {
    return render(<RangeCalendarAnatomy {...{ today: today(), locale: 'en-US', ...props }} />);
  }

  function listeners() {
    return { onValueChange: vi.fn(), 'onUpdate:modelValue': vi.fn() };
  }

  describeConformance(<RangeCalendar.Root today={today()} />, () => ({
    refInstanceof: window.HTMLDivElement,
    render,
  }));

  it('renders a group that the visible month names, and a grid with more than one selection', async () => {
    await renderRange();

    const name = new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      month: 'long',
      year: 'numeric',
    }).format(Date.parse('2026-11-14'));
    expect(screen.getByRole('group', { name })).not.toBe(null);
    expect(screen.getByRole('grid')).toHaveAttribute('aria-multiselectable', 'true');
    expect(screen.getByRole('group')).toHaveAttribute('data-empty');
    expect(screen.getByRole('group')).not.toHaveAttribute('data-selecting');
  });

  it('focuses the visible day when a button mounts in a cached branch', async () => {
    const date = today();
    const month = getMonthPage(date.toPlainYearMonth(), 1);
    const root = shallowRef<{ focus(): void } | null>(null);
    const first = shallowRef(true);
    const mounted = shallowRef(false);
    const Cached = defineComponent(
      () => () => (mounted.value ? <RangeCalendar.DayButton data-testid="cached" /> : null),
    );
    const Other = defineComponent(() => () => <RangeCalendar.DayButton data-testid="other" />);
    const Host = defineComponent(() => () => (
      <RangeCalendar.Root ref={root} today={date}>
        <RangeCalendar.Month month={month}>
          <RangeCalendar.Day day={date}>
            <KeepAlive>{first.value ? <Cached /> : <Other />}</KeepAlive>
          </RangeCalendar.Day>
        </RangeCalendar.Month>
      </RangeCalendar.Root>
    ));
    await render(<Host />);

    first.value = false;
    await nextTick();
    mounted.value = true;
    await nextTick();
    root.value!.focus();
    await nextTick();
    expect(screen.getByTestId('other')).toHaveFocus();

    first.value = true;
    await nextTick();
    root.value!.focus();
    await nextTick();
    expect(screen.getByTestId('cached')).toHaveFocus();
  });

  it('names RangeCalendar in the message of a default month that changes', async () => {
    const { setProps } = await renderRange({
      defaultMonth: Temporal.PlainYearMonth.from('2026-11'),
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await setProps({ defaultMonth: Temporal.PlainYearMonth.from('2026-12') });

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0]![0]).toContain(
      'A component is changing the default month state of an uncontrolled RangeCalendar after being initialized.',
    );
  });

  describe('the press sequence', () => {
    it('starts a range at the first press, and shows it as a range of one day', async () => {
      const handlers = listeners();
      const { user } = await renderRange(handlers);

      await user.click(button('2026-11-10'));

      expect(handlers.onValueChange).toHaveBeenCalledTimes(1);
      const [value, details] = handlers.onValueChange.mock.calls[0]!;
      expect(ends([value])).toEqual(['2026-11-10', null]);
      expect(details.reason).toBe('day-press');
      expect(details.event).toBeInstanceOf(MouseEvent);
      expect(ends([handlers['onUpdate:modelValue'].mock.calls[0]![0]])).toEqual([
        '2026-11-10',
        null,
      ]);
      expect(shown()).toEqual({ start: ['2026-11-10'], middle: [], end: ['2026-11-10'] });
      expect(cell('2026-11-10')).toHaveAttribute('aria-selected', 'true');
      expect(cell('2026-11-10')).toHaveAttribute('data-selected');
      expect(screen.getByRole('group')).toHaveAttribute('data-selecting');
      expect(screen.getByRole('group')).not.toHaveAttribute('data-empty');
    });

    it('ends the range at the second press', async () => {
      const handlers = listeners();
      const { user } = await renderRange(handlers);

      await user.click(button('2026-11-10'));
      await user.click(button('2026-11-14'));

      expect(handlers.onValueChange).toHaveBeenCalledTimes(2);
      expect(ends(handlers.onValueChange.mock.calls[1]!)).toEqual(['2026-11-10', '2026-11-14']);
      expect(shown()).toEqual({
        start: ['2026-11-10'],
        middle: ['2026-11-11', '2026-11-12', '2026-11-13'],
        end: ['2026-11-14'],
      });
      expect(cell('2026-11-12')).toHaveAttribute('aria-selected', 'true');
      expect(cell('2026-11-15')).toHaveAttribute('aria-selected', 'false');
      expect(screen.getByRole('group')).not.toHaveAttribute('data-selecting');
    });

    it('gives a range of one day the start and the end, and no middle', async () => {
      const { user } = await renderRange();

      await user.click(button('2026-11-10'));
      await user.click(button('2026-11-10'));

      expect(shown()).toEqual({ start: ['2026-11-10'], middle: [], end: ['2026-11-10'] });
      expect(screen.getByRole('group')).not.toHaveAttribute('data-selecting');
    });

    it('presses the focused day with Enter and Space', async () => {
      const handlers = listeners();
      const { user } = await renderRange(handlers);

      button('2026-11-10').focus();
      await user.keyboard('{Enter}{ArrowRight}{ArrowRight} ');

      expect(handlers.onValueChange).toHaveBeenCalledTimes(2);
      expect(ends(handlers.onValueChange.mock.calls[1]!)).toEqual(['2026-11-10', '2026-11-12']);
      expect(handlers.onValueChange.mock.calls[1]![1].reason).toBe('day-press');
    });

    it('keeps the old range when a listener cancels the change', async () => {
      const handlers = {
        onValueChange: vi.fn((_value: unknown, details: { cancel: () => void }) => {
          details.cancel();
        }),
        'onUpdate:modelValue': vi.fn(),
      };
      const { user } = await renderRange({
        defaultValue: [day('2026-11-03'), day('2026-11-05')],
        ...handlers,
      });

      await user.click(button('2026-11-10'));

      expect(handlers.onValueChange).toHaveBeenCalledTimes(1);
      expect(handlers['onUpdate:modelValue']).not.toHaveBeenCalled();
      expect(shown().start).toEqual(['2026-11-03']);
    });

    it('does not pick a day of a read-only range, and a day that cannot be selected', async () => {
      const handlers = listeners();
      const readOnly = await renderRange({ readOnly: true, ...handlers });

      await readOnly.user.click(button('2026-11-10'));
      expect(handlers.onValueChange).not.toHaveBeenCalled();
      expect(screen.getByRole('grid')).toHaveAttribute('aria-readonly', 'true');
      readOnly.unmount();

      const limited = await renderRange({ unavailableDates: day('2026-11-10'), ...handlers });
      await limited.user.click(button('2026-11-10'));
      expect(handlers.onValueChange).not.toHaveBeenCalled();
    });

    it.each([
      { name: 'minDays', props: { minDays: 3 }, last: '2026-11-11' },
      { name: 'maxDays', props: { maxDays: 3 }, last: '2026-11-14' },
      {
        name: 'a disabled day in the range',
        props: { disabledDates: day('2026-11-12') },
        last: '2026-11-14',
      },
      {
        name: 'an unavailable day in the range',
        props: { unavailableDates: day('2026-11-12') },
        last: '2026-11-14',
      },
    ])('starts a new range at the pressed day because of $name', async ({ props, last }) => {
      const handlers = listeners();
      const { user } = await renderRange({ ...props, ...handlers });

      await user.click(button('2026-11-10'));
      await user.click(button(last));

      expect(ends(handlers.onValueChange.mock.calls[1]!)).toEqual([last, null]);
    });

    it.each([
      { name: 'a disabled day', props: { disabledDates: day('2026-11-12') } },
      { name: 'an unavailable day', props: { unavailableDates: day('2026-11-12') } },
    ])('makes a range over $name with allowNonContiguousRanges', async ({ props }) => {
      const handlers = listeners();
      const { user } = await renderRange({
        allowNonContiguousRanges: true,
        ...props,
        ...handlers,
      });

      await user.click(button('2026-11-10'));
      await user.click(button('2026-11-14'));

      expect(ends(handlers.onValueChange.mock.calls[1]!)).toEqual(['2026-11-10', '2026-11-14']);
      // The day in the middle is in the range, and the user cannot select it.
      expect(cell('2026-11-12')).toHaveAttribute('data-range-middle');
      expect(cell('2026-11-12')).toHaveAttribute('aria-selected', 'false');
      expect(cell('2026-11-11')).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('the value', () => {
    it('writes the selected range to v-model and follows the range set by the parent', async () => {
      const range = shallowRef<readonly [Temporal.PlainDate | null, Temporal.PlainDate | null]>([
        null,
        null,
      ]);
      const { user } = await render(() => (
        <RangeCalendarAnatomy {...{ today: today(), locale: 'en-US' }} v-model={range.value} />
      ));
      await user.click(button('2026-11-10'));
      await user.click(button('2026-11-11'));
      expect(range.value.map((date) => date?.toString())).toEqual(['2026-11-10', '2026-11-11']);

      range.value = [null, null];
      await flushMicrotasks();
      expect(shown()).toEqual({ start: [], middle: [], end: [] });
    });

    it('leaves the range of a controlled calendar to its value', async () => {
      const handlers = listeners();
      const { user, setProps } = await renderRange({
        modelValue: [null, null],
        onValueChange: handlers.onValueChange,
      });

      await user.click(button('2026-11-10'));

      expect(handlers.onValueChange).toHaveBeenCalledTimes(1);
      expect(shown()).toEqual({ start: [], middle: [], end: [] });

      await setProps({ modelValue: [day('2026-11-10'), null] });

      expect(shown()).toEqual({ start: ['2026-11-10'], middle: [], end: ['2026-11-10'] });
      expect(screen.getByRole('group')).toHaveAttribute('data-selecting');
    });

    it('shows a controlled range with a null end as a range in progress, and ends it', async () => {
      const handlers = listeners();
      const { user } = await renderRange({ modelValue: [day('2026-11-10'), null], ...handlers });

      expect(screen.getByRole('group')).toHaveAttribute('data-selecting');
      await user.click(button('2026-11-14'));

      expect(ends(handlers.onValueChange.mock.calls[0]!)).toEqual(['2026-11-10', '2026-11-14']);
    });

    it('shows a range that the consumer gives in the reverse order', async () => {
      await renderRange({ modelValue: [day('2026-11-14'), day('2026-11-10')] });

      expect(shown().start).toEqual(['2026-11-10']);
      expect(shown().end).toEqual(['2026-11-14']);
    });

    it('gives each end the time and the zone of the end that it replaces', async () => {
      const handlers = listeners();
      const { user } = await renderRange({
        defaultValue: [
          Temporal.ZonedDateTime.from('2026-11-02T09:00[Asia/Tokyo]'),
          Temporal.ZonedDateTime.from('2026-11-04T17:30[Asia/Tokyo]'),
        ],
        ...handlers,
      });

      await user.click(button('2026-11-10'));
      await user.click(button('2026-11-12'));

      const [value] = handlers.onValueChange.mock.calls[1]!;
      expect(value.map((end: Temporal.ZonedDateTime) => end.toString())).toEqual([
        '2026-11-10T09:00:00+09:00[Asia/Tokyo]',
        '2026-11-12T17:30:00+09:00[Asia/Tokyo]',
      ]);
    });
  });

  describe('the preview', () => {
    it('shows the range to the day that the pointer is over', async () => {
      const { user } = await renderRange();

      await user.click(button('2026-11-10'));
      await user.hover(button('2026-11-13'));

      expect(shown()).toEqual({
        start: ['2026-11-10'],
        middle: ['2026-11-11', '2026-11-12'],
        end: ['2026-11-13'],
      });
      expect(cell('2026-11-12')).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('group')).toHaveAttribute('data-selecting');

      await user.hover(button('2026-11-08'));

      expect(shown()).toEqual({
        start: ['2026-11-08'],
        middle: ['2026-11-09'],
        end: ['2026-11-10'],
      });
    });

    it('shows the range to the day that has the focus', async () => {
      const { user } = await renderRange();

      await user.click(button('2026-11-10'));
      button('2026-11-12').focus();
      await flushMicrotasks();

      expect(shown()).toEqual({
        start: ['2026-11-10'],
        middle: ['2026-11-11'],
        end: ['2026-11-12'],
      });
    });

    it('ends the range at the previewed day when the day is pressed', async () => {
      const handlers = listeners();
      const { user } = await renderRange(handlers);

      await user.click(button('2026-11-10'));
      await user.keyboard('{ArrowRight}{ArrowRight}');
      expect(shown().end).toEqual(['2026-11-12']);
      await user.keyboard('{Enter}');

      expect(ends(handlers.onValueChange.mock.calls[1]!)).toEqual(['2026-11-10', '2026-11-12']);
    });

    it('shows the day that a press would start a new range at, when the range is not valid', async () => {
      const { user } = await renderRange({ maxDays: 3 });

      await user.click(button('2026-11-10'));
      await user.hover(button('2026-11-20'));

      expect(shown()).toEqual({ start: ['2026-11-20'], middle: [], end: ['2026-11-20'] });
    });

    it('shows no preview when no range is in progress', async () => {
      const { user } = await renderRange({ defaultValue: [day('2026-11-03'), day('2026-11-05')] });

      await user.hover(button('2026-11-13'));

      expect(shown().end).toEqual(['2026-11-05']);
    });

    it('shows no preview for a touch pointer, which does not hover', async () => {
      const { user } = await renderRange();

      await user.click(button('2026-11-10'));
      await fireEvent.pointerEnter(button('2026-11-20'), { pointerType: 'touch' });

      expect(shown().end).toEqual(['2026-11-10']);
    });
  });

  describe('Escape', () => {
    it('puts back the range from before the first press, and prevents the key', async () => {
      const handlers = listeners();
      const { user } = await renderRange({
        defaultValue: [day('2026-11-03'), day('2026-11-05')],
        ...handlers,
      });

      await user.click(button('2026-11-10'));
      expect(shown().start).toEqual(['2026-11-10']);
      expect(await fireEvent.keyDown(button('2026-11-10'), { key: 'Escape' })).toBe(false);

      expect(ends(handlers.onValueChange.mock.calls[1]!)).toEqual(['2026-11-03', '2026-11-05']);
      expect(handlers.onValueChange.mock.calls[1]![1].reason).toBe('keyboard');
      expect(shown()).toEqual({
        start: ['2026-11-03'],
        middle: ['2026-11-04'],
        end: ['2026-11-05'],
      });
      expect(screen.getByRole('group')).not.toHaveAttribute('data-selecting');
    });

    it('puts back the range when the focus is on a button that is not a day', async () => {
      const handlers = listeners();
      const { user } = await renderRange({
        defaultValue: [day('2026-11-03'), day('2026-11-05')],
        nextButton: true,
        ...handlers,
      });
      await user.click(button('2026-11-10'));
      expect(shown().start).toEqual(['2026-11-10']);
      screen.getByTestId('next').focus();

      expect(await fireEvent.keyDown(screen.getByTestId('next'), { key: 'Escape' })).toBe(false);

      expect(ends(handlers.onValueChange.mock.calls[1]!)).toEqual(['2026-11-03', '2026-11-05']);
      expect(handlers.onValueChange.mock.calls[1]![1].reason).toBe('keyboard');
      expect(shown().start).toEqual(['2026-11-03']);
      expect(screen.getByRole('group')).not.toHaveAttribute('data-selecting');
    });

    it('does not prevent the key when no range is in progress', async () => {
      const handlers = listeners();
      await renderRange({ defaultValue: [day('2026-11-03'), day('2026-11-05')], ...handlers });

      expect(await fireEvent.keyDown(button('2026-11-10'), { key: 'Escape' })).toBe(true);
      expect(handlers.onValueChange).not.toHaveBeenCalled();
    });
  });

  describe('Shift with an arrow key', () => {
    async function pressKeys(keys: string, { props = {}, rtl = false, from = '2026-11-11' } = {}) {
      const handlers = listeners();
      const calendar = (
        <RangeCalendarAnatomy {...{ today: today(), locale: 'en-US', ...props, ...handlers }} />
      );
      const { user } = await render(
        rtl ? <DirectionProvider direction="rtl">{calendar}</DirectionProvider> : calendar,
      );
      button(from).focus();
      await user.keyboard(keys);
      return handlers;
    }

    const rangesOf = (handlers: ReturnType<typeof listeners>) =>
      handlers.onValueChange.mock.calls.map((call) => ends(call));

    it.each([
      {
        keys: '{Shift>}{ArrowRight}{/Shift}',
        range: ['2026-11-11', '2026-11-12'],
        focus: '2026-11-12',
      },
      {
        keys: '{Shift>}{ArrowLeft}{/Shift}',
        range: ['2026-11-10', '2026-11-11'],
        focus: '2026-11-10',
      },
      {
        keys: '{Shift>}{ArrowDown}{/Shift}',
        range: ['2026-11-11', '2026-11-18'],
        focus: '2026-11-18',
      },
      {
        keys: '{Shift>}{ArrowUp}{/Shift}',
        range: ['2026-11-04', '2026-11-11'],
        focus: '2026-11-04',
      },
    ])('makes the range $range for $keys', async ({ keys, range, focus }) => {
      const handlers = await pressKeys(keys);

      expect(rangesOf(handlers)).toEqual([range]);
      expect(handlers.onValueChange.mock.calls[0]![1].reason).toBe('keyboard');
      expect(document.activeElement).toBe(button(focus));
      expect(screen.getByRole('group')).not.toHaveAttribute('data-selecting');
    });

    it('extends the range from the day where it started, as the keys go on', async () => {
      const handlers = await pressKeys(
        '{Shift>}{ArrowRight}{ArrowRight}{ArrowDown}{ArrowLeft}{/Shift}',
      );

      expect(rangesOf(handlers)).toEqual([
        ['2026-11-11', '2026-11-12'],
        ['2026-11-11', '2026-11-13'],
        ['2026-11-11', '2026-11-20'],
        ['2026-11-11', '2026-11-19'],
      ]);
    });

    it('starts again from the day that has the focus after a key with no Shift', async () => {
      const handlers = await pressKeys(
        '{Shift>}{ArrowRight}{/Shift}{ArrowRight}{Shift>}{ArrowRight}{/Shift}',
      );

      expect(rangesOf(handlers)).toEqual([
        ['2026-11-11', '2026-11-12'],
        ['2026-11-13', '2026-11-14'],
      ]);
    });

    it('ends a range in progress at the day of the key', async () => {
      const handlers = await pressKeys('{Shift>}{ArrowDown}{/Shift}', {
        props: { defaultValue: [day('2026-11-05'), null] },
      });

      expect(rangesOf(handlers)).toEqual([['2026-11-05', '2026-11-18']]);
    });

    it('swaps Left and Right in a right-to-left page', async () => {
      const handlers = await pressKeys('{Shift>}{ArrowLeft}{/Shift}', { rtl: true });

      expect(rangesOf(handlers)).toEqual([['2026-11-11', '2026-11-12']]);
    });

    it('moves the page and not a month when the key leaves the page', async () => {
      const handlers = await pressKeys('{Shift>}{ArrowRight}{/Shift}', { from: '2026-11-30' });

      expect(rangesOf(handlers)).toEqual([['2026-11-30', '2026-12-01']]);
      expect(document.activeElement).toBe(button('2026-12-01'));
    });

    it('moves the focus over a day that cannot be selected, and makes no range over it', async () => {
      const props = { disabledDates: day('2026-11-12') };
      const handlers = await pressKeys('{Shift>}{ArrowRight}{/Shift}', { props });

      expect(rangesOf(handlers)).toEqual([]);
      expect(document.activeElement).toBe(button('2026-11-13'));
    });

    it('makes the range over a day that cannot be selected with allowNonContiguousRanges', async () => {
      const props = { disabledDates: day('2026-11-12'), allowNonContiguousRanges: true };
      const handlers = await pressKeys('{Shift>}{ArrowRight}{/Shift}', { props });

      expect(rangesOf(handlers)).toEqual([['2026-11-11', '2026-11-13']]);
    });
  });

  describe('the server render', () => {
    const file = 'src/range-calendar/root/RangeCalendarRootHydration.test.vue';
    const props = { today: '2026-11-14', start: '2026-11-10', end: '2026-11-12' };
    const format = (options: Intl.DateTimeFormatOptions, iso: string) =>
      new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...options }).format(Date.parse(iso));

    // A server whose `Intl` data differs writes other names. The part then writes the name of the
    // browser after the mount.
    it.each([
      {
        name: 'the root',
        selector: '[role="group"]',
        label: format({ month: 'long', year: 'numeric' }, '2026-11-01'),
      },
      {
        name: 'a day button',
        selector: '[data-date="2026-11-14"] button',
        label: format(
          { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' },
          '2026-11-14',
        ),
      },
    ])(
      'gives $name the aria-label of the browser when the server wrote another text',
      async ({ selector, label }) => {
        const serverHtml = setAttributeInHtml(
          await renderOnServer(file, props),
          selector,
          'aria-label',
          'other',
        );

        const { container } = await hydrate(RangeCalendarRootHydration, { serverHtml, props });

        expect(container.querySelector(selector)).toHaveAttribute('aria-label', label);
      },
    );

    it('writes the text of a day again with no warning when the server wrote another text', async () => {
      const text = format({ day: 'numeric' }, '2026-11-14');
      const serverHtml = (await renderOnServer(file, props)).replace(`>${text}<`, '>other<');
      expect(serverHtml).toContain('>other<');

      const { container } = await hydrate(RangeCalendarRootHydration, { serverHtml, props });

      expect(container.querySelector('[data-date="2026-11-14"] button')).toHaveTextContent(text);
      expect(container).not.toHaveTextContent('other');
    });

    it.each([
      { name: 'another day', distance: 'day' as const },
      { name: 'another month', distance: 'month' as const },
    ])("shows the browser's today after the hydration: $name", async ({ distance }) => {
      const clockProps = { locale: 'en-US' };
      const serverHtml = await renderOnServer(file, clockProps);
      const browserDay = mockBrowserToday(distance).toString();

      await hydrate(RangeCalendarRootHydration, { serverHtml, props: clockProps });

      const todayDates = [...document.querySelectorAll<HTMLElement>('[data-today]')].map(
        (element) => element.closest<HTMLElement>('[data-date]')!.dataset.date,
      );
      expect(todayDates).toEqual([browserDay, browserDay]);
      expect(button(browserDay)).toHaveAttribute('aria-current', 'date');
      const tabStops = [...document.querySelectorAll<HTMLElement>('button[tabindex="0"]')];
      expect(tabStops).toEqual([button(browserDay)]);
      const pageMonths = new Set(
        [...document.querySelectorAll<HTMLElement>('[data-date]:not([data-outside-month])')].map(
          (element) => element.dataset.date!.slice(0, 7),
        ),
      );
      expect(pageMonths).toEqual(new Set([browserDay.slice(0, 7)]));
    });

    // A `-u-` keyword gives the server other `Intl` data than the browser.
    it.each([
      { name: 'a Persian server', server: 'en-US-u-ca-persian' },
      { name: 'a server week from Monday', server: 'en-US-u-fw-mon' },
    ])('hydrates the grid of $name, then shows the grid of the browser', async ({ server }) => {
      const browser = { ...props, locale: 'en-US' };
      const serverHtml = await renderOnServer(file, { ...browser, locale: server });

      await hydrate(RangeCalendarRootHydration, { serverHtml, props: browser });

      expect(shown()).toEqual({
        start: ['2026-11-10'],
        middle: ['2026-11-11'],
        end: ['2026-11-12'],
      });
    });
  });
});
