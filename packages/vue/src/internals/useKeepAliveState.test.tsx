import { describe, expect, it, onTestFinished } from 'vitest';
import { createApp, defineComponent, onActivated, onMounted, shallowRef } from 'vue';
import type { Ref, VNodeChild } from 'vue';
import {
  createHeldBranch,
  createRenderer,
  flushMicrotasks,
  takeReportedMessages,
} from '#test-utils';
import { recordVueWarnings } from '../../test/reportedMessages';
import { useKeepAliveState } from './useKeepAliveState';
import type { KeepAliveState } from './useKeepAliveState';

describe('useKeepAliveState', () => {
  const { render } = createRenderer();

  type Mount =
    'with the branch' | 'while held' | 'in a show from a state' | 'in a show from a prop';

  // Mounts the part of `renderPart` in a `KeepAlive` branch as `mount` tells, and shows the branch.
  async function mountInBranch(renderPart: () => VNodeChild, mount: Mount) {
    const { HeldBranch, hide, mountWhileHeld, show, mountInActivation } = createHeldBranch(
      renderPart,
      { mounted: mount === 'with the branch' },
    );
    await render(<HeldBranch />);
    if (mount === 'while held') {
      await mountWhileHeld();
      await show();
    } else if (mount !== 'with the branch') {
      await hide();
      await mountInActivation({ fromProp: mount === 'in a show from a prop' });
    }
    return { hide, show };
  }

  it('does not hold a part of an app that mounts in a detached element', async () => {
    const Part = defineComponent(() => {
      const { isHeld } = useKeepAliveState();
      return () => <span data-testid="part" data-held={String(isHeld.value)} />;
    });
    const container = document.createElement('div');
    const app = createApp({ render: () => <Part /> });
    recordVueWarnings(app);
    app.mount(container);
    onTestFinished(() => app.unmount());
    await flushMicrotasks();

    expect(container.querySelector('[data-testid="part"]')).toHaveAttribute('data-held', 'false');
  });

  it.each<{ name: string; mount: Mount; held: [boolean, boolean] }>([
    { name: 'mounts while held', mount: 'while held', held: [true, false] },
    { name: 'mounts with its branch', mount: 'with the branch', held: [false, false] },
    { name: 'mounts in a show from a state', mount: 'in a show from a state', held: [true, false] },
    { name: 'mounts in a show from a prop', mount: 'in a show from a prop', held: [true, false] },
  ])('starts isHeld of a part that $name from its branch', async ({ mount, held }) => {
    let heldInSetup: boolean | undefined;
    let isHeld: Readonly<Ref<boolean>> | undefined;
    const RecordedPart = defineComponent(() => {
      ({ isHeld } = useKeepAliveState());
      heldInSetup = isHeld.value;
      return () => <span />;
    });

    await mountInBranch(() => <RecordedPart />, mount);

    expect([heldInSetup, isHeld?.value]).toEqual(held);
  });

  describe('shown', () => {
    it.each<{ name: string; mount: Mount; hooks: string[]; counts: number[] }>([
      {
        name: 'mounts with its branch',
        mount: 'with the branch',
        hooks: ['mounted', 'activated'],
        counts: [0, 1],
      },
      {
        name: 'mounts while held',
        mount: 'while held',
        hooks: ['mounted', 'activated'],
        counts: [1, 2],
      },
      {
        name: 'mounts in a show from a state',
        mount: 'in a show from a state',
        hooks: ['activated', 'mounted'],
        counts: [1, 2],
      },
      {
        name: 'mounts in a show from a prop',
        mount: 'in a show from a prop',
        hooks: ['mounted', 'activated'],
        counts: [1, 2],
      },
    ])('counts the activations of a part that $name', async ({ mount, hooks, counts }) => {
      const log: string[] = [];
      let shown: Readonly<Ref<number>> | undefined;
      const RecordedPart = defineComponent(() => {
        ({ shown } = useKeepAliveState());
        onMounted(() => log.push('mounted'));
        onActivated(() => log.push('activated'));
        return () => <span />;
      });

      const { hide, show } = await mountInBranch(() => <RecordedPart />, mount);
      const countAtShow = shown?.value;
      await hide();
      await show();

      expect(log.slice(0, 2)).toEqual(hooks);
      expect([countAtShow, shown?.value]).toEqual(counts);
    });
  });

  it('counts the next activation of a part whose mount flush ends with a render error', async () => {
    const isBroken = shallowRef(false);
    const BreakAfterMount = defineComponent(() => {
      onMounted(() => {
        isBroken.value = true;
      });
      return () => {
        if (isBroken.value) {
          throw new Error('render error');
        }
        return null;
      };
    });
    let state: KeepAliveState | undefined;
    const RecordedPart = defineComponent(() => {
      state = useKeepAliveState();
      return () => <span />;
    });
    const { HeldBranch, hide, show } = createHeldBranch(() => <RecordedPart />, { mounted: true });

    await expect(
      render(
        <>
          <BreakAfterMount />
          <HeldBranch />
        </>,
      ),
    ).rejects.toThrow('render error');
    expect(takeReportedMessages()).toHaveLength(2);

    await hide();
    await show();

    expect(state?.isHeld.value).toBe(false);
    expect(state?.shown.value).toBe(1);
  });
});
