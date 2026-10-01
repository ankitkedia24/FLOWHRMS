/**
 * Colors constant — legacy compatibility shim.
 * New code should import from Theme.ts directly using getTheme().
 * This file maps the old Colors.light / Colors.dark shape to the
 * canonical FlowHRMS token values.
 */
import { FlowTheme, FlowThemeDark } from './Theme';

const light = FlowTheme.colors;
const dark = FlowThemeDark.colors;

export default {
  light: {
    text: light.textPrimary,
    background: light.surfaceCanvasWarm,
    card: light.surfaceDefault,
    tint: light.brandPrimary,
    tabIconDefault: light.textTertiary,
    tabIconSelected: light.brandPrimary,
    border: light.borderDefault,
    success: light.status.success.fg,
  },
  dark: {
    text: dark.textPrimary,
    background: dark.surfaceCanvas,
    card: dark.surfaceDefault,
    tint: dark.brandPrimary,
    tabIconDefault: dark.textTertiary,
    tabIconSelected: dark.brandPrimary,
    border: dark.borderDefault,
    success: dark.status.success.fg,
  },
};
