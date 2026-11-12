import { Avatar } from '@vase-ui/vue/avatar';
import type { ImageLoadingStatus } from '@vase-ui/vue/avatar';
import { expectType } from '#test-utils';

// TypeScript cannot infer the parameter of a `v-slots` function, so the types come from the slots.
type RenderSlotProps<Slots extends { render?: (...args: any[]) => any }> = Parameters<
  NonNullable<Slots['render']>
>[0];
type RootRenderProps = RenderSlotProps<InstanceType<typeof Avatar.Root>['$slots']>;
type ImageRenderProps = RenderSlotProps<InstanceType<typeof Avatar.Image>['$slots']>;
type FallbackRenderProps = RenderSlotProps<InstanceType<typeof Avatar.Fallback>['$slots']>;

// `Avatar.Image` accepts and forwards the native responsive/loading `<img>` props.
<Avatar.Root
  v-slots={{
    render: ({ props, state }: RootRenderProps) => {
      expectType<ImageLoadingStatus, typeof state.imageLoadingStatus>(state.imageLoadingStatus);
      return <span {...props} />;
    },
  }}
>
  <Avatar.Image
    crossorigin="anonymous"
    keepMounted
    referrerpolicy="no-referrer"
    sizes="48px"
    srcset="avatar.png 1x, avatar@2x.png 2x"
    onLoadingStatusChange={(status) => {
      expectType<ImageLoadingStatus, typeof status>(status);
    }}
    v-slots={{
      render: ({ props, state }: ImageRenderProps) => {
        expectType<string | undefined, typeof props.src>(props.src);
        expectType<string | undefined, typeof props.alt>(props.alt);
        expectType<ImageLoadingStatus, typeof state.imageLoadingStatus>(state.imageLoadingStatus);
        return <img alt="" {...props} />;
      },
    }}
  />
  <Avatar.Fallback
    delay={100}
    v-slots={{
      render: ({ props, state }: FallbackRenderProps) => {
        expectType<ImageLoadingStatus, typeof state.imageLoadingStatus>(state.imageLoadingStatus);
        return <span {...props} />;
      },
    }}
  />
</Avatar.Root>;
