import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

export const MARK_VIEWBOX = '0 0 366.57 376.12';

export const FLOWACORD = {
  lavenderLight: '#CEB4F5',
  lavender: '#9F8EF4',
  purple: '#7166F3',
  navy: '#34327F',
  ground: '#010123',
  paper: '#F5F5F5',
} as const;

export const MARK_DOTS: ReadonlyArray<readonly [number, number, string]> = [
  [54.18, 54.18, FLOWACORD.lavenderLight],
  [183.29, 54.18, FLOWACORD.lavender],
  [312.39, 54.18, FLOWACORD.purple],
  [54.18, 188.06, FLOWACORD.lavender],
  [54.18, 321.94, FLOWACORD.purple],
];
export const MARK_RADIUS = 54.18;
export const MARK_ARROW =
  'M150,253V159a4.21,4.21,0,0,1,4.21-4.21h94a4.21,4.21,0,0,1,3,7.19l-94,94A4.21,4.21,0,0,1,150,253Z';

export function FlowacordMark({ size = 26 }: { size?: number }) {
  const height = size * (376.12 / 366.57);
  return (
    <Svg width={size} height={height} viewBox={MARK_VIEWBOX}>
      {MARK_DOTS.map(([cx, cy, fill], index) => (
        <Circle key={index} cx={cx} cy={cy} r={MARK_RADIUS} fill={fill} />
      ))}
      <Path d={MARK_ARROW} fill={FLOWACORD.lavender} />
    </Svg>
  );
}
