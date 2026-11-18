import { expect, vi, describe, it } from 'vitest';
import {
  computed,
  createCommentVNode,
  defineComponent,
  KeepAlive,
  shallowRef,
  Teleport,
} from 'vue';
import {
  createHeldBranch,
  createRenderer,
  flushMicrotasks,
  hydrate,
  renderOnServer,
  screen,
  waitFor,
  within,
} from '#test-utils';
import CompositeList from '../../../../test/fixtures/CompositeListPart.vue';
import CompositeListItemPart from '../../../../test/fixtures/CompositeListItemPart.vue';
import { useRenderElement } from '../../useRenderElement';
import CompositeListHydration from './CompositeListHydration.test.vue';
import { useCompositeListItem } from './useCompositeList';

describe('<CompositeList />', () => {
  const { render } = createRenderer();

  describe('prop: elementsRef', () => {
    function Item(props: { label?: string; index?: number }) {
      return (
        <CompositeListItemPart index={props.index} data-testid={props.label}>
          {props.label}
        </CompositeListItemPart>
      );
    }

    it('cleans up refs on unmount', async () => {
      const elementsRef = shallowRef<(HTMLElement | null)[]>([]);
      const labelsRef = shallowRef<(string | null)[]>([]);
      const { unmount } = await render(
        <CompositeList elementsRef={elementsRef} labelsRef={labelsRef}>
          <Item />
          <Item />
          <Item />
        </CompositeList>,
      );

      expect(elementsRef.value).toHaveLength(3);
      expect(labelsRef.value).toHaveLength(3);

      unmount();
      expect(elementsRef.value).toHaveLength(0);
      expect(labelsRef.value).toHaveLength(0);
    });

    it('keeps refs populated for items whose guessed index is already correct', async () => {
      const GuessedItem = defineComponent(
        (props: { label: string }) => {
          const element = shallowRef<HTMLElement | null>(null);
          useCompositeListItem(element, { label: () => props.label });
          return () => (
            <div ref={element} data-testid={props.label}>
              {props.label}
            </div>
          );
        },
        { props: ['label'] },
      );

      const elementsRef = shallowRef<(HTMLElement | null)[]>([]);
      const labelsRef = shallowRef<(string | null)[]>([]);

      await render(
        <CompositeList elementsRef={elementsRef} labelsRef={labelsRef}>
          <GuessedItem label="a" />
          <GuessedItem label="b" />
          <GuessedItem label="c" />
        </CompositeList>,
      );

      await waitFor(() => {
        expect(elementsRef.value[0]).toBe(screen.getByTestId('a'));
      });
      expect(elementsRef.value[1]).toBe(screen.getByTestId('b'));
      expect(elementsRef.value[2]).toBe(screen.getByTestId('c'));
      expect(labelsRef.value).toEqual(['a', 'b', 'c']);
    });

    it('only publishes maps that are aligned with the element registry', async () => {
      const elementsRef = shallowRef<(HTMLElement | null)[]>([]);
      const snapshots: {
        elements: (HTMLElement | null)[];
        mapElements: Element[];
      }[] = [];

      const App = defineComponent(
        (props: { items: string[] }) => () => (
          <CompositeList
            elementsRef={elementsRef}
            onMapChange={(map) => {
              snapshots.push({
                elements: [...elementsRef.value],
                mapElements: Array.from(map.keys()),
              });
            }}
          >
            {props.items.map((item) => (
              <Item key={item} label={item} />
            ))}
          </CompositeList>
        ),
        { props: ['items'] },
      );

      const { setProps } = await render(<App items={['a', 'b', 'c']} />);

      expect(snapshots).toHaveLength(1);

      await setProps({ items: ['a', 'b', 'c', 'd'] });

      expect(snapshots).toHaveLength(2);
      snapshots.forEach((snapshot) => {
        expect(snapshot.elements).toEqual(snapshot.mapElements);
      });
    });

    it('registers explicitly indexed items in their index-addressed slots', async () => {
      const elementsRef = shallowRef<(HTMLElement | null)[]>([]);
      const onMapChange = vi.fn();

      await render(
        <CompositeList elementsRef={elementsRef} onMapChange={onMapChange}>
          <Item label="two" index={2} />
          <Item label="zero" index={0} />
          <Item label="one" index={1} />
        </CompositeList>,
      );

      const map = onMapChange.mock.lastCall?.[0] as Map<Element, { index: number }>;
      expect(Array.from(map.values(), (metadata) => metadata.index)).toEqual([0, 1, 2]);
      expect(elementsRef.value).toEqual([
        screen.getByTestId('zero'),
        screen.getByTestId('one'),
        screen.getByTestId('two'),
      ]);
    });

    it('reserves explicit slots when assigning automatic indexes', async () => {
      const elementsRef = shallowRef<(HTMLElement | null)[]>([]);

      await render(
        <CompositeList elementsRef={elementsRef}>
          <Item label="automatic one" />
          <Item label="explicit zero" index={0} />
          <Item label="automatic two" />
        </CompositeList>,
      );

      expect(elementsRef.value).toEqual([
        screen.getByTestId('explicit zero'),
        screen.getByTestId('automatic one'),
        screen.getByTestId('automatic two'),
      ]);
      expect(screen.getByTestId('automatic one')).toHaveAttribute('data-index', '1');
      expect(screen.getByTestId('automatic two')).toHaveAttribute('data-index', '2');
    });

    it('does not consume an index guess for an explicitly indexed item', async () => {
      const baselineElementsRef = shallowRef<(HTMLElement | null)[]>([]);
      const elementsRef = shallowRef<(HTMLElement | null)[]>([]);

      const GuessedItem = defineComponent(
        (props: { label: string; index?: number }) => {
          const element = shallowRef<HTMLElement | null>(null);
          const index = useCompositeListItem(element, { index: () => props.index });
          const initialIndex = index.value;
          return () => (
            <div ref={element} data-testid={props.label} data-initial-index={initialIndex} />
          );
        },
        { props: ['label', 'index'] },
      );

      await render(
        <>
          <CompositeList elementsRef={baselineElementsRef}>
            <GuessedItem label="baseline automatic" />
          </CompositeList>
          <CompositeList elementsRef={elementsRef}>
            <GuessedItem label="explicit" index={1} />
            <GuessedItem label="automatic" />
          </CompositeList>
        </>,
      );

      expect(screen.getByTestId('automatic').dataset.initialIndex).toBe(
        screen.getByTestId('baseline automatic').dataset.initialIndex,
      );
      expect(elementsRef.value[0]).toBe(screen.getByTestId('automatic'));
      expect(elementsRef.value[1]).toBe(screen.getByTestId('explicit'));
    });

    it('registers a replacement render target', async () => {
      const elementsRef = shallowRef<(HTMLElement | null)[]>([]);

      const SwitchingItem = defineComponent(() => {
        const useButton = shallowRef(false);
        const element = shallowRef<HTMLElement | null>(null);
        useCompositeListItem(element);

        return () => (
          <>
            <button
              type="button"
              onClick={() => {
                useButton.value = true;
              }}
            >
              Replace target
            </button>
            {useButton.value ? (
              <button ref={element} data-testid="item" type="button">
                item
              </button>
            ) : (
              <div ref={element} data-testid="item">
                item
              </div>
            )}
          </>
        );
      });

      const { user } = await render(
        <CompositeList elementsRef={elementsRef}>
          <SwitchingItem />
        </CompositeList>,
      );
      const initialItem = screen.getByTestId('item');

      await user.click(screen.getByRole('button', { name: 'Replace target' }));

      const replacementItem = screen.getByTestId('item');
      expect(replacementItem).not.toBe(initialItem);
      expect(initialItem.isConnected).toBe(false);
      expect(elementsRef.value).toEqual([replacementItem]);
    });

    it('does not register negative explicit indexes', async () => {
      const elementsRef = shallowRef<(HTMLElement | null)[]>([]);

      await render(
        <CompositeList elementsRef={elementsRef}>
          <Item label="item" index={-1} />
        </CompositeList>,
      );

      expect(elementsRef.value).toHaveLength(0);
      expect(Object.hasOwn(elementsRef.value, '-1')).toBe(false);
    });

    it('updates refs when an item mounts from a nested state update', async () => {
      const elementsRef = shallowRef<(HTMLElement | null)[]>([]);

      const DeepSection = defineComponent(() => {
        const showItem = shallowRef(false);
        return () => (
          <>
            <button
              type="button"
              onClick={() => {
                showItem.value = true;
              }}
            >
              Add item
            </button>
            {showItem.value ? <Item label="nested" /> : createCommentVNode()}
          </>
        );
      });

      const { user } = await render(
        <CompositeList elementsRef={elementsRef}>
          <Item label="first" />
          <DeepSection />
          <Item label="last" />
        </CompositeList>,
      );

      await user.click(screen.getByRole('button', { name: 'Add item' }));

      expect(elementsRef.value).toEqual([
        screen.getByTestId('first'),
        screen.getByTestId('nested'),
        screen.getByTestId('last'),
      ]);
    });

    it('updates refs when an item unmounts from a nested state update', async () => {
      const elementsRef = shallowRef<(HTMLElement | null)[]>([]);
      const onMapChange = vi.fn();

      const DeepSection = defineComponent(() => {
        const showItem = shallowRef(true);
        return () => (
          <>
            <button
              type="button"
              onClick={() => {
                showItem.value = false;
              }}
            >
              Remove item
            </button>
            {showItem.value ? <Item label="nested" /> : createCommentVNode()}
          </>
        );
      });

      const { user } = await render(
        <CompositeList elementsRef={elementsRef} onMapChange={onMapChange}>
          <Item label="first" />
          <DeepSection />
          <Item label="last" />
        </CompositeList>,
      );

      expect(elementsRef.value).toHaveLength(3);

      await user.click(screen.getByRole('button', { name: 'Remove item' }));

      expect(elementsRef.value).toEqual([screen.getByTestId('first'), screen.getByTestId('last')]);
      const map = onMapChange.mock.lastCall?.[0] as Map<Element, unknown>;
      expect(Array.from(map.keys())).toEqual([
        screen.getByTestId('first'),
        screen.getByTestId('last'),
      ]);
      expect(screen.getByTestId('last')).toHaveAttribute('data-index', '1');
    });

    it('keeps syncing refs after replacing items under Strict Mode', async () => {
      const elementsRef = shallowRef<(HTMLElement | null)[]>([]);
      const hideItems: Record<string, () => void> = {};

      const HideableItem = defineComponent(
        (props: { label: string }) => {
          const hidden = shallowRef(false);
          hideItems[props.label] = () => {
            hidden.value = true;
          };
          return () => (hidden.value ? null : <Item label={props.label} />);
        },
        { props: ['label'] },
      );

      const App = defineComponent(() => {
        const labels = shallowRef(['a', 'b']);
        return () => (
          <>
            <button
              type="button"
              onClick={() => {
                labels.value = ['c', 'd'];
              }}
            >
              Replace
            </button>
            <CompositeList elementsRef={elementsRef}>
              {labels.value.map((label) => (
                <HideableItem key={label} label={label} />
              ))}
            </CompositeList>
          </>
        );
      });

      const { user } = await render(<App />);

      await user.click(screen.getByRole('button', { name: 'Replace' }));

      expect(elementsRef.value).toEqual([screen.getByTestId('c'), screen.getByTestId('d')]);

      // The item hides itself without a render of the list owner.
      hideItems.d();
      await flushMicrotasks();

      expect(elementsRef.value).toEqual([screen.getByTestId('c')]);
    });

    it('assigns correct guessed indexes during the first render', async () => {
      const renderCounts: Record<string, number> = { a: 0, b: 0, c: 0 };
      const initialIndexes: Record<string, number> = {};

      const GuessedItem = defineComponent(
        (props: { label: string }) => {
          const element = shallowRef<HTMLElement | null>(null);
          const index = useCompositeListItem(element);
          return () => {
            renderCounts[props.label] += 1;
            if (!(props.label in initialIndexes)) {
              initialIndexes[props.label] = index.value;
            }
            return <div ref={element} data-testid={props.label} data-index={index.value} />;
          };
        },
        { props: ['label'] },
      );

      const elementsRef = shallowRef<(HTMLElement | null)[]>([]);

      await render(
        <CompositeList elementsRef={elementsRef}>
          <GuessedItem label="a" />
          <GuessedItem label="b" />
          <GuessedItem label="c" />
        </CompositeList>,
      );

      // The guess is right, so no item renders again after the first sort.
      expect(initialIndexes).toEqual({ a: 0, b: 1, c: 2 });
      expect(renderCounts).toEqual({ a: 1, b: 1, c: 1 });
      expect(elementsRef.value).toEqual([
        screen.getByTestId('a'),
        screen.getByTestId('b'),
        screen.getByTestId('c'),
      ]);
    });

    it('re-registers an item when its explicit index changes or is removed', async () => {
      const refCalls: (HTMLElement | null)[] = [];
      const elementsRef = shallowRef<(HTMLElement | null)[]>([]);

      const TrackedItem = defineComponent(
        (props: { index?: number }) => {
          const element = shallowRef<HTMLElement | null>(null);
          const index = useCompositeListItem(element, { index: () => props.index });
          const { elementProps } = useRenderElement(
            'div',
            {},
            {
              ref: [
                (node) => {
                  refCalls.push(node);
                  element.value = node;
                },
              ],
            },
          );
          return () => <div {...elementProps()} data-testid="tracked" data-index={index.value} />;
        },
        { props: ['index'] },
      );

      const App = defineComponent(
        (props: { index?: number }) => () => (
          <CompositeList elementsRef={elementsRef}>
            <TrackedItem index={props.index} />
          </CompositeList>
        ),
        { props: ['index'] },
      );

      const { setProps } = await render(<App index={0} />);
      const tracked = screen.getByTestId('tracked');
      expect(refCalls).toEqual([tracked]);
      expect(elementsRef.value[0]).toBe(tracked);

      // A move of an item to another slot does not detach its ref. The item does not register
      // again, so the owner of a shared element does not change on an update. Base UI cycles the
      // ref here, because the identity of its ref depends on the registration data.
      await setProps({ index: 2 });

      expect(refCalls).toEqual([tracked]);
      expect(screen.getByTestId('tracked')).toHaveAttribute('data-index', '2');
      expect(Object.hasOwn(elementsRef.value, 0)).toBe(false);
      expect(elementsRef.value[2]).toBe(tracked);

      await setProps({ index: undefined });

      await waitFor(() => {
        expect(screen.getByTestId('tracked')).toHaveAttribute('data-index', '0');
      });
      expect(refCalls).toEqual([tracked]);
      expect(elementsRef.value).toEqual([tracked]);
    });

    it('resolves an automatic index when the equivalent explicit index is removed', async () => {
      const elementsRef = shallowRef<(HTMLElement | null)[]>([]);

      const App = defineComponent(
        (props: { index?: number }) => () => (
          <CompositeList elementsRef={elementsRef}>
            <Item label="indexed" index={props.index} />
          </CompositeList>
        ),
        { props: ['index'] },
      );

      const { setProps } = await render(<App index={0} />);
      await setProps({ index: undefined });

      await waitFor(() => {
        expect(screen.getByTestId('indexed')).toHaveAttribute('data-index', '0');
      });
    });

    it('does not detach item refs when an index shifts', async () => {
      const refCalls: (HTMLElement | null)[] = [];

      const TrackedItem = defineComponent(() => {
        const element = shallowRef<HTMLElement | null>(null);
        const index = useCompositeListItem(element);
        const { elementProps } = useRenderElement(
          'div',
          {},
          {
            ref: [
              (node) => {
                refCalls.push(node);
                element.value = node;
              },
            ],
          },
        );
        return () => <div {...elementProps()} data-testid="tracked" data-index={index.value} />;
      });

      const App = defineComponent(
        (props: { items: string[] }) => {
          const elementsRef = shallowRef<(HTMLElement | null)[]>([]);
          return () => (
            <CompositeList elementsRef={elementsRef}>
              {props.items.map((item) =>
                item === 'tracked' ? <TrackedItem key={item} /> : <Item key={item} label={item} />,
              )}
            </CompositeList>
          );
        },
        { props: ['items'] },
      );

      const { setProps } = await render(<App items={['tracked']} />);
      const tracked = screen.getByTestId('tracked');
      expect(refCalls).toEqual([tracked]);

      await setProps({ items: ['before', 'tracked'] });
      await waitFor(() => {
        expect(screen.getByTestId('tracked')).toHaveAttribute('data-index', '1');
      });
      expect(refCalls).toEqual([tracked]);
    });

    it('excludes items detached outside React from the registry', async () => {
      const elementsRef = shallowRef<(HTMLElement | null)[]>([]);
      const onMapChange = vi.fn();

      const App = defineComponent(
        (props: { extra: boolean }) => () => (
          <CompositeList elementsRef={elementsRef} onMapChange={onMapChange}>
            <div>
              <Item label="a" />
              <Item label="b" />
              <Item label="c" />
            </div>
            {props.extra && <Item label="d" />}
          </CompositeList>
        ),
        { props: ['extra'] },
      );

      const { setProps } = await render(<App extra={false} />);

      // A registered item that leaves the document outside Vue never calls its ref callback, so it
      // stays registered while disconnected. `compareDocumentPosition` is meaningless for it, and
      // the item would scramble the order of every other item.
      const detached = screen.getByTestId('b');
      detached.remove();

      await setProps({ extra: true });

      expect(elementsRef.value).toEqual([
        screen.getByTestId('a'),
        screen.getByTestId('c'),
        screen.getByTestId('d'),
      ]);
      const map = onMapChange.mock.lastCall?.[0] as Map<Element, unknown>;
      expect(Array.from(map.keys())).toEqual([
        screen.getByTestId('a'),
        screen.getByTestId('c'),
        screen.getByTestId('d'),
      ]);
    });

    it('skips detached items while verifying order after a move', async () => {
      const App = defineComponent(() => {
        const elementsRef = shallowRef<(HTMLElement | null)[]>([]);
        return () => (
          <CompositeList elementsRef={elementsRef}>
            <div data-testid="list">
              <Item label="a" />
              <Item label="b" />
              <Item label="c" />
            </div>
          </CompositeList>
        );
      });

      await render(<App />);

      const list = screen.getByTestId('list');
      const a = screen.getByTestId('a');
      const c = screen.getByTestId('c');

      // The detached item has no document position when the observer receives the move.
      screen.getByTestId('b').remove();
      list.insertBefore(c, a);

      await waitFor(() => {
        expect(screen.getByTestId('c')).toHaveAttribute('data-index', '0');
      });
      expect(screen.getByTestId('a')).toHaveAttribute('data-index', '1');
    });

    it('updates the registry when a mounted item stops rendering an element', async () => {
      const elementsRef = shallowRef<(HTMLElement | null)[]>([]);

      const VanishingItem = defineComponent(() => {
        // Starts with no element at all, so the item registers nothing until it renders one.
        const hidden = shallowRef(true);
        const element = shallowRef<HTMLElement | null>(null);
        const index = useCompositeListItem(element, {
          label: () => (hidden.value ? 'hidden' : 'shown'),
        });
        return () => (
          <>
            <button
              type="button"
              onClick={() => {
                hidden.value = !hidden.value;
              }}
            >
              Toggle element
            </button>
            {hidden.value ? (
              createCommentVNode()
            ) : (
              <div ref={element} data-testid="vanishing" data-index={index.value}>
                vanishing
              </div>
            )}
          </>
        );
      });

      const { user } = await render(
        <CompositeList elementsRef={elementsRef}>
          <VanishingItem />
          <Item label="tail" />
        </CompositeList>,
      );

      expect(elementsRef.value).toEqual([screen.getByTestId('tail')]);

      await user.click(screen.getByRole('button', { name: 'Toggle element' }));
      expect(elementsRef.value).toHaveLength(2);

      // The item stays mounted while its element is removed, so the next map reaches an item that
      // has no element.
      await user.click(screen.getByRole('button', { name: 'Toggle element' }));

      expect(elementsRef.value).toEqual([screen.getByTestId('tail')]);
      expect(screen.getByTestId('tail')).toHaveAttribute('data-index', '0');
    });

    it('updates indexes when a leaf item moves outside React', async () => {
      const elementsRef = shallowRef<(HTMLElement | null)[]>([]);

      await render(
        <CompositeList elementsRef={elementsRef}>
          <div data-testid="container">
            <Item label="a" />
            <Item label="b" />
            <Item label="c" />
          </div>
        </CompositeList>,
      );

      expect(screen.getByTestId('a')).toHaveAttribute('data-index', '0');

      const container = screen.getByTestId('container');
      container.appendChild(screen.getByTestId('a'));

      await waitFor(() => {
        expect(screen.getByTestId('a')).toHaveAttribute('data-index', '2');
      });
      expect(screen.getByTestId('b')).toHaveAttribute('data-index', '0');
      expect(screen.getByTestId('c')).toHaveAttribute('data-index', '1');
      expect(elementsRef.value).toEqual([
        screen.getByTestId('b'),
        screen.getByTestId('c'),
        screen.getByTestId('a'),
      ]);
    });

    it('updates indexes when a Teleport moves an item past another group', async () => {
      const elementsRef = shallowRef<(HTMLElement | null)[]>([]);
      const target = shallowRef('#before');
      await render(() => (
        <CompositeList elementsRef={elementsRef}>
          <div>
            <div id="nearby" />
            <div>
              <div id="before" />
              <div>
                <Item label="fixed" />
              </div>
            </div>
            <div id="after" />
            <Teleport defer to={target.value}>
              <Item label="moving" />
            </Teleport>
          </div>
        </CompositeList>
      ));
      const moving = screen.getByTestId('moving');
      const fixed = screen.getByTestId('fixed');
      const initialOrder = elementsRef.value;
      expect(initialOrder).toEqual([moving, fixed]);

      target.value = '#nearby';
      await flushMicrotasks();
      expect(moving.parentElement).toHaveAttribute('id', 'nearby');
      expect(elementsRef.value).toBe(initialOrder);

      target.value = '#after';
      await flushMicrotasks();
      expect(moving.parentElement).toHaveAttribute('id', 'after');
      expect(elementsRef.value).toEqual([fixed, moving]);
      expect(fixed).toHaveAttribute('data-index', '0');
      expect(moving).toHaveAttribute('data-index', '1');
    });

    it('observes each shared mutation root once', async () => {
      const observe = vi.spyOn(MutationObserver.prototype, 'observe');
      const elementsRef = shallowRef<(HTMLElement | null)[]>([]);

      // `waitFor` uses a `MutationObserver` of its own, so no `waitFor` call comes before the
      // restore of the spy.
      await render(
        <CompositeList elementsRef={elementsRef}>
          <div data-testid="list">
            <Item label="a" />
            <Item label="b" />
            <Item label="c" />
          </div>
        </CompositeList>,
      );

      const observedRoots = observe.mock.calls.map(([root]) => root);
      observe.mockRestore();
      expect(observedRoots).toEqual([screen.getByTestId('list')]);
    });

    it('updates indexes when keyed groups reorder', async () => {
      const App = defineComponent(() => {
        const reordered = shallowRef(false);
        const elementsRef = shallowRef<(HTMLElement | null)[]>([]);
        const labelsRef = shallowRef<(string | null)[]>([]);

        return () => {
          const groups = reordered.value ? ['b', 'a'] : ['a', 'b'];

          return (
            <CompositeList elementsRef={elementsRef} labelsRef={labelsRef}>
              <button
                type="button"
                onClick={() => {
                  reordered.value = true;
                }}
              >
                Reorder
              </button>
              <div>
                {groups.map((group) => (
                  <section key={group}>
                    <Item label={group} />
                  </section>
                ))}
              </div>
            </CompositeList>
          );
        };
      });

      const { user } = await render(<App />);

      expect(screen.getByTestId('a')).toHaveAttribute('data-index', '0');
      expect(screen.getByTestId('b')).toHaveAttribute('data-index', '1');

      await user.click(screen.getByRole('button', { name: 'Reorder' }));

      await waitFor(() => {
        expect(screen.getByTestId('b')).toHaveAttribute('data-index', '0');
      });
      expect(screen.getByTestId('a')).toHaveAttribute('data-index', '1');
    });

    it('observes reorders after the list grows from one item', async () => {
      const App = defineComponent(
        (props: { items: string[] }) => {
          const elementsRef = shallowRef<(HTMLElement | null)[]>([]);
          return () => (
            <CompositeList elementsRef={elementsRef}>
              {props.items.map((item) => (
                <Item key={item} label={item} />
              ))}
            </CompositeList>
          );
        },
        { props: ['items'] },
      );

      const { setProps } = await render(<App items={['a']} />);
      await setProps({ items: ['a', 'b'] });
      await setProps({ items: ['b', 'a'] });

      await waitFor(() => {
        expect(screen.getByTestId('b')).toHaveAttribute('data-index', '0');
      });
      expect(screen.getByTestId('a')).toHaveAttribute('data-index', '1');
    });

    it('updates indexes when grouped items reorder alongside unrelated mutations', async () => {
      const App = defineComponent(() => {
        const elementsRef = shallowRef<(HTMLElement | null)[]>([]);
        const labelsRef = shallowRef<(string | null)[]>([]);

        return () => (
          <CompositeList elementsRef={elementsRef} labelsRef={labelsRef}>
            <div data-testid="list">
              <section data-testid="group-a">
                <Item label="a" />
              </section>
              <section data-testid="group-b">
                <Item label="b" />
              </section>
            </div>
          </CompositeList>
        );
      });

      await render(<App />);

      expect(screen.getByTestId('a')).toHaveAttribute('data-index', '0');
      expect(screen.getByTestId('b')).toHaveAttribute('data-index', '1');

      const list = screen.getByTestId('list');
      const groupA = screen.getByTestId('group-a');
      const groupB = screen.getByTestId('group-b');
      const badge = list.ownerDocument.createElement('span');
      badge.setAttribute('data-testid', 'badge');

      list.insertBefore(groupB, groupA);
      list.appendChild(badge);

      await waitFor(() => {
        expect(screen.getByTestId('b')).toHaveAttribute('data-index', '0');
      });
      expect(screen.getByTestId('a')).toHaveAttribute('data-index', '1');
      expect(screen.getByTestId('badge')).toBeInTheDocument();
    });

    it('ignores mutations for unrelated leaf nodes', async () => {
      const App = defineComponent(
        (props: { onMapChange: (map: Map<Element, unknown>) => void }) => {
          const elementsRef = shallowRef<(HTMLElement | null)[]>([]);
          const labelsRef = shallowRef<(string | null)[]>([]);

          return () => (
            <CompositeList
              elementsRef={elementsRef}
              labelsRef={labelsRef}
              onMapChange={props.onMapChange}
            >
              <button type="button" onClick={() => screen.getByTestId('badge').remove()}>
                Remove badge
              </button>
              <div data-testid="list">
                <Item label="a" />
                <span data-testid="badge" />
                <Item label="b" />
              </div>
            </CompositeList>
          );
        },
        { props: ['onMapChange'] },
      );

      const onMapChange = vi.fn();
      const { user } = await render(<App onMapChange={onMapChange} />);

      await waitFor(() => {
        expect(screen.getByTestId('b')).toHaveAttribute('data-index', '1');
      });
      onMapChange.mockClear();

      await user.click(screen.getByRole('button', { name: 'Remove badge' }));

      expect(screen.queryByTestId('badge')).toBe(null);
      expect(onMapChange).not.toHaveBeenCalled();
    });

    it('registers items that sit across a shadow boundary', async () => {
      const host = document.createElement('div');
      document.body.appendChild(host);
      const shadowContainer = document.createElement('div');
      host.attachShadow({ mode: 'open' }).appendChild(shadowContainer);

      const elementsRef = shallowRef<(HTMLElement | null)[]>([]);

      try {
        // No ancestor can `contain` both items, so the pair has no common root to observe.
        // Registration still has to hold.
        const { unmount } = await render(
          <CompositeList elementsRef={elementsRef}>
            <Item label="light" />
            <Teleport to={shadowContainer}>
              <Item label="shadow" />
            </Teleport>
          </CompositeList>,
        );

        const shadowItem = shadowContainer.querySelector('[data-testid="shadow"]');
        expect(shadowItem).not.toBe(null);
        expect(elementsRef.value).toHaveLength(2);
        expect(elementsRef.value).toContain(screen.getByTestId('light'));
        expect(elementsRef.value).toContain(shadowItem);

        unmount();
        expect(elementsRef.value).toHaveLength(0);
      } finally {
        host.remove();
      }
    });

    it('does not sort again when an item renders again with the same element', async () => {
      const text = shallowRef('before');
      const elementsRef = shallowRef<(HTMLElement | null)[]>([]);

      const BoundItem = defineComponent(
        (props: { label: string }) => {
          const element = shallowRef<HTMLElement | null>(null);
          useCompositeListItem(element);
          return () => (
            <div ref={element} data-testid={props.label}>
              {text.value}
            </div>
          );
        },
        { props: ['label'] },
      );

      await render(
        <CompositeList elementsRef={elementsRef}>
          <BoundItem label="a" />
          <BoundItem label="b" />
        </CompositeList>,
      );

      // A sort makes a new observer for the two items. Vue calls the ref again on each patch.
      const observe = vi.spyOn(MutationObserver.prototype, 'observe');
      text.value = 'after';
      await flushMicrotasks();
      const observeCalls = observe.mock.calls.length;
      observe.mockRestore();

      expect(screen.getByTestId('a')).toHaveTextContent('after');
      expect(observeCalls).toBe(0);
    });

    it('does not render an item again when a later item registers', async () => {
      const renderCounts: Record<string, number> = { a: 0, b: 0, c: 0 };
      const elementsRef = shallowRef<(HTMLElement | null)[]>([]);

      const CountedItem = defineComponent(
        (props: { label: string }) => {
          const element = shallowRef<HTMLElement | null>(null);
          const index = useCompositeListItem(element);
          return () => {
            renderCounts[props.label] += 1;
            return <div ref={element} data-testid={props.label} data-index={index.value} />;
          };
        },
        { props: ['label'] },
      );

      const App = defineComponent(
        (props: { labels: string[] }) => () => (
          <CompositeList elementsRef={elementsRef}>
            {props.labels.map((label) => (
              <CountedItem key={label} label={label} />
            ))}
          </CompositeList>
        ),
        { props: ['labels'] },
      );

      const { setProps } = await render(<App labels={['a']} />);
      await setProps({ labels: ['a', 'b'] });
      await setProps({ labels: ['a', 'b', 'c'] });

      expect(elementsRef.value).toHaveLength(3);
      expect(renderCounts).toEqual({ a: 1, b: 1, c: 1 });
    });
  });

  describe('prop: labelsRef', () => {
    it('reads a new label after an item returns to the document outside Vue', async () => {
      const elementsRef = shallowRef<(HTMLElement | null)[]>([]);
      const labelsRef = shallowRef<(string | null)[]>([]);
      const label = shallowRef('before');
      await render(() => (
        <CompositeList elementsRef={elementsRef} labelsRef={labelsRef}>
          <div data-testid="parent">
            <CompositeListItemPart data-testid="item" label={label.value} />
          </div>
        </CompositeList>
      ));
      const item = screen.getByTestId('item');
      item.remove();
      label.value = 'detached';
      await flushMicrotasks();
      expect(labelsRef.value).toEqual([]);

      screen.getByTestId('parent').append(item);
      label.value = 'after';
      await flushMicrotasks();
      expect(elementsRef.value).toEqual([item]);
      expect(labelsRef.value).toEqual(['after']);
    });

    const LabelledItem = defineComponent(
      (props: { testId: string; label?: string | null; text?: string; useTextRef?: boolean }) => {
        const textRef = shallowRef<HTMLElement | null>(null);
        const element = shallowRef<HTMLElement | null>(null);
        useCompositeListItem(element, {
          label: () => props.label,
          textRef: () => (props.useTextRef ? textRef.value : undefined),
        });
        return () => (
          <div ref={element} data-testid={props.testId}>
            <span ref={props.useTextRef ? textRef : undefined}>{props.text}</span>
            {props.useTextRef ? '-ignored' : ''}
          </div>
        );
      },
      { props: ['testId', 'label', 'text', 'useTextRef'] },
    );

    it('resolves each label source', async () => {
      const elementsRef = shallowRef<(HTMLElement | null)[]>([]);
      const labelsRef = shallowRef<(string | null)[]>([]);

      await render(
        <CompositeList elementsRef={elementsRef} labelsRef={labelsRef}>
          <LabelledItem testId="explicit" label="explicit label" text="ignored" />
          {/* An explicit `null` means "no label". The list must not use the text of the element. */}
          <LabelledItem testId="null-label" label={null} text="not a label" />
          <LabelledItem testId="text-ref" useTextRef text="from text ref" />
          <LabelledItem testId="element-text" text="from element" />
        </CompositeList>,
      );

      expect(labelsRef.value).toEqual(['explicit label', null, 'from text ref', 'from element']);
    });

    it('drops label slots for items that unmount', async () => {
      const elementsRef = shallowRef<(HTMLElement | null)[]>([]);
      const labelsRef = shallowRef<(string | null)[]>([]);

      const App = defineComponent(
        (props: { items: string[] }) => () => (
          <CompositeList elementsRef={elementsRef} labelsRef={labelsRef}>
            {props.items.map((item) => (
              <LabelledItem key={item} testId={item} label={item} />
            ))}
          </CompositeList>
        ),
        { props: ['items'] },
      );

      const { setProps } = await render(<App items={['a', 'b', 'c']} />);
      expect(labelsRef.value).toEqual(['a', 'b', 'c']);

      await setProps({ items: ['a'] });
      expect(labelsRef.value).toEqual(['a']);
    });

    it('updates the label of a mounted item', async () => {
      const elementsRef = shallowRef<(HTMLElement | null)[]>([]);
      const labelsRef = shallowRef<(string | null)[]>([]);

      const App = defineComponent(
        (props: { label: string }) => () => (
          <CompositeList elementsRef={elementsRef} labelsRef={labelsRef}>
            <LabelledItem testId="item" label={props.label} />
          </CompositeList>
        ),
        { props: ['label'] },
      );

      const { setProps } = await render(<App label="before" />);
      expect(labelsRef.value).toEqual(['before']);

      await setProps({ label: 'after' });

      expect(labelsRef.value).toEqual(['after']);
    });
  });

  describe('prop: onMapChange', () => {
    it('publishes item metadata alongside the index', async () => {
      const elementsRef = shallowRef<(HTMLElement | null)[]>([]);
      const onMapChange = vi.fn();

      const MetadataItem = defineComponent(
        (props: { testId: string; kind: string }) => {
          const metadata = computed(() => ({ kind: props.kind }));
          const element = shallowRef<HTMLElement | null>(null);
          useCompositeListItem(element, { metadata });
          return () => <div ref={element} data-testid={props.testId} />;
        },
        { props: ['testId', 'kind'] },
      );

      await render(
        <CompositeList elementsRef={elementsRef} onMapChange={onMapChange}>
          <MetadataItem testId="first" kind="alpha" />
          <MetadataItem testId="second" kind="beta" />
        </CompositeList>,
      );

      const map = onMapChange.mock.lastCall?.[0] as Map<Element, { kind: string; index: number }>;
      expect(map.get(screen.getByTestId('first'))).toEqual({ kind: 'alpha', index: 0 });
      expect(map.get(screen.getByTestId('second'))).toEqual({ kind: 'beta', index: 1 });
    });

    it('does not publish an unchanged map when a label changes', async () => {
      const elementsRef = shallowRef<(HTMLElement | null)[]>([]);
      const labelsRef = shallowRef<(string | null)[]>([]);
      const onMapChange = vi.fn();

      const App = defineComponent(
        (props: { label: string }) => () => (
          <CompositeList elementsRef={elementsRef} labelsRef={labelsRef} onMapChange={onMapChange}>
            <CompositeListItemPart label={props.label} />
          </CompositeList>
        ),
        { props: ['label'] },
      );

      const { setProps } = await render(<App label="before" />);
      expect(labelsRef.value).toEqual(['before']);
      onMapChange.mockClear();

      await setProps({ label: 'after' });

      expect(labelsRef.value).toEqual(['after']);
      expect(onMapChange).not.toHaveBeenCalled();
    });
  });

  describe('server-side rendering', () => {
    it('hydrates a server-rendered list without a mismatch under Strict Mode', async () => {
      const serverHtml = await renderOnServer(
        'src/internals/composite/list/CompositeListHydration.test.vue',
      );
      const template = document.createElement('template');
      template.innerHTML = serverHtml;

      // A server render calls no ref callback, so the registry is empty. Each item has the index
      // from the counter of the list. Base UI renders `-1` on a server, because its items guess
      // no index by default.
      expect(template.content.querySelector('[data-testid="a"]')?.getAttribute('data-index')).toBe(
        '0',
      );
      expect(template.content.querySelector('[data-testid="b"]')?.getAttribute('data-index')).toBe(
        '1',
      );

      const elementsRef = shallowRef<(HTMLElement | null)[]>([]);
      const { container } = await hydrate(CompositeListHydration, {
        serverHtml,
        props: { elementsRef },
      });
      const a = within(container).getByTestId('a');
      const b = within(container).getByTestId('b');
      expect(a).toHaveAttribute('data-index', '0');
      expect(b).toHaveAttribute('data-index', '1');
      expect(elementsRef.value).toHaveLength(2);
      expect(elementsRef.value[0]).toBe(a);
      expect(elementsRef.value[1]).toBe(b);
    });
  });

  describe('without a parent list', () => {
    it('renders an item that is not wrapped in a list', async () => {
      const OrphanItem = defineComponent(() => {
        const element = shallowRef<HTMLElement | null>(null);
        const index = useCompositeListItem(element);
        return () => <div ref={element} data-testid="orphan" data-index={index.value} />;
      });

      const { unmount } = await render(<OrphanItem />);

      // An item that has no list stays inert. It does not throw.
      expect(screen.getByTestId('orphan')).toBeInTheDocument();
      expect(screen.getByTestId('orphan')).toHaveAttribute('data-index', '-1');
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('KeepAlive', () => {
    it('keeps the visible labels until a held item returns', async () => {
      const elementsRef = shallowRef<(HTMLElement | null)[]>([]);
      const labelsRef = shallowRef<(string | null)[]>([]);
      const label = shallowRef('before');
      const { HeldBranch, hide, show } = createHeldBranch(
        () => <CompositeListItemPart label={label.value} />,
        { mounted: true },
      );
      await render(
        <CompositeList elementsRef={elementsRef} labelsRef={labelsRef}>
          <CompositeListItemPart label="first" />
          <HeldBranch />
        </CompositeList>,
      );

      expect(labelsRef.value).toEqual(['first', 'before']);
      await hide();
      const visibleLabels = labelsRef.value;
      expect(visibleLabels).toEqual(['first']);

      label.value = 'after';
      await flushMicrotasks();
      expect(labelsRef.value).toBe(visibleLabels);

      await show();
      expect(labelsRef.value).toEqual(['first', 'after']);
    });

    it('removes a deactivated item and registers it again when it is active', async () => {
      const elementsRef = shallowRef<(HTMLElement | null)[]>([]);

      const Other = defineComponent(() => () => <span data-testid="other" />);

      const App = defineComponent(() => {
        const showItem = shallowRef(true);
        return () => (
          <>
            <button
              type="button"
              onClick={() => {
                showItem.value = !showItem.value;
              }}
            >
              Toggle item
            </button>
            <CompositeList elementsRef={elementsRef}>
              <CompositeListItemPart data-testid="a" />
              <KeepAlive>
                {showItem.value ? <CompositeListItemPart data-testid="b" /> : <Other />}
              </KeepAlive>
              <CompositeListItemPart data-testid="c" />
            </CompositeList>
          </>
        );
      });

      const { user } = await render(<App />);

      expect(elementsRef.value).toEqual([
        screen.getByTestId('a'),
        screen.getByTestId('b'),
        screen.getByTestId('c'),
      ]);

      await user.click(screen.getByRole('button', { name: 'Toggle item' }));

      expect(elementsRef.value).toEqual([screen.getByTestId('a'), screen.getByTestId('c')]);
      expect(screen.getByTestId('c')).toHaveAttribute('data-index', '1');

      await user.click(screen.getByRole('button', { name: 'Toggle item' }));

      expect(elementsRef.value).toEqual([
        screen.getByTestId('a'),
        screen.getByTestId('b'),
        screen.getByTestId('c'),
      ]);
      expect(screen.getByTestId('c')).toHaveAttribute('data-index', '2');
    });

    it('registers an item that mounts while KeepAlive holds its branch when the branch shows', async () => {
      const elementsRef = shallowRef<(HTMLElement | null)[]>([]);
      const { HeldBranch, mountWhileHeld, show } = createHeldBranch(() => (
        <CompositeListItemPart data-testid="b" />
      ));
      await render(() => (
        <CompositeList elementsRef={elementsRef}>
          <CompositeListItemPart data-testid="a" />
          <HeldBranch />
          <CompositeListItemPart data-testid="c" />
        </CompositeList>
      ));

      await mountWhileHeld();
      expect(elementsRef.value).toEqual([screen.getByTestId('a'), screen.getByTestId('c')]);

      await show();
      expect(elementsRef.value).toEqual([
        screen.getByTestId('a'),
        screen.getByTestId('b'),
        screen.getByTestId('c'),
      ]);
      expect(screen.getByTestId('c')).toHaveAttribute('data-index', '2');
    });

    it('sorts a list that mounts with its items while KeepAlive holds its branch', async () => {
      const elementsRef = shallowRef<(HTMLElement | null)[]>([]);
      const count = shallowRef(1);
      const { HeldBranch, mountWhileHeld, show } = createHeldBranch(() => (
        <CompositeList elementsRef={elementsRef}>
          {['a', 'b'].slice(0, count.value).map((name) => (
            <CompositeListItemPart key={name} data-testid={name} />
          ))}
        </CompositeList>
      ));
      await render(() => <HeldBranch />);

      await mountWhileHeld();
      count.value = 2;
      await flushMicrotasks();
      expect(elementsRef.value).toEqual([]);

      await show();
      expect(elementsRef.value).toEqual([screen.getByTestId('a'), screen.getByTestId('b')]);
      expect(screen.getByTestId('b')).toHaveAttribute('data-index', '1');
    });
  });
});
