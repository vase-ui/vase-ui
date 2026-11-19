import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { KeepAlive, defineComponent, shallowRef } from 'vue';
import { DateField } from '@vase-ui/vue/date-field';
import { Field } from '@vase-ui/vue/field';
import { Input } from '@vase-ui/vue/input';
import { Form, type FormValues } from '@vase-ui/vue/form';
import {
  createFormDataSpy,
  createHeldBranch,
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  heldMountFormResetTests,
  hydrate,
  hydrateAfter,
  recordInputEvents,
  removedPartHydrationTests,
  renderOnServer,
  screen,
  setAttributeInHtml,
  waitFor,
  within,
} from '#test-utils';
import { formatter } from '../../internals/date-time/format';
import { kindOf } from '../../internals/date-time/temporal';
import type { TemporalValue } from '../../internals/date-time/temporal';
import { REASONS } from '../../internals/reasons';
import DateFieldRootHydration from './DateFieldRootHydration.test.vue';

const HYDRATION_FILE = 'src/date-field/root/DateFieldRootHydration.test.vue';

const segmentOf = (container: Element, type: string) =>
  container.querySelector<HTMLInputElement>(`input[data-type="${type}"]`)!;
const typesOf = (container: Element) =>
  Array.from(container.querySelectorAll('input[data-type]'), (input) =>
    input.getAttribute('data-type'),
  ).join(' ');
const hiddenInputOf = (container: Element) =>
  container.querySelector<HTMLInputElement>('input[aria-hidden]')!;

