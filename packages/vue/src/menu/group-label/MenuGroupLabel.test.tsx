import { afterEach, describe, expect, it } from 'vitest';
import { defineComponent, provide } from 'vue';
import type { PropType } from 'vue';
import * as Menu from '../index.parts';
import { createRenderer, describeConformance, screen, takeReportedMessages } from '#test-utils';
import { MenuGroupContext } from '../group/MenuGroupContext';

const TestGroupProvider = defineComponent((_, { slots }) => {
  provide(MenuGroupContext, () => {});
  return () => slots.default?.();
});

describe('<Menu.GroupLabel />', () => {
  const { render } = createRenderer();

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  });

  describeConformance(<Menu.GroupLabel />, () => ({
    render: (node) => {
      return render(<TestGroupProvider>{node}</TestGroupProvider>);
    },
    refInstanceof: window.HTMLDivElement,
  }));

  describe('a11y attributes', () => {
    it('is hidden from the accessibility tree by default', async () => {
      await render(
        <Menu.Root open>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Group>
                  <Menu.GroupLabel>Test group</Menu.GroupLabel>
                </Menu.Group>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const groupLabel = screen.getByText('Test group');
      expect(groupLabel).toHaveAttribute('aria-hidden', 'true');
    });

    it('allows overriding aria-hidden', async () => {
      await render(
        <Menu.Root open>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Group>
                  <Menu.GroupLabel aria-hidden={undefined}>Test group</Menu.GroupLabel>
                </Menu.Group>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const groupLabel = screen.getByText('Test group');
      expect(groupLabel).not.toHaveAttribute('aria-hidden');
    });

    it("should reference the generated id in Group's `aria-labelledby`", async () => {
      await render(
        <Menu.Root open>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Group>
                  <Menu.GroupLabel>Test group</Menu.GroupLabel>
                </Menu.Group>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const group = screen.getByRole('group');
      const groupLabel = screen.getByText('Test group');

      expect(group).toHaveAttribute('aria-labelledby', groupLabel.id);
    });

    it("should reference the provided id in Group's `aria-labelledby`", async () => {
      await render(
        <Menu.Root open>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Group>
                  <Menu.GroupLabel id="test-group">Test group</Menu.GroupLabel>
                </Menu.Group>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const group = screen.getByRole('group');
      expect(group).toHaveAttribute('aria-labelledby', 'test-group');
    });

    it("should reference the generated id in RadioGroup's `aria-labelledby`", async () => {
      await render(
        <Menu.Root open>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.RadioGroup>
                  <Menu.GroupLabel>Test group</Menu.GroupLabel>
                </Menu.RadioGroup>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const radioGroup = screen.getByRole('group');
      const groupLabel = screen.getByText('Test group');

      expect(radioGroup).toHaveAttribute('aria-labelledby', groupLabel.id);
    });

    it("should reference the provided id in RadioGroup's `aria-labelledby`", async () => {
      await render(
        <Menu.Root open>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.RadioGroup>
                  <Menu.GroupLabel id="test-group">Test group</Menu.GroupLabel>
                </Menu.RadioGroup>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const radioGroup = screen.getByRole('group');
      expect(radioGroup).toHaveAttribute('aria-labelledby', 'test-group');
    });

    it('should support GroupLabel when RadioGroup is rendered as Group', async () => {
      await render(
        <Menu.Root open>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Group as={Menu.RadioGroup}>
                  <Menu.GroupLabel>Test group</Menu.GroupLabel>
                </Menu.Group>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const radioGroup = screen.getByRole('group');
      const groupLabel = screen.getByText('Test group');

      expect(radioGroup).toHaveAttribute('aria-labelledby', groupLabel.id);
    });

    it('does not let an older label cleanup clear a newer label', async () => {
      const Test = defineComponent({
        props: { labels: { type: String as PropType<'old' | 'both' | 'new'>, required: true } },
        setup(props) {
          return () => (
            <Menu.Root open>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup>
                    <Menu.Group>
                      {props.labels !== 'new' && (
                        <Menu.GroupLabel key="old" id="old-label">
                          Old
                        </Menu.GroupLabel>
                      )}
                      {props.labels !== 'old' && (
                        <Menu.GroupLabel key="new" id="new-label">
                          New
                        </Menu.GroupLabel>
                      )}
                    </Menu.Group>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          );
        },
      });

      const { setProps } = await render(() => <Test labels="old" />);

      const group = screen.getByRole('group');
      expect(group).toHaveAttribute('aria-labelledby', 'old-label');

      await setProps({ labels: 'both' });
      expect(group).toHaveAttribute('aria-labelledby', 'new-label');

      await setProps({ labels: 'new' });
      expect(group).toHaveAttribute('aria-labelledby', 'new-label');
    });
  });

  it('throws when rendered outside Menu.Group or Menu.RadioGroup', async () => {
    await expect(render(<Menu.GroupLabel />)).rejects.toThrow(
      'Vase UI: <Menu.GroupLabel> must be inside <Menu.Group> or <Menu.RadioGroup>. Without a group the label has no group to name. Put the label inside <Menu.Group> or <Menu.RadioGroup>.',
    );

    // Vue also warns about the error of `setup`.
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
