import { describe, expect, it } from 'vitest';
import { shallowRef } from 'vue';
import * as Menu from '../index.parts';
import { createRenderer, describeConformance, flushMicrotasks, screen } from '#test-utils';
import {
  ContextMenuProvider,
  createContextMenuContext,
} from '../../../test/fixtures/MenuParentFixture';
import { createMenuStoreProbe } from '../../../test/fixtures/MenuStoreProbe';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import MenuBackdropReplace from './MenuBackdropReplace.test.vue';

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

  it('sets `pointer-events: none` style on backdrop if opened by hover', async () => {
    const { user } = await render(
      <Menu.Root>
        <Menu.Trigger delay={0} openOnHover>
          Open
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Backdrop data-testid="backdrop" />
          <Menu.Positioner>
            <Menu.Popup />
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>,
    );

    await user.hover(screen.getByText('Open'));

    expect(screen.getByTestId('backdrop').style.pointerEvents).toBe('none');
  });

  it('does not set the pointer events of the backdrop when a press opened the menu', async () => {
    const probe = createMenuStoreProbe();

    await render(
      <Menu.Root>
        <probe.Probe />
        <Menu.Backdrop data-testid="backdrop" />
      </Menu.Root>,
    );

    probe.store.setOpen(
      true,
      createChangeEventDetails(REASONS.triggerPress, new MouseEvent('mousedown')),
    );
    await flushMicrotasks();

    expect(screen.getByTestId('backdrop').style.pointerEvents).toBe('');
  });

  it('gives its element to the context menu above it, and takes it back at the unmount', async () => {
    const context = createContextMenuContext();
    const mounted = shallowRef(true);
    await render(() => (
      <ContextMenuProvider context={context}>
        <Menu.Root open>
          {mounted.value ? <Menu.Backdrop data-testid="backdrop" /> : null}
        </Menu.Root>
      </ContextMenuProvider>
    ));
    expect(context.backdropRef.value).toBe(screen.getByTestId('backdrop'));

    mounted.value = false;
    await flushMicrotasks();

    expect(context.backdropRef.value).toBe(null);
  });

  it('keeps the element of a new backdrop that replaces the old backdrop in the context menu', async () => {
    const context = createContextMenuContext();
    const swapped = shallowRef(false);
    await render(() => (
      <ContextMenuProvider context={context}>
        <Menu.Root open>
          <MenuBackdropReplace swapped={swapped.value} />
        </Menu.Root>
      </ContextMenuProvider>
    ));
    expect(context.backdropRef.value).toBe(screen.getByTestId('old'));

    swapped.value = true;
    await flushMicrotasks();

    expect(screen.queryByTestId('old')).toBe(null);
    expect(context.backdropRef.value).toBe(screen.getByTestId('new'));
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
