/**
 * QrCode — draws a QR code for a short text with react-native-svg. Generated
 * on the phone; the text isn't sent anywhere.
 */

import React, { useMemo } from 'react';
import Svg, { Path, Rect } from 'react-native-svg';
import qrcode from 'qrcode-generator';

// Encode as UTF-8 so names and units such as "Ɛfua" and "µmol/L" scan correctly.
qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];

const QUIET_ZONE = 4; // blank border, in modules, that scanners need

/**
 * @param {object} props
 * @param {string} props.value - Text to encode
 * @param {number} props.size - Width and height in points
 * @param {string} [props.accessibilityLabel]
 */
export default function QrCode({ value, size, accessibilityLabel }) {
  const { path, count } = useMemo(() => {
    // Error correction 'L': shown on a screen, not printed, so the least dense code scans best.
    const qr = qrcode(0, 'L');
    qr.addData(value, 'Byte');
    qr.make();
    const n = qr.getModuleCount();
    let d = '';
    for (let row = 0; row < n; row += 1) {
      for (let col = 0; col < n; col += 1) {
        if (qr.isDark(row, col)) d += `M${col + QUIET_ZONE} ${row + QUIET_ZONE}h1v1h-1z`;
      }
    }
    return { path: d, count: n + QUIET_ZONE * 2 };
  }, [value]);

  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${count} ${count}`}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <Rect x={0} y={0} width={count} height={count} fill="#FFFFFF" />
      <Path d={path} fill="#000000" />
    </Svg>
  );
}
