import { expectType } from '#test-utils';
import * as NavigationMenu from '../index.parts';

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
