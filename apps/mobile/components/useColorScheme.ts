export type ColorScheme = 'light' | 'dark';

/**
 * FlowHRMS Color Scheme Hook
 * Defaults to 'light' (warm employee surface) to match the web employee portal.
 */
export const useColorScheme = (): ColorScheme => {
  return 'light';
};
