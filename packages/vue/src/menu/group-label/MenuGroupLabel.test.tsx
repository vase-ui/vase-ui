import { describe, expect, it } from 'vitest';
import { defineComponent, provide, shallowRef } from 'vue';
import { Menu } from '@vase-ui/vue/menu';
import {
  createRenderer,
  describeConformance,
  flushMicrotasks,
  screen,
  takeReportedMessages,
} from '#test-utils';
import { MenuGroupContext } from '../group/MenuGroupContext';

const testContext: MenuGroupContext = () => {};

const TestGroup = defineComponent((_, { slots }) => {
  provide(MenuGroupContext, testContext);
  return () => slots.default?.();
});

describe('<Menu.GroupLabel />', () => {
  const { render } = createRenderer();

  describeConformance(<Menu.GroupLabel />, () => ({
    render: (node) => {
      return render(<TestGroup>{node}</TestGroup>);
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

      expect(groupLabel.id).not.toBe('');
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

    it('does not let an older label cleanup clear a newer label', async () => {
      const labels = shallowRef<'old' | 'both' | 'new'>('old');

      await render(() => (
        <Menu.Root open>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Group>
                  {labels.value !== 'new' && (
                    <Menu.GroupLabel key="old" id="old-label">
                      Old
                    </Menu.GroupLabel>
                  )}
                  {labels.value !== 'old' && (
                    <Menu.GroupLabel key="new" id="new-label">
                      New
                    </Menu.GroupLabel>
                  )}
                </Menu.Group>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));

      const group = screen.getByRole('group');
      expect(group).toHaveAttribute('aria-labelledby', 'old-label');

      labels.value = 'both';
      await flushMicrotasks();
      expect(group).toHaveAttribute('aria-labelledby', 'new-label');

      labels.value = 'new';
      await flushMicrotasks();
      expect(group).toHaveAttribute('aria-labelledby', 'new-label');
    });
  });

  // This case is the last one of the file. In Vue 3.5.12, a `setup` that throws leaves the current
  // instance set, and each later case of the file then gets a warning about a slot.
  it('throws when rendered outside Menu.Group or Menu.RadioGroup', async () => {
    await expect(render(<Menu.GroupLabel />)).rejects.toThrow(
      'Vase UI: <Menu.GroupLabel> must be inside <Menu.Group>. Without a group the label has no group to name. Put the label inside <Menu.Group>.',
    );

    // Vue also warns about the error of `setup`.
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
