import { describe, expect, it, vi } from 'vitest';
import { TimeField } from '@vase-ui/vue/time-field';
import { createRenderer, describeConformance, hydrateAfter, renderOnServer } from '#test-utils';
import TimeFieldRootHydration from '../root/TimeFieldRootHydration.test.vue';

const FIXTURE = 'src/time-field/root/TimeFieldRootHydration.test.vue';

const segmentOf = (container: Element, type: string) =>
  container.querySelector<HTMLInputElement>(`input[data-type="${type}"]`)!;

function measureSegment(container: Element, segment: HTMLInputElement) {
  const style = getComputedStyle(segment);
  const ruler = document.createElement('span');
  ruler.style.cssText = 'position: absolute; visibility: hidden; white-space: pre;';
  for (const name of [
    'fontFamily',
    'fontSize',
    'fontStretch',
    'fontStyle',
    'fontVariantNumeric',
    'fontWeight',
    'letterSpacing',
  ] as const) {
    ruler.style[name] = style[name];
  }
  ruler.textContent = segment.value || segment.placeholder;
  container.append(ruler);
  const textWidth = ruler.getBoundingClientRect().width;
  ruler.remove();
  const room =
    segment.getBoundingClientRect().width -
    parseFloat(style.paddingLeft) -
    parseFloat(style.paddingRight) -
    parseFloat(style.borderLeftWidth) -
    parseFloat(style.borderRightWidth);
  return { room, textWidth };
}

