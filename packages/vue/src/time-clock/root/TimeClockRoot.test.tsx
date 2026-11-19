import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { shallowRef } from 'vue';
import { TimeClock } from '@vase-ui/vue/time-clock';
import type { TimeClockFaceNumber, TimeClockView } from '@vase-ui/vue/time-clock';
import {
  createRenderer,
  describeConformance,
  expectNoAxeViolations,
  fireEvent,
  flushMicrotasks,
  hydrate,
  hydrateAfter,
  mockRuntimeDateTimeLocale,
  renderOnServer,
  screen,
  setAttributeInHtml,
  takeReportedMessages,
  within,
} from '#test-utils';
import { pointOnFace } from '../../../test/time-clockTestUtils';
import TimeClockRootHydration from './TimeClockRootHydration.test.vue';

const time = (text: string) => Temporal.PlainTime.from(text);
const numberSlot = {
  number: ({ number }: { number: TimeClockFaceNumber }) => <TimeClock.Number number={number} />,
};

const unitName = (unit: TimeClockView) =>
  new Intl.DisplayNames('en-US', { type: 'dateTimeField' }).of(unit)!;
const twoDigits = new Intl.NumberFormat('en-US', { minimumIntegerDigits: 2, useGrouping: false });
const dayPeriodOf = (hour: number) =>
  new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: true, timeZone: 'UTC' })
    .formatToParts(Date.UTC(2026, 10, 14, hour))
    .find((part) => part.type === 'dayPeriod')!.value;

