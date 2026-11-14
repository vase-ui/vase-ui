import { expect, describe, it } from 'vitest';
import * as Combobox from '../index.parts';
import { createRenderer, describeConformance, screen, waitFor } from '#test-utils';

describe('<Combobox.Group />', () => {
  const { render } = createRenderer();

  describeConformance(<Combobox.Group />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(<Combobox.Root open>{node}</Combobox.Root>);
    },
  }));

  it('should render group with label', async () => {
    // The input anchors the positioner. A positioner with no position has `opacity: 0`.
    await render(
      <Combobox.Root open>
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Group>
              <Combobox.GroupLabel>Fruits</Combobox.GroupLabel>
              <Combobox.Item value="apple">Apple</Combobox.Item>
              <Combobox.Item value="banana">Banana</Combobox.Item>
            </Combobox.Group>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );

    expect(screen.getByRole('group')).toHaveAttribute('aria-labelledby');
    await waitFor(() => expect(screen.getByText('Fruits')).toBeVisible());
  });

  it('should associate label with group', async () => {
    await render(
      <Combobox.Root open>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Group>
              <Combobox.GroupLabel>Vegetables</Combobox.GroupLabel>
              <Combobox.Item value="carrot">Carrot</Combobox.Item>
              <Combobox.Item value="lettuce">Lettuce</Combobox.Item>
            </Combobox.Group>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );

    const Group = screen.getByRole('group');
    const label = screen.getByText('Vegetables');
    expect(Group).toHaveAttribute('aria-labelledby', label.id);
  });

  describe('Vue form of the group', () => {
    it('has the rowgroup role in a grid', async () => {
      await render(
        <Combobox.Root open grid>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Group data-testid="group">
                    <Combobox.Row>
                      <Combobox.Item value="a">a</Combobox.Item>
                    </Combobox.Row>
                  </Combobox.Group>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      expect(screen.getByTestId('group')).toHaveAttribute('role', 'rowgroup');
    });
  });
});
