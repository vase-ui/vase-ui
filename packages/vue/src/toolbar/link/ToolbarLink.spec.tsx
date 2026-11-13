import { expectType } from '#test-utils';
import { Toolbar } from '@vase-ui/vue/toolbar';

type RenderSlotProps = Parameters<
  NonNullable<InstanceType<typeof Toolbar.Link>['$slots']['render']>
>[0];

// `Toolbar.Link` exposes the native `<a>` props in its `#render` slot.
<Toolbar.Link
  v-slots={{
    render: ({ props }: RenderSlotProps) => {
      expectType<string | undefined, typeof props.href>(props.href);
      return <a {...props} />;
    },
  }}
/>;

export const nativeAttributes = <Toolbar.Link href="https://base-ui.com" target="_blank" />;
