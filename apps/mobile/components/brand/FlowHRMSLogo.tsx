import React from 'react';
import Svg, { Rect, Path, Polygon, G, Text as SvgText } from 'react-native-svg';
import { FLOWACORD } from './FlowacordMark';

interface FlowHRMSLogoProps {
  width?: number;
  height?: number;
  variant?: 'light' | 'dark';
  showSubtitle?: boolean;
}

/**
 * Exact Vector ViewBox from apps/web/src/components/brand/FlowHRMSWordmark.tsx
 * and apps/web/public/brand/flowacord-logo-light.svg
 */
const VIEW_W = 612;
const VIEW_H = 113.84;
const BASELINE = 98.71;
const HRMS_X = 352;
const HRMS_SIZE = 80;

/**
 * Official FlowHRMS Brand Logo & Wordmark
 * Derived directly from apps/web/public/brand/flowacord-logo-light.svg & flowacord-logo-dark.svg
 * Identical vector geometry and proportions across web and mobile.
 */
export function FlowHRMSLogo({
  width,
  height,
  variant = 'light',
}: FlowHRMSLogoProps) {
  const isDark = variant === 'dark';

  // Compute proportional dimensions if only one is provided
  const finalWidth = width ?? (height ? (height * VIEW_W) / VIEW_H : 240);
  const finalHeight = height ?? (finalWidth * VIEW_H) / VIEW_W;

  const flowInk = isDark ? FLOWACORD.paper : FLOWACORD.navy;

  return (
    <Svg
      width={finalWidth}
      height={finalHeight}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="xMidYMid meet"
      fill="none"
    >
      {/* 1. Official Flowacord Icon Mark (Elements 0-5) */}
      <Rect
        fill={FLOWACORD.lavenderLight}
        width="32.79"
        height="32.79"
        rx="16.4"
        transform="translate(-6.79 16.4) rotate(-45)"
      />
      <Path
        fill={FLOWACORD.lavender}
        d="M28,45.32a16.4,16.4,0,0,0-23.19,0h0a16.4,16.4,0,0,0,0,23.19h0a16.39,16.39,0,0,0,23.19,0h0a16.39,16.39,0,0,0,0-23.19Z"
      />
      <Rect
        fill={FLOWACORD.purple}
        y="81.04"
        width="32.79"
        height="32.79"
        rx="16.4"
        transform="translate(-64.1 40.13) rotate(-45)"
      />
      <Rect
        fill={FLOWACORD.lavender}
        x="39.08"
        width="32.79"
        height="32.79"
        rx="16.4"
        transform="translate(4.65 44.03) rotate(-45)"
      />
      <Path
        fill={FLOWACORD.purple}
        d="M106.14,4.8h0A16.4,16.4,0,0,0,83,4.8h0A16.4,16.4,0,0,0,83,28h0a16.39,16.39,0,0,0,23.19,0h0A16.39,16.39,0,0,0,106.14,4.8Z"
      />
      <Path
        fill={FLOWACORD.lavender}
        d="M45.41,76.57V48.13a1.27,1.27,0,0,1,1.27-1.28H75.12A1.27,1.27,0,0,1,76,49L47.58,77.47A1.27,1.27,0,0,1,45.41,76.57Z"
      />

      {/* 2. Official Vector Outlined Glyphs for "Flow" (Elements 6-9) */}
      <G fill={flowInk}>
        {/* Letter F */}
        <Polygon points="122.96 98.71 140.63 98.71 144.33 72.21 168.67 72.21 171.03 55.57 146.69 55.57 148.23 44.48 176.48 44.48 178.84 27.84 132.93 27.84 122.96 98.71" />
        {/* Letter l */}
        <Path d="M204,24.75H187.37l-7.91,56.91c-1.64,11.3,3.9,17,16.64,17h5.75L204,83.51h-3.29c-3.18,0-4.72-1.65-4.21-4.62Z" />
        {/* Letter o */}
        <Path d="M240.88,45.09c-16.22,0-30.09,11.81-32.25,27.43s8.22,27.42,24.45,27.42,30.09-11.81,32.25-27.42S257,45.09,240.88,45.09Zm7.3,27.43a13,13,0,0,1-12.84,11.3c-6.47,0-10.48-4.83-9.66-11.3a13,13,0,0,1,12.84-11.3C245,61.22,249,66.05,248.18,72.52Z" />
        {/* Letter w */}
        <Path d="M333.77,45.77c2.54,6,.28,12.16-3,20.38l-4.52,10.68-4.52-30.51h-17l-13,30.41-4-30.41h-19l10.89,52.39h17.05l13.46-31.84,4.42,31.84h17l14.17-29c4.83-10,7.81-17.36,5.16-24Z" />
      </G>

      {/* 3. Product Identifier "HRMS" */}
      <SvgText
        x={HRMS_X}
        y={BASELINE}
        fill={FLOWACORD.lavender}
        fontWeight="800"
        fontStyle="italic"
        fontSize={HRMS_SIZE}
        letterSpacing="-0.5"
      >
        HRMS
      </SvgText>
    </Svg>
  );
}

export default FlowHRMSLogo;
