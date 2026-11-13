import { expectType } from '#test-utils';
import { NavigationMenu } from '@vase-ui/vue/navigation-menu';

type RenderSlotProps = Parameters<
  NonNullable<InstanceType<typeof NavigationMenu.Link>['$slots']['render']>
>[0];

// `NavigationMenu.Link` exposes the native `<a>` props in its `#render` slot.
<NavigationMenu.Link
  v-slots={{
    render: ({ props }: RenderSlotProps) => {
      expectType<string | undefined, typeof props.href>(props.href);
      return <a {...props} />;
    },
  }}
/>;
