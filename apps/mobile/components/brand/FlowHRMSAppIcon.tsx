import React from 'react';
import Svg, { Rect, Path, G } from 'react-native-svg';
import { FLOWACORD } from './FlowacordMark';

interface FlowHRMSAppIconProps {
  size?: number;
  rounded?: boolean;
}

/**
 * FlowHRMS App Icon
 * Exact vector geometry from apps/web/public/brand/flowhrms-app-icon.svg
 */
export function FlowHRMSAppIcon({ size = 48, rounded = true }: FlowHRMSAppIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 488.96 488.96" fill="none">
      <Rect
        width={488.96}
        height={488.96}
        rx={rounded ? 88.01 : 0}
        fill={FLOWACORD.ground}
      />
      <G transform="translate(61.19, 56.42)">
        <Rect
          fill={FLOWACORD.lavenderLight}
          width={108.35}
          height={108.35}
          rx={54.18}
          transform="translate(-22.44, 54.18) rotate(-45)"
        />
        <Path
          fill={FLOWACORD.lavender}
          d="M92.49,149.75a54.17,54.17,0,0,0-76.62,0h0a54.17,54.17,0,0,0,0,76.62h0a54.17,54.17,0,0,0,76.62,0h0a54.19,54.19,0,0,0,0-76.62Z"
        />
        <Rect
          fill={FLOWACORD.purple}
          y={267.77}
          width={108.35}
          height={108.35}
          rx={54.18}
          transform="translate(-211.78, 132.6) rotate(-45)"
        />
        <Rect
          fill={FLOWACORD.lavender}
          x={129.11}
          width={108.35}
          height={108.35}
          rx={54.18}
          transform="translate(15.37, 145.47) rotate(-45)"
        />
        <Path
          fill={FLOWACORD.purple}
          d="M350.7,15.87h0a54.17,54.17,0,0,0-76.62,0h0a54.19,54.19,0,0,0,0,76.62h0a54.19,54.19,0,0,0,76.62,0h0A54.17,54.17,0,0,0,350.7,15.87Z"
        />
        <Path
          fill={FLOWACORD.lavender}
          d="M150,253V159a4.21,4.21,0,0,1,4.21-4.21h94a4.21,4.21,0,0,1,3,7.19l-94,94A4.21,4.21,0,0,1,150,253Z"
        />
      </G>
    </Svg>
  );
}

export default FlowHRMSAppIcon;
