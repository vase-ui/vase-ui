import { describe, expect, it } from 'vitest';
import { createApp, shallowRef } from 'vue';
import { Field } from '@vase-ui/vue/field';
import { Popover } from '@vase-ui/vue/popover';
import { Select } from '@vase-ui/vue/select';
import {
  createHeldBranch,
  createRenderer,
  describeConformance,
  flushMicrotasks,
  screen,
} from '#test-utils';
import { recordVueWarnings } from '../../../test/reportedMessages';

describe('<Select.Label />', () => {
  const { render } = createRenderer();

  describeConformance(<Select.Label />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(
        <Select.Root>
          {node}
          <Select.Trigger />
          <Select.Portal>
            <Select.Positioner />
          </Select.Portal>
        </Select.Root>,
      );
    },
  }));

  it('has the id of the root with the suffix `-label`, also with an `id` attribute', async () => {
    await render(
      <Select.Root id="font">
        <Select.Label data-testid="label" {...{ id: 'own' }}>
          Font
        </Select.Label>
        <Select.Trigger />
      </Select.Root>,
    );

    expect(screen.getByTestId('label')).toHaveAttribute('id', 'font-label');
  });

  it('focuses the trigger when it is clicked', async () => {
    await render(
      <Select.Root>
        <Select.Label data-testid="label">Font</Select.Label>
        <Select.Trigger data-testid="trigger" />
      </Select.Root>,
    );

    screen.getByTestId('label').click();
    await flushMicrotasks();

    expect(screen.getByTestId('trigger')).toHaveFocus();
  });

  it('VUE-116: focuses a trigger whose #render slot gives an id that the field does not have', async () => {
    await render(
      <Field.Root>
        <Select.Root>
          <Select.Label data-testid="label">Font</Select.Label>
          <Select.Trigger
            v-slots={{
              render: ({ props }: { props: Record<string, unknown> }) => (
                <button type="button" {...props} id="own" data-testid="trigger" />
              ),
            }}
          />
        </Select.Root>
      </Field.Root>,
    );

    screen.getByTestId('label').click();
    await flushMicrotasks();

    expect(screen.getByTestId('trigger')).toHaveFocus();
  });

  it('does not name the trigger while KeepAlive holds a label that mounted in a held branch', async () => {
    const { HeldBranch, mountWhileHeld, show } = createHeldBranch(() => (
      <Select.Label key="label" data-testid="label">
        Font
      </Select.Label>
    ));
    await render(() => (
      <Select.Root>
        <HeldBranch />
        <Select.Trigger data-testid="trigger" />
      </Select.Root>
    ));
    const trigger = screen.getByTestId('trigger');

    await mountWhileHeld();
    expect(trigger).not.toHaveAttribute('aria-labelledby');

    await show();
    expect(trigger).toHaveAttribute('aria-labelledby', screen.getByTestId('label').id);
  });

  it('names a trigger in a popover from a label that mounts after it in an app in a detached element', async () => {
    const labelMounted = shallowRef(false);
    const container = document.createElement('div');
    const app = createApp(() => (
      <Select.Root id="font">
        {labelMounted.value && <Select.Label>Font</Select.Label>}
        <Popover.Root defaultOpen>
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup>
                <Select.Trigger data-testid="trigger">
                  <Select.Value />
                </Select.Trigger>
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      </Select.Root>
    ));
    recordVueWarnings(app);
    app.mount(container);
    try {
      await flushMicrotasks();
      labelMounted.value = true;
      await flushMicrotasks();
      document.body.append(container);
      await flushMicrotasks();

      expect(document.querySelector('[data-testid="trigger"]')).toHaveAttribute(
        'aria-labelledby',
        'font-label',
      );
    } finally {
      app.unmount();
      container.remove();
    }
  });
});
