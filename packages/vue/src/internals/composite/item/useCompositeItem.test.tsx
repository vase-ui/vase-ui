import { describe, expect, it, onTestFinished } from 'vitest';
import { createSSRApp } from 'vue';
import type { Component } from 'vue';
import {
  createRenderer,
  fireEvent,
  hydrate,
  renderOnServer,
  screen,
  takeReportedMessages,
  waitFor,
  within,
} from '#test-utils';
import CompositeItem from '../../../../test/fixtures/CompositeItemPart.vue';
import CompositeRoot from '../../../../test/fixtures/CompositeRootPart.vue';
import CompositeItemAsyncSetup from './CompositeItemAsyncSetup.test.vue';
import CompositeItemTabStop from './CompositeItemTabStop.test.vue';

const TAB_STOP_FIXTURE = 'src/internals/composite/item/CompositeItemTabStop.test.vue';
const ASYNC_SETUP_FIXTURE = 'src/internals/composite/item/CompositeItemAsyncSetup.test.vue';

// The `tabindex` of the items a, b and c.
function readTabindexes(root: ParentNode) {
  return ['a', 'b', 'c'].map((testId) =>
    root.querySelector(`[data-testid="${testId}"]`)?.getAttribute('tabindex'),
  );
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

    it('moves the tab stop to the first enabled item after the hydration of a list with an async setup', async () => {
      const props = { disabled: ['a'] };
      const serverHtml = await renderOnServer(ASYNC_SETUP_FIXTURE, props);
      const { container, mount } = startHydration(CompositeItemAsyncSetup, serverHtml, props);
      const [a, b, c] = ['a', 'b', 'c'].map((testId) => within(container).getByTestId(testId));

      // The server ran the `setup` of b after the `setup` of c, so c has the tab stop.
      expect(c).toHaveAttribute('tabindex', '0');

      mount();

      await waitFor(() => {
        expect(b).toHaveAttribute('tabindex', '0');
      });
      expect(c).toHaveAttribute('tabindex', '-1');
      // A mismatch makes Vue discard the server nodes and render new nodes.
      expect(within(container).getByTestId('a')).toBe(a);
      expect(within(container).getByTestId('b')).toBe(b);
      expect(within(container).getByTestId('c')).toBe(c);
      expect(takeReportedMessages()).toEqual([]);
    });

    it('hydrates an active item that renders after the first map of the root', async () => {
      const props = { hasActiveItem: true, active: ['b'], late: true };
      const serverHtml = await renderOnServer(TAB_STOP_FIXTURE, props);
      const { container, mount } = startHydration(CompositeItemTabStop, serverHtml, props);
      const [a, b] = ['a', 'b'].map((testId) => within(container).getByTestId(testId));

      expect(b).toHaveAttribute('tabindex', '0');

      mount();

      // The root maps the items before b renders. It finds no active item and keeps the tab stop
      // on a, as Base UI does for an item that comes late.
      await waitFor(() => {
        expect(b).toHaveAttribute('tabindex', '-1');
      });
      expect(a).toHaveAttribute('tabindex', '0');
      expect(within(container).getByTestId('b')).toBe(b);
      expect(takeReportedMessages()).toEqual([]);
    });
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
