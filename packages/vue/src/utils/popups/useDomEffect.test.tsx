import { describe, expect, it } from 'vitest';
import { KeepAlive, defineComponent, shallowRef } from 'vue';
import type { Ref } from 'vue';
import { createRenderer, flushMicrotasks, screen } from '#test-utils';
import { useDomEffect } from './useDomEffect';

describe('useDomEffect', () => {
  const { render } = createRenderer();

  /**
   * A part that shows `count` and records each run and each cleanup of its effect. A run records
   * the text of the DOM at that moment.
   */
  function createPart(count: Ref<number>, log: string[]) {
    return defineComponent({
      setup() {
        useDomEffect([count], () => {
          const text = screen.getByTestId('count').textContent;
          log.push(`run ${text}`);
          return () => {
            log.push(`cleanup ${text}`);
          };
        });
        return () => <p data-testid="count">{count.value}</p>;
      },
    });
  }

  it('runs at mount, and after the DOM update of each change of a source, with the cleanup of the last run first', async () => {
    const count = shallowRef(0);
    const log: string[] = [];
    const Part = createPart(count, log);
    const { unmount } = await render(<Part />);
    expect(log).toEqual(['run 0']);

    count.value = 1;
    await flushMicrotasks();
    expect(log).toEqual(['run 0', 'cleanup 0', 'run 1']);

    unmount();
    expect(log).toEqual(['run 0', 'cleanup 0', 'run 1', 'cleanup 1']);
  });

  it('runs the cleanup when KeepAlive deactivates the part, does not run while KeepAlive holds it, and runs again at the activation', async () => {
    const count = shallowRef(0);
    const log: string[] = [];
    const Part = createPart(count, log);
    const Other = defineComponent({ setup: () => () => <p>other</p> });
    const show = shallowRef(true);
    await render(() => (
      <KeepAlive>{show.value ? <Part key="part" /> : <Other key="other" />}</KeepAlive>
    ));
    // The activation hook of the first mount starts no second run.
    expect(log).toEqual(['run 0']);

    show.value = false;
    await flushMicrotasks();
    expect(log).toEqual(['run 0', 'cleanup 0']);

    count.value = 1;
    await flushMicrotasks();
    expect(log).toEqual(['run 0', 'cleanup 0']);

    show.value = true;
    await flushMicrotasks();
    expect(log).toEqual(['run 0', 'cleanup 0', 'run 1']);
  });
});
