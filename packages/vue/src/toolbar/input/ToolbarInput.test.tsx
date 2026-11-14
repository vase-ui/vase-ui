import { expect, describe, it } from 'vitest';
import { computed, defineComponent, provide } from 'vue';
import { Toolbar } from '@vase-ui/vue/toolbar';
import { DirectionProvider } from '@vase-ui/vue/direction-provider';
import { NumberField } from '@vase-ui/vue/number-field';
import {
  createRenderer,
  describeConformance,
  hydrate,
  isJSDOM,
  renderOnServer,
  screen,
} from '#test-utils';
import { NOOP } from '../../internals/noop';
import { ToolbarRootContext } from '../root/ToolbarRootContext';
import type { Orientation } from '../../internals/types';
import { CompositeRootContext } from '../../internals/composite/root/CompositeRootContext';
import { ARROW_UP, ARROW_DOWN, ARROW_LEFT, ARROW_RIGHT } from '../../internals/composite/composite';
import ToolbarInputHydration from './ToolbarInputHydration.test.vue';

const HYDRATION_FIXTURE = 'src/toolbar/input/ToolbarInputHydration.test.vue';

function readTabindexes(root: ParentNode) {
  return ['input', 'button'].map((testId) =>
    root.querySelector(`[data-testid="${testId}"]`)?.getAttribute('tabindex'),
  );
}

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