describe('<TimeClock.Root />', () => {
  const { render } = createRenderer();

  describeConformance(<TimeClock.Root />, () => ({
    render,
    refInstanceof: window.HTMLDivElement,
  }));

  describe('group', () => {
    it('renders a group that names the state in data attributes', async () => {
      await render(<TimeClock.Root aria-label="Start time" data-testid="root" />);

      const root = screen.getByRole('group', { name: 'Start time' });
      expect(root).toBe(screen.getByTestId('root'));
      expect(root).toHaveAttribute('data-view', 'hour');
      expect(root).toHaveAttribute('data-empty');
      for (const attribute of ['data-disabled', 'data-readonly', 'data-dragging']) {
        expect(root).not.toHaveAttribute(attribute);
      }
    });

    it.each([
      { prop: 'disabled', attribute: 'data-disabled' },
      { prop: 'readOnly', attribute: 'data-readonly' },
    ])('sets $attribute for the prop $prop', async ({ prop, attribute }) => {
      await render(
        <TimeClock.Root data-testid="root" defaultValue={time('10:30')} {...{ [prop]: true }} />,
      );

      expect(screen.getByTestId('root')).toHaveAttribute(attribute);
      expect(screen.getByTestId('root')).not.toHaveAttribute('data-empty');
    });
  });

  describe('value', () => {
    async function changeByKey(extra: Record<string, unknown>) {
      const onValueChange = vi.fn();
      const { user } = await render(
        <TimeClock.Root locale="en-US" hourCycle={12} onValueChange={onValueChange} {...extra}>
          <TimeClock.Face />
        </TimeClock.Root>,
      );
      await user.tab();
      await user.keyboard('{ArrowRight}');
      return onValueChange.mock.calls[0]?.[0] as Temporal.PlainTime | undefined;
    }

    it.each([
      {
        name: 'a time',
        props: { defaultValue: time('10:30') },
        kind: 'PlainTime',
        text: '11:30:00',
      },
      {
        name: 'a date and a time',
        props: { defaultValue: Temporal.PlainDateTime.from('2026-11-14T10:30') },
        kind: 'PlainDateTime',
        text: '2026-11-14T11:30:00',
      },
      {
        name: 'a time in a zone',
        props: { defaultValue: Temporal.ZonedDateTime.from('2026-11-14T10:30[Europe/Paris]') },
        kind: 'ZonedDateTime',
        text: '2026-11-14T11:30:00+01:00[Europe/Paris]',
      },
      {
        name: 'a time in another calendar',
        props: { defaultValue: Temporal.PlainDateTime.from('2026-11-14T10:30[u-ca=persian]') },
        kind: 'PlainDateTime',
        text: '2026-11-14T11:30:00[u-ca=persian]',
      },
      {
        name: 'the reference of a clock with no value',
        props: { referenceDate: Temporal.PlainDateTime.from('2026-11-14T00:00') },
        kind: 'PlainDateTime',
        text: '2026-11-14T01:00:00',
      },
      { name: 'a clock with no reference', props: {}, kind: 'PlainTime', text: '01:00:00' },
    ])('gives back the kind of $name', async ({ props, kind, text }) => {
      const value = await changeByKey(props);

      expect(Object.prototype.toString.call(value)).toBe(`[object Temporal.${kind}]`);
      expect(String(value)).toBe(text);
    });

    it('changes the time of an uncontrolled clock', async () => {
      const { user } = await render(
        <TimeClock.Root locale="en-US" hourCycle={12} defaultValue={time('10:30')}>
          <TimeClock.Face />
        </TimeClock.Root>,
      );

      await user.tab();
      await user.keyboard('{ArrowRight}');

      expect(screen.getByRole('slider')).toHaveValue('11');
    });

    it('keeps the time of a controlled clock until the parent changes it', async () => {
      const model = shallowRef<Temporal.PlainTime | null>(time('10:30'));
      const calls: string[] = [];
      const { user } = await render(() => (
        <TimeClock.Root
          locale="en-US"
          hourCycle={12}
          modelValue={model.value}
          onValueChange={(value: Temporal.PlainTime) => calls.push(`change ${value.hour}`)}
          {...{
            'onUpdate:modelValue': (value: Temporal.PlainTime) => {
              calls.push(`update ${value.hour}`);
              model.value = value;
            },
          }}
        >
          <TimeClock.Face />
        </TimeClock.Root>
      ));

      await user.tab();
      await user.keyboard('{ArrowRight}');

      expect(calls).toEqual(['change 11', 'update 11']);
      expect(screen.getByRole('slider')).toHaveValue('11');

      model.value = time('02:00');
      await flushMicrotasks();

      expect(screen.getByRole('slider')).toHaveValue('2');
    });

    it('keeps the time of a controlled clock whose parent does not update it', async () => {
      const { user } = await render(
        <TimeClock.Root locale="en-US" hourCycle={12} modelValue={time('10:30')}>
          <TimeClock.Face />
        </TimeClock.Root>,
      );

      await user.tab();
      await user.keyboard('{ArrowRight}');

      expect(screen.getByRole('slider')).toHaveValue('10');
    });

    it('stops a change that a listener cancels', async () => {
      const onUpdate = vi.fn();
      const { user } = await render(
        <TimeClock.Root
          locale="en-US"
          hourCycle={12}
          defaultValue={time('10:30')}
          onValueChange={(_value: unknown, details: { cancel: () => void }) => {
            details.cancel();
          }}
          {...{ 'onUpdate:modelValue': onUpdate }}
        >
          <TimeClock.Face />
        </TimeClock.Root>,
      );

      await user.tab();
      await user.keyboard('{ArrowRight}');

      expect(onUpdate).not.toHaveBeenCalled();
      expect(screen.getByRole('slider')).toHaveValue('10');
    });

    it('does not give a value for a press on the number of the time that is out of the range', async () => {
      const onValueChange = vi.fn();
      const onValueCommitted = vi.fn();
      await render(
        <TimeClock.Root
          locale="en-US"
          hourCycle={12}
          defaultValue={time('09:15')}
          minTime={time('09:30')}
          onValueChange={onValueChange}
          onValueCommitted={onValueCommitted}
        >
          <TimeClock.Face data-testid="face" style={{ width: '200px', height: '200px' }} />
        </TimeClock.Root>,
      );
      const face = screen.getByTestId('face');
      const init = { button: 0, buttons: 1, pointerId: 1, ...pointOnFace(face, 270) };

      await fireEvent.pointerDown(face, init);
      await fireEvent.pointerUp(face, init);

      expect(onValueChange).not.toHaveBeenCalled();
      expect(String(onValueCommitted.mock.calls[0]?.[0])).toBe('09:15:00');
    });
  });

  describe('view', () => {
    it('starts at the hours, or at the default view', async () => {
      await render(
        <>
          <TimeClock.Root data-testid="hours" />
          <TimeClock.Root data-testid="seconds" defaultView="second" />
        </>,
      );

      expect(screen.getByTestId('hours')).toHaveAttribute('data-view', 'hour');
      expect(screen.getByTestId('seconds')).toHaveAttribute('data-view', 'second');
    });

    it.each([
      { name: 'the minutes', granularity: 'minute', views: ['minute'] },
      { name: 'the seconds', granularity: 'second', views: ['minute', 'second'] },
      { name: 'no view for the hours', granularity: 'hour', views: [] },
    ] as const)('commits and goes on to $name', async ({ granularity, views }) => {
      const onViewChange = vi.fn();
      const { user } = await render(
        <TimeClock.Root
          locale="en-US"
          defaultValue={time('10:30')}
          granularity={granularity}
          onViewChange={onViewChange}
          data-testid="root"
        >
          <TimeClock.Face />
        </TimeClock.Root>,
      );
      await user.tab();

      await user.keyboard('{Enter}{Enter}{Enter}');

      expect(onViewChange.mock.calls.map(([view]) => view)).toEqual(views);
      for (const call of onViewChange.mock.calls) {
        expect(call[1]).toMatchObject({ reason: 'keyboard' });
      }
    });

    it('keeps a controlled view until the parent changes it', async () => {
      const view = shallowRef<TimeClockView>('hour');
      const onViewChange = vi.fn();
      const { user } = await render(() => (
        <TimeClock.Root
          locale="en-US"
          defaultValue={time('10:30')}
          view={view.value}
          onViewChange={onViewChange}
          {...{ 'onUpdate:view': (value: TimeClockView) => (view.value = value) }}
          data-testid="root"
        >
          <TimeClock.Face />
        </TimeClock.Root>
      ));
      await user.tab();

      await user.keyboard('{Enter}');

      expect(onViewChange.mock.calls[0]?.[0]).toBe('minute');
      expect(screen.getByTestId('root')).toHaveAttribute('data-view', 'minute');
    });
  });

  describe('hour cycle', () => {
    function renderFace(props: Record<string, unknown>) {
      return render(
        <TimeClock.Root {...props}>
          <TimeClock.DayPeriod value="am" data-testid="am" />
          <TimeClock.Face v-slots={numberSlot} />
        </TimeClock.Root>,
      );
    }

    it.each([
      { name: 'a locale with 12 hours', props: { locale: 'en-US' }, numbers: 12, dayPeriod: true },
      { name: 'a locale with 24 hours', props: { locale: 'de-DE' }, numbers: 24, dayPeriod: false },
      {
        name: 'the prop over the locale',
        props: { locale: 'de-DE', hourCycle: 12 },
        numbers: 12,
        dayPeriod: true,
      },
      {
        name: 'the prop over the locale of 12',
        props: { locale: 'en-US', hourCycle: 24 },
        numbers: 24,
        dayPeriod: false,
      },
    ])('has the hour cycle of $name', async ({ props, numbers, dayPeriod }) => {
      await renderFace(props);

      expect(
        screen.getAllByText(/\d/).filter((node) => node.hasAttribute('aria-hidden')),
      ).toHaveLength(numbers);
      expect(screen.queryByTestId('am') !== null).toBe(dayPeriod);
    });

    it('uses the hour cycle of the runtime locale when the clock has no locale', async () => {
      mockRuntimeDateTimeLocale('de-DE');

      await renderFace({});

      expect(screen.queryByTestId('am')).toBeNull();
    });
  });

  describe('step', () => {
    it('warns when the second step becomes invalid after mount', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      onTestFinished(() => warn.mockRestore());
      const { setProps } = await render(
        <TimeClock.Root defaultView="second" granularity="second" secondStep={5}>
          <TimeClock.Face />
        </TimeClock.Root>,
      );
      const slider = screen.getByRole('slider');
      expect(slider).toHaveAttribute('step', '5');

      await setProps({ secondStep: 0 });

      expect(warn).toHaveBeenCalledExactlyOnceWith(expect.stringContaining('`secondStep`'));
      expect(slider).toHaveAttribute('step', '1');
    });

    it.each([
      { name: 'a step of 0', prop: 'minuteStep', value: 0 },
      { name: 'a fraction', prop: 'minuteStep', value: 2.5 },
      { name: 'a step of the seconds', prop: 'secondStep', value: -1 },
    ])('warns for $name and uses a step of 1', async ({ prop, value }) => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      onTestFinished(() => warnSpy.mockRestore());

      const { user } = await render(
        <TimeClock.Root
          locale="en-US"
          defaultView={prop === 'minuteStep' ? 'minute' : 'second'}
          defaultValue={time('10:30:30')}
          {...{ [prop]: value }}
        >
          <TimeClock.Face />
        </TimeClock.Root>,
      );
      await user.tab();
      await user.keyboard('{ArrowRight}');

      expect(warnSpy).toHaveBeenCalledExactlyOnceWith(
        `Vase UI: TimeClock \`${prop}\` must be a whole number above 0. The clock uses a step of 1 instead. Set \`${prop}\` to a whole number above 0.`,
      );
      expect(screen.getByRole('slider')).toHaveValue('31');
    });
  });

  describe('accessibility', () => {
    it('has no axe violation', async () => {
      const { container } = await render(
        <TimeClock.Root
          aria-label="Start time"
          locale="en-US"
          hourCycle={12}
          defaultValue={time('10:30')}
        >
          <TimeClock.ViewTrigger view="hour" />
          <TimeClock.ViewTrigger view="minute" />
          <TimeClock.DayPeriod value="am" />
          <TimeClock.DayPeriod value="pm" />
          <TimeClock.Face v-slots={{ default: () => <TimeClock.Hand />, ...numberSlot }} />
        </TimeClock.Root>,
      );

      await expectNoAxeViolations(container);
    });

    it('names the slider by the unit of the view, in the group', async () => {
      await render(
        <TimeClock.Root aria-label="Start time" locale="en-US">
          <TimeClock.Face />
        </TimeClock.Root>,
      );

      const group = screen.getByRole('group', { name: 'Start time' });
      expect(
        within(group).getByRole('slider', {
          name: new Intl.DisplayNames('en-US', { type: 'dateTimeField' }).of('hour'),
        }),
      ).toBeInTheDocument();
    });
  });

  describe('hydration', () => {
    it.each([
      { name: 'a clock with a time', props: { time: '10:30', locale: 'en-US' } },
      { name: 'a clock with no time', props: { time: null, locale: 'en-US' } },
      {
        name: 'a 24-hour clock in the minutes',
        props: { time: '15:45', hourCycle: 24, view: 'minute' },
      },
    ])('hydrates $name with no warning and no DOM difference', async ({ props }) => {
      const serverHtml = await renderOnServer(
        'src/time-clock/root/TimeClockRootHydration.test.vue',
        props,
      );

      const { container } = await hydrate(TimeClockRootHydration, { serverHtml, props });

      expect(within(container).getByRole('slider')).toBeInTheDocument();
      expect(takeReportedMessages()).toEqual([]);
    });

    it.each([
      {
        name: 'a view trigger',
        selector: 'button',
        attribute: 'aria-label',
        text: `${unitName('hour')} ${twoDigits.format(3)}`,
      },
      { name: 'the face', selector: 'input', attribute: 'aria-label', text: unitName('hour') },
      {
        name: 'the face',
        selector: 'input',
        attribute: 'aria-valuetext',
        text: new Intl.NumberFormat('en-US', {
          style: 'unit',
          unit: 'hour',
          unitDisplay: 'long',
        }).format(3),
      },
    ])(
      'gives $name the $attribute of the browser when the server wrote another text',
      async ({ selector, attribute, text }) => {
        const props = { time: '15:45', locale: 'en-US' };
        const serverHtml = setAttributeInHtml(
          await renderOnServer('src/time-clock/root/TimeClockRootHydration.test.vue', props),
          selector,
          attribute,
          'other',
        );

        const { container } = await hydrate(TimeClockRootHydration, { serverHtml, props });

        expect(container.querySelector(selector)).toHaveAttribute(attribute, text);
      },
    );

    it.each([
      { name: 'a view trigger', text: twoDigits.format(3) },
      { name: 'a day period', text: dayPeriodOf(21) },
      { name: 'a number', text: new Intl.NumberFormat('en-US').format(5) },
    ])(
      'writes the text of $name again with no warning when the server wrote another text',
      async ({ text }) => {
        const props = { time: '15:45', locale: 'en-US' };
        const serverHtml = (
          await renderOnServer('src/time-clock/root/TimeClockRootHydration.test.vue', props)
        ).replace(`>${text}<`, '>other<');
        expect(serverHtml).toContain('>other<');

        const { container } = await hydrate(TimeClockRootHydration, { serverHtml, props });

        expect(container).toHaveTextContent(text);
        expect(container).not.toHaveTextContent('other');
      },
    );

    it('renders for en-US until hydrated, then for the runtime locale', async () => {
      mockRuntimeDateTimeLocale('de-DE');
      const props = { time: '15:45' };
      const serverHtml = await renderOnServer(
        'src/time-clock/root/TimeClockRootHydration.test.vue',
        props,
      );
      // A `<template>` element parses the HTML with no side effect.
      const template = document.createElement('template');
      template.innerHTML = serverHtml;
      expect(template.content.querySelectorAll('button[aria-pressed]')).toHaveLength(4);
      expect(template.content.querySelector('input')?.getAttribute('max')).toBe('12');

      const { container } = await hydrate(TimeClockRootHydration, { serverHtml, props });

      expect(within(container).getByRole('slider')).toHaveAttribute('max', '23');
      expect(container.querySelectorAll('button[aria-pressed]')).toHaveLength(2);
    });

    it('gives the focus of a day period to the face when the browser has a 24-hour clock', async () => {
      mockRuntimeDateTimeLocale('de-DE');
      const props = { time: '15:45' };
      const serverHtml = await renderOnServer(
        'src/time-clock/root/TimeClockRootHydration.test.vue',
        props,
      );

      const { container } = await hydrateAfter(TimeClockRootHydration, {
        serverHtml,
        props,
        before: (server) => {
          const pm = within(server).getByRole('button', { name: dayPeriodOf(15) });
          pm.focus();
          expect(pm).toHaveFocus();
        },
      });

      expect(container.querySelectorAll('button[aria-pressed]')).toHaveLength(2);
      expect(within(container).getByRole('slider')).toHaveFocus();
    });

    // A `-u-hc-` keyword gives the server another hour cycle than the browser, as other `Intl` data
    // do for one locale.
    it.each([
      {
        name: 'a 24-hour server, a 12-hour browser',
        server: 'en-US-u-hc-h23',
        browser: 'en-US',
        view: 'hour' as const,
        max: '12',
        buttons: 4,
      },
      {
        name: 'a 12-hour server, a 24-hour browser',
        server: 'en-US',
        browser: 'en-US-u-hc-h23',
        view: 'hour' as const,
        max: '23',
        buttons: 2,
      },
      {
        name: 'a 24-hour server, in the minutes',
        server: 'en-US-u-hc-h23',
        browser: 'en-US',
        view: 'minute' as const,
        max: '59',
        buttons: 4,
      },
      {
        name: 'a 24-hour server, in a #render slot',
        server: 'en-US-u-hc-h23',
        browser: 'en-US',
        view: 'hour' as const,
        renderSlot: true,
        max: '12',
        buttons: 4,
      },
    ])(
      'hydrates the face of $name, then shows the hour cycle of the browser',
      async ({ server, browser, view, renderSlot, max, buttons }) => {
        const file = 'src/time-clock/root/TimeClockRootHydration.test.vue';
        const props = { time: '15:45', locale: browser, view, renderSlot };
        const serverHtml = await renderOnServer(file, { ...props, locale: server });

        const { container } = await hydrate(TimeClockRootHydration, { serverHtml, props });

        expect(within(container).getByRole('slider')).toHaveAttribute('max', max);
        expect(container.querySelectorAll('button[aria-pressed]')).toHaveLength(buttons);
        expect(container.querySelector('[data-vase-ui-hour-cycle]')).toBe(null);
      },
    );
  });
});
