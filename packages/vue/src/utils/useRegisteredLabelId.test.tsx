import { expect, describe, it, onTestFinished } from 'vitest';
import { defineComponent, KeepAlive, onDeactivated, shallowRef } from 'vue';
import type { VNodeChild } from 'vue';
import { createHeldBranch, createRenderer, flushMicrotasks, screen } from '#test-utils';
import { useLabelId, useRegisteredLabelId } from './useRegisteredLabelId';
import type { LabelIdRoot } from './useRegisteredLabelId';

describe('useRegisteredLabelId', () => {
  const { render } = createRenderer();

  const Label = defineComponent(
    (props: { id?: string; root: LabelIdRoot }, { slots }) => {
      const element = shallowRef<HTMLElement | null>(null);
      const registeredId = useRegisteredLabelId(() => props.id, props.root, element);

      return () => (
        <span ref={element} id={registeredId.value}>
          {slots.default?.()}
        </span>
      );
    },
    { props: ['id', 'root'] },
  );

  const SlotLabel = defineComponent(
    (props: { id?: string; elementId: string; root: LabelIdRoot }) => {
      const element = shallowRef<HTMLElement | null>(null);
      useRegisteredLabelId(() => props.id ?? 'bound', props.root, element);

      return () => <span ref={element} id={props.elementId} />;
    },
    { props: ['id', 'elementId', 'root'] },
  );

  const Test = defineComponent(
    (props: { labels: 'old' | 'both' | 'new' }) => {
      const { labelId, labelRoot } = useLabelId();

      return () => (
        <>
          <div data-testid="target" aria-labelledby={labelId.value} />
          {props.labels !== 'new' && (
            <Label key="old" id="old-label" root={labelRoot}>
              Old
            </Label>
          )}
          {props.labels !== 'old' && (
            <Label key="new" id="new-label" root={labelRoot}>
              New
            </Label>
          )}
        </>
      );
    },
    { props: ['labels'] },
  );

  it('does not let an older label cleanup clear a newer label', async () => {
    const { rerender } = await render(<Test labels="old" />);

    const target = screen.getByTestId('target');
    expect(target).toHaveAttribute('aria-labelledby', 'old-label');

    await rerender(<Test labels="both" />);
    expect(target).toHaveAttribute('aria-labelledby', 'new-label');

    await rerender(<Test labels="new" />);
    expect(target).toHaveAttribute('aria-labelledby', 'new-label');
  });

  it('keeps the label of the root when the id of an older label changes', async () => {
    const olderId = shallowRef('older');
    const App = defineComponent(() => {
      const { labelId, labelRoot } = useLabelId();

      return () => (
        <>
          <div data-testid="target" aria-labelledby={labelId.value} />
          <Label id={olderId.value} root={labelRoot} />
          <Label id="newer" root={labelRoot} />
        </>
      );
    });
    await render(<App />);
    const target = screen.getByTestId('target');
    expect(target).toHaveAttribute('aria-labelledby', 'newer');

    olderId.value = 'changed';
    await flushMicrotasks();

    expect(target).toHaveAttribute('aria-labelledby', 'newer');
  });

  describe('the id of the element', () => {
    function setup(other?: 'before' | 'after') {
      const elementId = shallowRef('first');
      const shown = shallowRef(true);
      const kept = shallowRef(true);
      const App = defineComponent(() => {
        const { labelId, labelRoot } = useLabelId();

        return () => (
          <>
            <div data-testid="target" aria-labelledby={labelId.value} />
            {other === 'before' && <Label id="other" root={labelRoot} />}
            <KeepAlive>
              {kept.value && shown.value ? (
                <SlotLabel elementId={elementId.value} root={labelRoot} />
              ) : null}
            </KeepAlive>
            {other === 'after' && <Label id="other" root={labelRoot} />}
          </>
        );
      });
      return { App, elementId, kept, shown };
    }

    it('names the id that the element of the label has, and follows a change of it', async () => {
      const { App, elementId } = setup();
      await render(<App />);
      const target = screen.getByTestId('target');
      const steps = [target.getAttribute('aria-labelledby')];

      elementId.value = 'second';
      await flushMicrotasks();
      steps.push(target.getAttribute('aria-labelledby'));

      expect(steps).toEqual(['first', 'second']);
    });

    it('names the id of the element of a label that mounts after the root', async () => {
      const { App, shown } = setup();
      shown.value = false;
      await render(<App />);
      const target = screen.getByTestId('target');

      shown.value = true;
      await flushMicrotasks();

      expect(target).toHaveAttribute('aria-labelledby', 'first');
    });

    it('names no label while the element of the label has an empty id', async () => {
      const { App, elementId } = setup();
      await render(<App />);
      const target = screen.getByTestId('target');

      elementId.value = '';
      await flushMicrotasks();
      const empty = target.getAttribute('aria-labelledby');
      elementId.value = 'second';
      await flushMicrotasks();

      expect(empty).toBeNull();
      expect(target).toHaveAttribute('aria-labelledby', 'second');
    });

    it('keeps the label of the root when the element of an older label gets an empty id', async () => {
      const { App, elementId } = setup('after');
      await render(<App />);
      const target = screen.getByTestId('target');
      expect(target).toHaveAttribute('aria-labelledby', 'other');

      elementId.value = '';
      await flushMicrotasks();

      expect(target).toHaveAttribute('aria-labelledby', 'other');
    });

    it('keeps the label of the root when a label whose element has an empty id mounts later', async () => {
      const { App, elementId, shown } = setup('before');
      elementId.value = '';
      shown.value = false;
      await render(<App />);
      const target = screen.getByTestId('target');

      shown.value = true;
      await flushMicrotasks();

      expect(target).toHaveAttribute('aria-labelledby', 'other');
    });

    it('names no label after a label whose element has another id unmounts', async () => {
      const mounted = shallowRef(true);
      const App = defineComponent(() => {
        const { labelId, labelRoot } = useLabelId();

        return () => (
          <>
            <div data-testid="target" aria-labelledby={labelId.value} />
            {mounted.value && <SlotLabel elementId="first" root={labelRoot} />}
          </>
        );
      });
      await render(<App />);
      const target = screen.getByTestId('target');
      const before = target.getAttribute('aria-labelledby');

      mounted.value = false;
      await flushMicrotasks();

      expect(before).toBe('first');
      expect(target).not.toHaveAttribute('aria-labelledby');
    });

    it('names the id of the element again when KeepAlive shows the label', async () => {
      const { App, kept } = setup();
      await render(<App />);
      const target = screen.getByTestId('target');

      kept.value = false;
      await flushMicrotasks();
      const held = target.getAttribute('aria-labelledby');
      kept.value = true;
      await flushMicrotasks();

      expect(held).toBeNull();
      expect(target).toHaveAttribute('aria-labelledby', 'first');
    });

    it('names an earlier label when KeepAlive shows a later label whose element has an empty id', async () => {
      const visible = shallowRef(true);
      const Branch = defineComponent(
        (props: { root: LabelIdRoot }) => () => (
          <>
            <SlotLabel id="earlier" elementId="earlier" root={props.root} />
            <SlotLabel id="later" elementId="" root={props.root} />
          </>
        ),
        { props: ['root'] },
      );
      const App = defineComponent(() => {
        const { labelId, labelRoot } = useLabelId();

        return () => (
          <>
            <div data-testid="target" aria-labelledby={labelId.value} />
            <KeepAlive>{visible.value ? <Branch root={labelRoot} /> : null}</KeepAlive>
          </>
        );
      });
      await render(<App />);
      const target = screen.getByTestId('target');

      visible.value = false;
      await flushMicrotasks();
      visible.value = true;
      await flushMicrotasks();

      expect(target).toHaveAttribute('aria-labelledby', 'earlier');
    });
  });

  describe('under `KeepAlive`', () => {
    const Labels = defineComponent(
      (props: { root: LabelIdRoot }) => () => (
        <>
          <Label id="first" root={props.root}>
            First
          </Label>
          <Label id="middle" root={props.root}>
            Middle
          </Label>
          <Label id="last" root={props.root}>
            Last
          </Label>
        </>
      ),
      { props: ['root'] },
    );

    it('names the last label of a branch again when KeepAlive shows the branch', async () => {
      const visible = shallowRef(true);
      const App = defineComponent(() => {
        const { labelId, labelRoot } = useLabelId();

        return () => (
          <>
            <div data-testid="target" aria-labelledby={labelId.value} />
            <KeepAlive>{visible.value ? <Labels root={labelRoot} /> : null}</KeepAlive>
          </>
        );
      });
      await render(<App />);
      const target = screen.getByTestId('target');
      expect(target).toHaveAttribute('aria-labelledby', 'last');

      visible.value = false;
      await flushMicrotasks();
      expect(target).not.toHaveAttribute('aria-labelledby');

      visible.value = true;
      await flushMicrotasks();
      expect(target).toHaveAttribute('aria-labelledby', 'last');
    });

    it('names the label that KeepAlive shows when two kept labels replace each other', async () => {
      const shown = shallowRef<'a' | 'b'>('a');
      const App = defineComponent(() => {
        const { labelId, labelRoot } = useLabelId();

        return () => (
          <>
            <div data-testid="target" aria-labelledby={labelId.value} />
            <KeepAlive>
              <Label key={shown.value} id={`label-${shown.value}`} root={labelRoot}>
                Label
              </Label>
            </KeepAlive>
          </>
        );
      });
      await render(<App />);
      const target = screen.getByTestId('target');
      expect(target).toHaveAttribute('aria-labelledby', 'label-a');

      shown.value = 'b';
      await flushMicrotasks();
      expect(target).toHaveAttribute('aria-labelledby', 'label-b');

      shown.value = 'a';
      await flushMicrotasks();
      expect(target).toHaveAttribute('aria-labelledby', 'label-a');

      shown.value = 'b';
      await flushMicrotasks();
      expect(target).toHaveAttribute('aria-labelledby', 'label-b');
    });

    it('gives the root a new id of a held label only when KeepAlive shows the label', async () => {
      const visible = shallowRef(true);
      const labelId = shallowRef('label-a');
      // The branch reads the id in its own render, so the held label gets the new id.
      const Branch = defineComponent(
        (props: { root: LabelIdRoot }) => () => (
          <Label id={labelId.value} root={props.root}>
            Label
          </Label>
        ),
        { props: ['root'] },
      );
      const App = defineComponent(() => {
        const { labelId: rootLabelId, labelRoot } = useLabelId();

        return () => (
          <>
            <div data-testid="target" aria-labelledby={rootLabelId.value} />
            <KeepAlive>{visible.value ? <Branch root={labelRoot} /> : null}</KeepAlive>
          </>
        );
      });
      await render(<App />);
      const target = screen.getByTestId('target');
      expect(target).toHaveAttribute('aria-labelledby', 'label-a');

      visible.value = false;
      await flushMicrotasks();
      expect(target).not.toHaveAttribute('aria-labelledby');

      labelId.value = 'label-c';
      await flushMicrotasks();
      expect(target).not.toHaveAttribute('aria-labelledby');

      visible.value = true;
      await flushMicrotasks();
      expect(target).toHaveAttribute('aria-labelledby', 'label-c');
    });

    it('removes the old id when the id of the label changes in the deactivation', async () => {
      const visible = shallowRef(true);
      const labelId = shallowRef('label-a');
      const Branch = defineComponent(
        (props: { root: LabelIdRoot }) => {
          onDeactivated(() => {
            labelId.value = 'label-c';
          });

          return () => (
            <Label id={labelId.value} root={props.root}>
              Label
            </Label>
          );
        },
        { props: ['root'] },
      );
      const App = defineComponent(() => {
        const { labelId: rootLabelId, labelRoot } = useLabelId();

        return () => (
          <>
            <div data-testid="target" aria-labelledby={rootLabelId.value} />
            <KeepAlive>{visible.value ? <Branch root={labelRoot} /> : null}</KeepAlive>
          </>
        );
      });
      await render(<App />);
      const target = screen.getByTestId('target');
      expect(target).toHaveAttribute('aria-labelledby', 'label-a');

      visible.value = false;
      await flushMicrotasks();
      expect(target).not.toHaveAttribute('aria-labelledby');

      visible.value = true;
      await flushMicrotasks();
      expect(target).toHaveAttribute('aria-labelledby', 'label-c');
    });

    it('names the last label in the document after KeepAlive shows an earlier label', async () => {
      const visibleA = shallowRef(true);
      const visibleB = shallowRef(true);
      const App = defineComponent(() => {
        const { labelId, labelRoot } = useLabelId();

        return () => (
          <>
            <div data-testid="target" aria-labelledby={labelId.value} />
            <KeepAlive>
              {visibleA.value ? (
                <Label key="a" id="label-a" root={labelRoot}>
                  A
                </Label>
              ) : null}
            </KeepAlive>
            <KeepAlive>
              {visibleB.value ? (
                <Label key="b" id="label-b" root={labelRoot}>
                  B
                </Label>
              ) : null}
            </KeepAlive>
          </>
        );
      });
      await render(<App />);
      const target = screen.getByTestId('target');
      expect(target).toHaveAttribute('aria-labelledby', 'label-b');

      visibleB.value = false;
      await flushMicrotasks();
      visibleB.value = true;
      await flushMicrotasks();
      expect(target).toHaveAttribute('aria-labelledby', 'label-b');

      visibleA.value = false;
      await flushMicrotasks();
      expect(target).toHaveAttribute('aria-labelledby', 'label-b');

      visibleA.value = true;
      await flushMicrotasks();
      expect(target).toHaveAttribute('aria-labelledby', 'label-b');

      visibleB.value = false;
      await flushMicrotasks();
      expect(target).toHaveAttribute('aria-labelledby', 'label-a');

      visibleB.value = true;
      await flushMicrotasks();
      expect(target).toHaveAttribute('aria-labelledby', 'label-b');
    });
  });

  describe('a label that mounts while KeepAlive holds its branch', () => {
    const Root = defineComponent((_props, { slots }) => {
      const { labelId, labelRoot } = useLabelId();

      return () => (
        <div>
          <div data-testid="target" aria-labelledby={labelId.value} />
          {slots.default?.(labelRoot)}
        </div>
      );
    });

    function createApp(options: { before: boolean; outside: boolean; rootInBranch: boolean }) {
      // The slot of `Root` gives the root of the labels. The render functions of the branch are
      // not in that slot, so the slot writes the root here before a label renders.
      let labelRoot: LabelIdRoot;
      const renderLabels = (part: VNodeChild) => (
        <div>
          {options.before ? part : null}
          <Label key="a" id="label-a" root={labelRoot}>
            A
          </Label>
          {options.before ? null : part}
        </div>
      );
      const held = createHeldBranch(
        () => (
          <Label key="b" id="label-b" root={labelRoot}>
            B
          </Label>
        ),
        {
          renderBranch: (part) =>
            options.rootInBranch ? (
              <Root>
                {(root: LabelIdRoot) => {
                  labelRoot = root;
                  return renderLabels(part);
                }}
              </Root>
            ) : (
              renderLabels(part)
            ),
        },
      );
      const App = defineComponent(
        () => () =>
          options.rootInBranch ? (
            <held.HeldBranch />
          ) : (
            <Root>
              {(root: LabelIdRoot) => {
                labelRoot = root;
                return [
                  <held.HeldBranch />,
                  options.outside ? (
                    <Label id="label-c" root={root}>
                      C
                    </Label>
                  ) : null,
                ];
              }}
            </Root>
          ),
      );
      return { App, ...held };
    }

    // A target that `KeepAlive` holds reads as `-`.
    function readTarget() {
      const target = screen.queryByTestId('target');
      return target ? (target.getAttribute('aria-labelledby') ?? 'none') : '-';
    }

    it.each([
      {
        name: 'B after A',
        options: { before: false, outside: false, rootInBranch: false },
        showFlush: false,
        expected: ['label-a', 'none', 'none', 'label-b', 'none', 'label-b'],
      },
      {
        name: 'B before A',
        options: { before: true, outside: false, rootInBranch: false },
        showFlush: false,
        expected: ['label-a', 'none', 'none', 'label-a', 'none', 'label-a'],
      },
      {
        name: 'C outside the branch',
        options: { before: false, outside: true, rootInBranch: false },
        showFlush: false,
        expected: ['label-c', 'label-c', 'label-c', 'label-c', 'label-c', 'label-c'],
      },
      {
        name: 'root in the branch, B after A',
        options: { before: false, outside: false, rootInBranch: true },
        showFlush: false,
        expected: ['label-a', '-', '-', 'label-b', '-', 'label-b'],
      },
      {
        name: 'root in the branch, B before A',
        options: { before: true, outside: false, rootInBranch: true },
        showFlush: false,
        expected: ['label-a', '-', '-', 'label-a', '-', 'label-a'],
      },
      {
        name: 'B mounts in the show flush, after A',
        options: { before: false, outside: false, rootInBranch: false },
        showFlush: true,
        expected: ['label-a', 'none', 'label-b', 'none', 'label-b'],
      },
      {
        name: 'B mounts in the show flush, before A',
        options: { before: true, outside: false, rootInBranch: false },
        showFlush: true,
        expected: ['label-a', 'none', 'label-a', 'none', 'label-a'],
      },
      {
        name: 'B mounts in the show patch, after A',
        options: { before: false, outside: false, rootInBranch: false },
        showFlush: true,
        fromProp: true,
        expected: ['label-a', 'none', 'label-b', 'none', 'label-b'],
      },
      {
        name: 'B mounts in the show patch, before A',
        options: { before: true, outside: false, rootInBranch: false },
        showFlush: true,
        fromProp: true,
        expected: ['label-a', 'none', 'label-a', 'none', 'label-a'],
      },
    ])('$name', async ({ options, showFlush, fromProp, expected }) => {
      const { App, hide, mountWhileHeld, show, mountInActivation } = createApp(options);
      const mountInShow = () => mountInActivation({ fromProp });
      const changes = showFlush
        ? [hide, mountInShow, hide, show]
        : [hide, mountWhileHeld, show, hide, show];

      await render(<App />);
      const seen = [readTarget()];
      for (const change of changes) {
        await change();
        seen.push(readTarget());
      }

      expect(seen).toEqual(expected);
    });

    it('keeps a label after the branch when the branch mounts in the first render', async () => {
      const App = defineComponent(() => () => (
        <Root>
          {(root: LabelIdRoot) => (
            <>
              <KeepAlive>
                <Label id="label-a" root={root}>
                  A
                </Label>
              </KeepAlive>
              <Label id="label-c" root={root}>
                C
              </Label>
            </>
          )}
        </Root>
      ));

      await render(<App />);
      await flushMicrotasks();

      expect(screen.getByTestId('target')).toHaveAttribute('aria-labelledby', 'label-c');
    });
  });

  describe('VUE-131: the last label in the document that has an id', () => {
    type Step = 'mountB' | 'unmountB' | 'unmountA' | 'hideB' | 'showB' | 'emptyIdB' | 'secondIdB';

    it.each([
      {
        name: 'the last label unmounts',
        position: 'after' as const,
        kind: 'plain' as const,
        initialB: true,
        steps: ['unmountB'] satisfies Step[],
        expected: ['label-b', 'label-a'],
      },
      {
        name: 'a later label unmounts',
        position: 'after' as const,
        kind: 'plain' as const,
        initialB: false,
        steps: ['mountB', 'unmountB'] satisfies Step[],
        expected: ['label-a', 'label-b', 'label-a'],
      },
      {
        name: 'KeepAlive holds the last label',
        position: 'after' as const,
        kind: 'keepAlive' as const,
        initialB: true,
        steps: ['hideB', 'showB'] satisfies Step[],
        expected: ['label-b', 'label-a', 'label-b'],
      },
      {
        name: 'the last label gets an empty id',
        position: 'after' as const,
        kind: 'slot' as const,
        initialB: true,
        steps: ['emptyIdB', 'secondIdB'] satisfies Step[],
        expected: ['first', 'label-a', 'second'],
      },
      {
        name: 'a label mounts before the last label',
        position: 'before' as const,
        kind: 'plain' as const,
        initialB: false,
        steps: ['mountB', 'unmountA'] satisfies Step[],
        expected: ['label-a', 'label-a', 'label-b'],
      },
    ])('$name', async ({ position, kind, initialB, steps, expected }) => {
      const mountedA = shallowRef(true);
      const mountedB = shallowRef(initialB);
      const visibleB = shallowRef(true);
      const elementIdB = shallowRef('first');
      const App = defineComponent(() => {
        const { labelId, labelRoot } = useLabelId();

        function renderB() {
          if (kind === 'keepAlive') {
            return (
              <KeepAlive>
                {visibleB.value ? (
                  <Label key="b" id="label-b" root={labelRoot}>
                    B
                  </Label>
                ) : null}
              </KeepAlive>
            );
          }
          if (kind === 'slot') {
            return <SlotLabel elementId={elementIdB.value} root={labelRoot} />;
          }
          return mountedB.value ? (
            <Label key="b" id="label-b" root={labelRoot}>
              B
            </Label>
          ) : null;
        }

        return () => (
          <>
            <div data-testid="target" aria-labelledby={labelId.value} />
            {position === 'before' ? renderB() : null}
            {mountedA.value ? (
              <Label key="a" id="label-a" root={labelRoot}>
                A
              </Label>
            ) : null}
            {position === 'after' ? renderB() : null}
          </>
        );
      });

      const actions: Record<Step, () => void> = {
        mountB: () => {
          mountedB.value = true;
        },
        unmountB: () => {
          mountedB.value = false;
        },
        unmountA: () => {
          mountedA.value = false;
        },
        hideB: () => {
          visibleB.value = false;
        },
        showB: () => {
          visibleB.value = true;
        },
        emptyIdB: () => {
          elementIdB.value = '';
        },
        secondIdB: () => {
          elementIdB.value = 'second';
        },
      };

      await render(<App />);
      const target = screen.getByTestId('target');
      const seen = [target.getAttribute('aria-labelledby')];
      for (const step of steps) {
        actions[step]();
        await flushMicrotasks();
        seen.push(target.getAttribute('aria-labelledby'));
      }

      expect(seen).toEqual(expected);
    });

    it.each([
      ['the first of two labels with no id leaves', 'first'],
      ['the last of two labels with no id leaves', 'last'],
    ] as const)('%s', async (_title, removed) => {
      const mountedFirst = shallowRef(true);
      const mountedLast = shallowRef(true);
      const App = defineComponent(() => {
        const { labelId, labelRoot } = useLabelId();

        return () => (
          <>
            <div data-testid="target" aria-labelledby={labelId.value} />
            {mountedFirst.value ? (
              <Label key="first" root={labelRoot}>
                First
              </Label>
            ) : null}
            {mountedLast.value ? (
              <Label key="last" root={labelRoot}>
                Last
              </Label>
            ) : null}
          </>
        );
      });

      await render(<App />);
      const target = screen.getByTestId('target');
      const remaining = screen.getByText(removed === 'first' ? 'Last' : 'First');
      expect(remaining.id).not.toBe('');
      const before = target.getAttribute('aria-labelledby');

      (removed === 'first' ? mountedFirst : mountedLast).value = false;
      await flushMicrotasks();

      expect([before, target.getAttribute('aria-labelledby')]).toEqual([
        remaining.id,
        remaining.id,
      ]);
    });

    it('does not name a label before its mount', async () => {
      const mountedB = shallowRef(false);
      const App = defineComponent(() => {
        const { labelId, labelRoot } = useLabelId();

        return () => (
          <>
            <div data-testid="target" aria-labelledby={labelId.value} />
            {mountedB.value ? (
              <Label key="b" id="label-b" root={labelRoot}>
                B
              </Label>
            ) : null}
            <Label key="a" id="label-a" root={labelRoot}>
              A
            </Label>
          </>
        );
      });

      await render(<App />);
      const target = screen.getByTestId('target');
      expect(target).toHaveAttribute('aria-labelledby', 'label-a');

      const records: (string | null)[] = [];
      const observer = new MutationObserver((batch) => {
        for (const record of batch) {
          records.push(record.oldValue);
        }
      });
      observer.observe(target, {
        attributes: true,
        attributeOldValue: true,
        attributeFilter: ['aria-labelledby'],
      });
      onTestFinished(() => {
        observer.disconnect();
      });

      mountedB.value = true;
      await flushMicrotasks();
      for (const record of observer.takeRecords()) {
        records.push(record.oldValue);
      }

      expect(records).toEqual([]);
      expect(target).toHaveAttribute('aria-labelledby', 'label-a');
    });
  });
});
