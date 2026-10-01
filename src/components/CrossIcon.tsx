import Svg, { Rect } from 'react-native-svg';

import { colors } from '@/theme';

type Props = { size?: number; color?: string; opacity?: number };

// Simplified Ethiopian cross: two bars with diagonal ornament squares.
export function CrossIcon({ size = 32, color = colors.gold, opacity = 1 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" opacity={opacity}>
      <Rect x={14} y={2} width={4} height={28} fill={color} />
      <Rect x={2} y={14} width={28} height={4} fill={color} />
      {[
        [11, 11], [19, 11], [11, 19], [19, 19],
        [8, 8], [22, 8], [8, 22], [22, 22],
      ].map(([x, y]) => (
        <Rect key={`${x}-${y}`} x={x} y={y} width={2} height={2} fill={color} />
      ))}
    </Svg>
  );
}
