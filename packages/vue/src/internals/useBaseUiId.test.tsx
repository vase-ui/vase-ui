import { expect, describe, it } from 'vitest';
import { defineComponent } from 'vue';
import { createRenderer, screen } from '#test-utils';
import { useVaseUiId } from './useBaseUiId';

describe('useVaseUiId', () => {
  const { render } = createRenderer();

  const IdComponent = defineComponent(
    (props: { id?: string | undefined }) => {
      const id = useVaseUiId(() => props.id);
      const otherId = useVaseUiId();
      return () => (
        <div>
          <span data-testid="id" id={id.value} />
          <span data-testid="other-id" id={otherId.value} />
        </div>
      );
    },
    { props: ['id'] },
  );

  it('returns the override', async () => {
    await render(<IdComponent id="custom" />);

    expect(screen.getByTestId('id')).toHaveAttribute('id', 'custom');
  });

  it('returns a generated id that starts with vase-ui- and is not the id of another call', async () => {
    await render(<IdComponent />);

    const id = screen.getByTestId('id').id;
    const otherId = screen.getByTestId('other-id').id;
    expect(id).toMatch(/^vase-ui-./);
    expect(otherId).toMatch(/^vase-ui-./);
    expect(id).not.toBe(otherId);
  });

  it('follows a change of the override', async () => {
    const { setProps } = await render(<IdComponent />);
    const generatedId = screen.getByTestId('id').id;

    await setProps({ id: 'custom' });
    expect(screen.getByTestId('id')).toHaveAttribute('id', 'custom');

    await setProps({ id: undefined });
    expect(screen.getByTestId('id')).toHaveAttribute('id', generatedId);
  });
});
