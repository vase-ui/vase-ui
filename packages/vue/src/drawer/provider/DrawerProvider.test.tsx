import { describe, expect, it } from 'vitest';
import { defineComponent } from 'vue';
import { createRenderer, hydrate, renderOnServer, screen, within } from '#test-utils';
import * as Drawer from '../index.parts';
import { useDrawerProviderContext } from './DrawerProviderContext';
import DrawerProviderHydration from './DrawerProviderHydration.test.vue';

const manualDrawer = {};
const missingDrawer = {};

const ProviderControls = defineComponent({
  setup() {
    const context = useDrawerProviderContext();

    return () =>
      context ? (
        <>
          <button onClick={() => context.setDrawerOpen(manualDrawer, true)}>Register open</button>
          <button onClick={() => context.setDrawerOpen(manualDrawer, false)}>
            Register closed
          </button>
          <button onClick={() => context.removeDrawer(manualDrawer)}>Remove registered</button>
          <button onClick={() => context.removeDrawer(missingDrawer)}>Remove missing</button>
          <button
            onClick={() =>
              context.visualStateStore.set({ swipeProgress: 0.5, frontmostHeight: 120 })
            }
          >
            Set visual state
          </button>
          <button onClick={() => context.visualStateStore.set({ swipeProgress: 0 })}>
            Clear progress
          </button>
          <button onClick={() => context.visualStateStore.set({ frontmostHeight: 0 })}>
            Clear height
          </button>
          <button
            onClick={() =>
              context.visualStateStore.set({ swipeProgress: Number.NaN, frontmostHeight: Infinity })
            }
          >
            Set invalid visual state
          </button>
        </>
      ) : null;
  },
});

const MultipleDrawers = defineComponent({
  props: {
    firstOpen: { type: Boolean, required: true },
    secondOpen: { type: Boolean, required: true },
    showSecond: { type: Boolean, required: true },
  },
  setup(props) {
    return () => (
      <Drawer.Provider>
        <Drawer.IndentBackground data-testid="background" />
        <Drawer.Root open={props.firstOpen}>First drawer</Drawer.Root>
        {props.showSecond && <Drawer.Root open={props.secondOpen}>Second drawer</Drawer.Root>}
      </Drawer.Provider>
    );
  },
});

const VisualStateCase = defineComponent({
  props: { showIndent: { type: Boolean, required: true } },
  setup(props) {
    return () => (
      <Drawer.Provider>
        {props.showIndent && <Drawer.Indent data-testid="indent" />}
        <ProviderControls />
      </Drawer.Provider>
    );
  },
});

describe('<Drawer.Provider />', () => {
  const { render } = createRenderer();

  it('stays active until every open drawer is closed or removed', async () => {
    const { setProps } = await render(
      <MultipleDrawers firstOpen={false} secondOpen={false} showSecond />,
    );
    const background = screen.getByTestId('background');

    expect(background).toHaveAttribute('data-inactive', '');

    await setProps({ firstOpen: true, secondOpen: false, showSecond: true });
    expect(background).toHaveAttribute('data-active', '');

    await setProps({ firstOpen: false, secondOpen: true, showSecond: true });
    expect(background).toHaveAttribute('data-active', '');

    await setProps({ firstOpen: false, secondOpen: true, showSecond: false });
    expect(background).toHaveAttribute('data-inactive', '');
  });

  it('ignores redundant registry updates without disturbing active state', async () => {
    const { user } = await render(
      <Drawer.Provider>
        <Drawer.IndentBackground data-testid="background" />
        <ProviderControls />
      </Drawer.Provider>,
    );
    const background = screen.getByTestId('background');

    await user.click(screen.getByRole('button', { name: 'Register open' }));
    expect(background).toHaveAttribute('data-active', '');

    await user.click(screen.getByRole('button', { name: 'Register open' }));
    await user.click(screen.getByRole('button', { name: 'Remove missing' }));
    expect(background).toHaveAttribute('data-active', '');

    await user.click(screen.getByRole('button', { name: 'Register closed' }));
    expect(background).toHaveAttribute('data-inactive', '');

    await user.click(screen.getByRole('button', { name: 'Remove registered' }));
    await user.click(screen.getByRole('button', { name: 'Remove registered' }));
    expect(background).toHaveAttribute('data-inactive', '');
  });

  it('synchronizes and restores visual state on Drawer.Indent', async () => {
    const { user, setProps } = await render(<VisualStateCase showIndent />);
    const indent = screen.getByTestId('indent');

    await user.click(screen.getByRole('button', { name: 'Set visual state' }));
    expect(indent.style.getPropertyValue('--drawer-swipe-progress')).toBe('0.5');
    expect(indent.style.getPropertyValue('--drawer-height')).toBe('120px');

    await user.click(screen.getByRole('button', { name: 'Clear progress' }));
    expect(indent.style.getPropertyValue('--drawer-swipe-progress')).toBe('0');
    expect(indent.style.getPropertyValue('--drawer-height')).toBe('120px');

    await user.click(screen.getByRole('button', { name: 'Clear height' }));
    expect(indent.style.getPropertyValue('--drawer-height')).toBe('');

    await user.click(screen.getByRole('button', { name: 'Set invalid visual state' }));
    expect(indent.style.getPropertyValue('--drawer-swipe-progress')).toBe('0');
    expect(indent.style.getPropertyValue('--drawer-height')).toBe('');

    await user.click(screen.getByRole('button', { name: 'Set visual state' }));
    await setProps({ showIndent: false });
    expect(indent.style.getPropertyValue('--drawer-swipe-progress')).toBe('0');
    expect(indent.style.getPropertyValue('--drawer-height')).toBe('');
  });

  it('allows indent parts to render without a provider', async () => {
    await render(
      <>
        <Drawer.Indent data-testid="indent" />
        <Drawer.IndentBackground data-testid="background" />
      </>,
    );

    expect(screen.getByTestId('indent')).toHaveAttribute('data-inactive', '');
    expect(screen.getByTestId('background')).toHaveAttribute('data-inactive', '');
  });

  describe('server render', () => {
    it('hydrates an open drawer with no message, and marks the indent parts active after the mount', async () => {
      const serverHtml = await renderOnServer(
        'src/drawer/provider/DrawerProviderHydration.test.vue',
        {},
      );
      const template = document.createElement('template');
      template.innerHTML = serverHtml;
      const serverIndent = template.content.querySelector('[data-testid="indent"]');
      expect(serverIndent?.getAttribute('data-inactive')).toBe('');
      expect(serverIndent?.getAttribute('style')).toBe('--drawer-swipe-progress:0;');

      const { container } = await hydrate(DrawerProviderHydration, { serverHtml });

      expect(within(container).getByTestId('indent')).toHaveAttribute('data-active', '');
      expect(within(container).getByTestId('background')).toHaveAttribute('data-active', '');
    });
  });
});
