import type { HTMLProps } from '@vase-ui/vue/types';
import { describe, expect, it, vi } from 'vitest';
import { shallowRef } from 'vue';
import type { Ref } from 'vue';
import { Field } from '@vase-ui/vue/field';
import { TimeField } from '@vase-ui/vue/time-field';
import {
  createFormDataSpy,
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  heldMountFormResetTests,
  hydrate,
  hiddenInputSizeTests,
  hydrateAfter,
  recordInputEvents,
  removedPartHydrationTests,
  renderOnServer,
  screen,
  setAttributeInHtml,
  within,
} from '#test-utils';
import { formatter } from '../../internals/date-time/format';
import { kindOf } from '../../internals/date-time/temporal';
import type { TemporalValue } from '../../internals/date-time/temporal';
import { REASONS } from '../../internals/reasons';
import TimeFieldRootHydration from './TimeFieldRootHydration.test.vue';

const HYDRATION_FILE = 'src/time-field/root/TimeFieldRootHydration.test.vue';

const segmentOf = (container: Element, type: string) =>
  container.querySelector<HTMLInputElement>(`input[data-type="${type}"]`)!;
const hiddenInputOf = (container: Element) =>
  container.querySelector<HTMLInputElement>('input[aria-hidden]')!;
const typesOf = (container: Element) =>
  Array.from(container.querySelectorAll('input[data-type]'), (input) =>
    input.getAttribute('data-type'),
  );
// The text that the field shows: the numbers of its segments and the text between them.
const shownBy = (container: Element) =>
  Array.from(container.querySelectorAll<HTMLElement>('[data-type]'), (element) =>
    element instanceof HTMLInputElement ? element.value : element.textContent,
  ).join('');
// The text that `Intl` gives for a time, with the options of the layout.
const textOf = (value: TemporalValue, options: Intl.DateTimeFormatOptions, locale: string) => {
  const [format, epoch] = formatter(value, options, locale);
  return format.format(epoch);
};

