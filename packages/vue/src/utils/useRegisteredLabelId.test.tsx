import { expect, describe, it } from 'vitest';
import { defineComponent, KeepAlive, onDeactivated, shallowRef } from 'vue';
import { createRenderer, flushMicrotasks, screen } from '#test-utils';
import { useLabelId, useRegisteredLabelId } from './useRegisteredLabelId';
import type { LabelIdRoot } from './useRegisteredLabelId';

describe('useRegisteredLabelId', () => {
  const { render } = createRenderer();

  const Label = defineComponent(
    (props: { id: string; root: LabelIdRoot }, { slots }) => {
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

  const Test = defineComponent(
    (props: { labels: 'old' | 'both' | 'new' }) => {
      const target = shallowRef<HTMLElement | null>(null);
      const { labelId, labelRoot } = useLabelId(target);

      return () => (
        <>
          <div ref={target} data-testid="target" aria-labelledby={labelId.value} />
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
        const target = shallowRef<HTMLElement | null>(null);
        const { labelId, labelRoot } = useLabelId(target);

        return () => (
          <>
            <div ref={target} data-testid="target" aria-labelledby={labelId.value} />
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
        const target = shallowRef<HTMLElement | null>(null);
        const { labelId, labelRoot } = useLabelId(target);

        return () => (
          <>
            <div ref={target} data-testid="target" aria-labelledby={labelId.value} />
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
        const target = shallowRef<HTMLElement | null>(null);
        const { labelId: rootLabelId, labelRoot } = useLabelId(target);

        return () => (
          <>
            <div ref={target} data-testid="target" aria-labelledby={rootLabelId.value} />
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
          // `KeepAlive` runs the hook of the label before this hook. The watcher of the label then
          // gets the new id and the flag in one run.
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
        const target = shallowRef<HTMLElement | null>(null);
        const { labelId: rootLabelId, labelRoot } = useLabelId(target);

        return () => (
          <>
            <div ref={target} data-testid="target" aria-labelledby={rootLabelId.value} />
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
  });

  describe('a label that mounts while KeepAlive holds its branch', () => {
    const Root = defineComponent((_props, { slots }) => {
      const target = shallowRef<HTMLElement | null>(null);
      const { labelId, labelRoot } = useLabelId(target);

      return () => (
        <div>
          <div ref={target} data-testid="target" aria-labelledby={labelId.value} />
          {slots.default?.(labelRoot)}
        </div>
      );
    });

    function createApp(options: { before: boolean; outside: boolean; rootInBranch: boolean }) {
      const visible = shallowRef(true);
      const extra = shallowRef(false);
      const Labels = defineComponent(
        (props: { root: LabelIdRoot }) => () => (
          <div>
            {extra.value && options.before ? (
              <Label key="b" id="label-b" root={props.root}>
                B
              </Label>
            ) : null}
            <Label key="a" id="label-a" root={props.root}>
              A
            </Label>
            {extra.value && !options.before ? (
              <Label key="b" id="label-b" root={props.root}>
                B
              </Label>
            ) : null}
          </div>
        ),
        { props: ['root'] },
      );
      const RootWithLabels = defineComponent(() => () => (
        <Root>{(root: LabelIdRoot) => <Labels root={root} />}</Root>
      ));
      const App = defineComponent(
        () => () =>
          options.rootInBranch ? (
            <KeepAlive>{visible.value ? <RootWithLabels /> : null}</KeepAlive>
          ) : (
            <Root>
              {(root: LabelIdRoot) => (
                <>
                  <KeepAlive>{visible.value ? <Labels root={root} /> : null}</KeepAlive>
                  {options.outside ? (
                    <Label id="label-c" root={root}>
                      C
                    </Label>
                  ) : null}
                </>
              )}
            </Root>
          ),
      );
      return { App, visible, extra };
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
        expected: ['label-c', 'label-c', 'label-c', 'label-b', 'none', 'label-b'],
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
    ])('$name', async ({ options, showFlush, expected }) => {
      const { App, visible, extra } = createApp(options);
      const hide = () => {
        visible.value = false;
      };
      const show = () => {
        visible.value = true;
      };
      const mountB = () => {
        extra.value = true;
      };
      const mountBAndShow = () => {
        extra.value = true;
        visible.value = true;
      };
      const changes = showFlush
        ? [hide, mountBAndShow, hide, show]
        : [hide, mountB, show, hide, show];

      await render(<App />);
      const seen = [readTarget()];
      for (const change of changes) {
        change();
        await flushMicrotasks();
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
});
