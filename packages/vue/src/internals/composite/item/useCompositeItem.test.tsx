import { describe, expect, it, onTestFinished } from 'vitest';
import { createApp, createSSRApp } from 'vue';
import type { Component } from 'vue';
import {
  createRenderer,
  fireEvent,
  flushMicrotasks,
  hydrate,
  renderOnServer,
  screen,
  takeReportedMessages,
  waitFor,
  within,
} from '#test-utils';
import CompositeItem from '../../../../test/fixtures/CompositeItemPart.vue';
import CompositeRoot from '../../../../test/fixtures/CompositeRootPart.vue';
import { releaseAsyncBranch } from './CompositeItemAsyncBranch.test.vue';
import CompositeItemAsyncComponent, {
  releaseAsyncComponent,
} from './CompositeItemAsyncComponent.test.vue';
import CompositeItemAsyncSetup from './CompositeItemAsyncSetup.test.vue';
import CompositeItemAsyncSibling from './CompositeItemAsyncSibling.test.vue';
import CompositeItemNested from './CompositeItemNested.test.vue';
import CompositeItemTabStop from './CompositeItemTabStop.test.vue';

const TAB_STOP_FIXTURE = 'src/internals/composite/item/CompositeItemTabStop.test.vue';
const ASYNC_SETUP_FIXTURE = 'src/internals/composite/item/CompositeItemAsyncSetup.test.vue';
const ASYNC_COMPONENT_FIXTURE = 'src/internals/composite/item/CompositeItemAsyncComponent.test.vue';
const ASYNC_SIBLING_FIXTURE = 'src/internals/composite/item/CompositeItemAsyncSibling.test.vue';
const NESTED_FIXTURE = 'src/internals/composite/item/CompositeItemNested.test.vue';

// The `tabindex` of the items a, b and c.
function readTabindexes(root: ParentNode) {
  return ['a', 'b', 'c'].map((testId) =>
    root.querySelector(`[data-testid="${testId}"]`)?.getAttribute('tabindex'),
  );
}

// Two flushes: the first runs the renders that the mount queued, and the second runs the checks
// that those renders queued.
async function settle() {
  await flushMicrotasks();
  await flushMicrotasks();
}

// An item that hydrates has these two attributes, and the item removes both when it mounts.
function findHydrationAttributes(root: ParentNode) {
  return root.querySelector('[data-vase-ui-hydrating-composite-item], [data-allow-mismatch]');
}

// To assert on the server HTML before the hydration, parse it in a `<template>` element.
function parse(html: string) {
  const template = document.createElement('template');
  template.innerHTML = html;
  return template.content;
}

// The `hydrate` helper waits two ticks. An item below a `<Suspense>` hydrates after that, so the
// test hydrates by hand.
function startHydration(component: Component, serverHtml: string, props: Record<string, unknown>) {
  const container = document.createElement('div');
  document.body.append(container);
  container.innerHTML = serverHtml;

  const app = createSSRApp(component, props);
  onTestFinished(() => {
    app.unmount();
    container.remove();
  });

  return { container, mount: () => app.mount(container) };
}

