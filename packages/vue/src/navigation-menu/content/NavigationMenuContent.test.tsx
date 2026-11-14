import { describe, expect, it } from 'vitest';
import { defineComponent, shallowRef } from 'vue';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  nextEvent,
  screen,
  waitFor,
} from '#test-utils';
import { NavigationMenu } from '@vase-ui/vue/navigation-menu';
import { useNavigationMenuRootContext } from '../root/NavigationMenuRootContext';
import type { NavigationMenuRootContext } from '../root/NavigationMenuRootContext';

// The root waits for the animations of its popup element before it unmounts the popup. This
// component gives the root an element to wait for.
const PopupElement = defineComponent(() => {
  const { popupElement } = useNavigationMenuRootContext();

  return () => (
    <div
      ref={(element) => {
        popupElement.value = element as HTMLElement | null;
      }}
    />
  );
});

// Gives the context of the root to the test. A template does not read `currentContentRef`.
let rootContext: NavigationMenuRootContext | undefined;
const ContextProbe = defineComponent(() => {
  rootContext = useNavigationMenuRootContext();
  return () => null;
});

interface MenuProps {
  keepMounted?: boolean;
  showViewport?: boolean;
  popup?: boolean;
  value?: string | null;
  duration?: number;
  onTransitionrun?: (event: TransitionEvent) => void;
}

// The content of an item fades in and out while the transitions are on.
const Menu = defineComponent<MenuProps>(
  (props) => () => (
    <NavigationMenu.Root value={props.value}>
      <style>
        {`[data-testid^="content"] { transition: opacity ${props.duration ?? 50}ms; }
          [data-starting-style], [data-ending-style] { opacity: 0; }`}
      </style>
      <NavigationMenu.List>
        <NavigationMenu.Item value="one">
          <NavigationMenu.Trigger data-testid="trigger-one">One</NavigationMenu.Trigger>
          <NavigationMenu.Content
            data-testid="content-one"
            keepMounted={props.keepMounted}
            onTransitionrun={props.onTransitionrun}
          >
            <NavigationMenu.Link href="#one">Link of one</NavigationMenu.Link>
            {/* The guard of a viewport in a nested menu is in the content of the menu above. */}
            <span data-vase-ui-focus-guard="" data-testid="guard" tabindex={0} />
          </NavigationMenu.Content>
        </NavigationMenu.Item>
        <NavigationMenu.Item value="two">
          <NavigationMenu.Trigger data-testid="trigger-two">Two</NavigationMenu.Trigger>
          <NavigationMenu.Content data-testid="content-two" keepMounted={props.keepMounted}>
            <NavigationMenu.Link href="#two">Link of two</NavigationMenu.Link>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
      </NavigationMenu.List>
      {props.showViewport === false ? null : <NavigationMenu.Viewport data-testid="viewport" />}
      {props.popup ? <PopupElement /> : null}
      <ContextProbe />
    </NavigationMenu.Root>
  ),
  { props: ['keepMounted', 'showViewport', 'popup', 'value', 'duration', 'onTransitionrun'] },
);

