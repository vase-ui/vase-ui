import { expect, describe, it } from 'vitest';
import { computed, defineComponent, provide } from 'vue';
import { Toolbar } from '@vase-ui/vue/toolbar';
import { createRenderer, describeConformance, flushMicrotasks, screen } from '#test-utils';
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

describe('<Toolbar.Link />', () => {
  const { render } = createRenderer();

  describeConformance(<Toolbar.Link />, () => ({
    refInstanceof: window.HTMLAnchorElement,
    testRenderPropWith: 'a',
    render: (node) => render(<TestContexts>{node}</TestContexts>),
  }));

  describe('ARIA attributes', () => {
    it('renders an anchor', async () => {
      await render(
        <Toolbar.Root>
          <Toolbar.Link data-testid="link" href="https://base-ui.com" />
        </Toolbar.Root>,
      );

      expect(screen.getByTestId('link')).toBe(screen.getByRole('link'));
    });
  });

  describe('tab stop', () => {
    it('has the tab stop of the toolbar after it gets focus', async () => {
      await render(
        <Toolbar.Root>
          <Toolbar.Button data-testid="button" />
          <Toolbar.Link data-testid="link" href="https://base-ui.com" />
        </Toolbar.Root>,
      );
      const button = screen.getByTestId('button');
      const link = screen.getByTestId('link');
      expect(button).toHaveAttribute('tabindex', '0');
      expect(link).toHaveAttribute('tabindex', '-1');

      link.focus();
      await flushMicrotasks();

      expect(link).toHaveAttribute('tabindex', '0');
      expect(button).toHaveAttribute('tabindex', '-1');
    });
  });

  describe('state attributes', () => {
    it('has the orientation of the toolbar', async () => {
      await render(
        <Toolbar.Root orientation="vertical">
          <Toolbar.Link data-testid="link" href="https://base-ui.com" />
        </Toolbar.Root>,
      );

      expect(screen.getByTestId('link')).toHaveAttribute('data-orientation', 'vertical');
    });
  });
});
