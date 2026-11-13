import { expect, describe, it } from 'vitest';
import { defineComponent, KeepAlive, shallowRef } from 'vue';
import { Toolbar } from '@vase-ui/vue/toolbar';
import { DirectionProvider } from '@vase-ui/vue/direction-provider';
import type { TextDirection } from '@vase-ui/vue/direction-provider';
import {
  createRenderer,
  describeConformance,
  flushMicrotasks,
  hydrate,
  isJSDOM,
  renderOnServer,
  screen,
  takeReportedMessages,
} from '#test-utils';
import type { Orientation } from '../../internals/types';
import { useToolbarRootContext } from './ToolbarRootContext';
import ToolbarRootHydration from './ToolbarRootHydration.test.vue';

const HYDRATION_FIXTURE = 'src/toolbar/root/ToolbarRootHydration.test.vue';

function readTabindexes(root: ParentNode) {
  return ['a', 'b', 'c'].map((testId) =>
    root.querySelector(`[data-testid="${testId}"]`)?.getAttribute('tabindex'),
  );
}

function parse(html: string) {
  const template = document.createElement('template');
  template.innerHTML = html;
  return template.content;
}

describe('<Toolbar.Root />', () => {
  const { render } = createRenderer();

  describeConformance(<Toolbar.Root />, () => ({
    refInstanceof: window.HTMLDivElement,
    render,
  }));

  describe('ARIA attributes', () => {
    it('has role="toolbar"', async () => {
      const { container } = await render(<Toolbar.Root />);

      expect(container.firstElementChild as HTMLElement).toHaveAttribute('role', 'toolbar');
    });

    it.each<{ orientation: Orientation }>([
      { orientation: 'horizontal' },
      { orientation: 'vertical' },
    ])('has aria-orientation="$orientation"', async ({ orientation }) => {
      const { container } = await render(<Toolbar.Root orientation={orientation} />);

      const toolbar = container.firstElementChild as HTMLElement;
      expect(toolbar).toHaveAttribute('aria-orientation', orientation);
      expect(toolbar).toHaveAttribute('data-orientation', orientation);
    });
  });

  describe('context', () => {
    const OptionalToolbarConsumer = defineComponent(() => {
      const context = useToolbarRootContext(true);
      return () => <span>{context?.orientation.value ?? 'outside'}</span>;
    });

    it('allows optional consumers both outside and inside a toolbar', async () => {
      await render(
        <div>
          <OptionalToolbarConsumer />
          <Toolbar.Root orientation="vertical">
            <OptionalToolbarConsumer />
          </Toolbar.Root>
        </div>,
      );

      expect(screen.getByText('outside')).toBeVisible();
      expect(screen.getByText('vertical')).toBeVisible();
    });
  });

  describe.skipIf(isJSDOM)('keyboard navigation', () => {
    it.each<{
      direction: TextDirection;
      orientation: Orientation;
      nextKey: string;
      prevKey: string;
    }>([
      { direction: 'ltr', orientation: 'horizontal', nextKey: 'ArrowRight', prevKey: 'ArrowLeft' },
      { direction: 'ltr', orientation: 'vertical', nextKey: 'ArrowDown', prevKey: 'ArrowUp' },
      { direction: 'rtl', orientation: 'horizontal', nextKey: 'ArrowLeft', prevKey: 'ArrowRight' },
      { direction: 'rtl', orientation: 'vertical', nextKey: 'ArrowDown', prevKey: 'ArrowUp' },
    ])(
      '$direction, orientation: $orientation',
      async ({ direction, orientation, nextKey, prevKey }) => {
        const { user } = await render(
          <DirectionProvider direction={direction}>
            <Toolbar.Root dir={direction} orientation={orientation}>
              <Toolbar.Button />
              <Toolbar.Link href="https://base-ui.com">Link</Toolbar.Link>
              <Toolbar.Group>
                <Toolbar.Button />
                <Toolbar.Button />
              </Toolbar.Group>
              <Toolbar.Input defaultValue="" />
            </Toolbar.Root>
          </DirectionProvider>,
        );
        const [button1, groupedButton1, groupedButton2] = screen.getAllByRole('button');
        const link = screen.getByText('Link');
        const input = screen.getByRole('textbox');

        await user.keyboard('[Tab]');
        expect(button1).toHaveFocus();

        await user.keyboard(`[${nextKey}]`);
        expect(link).toHaveFocus();

        await user.keyboard(`[${nextKey}]`);
        expect(groupedButton1).toHaveFocus();

        await user.keyboard(`[${nextKey}]`);
        expect(groupedButton2).toHaveFocus();

        await user.keyboard(`[${nextKey}]`);
        expect(input).toHaveFocus();

        // loop to the beginning
        await user.keyboard(`[${nextKey}]`);
        expect(button1).toHaveFocus();

        await user.keyboard(`[${prevKey}]`);
        expect(input).toHaveFocus();

        await user.keyboard(`[${prevKey}]`);
        expect(groupedButton2).toHaveFocus();
      },
    );

    it.each<{ orientation: Orientation; otherKeys: string[] }>([
      { orientation: 'horizontal', otherKeys: ['ArrowDown', 'ArrowUp'] },
      { orientation: 'vertical', otherKeys: ['ArrowRight', 'ArrowLeft'] },
    ])(
      'does not move focus with the keys of the other axis, orientation: $orientation',
      async ({ orientation, otherKeys }) => {
        const { user } = await render(
          <Toolbar.Root orientation={orientation}>
            <Toolbar.Button data-testid="a" />
            <Toolbar.Button data-testid="b" />
          </Toolbar.Root>,
        );

        await user.keyboard('[Tab]');
        expect(screen.getByTestId('a')).toHaveFocus();

        for (const key of otherKeys) {
          await user.keyboard(`[${key}]`);
          expect(screen.getByTestId('a')).toHaveFocus();
        }
      },
    );

    it('does not move focus when a keydown listener of the consumer prevents the handler', async () => {
      const { user } = await render(
        <Toolbar.Root onKeydown={(event) => event.preventVaseUIHandler()}>
          <Toolbar.Button data-testid="a" />
          <Toolbar.Button data-testid="b" />
        </Toolbar.Root>,
      );

      await user.keyboard('[Tab]');
      expect(screen.getByTestId('a')).toHaveFocus();

      await user.keyboard('[ArrowRight]');
      expect(screen.getByTestId('a')).toHaveFocus();
    });

    it('does not wrap focus when loopFocus is false', async () => {
      const { user } = await render(
        <Toolbar.Root loopFocus={false}>
          <Toolbar.Button data-testid="first" />
          <Toolbar.Button data-testid="last" />
        </Toolbar.Root>,
      );
      const first = screen.getByTestId('first');
      const last = screen.getByTestId('last');

      await user.keyboard('[Tab]');
      expect(first).toHaveFocus();

      await user.keyboard('[ArrowLeft]');
      expect(first).toHaveFocus();

      await user.keyboard('[ArrowRight]');
      expect(last).toHaveFocus();

      await user.keyboard('[ArrowRight]');
      expect(last).toHaveFocus();
    });
  });

  describe('prop: disabled', () => {
    it('disables all toolbar items except links', async () => {
      await render(
        <Toolbar.Root disabled>
          <Toolbar.Button />
          <Toolbar.Link href="https://base-ui.com">Link</Toolbar.Link>
          <Toolbar.Input defaultValue="" />
          <Toolbar.Group>
            <Toolbar.Button />
            <Toolbar.Link href="https://base-ui.com">Link</Toolbar.Link>
            <Toolbar.Input defaultValue="" />
          </Toolbar.Group>
        </Toolbar.Root>,
      );

      [...screen.getAllByRole('button'), ...screen.getAllByRole('textbox')].forEach(
        (toolbarItem) => {
          expect(toolbarItem).toHaveAttribute('aria-disabled', 'true');
          expect(toolbarItem).toHaveAttribute('data-disabled');
        },
      );

      expect(screen.getByRole('group')).toHaveAttribute('data-disabled');

      screen.getAllByText('Link').forEach((link) => {
        expect(link).not.toHaveAttribute('data-disabled');
        expect(link).not.toHaveAttribute('aria-disabled');
      });
    });

    it('has data-disabled on the toolbar', async () => {
      await render(<Toolbar.Root disabled data-testid="toolbar" />);

      expect(screen.getByTestId('toolbar')).toHaveAttribute('data-disabled');
    });
  });

  describe.skipIf(isJSDOM)('prop: focusableWhenDisabled', () => {
    function expectFocusedWhenDisabled(element: Element) {
      expect(element).toHaveAttribute('data-disabled');
      expect(element).toHaveAttribute('aria-disabled', 'true');
      expect(element).toHaveFocus();
    }

    it('toolbar items can be focused when disabled by default', async () => {
      const { user } = await render(
        <Toolbar.Root>
          <Toolbar.Button disabled />
          <Toolbar.Group>
            <Toolbar.Button disabled />
            <Toolbar.Button disabled />
          </Toolbar.Group>
          <Toolbar.Input defaultValue="" disabled />
        </Toolbar.Root>,
      );

      const input = screen.getByRole('textbox');
      const buttons = screen.getAllByRole('button');
      [input, ...buttons].forEach((item) => {
        expect(item).not.toHaveAttribute('disabled');
      });

      const [button1, groupedButton1, groupedButton2] = buttons;

      await user.keyboard('[Tab]');
      expect(button1).toHaveFocus();

      await user.keyboard('[ArrowRight]');
      expectFocusedWhenDisabled(groupedButton1);

      await user.keyboard('[ArrowRight]');
      expectFocusedWhenDisabled(groupedButton2);

      await user.keyboard('[ArrowRight]');
      expectFocusedWhenDisabled(input);

      // loop to the beginning
      await user.keyboard('[ArrowRight]');
      expect(button1).toHaveAttribute('tabindex', '0');

      await user.keyboard('[ArrowLeft]');
      expectFocusedWhenDisabled(input);

      await user.keyboard('[ArrowLeft]');
      expectFocusedWhenDisabled(groupedButton2);
    });

    it('toolbar items can individually disable focusableWhenDisabled', async () => {
      const { user } = await render(
        <Toolbar.Root>
          <Toolbar.Button disabled />
          <Toolbar.Group>
            <Toolbar.Button disabled />
            <Toolbar.Button disabled focusableWhenDisabled={false} />
          </Toolbar.Group>
          <Toolbar.Input defaultValue="" disabled />
        </Toolbar.Root>,
      );

      const input = screen.getByRole('textbox');
      const buttons = screen.getAllByRole('button');
      const focusableWhenDisabledButtons = buttons.filter(
        (button) => button.getAttribute('data-focusable') != null,
      );
      [input, ...focusableWhenDisabledButtons].forEach((item) => {
        expect(item).not.toHaveAttribute('disabled');
      });

      const [button1, groupedButton1, groupedButton2] = buttons;
      expect(groupedButton2).toHaveAttribute('disabled');

      await user.keyboard('[Tab]');
      expect(button1).toHaveFocus();

      await user.keyboard('[ArrowRight]');
      expectFocusedWhenDisabled(groupedButton1);

      await user.keyboard('[ArrowRight]');
      expectFocusedWhenDisabled(input);

      // loop to the beginning
      await user.keyboard('[ArrowRight]');
      expect(button1).toHaveAttribute('tabindex', '0');

      await user.keyboard('[ArrowLeft]');
      expectFocusedWhenDisabled(input);

      await user.keyboard('[ArrowLeft]');
      expectFocusedWhenDisabled(groupedButton1);
    });

    it('moves the initial tab stop off a disabled, non-focusable first item', async () => {
      const { user } = await render(
        <Toolbar.Root>
          <Toolbar.Button disabled focusableWhenDisabled={false} />
          <Toolbar.Button />
          <Toolbar.Button />
        </Toolbar.Root>,
      );

      const [button1, button2, button3] = screen.getAllByRole('button');
      // a natively disabled first item cannot hold the single roving tab stop
      expect(button1).toHaveAttribute('disabled');
      expect(button1).not.toHaveAttribute('tabindex', '0');
      expect(button2).toHaveAttribute('tabindex', '0');

      await user.keyboard('[Tab]');
      expect(button2).toHaveFocus();

      await user.keyboard('[ArrowRight]');
      expect(button3).toHaveFocus();

      // looping back skips the disabled first item
      await user.keyboard('[ArrowRight]');
      expect(button2).toHaveFocus();
    });

    it('keeps an enabled item with focusableWhenDisabled={false} navigable', async () => {
      const { user } = await render(
        <Toolbar.Root>
          <Toolbar.Button />
          <Toolbar.Button focusableWhenDisabled={false} />
          <Toolbar.Button />
        </Toolbar.Root>,
      );

      const [button1, button2, button3] = screen.getAllByRole('button');
      expect(button2).not.toHaveAttribute('disabled');

      await user.keyboard('[Tab]');
      expect(button1).toHaveFocus();

      await user.keyboard('[ArrowRight]');
      expect(button2).toHaveFocus();

      await user.keyboard('[ArrowRight]');
      expect(button3).toHaveFocus();
    });

    it('skips a disabled Toolbar.Input with focusableWhenDisabled={false}', async () => {
      const { user } = await render(
        <Toolbar.Root>
          <Toolbar.Button />
          <Toolbar.Input defaultValue="" disabled focusableWhenDisabled={false} />
          <Toolbar.Button />
        </Toolbar.Root>,
      );

      const [button1, button2] = screen.getAllByRole('button');
      const input = screen.getByRole('textbox');

      await user.keyboard('[Tab]');
      expect(button1).toHaveFocus();

      await user.keyboard('[ArrowRight]');
      expect(input).not.toHaveFocus();
      expect(button2).toHaveFocus();
    });
  });

  describe('tab stop', () => {
    it('skips a disabled item that is not a native button and is not focusable', async () => {
      const { user } = await render(
        <Toolbar.Root>
          <Toolbar.Button data-testid="a" />
          <Toolbar.Button
            data-testid="b"
            as="span"
            nativeButton={false}
            disabled
            focusableWhenDisabled={false}
          />
          <Toolbar.Button data-testid="c" />
        </Toolbar.Root>,
      );

      await user.keyboard('[Tab]');
      expect(screen.getByTestId('a')).toHaveFocus();

      await user.keyboard('[ArrowRight]');
      expect(screen.getByTestId('c')).toHaveFocus();
    });

    it('moves off the first item when it becomes disabled and not focusable', async () => {
      const App = defineComponent(
        (props: { disabled: boolean }) => () => (
          <Toolbar.Root>
            <Toolbar.Button
              data-testid="a"
              disabled={props.disabled}
              focusableWhenDisabled={false}
            />
            <Toolbar.Button data-testid="b" />
            <Toolbar.Button data-testid="c" />
          </Toolbar.Root>
        ),
        { props: ['disabled'] },
      );
      const { container, setProps } = await render(<App disabled={false} />);
      expect(readTabindexes(container)).toEqual(['0', '-1', '-1']);

      await setProps({ disabled: true });
      await flushMicrotasks();

      expect(readTabindexes(container)).toEqual(['-1', '0', '-1']);
    });

    it('moves off the item that had focus when it becomes disabled and not focusable', async () => {
      const App = defineComponent(
        (props: { disabled: boolean }) => () => (
          <div>
            <Toolbar.Root>
              <Toolbar.Button data-testid="a" />
              <Toolbar.Button
                data-testid="b"
                disabled={props.disabled}
                focusableWhenDisabled={false}
              />
              <Toolbar.Button data-testid="c" />
            </Toolbar.Root>
            <button type="button" data-testid="outside" />
          </div>
        ),
        { props: ['disabled'] },
      );
      const { container, setProps, user } = await render(<App disabled={false} />);

      await user.keyboard('[Tab]');
      await user.keyboard('[ArrowRight]');
      expect(screen.getByTestId('b')).toHaveFocus();
      await user.keyboard('[Tab]');
      expect(screen.getByTestId('outside')).toHaveFocus();
      expect(readTabindexes(container)).toEqual(['-1', '0', '-1']);

      await setProps({ disabled: true });
      await flushMicrotasks();

      expect(readTabindexes(container)).toEqual(['0', '-1', '-1']);
    });

    it('stays on an item that becomes disabled and stays focusable', async () => {
      const App = defineComponent(
        (props: { disabled: boolean }) => () => (
          <Toolbar.Root>
            <Toolbar.Button data-testid="a" disabled={props.disabled} />
            <Toolbar.Button data-testid="b" />
            <Toolbar.Button data-testid="c" />
          </Toolbar.Root>
        ),
        { props: ['disabled'] },
      );
      const { container, setProps } = await render(<App disabled={false} />);

      await setProps({ disabled: true });
      await flushMicrotasks();

      expect(screen.getByTestId('a')).toHaveAttribute('aria-disabled', 'true');
      expect(readTabindexes(container)).toEqual(['0', '-1', '-1']);
    });
  });

  describe('KeepAlive', () => {
    const Other = defineComponent(() => () => <span data-testid="other" />);

    // In the first row, the items render again in the flush that activates the toolbar. In the
    // second row, they render again while their elements are not in the document.
    it.each([
      { name: 'in the flush of the activation', flushWhileInactive: false },
      { name: 'before the activation', flushWhileInactive: true },
    ])(
      'moves the tab stop off an item that becomes disabled while the toolbar is inactive, $name',
      async ({ flushWhileInactive }) => {
        const disabled = shallowRef(false);
        const Inner = defineComponent(() => () => (
          <Toolbar.Root>
            <Toolbar.Button data-testid="a" />
            <Toolbar.Button
              data-testid="b"
              disabled={disabled.value}
              focusableWhenDisabled={false}
            />
            <Toolbar.Button data-testid="c" />
          </Toolbar.Root>
        ));
        const App = defineComponent(
          (props: { visible: boolean }) => () => (
            <div>
              <KeepAlive>{props.visible ? <Inner /> : <Other />}</KeepAlive>
              <button type="button" data-testid="outside" />
            </div>
          ),
          { props: ['visible'] },
        );
        const { setProps, user } = await render(<App visible />);
        const items = ['a', 'b', 'c'].map((testId) => screen.getByTestId(testId));

        await user.keyboard('[Tab]');
        await user.keyboard('[ArrowRight]');
        expect(items[1]).toHaveFocus();
        await user.keyboard('[Tab]');
        expect(screen.getByTestId('outside')).toHaveFocus();

        await setProps({ visible: false });
        await flushMicrotasks();
        expect(items[1]).not.toBeInTheDocument();

        disabled.value = true;
        if (flushWhileInactive) {
          await flushMicrotasks();
        }
        await setProps({ visible: true });
        await flushMicrotasks();

        expect(items[1]).toBeInTheDocument();
        expect(items.map((item) => item.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);
      },
    );
  });

  describe('hydration', () => {
    it.each([
      { name: 'a toolbar with no disabled item', props: {}, tabindexes: ['0', '-1', '-1'] },
      {
        name: 'a first item disabled and not focusable',
        props: { first: 'disabled' },
        tabindexes: ['-1', '0', '-1'],
      },
      {
        name: 'a first item disabled and focusable',
        props: { first: 'focusable' },
        tabindexes: ['0', '-1', '-1'],
      },
      { name: 'a disabled toolbar', props: { disabled: true }, tabindexes: ['0', '-1', '-1'] },
    ] as const)('hydrates $name', async ({ props, tabindexes }) => {
      const serverHtml = await renderOnServer(HYDRATION_FIXTURE, props);
      expect(readTabindexes(parse(serverHtml))).toEqual(tabindexes);

      const { container } = await hydrate(ToolbarRootHydration, { serverHtml, props });

      expect(readTabindexes(container)).toEqual(tabindexes);
    });
  });

  // This case is the last one of the file. In Vue 3.5.0, a `setup` that throws leaves the current
  // instance set, and each later case of the file then gets a warning about a slot.
  describe('useToolbarRootContext', () => {
    it('throws when a part is outside Toolbar.Root', async () => {
      await expect(render(<Toolbar.Button />)).rejects.toThrow(
        'Vase UI: A part of Toolbar must be inside <Toolbar.Root>. Without a root the part has no orientation and no disabled state. Put the part inside <Toolbar.Root>.',
      );

      // Vue also warns about the error of `setup`.
      expect(takeReportedMessages()).toEqual([
        expect.stringContaining('Unhandled error during execution of setup function'),
      ]);
    });
  });
});
