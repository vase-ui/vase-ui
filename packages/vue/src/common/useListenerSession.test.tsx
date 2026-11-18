import { describe, expect, it, vi } from 'vitest';
import { shallowRef } from 'vue';
import { createRenderer } from '#test-utils';
import { EffectOwner } from '../../test/fixtures/effectOwner';
import { addEventListener } from './addEventListener';
import { useListenerSession } from './useListenerSession';

describe('useListenerSession', () => {
  const { render } = createRenderer();

  it('accepts a release in the press task and ends before the callback starts a new press', async () => {
    let session!: ReturnType<typeof useListenerSession>;
    await render(
      <EffectOwner
        setupEffect={() => {
          session = useListenerSession(false);
        }}
      />,
    );
    const target = document.createElement('button');
    const finish = vi.fn();
    const down = () =>
      session.start((clean, end) => {
        clean(
          addEventListener(document, 'pointerup', () => {
            end();
            finish();
          }),
        );
      });
    target.addEventListener('pointerdown', down);
    finish.mockImplementationOnce(down);
    target.dispatchEvent(new PointerEvent('pointerdown'));
    for (let i = 0; i < 3; i++) document.dispatchEvent(new PointerEvent('pointerup'));
    expect(finish).toHaveBeenCalledTimes(2);
  });

  it('replaces a press on either document and ignores an end from an earlier press', async () => {
    let session!: ReturnType<typeof useListenerSession>;
    const held = shallowRef(false);
    const { unmount } = await render(
      <EffectOwner
        setupEffect={() => {
          session = useListenerSession(held);
        }}
      />,
    );
    const other = document.implementation.createHTMLDocument();
    const release = vi.fn();
    const ends: (() => void)[] = [];
    const attach = (doc: Document) =>
      session.start((clean, end) => {
        ends.push(end);
        clean(
          addEventListener(doc, 'pointerup', () => {
            end();
            release(doc);
          }),
        );
      });
    const up = (doc: Document) => doc.dispatchEvent(new PointerEvent('pointerup'));
    attach(document);
    attach(document);
    ends[0]!();
    up(document);
    attach(document);
    attach(other);
    up(document);
    ends[2]!();
    up(other);
    attach(other);
    held.value = true;
    up(other);
    attach(other);
    held.value = false;
    up(other);
    attach(document);
    session.stop();
    up(document);
    attach(document);
    unmount();
    up(document);
    expect(release.mock.calls).toEqual([[document], [other]]);
  });

  it('removes both document listeners at unmount during a secondary press', async () => {
    let session!: ReturnType<typeof useListenerSession>;
    const { unmount } = await render(
      <EffectOwner
        setupEffect={() => {
          session = useListenerSession(false);
        }}
      />,
    );
    const button = document.createElement('button');
    const doc = button.ownerDocument;
    const add = vi.spyOn(doc, 'addEventListener');
    const remove = vi.spyOn(doc, 'removeEventListener');
    button.addEventListener('pointerdown', () =>
      session.start((clean, end) => {
        clean(addEventListener(doc, 'pointerup', end));
        clean(addEventListener(doc, 'pointercancel', end));
      }),
    );
    button.dispatchEvent(new PointerEvent('pointerdown', { button: 2 }));
    unmount();
    const [, end] = add.mock.calls.find(([type]) => type === 'pointerup')!;
    expect(remove).toHaveBeenCalledWith('pointerup', end, undefined);
    expect(remove).toHaveBeenCalledWith('pointercancel', end, undefined);
  });
});
