import { describe, expect, it } from 'vitest';
import { defineComponent, KeepAlive, nextTick, onErrorCaptured, shallowRef } from 'vue';
import { Calendar } from '@vase-ui/vue/calendar';
import { createRenderer } from '#test-utils';

describe('broadcast calendar validation', () => {
  const { render } = createRenderer();

  it('reports each invalid combination once after the props change', async () => {
    const broadcast = shallowRef(false);
    const calendar = shallowRef('gregory');
    const visible = shallowRef(true);
    const errors: string[] = [];
    const Host = defineComponent(() => {
      onErrorCaptured((error) => {
        errors.push((error as Error).message);
        return false;
      });
      return () => (
        <KeepAlive>
          {visible.value ? (
            <Calendar.Root broadcastCalendar={broadcast.value} calendar={calendar.value} />
          ) : null}
        </KeepAlive>
      );
    });
    await render(<Host />);
    expect(errors).toEqual([]);

    broadcast.value = true;
    calendar.value = 'persian';
    await nextTick();
    expect(errors).toEqual([expect.stringContaining('shows the calendar `persian`')]);

    calendar.value = 'hebrew';
    await nextTick();
    expect(errors).toHaveLength(2);
    expect(errors[1]).toContain('shows the calendar `hebrew`');

    visible.value = false;
    await nextTick();
    visible.value = true;
    await nextTick();
    expect(errors).toHaveLength(2);

    broadcast.value = false;
    calendar.value = 'persian';
    await nextTick();
    expect(errors).toHaveLength(2);

    broadcast.value = true;
    await nextTick();
    expect(errors).toHaveLength(3);
    expect(errors[2]).toContain('shows the calendar `persian`');
  });
});