describe('<TimeField.Root />', () => {
  const { render } = createRenderer();

  describeConformance(<TimeField.Root />, () => ({
    elementIsRoot: false,
    refInstanceof: window.HTMLDivElement,
    render,
  }));

  hiddenInputSizeTests({
    render,
    createComponent: (props) => (
      <TimeField.Root {...props}>
        <TimeField.Input />
      </TimeField.Root>
    ),
  });

  describe('segments', () => {
    it.each([
      { name: 'the minute', props: {}, options: { hour: 'numeric', minute: '2-digit' } },
      { name: 'the hour', props: { granularity: 'hour' }, options: { hour: 'numeric' } },
      {
        name: 'the second',
        props: { granularity: 'second' },
        options: { hour: 'numeric', minute: '2-digit', second: '2-digit' },
      },
    ] as const)('shows the time down to $name as Intl does', async ({ props, options }) => {
      const { container } = await render(
        <TimeField.Root
          defaultValue={Temporal.PlainTime.from('15:04:33')}
          locale="en-US"
          {...props}
        >
          <TimeField.Input />
        </TimeField.Root>,
      );

      expect(shownBy(container)).toBe(
        textOf(Temporal.PlainTime.from('15:04:33'), options, 'en-US'),
      );
    });

    it.each([
      { name: 'the 12-hour cycle of en-US', locale: 'en-US', hourCycle: undefined, h: 'h12' },
      { name: 'the 24-hour cycle of de-DE', locale: 'de-DE', hourCycle: undefined, h: 'h23' },
      { name: 'the prop 12 in de-DE', locale: 'de-DE', hourCycle: 12, h: 'h12' },
      { name: 'the prop 24 in en-US', locale: 'en-US', hourCycle: 24, h: 'h23' },
    ] as const)('shows the time for $name', async ({ locale, hourCycle, h }) => {
      const { container } = await render(
        <TimeField.Root
          defaultValue={Temporal.PlainTime.from('15:04')}
          locale={locale}
          hourCycle={hourCycle}
        >
          <TimeField.Input />
        </TimeField.Root>,
      );

      expect(shownBy(container)).toBe(
        textOf(
          Temporal.PlainTime.from('15:04'),
          { hour: 'numeric', minute: '2-digit', hourCycle: h },
          locale,
        ),
      );
      expect(typesOf(container).includes('dayPeriod')).toBe(h === 'h12');
    });

    it.each([
      { name: 'after the numbers in en-US', locale: 'en-US' },
      { name: 'before the numbers in ko-KR', locale: 'ko-KR' },
    ])('puts the day period $name', async ({ locale }) => {
      const { container } = await render(
        <TimeField.Root defaultValue={Temporal.PlainTime.from('15:04')} locale={locale}>
          <TimeField.Input />
        </TimeField.Root>,
      );
      const [format, epoch] = formatter(
        Temporal.PlainTime.from('15:04'),
        { hour: 'numeric', minute: '2-digit' },
        locale,
      );
      const order = format.formatToParts(epoch).flatMap(({ type }) => {
        const found = /^(hour|minute|dayPeriod)$/.exec(type);
        return found ? [found[1]] : [];
      });

      expect(typesOf(container)).toEqual(order);
    });

    it('pads the hour of a 12-hour cycle when forceLeadingZeros is set', async () => {
      const { container } = await render(
        <TimeField.Root
          defaultValue={Temporal.PlainTime.from('09:04')}
          locale="en-US"
          forceLeadingZeros
        >
          <TimeField.Input />
        </TimeField.Root>,
      );

      expect(segmentOf(container, 'hour').value).toBe('09');
    });
  });

  describe('value', () => {
    it.each([
      { name: 'a time', value: '15:04', type: 'time', zone: false },
      { name: 'a date and time', value: '2026-11-14T15:04', type: 'dateTime', zone: false },
      {
        name: 'a date and time in a zone',
        value: '2026-11-14T15:04[Asia/Tokyo]',
        type: 'zonedDateTime',
        zone: true,
      },
    ])('gives back $name as it got it', async ({ value, type, zone }) => {
      const onValueChange = vi.fn();
      const kinds: Record<string, (text: string) => TemporalValue> = {
        time: (text) => Temporal.PlainTime.from(text),
        dateTime: (text) => Temporal.PlainDateTime.from(text),
        zonedDateTime: (text) => Temporal.ZonedDateTime.from(text),
      };
      const { container, user } = await render(
        <TimeField.Root
          defaultValue={kinds[type]!(value) as Temporal.PlainTime}
          locale="en-US"
          hourCycle={24}
          onValueChange={onValueChange}
        >
          <TimeField.Input />
        </TimeField.Root>,
      );

      expect(container.querySelector('[data-type="timeZoneName"]') !== null).toBe(zone);

      await user.click(segmentOf(container, 'minute'));
      await user.keyboard('{ArrowUp}');

      const [next] = onValueChange.mock.calls[0] as [TemporalValue];
      expect(kindOf(next)).toBe(type);
      expect(next.toString().startsWith(value.slice(0, value.indexOf(':') + 1))).toBe(true);
      expect(next.toString()).toContain(':05');
      if (zone) {
        expect((next as Temporal.ZonedDateTime).timeZoneId).toBe('Asia/Tokyo');
      }
    });

    it('hides the time zone name when hideTimeZone is set', async () => {
      const { container } = await render(
        <TimeField.Root
          defaultValue={Temporal.ZonedDateTime.from('2026-11-14T15:04[Asia/Tokyo]')}
          hideTimeZone
        >
          <TimeField.Input />
        </TimeField.Root>,
      );

      expect(container.querySelector('[data-type="timeZoneName"]')).toBe(null);
    });

    it('emits valueChange and then update:modelValue, and stops both for a change that a listener cancels', async () => {
      const calls: string[] = [];
      let changes = 0;
      const { container, user } = await render(
        <TimeField.Root
          defaultValue={Temporal.PlainTime.from('15:04')}
          locale="en-US"
          onValueChange={(_value, details) => {
            changes += 1;
            calls.push(`valueChange:${details.reason}`);
            if (changes === 2) {
              details.cancel();
            }
          }}
          onUpdate:modelValue={() => {
            calls.push('update:modelValue');
          }}
        >
          <TimeField.Input />
        </TimeField.Root>,
      );

      await user.click(segmentOf(container, 'minute'));
      await user.keyboard('{ArrowUp}');
      expect(calls).toEqual(['valueChange:keyboard', 'update:modelValue']);
      expect(segmentOf(container, 'minute').value).toBe('05');

      await user.keyboard('{ArrowUp}');
      expect(calls).toEqual(['valueChange:keyboard', 'update:modelValue', 'valueChange:keyboard']);
      expect(segmentOf(container, 'minute').value).toBe('05');
    });

    it('shows the value of a controlled field, and keeps it when the parent does not take a change', async () => {
      const onValueChange = vi.fn();
      const { container, user } = await render(
        <TimeField.Root
          modelValue={Temporal.PlainTime.from('15:04')}
          locale="en-US"
          onValueChange={onValueChange}
        >
          <TimeField.Input />
        </TimeField.Root>,
      );

      await user.click(segmentOf(container, 'minute'));
      await user.keyboard('{ArrowUp}');

      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(segmentOf(container, 'minute').value).toBe('04');
    });

    it('follows a new value of the parent', async () => {
      const value: Ref<Temporal.PlainTime | null> = shallowRef(Temporal.PlainTime.from('15:04'));
      const { container } = await render(() => (
        <TimeField.Root modelValue={value.value} locale="en-US">
          <TimeField.Input />
        </TimeField.Root>
      ));
      expect(segmentOf(container, 'hour').value).toBe('3');

      value.value = Temporal.PlainTime.from('09:30');
      await flushMicrotasks();
      expect(segmentOf(container, 'hour').value).toBe('9');
      expect(segmentOf(container, 'minute').value).toBe('30');

      value.value = null;
      await flushMicrotasks();
      expect(segmentOf(container, 'hour').value).toBe('');
    });

    it('empties the field with the exposed clear method, with the reason none', async () => {
      const onValueChange = vi.fn();
      let root: { clear: () => void; inputElement: HTMLInputElement | null } | null = null;
      const { container } = await render(() => (
        <TimeField.Root
          ref={(instance) => {
            root = instance as typeof root;
          }}
          defaultValue={Temporal.PlainTime.from('15:04')}
          onValueChange={onValueChange}
        >
          <TimeField.Input />
        </TimeField.Root>
      ));

      expect(root!.inputElement).toBe(hiddenInputOf(container));

      root!.clear();
      await flushMicrotasks();

      expect(onValueChange.mock.calls[0]![0]).toBe(null);
      expect(onValueChange.mock.calls[0]![1].reason).toBe('none');
      expect(container.querySelector('[role="group"]')).toHaveAttribute('data-empty');
    });
  });

  describe('hidden input', () => {
    it('gives the name, the form, the limits and the step to the input of the form', async () => {
      const { container } = await render(
        <TimeField.Root
          defaultValue={Temporal.PlainTime.from('12:00')}
          name="alarm"
          form="clock"
          required
          autoComplete="off"
          minTime={Temporal.PlainTime.from('09:00')}
          maxTime={Temporal.PlainTime.from('17:30')}
          step={900}
        >
          <TimeField.Input />
        </TimeField.Root>,
      );
      const input = hiddenInputOf(container);

      expect(input.type).toBe('time');
      expect(input.value).toBe('12:00');
      expect(input).toHaveAttribute('name', 'alarm');
      expect(input).toHaveAttribute('form', 'clock');
      expect(input).toHaveAttribute('autocomplete', 'off');
      expect(input).toBeRequired();
      expect(input.getAttribute('min')).toBe('09:00');
      expect(input.getAttribute('max')).toBe('17:30');
      expect(input.getAttribute('step')).toBe('900');
    });

    it.each([
      {
        name: 'a time before minTime',
        props: { defaultValue: '08:00', minTime: '09:00' },
        flag: 'rangeUnderflow',
      },
      {
        name: 'a time after maxTime',
        props: { defaultValue: '18:00', maxTime: '17:30' },
        flag: 'rangeOverflow',
      },
      {
        name: 'a time off the step',
        props: { defaultValue: '09:10', minTime: '09:00', step: 900 },
        flag: 'stepMismatch',
      },
      {
        name: 'a time in the range',
        props: { defaultValue: '10:00', minTime: '09:00', maxTime: '17:30' },
        flag: 'valid',
      },
      { name: 'an empty required field', props: { required: true }, flag: 'valueMissing' },
    ] as const)('gives the native validity of $name', async ({ props, flag }) => {
      const { defaultValue, minTime, maxTime, ...rest } = props as Record<string, any>;
      const { container } = await render(
        <TimeField.Root
          defaultValue={defaultValue && Temporal.PlainTime.from(defaultValue as string)}
          minTime={minTime && Temporal.PlainTime.from(minTime as string)}
          maxTime={maxTime && Temporal.PlainTime.from(maxTime as string)}
          {...rest}
        >
          <TimeField.Input />
        </TimeField.Root>,
      );

      expect(hiddenInputOf(container).validity[flag]).toBe(true);
    });

    it('gives the time of a date and time in the range of the time to the field as a custom error', async () => {
      const { container } = await render(
        <TimeField.Root
          defaultValue={Temporal.PlainDateTime.from('2026-11-14T08:00')}
          minTime={Temporal.PlainTime.from('09:00')}
          locale="en-US"
        >
          <TimeField.Input />
        </TimeField.Root>,
      );

      expect(hiddenInputOf(container).validity.customError).toBe(true);
    });

    it('gives the value to a form', async () => {
      const onSubmit = createFormDataSpy('alarm');
      const { user } = await render(
        <form data-testid="form" onSubmit={onSubmit}>
          <TimeField.Root defaultValue={Temporal.PlainTime.from('15:04')} name="alarm">
            <TimeField.Input />
            <TimeField.Clear />
          </TimeField.Root>
        </form>,
      );
      const form = screen.getByTestId<HTMLFormElement>('form');

      form.requestSubmit();
      expect(onSubmit.mock.results.at(-1)?.value).toBe('15:04');

      await user.click(screen.getByRole('button', { name: 'Clear' }));
      form.requestSubmit();
      expect(onSubmit.mock.results.at(-1)?.value).toBe('');
    });

    it('shows a missing value of a required field through Field', async () => {
      const { user } = await render(
        <Field.Root name="alarm" validationMode="change">
          <TimeField.Root defaultValue={Temporal.PlainTime.from('15:04')} required>
            <TimeField.Input />
            <TimeField.Clear />
          </TimeField.Root>
          <Field.Error match="valueMissing" data-testid="error">
            Pick a time
          </Field.Error>
        </Field.Root>,
      );
      expect(screen.queryByTestId('error')).toBe(null);

      await user.click(screen.getByRole('button', { name: 'Clear' }));

      expect(screen.getByTestId('error')).toHaveTextContent('Pick a time');
    });
  });

  heldMountFormResetTests({
    render,
    renderControl: () => (
      <TimeField.Root name="time" locale="en-US" defaultValue={Temporal.PlainTime.from('10:30')}>
        <TimeField.Input />
      </TimeField.Root>
    ),
    change: () => fireEvent.input(hiddenInputOf(document.body), { target: { value: '11:45' } }),
    readState: () =>
      screen.getAllByRole('spinbutton').map((segment) => segment.getAttribute('aria-valuenow')),
    defaultState: ['10', '30', '0'],
    changedState: ['11', '45', '0'],
  });

  describe('the form state that the browser restores', () => {
    function renderField(onValueChange: (...args: unknown[]) => void) {
      return render(
        <TimeField.Root
          defaultValue={Temporal.PlainTime.from('15:04')}
          hourCycle={24}
          locale="en-US"
          name="alarm"
          onValueChange={onValueChange}
        >
          <TimeField.Input />
        </TimeField.Root>,
      );
    }

    it('takes a time that the browser restored before the hydration', async () => {
      const props = { defaultValue: '15:04', hourCycle: 24, locale: 'en-US', name: 'alarm' };
      const serverHtml = await renderOnServer(HYDRATION_FILE, props);

      const { container } = await hydrateAfter(TimeFieldRootHydration, {
        serverHtml,
        props,
        before(serverContainer) {
          hiddenInputOf(serverContainer).value = '09:30';
        },
      });
      await flushMicrotasks();
      const fixture = within(container);

      expect(['hour', 'minute'].map((type) => segmentOf(container, type).value)).toEqual([
        '09',
        '30',
      ]);
      expect(hiddenInputOf(container).value).toBe('09:30');
      expect(new FormData(fixture.getByTestId<HTMLFormElement>('form')).get('alarm')).toBe('09:30');
      expect(fixture.getByTestId('root')).toHaveAttribute('data-dirty');
    });

    it('takes a time that the browser restores at a `pageshow` event', async () => {
      const onValueChange = vi.fn();
      const { container } = await renderField(onValueChange);
      const input = hiddenInputOf(container);
      const events = recordInputEvents(input);
      input.value = '09:30';

      window.dispatchEvent(new PageTransitionEvent('pageshow'));
      await flushMicrotasks();

      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onValueChange.mock.calls[0]![0].toString()).toBe('09:30:00');
      expect(onValueChange.mock.calls[0]![1].reason).toBe(REASONS.inputChange);
      expect(['hour', 'minute'].map((type) => segmentOf(container, type).value)).toEqual([
        '09',
        '30',
      ]);
      expect(input.value).toBe('09:30');
      expect(events).toEqual(['input']);
    });

    it('does nothing at a `pageshow` event from the back/forward cache', async () => {
      const onValueChange = vi.fn();
      const { container } = await renderField(onValueChange);
      hiddenInputOf(container).value = '09:30';

      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
      await flushMicrotasks();

      expect(onValueChange).not.toHaveBeenCalled();
      expect(['hour', 'minute'].map((type) => segmentOf(container, type).value)).toEqual([
        '15',
        '04',
      ]);
    });
  });

  describe('state', () => {
    it.each([
      { name: 'an empty field', props: {}, has: ['empty'], hasNot: ['complete', 'filled'] },
      {
        name: 'a field with a value',
        props: { defaultValue: '15:04' },
        has: ['complete', 'filled'],
        hasNot: ['empty'],
      },
      {
        name: 'a disabled field',
        props: { disabled: true },
        has: ['disabled'],
        hasNot: ['readonly', 'required'],
      },
      {
        name: 'a read-only and required field',
        props: { readOnly: true, required: true },
        has: ['readonly', 'required'],
        hasNot: ['disabled'],
      },
    ] as const)('marks $name', async ({ props, has, hasNot }) => {
      const { defaultValue, ...rest } = props as Record<string, any>;
      const { container } = await render(
        <TimeField.Root
          defaultValue={defaultValue && Temporal.PlainTime.from(defaultValue as string)}
          {...rest}
        >
          <TimeField.Input />
        </TimeField.Root>,
      );
      const group = container.querySelector('[role="group"]')!;

      for (const name of has) {
        expect(group).toHaveAttribute(`data-${name}`);
      }
      for (const name of hasNot) {
        expect(group).not.toHaveAttribute(`data-${name}`);
      }
    });

    it('gives the empty state to the render slot', async () => {
      const { container } = await render(
        <TimeField.Root
          defaultValue={Temporal.PlainTime.from('15:04')}
          v-slots={{
            render: ({ props, state }: { props: HTMLProps; state: TimeField.Root.State }) => (
              <div {...props} class={state.empty ? 'is-empty' : 'is-filled'}>
                <TimeField.Input />
              </div>
            ),
          }}
        />,
      );

      expect(container.querySelector('[role="group"]')).toHaveClass('is-filled');
    });

    it('names the group from the label of a field', async () => {
      const { container, user } = await render(
        <Field.Root name="alarm">
          <Field.Label data-testid="label">Alarm</Field.Label>
          <TimeField.Root defaultValue={Temporal.PlainTime.from('15:04')}>
            <TimeField.Input />
          </TimeField.Root>
        </Field.Root>,
      );

      expect(container.querySelector('[role="group"]')).toHaveAttribute(
        'aria-labelledby',
        screen.getByTestId('label').id,
      );

      await user.click(screen.getByTestId('label'));
      expect(segmentOf(container, 'hour')).toHaveFocus();
    });

    it('names the group from the ariaLabelledby prop and not from the label', async () => {
      const { container } = await render(
        <Field.Root name="alarm">
          <Field.Label data-testid="label">Alarm</Field.Label>
          <TimeField.Root ariaLabelledby="own-label">
            <TimeField.Input />
          </TimeField.Root>
        </Field.Root>,
      );

      expect(container.querySelector('[role="group"]')).toHaveAttribute(
        'aria-labelledby',
        'own-label',
      );
    });

    it('gives the id prop to the first segment', async () => {
      const { container } = await render(
        <TimeField.Root id="alarm-time">
          <TimeField.Input />
        </TimeField.Root>,
      );

      expect(container.querySelector('input[data-type]')).toHaveAttribute('id', 'alarm-time');
    });
  });

  describe('hydration', () => {
    // A server whose `Intl` data differs writes other names. The root compares the attributes of
    // each segment after the mount, and it makes the segments again.
    it('gives a segment the aria-label of the browser when the server wrote another text', async () => {
      const props = { locale: 'en-US', defaultValue: '15:45' };
      const serverHtml = setAttributeInHtml(
        await renderOnServer(HYDRATION_FILE, props),
        'input[data-type="hour"]',
        'aria-label',
        'other',
      );

      const { container } = await hydrate(TimeFieldRootHydration, { serverHtml, props });

      expect(segmentOf(container, 'hour')).toHaveAttribute(
        'aria-label',
        new Intl.DisplayNames('en-US', { type: 'dateTimeField' }).of('hour')!,
      );
    });

    removedPartHydrationTests({
      file: HYDRATION_FILE,
      component: TimeFieldRootHydration,
      cases: [
        {
          name: 'a removed label',
          props: {
            locale: 'en-US',
            label: 'after',
            description: true,
            labelId: 'label-a',
            descriptionId: 'desc-a',
            laterRemovedAtMount: true,
          },
          selector: '[data-testid="root"]',
          attribute: 'aria-labelledby',
          serverValue: 'label-a',
          clientValue: null,
        },
        {
          name: 'a removed description',
          props: {
            locale: 'en-US',
            label: 'after',
            description: true,
            labelId: 'label-a',
            descriptionId: 'desc-a',
            laterRemovedAtMount: true,
          },
          selector: '[data-testid="root"]',
          attribute: 'aria-describedby',
          serverValue: 'desc-a',
          clientValue: null,
        },
      ],
    });
  });

  describe('VUE-112: a disabled fieldset', () => {
    it('shows the disabled state on the root, the input and each segment in a disabled fieldset', async () => {
      await render(() => (
        <fieldset disabled>
          <TimeField.Root data-testid="root" locale="en-US">
            <TimeField.Input data-testid="input" />
          </TimeField.Root>
        </fieldset>
      ));

      expect(screen.getByTestId('root')).toHaveAttribute('data-disabled');
      expect(screen.getByTestId('input')).toHaveAttribute('data-disabled');
      const segments = screen.getAllByRole('spinbutton');
      expect(segments).toHaveLength(3);
      for (const segment of segments) {
        expect(segment).toHaveAttribute('data-disabled');
      }
    });
  });
});
