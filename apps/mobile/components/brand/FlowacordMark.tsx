import React from 'react';
import Svg, { Rect, Path } from 'react-native-svg';

export const FLOWACORD = {
  lavenderLight: '#CEB4F5',
  lavender: '#9F8EF4',
  purple: '#7166F3',
  navy: '#34327F',
  ground: '#010123',
  paper: '#F5F5F5',
} as const;

/**
 * Exact Vector ViewBox from apps/web/public/brand/flowacord-mark.svg
 */
export const MARK_VIEWBOX = '0 0 366.57 376.12';

/**
 * Flowacord Brand Mark (Icon Only)
 * Exact vector geometry from apps/web/public/brand/flowacord-mark.svg
 */
export function FlowacordMark({ size = 26 }: { size?: number }) {
  const height = size * (376.12 / 366.57);
  return (
    <Svg width={size} height={height} viewBox={MARK_VIEWBOX} fill="none">
      {/* 1. Top left pill */}
      <Rect
        fill={FLOWACORD.lavenderLight}
        width={108.35}
        height={108.35}
        rx={54.18}
        transform="translate(-22.44 54.18) rotate(-45)"
      />
      {/* 2. Middle left pill */}
      <Path
        fill={FLOWACORD.lavender}
        d="M92.49,149.75a54.17,54.17,0,0,0-76.62,0h0a54.17,54.17,0,0,0,0,76.62h0a54.17,54.17,0,0,0,76.62,0h0a54.19,54.19,0,0,0,0-76.62Z"
      />
      {/* 3. Bottom left pill */}
      <Rect
        fill={FLOWACORD.purple}
        y={267.77}
        width={108.35}
        height={108.35}
        rx={54.18}
        transform="translate(-211.78 132.6) rotate(-45)"
      />
      {/* 4. Center-top pill */}
      <Rect
        fill={FLOWACORD.lavender}
        x={129.11}
        width={108.35}
        height={108.35}
        rx={54.18}
        transform="translate(15.37 145.47) rotate(-45)"
      />
      {/* 5. Top right pill */}
      <Path
        fill={FLOWACORD.purple}
        d="M350.7,15.87h0a54.17,54.17,0,0,0-76.62,0h0a54.19,54.19,0,0,0,0,76.62h0a54.19,54.19,0,0,0,76.62,0h0A54.17,54.17,0,0,0,350.7,15.87Z"
      />
      {/* 6. Arrow polygon */}
      <Path
        fill={FLOWACORD.lavender}
        d="M150,253V159a4.21,4.21,0,0,1,4.21-4.21h94a4.21,4.21,0,0,1,3,7.19l-94,94A4.21,4.21,0,0,1,150,253Z"
      />
    </Svg>
  );
}

export default FlowacordMark;
