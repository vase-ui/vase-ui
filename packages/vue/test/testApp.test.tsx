import { expect, it } from 'vitest';
import { defineComponent, getCurrentInstance } from 'vue';
import type { ComponentInternalInstance } from 'vue';
import { createRenderer } from '#test-utils';

const { render } = createRenderer();

it('mounts the test in a Vapor app only in the project `vapor`', async ({ task }) => {
  let root: ComponentInternalInstance | null = null;
  const Probe = defineComponent({
    setup() {
      root = getCurrentInstance();
      while (root?.parent) {
        root = root.parent;
      }
      return () => <span />;
    },
  });

  await render(<Probe />);

  // The instance of a Vapor component has `vapor: true`.
  expect((root as { vapor?: boolean } | null)?.vapor === true).toBe(
    task.file.projectName === 'vapor',
  );
});