describe('<TimeField.Segment />', () => {
  const { render } = createRenderer();

  describeConformance(
    <TimeField.Segment segment={{ type: 'hour', index: 0, editable: true }} />,
    () => ({
      refInstanceof: window.HTMLInputElement,
      render: (node) => render(<TimeField.Root>{node}</TimeField.Root>),
    }),
  );

  function Field(props: Record<string, unknown>) {
    return (
      <TimeField.Root locale="en-US" {...props}>
        <TimeField.Input />
      </TimeField.Root>
    );
  }

  describe('attributes', () => {
    it.each([
      { name: 'an hour of a 12-hour cycle', type: 'hour', value: '3', now: 3, min: 1, max: 12 },
      { name: 'a minute', type: 'minute', value: '04', now: 4, min: 0, max: 59 },
      { name: 'a second', type: 'second', value: '33', now: 33, min: 0, max: 59 },
    ] as const)(
      'is a spinbutton with the number and the range of $name',
      async ({ type, value, now, min, max }) => {
        const { container } = await render(
          <Field defaultValue={Temporal.PlainTime.from('15:04:33')} granularity="second" />,
        );
        const segment = segmentOf(container, type);

        expect(segment).toHaveAttribute('role', 'spinbutton');
        expect(segment.value).toBe(value);
        expect(segment).toHaveAttribute('aria-valuenow', String(now));
        expect(segment).toHaveAttribute('aria-valuemin', String(min));
        expect(segment).toHaveAttribute('aria-valuemax', String(max));
        expect(segment).toHaveAttribute(
          'aria-label',
          new Intl.DisplayNames('en-US', { type: 'dateTimeField' }).of(type),
        );
        expect(segment).not.toHaveAttribute('data-placeholder');
      },
    );

    it('has a placeholder and no number while the field has no value', async () => {
      const { container } = await render(<Field />);
      const segment = segmentOf(container, 'minute');

      expect(segment.value).toBe('');
      expect(segment).toHaveAttribute('data-placeholder');
      expect(segment).toHaveAttribute('aria-valuetext', 'Empty');
      expect(segment).not.toHaveAttribute('aria-valuenow');
    });

    it('shows the number of the segment that its prop names', async () => {
      const { container } = await render(
        <TimeField.Root locale="en-US" defaultValue={Temporal.PlainTime.from('15:04')}>
          <TimeField.Segment segment={{ type: 'minute', index: 2, editable: true }} />
        </TimeField.Root>,
      );

      expect(container.querySelectorAll('input')).toHaveLength(2);
      expect(segmentOf(container, 'minute').value).toBe('04');
    });

    it.each([
      { name: 'a one-digit hour', time: '07:30', type: 'hour', text: '7' },
      { name: 'a two-digit minute', time: '07:30', type: 'minute', text: '30' },
      { name: 'the day period AM', time: '07:30', type: 'dayPeriod', text: 'AM' },
      { name: 'the day period PM', time: '19:30', type: 'dayPeriod', text: 'PM' },
      { name: 'an empty minute', time: undefined, type: 'minute', text: 'mm' },
      { name: 'an empty day period', time: undefined, type: 'dayPeriod', text: '--' },
    ])('has the width of its text with no style rule: $name', async ({ time, type, text }) => {
      expect(CSS.supports('field-sizing', 'content')).toBe(true);
      const { container } = await render(
        <Field defaultValue={time ? Temporal.PlainTime.from(time) : undefined} />,
      );
      const segment = segmentOf(container, type);

      expect(segment.value || segment.placeholder).toBe(text);
      const { room, textWidth } = measureSegment(container, segment);
      expect(Math.abs(room - textWidth)).toBeLessThanOrEqual(0.5);
    });
  });

  describe('keys', () => {
    it.each([
      {
        name: 'an hour up from 12',
        type: 'hour',
        value: '12:00',
        key: '{ArrowUp}',
        to: '13:00:00',
      },
      {
        name: 'a minute down from 0',
        type: 'minute',
        value: '09:00',
        key: '{ArrowDown}',
        to: '09:59:00',
      },
      {
        name: 'a minute with Page Up',
        type: 'minute',
        value: '09:10',
        key: '{PageUp}',
        to: '09:25:00',
      },
      { name: 'a minute with Home', type: 'minute', value: '09:10', key: '{Home}', to: '09:00:00' },
      { name: 'a minute with End', type: 'minute', value: '09:10', key: '{End}', to: '09:59:00' },
    ] as const)('moves $name', async ({ type, value, key, to }) => {
      const onValueChange = vi.fn();
      const { container, user } = await render(
        <Field defaultValue={Temporal.PlainTime.from(value)} onValueChange={onValueChange} />,
      );

      await user.click(segmentOf(container, type));
      await user.keyboard(key);

      expect(onValueChange.mock.calls[0]![1].reason).toBe('keyboard');
      expect(String(onValueChange.mock.calls[0]![0])).toBe(to);
    });

    it('types the digits of a number and moves the focus to the next segment', async () => {
      const onValueChange = vi.fn();
      const { container, user } = await render(
        <Field defaultValue={Temporal.PlainTime.from('09:00')} onValueChange={onValueChange} />,
      );

      await user.click(segmentOf(container, 'hour'));
      await user.keyboard('11');

      expect(onValueChange.mock.calls.at(-1)![1].reason).toBe('input-change');
      expect(String(onValueChange.mock.calls.at(-1)![0])).toBe('11:00:00');
      expect(segmentOf(container, 'minute')).toHaveFocus();
    });

    it('sets the day period from its first letter', async () => {
      const onValueChange = vi.fn();
      const { container, user } = await render(
        <Field defaultValue={Temporal.PlainTime.from('09:30')} onValueChange={onValueChange} />,
      );

      await user.click(segmentOf(container, 'dayPeriod'));
      await user.keyboard('p');

      expect(String(onValueChange.mock.calls.at(-1)![0])).toBe('21:30:00');
    });

    it('changes nothing in a read-only field', async () => {
      const onValueChange = vi.fn();
      const { container, user } = await render(
        <Field
          defaultValue={Temporal.PlainTime.from('09:30')}
          onValueChange={onValueChange}
          readOnly
        />,
      );

      await user.click(segmentOf(container, 'minute'));
      await user.keyboard('{ArrowUp}1');

      expect(onValueChange).not.toHaveBeenCalled();
      expect(segmentOf(container, 'minute').value).toBe('30');
      expect(segmentOf(container, 'minute')).toHaveAttribute('readonly');
    });

    it('is disabled in a disabled field', async () => {
      const { container } = await render(
        <Field defaultValue={Temporal.PlainTime.from('09:30')} disabled />,
      );

      expect(segmentOf(container, 'minute')).toBeDisabled();
      expect(segmentOf(container, 'minute')).toHaveAttribute('data-disabled');
    });
  });
  describe('text before the hydration', () => {
    it.each([
      { name: 'the segment that has the focus', focus: true },
      { name: 'a segment that has no focus', focus: false },
    ])('takes a number that the user typed into $name', async ({ focus }) => {
      const props = { defaultValue: '15:04', locale: 'de-DE', name: 'alarm' };
      const serverHtml = await renderOnServer(FIXTURE, props);

      const { container } = await hydrateAfter(TimeFieldRootHydration, {
        serverHtml,
        props,
        before(serverContainer) {
          const hour = segmentOf(serverContainer, 'hour');
          hour.value = '9';
          if (focus) {
            hour.focus();
          }
        },
      });

      expect(segmentOf(container, 'hour').value).toBe('09');
      expect(container.querySelector<HTMLInputElement>('input[name="alarm"]')!.value).toBe('09:04');
      // A full segment gives the focus to the next segment only when it has the focus itself.
      expect(document.activeElement).toBe(focus ? segmentOf(container, 'minute') : document.body);
    });
  });
});
