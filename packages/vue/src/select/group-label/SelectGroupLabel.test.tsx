import { expect, describe, it, vi } from 'vitest';
import { defineComponent, h, shallowRef } from 'vue';
import * as Select from '../index.parts';
import {
  createRenderer,
  describeConformance,
  flushMicrotasks,
  screen,
  takeReportedMessages,
} from '#test-utils';

describe('<Select.GroupLabel />', () => {
  const { render } = createRenderer();

  describeConformance(<Select.GroupLabel />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(
        <Select.Root open>
          <Select.Group>{node}</Select.Group>
        </Select.Root>,
      );
    },
  }));

  it('is hidden from the accessibility tree by default', async () => {
    await render(
      <Select.Root open>
        <Select.Group>
          <Select.GroupLabel>Fruits</Select.GroupLabel>
        </Select.Group>
      </Select.Root>,
    );

    expect(screen.getByText('Fruits')).toHaveAttribute('aria-hidden', 'true');
  });

  it('allows overriding aria-hidden', async () => {
    await render(
      <Select.Root open>
        <Select.Group>
          <Select.GroupLabel aria-hidden={undefined}>Fruits</Select.GroupLabel>
        </Select.Group>
      </Select.Root>,
    );

    expect(screen.getByText('Fruits')).not.toHaveAttribute('aria-hidden');
  });

  it('removes the group aria-labelledby attribute when unmounted', async () => {
    const labelMounted = shallowRef(true);
    const Test = defineComponent({
      setup: () => () => (
        <Select.Root open>
          <Select.Group>
            {labelMounted.value && <Select.GroupLabel id="group-label">Fruits</Select.GroupLabel>}
          </Select.Group>
        </Select.Root>
      ),
    });

    await render(<Test />);

    const group = screen.getByRole('group');
    expect(group).toHaveAttribute('aria-labelledby', 'group-label');

    labelMounted.value = false;
    await flushMicrotasks();

    expect(screen.queryByText('Fruits')).toBe(null);
    expect(group).not.toHaveAttribute('aria-labelledby');
  });

  it('does not let an older label cleanup clear a newer label', async () => {
    const labels = shallowRef<'old' | 'both' | 'new'>('old');
    const Test = defineComponent({
      setup: () => () => (
        <Select.Root open>
          <Select.Group>
            {labels.value !== 'new' && (
              <Select.GroupLabel key="old" id="old-label">
                Old
              </Select.GroupLabel>
            )}
            {labels.value !== 'old' && (
              <Select.GroupLabel key="new" id="new-label">
                New
              </Select.GroupLabel>
            )}
          </Select.Group>
        </Select.Root>
      ),
    });

    await render(<Test />);

    const group = screen.getByRole('group');
    expect(group).toHaveAttribute('aria-labelledby', 'old-label');

    labels.value = 'both';
    await flushMicrotasks();
    expect(group).toHaveAttribute('aria-labelledby', 'new-label');

    labels.value = 'new';
    await flushMicrotasks();
    expect(group).toHaveAttribute('aria-labelledby', 'new-label');
  });

  it('updates explicit and generated ids independently of ref churn', async () => {
    const firstRef = vi.fn();
    const secondRef = vi.fn();
    const id = shallowRef<string | undefined>(undefined);
    const labelRef = shallowRef<'first' | 'second'>('first');

    // A function ref of the consumer is on the element of the `#render` slot. Vue calls the new
    // function ref with the element. It does not call the old one with `null`, as React does.
    let elementRef: (element: unknown) => void = () => {};
    const callFirstRef = (element: unknown) => {
      elementRef(element);
      firstRef(element);
    };
    const callSecondRef = (element: unknown) => {
      elementRef(element);
      secondRef(element);
    };

    const Test = defineComponent({
      setup: () => () => (
        <Select.Root open>
          <Select.Group>
            <Select.GroupLabel
              id={id.value}
              v-slots={{
                render: ({ props }: { props: Record<string, any> }) => {
                  elementRef = props.ref;
                  return h(
                    'div',
                    {
                      ...props,
                      ref: labelRef.value === 'first' ? callFirstRef : callSecondRef,
                    },
                    'Fruits',
                  );
                },
              }}
            />
          </Select.Group>
        </Select.Root>
      ),
    });

    await render(<Test />);

    const group = screen.getByRole('group');
    const label = screen.getByText('Fruits');
    const generatedId = label.id;
    expect(group).toHaveAttribute('aria-labelledby', generatedId);

    id.value = 'custom-label';
    labelRef.value = 'second';
    await flushMicrotasks();
    expect(group).toHaveAttribute('aria-labelledby', 'custom-label');
    expect(firstRef).toHaveBeenCalledWith(label);
    expect(secondRef).toHaveBeenLastCalledWith(label);

    id.value = undefined;
    await flushMicrotasks();
    expect(group).toHaveAttribute('aria-labelledby', generatedId);
  });

  it('throws a descriptive error when rendered outside <Select.Group>', async () => {
    await expect(
      render(
        <Select.Root open>
          <Select.GroupLabel />
        </Select.Root>,
      ),
    ).rejects.toThrow('Vase UI: <Select.GroupLabel> must be inside <Select.Group>.');
    expect(takeReportedMessages()).toHaveLength(1);
  });
});
