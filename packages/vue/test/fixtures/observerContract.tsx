import { expect, it, onTestFinished, vi } from 'vitest';
import { KeepAlive, defineComponent, nextTick, onActivated, onDeactivated, shallowRef } from 'vue';
import type { Ref } from 'vue';
import { createRenderer } from '#test-utils';
import { EffectOwner } from './effectOwner';

type Name = 'MutationObserver' | 'ResizeObserver';
type Callback = (records: unknown[], observer: object, first?: boolean) => void;

function mockObserver(view: Window, name: Name) {
  const descriptor = Object.getOwnPropertyDescriptor(view, name)!;
  onTestFinished(() => {
    Object.defineProperty(view, name, descriptor);
  });
  const instances: MockObserver[] = [];
  class MockObserver {
    observe = vi.fn();
    disconnect = vi.fn();
    private readonly callback: Callback;
    constructor(callback: Callback) {
      this.callback = callback;
      instances.push(this);
    }
    deliver(records: unknown[] = []) {
      this.callback(records, this);
    }
  }
  Object.defineProperty(view, name, { ...descriptor, value: MockObserver });
  return instances;
}

export function observerContract(
  name: Name,
  install: (targets: Ref<readonly Element[]>, alternate: Ref<boolean>, notify: Callback) => void,
) {
  const { render } = createRenderer();

  it('groups distinct targets by window and rejects a delivery from a replaced target or option', async () => {
    const frame = document.createElement('iframe');
    document.body.append(frame);
    onTestFinished(() => frame.remove());
    const doc = frame.contentDocument!;
    const local = mockObserver(window, name);
    const foreign = mockObserver(doc.defaultView!, name);
    const one = document.createElement('div');
    const two = document.createElement('div');
    const targets = shallowRef<readonly Element[]>([one, one, two, doc.body]);
    const alternate = shallowRef(false);
    const notify = vi.fn<Callback>();
    const { unmount } = await render(
      <EffectOwner setupEffect={() => install(targets, alternate, notify)} />,
    );
    expect(local).toHaveLength(1);
    expect(foreign).toHaveLength(1);
    const first = local[0]!;
    expect(first.observe.mock.calls.map(([target]) => target)).toEqual([one, two]);
    expect(foreign[0]!.observe.mock.calls.map(([target]) => target)).toEqual([doc.body]);
    const records = [{}];
    first.deliver(records);
    first.deliver(records);
    foreign[0]!.deliver(records);
    expect(notify.mock.calls[0]![0]).toBe(records);
    expect(notify.mock.calls[0]![1]).toBe(first);
    if (name === 'ResizeObserver') {
      expect(notify.mock.calls.map((call) => call[2])).toEqual([true, false, true]);
    }
    notify.mockClear();
    targets.value = [two];
    first.deliver();
    await nextTick();
    expect(first.disconnect).toHaveBeenCalledTimes(1);
    expect(foreign[0]!.disconnect).toHaveBeenCalledTimes(1);
    const second = local[1]!;
    expect(second.observe.mock.calls.map(([target]) => target)).toEqual([two]);
    first.deliver();
    second.deliver();
    alternate.value = true;
    second.deliver();
    await nextTick();
    expect(second.disconnect).toHaveBeenCalledTimes(1);
    const last = local[2]!;
    expect(last.observe.mock.calls[0]![1]).not.toEqual(second.observe.mock.calls[0]![1]);
    last.deliver();
    unmount();
    expect(last.disconnect).toHaveBeenCalledTimes(1);
    last.deliver();
    expect(notify.mock.calls.map((call) => call[1])).toEqual([second, last]);
    if (name === 'ResizeObserver')
      expect(notify.mock.calls.map((call) => call[2])).toEqual([true, true]);
  });

  it('rejects pending deliveries inside the hold and show hooks and observes the same node again', async () => {
    const instances = mockObserver(window, name);
    const visible = shallowRef(true);
    const targets = shallowRef([document.createElement('div')]);
    const notify = vi.fn<Callback>();
    let probe = false;
    const Branch = defineComponent(() => {
      onDeactivated(() => {
        if (probe) {
          instances[0]!.deliver();
          visible.value = true;
        }
      });
      onActivated(() => {
        if (probe) instances[0]!.deliver();
      });
      return () => <EffectOwner setupEffect={() => install(targets, shallowRef(false), notify)} />;
    });
    await render(() => <KeepAlive>{visible.value ? <Branch /> : null}</KeepAlive>);
    probe = true;
    visible.value = false;
    await nextTick();
    probe = false;
    expect(instances[0]!.disconnect).toHaveBeenCalledTimes(1);
    expect(instances).toHaveLength(2);
    instances[1]!.deliver();
    expect(notify.mock.calls.map((call) => call[1])).toEqual([instances[1]]);
  });

  it('skips a window without the constructor and an empty target list', async () => {
    const frame = document.createElement('iframe');
    document.body.append(frame);
    onTestFinished(() => frame.remove());
    const doc = frame.contentDocument!;
    Object.defineProperty(doc.defaultView, name, { value: undefined });
    const instances = mockObserver(window, name);
    const targets = shallowRef<readonly Element[]>([doc.body]);
    const notify = vi.fn();
    await render(<EffectOwner setupEffect={() => install(targets, shallowRef(false), notify)} />);
    expect(instances).toHaveLength(0);
    targets.value = [document.body, doc.body];
    await nextTick();
    expect(instances).toHaveLength(1);
    expect(instances[0]!.observe.mock.calls.map(([target]) => target)).toEqual([document.body]);
    targets.value = [];
    await nextTick();
    expect(instances[0]!.disconnect).toHaveBeenCalledOnce();
    expect(instances).toHaveLength(1);
    expect(notify).not.toHaveBeenCalled();
  });
}
