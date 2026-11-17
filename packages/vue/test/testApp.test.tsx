import { expect, it, vi } from 'vitest';
import { createApp, defineComponent, getCurrentInstance } from 'vue';
import type { ComponentInternalInstance } from 'vue';
import { createRenderer, installPartsInterop, isVaporApp, isVaporParts } from '#test-utils';

const { render } = createRenderer();

it('mounts the test in a Vapor app only in the Vapor projects', async ({ task }) => {
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
    task.file.projectName === 'vapor' || task.file.projectName === 'vapor-parts',
  );
});

it('reports the component mode of the project', ({ task }) => {
  expect(isVaporParts).toBe(task.file.projectName === 'vapor-parts');
  expect(isVaporApp).toBe(
    task.file.projectName === 'vapor' || task.file.projectName === 'vapor-parts',
  );
});

it('installs interop on an ordinary app only for Vapor parts, and returns that app', () => {
  const app = createApp({ render: () => <span /> });
  const use = vi.spyOn(app, 'use');

  expect(installPartsInterop(app)).toBe(app);
  expect(use).toHaveBeenCalledTimes(isVaporParts ? 1 : 0);
});
