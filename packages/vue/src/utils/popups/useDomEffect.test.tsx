import { describe, expect, it, onTestFinished, vi } from 'vitest';
import {
  KeepAlive,
  Teleport,
  defineComponent,
  nextTick,
  onActivated,
  onDeactivated,
  onMounted,
  shallowRef,
} from 'vue';
import type { Ref } from 'vue';
import { createRenderer, flushMicrotasks, isVaporParts, screen } from '#test-utils';
import { EffectOwner } from '../../../test/fixtures/effectOwner';
import { addEventListener } from '../../common/addEventListener';
import { useDomEffect } from './useDomEffect';

describe('useDomEffect', () => {
  const { render } = createRenderer();

  it('releases and replaces the listener in the same task and discards a queued restart on unmount', async () => {
    const held = shallowRef(false);
    const key = shallowRef(0);
    const target = new EventTarget();
    const calls = vi.fn();
    let runs = 0;
    const install = () =>
      useDomEffect(
        [key],
        () => {
          const run = ++runs;
          return addEventListener(target, 'press', () => calls(run));
        },
        held,
      );
    expect((EffectOwner as { __vapor?: boolean }).__vapor === true).toBe(isVaporParts);
    const { unmount } = await render(<EffectOwner setupEffect={install} />);
    const press = () => target.dispatchEvent(new Event('press'));
    press();
    held.value = true;
    press();
    held.value = false;
    press();
    key.value++;
    unmount();
    press();
    await nextTick();
    press();
    expect(calls.mock.calls).toEqual([[1], [2]]);
    expect(runs).toBe(2);
  });

  it('releases the teleported listener before ancestor deactivation and restores it before activation', async () => {
    const target = document.createElement('div');
    document.body.append(target);
    onTestFinished(() => target.remove());
    const shown = shallowRef(true);
    const key = shallowRef(0);
    const source = shallowRef<HTMLElement | null>(null);
    const connections: boolean[][] = [];
    const calls: string[] = [];
    let phase = 'mount';
    const press = () => target.querySelector('button')?.click();
    const install = () => {
      useDomEffect([key], () => {
        const button = target.querySelector('button')!;
        connections.push([source.value!.isConnected, button.isConnected]);
        return addEventListener(button, 'click', () => calls.push(phase));
      });
      onMounted(() => {
        phase = 'mount';
        press();
      });
    };
    const Branch = defineComponent(() => {
      onDeactivated(() => {
        phase = 'hold';
        press();
        shown.value = true;
      });
      onActivated(() => {
        phase = 'show';
        press();
      });
      return () => (
        <div ref={source}>
          <Teleport to={target}>
            <EffectOwner setupEffect={install}>
              <button>Press</button>
            </EffectOwner>
          </Teleport>
        </div>
      );
    });
    await render(() => <KeepAlive>{shown.value ? <Branch /> : null}</KeepAlive>);
    expect(calls).toContain('mount');
    calls.length = 0;
    connections.length = 0;
    key.value++;
    shown.value = false;
    await nextTick();
    expect(connections).toEqual([
      [false, true],
      [true, true],
    ]);
    expect(calls).toEqual(['show']);
  });

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
