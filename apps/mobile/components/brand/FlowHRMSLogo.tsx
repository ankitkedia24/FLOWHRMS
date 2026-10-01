import React from 'react';
import Svg, { G, Circle, Text, TSpan } from 'react-native-svg';

interface FlowHRMSLogoProps {
  width?: number;
  height?: number;
  variant?: 'light' | 'dark';
  showSubtitle?: boolean;
}

/**
 * FlowHRMS Vector Logo
 * Exact vector asset from Stitch project "FlowHRMS Mobile design"
 * (Source: screens/d769cff7fac141ccb8b7924848a7b60c)
 */
export function FlowHRMSLogo({
  width = 180,
  height = 45,
  variant = 'light',
  showSubtitle = true,
}: FlowHRMSLogoProps) {
  const isDark = variant === 'dark';

  // In dark mode: white text with lavender highlight. In light mode: deep midnight navy with electric indigo.
  const titleColor = isDark ? '#FFFFFF' : '#181445';
  const subtitleColor = isDark ? '#94A3B8' : '#6B7280';
  const accentColor = isDark ? '#A5B4FC' : '#4F46E5';

  return (
    <Svg
      width={width}
      height={height}
      viewBox="0 0 240 60"
      fill="none"
    >
      {/* 5-node Flow cluster brand mark */}
      <G transform="translate(10, 8)">
        <Circle cx="10" cy="12" r="5.5" fill={isDark ? '#818CF8' : '#6366F1'} />
        <Circle cx="10" cy="28" r="5.5" fill={isDark ? '#A5B4FC' : '#818CF8'} />
        <Circle cx="26" cy="12" r="5.5" fill={isDark ? '#6366F1' : '#4F46E5'} />
        <Circle cx="26" cy="28" r="5.5" fill={isDark ? '#818CF8' : '#6366F1'} />
        <Circle cx="42" cy="20" r="5.5" fill={isDark ? '#C7D2FE' : '#4338CA'} />
      </G>

      {/* Brand typography */}
      <Text
        x="72"
        y="32"
        fontFamily="Plus Jakarta Sans, system-ui, -apple-system, sans-serif"
        fontSize="24"
        fontWeight="800"
        letterSpacing="-0.5"
        fill={titleColor}
      >
        Flow
        <TSpan fontWeight="900" fill={accentColor}>
          HRMS
        </TSpan>
      </Text>

      {showSubtitle && (
        <Text
          x="73"
          y="46"
          fontFamily="Plus Jakarta Sans, system-ui, -apple-system, sans-serif"
          fontSize="10"
          fontWeight="500"
          letterSpacing="0.2"
          fill={subtitleColor}
        >
          by Flowacord
        </Text>
      )}
    </Svg>
  );
}

export default FlowHRMSLogo;
