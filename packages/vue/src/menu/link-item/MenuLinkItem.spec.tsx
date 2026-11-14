import { expectType } from '#test-utils';
import * as Menu from '../index.parts';

type RenderSlotProps = Parameters<
  NonNullable<InstanceType<typeof Menu.LinkItem>['$slots']['render']>
>[0];

// `Menu.LinkItem` exposes the native `<a>` props in its `#render` slot.
<Menu.LinkItem
  v-slots={{
    render: ({ props }: RenderSlotProps) => {
      expectType<string | undefined, typeof props.href>(props.href);
      return <a {...props} />;
    },
  }}
/>;
