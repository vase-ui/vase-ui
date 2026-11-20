import { describe, expect, it, vi } from 'vitest';
import { TimePicker } from '@vase-ui/vue/time-picker';
import { createRenderer, fireEvent, screen, waitFor } from '#test-utils';
import { createPartRef } from '../../date-picker/root/test-utils';
import { pointOnFace } from '../../../test/time-clockTestUtils';
import TimePickerAnatomy from '../root/TimePickerAnatomy.test.vue';

const time = (text: string) => Temporal.PlainTime.from(text);
const mouse = { button: 0, buttons: 1, pointerId: 1, pointerType: 'mouse' };

describe('<TimePicker.Clock />', () => {
  const { render } = createRenderer();

  it('renders the tag of `as` and the element of the `#render` slot, and exposes each', async () => {
    const section = createPartRef<{ element: HTMLElement | null }>();
    const article = createPartRef<{ element: HTMLElement | null }>();
    await render(
      <TimePicker.Root>
        <TimePicker.Clock as="section" ref={section.ref} data-testid="section" />
        <TimePicker.Clock ref={article.ref}>
          {{
            render: ({ props }: { props: Record<string, unknown> }) => (
              <article {...props} data-testid="article" />
            ),
          }}
        </TimePicker.Clock>
      </TimePicker.Root>,
    );

    expect(section.current.element).toBe(screen.getByTestId('section'));
    expect(section.current.element?.localName).toBe('section');
    expect(article.current.element).toBe(screen.getByTestId('article'));
    expect(article.current.element).toHaveAttribute('role', 'group');
  });

  // The popup is open, and the face has a size in the fixture, so a press at an angle selects a
  // number.
  async function renderClock(
    rootProps: Record<string, unknown> = {},
    clockProps: Record<string, unknown> = {},
  ) {
    const result = await render(
      <TimePickerAnatomy
        {...{
          locale: 'en-US',
          hourCycle: 12,
          defaultOpen: true,
          clock: true,
          clockProps,
          ...rootProps,
        }}
      />,
    );
    await screen.findByTestId('face');
    return result;
  }

  async function pressAt(angle: number) {
    const face = screen.getByTestId('face');
    await fireEvent.pointerDown(face, { ...mouse, ...pointOnFace(face, angle) });
    await fireEvent.pointerUp(face, { ...mouse, ...pointOnFace(face, angle) });
  }

  describe('the value of the picker', () => {
    it('shows the time of the value, in the view and in the day period', async () => {
      await renderClock({ defaultValue: time('15:30') });

      expect(screen.getByRole('slider')).toHaveValue('3');
      expect(screen.getByTestId('pm')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByTestId('am')).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getByTestId('clock')).not.toHaveAttribute('data-empty');
    });

    it('shows the reference time while the picker has no value', async () => {
      await renderClock({ referenceDate: time('09:00') });

      expect(screen.getByRole('slider')).toHaveValue('9');
      expect(screen.getByTestId('clock')).toHaveAttribute('data-empty');
    });

    it('gives the time of a press to the picker, with the reason drag', async () => {
      const onValueChange = vi.fn();
      await renderClock({ defaultValue: time('15:30'), onValueChange });

      await pressAt(120);

      expect(onValueChange.mock.lastCall?.[0].toString()).toBe('16:30:00');
      expect(onValueChange.mock.lastCall?.[1].reason).toBe('drag');
    });

    it('gives the time of a key to the picker, with the reason keyboard', async () => {
      const onValueChange = vi.fn();
      const { user } = await renderClock({ defaultValue: time('15:30'), onValueChange });
      await waitFor(() => {
        expect(screen.getByRole('slider')).toHaveFocus();
      });

      await user.keyboard('{ArrowUp}');

      expect(onValueChange.mock.lastCall?.[0].toString()).toBe('16:30:00');
      expect(onValueChange.mock.lastCall?.[1].reason).toBe('keyboard');
    });

    it('gives the day period of a press on a day period to the picker, with the reason item-press', async () => {
      const onValueChange = vi.fn();
      const { user } = await renderClock({ defaultValue: time('15:30'), onValueChange });

      await user.click(screen.getByTestId('am'));

      expect(onValueChange.mock.lastCall?.[0].toString()).toBe('03:30:00');
      expect(onValueChange.mock.lastCall?.[1].reason).toBe('item-press');
    });

    it('keeps the kind, the date and the zone of the value', async () => {
      const onValueChange = vi.fn();
      const { user } = await renderClock({
        defaultValue: Temporal.ZonedDateTime.from('2026-11-14T15:30[Asia/Tokyo]'),
        onValueChange,
      });
      await waitFor(() => {
        expect(screen.getByRole('slider')).toHaveFocus();
      });

      await user.keyboard('{ArrowUp}');

      expect(onValueChange.mock.lastCall?.[0].toString()).toBe(
        '2026-11-14T16:30:00+09:00[Asia/Tokyo]',
      );
    });

    it('gives a value of the kind of the reference date while the picker has no value', async () => {
      const onValueChange = vi.fn();
      const { user } = await renderClock({
        referenceDate: Temporal.PlainDateTime.from('2026-11-20T09:00'),
        onValueChange,
      });
      await waitFor(() => {
        expect(screen.getByRole('slider')).toHaveFocus();
      });

      await user.keyboard('{ArrowUp}');

      expect(onValueChange.mock.lastCall?.[0].toString()).toBe('2026-11-20T10:00:00');
    });

    it('gives a value of the kind of the last value after the picker is emptied', async () => {
      const onValueChange = vi.fn();
      const { user, setProps } = await renderClock({
        modelValue: Temporal.PlainDateTime.from('2026-11-14T15:30'),
        onValueChange,
      });
      await setProps({ modelValue: null });
      await waitFor(() => {
        expect(screen.getByTestId('clock')).toHaveAttribute('data-empty');
      });
      screen.getByRole('slider').focus();

      await user.keyboard('{ArrowUp}');

      // The face of an empty clock shows midnight, which is 12 on a 12-hour face.
      expect(onValueChange.mock.lastCall?.[0].toString()).toBe('2026-11-14T01:00:00');
    });

    it('uses the hour cycle and the limits of the picker', async () => {
      await renderClock({ hourCycle: 24, minTime: time('10:00'), maxTime: time('12:30') });

      expect(screen.getByRole('slider')).toHaveAttribute('max', '23');
      expect(screen.queryByTestId('am')).toBe(null);
      expect(screen.getByText('9', { selector: '[aria-hidden]' })).toHaveAttribute('data-disabled');
      expect(screen.getByText('11', { selector: '[aria-hidden]' })).not.toHaveAttribute(
        'data-disabled',
      );
    });

    it('follows the read-only state of the picker', async () => {
      await renderClock({ readOnly: true });
      expect(screen.getByTestId('clock')).toHaveAttribute('data-readonly');
    });

    it('follows the disabled state of the picker', async () => {
      await renderClock({ disabled: true });
      expect(screen.getByTestId('clock')).toHaveAttribute('data-disabled');
    });
  });

  describe('the events that are not about the value', () => {
    it('gives the commit to the listener of the consumer, with the value and the reason', async () => {
      const onValueCommitted = vi.fn();
      await renderClock({ defaultValue: time('15:30') }, { onValueCommitted });

      await pressAt(120);

      expect(onValueCommitted).toHaveBeenCalledTimes(1);
      expect(onValueCommitted.mock.lastCall?.[0].toString()).toBe('16:30:00');
      expect(onValueCommitted.mock.lastCall?.[1].reason).toBe('drag');
    });

    it('gives the new view to the listeners of the consumer', async () => {
      const onViewChange = vi.fn();
      const onUpdateView = vi.fn();
      await renderClock(
        { defaultValue: time('15:30') },
        { onViewChange, 'onUpdate:view': onUpdateView },
      );

      await pressAt(120);

      expect(onViewChange.mock.lastCall?.[0]).toBe('minute');
      expect(onViewChange.mock.lastCall?.[1].reason).toBe('drag');
      expect(onUpdateView).toHaveBeenCalledExactlyOnceWith('minute');
      expect(screen.getByTestId('clock')).toHaveAttribute('data-view', 'minute');
    });

    it('keeps the view when a listener cancels the change', async () => {
      const onUpdateView = vi.fn();
      await renderClock(
        { defaultValue: time('15:30') },
        {
          onViewChange: (_view: unknown, details: { cancel: () => void }) => {
            details.cancel();
          },
          'onUpdate:view': onUpdateView,
        },
      );

      await pressAt(120);

      expect(onUpdateView).not.toHaveBeenCalled();
      expect(screen.getByTestId('clock')).toHaveAttribute('data-view', 'hour');
    });
  });

  describe('the views', () => {
    it('goes on to the next view after a commit, up to the granularity', async () => {
      await renderClock({ granularity: 'second', closeOnSelect: false });

      await pressAt(90);
      await waitFor(() => {
        expect(screen.getByTestId('clock')).toHaveAttribute('data-view', 'minute');
      });

      await pressAt(180);
      await waitFor(() => {
        expect(screen.getByTestId('clock')).toHaveAttribute('data-view', 'second');
      });
    });

    it('keeps the last view after a refused request and a release', async () => {
      const onUpdateView = vi.fn();
      const { setProps } = await renderClock(
        { granularity: 'second', closeOnSelect: false },
        { view: 'minute', 'onUpdate:view': onUpdateView },
      );
      await pressAt(90);
      const clock = screen.getByTestId('clock');
      expect(onUpdateView).toHaveBeenCalledExactlyOnceWith('second');
      expect(clock).toHaveAttribute('data-view', 'minute');

      await setProps({ clockProps: {} });
      expect(clock).toHaveAttribute('data-view', 'minute');
      await pressAt(180);
      expect(clock).toHaveAttribute('data-view', 'second');
    });

    it('takes the view and the steps of the consumer', async () => {
      await renderClock({}, { defaultView: 'minute', minuteStep: 15 });

      expect(screen.getByTestId('clock')).toHaveAttribute('data-view', 'minute');
      expect(screen.getByRole('slider')).toHaveAttribute('step', '15');
    });
  });
});