describe('<NavigationMenu.Content />', () => {
  const { render } = createRenderer();

  describeConformance.skip(<NavigationMenu.Content />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(
        <NavigationMenu.Root value="test">
          <NavigationMenu.Item>{node}</NavigationMenu.Item>
          <NavigationMenu.Viewport />
        </NavigationMenu.Root>,
      );
    },
  }));

  it('renders only the content of the active item, in the viewport', async () => {
    await render(<Menu />);
    expect(screen.queryAllByTestId(/^content-/)).toHaveLength(0);

    await fireEvent.click(screen.getByTestId('trigger-two'));

    const content = screen.getByTestId('content-two');
    expect(screen.getByTestId('viewport')).toContainElement(content);
    expect(content.parentElement).toBe(rootContext!.viewportTargetElement.value);
    expect(content).toHaveAttribute('data-open');
    expect(screen.getAllByTestId(/^content-/)).toHaveLength(1);
  });

  it('moves the focus between its links with the arrow keys', async () => {
    const { user } = await render(
      <NavigationMenu.Root defaultValue="one">
        <NavigationMenu.List>
          <NavigationMenu.Item value="one">
            <NavigationMenu.Content>
              <NavigationMenu.Link href="#first">First link</NavigationMenu.Link>
              <NavigationMenu.Link href="#second">Second link</NavigationMenu.Link>
            </NavigationMenu.Content>
          </NavigationMenu.Item>
        </NavigationMenu.List>
        <NavigationMenu.Viewport />
      </NavigationMenu.Root>,
    );
    const first = screen.getByRole('link', { name: 'First link' });
    const second = screen.getByRole('link', { name: 'Second link' });

    first.focus();
    await user.keyboard('[ArrowDown]');
    expect(second).toHaveFocus();

    await user.keyboard('[ArrowUp]');
    expect(first).toHaveFocus();
  });

  describe('currentContentRef of the root', () => {
    it('holds the element of the content of the active item', async () => {
      await render(<Menu />);
      expect(rootContext!.currentContentRef.value).toBe(null);

      await fireEvent.click(screen.getByTestId('trigger-one'));
      expect(rootContext!.currentContentRef.value).toBe(screen.getByTestId('content-one'));

      await fireEvent.click(screen.getByTestId('trigger-two'));
      expect(rootContext!.currentContentRef.value).toBe(screen.getByTestId('content-two'));
    });

    it('holds the element of a content that opens again while its exit transition runs', async () => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
      await render(<Menu duration={5000} />);
      await fireEvent.click(screen.getByTestId('trigger-one'));
      const content = screen.getByTestId('content-one');
      await fireEvent.click(screen.getByTestId('trigger-two'));
      expect(content).toHaveAttribute('data-ending-style');
      expect(rootContext!.currentContentRef.value).toBe(screen.getByTestId('content-two'));

      await fireEvent.click(screen.getByTestId('trigger-one'));

      expect(screen.getByTestId('content-one')).toBe(content);
      expect(rootContext!.currentContentRef.value).toBe(content);
    });

    it('holds only the element of the active content when each content is kept', async () => {
      await render(<Menu keepMounted />);
      await flushMicrotasks();
      expect(screen.getAllByTestId(/^content-/)).toHaveLength(2);
      expect(rootContext!.currentContentRef.value).toBe(null);

      await fireEvent.click(screen.getByTestId('trigger-one'));

      expect(screen.getAllByTestId(/^content-/)).toHaveLength(2);
      expect(rootContext!.currentContentRef.value).toBe(screen.getByTestId('content-one'));
    });
  });

  describe('prop: keepMounted', () => {
    it('keeps the content hidden in its item while the root has no viewport', async () => {
      await render(<Menu keepMounted showViewport={false} />);

      const content = screen.getByTestId('content-one');
      expect(content).toHaveAttribute('hidden');
      expect(content.parentElement).toBe(screen.getByTestId('trigger-one').parentElement);
    });

    it('keeps the content hidden in the viewport, and shows the content of the active item', async () => {
      await render(<Menu keepMounted />);
      const viewport = screen.getByTestId('viewport');
      expect(viewport).toContainElement(screen.getByTestId('content-one'));
      expect(viewport).toContainElement(screen.getByTestId('content-two'));
      expect(screen.getByTestId('content-one')).toHaveAttribute('hidden');
      expect(screen.getByTestId('content-two')).toHaveAttribute('hidden');

      await fireEvent.click(screen.getByTestId('trigger-one'));

      expect(screen.getByTestId('content-one')).not.toHaveAttribute('hidden');
      expect(screen.getByTestId('content-two')).toHaveAttribute('hidden');
    });

    it('moves the content into the viewport when the viewport mounts, and does not return it to its item', async () => {
      const showViewport = shallowRef(false);
      await render(() => <Menu keepMounted showViewport={showViewport.value} />);
      const item = screen.getByTestId('trigger-one').parentElement!;
      expect(item).toContainElement(screen.getByTestId('content-one'));

      showViewport.value = true;
      await flushMicrotasks();
      expect(screen.getByTestId('viewport')).toContainElement(screen.getByTestId('content-one'));
      expect(item).not.toContainElement(screen.getByTestId('content-one'));

      showViewport.value = false;
      await flushMicrotasks();
      expect(screen.queryAllByTestId(/^content-/)).toHaveLength(0);
    });
  });

  describe('exit', () => {
    it.each([
      { name: 'the focus is outside', focus: null, inert: true },
      { name: 'the focus is on a link in it', focus: 'link', inert: false },
      { name: 'the focus is on a focus guard in it', focus: 'guard', inert: true },
    ])(
      'takes the content out of the layout when another item opens, and has inert $inert when $name',
      async ({ focus, inert }) => {
        globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
        const leaving: { position: string; inert: boolean }[] = [];
        const value = shallowRef<string | null>('one');
        await render(() => (
          <Menu
            value={value.value}
            onTransitionrun={(event) => {
              const content = event.currentTarget as HTMLElement;
              leaving.push({
                position: content.style.position,
                inert: content.hasAttribute('inert'),
              });
            }}
          />
        ));
        const content = screen.getByTestId('content-one');
        expect(content).not.toHaveAttribute('inert');
        if (focus === 'link') {
          screen.getByRole('link', { name: 'Link of one' }).focus();
        } else if (focus === 'guard') {
          screen.getByTestId('guard').focus();
        }

        await nextEvent(content, 'transitionend', {
          after: 'transitionrun',
          action: () => {
            value.value = 'two';
          },
        });

        expect(leaving).toEqual([{ position: 'absolute', inert }]);
        expect(content).toHaveAttribute('data-ending-style');
        await waitFor(() => {
          expect(screen.getAllByTestId(/^content-/)).toHaveLength(1);
        });
      },
    );

    it('leaves the DOM with the popup, before its own exit transition ends', async () => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
      const value = shallowRef<string | null>('one');
      await render(() => <Menu popup duration={5000} value={value.value} />);
      expect(screen.getAllByTestId(/^content-/)).toHaveLength(1);

      value.value = null;

      await waitFor(() => {
        expect(screen.queryAllByTestId(/^content-/)).toHaveLength(0);
      });
    });
  });

  it('keeps the content mounted (hidden) post-hydration when keepMounted is true', async () => {
    await render(
      <NavigationMenu.Root>
        <NavigationMenu.List>
          <NavigationMenu.Item>
            <NavigationMenu.Trigger>Item 1</NavigationMenu.Trigger>
            <NavigationMenu.Content keepMounted data-testid="content-1">
              <NavigationMenu.Link href="#link-1">Link 1</NavigationMenu.Link>
            </NavigationMenu.Content>
          </NavigationMenu.Item>
        </NavigationMenu.List>
        <NavigationMenu.Portal>
          <NavigationMenu.Positioner>
            <NavigationMenu.Popup>
              <NavigationMenu.Viewport />
            </NavigationMenu.Popup>
          </NavigationMenu.Positioner>
        </NavigationMenu.Portal>
      </NavigationMenu.Root>,
    );

    const contents = screen.queryAllByTestId('content-1');
    expect(contents.length).toBe(1);
    expect(contents[0]).toHaveAttribute('hidden');
  });

  it('does not keep the content mounted post-hydration when keepMounted is false', async () => {
    await render(
      <NavigationMenu.Root>
        <NavigationMenu.List>
          <NavigationMenu.Item>
            <NavigationMenu.Trigger>Item 1</NavigationMenu.Trigger>
            <NavigationMenu.Content data-testid="content-1">
              <NavigationMenu.Link href="#link-1">Link 1</NavigationMenu.Link>
            </NavigationMenu.Content>
          </NavigationMenu.Item>
        </NavigationMenu.List>
        <NavigationMenu.Portal>
          <NavigationMenu.Positioner>
            <NavigationMenu.Popup>
              <NavigationMenu.Viewport />
            </NavigationMenu.Popup>
          </NavigationMenu.Positioner>
        </NavigationMenu.Portal>
      </NavigationMenu.Root>,
    );

    const contents = screen.queryAllByTestId('content-1');
    expect(contents.length).toBe(0);
  });

  it('moves content into the popup and keeps it there when switching triggers', async () => {
    await render(
      <NavigationMenu.Root>
        <NavigationMenu.List data-testid="list">
          <NavigationMenu.Item value="item-1">
            <NavigationMenu.Trigger>Item 1</NavigationMenu.Trigger>
            <NavigationMenu.Content keepMounted data-testid="content-1">
              <NavigationMenu.Link href="#link-1">Link 1</NavigationMenu.Link>
            </NavigationMenu.Content>
          </NavigationMenu.Item>
          <NavigationMenu.Item value="item-2">
            <NavigationMenu.Trigger>Item 2</NavigationMenu.Trigger>
            <NavigationMenu.Content keepMounted data-testid="content-2">
              <NavigationMenu.Link href="#link-2">Link 2</NavigationMenu.Link>
            </NavigationMenu.Content>
          </NavigationMenu.Item>
        </NavigationMenu.List>
        <NavigationMenu.Portal>
          <NavigationMenu.Positioner>
            <NavigationMenu.Popup>
              <NavigationMenu.Viewport data-testid="viewport" />
            </NavigationMenu.Popup>
          </NavigationMenu.Positioner>
        </NavigationMenu.Portal>
      </NavigationMenu.Root>,
    );

    const list = screen.getByTestId('list');

    await fireEvent.click(screen.getByRole('button', { name: 'Item 1' }));
    await flushMicrotasks();

    const viewport = screen.getByTestId('viewport');
    const content1 = screen.getByTestId('content-1');
    expect(viewport.contains(content1)).toBe(true);
    expect(list.contains(content1)).toBe(false);

    await fireEvent.click(screen.getByRole('button', { name: 'Item 2' }));
    await flushMicrotasks();

    await waitFor(() => {
      expect(screen.queryByTestId('content-2')).not.toBe(null);
    });

    const content1After = screen.queryByTestId('content-1');
    const content2 = screen.queryByTestId('content-2');
    if (!content1After || !content2) {
      throw new Error('Expected both contents to remain mounted inside the viewport.');
    }
    expect(viewport.contains(content1After)).toBe(true);
    expect(viewport.contains(content2)).toBe(true);
  });

  it('keeps content mounted inside the popup when closed if the portal is kept mounted', async () => {
    const { user } = await render(
      <NavigationMenu.Root>
        <NavigationMenu.List>
          <NavigationMenu.Item value="item-1">
            <NavigationMenu.Trigger>Item 1</NavigationMenu.Trigger>
            <NavigationMenu.Content keepMounted data-testid="content-1">
              <NavigationMenu.Link href="#link-1">Link 1</NavigationMenu.Link>
            </NavigationMenu.Content>
          </NavigationMenu.Item>
        </NavigationMenu.List>
        <NavigationMenu.Portal keepMounted>
          <NavigationMenu.Positioner>
            <NavigationMenu.Popup>
              <NavigationMenu.Viewport data-testid="viewport" />
            </NavigationMenu.Popup>
          </NavigationMenu.Positioner>
        </NavigationMenu.Portal>
      </NavigationMenu.Root>,
    );

    await user.click(screen.getByRole('button', { name: 'Item 1' }));
    await flushMicrotasks();

    const viewport = screen.getByTestId('viewport');
    expect(viewport.contains(screen.getByTestId('content-1'))).toBe(true);

    await user.keyboard('{Escape}');
    await flushMicrotasks();

    await waitFor(() => {
      expect(screen.getByTestId('content-1')).toHaveAttribute('hidden');
    });

    expect(viewport.contains(screen.getByTestId('content-1'))).toBe(true);
  });
});
