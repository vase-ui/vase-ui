import { expect, describe, it } from 'vitest';
import { defineComponent, KeepAlive, shallowRef } from 'vue';
import { Progress } from '@vase-ui/vue/progress';
import {
  createHeldBranch,
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  screen,
  takeReportedMessages,
} from '#test-utils';

describe('<Progress.Label />', () => {
  const { render } = createRenderer();

  describeConformance(<Progress.Label />, () => ({
    render: (node) => {
      return render(<Progress.Root value={40}>{node}</Progress.Root>);
    },
    refInstanceof: window.HTMLSpanElement,
  }));

  it('updates and clears the progress bar label association', async () => {
    const App = defineComponent(() => {
      const labelId = shallowRef('label-a');
      const showLabel = shallowRef(true);

      return () => (
        <>
          <Progress.Root value={40}>
            {showLabel.value ? (
              <Progress.Label id={labelId.value}>Upload progress</Progress.Label>
            ) : null}
          </Progress.Root>
          <button
            type="button"
            onClick={() => {
              labelId.value = 'label-b';
            }}
          >
            Change id
          </button>
          <button
            type="button"
            onClick={() => {
              showLabel.value = false;
            }}
          >
            Remove label
          </button>
        </>
      );
    });

    await render(<App />);

    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-labelledby', 'label-a');

    await fireEvent.click(screen.getByRole('button', { name: 'Change id' }));
    expect(progressbar).toHaveAttribute('aria-labelledby', 'label-b');

    await fireEvent.click(screen.getByRole('button', { name: 'Remove label' }));
    expect(progressbar).not.toHaveAttribute('aria-labelledby');
  });

  it('names the progress bar with the label only while KeepAlive shows the label', async () => {
    const visible = shallowRef(true);
    const App = defineComponent(() => () => (
      <Progress.Root value={40}>
        <KeepAlive>
          {visible.value ? (
            <Progress.Label data-testid="label">Upload progress</Progress.Label>
          ) : null}
        </KeepAlive>
      </Progress.Root>
    ));
    await render(<App />);
    const progressbar = screen.getByRole('progressbar');
    const label = screen.getByTestId('label');
    expect(progressbar).toHaveAttribute('aria-labelledby', label.id);

    visible.value = false;
    await flushMicrotasks();
    expect(progressbar).not.toHaveAttribute('aria-labelledby');

    visible.value = true;
    await flushMicrotasks();
    // The same element proves that `KeepAlive` kept the label and did not mount a new one.
    expect(screen.getByTestId('label')).toBe(label);
    expect(progressbar).toHaveAttribute('aria-labelledby', label.id);
  });

  it('names the last label after KeepAlive shows a label that mounted while held', async () => {
    const { HeldBranch, hide, mountWhileHeld, show } = createHeldBranch(
      () => (
        <Progress.Label key="b" id="label-b">
          B
        </Progress.Label>
      ),
      {
        renderBranch: (part) => (
          <div>
            <Progress.Label key="a" id="label-a">
              A
            </Progress.Label>
            {part}
          </div>
        ),
      },
    );
    const App = defineComponent(() => () => (
      <Progress.Root value={40}>
        <HeldBranch />
      </Progress.Root>
    ));
    await render(<App />);
    const progressbar = screen.getByRole('progressbar');
    const seen = [progressbar.getAttribute('aria-labelledby')];
    for (const change of [hide, mountWhileHeld, show, hide, show]) {
      await change();
      seen.push(progressbar.getAttribute('aria-labelledby'));
    }

    expect(seen).toEqual(['label-a', null, null, 'label-b', null, 'label-b']);
  });

  it('VUE-131: names the label that is left when the last label goes away', async () => {
    const showB = shallowRef(true);
    const App = defineComponent(() => () => (
      <Progress.Root value={40}>
        <Progress.Label id="label-a">A</Progress.Label>
        {showB.value ? <Progress.Label id="label-b">B</Progress.Label> : null}
      </Progress.Root>
    ));

    await render(<App />);
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-labelledby', 'label-b');

    showB.value = false;
    await flushMicrotasks();

    expect(progressbar).toHaveAttribute('aria-labelledby', 'label-a');
    expect(screen.getByRole('progressbar', { name: 'A' })).toBe(progressbar);
  });

  it('throws a descriptive error when rendered outside <Progress.Root>', async () => {
    await expect(render(<Progress.Label />)).rejects.toThrow(
      'Vase UI: A part of Progress must be inside <Progress.Root>. Without a root the part has no value and no status to show. Put the part inside <Progress.Root>.',
    );

    // Vue also warns about the error of `setup`.
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