describe('<Toolbar.Input />', () => {
  const { render } = createRenderer();

  describeConformance(<Toolbar.Input />, () => ({
    refInstanceof: window.HTMLInputElement,
    testRenderPropWith: 'input',
    render: (node) => render(<TestContexts>{node}</TestContexts>),
  }));

  describe('pointer interactions', () => {
    it('does not steal focus while disabled and becomes pointer-focusable when enabled', async () => {
      function TestInput({ disabled }: { disabled: boolean }) {
        return (
          <Toolbar.Root>
            <Toolbar.Button data-testid="button" />
            <Toolbar.Input data-testid="input" disabled={disabled} />
          </Toolbar.Root>
        );
      }

      const { setProps, user } = await render(<TestInput disabled />);
      const button = screen.getByTestId('button');
      const input = screen.getByTestId('input');

      await user.keyboard('[Tab]');
      expect(button).toHaveFocus();

      await user.click(input);
      expect(button).toHaveFocus();

      await setProps({ disabled: false });
      await user.click(input);
      expect(input).toHaveFocus();
    });

    it('prevents click default actions while disabled', async () => {
      function TestInput({ disabled }: { disabled: boolean }) {
        return (
          <Toolbar.Root>
            <Toolbar.Input type="checkbox" disabled={disabled} />
          </Toolbar.Root>
        );
      }

      const { setProps, user } = await render(<TestInput disabled />);
      const input = screen.getByRole('checkbox');

      await user.click(input);
      expect(input).not.toBeChecked();

      await setProps({ disabled: false });
      await user.click(input);
      expect(input).toBeChecked();
    });
  });

  describe.skipIf(isJSDOM)('keyboard navigation', () => {
    it.each([
      ['ltr', ARROW_RIGHT, ARROW_LEFT],
      ['rtl', ARROW_LEFT, ARROW_RIGHT],
    ] as const)(
      'respects caret and selection boundaries in horizontal %s toolbars',
      async (direction, nextKey, previousKey) => {
        const { user } = await render(
          <DirectionProvider direction={direction}>
            <Toolbar.Root orientation="horizontal">
              <Toolbar.Button data-testid="before" />
              <Toolbar.Input defaultValue="abcd" />
              <Toolbar.Button data-testid="after" />
            </Toolbar.Root>
          </DirectionProvider>,
        );
        const input = screen.getByRole('textbox') as HTMLInputElement;
        const before = screen.getByTestId('before');
        const after = screen.getByTestId('after');

        await user.keyboard('[Tab]');
        await user.keyboard(`[${nextKey}]`);
        expect(input).toHaveFocus();

        input.setSelectionRange(1, 3);
        await user.keyboard(`[${nextKey}]`);
        expect(input).toHaveFocus();

        input.setSelectionRange(2, 2);
        await user.keyboard(`[ShiftLeft>][${nextKey}][/ShiftLeft]`);
        expect(input).toHaveFocus();

        const nextBoundary =
          direction === 'rtl' || nextKey === ARROW_RIGHT ? input.value.length : 0;
        input.setSelectionRange(nextBoundary, nextBoundary);
        await user.keyboard(`[${nextKey}]`);
        expect(after).toHaveFocus();

        await user.keyboard(`[${previousKey}]`);
        expect(input).toHaveFocus();
        const previousBoundary =
          direction === 'rtl' || previousKey === ARROW_LEFT ? 0 : input.value.length;
        input.setSelectionRange(previousBoundary, previousBoundary);
        await user.keyboard(`[${previousKey}]`);
        expect(before).toHaveFocus();
      },
    );

    // when navigating through RTL text in real browsers the arrow keys for
    // moving the text insertion cursor is also reversed from LTR but this doesn't
    // work with testing library
    it.each<{ orientation: Orientation; nextKey: string; prevKey: string }>([
      { orientation: 'horizontal', nextKey: ARROW_RIGHT, prevKey: ARROW_LEFT },
      { orientation: 'vertical', nextKey: ARROW_DOWN, prevKey: ARROW_UP },
    ])('orientation: $orientation', async ({ orientation, nextKey, prevKey }) => {
      const { user } = await render(
        <Toolbar.Root orientation={orientation}>
          <Toolbar.Button />
          <Toolbar.Input defaultValue="abcd" />
          <Toolbar.Button />
        </Toolbar.Root>,
      );
      const input = screen.getByRole('textbox') as HTMLInputElement;
      const [button1, button2] = screen.getAllByRole('button');

      await user.keyboard('[Tab]');
      expect(button1).toHaveFocus();

      await user.keyboard(`[${nextKey}]`);
      expect(input).toHaveFocus();

      // Firefox doesn't support document.getSelection() in inputs
      expect(input.selectionStart).toBe(0);
      expect(input.selectionEnd).toBe(4);

      await user.keyboard(`[${ARROW_RIGHT}]`);
      await user.keyboard(`[${nextKey}]`);

      expect(button2).toHaveFocus();

      await user.keyboard(`[${prevKey}]`);
      expect(input).toHaveFocus();

      await user.keyboard(`[${ARROW_LEFT}]`);
      await user.keyboard(`[${prevKey}]`);

      expect(button1).toHaveFocus();
    });
  });

  describe.skipIf(isJSDOM)('disabled', () => {
    it('does not trap keyboard focus when disabled', async () => {
      const { user } = await render(
        <div>
          <Toolbar.Root>
            <Toolbar.Button data-testid="button" />
            <Toolbar.Input defaultValue="abcd" disabled />
          </Toolbar.Root>
          <button type="button" data-testid="after">
            after
          </button>
        </div>,
      );

      const button = screen.getByTestId('button');
      const input = screen.getByRole('textbox');
      const after = screen.getByTestId('after');

      await user.keyboard('[Tab]');
      expect(button).toHaveFocus();

      await user.keyboard(`[${ARROW_RIGHT}]`);
      expect(input).toHaveFocus();

      // Tab must leave the toolbar instead of being trapped on the disabled input
      await user.keyboard('[Tab]');
      expect(after).toHaveFocus();

      await user.keyboard('[ShiftLeft>][Tab][/ShiftLeft]');
      expect(input).toHaveFocus();
    });

    it('does not block vertical roving focus when disabled', async () => {
      const { user } = await render(
        <Toolbar.Root orientation="vertical">
          <Toolbar.Button data-testid="button1" />
          <Toolbar.Input defaultValue="abcd" disabled />
          <Toolbar.Button data-testid="button2" />
        </Toolbar.Root>,
      );

      const input = screen.getByRole('textbox');
      const button1 = screen.getByTestId('button1');
      const button2 = screen.getByTestId('button2');

      await user.keyboard('[Tab]');
      expect(button1).toHaveFocus();

      await user.keyboard(`[${ARROW_DOWN}]`);
      expect(input).toHaveFocus();

      // ArrowDown must move roving focus past the disabled input
      await user.keyboard(`[${ARROW_DOWN}]`);
      expect(button2).toHaveFocus();

      await user.keyboard(`[${ARROW_UP}]`);
      expect(input).toHaveFocus();

      await user.keyboard(`[${ARROW_UP}]`);
      expect(button1).toHaveFocus();
    });
  });

  describe('state attributes', () => {
    it('has the orientation of the toolbar and the focusable mark', async () => {
      await render(
        <Toolbar.Root orientation="vertical">
          <Toolbar.Input data-testid="focusable" />
          <Toolbar.Input data-testid="not-focusable" focusableWhenDisabled={false} />
        </Toolbar.Root>,
      );

      const focusable = screen.getByTestId('focusable');
      expect(focusable).toHaveAttribute('data-orientation', 'vertical');
      expect(focusable).toHaveAttribute('data-focusable');
      expect(screen.getByTestId('not-focusable')).not.toHaveAttribute('data-focusable');
    });
  });

  describe('prop: defaultValue', () => {
    it('keeps the text of the user when the input renders again', async () => {
      const { user } = await render(
        <Toolbar.Root>
          <Toolbar.Button data-testid="button" />
          <Toolbar.Input data-testid="input" defaultValue="abcd" />
        </Toolbar.Root>,
      );
      const input = screen.getByTestId('input') as HTMLInputElement;
      expect(input.value).toBe('abcd');
      expect(input).toHaveAttribute('value', 'abcd');

      await user.click(input);
      await user.keyboard('X');
      const typedValue = input.value;
      expect(typedValue).not.toBe('abcd');

      // The input loses the tab stop, so it renders again.
      await user.keyboard('[Home][ArrowLeft]');
      expect(screen.getByTestId('button')).toHaveFocus();
      expect(input).toHaveAttribute('tabindex', '-1');
      expect(input.value).toBe(typedValue);
    });
  });

  describe('rendering NumberField', () => {
    it('renders NumberField.Input', async () => {
      await render(
        <Toolbar.Root>
          <NumberField.Root>
            <NumberField.Group>
              <Toolbar.Input as={NumberField.Input} />
            </NumberField.Group>
          </NumberField.Root>
        </Toolbar.Root>,
      );

      expect(screen.getByRole('textbox')).toHaveAttribute('aria-roledescription', 'Number field');
    });
  });

  describe('hydration', () => {
    it.each([
      { name: 'an enabled input', props: {}, tabindexes: ['0', '-1'] },
      {
        name: 'a disabled input that is not focusable',
        props: { first: 'disabled' },
        tabindexes: ['-1', '0'],
      },
      {
        name: 'a disabled input that is focusable',
        props: { first: 'focusable' },
        tabindexes: ['0', '-1'],
      },
    ] as const)('hydrates $name', async ({ props, tabindexes }) => {
      const serverHtml = await renderOnServer(HYDRATION_FIXTURE, props);
      const template = document.createElement('template');
      template.innerHTML = serverHtml;
      expect(readTabindexes(template.content)).toEqual(tabindexes);
      expect(template.content.querySelector('input')?.getAttribute('value')).toBe('abcd');

      const { container } = await hydrate(ToolbarInputHydration, { serverHtml, props });

      expect(readTabindexes(container)).toEqual(tabindexes);
      expect(container.querySelector('input')).toHaveValue('abcd');
    });
  });
});
