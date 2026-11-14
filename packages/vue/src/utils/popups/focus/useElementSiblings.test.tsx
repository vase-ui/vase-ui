import { describe, expect, it, onTestFinished } from 'vitest';
import { nextTick, shallowRef, Teleport } from 'vue';
import { createRenderer, hydrate, renderOnServer, screen } from '#test-utils';
import ElementSiblingsPage from './ElementSiblingsPage.test.vue';
import ElementSiblingsProbe from './ElementSiblingsProbe.test.vue';

const PAGE_FILE = 'src/utils/popups/focus/ElementSiblingsPage.test.vue';

function readChildTestIds(parent: HTMLElement = screen.getByTestId('host')) {
  return Array.from(parent.children, (child) => child.getAttribute('data-testid')).join(' ');
}

const PLACED = 'before-1 before-2 element after-1 after-2';

describe('useElementSiblings', () => {
  const { render } = createRenderer();

  it('puts the nodes before and after the element, in their order', async () => {
    await render(<ElementSiblingsPage items={['x', 'element', 'y']} />);

    expect(readChildTestIds()).toBe(`x ${PLACED} y end`);
  });

  it('removes the nodes when the siblings become null, and puts the same nodes back', async () => {
    const placed = shallowRef(true);
    await render(() => <ElementSiblingsPage placed={placed.value} />);
    const first = screen.getByTestId('before-1');

    placed.value = false;
    await nextTick();

    expect(readChildTestIds()).toBe('element end');

    placed.value = true;
    await nextTick();

    expect(readChildTestIds()).toBe(`${PLACED} end`);
    expect(screen.getByTestId('before-1')).toBe(first);
  });

  it('removes a node that the new siblings do not hold', async () => {
    const after = shallowRef(['after-1', 'after-2']);
    await render(() => (
      <div data-testid="host">
        <ElementSiblingsProbe after={after.value} />
      </div>
    ));
    expect(readChildTestIds()).toBe(PLACED);

    after.value = ['after-2'];
    await nextTick();

    expect(readChildTestIds()).toBe('before-1 before-2 element after-2');
  });

  it('keeps the nodes beside the element when the parent moves the part', async () => {
    const items = shallowRef(['x', 'element', 'y']);
    await render(() => <ElementSiblingsPage items={items.value} />);
    const element = screen.getByTestId('element');

    items.value = ['element', 'x', 'y'];
    await nextTick();

    expect(readChildTestIds()).toBe(`${PLACED} x y end`);

    items.value = ['x', 'y', 'element'];
    await nextTick();

    expect(readChildTestIds()).toBe(`x y ${PLACED} end`);
    expect(screen.getByTestId('element')).toBe(element);
  });

  it('keeps the nodes beside the element when the parent puts a new node before the part', async () => {
    // Each child is a keyed node with no fragment, so Vue inserts the new node immediately before
    // the element of the part.
    const items = shallowRef(['element', 'y']);
    await render(() => (
      <div data-testid="host">
        {items.value.map((item) =>
          item === 'element' ? (
            <ElementSiblingsProbe key={item} />
          ) : (
            <b key={item} data-testid={item} />
          ),
        )}
      </div>
    ));

    items.value = ['x', 'element', 'y'];
    await nextTick();

    expect(readChildTestIds()).toBe(`x ${PLACED} y`);
  });

  it('keeps the nodes beside the element when a new parent of the part gets a new node', async () => {
    const parents = [document.createElement('div'), document.createElement('div')] as const;
    document.body.append(...parents);
    onTestFinished(() => {
      parents[0].remove();
      parents[1].remove();
    });
    const parent = shallowRef<HTMLElement>(parents[0]);
    const items = shallowRef(['element']);
    await render(() => (
      <Teleport to={parent.value}>
        {items.value.map((item) =>
          item === 'element' ? (
            <ElementSiblingsProbe key={item} />
          ) : (
            <b key={item} data-testid={item} />
          ),
        )}
      </Teleport>
    ));
    expect(readChildTestIds(parents[0])).toBe(PLACED);

    parent.value = parents[1];
    await nextTick();

    expect(readChildTestIds(parents[0])).toBe('');
    expect(readChildTestIds(parents[1])).toBe(PLACED);

    items.value = ['x', 'element'];
    await nextTick();

    expect(readChildTestIds(parents[1])).toBe(`x ${PLACED}`);
  });

  it('places the nodes when the element comes after the nodes', async () => {
    const rendered = shallowRef(false);
    await render(() => <ElementSiblingsPage rendered={rendered.value} />);
    expect(readChildTestIds()).toBe('end');

    rendered.value = true;
    await nextTick();

    expect(readChildTestIds()).toBe(`${PLACED} end`);
  });

  it('keeps the nodes beside the element when the tag of the element changes', async () => {
    const as = shallowRef('button');
    await render(() => <ElementSiblingsPage as={as.value} />);

    as.value = 'a';
    await nextTick();

    expect(screen.getByTestId('element').localName).toBe('a');
    expect(readChildTestIds()).toBe(`${PLACED} end`);
  });

  it('removes the nodes when the parent replaces the part', async () => {
    const shown = shallowRef(true);
    await render(() => <ElementSiblingsPage mode="replace" shown={shown.value} />);
    expect(readChildTestIds()).toBe(`${PLACED} end`);

    shown.value = false;
    await nextTick();

    expect(readChildTestIds()).toBe('replacement end');

    shown.value = true;
    await nextTick();

    expect(readChildTestIds()).toBe(`${PLACED} end`);
  });

  it('takes the nodes out of the document while KeepAlive holds the part, and puts the same nodes back', async () => {
    const shown = shallowRef(true);
    await render(() => <ElementSiblingsPage mode="keep-alive" shown={shown.value} />);
    const nodes = ['before-1', 'before-2', 'after-1', 'after-2'].map((id) =>
      screen.getByTestId(id),
    );

    shown.value = false;
    await nextTick();

    expect(readChildTestIds()).toBe('end');
    expect(nodes.map((node) => node.isConnected)).toEqual([false, false, false, false]);

    shown.value = true;
    await nextTick();

    expect(readChildTestIds()).toBe(`${PLACED} end`);
    expect(
      ['before-1', 'before-2', 'after-1', 'after-2'].map((id) => screen.getByTestId(id)),
    ).toEqual(nodes);
  });

  it('releases the nodes when the part unmounts with its parent', async () => {
    const { unmount } = await render(<ElementSiblingsPage />);
    const node = screen.getByTestId('after-1');

    unmount();

    expect(node.parentNode).toBe(null);
  });

  describe('VUE-60: a part with nodes beside its element has one root node', () => {
    it('gives the scope id, the class and a custom directive of the consumer to the element', async () => {
      await render(<ElementSiblingsPage />);
      const element = screen.getByTestId('element');

      expect(getComputedStyle(element).outlineStyle).toBe('dashed');
      expect(element).toHaveAttribute('data-mark', 'marked');
      expect(readChildTestIds()).toBe(`${PLACED} end`);
    });

    it('hides the element with v-show', async () => {
      const shown = shallowRef(false);
      await render(() => <ElementSiblingsPage mode="show" shown={shown.value} />);
      const element = screen.getByTestId('element');

      expect(element).not.toBeVisible();

      shown.value = true;
      await nextTick();

      expect(element).toBeVisible();
    });

    it('renders in a Transition', async () => {
      // The test setup fails the case on the warning that Vue gives for a part with more than one
      // root node in a `Transition`.
      await render(<ElementSiblingsPage mode="transition" />);

      expect(readChildTestIds()).toBe(`${PLACED} end`);
    });
  });

  it('renders no node on a server, and places the nodes after the hydration', async () => {
    const serverHtml = await renderOnServer(PAGE_FILE);
    const template = document.createElement('template');
    template.innerHTML = serverHtml;
    expect(
      readChildTestIds(template.content.querySelector<HTMLElement>('[data-testid="host"]')!),
    ).toBe('element end');

    const { container } = await hydrate(ElementSiblingsPage, { serverHtml });

    expect(readChildTestIds(container.querySelector<HTMLElement>('[data-testid="host"]')!)).toBe(
      `${PLACED} end`,
    );
  });
});
