export interface CSPProviderProps {
  /** The `nonce` attribute of the inline `<style>` and `<script>` elements of the parts. */
  nonce?: string | undefined;
  /**
   * The parts render no inline `<style>` element. Put the rules of each such element in your own
   * style sheet.
   * @default false
   */
  disableStyleElements?: boolean | undefined;
}

export interface CSPProviderState {}
