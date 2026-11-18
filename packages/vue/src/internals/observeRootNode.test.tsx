import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { shallowRef, Teleport } from 'vue';
import { createRenderer, flushMicrotasks, screen } from '#test-utils';
import { followRootNode, observeRootNode } from './observeRootNode';

describe('observeRootNode', () => {
  const { render } = createRenderer();

  it('reports child lists and the listed attributes in the root tree', async () => {
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    const input = document.createElement('input');
    const sibling = document.createElement('div');
    shadow.append(input, sibling);
    const callback = vi.fn();
    onTestFinished(observeRootNode(input, callback, ['id']));
    expect(callback).not.toHaveBeenCalled();

    sibling.append(document.createElement('span'));
    await flushMicrotasks();
    expect(callback).toHaveBeenCalledTimes(1);

    sibling.id = 'name';
    await flushMicrotasks();
    expect(callback).toHaveBeenCalledTimes(2);

    sibling.title = 'other';
    await flushMicrotasks();
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('moves the observer after `Teleport` moves the element and disconnects the document observer', async () => {
    const host = document.createElement('div');
    const container = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.append(container);
    document.body.append(host);
    onTestFinished(() => host.remove());
    const moved = shallowRef(false);
    await render(() => (
      <Teleport to={container} disabled={!moved.value}>
        <input data-testid="input" />
      </Teleport>
    ));
    const input = screen.getByTestId('input');
    const observe = vi.spyOn(MutationObserver.prototype, 'observe');
    const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');
    try {
      const callback = vi.fn();
      onTestFinished(observeRootNode(input, callback));
      expect(observe.mock.calls.map(([node]) => node)).toEqual([document]);
      const documentObserver = observe.mock.contexts[0];

      moved.value = true;
      await flushMicrotasks();
      expect(observe.mock.calls.map(([node]) => node)).toEqual([document, shadow]);
      expect(disconnect.mock.contexts).toContain(documentObserver);

      callback.mockClear();
      container.append(document.createElement('span'));
      await flushMicrotasks();
      expect(callback).toHaveBeenCalledOnce();
    } finally {
      observe.mockRestore();
      disconnect.mockRestore();
    }
  });

  it.each([{ name: 'the document' }, { name: 'a shadow root' }])(
    'observes a detached tree and its return to $name',
    async ({ name }) => {
      const host = document.createElement('div');
      document.body.append(host);
      onTestFinished(() => host.remove());
      const parent = name === 'the document' ? host : host.attachShadow({ mode: 'open' });
      const wrapper = document.createElement('div');
      const input = document.createElement('input');
      wrapper.append(input);
      parent.append(wrapper);
      const callback = vi.fn();
      onTestFinished(observeRootNode(input, callback));

      wrapper.remove();
      await flushMicrotasks();
      expect(callback).toHaveBeenCalledOnce();
      wrapper.append(document.createElement('span'));
      await flushMicrotasks();
      expect(callback).toHaveBeenCalledTimes(2);
      parent.append(wrapper);
      await flushMicrotasks();
      expect(callback).toHaveBeenCalledTimes(3);
      wrapper.append(document.createElement('span'));
      await flushMicrotasks();
      expect(callback).toHaveBeenCalledTimes(4);
    },
  );

  it('stops both observers of a detached tree', async () => {
    const wrapper = document.createElement('div');
    const input = document.createElement('input');
    wrapper.append(input);
    const callback = vi.fn();
    const stop = observeRootNode(input, callback);
    onTestFinished(stop);

    stop();
    wrapper.append(document.createElement('span'));
    document.body.append(wrapper);
    onTestFinished(() => wrapper.remove());
    await flushMicrotasks();

    expect(callback).not.toHaveBeenCalled();
  });

  it('sees the first attachment of a detached tree to its owner document', async () => {
    const doc = document.implementation.createHTMLDocument();
    const wrapper = doc.createElement('div');
    const input = doc.createElement('input');
    wrapper.append(input);
    const callback = vi.fn();
    onTestFinished(observeRootNode(input, callback));

    doc.body.append(wrapper);
    await flushMicrotasks();

    expect(callback).toHaveBeenCalledOnce();
  });

  it('shares one observer per attribute list until the last stop', async () => {
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    const first = document.createElement('input');
    const second = document.createElement('input');
    shadow.append(first, second);
    const observe = vi.spyOn(MutationObserver.prototype, 'observe');
    const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');
    try {
      const a = vi.fn();
      const b = vi.fn();
      const c = vi.fn();
      const stopFirst = observeRootNode(first, a, ['id']);
      onTestFinished(stopFirst);
      const stopSecond = observeRootNode(second, b, ['id']);
      onTestFinished(stopSecond);
      onTestFinished(observeRootNode(second, c, ['for']));
      expect(observe).toHaveBeenCalledTimes(2);

      first.id = 'first';
      await flushMicrotasks();
      expect(a).toHaveBeenCalledOnce();
      expect(b).toHaveBeenCalledOnce();
      expect(c).not.toHaveBeenCalled();

      stopFirst();
      expect(disconnect).not.toHaveBeenCalled();
      stopSecond();
      expect(disconnect.mock.contexts).toEqual([observe.mock.contexts[0]]);
    } finally {
      observe.mockRestore();
      disconnect.mockRestore();
    }
  });

  it('calls back before the new root can observe a write from the callback', async () => {
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    const input = document.createElement('input');
    host.append(input);
    document.body.append(host);
    onTestFinished(() => host.remove());
    const callback = vi.fn(() => {
      input.id ||= 'name';
    });
    onTestFinished(observeRootNode(input, callback, ['id']));

    shadow.append(input);
    await flushMicrotasks();

    expect(input.id).toBe('name');
    expect(callback).toHaveBeenCalledOnce();
  });

  it('keeps the observer stopped when the callback stops on a move', async () => {
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    const input = document.createElement('input');
    host.append(input);
    document.body.append(host);
    onTestFinished(() => host.remove());
    const callback = vi.fn(() => stop());
    const stop = observeRootNode(input, callback);
    onTestFinished(stop);

    shadow.append(input);
    await flushMicrotasks();
    shadow.append(document.createElement('span'));
    await flushMicrotasks();

    expect(callback).toHaveBeenCalledOnce();
  });
});

describe('followRootNode', () => {
  it('runs the cleanup before the effect on each new root', async () => {
    const host = document.createElement('div');
    const first = host.attachShadow({ mode: 'open' });
    const otherHost = document.createElement('div');
    const second = otherHost.attachShadow({ mode: 'open' });
    const input = document.createElement('input');
    host.append(input, otherHost);
    document.body.append(host);
    onTestFinished(() => host.remove());
    const calls: [string, Node][] = [];
    onTestFinished(
      followRootNode(input, (root) => {
        calls.push(['effect', root]);
        return () => {
          calls.push(['cleanup', root]);
        };
      }),
    );
    expect(calls).toEqual([['effect', document]]);

    first.append(input);
    await flushMicrotasks();
    second.append(input);
    await flushMicrotasks();

    expect(calls).toEqual([
      ['effect', document],
      ['cleanup', document],
      ['effect', first],
      ['cleanup', first],
      ['effect', second],
    ]);
  });

  it('keeps the effect while the root stays the same', async () => {
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    const input = document.createElement('input');
    shadow.append(input);
    const cleanup = vi.fn();
    const effect = vi.fn(() => cleanup);
    onTestFinished(followRootNode(input, effect));

    shadow.append(document.createElement('span'));
    await flushMicrotasks();

    expect(effect).toHaveBeenCalledOnce();
    expect(cleanup).not.toHaveBeenCalled();
  });

  it('runs the last cleanup once at the stop', async () => {
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    const input = document.createElement('input');
    host.append(input);
    document.body.append(host);
    onTestFinished(() => host.remove());
    const cleanup = vi.fn();
    const stop = followRootNode(input, (root) => () => cleanup(root));
    onTestFinished(stop);
    shadow.append(input);
    await flushMicrotasks();
    expect(cleanup.mock.calls).toEqual([[document]]);

    stop();
    stop();
    host.append(input);
    await flushMicrotasks();

    expect(cleanup.mock.calls).toEqual([[document], [shadow]]);
  });
});
