/**
 * MarkdownText — renders simple inline markdown as styled React Native <Text>.
 *
 * Supported syntax:
 *   **bold text**  → fontWeight 700
 *   *italic text*  → fontStyle italic
 *
 * Everything else renders as plain text.
 * Accepts the same props as <Text> (style, numberOfLines, etc.).
 */

import React from 'react';
import { Text } from 'react-native';

/**
 * Split a string into an array of segments:
 *   { text, bold, italic }
 *
 * Handles **bold**, *italic*, and plain text.
 */
function parseMarkdown(input) {
  if (!input) return [];

  const segments = [];
  // Regex: match **bold** first (greedy-safe), then *italic*
  const pattern = /\*\*(.+?)\*\*|\*(.+?)\*/g;
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(input)) !== null) {
    // Push any plain text before this match
    if (match.index > lastIndex) {
      segments.push({ text: input.slice(lastIndex, match.index) });
    }

    if (match[1] !== undefined) {
      // **bold**
      segments.push({ text: match[1], bold: true });
    } else if (match[2] !== undefined) {
      // *italic*
      segments.push({ text: match[2], italic: true });
    }

    lastIndex = pattern.lastIndex;
  }

  // Trailing plain text
  if (lastIndex < input.length) {
    segments.push({ text: input.slice(lastIndex) });
  }

  return segments;
}

export default function MarkdownText({ children, style, ...rest }) {
  const raw = typeof children === 'string' ? children : '';

  // Fast path — no markdown markers at all
  if (!raw.includes('*')) {
    return <Text style={style} {...rest}>{raw}</Text>;
  }

  const segments = parseMarkdown(raw);

  return (
    <Text style={style} {...rest}>
      {segments.map((seg, i) => {
        if (seg.bold) {
          return (
            <Text key={i} style={{ fontWeight: '700' }}>
              {seg.text}
            </Text>
          );
        }
        if (seg.italic) {
          return (
            <Text key={i} style={{ fontStyle: 'italic' }}>
              {seg.text}
            </Text>
          );
        }
        return seg.text;
      })}
    </Text>
  );
}
