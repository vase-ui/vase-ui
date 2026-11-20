export interface CSPProviderProps {
  /**
   * The nonce value to apply to inline `<style>` and `<script>` tags.
   */
  nonce?: string | undefined;
  /**
   * Whether inline `<style>` elements created by Vase UI components should not be rendered. Instead, components must specify the CSS styles via custom class names or other methods.
   * @default false
   */
  disableStyleElements?: boolean | undefined;
}

export interface CSPProviderState {}
