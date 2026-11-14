import { describe, expect, it } from 'vitest';
import { Menu } from '@vase-ui/vue/menu';
import {
  createRenderer,
  describeConformance,
  flushMicrotasks,
  screen,
} from '#test-utils';
import { createMenuStoreProbe } from '../../../test/fixtures/MenuStoreProbe';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';

describe('<Menu.Backdrop />', () => {
  const { render } = createRenderer();

  describeConformance(<Menu.Backdrop />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(<Menu.Root open>{node}</Menu.Root>);
    },
  }));

  it.each([false, true])(
    'does not start an entry phase when initially open (controlled=%s)',
    async (controlled) => {
      const statuses = new Set<Menu.Backdrop.State['transitionStatus']>();

      await render(
        <Menu.Root open={controlled ? true : undefined} defaultOpen={!controlled}>
          <Menu.Backdrop
            v-slots={{
              render: ({
                props,
                state,
              }: {
                props: Record<string, unknown>;
                state: Menu.Backdrop.State;
              }) => {
                statuses.add(state.transitionStatus);
                return <div {...props} />;
              },
            }}
          />
        </Menu.Root>,
      );

      expect(statuses).toEqual(new Set([undefined]));
    },
  );

  it.each([
    { name: 'a hover', reason: REASONS.triggerHover, pointerEvents: 'none' },
    { name: 'a press', reason: REASONS.triggerPress, pointerEvents: '' },
  ])('sets the pointer events of the backdrop when $name opened the menu', async (testCase) => {
    const probe = createMenuStoreProbe();

    await render(
      <Menu.Root>
        <probe.Probe />
        <Menu.Backdrop data-testid="backdrop" />
      </Menu.Root>,
    );

    probe.store.setOpen(true, createChangeEventDetails(testCase.reason, new MouseEvent('mousedown')));
    await flushMicrotasks();

    expect(screen.getByTestId('backdrop').style.pointerEvents).toBe(testCase.pointerEvents);
  });

  it('is hidden while the menu is not mounted', async () => {
    await render(
      <Menu.Root>
        <Menu.Backdrop data-testid="backdrop" />
      </Menu.Root>,
    );

    expect(screen.getByTestId('backdrop')).toHaveAttribute('hidden');
    expect(screen.getByTestId('backdrop')).toHaveAttribute('role', 'presentation');
  });
});
