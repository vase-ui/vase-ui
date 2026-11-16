import { NavigationMenu } from '@vase-ui/vue/navigation-menu';
import { createRenderer, fieldsetDisabledTests } from '#test-utils';

const { render } = createRenderer();

fieldsetDisabledTests({
  render,
  part: (props, slots) => (
    <NavigationMenu.Item value={props['data-testid']}>
      <NavigationMenu.Trigger {...props} v-slots={slots} />
    </NavigationMenu.Item>
  ),
  root: (children) => (
    <NavigationMenu.Root delay={100}>
      <NavigationMenu.List>{children}</NavigationMenu.List>
    </NavigationMenu.Root>
  ),
  hover: true,
});
