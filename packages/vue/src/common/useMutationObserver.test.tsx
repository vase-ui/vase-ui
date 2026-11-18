import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { nextTick, shallowRef } from 'vue';
import { createRenderer, flushMicrotasks } from '#test-utils';
import { EffectOwner } from '../../test/fixtures/effectOwner';
import { observerContract } from '../../test/fixtures/observerContract';
import { useMutationObserver } from './useMutationObserver';

describe('useMutationObserver', () => {
  observerContract('MutationObserver', (targets, alternate, notify) =>
    useMutationObserver(
      targets,
      () => ({ attributes: true, attributeFilter: [alternate.value ? 'title' : 'id'] }),
      notify,
    ),
  );
  const { render } = createRenderer();

  it('follows old-value options supplied by a prototype getter', async () => {
    const oldValue = shallowRef(false);
    class Options {
      attributes = true;
      get attributeOldValue() {
        return oldValue.value;
      }
    }
    const target = document.createElement('div');
    const notify = vi.fn<MutationCallback>();
    await render(
      <EffectOwner setupEffect={() => useMutationObserver(target, new Options(), notify)} />,
    );
    target.id = 'first';
    await flushMicrotasks();
    expect(notify.mock.calls[0]![0][0]!.oldValue).toBeNull();
    oldValue.value = true;
    await nextTick();
    target.id = 'second';
    await flushMicrotasks();
    expect(notify.mock.calls[1]![0][0]!.oldValue).toBe('first');
  });

  it('passes native records for an iframe document and a detached text node', async () => {
    const frame = document.createElement('iframe');
    document.body.append(frame);
    onTestFinished(() => frame.remove());
    const doc = frame.contentDocument!;
    const text = doc.createTextNode('before');
    const notify = vi.fn<MutationCallback>();
    await render(
      <EffectOwner
        setupEffect={() =>
          useMutationObserver(
            [doc, text],
            { subtree: true, attributes: true, characterData: true },
            notify,
          )
        }
      />,
    );
    doc.body.id = 'after';
    text.data = 'after';
    await flushMicrotasks();
    expect(notify).toHaveBeenCalledTimes(1);
    const [records, observer] = notify.mock.calls[0]!;
    expect(observer).toBeInstanceOf(doc.defaultView!.MutationObserver);
    expect(records.map((record) => [record.type, record.target])).toEqual([
      ['attributes', doc.body],
      ['characterData', text],
    ]);
  });
});