describe('useCompositeItem', () => {
  const { render } = createRenderer();

  describe('hydration', () => {
    it('hydrates a list with an active item', async () => {
      const props = { hasActiveItem: true, active: ['c'] };
      const serverHtml = await renderOnServer(TAB_STOP_FIXTURE, props);
      expect(readTabindexes(parse(serverHtml))).toEqual(['-1', '-1', '0']);

      const { container } = await hydrate(CompositeItemTabStop, { serverHtml, props });

      expect(readTabindexes(container)).toEqual(['-1', '-1', '0']);
    });

    it('hydrates a list with no active item', async () => {
      const props = { disabled: ['a'] };
      const serverHtml = await renderOnServer(TAB_STOP_FIXTURE, props);
      expect(readTabindexes(parse(serverHtml))).toEqual(['-1', '0', '-1']);

      const { container } = await hydrate(CompositeItemTabStop, { serverHtml, props });

      expect(readTabindexes(container)).toEqual(['-1', '0', '-1']);
    });
  });

  describe('VUE-9: one tab stop until the last item is mounted', () => {
    it('keeps the tab stop on an item in an async component until the component loads', async () => {
      // The first server render loads the async component. The second render then runs the `setup`
      // of b in the order of the document.
      await renderOnServer(ASYNC_COMPONENT_FIXTURE);
      const serverHtml = await renderOnServer(ASYNC_COMPONENT_FIXTURE);
      const { container, mount } = startHydration(CompositeItemAsyncComponent, serverHtml, {});
      const [a, b, c] = ['a', 'b', 'c'].map((testId) => within(container).getByTestId(testId));

      expect(readTabindexes(container)).toEqual(['-1', '0', '-1']);

      mount();
      await settle();

      // The browser has not loaded the component, so it runs the `setup` of b after the `setup` of
      // c. The root has mapped a and c, and the tab stop stays on the element of b.
      expect(container.querySelector('[data-highlighted-index]')).toHaveAttribute(
        'data-highlighted-index',
        '1',
      );
      expect(readTabindexes(container)).toEqual(['-1', '0', '-1']);

      releaseAsyncComponent();
      await waitFor(() => {
        expect(b).toHaveAttribute('tabindex', '-1');
      });
      await settle();

      expect(readTabindexes(container)).toEqual(['-1', '-1', '0']);
      expect(findHydrationAttributes(container)).toBeNull();
      expect(within(container).getByTestId('a')).toBe(a);
      expect(within(container).getByTestId('b')).toBe(b);
      expect(within(container).getByTestId('c')).toBe(c);
      expect(takeReportedMessages()).toEqual([]);
    });

    it('keeps the tab stop on an active item below a Suspense until its setup ends', async () => {
      const props = { hasActiveItem: true, active: ['b'], late: true };
      const serverHtml = await renderOnServer(TAB_STOP_FIXTURE, props);
      const { container, mount } = startHydration(CompositeItemTabStop, serverHtml, props);
      const [a, b, c] = ['a', 'b', 'c'].map((testId) => within(container).getByTestId(testId));

      expect(readTabindexes(container)).toEqual(['-1', '0', '-1']);

      mount();
      await settle();

      // The root maps a and c before b renders. It finds no active item, so the mounted items would
      // take the tab stop on a.
      expect(readTabindexes(container)).toEqual(['-1', '0', '-1']);

      releaseAsyncBranch();
      await waitFor(() => {
        expect(b).toHaveAttribute('tabindex', '-1');
      });
      await settle();

      // b ends with no tab stop, as in Base UI for an item that comes late.
      expect(readTabindexes(container)).toEqual(['0', '-1', '-1']);
      expect(findHydrationAttributes(container)).toBeNull();
      expect(within(container).getByTestId('a')).toBe(a);
      expect(within(container).getByTestId('b')).toBe(b);
      expect(within(container).getByTestId('c')).toBe(c);
      expect(takeReportedMessages()).toEqual([]);
    });

    it('keeps the tab stop on a mounted item while an item with no tab stop waits for its mount', async () => {
      const props = { late: true };
      const serverHtml = await renderOnServer(TAB_STOP_FIXTURE, props);
      const { container, mount } = startHydration(CompositeItemTabStop, serverHtml, props);
      const [a, b, c] = ['a', 'b', 'c'].map((testId) => within(container).getByTestId(testId));

      // No item is active or disabled, so the server gave the tab stop to a.
      expect(readTabindexes(container)).toEqual(['0', '-1', '-1']);

      mount();
      await settle();

      // The element of b has the attribute of an item that hydrates, but it has no tab stop. The
      // root waits only for an element that has the tab stop, so a keeps it.
      expect(readTabindexes(container)).toEqual(['0', '-1', '-1']);

      releaseAsyncBranch();
      await waitFor(() => {
        expect(findHydrationAttributes(container)).toBeNull();
      });
      await settle();

      expect(readTabindexes(container)).toEqual(['0', '-1', '-1']);
      expect(within(container).getByTestId('a')).toBe(a);
      expect(within(container).getByTestId('b')).toBe(b);
      expect(within(container).getByTestId('c')).toBe(c);
      expect(takeReportedMessages()).toEqual([]);
    });

    it('keeps the tab stop of the server until a Suspense outside the root resolves', async () => {
      const props = { disabled: ['a'] };
      const serverHtml = await renderOnServer(ASYNC_SETUP_FIXTURE, props);
      const { container, mount } = startHydration(CompositeItemAsyncSetup, serverHtml, props);
      const [a, b, c] = ['a', 'b', 'c'].map((testId) => within(container).getByTestId(testId));

      // The server ran the `setup` of b after the `setup` of c, so c has the tab stop.
      expect(readTabindexes(container)).toEqual(['-1', '-1', '0']);

      mount();
      await settle();

      // The root is inside the pending boundary, so it is not mounted and no item changes.
      expect(readTabindexes(container)).toEqual(['-1', '-1', '0']);

      releaseAsyncBranch();
      await waitFor(() => {
        expect(b).toHaveAttribute('tabindex', '0');
      });
      await settle();

      expect(readTabindexes(container)).toEqual(['-1', '0', '-1']);
      expect(findHydrationAttributes(container)).toBeNull();
      expect(within(container).getByTestId('a')).toBe(a);
      expect(within(container).getByTestId('b')).toBe(b);
      expect(within(container).getByTestId('c')).toBe(c);
      expect(takeReportedMessages()).toEqual([]);
    });

    it('does not wait for an item of a nested composite or for an element of a consumer', async () => {
      const serverHtml = await renderOnServer(NESTED_FIXTURE);
      const { container, mount } = startHydration(CompositeItemNested, serverHtml, {});
      const [first, last, plain] = ['first', 'last', 'plain'].map((testId) =>
        within(container).getByTestId(testId),
      );
      const [a, b, c] = ['a', 'b', 'c'].map((testId) => within(container).getByTestId(testId));

      function expectTabindexes(nested: string[]) {
        expect(first).toHaveAttribute('tabindex', '0');
        expect(last).toHaveAttribute('tabindex', '-1');
        expect(plain).toHaveAttribute('tabindex', '0');
        expect(readTabindexes(container)).toEqual(nested);
      }

      expectTabindexes(['-1', '0', '-1']);

      mount();
      await settle();

      expectTabindexes(['-1', '0', '-1']);

      releaseAsyncBranch();
      await waitFor(() => {
        expect(b).toHaveAttribute('tabindex', '-1');
      });
      await settle();

      expectTabindexes(['0', '-1', '-1']);
      expect(findHydrationAttributes(container)).toBeNull();
      expect(within(container).getByTestId('first')).toBe(first);
      expect(within(container).getByTestId('last')).toBe(last);
      expect(within(container).getByTestId('plain')).toBe(plain);
      expect(within(container).getByTestId('a')).toBe(a);
      expect(within(container).getByTestId('b')).toBe(b);
      expect(within(container).getByTestId('c')).toBe(c);
      expect(takeReportedMessages()).toEqual([]);
    });

    it('gives the tab stop to a mounted item when the element of the waiting item leaves the document', async () => {
      const props = { hasActiveItem: true, active: ['b'], late: true };
      const serverHtml = await renderOnServer(TAB_STOP_FIXTURE, props);
      const { container, mount } = startHydration(CompositeItemTabStop, serverHtml, props);
      const b = within(container).getByTestId('b');

      mount();
      await settle();

      expect(readTabindexes(container)).toEqual(['-1', '0', '-1']);

      // The branch stays pending. The element leaves the document before its item mounts.
      b.remove();
      await settle();

      expect(within(container).getByTestId('a')).toHaveAttribute('tabindex', '0');
      expect(within(container).getByTestId('c')).toHaveAttribute('tabindex', '-1');
      expect(takeReportedMessages()).toEqual([]);
    });

    it('keeps one tab stop when focus moves while an item waits for its mount', async () => {
      const serverHtml = await renderOnServer(ASYNC_SIBLING_FIXTURE);
      const { container, mount } = startHydration(CompositeItemAsyncSibling, serverHtml, {});
      const [a, b, c] = ['a', 'b', 'c'].map((testId) => within(container).getByTestId(testId));

      expect(readTabindexes(container)).toEqual(['-1', '0', '-1']);

      mount();
      await settle();

      expect(readTabindexes(container)).toEqual(['-1', '0', '-1']);

      // The ref of b registered the element during the hydration, but b is not mounted. Focus on c
      // would move the tab stop to c, and b would keep it too.
      c.focus();
      await settle();

      expect(readTabindexes(container)).toEqual(['-1', '0', '-1']);

      releaseAsyncBranch();
      await waitFor(() => {
        expect(b).toHaveAttribute('tabindex', '-1');
      });
      await settle();

      expect(readTabindexes(container)).toEqual(['-1', '-1', '0']);
      expect(findHydrationAttributes(container)).toBeNull();
      expect(within(container).getByTestId('a')).toBe(a);
      expect(within(container).getByTestId('b')).toBe(b);
      expect(within(container).getByTestId('c')).toBe(c);
      expect(takeReportedMessages()).toEqual([]);
    });
  });

  it('moves the tab stop to the focused item when the root is not in the document', async () => {
    // A list skips an element that is not in the document, so this root never gets a map.
    const container = document.createElement('div');
    const app = createApp({
      render: () => (
        <CompositeRoot>
          <CompositeItem data-testid="1" />
          <CompositeItem data-testid="2" />
          <CompositeItem data-testid="3" />
        </CompositeRoot>
      ),
    });
    onTestFinished(() => app.unmount());
    app.mount(container);
    await flushMicrotasks();

    const item1 = within(container).getByTestId('1');
    const item3 = within(container).getByTestId('3');

    expect(item1).toHaveAttribute('tabindex', '0');
    expect(item3).toHaveAttribute('tabindex', '-1');

    await fireEvent.focusIn(item3);

    expect(item3).toHaveAttribute('tabindex', '0');
    expect(item1).toHaveAttribute('tabindex', '-1');
  });

  it('moves focus to an item when the pointer moves over it and the root highlights on hover', async () => {
    const { setProps } = await render(
      <CompositeRoot highlightItemOnHover={false}>
        <CompositeItem data-testid="1" />
        <CompositeItem data-testid="2" />
      </CompositeRoot>,
    );

    const item2 = screen.getByTestId('2');

    await fireEvent.mouseMove(item2);

    expect(item2).not.toHaveFocus();

    await setProps({ highlightItemOnHover: true });
    await fireEvent.mouseMove(item2);

    expect(item2).toHaveFocus();
    expect(item2).toHaveAttribute('tabindex', '0');
  });
});
