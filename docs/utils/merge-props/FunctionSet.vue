<script setup lang="ts">
import { mergeProps } from '@vase-ui/vue/merge-props';

// #region function
mergeProps<'button'>(
  {
    onClick() {
      // Handler from previous props
    },
  },
  (props) => ({
    onClick(event) {
      // Manually call the previous handler
      props.onClick?.(event);
      // Your logic here
    },
  }),
);
// #endregion function
</script>
