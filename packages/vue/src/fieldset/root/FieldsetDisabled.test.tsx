import { describe, expect, it } from 'vitest';
import { defineComponent, nextTick, shallowRef } from 'vue';
import { Fieldset } from '@vase-ui/vue/fieldset';
import { createRenderer, screen, within } from '#test-utils';
import { recordVueWarnings } from '../../../test/reportedMessages';
import { createTestApp } from '../../../test/testApp';

type RenderSlotProps = { props: Record<string, unknown> };

describe('Fieldset disabled bindings', () => {
  const { render } = createRenderer();

  it('gives the render slot a Boolean disabled prop', async () => {
    await render(() => (
      <Fieldset.Root
        disabled
        v-slots={{
          render: ({ props }: RenderSlotProps) => (
            <button {...props} disabled={props.disabled === true}>
              Save
            </button>
          ),
        }}
      />
    ));

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('gives a component selected by name a Boolean disabled prop', async () => {
    const SaveButton = defineComponent(
      (props: { disabled?: boolean }) => () => (
        <button disabled={props.disabled === true}>Save</button>
      ),
      { props: ['disabled'] },
    );
    const target = shallowRef('fieldset');
    const app = createTestApp({ render: () => <Fieldset.Root as={target.value} disabled /> });
    app.component('SaveButton', SaveButton);
    recordVueWarnings(app);
    const container = document.createElement('div');
    document.body.append(container);
    try {
      app.mount(container);
      expect(within(container).getByRole('group')).toBeDisabled();
      target.value = 'SaveButton';
      await nextTick();
      expect(within(container).getByRole('button', { name: 'Save' })).toBeDisabled();
    } finally {
      app.unmount();
      container.remove();
    }
  });

  it('uses an empty disabled attribute on a disabled div', async () => {
    await render(<Fieldset.Root as="div" disabled data-testid="root" />);

    expect(screen.getByTestId('root')).toHaveAttribute('disabled', '');
  });
});
