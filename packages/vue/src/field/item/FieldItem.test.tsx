import { describe, expect, it, vi } from 'vitest';
import { Field } from '@vase-ui/vue/field';
import type { HTMLProps } from '@vase-ui/vue/types';
import { createRenderer, describeConformance, screen, takeReportedMessages } from '#test-utils';
import LabelableControl from '../../../test/fixtures/LabelableControl.vue';

describe('<Field.Item />', () => {
  const { render } = createRenderer();

  describeConformance(<Field.Item />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(<Field.Root>{node}</Field.Root>);
    },
  }));

  describe('prop: disabled', () => {
    it('reflects disabled state on the item', async () => {
      const renderItem = vi.fn();
      function renderFieldItem({ props, state }: { props: HTMLProps; state: Field.Item.State }) {
        renderItem(state);
        return <div {...props} />;
      }

      await render(
        <Field.Root>
          <Field.Item disabled data-testid="item" v-slots={{ render: renderFieldItem }} />
        </Field.Root>,
      );

      expect(screen.getByTestId('item')).toHaveAttribute('data-disabled');
      expect(renderItem.mock.lastCall?.[0].disabled).toBe(true);
    });

    it('is disabled by a disabled root, whatever its own prop says', async () => {
      await render(
        <Field.Root disabled>
          <Field.Item disabled={false} data-testid="item" />
        </Field.Root>,
      );

      expect(screen.getByTestId('item')).toHaveAttribute('data-disabled');
    });
  });

  it('has the state of the field', async () => {
    await render(
      <Field.Root invalid touched dirty>
        <Field.Item data-testid="item" />
      </Field.Root>,
    );

    expect(screen.getByTestId('item')).toHaveAttribute('data-invalid');
    expect(screen.getByTestId('item')).toHaveAttribute('data-touched');
    expect(screen.getByTestId('item')).toHaveAttribute('data-dirty');
  });

  // `Field.Control` takes its messages from the provider of the field. The case uses a fixture
  // control that reads the provider of the item, as a checkbox does.
  it('gives each item its own label, control and description', async () => {
    await render(
      <Field.Root>
        <Field.Description data-testid="field-description">Field description</Field.Description>
        <Field.Item>
          <Field.Label data-testid="first-label">First</Field.Label>
          <LabelableControl data-testid="first-control" />
          <Field.Description data-testid="first-description">First description</Field.Description>
        </Field.Item>
        <Field.Item>
          <Field.Label data-testid="second-label">Second</Field.Label>
          <LabelableControl data-testid="second-control" />
          <Field.Description data-testid="second-description">Second description</Field.Description>
        </Field.Item>
      </Field.Root>,
    );

    const firstControl = screen.getByTestId('first-control');
    const secondControl = screen.getByTestId('second-control');

    expect(firstControl.id).not.toBe(secondControl.id);
    expect(screen.getByTestId('first-label')).toHaveAttribute('for', firstControl.id);
    expect(screen.getByTestId('second-label')).toHaveAttribute('for', secondControl.id);
    expect(firstControl).toHaveAttribute('aria-labelledby', screen.getByTestId('first-label').id);
    expect(secondControl).toHaveAttribute('aria-labelledby', screen.getByTestId('second-label').id);
    // A control in an item also has the messages of the field.
    const fieldDescriptionId = screen.getByTestId('field-description').id;
    expect(firstControl).toHaveAttribute(
      'aria-describedby',
      `${fieldDescriptionId} ${screen.getByTestId('first-description').id}`,
    );
    expect(secondControl).toHaveAttribute(
      'aria-describedby',
      `${fieldDescriptionId} ${screen.getByTestId('second-description').id}`,
    );
  });

  // This case is the last one of the file. In Vue 3.5.12, a `setup` that throws leaves the current
  // instance set, and a later case that renders a slot gets a warning about that slot.
  it('throws a descriptive error when rendered outside <Field.Root>', async () => {
    await expect(render(<Field.Item />)).rejects.toThrow(
      'Vase UI: A part of Field must be inside <Field.Root>. Without a root the part has no field state to read. Put the part inside <Field.Root>.',
    );

    // Vue also warns about the error of `setup`.
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
