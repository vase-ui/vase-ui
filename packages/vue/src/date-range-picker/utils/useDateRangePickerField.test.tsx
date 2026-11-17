import { describe, expect, it, vi } from 'vitest';
import { DateField } from '@vase-ui/vue/date-field';
import { DateRangePicker } from '@vase-ui/vue/date-range-picker';
import { Field } from '@vase-ui/vue/field';
import { createRenderer, screen, waitFor } from '#test-utils';

const day = (text: string) => Temporal.PlainDate.from(text);
const range = (start: string, end: string) => [day(start), day(end)] as const;

const FIELDS = [
  { end: 'start', part: DateRangePicker.StartField, name: 'Start date' },
  { end: 'end', part: DateRangePicker.EndField, name: 'End date' },
] as const;

const segmentOf = (container: Element, type: string) =>
  container.querySelector<HTMLInputElement>(`input[data-type="${type}"]`)!;

// The start field and the end field share one composable, so each case runs for both parts.
describe.each(FIELDS)('the $end field of a date range picker', ({ part: Part, name }) => {
  const { render } = createRenderer();

  describe('name', () => {
    it('says which end the field shows', async () => {
      await render(
        <DateRangePicker.Root defaultValue={range('2026-11-18', '2026-11-20')}>
          <Part>
            <DateField.Input />
          </Part>
        </DateRangePicker.Root>,
      );

      expect(screen.getByRole('group', { name })).not.toBe(null);
    });

    it('takes the name of the consumer, and `null` removes it', async () => {
      await render(
        <DateRangePicker.Root defaultValue={range('2026-11-18', '2026-11-20')}>
          <Part aria-label="Check-in" data-testid="own" />
          <Part aria-label={null} data-testid="none" />
        </DateRangePicker.Root>,
      );

      expect(screen.getByTestId('own')).toHaveAttribute('aria-label', 'Check-in');
      expect(screen.getByTestId('none')).not.toHaveAttribute('aria-label');
    });

    it('takes its name from the elements of `aria-labelledby`', async () => {
      await render(
        <DateRangePicker.Root defaultValue={range('2026-11-18', '2026-11-20')}>
          <span id="other">Check-in</span>
          <Part aria-labelledby="other" data-testid="field">
            <DateField.Input />
          </Part>
        </DateRangePicker.Root>,
      );

      expect(screen.getByRole('group', { name: 'Check-in' })).toBe(screen.getByTestId('field'));
    });

    it('takes its name from a label whose `for` is its id', async () => {
      await render(
        <DateRangePicker.Root defaultValue={range('2026-11-18', '2026-11-20')}>
          <label for="own-id">Check-in</label>
          <Part id="own-id" data-testid="field">
            <DateField.Input />
          </Part>
        </DateRangePicker.Root>,
      );

      await waitFor(() => {
        expect(screen.getByRole('group', { name: 'Check-in' })).toBe(screen.getByTestId('field'));
      });
    });

    // A blank name gives nothing to a screen reader, so the part keeps its own name.
    it('keeps its own name for a blank name of the consumer', async () => {
      await render(
        <DateRangePicker.Root defaultValue={range('2026-11-18', '2026-11-20')}>
          <Part aria-label="  " data-testid="field" />
        </DateRangePicker.Root>,
      );

      expect(screen.getByTestId('field')).toHaveAttribute('aria-label', name);
    });
  });

  // The label of a Field names the picker, so it joins the name of each field.
  describe('name in a Field', () => {
    function renderInField(partProps: Record<string, unknown> = {}) {
      return render(
        <Field.Root>
          <Field.Label>Trip dates</Field.Label>
          <span id="other">Check-in</span>
          <DateRangePicker.Root defaultValue={range('2026-11-18', '2026-11-20')}>
            <Part data-testid="field" {...partProps}>
              <DateField.Input />
            </Part>
          </DateRangePicker.Root>
        </Field.Root>,
      );
    }

    it('is its own name and the label of the Field', async () => {
      await renderInField();

      expect(screen.getByRole('group', { name: `${name} Trip dates` })).toBe(
        screen.getByTestId('field'),
      );
    });

    it('is the name of the consumer and the label of the Field', async () => {
      await renderInField({ 'aria-label': 'Check-in' });

      expect(screen.getByRole('group', { name: 'Check-in Trip dates' })).toBe(
        screen.getByTestId('field'),
      );
    });

    it('is the label of the Field when the consumer removes the own name', async () => {
      await renderInField({ 'aria-label': null });

      expect(screen.getByRole('group', { name: 'Trip dates' })).toBe(screen.getByTestId('field'));
    });

    it('is the elements of `aria-labelledby` when the consumer gives it', async () => {
      await renderInField({ 'aria-labelledby': 'other' });

      expect(screen.getByRole('group', { name: 'Check-in' })).toBe(screen.getByTestId('field'));
    });
  });

  describe('Alt+Down', () => {
    it('opens the popup from a segment, with the first trigger', async () => {
      const onOpenChange = vi.fn();
      const { container, user } = await render(
        <DateRangePicker.Root
          defaultValue={range('2026-11-18', '2026-11-20')}
          onOpenChange={onOpenChange}
        >
          <Part>
            <DateField.Input />
          </Part>
          <DateRangePicker.Trigger>Open</DateRangePicker.Trigger>
        </DateRangePicker.Root>,
      );

      segmentOf(container, 'day').focus();
      await user.keyboard('{Alt>}{ArrowDown}{/Alt}');

      expect(onOpenChange).toHaveBeenCalledTimes(1);
      expect(onOpenChange.mock.lastCall?.[0]).toBe(true);
      expect(onOpenChange.mock.lastCall?.[1].reason).toBe('trigger-press');
      expect(onOpenChange.mock.lastCall?.[1].event.type).toBe('keydown');
      expect(screen.getByRole('button', { name: /Change dates/ })).toHaveAttribute(
        'aria-expanded',
        'true',
      );
      // The key does not change the value of the segment.
      expect(segmentOf(container, 'day').value).toBe(name === 'Start date' ? '18' : '20');
    });

    it('does nothing for the arrow key alone, and for the key with Shift or Control', async () => {
      const onOpenChange = vi.fn();
      const { container, user } = await render(
        <DateRangePicker.Root
          defaultValue={range('2026-11-18', '2026-11-20')}
          onOpenChange={onOpenChange}
        >
          <Part>
            <DateField.Input />
          </Part>
        </DateRangePicker.Root>,
      );

      segmentOf(container, 'day').focus();
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Shift>}{ArrowDown}{/Shift}');
      await user.keyboard('{Control>}{ArrowDown}{/Control}');

      expect(onOpenChange).not.toHaveBeenCalled();
    });

    it('does nothing while the popup is open', async () => {
      const onOpenChange = vi.fn();
      const { container, user } = await render(
        <DateRangePicker.Root
          defaultValue={range('2026-11-18', '2026-11-20')}
          defaultOpen
          onOpenChange={onOpenChange}
        >
          <Part>
            <DateField.Input />
          </Part>
        </DateRangePicker.Root>,
      );

      segmentOf(container, 'day').focus();
      await user.keyboard('{Alt>}{ArrowDown}{/Alt}');

      expect(onOpenChange).not.toHaveBeenCalled();
    });

    it.each([
      { state: 'disabled', props: { disabled: true } },
      { state: 'read-only', props: { readOnly: true } },
    ])('does nothing in a picker that is $state', async ({ props }) => {
      const onOpenChange = vi.fn();
      const { container, user } = await render(
        <DateRangePicker.Root
          defaultValue={range('2026-11-18', '2026-11-20')}
          onOpenChange={onOpenChange}
          {...props}
        >
          <Part>
            <DateField.Input />
          </Part>
        </DateRangePicker.Root>,
      );

      segmentOf(container, 'day').focus();
      await user.keyboard('{Alt>}{ArrowDown}{/Alt}');

      expect(onOpenChange).not.toHaveBeenCalled();
    });

    it('runs the listener of the consumer first, and it can prevent the open', async () => {
      const onOpenChange = vi.fn();
      const { container, user } = await render(
        <DateRangePicker.Root
          defaultValue={range('2026-11-18', '2026-11-20')}
          onOpenChange={onOpenChange}
        >
          <Part
            onKeydown={(event: KeyboardEvent) => {
              event.preventDefault();
            }}
          >
            <DateField.Input />
          </Part>
        </DateRangePicker.Root>,
      );

      segmentOf(container, 'day').focus();
      await user.keyboard('{Alt>}{ArrowDown}{/Alt}');

      expect(onOpenChange).not.toHaveBeenCalled();
    });
  });

  describe('the props of the root', () => {
    it.each([
      { prop: 'disabled', props: { disabled: true } },
      { prop: 'readOnly', props: { readOnly: true } },
    ])('gives `$prop` to its segments', async ({ props }) => {
      const { container } = await render(
        <DateRangePicker.Root defaultValue={range('2026-11-18', '2026-11-20')} {...props}>
          <Part>
            <DateField.Input />
          </Part>
        </DateRangePicker.Root>,
      );

      const attribute = 'disabled' in props ? 'disabled' : 'readonly';
      expect(segmentOf(container, 'day')).toHaveAttribute(attribute);
    });

    // `de-DE` puts the day first and has a 24-hour clock, so the hour cycle gives the day period.
    it('gives the locale, the granularity and the hour cycle to its segments', async () => {
      const { container } = await render(
        <DateRangePicker.Root
          defaultValue={[
            Temporal.PlainDateTime.from('2026-11-18T09:30'),
            Temporal.PlainDateTime.from('2026-11-20T17:45'),
          ]}
          locale="de-DE"
          granularity="minute"
          hourCycle={12}
        >
          <Part>
            <DateField.Input />
          </Part>
        </DateRangePicker.Root>,
      );

      expect(container.querySelector('input[data-type]')).toHaveAttribute('data-type', 'day');
      expect(segmentOf(container, 'minute')).toBeInTheDocument();
      expect(segmentOf(container, 'second')).toBe(null);
      expect(segmentOf(container, 'dayPeriod')).toBeInTheDocument();
    });
  });
});
