import { describe, expect, it } from 'vitest';
import { defineComponent, KeepAlive, nextTick, shallowRef } from 'vue';
import { getMonthPage } from '../../internals/date-time/calendar/monthGrid';
import {
  createRenderer,
  describeConformance,
  expectSetupErrorWarnings,
  screen,
  takeReportedMessages,
} from '#test-utils';
import * as RangeCalendar from '../index.parts';
import RangeCalendarAncestors from '../root/RangeCalendarAncestors.test.vue';

// The day of the button is 2026-11-11, a Wednesday.
function format(options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...options }).format(
    Date.parse('2026-11-11'),
  );
}

describe('<RangeCalendar.DayButton />', () => {
  const { render } = createRenderer();

  function renderButton(props: Record<string, unknown> = {}, slots = {}) {
    return render(
      <RangeCalendarAncestors level="day">
        <RangeCalendar.DayButton {...props} data-testid="button" v-slots={slots} />
      </RangeCalendarAncestors>,
    );
  }

  describeConformance(<RangeCalendar.DayButton />, () => ({
    refInstanceof: window.HTMLButtonElement,
    button: true,
    testRenderPropWith: 'button',
    render: (node) => render(<RangeCalendarAncestors level="day">{node}</RangeCalendarAncestors>),
  }));

  it('focuses the visible day when a button mounts in a cached branch', async () => {
    const date = Temporal.PlainDate.from('2026-11-14');
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

  it('renders a button that has the day number, and the full date as its name', async () => {
    await renderButton();

    const button = screen.getByTestId('button');
    expect(button).toHaveAttribute('type', 'button');
    expect(button.textContent).toBe(format({ day: 'numeric' }));
    expect(button).toHaveAccessibleName(
      format({ weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
    );
    expect(button).toHaveAttribute('tabindex', '-1');
  });

  it('names the button with the format', async () => {
    await renderButton({ format: { month: 'short', day: 'numeric' } });

    expect(screen.getByTestId('button')).toHaveAccessibleName(
      format({ month: 'short', day: 'numeric' }),
    );
  });

  it('gives the day number to the default slot', async () => {
    await renderButton({}, { default: ({ text }: { text: string }) => `[${text}]` });

    expect(screen.getByTestId('button')).toHaveTextContent(`[${format({ day: 'numeric' })}]`);
  });

  it('gives the day number to the slot render', async () => {
    await renderButton(
      {},
      {
        render: ({ props, text }: { props: Record<string, unknown>; text: string }) => (
          <button {...props} data-testid="render">{`(${text})`}</button>
        ),
      },
    );

    expect(screen.getByTestId('render')).toHaveTextContent(`(${format({ day: 'numeric' })})`);
  });

  it('stops the scroll of a finger, and lets the style of the consumer replace it', async () => {
    const { rerender } = await renderButton();
    expect(screen.getByTestId('button').style.touchAction).toBe('none');

    await rerender(
      <RangeCalendarAncestors level="day">
        <RangeCalendar.DayButton data-testid="button" style={{ touchAction: 'pan-y' }} />
      </RangeCalendarAncestors>,
    );

    expect(screen.getByTestId('button').style.touchAction).toBe('pan-y');
  });

  it.each([
    { name: 'Enter', keys: '{Enter}' },
    { name: 'Space', keys: ' ' },
    { name: 'a click', keys: null },
  ])('presses a button that is not a native button with $name', async ({ keys }) => {
    const { user } = await renderButton({ as: 'div', nativeButton: false });
    const button = screen.getByTestId('button');

    expect(button).toHaveAttribute('role', 'button');
    if (keys === null) {
      await user.click(button);
    } else {
      button.focus();
      await user.keyboard(keys);
    }

    expect(document.querySelector('[data-date]')).toHaveAttribute('aria-selected', 'true');
    expect(document.querySelector('[data-date]')).toHaveAttribute('data-range-start');
  });

  // This case is the last of the file. In Vue 3.5.12, a `setup` that throws leaves the current
  // instance set, and each later case then gets a warning about a slot.
  it('throws a descriptive error when rendered outside <RangeCalendar.Day>', async () => {
    await expect(
      render(
        <RangeCalendarAncestors level="month">
          <RangeCalendar.DayButton />
        </RangeCalendarAncestors>,
      ),
    ).rejects.toThrow(
      'Vase UI: <RangeCalendar.DayButton> must be inside <RangeCalendar.Day>. Without a day the button has no date to select. Put the button inside <RangeCalendar.Day>.',
    );

    expectSetupErrorWarnings(takeReportedMessages());
  });
});
