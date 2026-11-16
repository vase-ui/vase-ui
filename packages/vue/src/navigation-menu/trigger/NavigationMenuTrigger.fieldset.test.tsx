import { NavigationMenu } from '@vase-ui/vue/navigation-menu';
import { fieldsetDisabledTests } from '../../../test/fieldsetDisabledTests';

fieldsetDisabledTests({
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
