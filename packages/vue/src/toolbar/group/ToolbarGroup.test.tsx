import { expect, describe, it } from 'vitest';
import { computed, defineComponent, provide } from 'vue';
import { Toolbar } from '@vase-ui/vue/toolbar';
import { createRenderer, describeConformance, screen } from '#test-utils';
import { NOOP } from '../../internals/noop';
import { ToolbarRootContext } from '../root/ToolbarRootContext';
import { CompositeRootContext } from '../../internals/composite/root/CompositeRootContext';

const testCompositeContext: CompositeRootContext = {
  highlightedIndex: computed(() => 0),
  onHighlightedIndexChange: NOOP,
  highlightItemOnHover: computed(() => false),
  relayKeyboardEvent: NOOP,
  takeInitialTabStop: () => false,
  id: 'test',
  hasUnmountedTabStop: computed(() => false),
};

const testToolbarContext: ToolbarRootContext = {
  disabled: computed(() => false),
  orientation: computed(() => 'horizontal' as const),
};

const TestContexts = defineComponent((_, { slots }) => {
  provide(ToolbarRootContext, testToolbarContext);
  provide(CompositeRootContext, testCompositeContext);
  return () => slots.default?.();
});

describe('<Toolbar.Group />', () => {
  const { render } = createRenderer();

  describeConformance(<Toolbar.Group />, () => ({
    refInstanceof: window.HTMLDivElement,
    render: (node) => render(<TestContexts>{node}</TestContexts>),
  }));

  describe('ARIA attributes', () => {
    it('renders a group', async () => {
      await render(
        <Toolbar.Root>
          <Toolbar.Group data-testid="group" />
        </Toolbar.Root>,
      );

      expect(screen.getByTestId('group')).toBe(screen.getByRole('group'));
    });
  });

  describe('prop: disabled', () => {
    it('disables all toolbar items except links in the group', async () => {
      await render(
        <Toolbar.Root>
          <Toolbar.Group disabled>
            <Toolbar.Button />
            <Toolbar.Link href="https://base-ui.com">Link</Toolbar.Link>
            <Toolbar.Input defaultValue="" />
          </Toolbar.Group>
        </Toolbar.Root>,
      );

      [screen.getByRole('button'), screen.getByRole('textbox')].forEach((toolbarItem) => {
        expect(toolbarItem).toHaveAttribute('aria-disabled', 'true');
        expect(toolbarItem).toHaveAttribute('data-disabled');
      });

      expect(screen.getByText('Link')).not.toHaveAttribute('data-disabled');
      expect(screen.getByText('Link')).not.toHaveAttribute('aria-disabled');
    });
  });

  describe('state attributes', () => {
    it('has the orientation of the toolbar', async () => {
      await render(
        <Toolbar.Root orientation="vertical">
          <Toolbar.Group data-testid="group" />
        </Toolbar.Root>,
      );

      expect(screen.getByTestId('group')).toHaveAttribute('data-orientation', 'vertical');
    });
  });
});