describe('<DateField.Root />', () => {
  const { render } = createRenderer();

  describeConformance(<DateField.Root />, () => ({
    elementIsRoot: false,
    refInstanceof: window.HTMLDivElement,
    render,
  }));

  describe('prop: value', () => {
    // The segments and the hidden input follow the kind of the value. A press on a segment gives
    // back a value of the same kind, calendar, time and zone.
    it.each([
      {
        name: 'a date',
        value: Temporal.PlainDate.from('2026-11-14'),
        types: 'month day year',
        inputType: 'date',
        text: '2026-11-14',
        segment: 'day',
        kind: 'date',
        next: '2026-11-15',
      },
      {
        name: 'a date and time',
        value: Temporal.PlainDateTime.from('2026-11-14T15:04'),
        types: 'month day year hour minute',
        inputType: 'datetime-local',
        text: '2026-11-14T15:04',
        segment: 'minute',
        kind: 'dateTime',
        next: '2026-11-14T15:05:00',
      },
      {
        name: 'a date and time in a zone',
        value: Temporal.ZonedDateTime.from('2026-11-14T15:04[Asia/Tokyo]'),
        types: 'month day year hour minute',
        inputType: 'text',
        text: '2026-11-14T15:04+09:00[Asia/Tokyo]',
        segment: 'hour',
        kind: 'zonedDateTime',
        next: '2026-11-14T16:04:00+09:00[Asia/Tokyo]',
      },
      {
        name: 'a year and month',
        value: Temporal.PlainYearMonth.from('2026-11'),
        types: 'month year',
        inputType: 'text',
        text: '2026-11',
        segment: 'month',
        kind: 'yearMonth',
        next: '2026-12',
      },
    ])(
      'shows $name in its segments and gives back a value of its kind',
      async ({ value, types, inputType, text, segment, kind, next }) => {
        const onValueChange = vi.fn();
        const { container, user } = await render(
          <DateField.Root
            defaultValue={value}
            locale="en-US"
            hourCycle={24}
            onValueChange={onValueChange}
          >
            <DateField.Input />
          </DateField.Root>,
        );

        expect(typesOf(container)).toBe(types);
        expect(hiddenInputOf(container).type).toBe(inputType);
        expect(hiddenInputOf(container).value).toBe(text);

        segmentOf(container, segment).focus();
        await user.keyboard('{ArrowUp}');

        const [emitted] = onValueChange.mock.lastCall as [TemporalValue];
        expect(kindOf(emitted)).toBe(kind);
        expect(emitted.toString()).toBe(next);
      },
    );

    it('shows the time zone name of a value in a zone, and hides it with hideTimeZone', async () => {
      const value = Temporal.ZonedDateTime.from('2026-11-14T15:04[Asia/Tokyo]');
      const [format, epoch] = formatter(value, { timeZoneName: 'short' }, 'en-US');
      const zoneName = format.formatToParts(epoch).find(({ type }) => type === 'timeZoneName')!;
      const { container, setProps } = await render(
        <DateField.Root defaultValue={value} locale="en-US">
          <DateField.Input />
        </DateField.Root>,
      );

      expect(container.querySelector('[data-type="timeZoneName"]')).toHaveTextContent(
        zoneName.value,
      );

      await setProps({ hideTimeZone: true });

      expect(container.querySelector('[data-type="timeZoneName"]')).toBe(null);
    });

    it('shows only the month and the year of a date for granularity="month", and keeps the day', async () => {
      const onValueChange = vi.fn();
      const { container, user } = await render(
        <DateField.Root
          defaultValue={Temporal.PlainDate.from('2026-11-14')}
          granularity="month"
          locale="en-US"
          onValueChange={onValueChange}
        >
          <DateField.Input />
        </DateField.Root>,
      );

      expect(typesOf(container)).toBe('month year');
      expect(hiddenInputOf(container).type).toBe('date');

      segmentOf(container, 'month').focus();
      await user.keyboard('{ArrowUp}');

      const [emitted] = onValueChange.mock.lastCall as [Temporal.PlainDate];
      expect(emitted.toString()).toBe('2026-12-14');
    });

    it('keeps the value of the parent when the parent does not change it', async () => {
      const onValueChange = vi.fn();
      const { container, user } = await render(
        <DateField.Root
          modelValue={Temporal.PlainDate.from('2026-11-14')}
          locale="en-US"
          onValueChange={onValueChange}
        >
          <DateField.Input />
        </DateField.Root>,
      );

      segmentOf(container, 'day').focus();
      await user.keyboard('{ArrowUp}');

      expect(onValueChange.mock.lastCall![0].toString()).toBe('2026-11-15');
      expect(segmentOf(container, 'day').value).toBe('14');
      expect(hiddenInputOf(container).value).toBe('2026-11-14');
    });
  });

  describe('prop: minDate, maxDate, unavailableDates', () => {
    // A native `date` input checks `min` and `max`. The root gives the other limits as a custom
    // error of the input.
    it.each([
      {
        name: 'minDate',
        props: { minDate: Temporal.PlainDate.from('2026-12-01') },
        attribute: 'min',
        text: '2026-12-01',
        validity: 'rangeUnderflow',
      },
      {
        name: 'maxDate',
        props: { maxDate: Temporal.PlainDate.from('2026-10-01') },
        attribute: 'max',
        text: '2026-10-01',
        validity: 'rangeOverflow',
      },
      {
        name: 'unavailableDates',
        // 14 November 2026 is a Saturday.
        props: { unavailableDates: { dayOfWeek: 6 } },
        attribute: undefined,
        text: undefined,
        validity: 'customError',
      },
    ] as const)(
      'makes the field invalid for a date that $name refuses',
      async ({ props, attribute, text, validity }) => {
        const { container } = await render(
          <DateField.Root
            defaultValue={Temporal.PlainDate.from('2026-11-14')}
            locale="en-US"
            {...props}
          >
            <DateField.Input />
          </DateField.Root>,
        );
        const input = hiddenInputOf(container);

        expect(input.validity[validity]).toBe(true);
        if (attribute !== undefined) {
          expect(input).toHaveAttribute(attribute, text);
        }
      },
    );

    // A limit with a time limits the time of a field that shows a time, and not only its day.
    it.each([
      {
        name: 'a date and time',
        value: Temporal.PlainDateTime.from('2026-11-14T09:30'),
        validity: 'rangeUnderflow',
      },
      {
        name: 'a date and time in a zone',
        value: Temporal.ZonedDateTime.from('2026-11-14T09:30[Asia/Tokyo]'),
        validity: 'customError',
      },
    ] as const)(
      'makes the field invalid for $name with a time before the time of minDate',
      async ({ value, validity }) => {
        const { container, user } = await render(
          <DateField.Root
            defaultValue={value}
            minDate={Temporal.PlainDateTime.from('2026-11-14T10:00')}
            hourCycle={24}
            locale="en-US"
          >
            <DateField.Input />
          </DateField.Root>,
        );
        const input = hiddenInputOf(container);
        expect(input.validity[validity]).toBe(true);

        segmentOf(container, 'hour').focus();
        await user.keyboard('{ArrowUp}');

        expect(segmentOf(container, 'hour').value).toBe('10');
        expect(input.validity.valid).toBe(true);
      },
    );
  });

  describe('prop: disabled, readOnly', () => {
    it('disables each segment and the hidden input', async () => {
      const { container } = await render(
        <DateField.Root defaultValue={Temporal.PlainDate.from('2026-11-14')} disabled>
          <DateField.Input />
        </DateField.Root>,
      );

      expect(screen.getByRole('group')).toHaveAttribute('data-disabled');
      for (const segment of container.querySelectorAll('input[data-type]')) {
        expect(segment).toBeDisabled();
      }
      expect(hiddenInputOf(container)).toBeDisabled();
    });

    it('keeps the value when a key presses a read-only segment', async () => {
      const onValueChange = vi.fn();
      const { container, user } = await render(
        <DateField.Root
          defaultValue={Temporal.PlainDate.from('2026-11-14')}
          locale="en-US"
          readOnly
          onValueChange={onValueChange}
        >
          <DateField.Input />
        </DateField.Root>,
      );

      expect(screen.getByRole('group')).toHaveAttribute('data-readonly');
      segmentOf(container, 'day').focus();
      await user.keyboard('{ArrowUp}1');

      expect(onValueChange).not.toHaveBeenCalled();
      expect(hiddenInputOf(container).value).toBe('2026-11-14');
    });
  });

  describe('event: valueChange', () => {
    it('emits valueChange and then update:modelValue, and a cancel stops update:modelValue', async () => {
      const calls: string[] = [];
      let cancel = false;
      const { container, user } = await render(
        <DateField.Root
          defaultValue={Temporal.PlainDate.from('2026-11-14')}
          locale="en-US"
          onValueChange={(value, details) => {
            calls.push(`valueChange ${value?.toString()} ${details.reason}`);
            if (cancel) {
              details.cancel();
            }
          }}
          {...{
            'onUpdate:modelValue': (value: Temporal.PlainDate | null) =>
              calls.push(`update:modelValue ${value?.toString()}`),
          }}
        >
          <DateField.Input />
        </DateField.Root>,
      );

      segmentOf(container, 'day').focus();
      await user.keyboard('{ArrowUp}');

      expect(calls).toEqual([
        `valueChange 2026-11-15 ${REASONS.keyboard}`,
        'update:modelValue 2026-11-15',
      ]);

      cancel = true;
      calls.length = 0;
      await user.keyboard('{ArrowUp}');

      expect(calls).toEqual([`valueChange 2026-11-16 ${REASONS.keyboard}`]);
      expect(hiddenInputOf(container).value).toBe('2026-11-15');
    });

    it('gives each digit of a typed date to the right segment, and a form submits the date', async () => {
      const submit = createFormDataSpy('when');
      const onValueChange = vi.fn();
      const { container, user } = await render(
        <form onSubmit={submit}>
          <DateField.Root locale="en-US" name="when" onValueChange={onValueChange}>
            <DateField.Input />
          </DateField.Root>
          <button type="submit">Send</button>
        </form>,
      );

      segmentOf(container, 'month').focus();
      await user.keyboard('11142026');

      expect(segmentOf(container, 'year')).toHaveFocus();
      expect(onValueChange.mock.lastCall![0].toString()).toBe('2026-11-14');
      expect(onValueChange.mock.lastCall![1].reason).toBe(REASONS.inputChange);

      await user.click(screen.getByText('Send'));

      expect(submit.mock.results.at(-1)?.value).toBe('2026-11-14');
    });
  });

  describe('names', () => {
    it('names the group with the label of its field, and each segment with its Intl name', async () => {
      const { container } = await render(
        <Field.Root>
          <Field.Label>Birth date</Field.Label>
          <DateField.Root locale="en-US" referenceDate={Temporal.PlainDate.from('2026-11-14')}>
            <DateField.Input />
          </DateField.Root>
        </Field.Root>,
      );
      const names = new Intl.DisplayNames('en-US', { type: 'dateTimeField' });

      expect(screen.getByRole('group', { name: 'Birth date' })).toBeInTheDocument();
      expect(
        screen.getAllByRole('spinbutton').map((segment) => segment.getAttribute('aria-label')),
      ).toEqual(['month', 'day', 'year'].map((type) => names.of(type)));
      expect(typesOf(container)).toBe('month day year');
    });

    it('names the group with the ids of the aria-labelledby attribute', async () => {
      await render(
        <div>
          <span id="heading">Check-in</span>
          <DateField.Root aria-labelledby="heading">
            <DateField.Input />
          </DateField.Root>
        </div>,
      );

      expect(screen.getByRole('group', { name: 'Check-in' })).toBeInTheDocument();
    });

    it('VUE-103: removes the description of the field for an aria-describedby of null', async () => {
      await render(
        <div>
          <Field.Root>
            <DateField.Root data-testid="described">
              <DateField.Input />
            </DateField.Root>
            <Field.Description data-testid="description">The day of arrival.</Field.Description>
          </Field.Root>
          <Field.Root>
            <DateField.Root aria-describedby={null} data-testid="undescribed">
              <DateField.Input />
            </DateField.Root>
            <Field.Description>The day of arrival.</Field.Description>
          </Field.Root>
        </div>,
      );

      const description = screen.getByTestId('description');
      await waitFor(() => {
        expect(screen.getByTestId('described')).toHaveAttribute('aria-describedby', description.id);
      });
      expect(screen.getByTestId('undescribed')).not.toHaveAttribute('aria-describedby');
    });
  });

  describe('exposed members', () => {
    it('exposes the element, the hidden input and clear()', async () => {
      const onValueChange = vi.fn();
      let exposed: {
        element: HTMLElement | null;
        inputElement: HTMLInputElement | null;
        clear: () => void;
      } | null = null;
      const { container } = await render(() => (
        <DateField.Root
          ref={(value) => {
            exposed = value as typeof exposed;
          }}
          defaultValue={Temporal.PlainDate.from('2026-11-14')}
          onValueChange={onValueChange}
        >
          <DateField.Input />
        </DateField.Root>
      ));

      expect(exposed!.element).toBe(screen.getByRole('group'));
      expect(exposed!.inputElement).toBe(hiddenInputOf(container));

      exposed!.clear();
      await flushMicrotasks();

      expect(onValueChange).toHaveBeenCalledWith(
        null,
        expect.objectContaining({ reason: REASONS.none }),
      );
      expect(hiddenInputOf(container).value).toBe('');
    });
  });

  describe('props of the field', () => {
    // The root gives each prop to the state of the field. A prop that the root leaves out has no
    // effect.
    const rows: {
      name: string;
      props: DateField.Root.Props;
      check: (container: Element) => void;
    }[] = [
      {
        name: 'locale',
        props: { locale: 'de-DE', defaultValue: Temporal.PlainDate.from('2026-11-14') },
        check: (container: Element) => {
          expect(typesOf(container)).toBe('day month year');
        },
      },
      {
        name: 'calendar',
        props: {
          locale: 'en-US',
          calendar: 'buddhist',
          defaultValue: Temporal.PlainDate.from('2026-11-14'),
        },
        check: (container: Element) => {
          expect(segmentOf(container, 'year').value).toBe('2569');
        },
      },
      {
        name: 'hourCycle',
        props: {
          locale: 'de-DE',
          hourCycle: 12,
          defaultValue: Temporal.PlainDateTime.from('2026-11-14T15:04'),
        },
        check: (container: Element) => {
          expect(typesOf(container)).toContain('dayPeriod');
        },
      },
      {
        name: 'forceLeadingZeros',
        props: {
          locale: 'en-US',
          forceLeadingZeros: true,
          defaultValue: Temporal.PlainDate.from('2026-03-04'),
        },
        check: (container: Element) => {
          expect(segmentOf(container, 'month').value).toBe('03');
          expect(segmentOf(container, 'day').value).toBe('04');
        },
      },
      {
        name: 'granularity',
        props: {
          locale: 'en-US',
          hourCycle: 24,
          granularity: 'second',
          defaultValue: Temporal.PlainDateTime.from('2026-11-14T15:04:33'),
        },
        check: (container: Element) => {
          expect(typesOf(container)).toBe('month day year hour minute second');
        },
      },
      {
        name: 'id',
        props: { id: 'when', defaultValue: Temporal.PlainDate.from('2026-11-14') },
        check: (container: Element) => {
          expect(
            Array.from(container.querySelectorAll('input[data-type]'), (input) => input.id),
          ).toEqual(['when', 'when-2', 'when-3']);
        },
      },
      {
        name: 'name, form, autoComplete and required',
        props: { name: 'when', form: 'booking', autoComplete: 'bday', required: true },
        check: (container: Element) => {
          const input = hiddenInputOf(container);
          expect(input).toHaveAttribute('name', 'when');
          expect(input).toHaveAttribute('form', 'booking');
          expect(input).toHaveAttribute('autocomplete', 'bday');
          expect(input).toBeRequired();
          expect(screen.getByRole('group')).toHaveAttribute('data-required');
        },
      },
    ];

    it.each(rows)('gives $name to the field', async ({ props, check }) => {
      const { container } = await render(
        <DateField.Root {...props}>
          <DateField.Input />
        </DateField.Root>,
      );

      check(container);
    });

    // The field reads today in the zone of the `timeZone` prop. A spy gives each zone its day, so
    // the case does not depend on the clock.
    it('takes the numbers of an empty segment from today in the time zone of the prop', async () => {
      const now = vi
        .spyOn(Temporal.Now, 'plainDateISO')
        .mockImplementation((timeZone) =>
          Temporal.PlainDate.from(timeZone === 'Pacific/Kiritimati' ? '2026-11-15' : '2026-11-14'),
        );
      onTestFinished(() => {
        now.mockRestore();
      });
      const { container, user } = await render(
        <DateField.Root locale="en-US" timeZone="Pacific/Kiritimati">
          <DateField.Input />
        </DateField.Root>,
      );

      segmentOf(container, 'day').focus();
      await user.keyboard('{ArrowUp}');

      expect(segmentOf(container, 'day').value).toBe('15');
    });

    it('takes the numbers of an empty segment from referenceDate', async () => {
      const { container, user } = await render(
        <DateField.Root referenceDate={Temporal.PlainDate.from('2024-05-17')} locale="en-US">
          <DateField.Input />
        </DateField.Root>,
      );

      segmentOf(container, 'month').focus();
      await user.keyboard('{ArrowUp}');
      segmentOf(container, 'year').focus();
      await user.keyboard('{ArrowUp}');

      expect(segmentOf(container, 'month').value).toBe('5');
      expect(segmentOf(container, 'year').value).toBe('2024');
    });
  });

  describe('the form state that the browser restores', () => {
    function renderField(onValueChange: (...args: unknown[]) => void) {
      return render(
        <DateField.Root
          defaultValue={Temporal.PlainDate.from('2026-11-14')}
          locale="en-US"
          name="when"
          onValueChange={onValueChange}
        >
          <DateField.Input />
        </DateField.Root>,
      );
    }

    it('takes a date that the browser restored before the hydration', async () => {
      const props = { defaultValue: '2026-11-14', locale: 'en-US', name: 'when' };
      const serverHtml = await renderOnServer(HYDRATION_FILE, props);

      const { container } = await hydrateAfter(DateFieldRootHydration, {
        serverHtml,
        props,
        before(serverContainer) {
          hiddenInputOf(serverContainer).value = '2026-12-25';
        },
      });
      await flushMicrotasks();
      const fixture = within(container);

      expect(['month', 'day', 'year'].map((type) => segmentOf(container, type).value)).toEqual([
        '12',
        '25',
        '2026',
      ]);
      expect(hiddenInputOf(container).value).toBe('2026-12-25');
      expect(new FormData(fixture.getByTestId<HTMLFormElement>('form')).get('when')).toBe(
        '2026-12-25',
      );
      expect(fixture.getByTestId('root')).toHaveAttribute('data-dirty');
    });

    it('takes a date that the browser restores at a `pageshow` event', async () => {
      const onValueChange = vi.fn();
      const { container } = await renderField(onValueChange);
      const input = hiddenInputOf(container);
      const events = recordInputEvents(input);
      input.value = '2026-12-25';

      window.dispatchEvent(new PageTransitionEvent('pageshow'));
      await flushMicrotasks();

      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onValueChange.mock.calls[0]![0].toString()).toBe('2026-12-25');
      expect(onValueChange.mock.calls[0]![1].reason).toBe(REASONS.inputChange);
      expect(['month', 'day', 'year'].map((type) => segmentOf(container, type).value)).toEqual([
        '12',
        '25',
        '2026',
      ]);
      expect(input.value).toBe('2026-12-25');
      expect(events).toEqual(['input']);
    });

    it('does nothing at a `pageshow` event from the back/forward cache', async () => {
      const onValueChange = vi.fn();
      const { container } = await renderField(onValueChange);
      hiddenInputOf(container).value = '2026-12-25';

      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
      await flushMicrotasks();

      expect(onValueChange).not.toHaveBeenCalled();
      expect(['month', 'day', 'year'].map((type) => segmentOf(container, type).value)).toEqual([
        '11',
        '14',
        '2026',
      ]);
    });
  });

  describe('KeepAlive', () => {
    it('the label does not name a date field that mounts while KeepAlive holds it', async () => {
      const { HeldBranch, mountWhileHeld, show } = createHeldBranch(() => (
        <DateField.Root key="held" id="held-date">
          <DateField.Input />
        </DateField.Root>
      ));
      await render(() => (
        <Field.Root>
          <Field.Label data-testid="label">Birth date</Field.Label>
          <HeldBranch />
        </Field.Root>
      ));
      const label = screen.getByTestId('label');
      const providerId = label.getAttribute('for');

      await mountWhileHeld();

      expect(label.getAttribute('for')).toBe(providerId);

      await show();

      expect(label).toHaveAttribute('for', 'held-date');
    });
  });

  describe('hydration', () => {
    // A server whose `Intl` data differs writes other names. The root compares the attributes of
    // each segment after the mount, and it makes the segments again.
    it.each([
      {
        attribute: 'aria-label',
        text: new Intl.DisplayNames('en-US', { type: 'dateTimeField' }).of('month')!,
      },
      {
        attribute: 'aria-valuetext',
        text: new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'long' }).format(
          Date.parse('2026-11-14'),
        ),
      },
    ])(
      'gives a segment the $attribute of the browser when the server wrote another text',
      async ({ attribute, text }) => {
        const props = { locale: 'en-US', defaultValue: '2026-11-14' };
        const serverHtml = setAttributeInHtml(
          await renderOnServer(HYDRATION_FILE, props),
          'input[data-type="month"]',
          attribute,
          'other',
        );

        const { container } = await hydrate(DateFieldRootHydration, { serverHtml, props });

        expect(segmentOf(container, 'month')).toHaveAttribute(attribute, text);
      },
    );

    removedPartHydrationTests({
      file: HYDRATION_FILE,
      component: DateFieldRootHydration,
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
        {
          name: 'the hidden input, a removed description',
          props: {
            locale: 'en-US',
            label: 'after',
            description: true,
            labelId: 'label-a',
            descriptionId: 'desc-a',
            laterRemovedAtMount: true,
          },
          selector: 'input[aria-hidden]',
          attribute: 'aria-describedby',
          serverValue: 'desc-a',
          clientValue: null,
        },
      ],
    });
  });

  heldMountFormResetTests({
    render,
    renderControl: () => (
      <DateField.Root
        name="date"
        locale="en-US"
        defaultValue={Temporal.PlainDate.from('2026-11-14')}
      >
        <DateField.Input />
      </DateField.Root>
    ),
    change: () =>
      fireEvent.input(hiddenInputOf(document.body), { target: { value: '2027-02-03' } }),
    readState: () =>
      screen.getAllByRole('spinbutton').map((segment) => segment.getAttribute('aria-valuenow')),
    defaultState: ['11', '14', '2026'],
    changedState: ['2', '3', '2027'],
  });

  describe('VUE-112: a disabled fieldset', () => {
    it('shows the disabled state on the root, the input and each segment in a disabled fieldset', async () => {
      await render(() => (
        <fieldset disabled>
          <DateField.Root data-testid="root" locale="en-US">
            <DateField.Input data-testid="input" />
          </DateField.Root>
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

    it('leaves a date field in a disabled fieldset out of the form values', async () => {
      const handleSubmit = vi.fn();
      await render(() => (
        <Form
          onSubmit={(event: SubmitEvent, values: FormValues) => (
            event.preventDefault(),
            handleSubmit(values)
          )}
        >
          <Field.Root name="date">
            <fieldset disabled>
              <DateField.Root locale="en-US" defaultValue={Temporal.PlainDate.from('2026-11-14')}>
                <DateField.Input />
              </DateField.Root>
            </fieldset>
          </Field.Root>
          <Field.Root name="other">
            <Input defaultValue="sent" />
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>
      ));

      await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

      expect(handleSubmit).toHaveBeenCalledTimes(1);
      expect(handleSubmit.mock.lastCall?.[0]).toEqual({ other: 'sent' });
    });
  });
});
