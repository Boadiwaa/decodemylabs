import React, { useState } from 'react';
import { View, Text, Dimensions, StyleSheet } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { getSeverityConfig, getTrendChange } from '../utils/helpers';
import Colors from '../constants/colors';
import Typography from '../constants/typography';

const screenWidth = Dimensions.get('window').width - 64;

export default function TrendChart({ trend, severity }) {
  const [selectedPoint, setSelectedPoint] = useState(null);
  const sev = getSeverityConfig(severity);
  const labels = trend.values.map(v => v.date);
  const dataValues = trend.values.map(v => v.value);
  const trendChange = getTrendChange(trend.values);
  const trendLabel = trendChange.direction === 'up'
    ? `↑ Rising ${trendChange.pct}%`
    : trendChange.direction === 'down'
      ? `↓ Falling ${trendChange.pct}%`
      : '→ Stable';
  const trendColor = trendChange.direction === 'up'
    ? getSeverityConfig('danger')
    : trendChange.direction === 'down'
      ? getSeverityConfig('safe')
      : sev;

  const handleDataPointClick = (data) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedPoint({
      index: data.index,
      value: data.value,
      x: data.x,
      y: data.y,
    });
  };

  return (
    <Animated.View entering={FadeIn.delay(200)} style={styles.container}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text style={styles.title}>📈 3-Month Trend</Text>
        <View style={[styles.trendBadge, { backgroundColor: trendColor.bg }]}>
          <Text style={[styles.trendBadgeText, { color: trendColor.color }]}>
            {trendLabel}
          </Text>
        </View>
      </View>

      <View>
        <LineChart
          data={{
            labels,
            datasets: [{
              data: dataValues,
              color: () => sev.color,
              strokeWidth: 3,
            }],
          }}
          width={screenWidth}
          height={200}
          chartConfig={{
            backgroundColor: Colors.white,
            backgroundGradientFrom: Colors.white,
            backgroundGradientTo: Colors.white,
            decimalCount: trend.unit === '%' ? 1 : 0,
            color: () => sev.color,
            labelColor: () => Colors.textMuted,
            propsForDots: {
              r: '7',
              strokeWidth: '3',
              stroke: Colors.white,
              fill: sev.color,
            },
            propsForBackgroundLines: {
              strokeDasharray: '4,8',
              stroke: Colors.borderLight,
              strokeWidth: 1,
            },
            propsForLabels: {
              fontSize: 11,
              fontWeight: '600',
            },
            fillShadowGradientFrom: sev.color,
            fillShadowGradientTo: Colors.white,
            fillShadowGradientFromOpacity: 0.15,
            fillShadowGradientToOpacity: 0,
          }}
          bezier
          withInnerLines={true}
          withOuterLines={false}
          withVerticalLines={false}
          withShadow={true}
          onDataPointClick={handleDataPointClick}
          style={{ borderRadius: 14, marginLeft: -8 }}
          formatYLabel={(y) => `${y}${trend.unit === '%' ? '%' : ''}`}
        />

        {/* Selected point tooltip */}
        {selectedPoint && (
          <Animated.View
            entering={FadeIn.duration(150)}
            style={[styles.tooltip, {
              left: Math.min(Math.max(selectedPoint.x - 40, 0), screenWidth - 90),
              top: Math.max(selectedPoint.y - 52, 0),
              backgroundColor: sev.color,
            }]}
          >
            <Text style={styles.tooltipText}>
              {selectedPoint.value} {trend.unit}
            </Text>
            <Text style={styles.tooltipDate}>
              {labels[selectedPoint.index]} 2023
            </Text>
          </Animated.View>
        )}
      </View>

      <Text style={styles.hint}>Tap data points for details</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.white, borderRadius: 20, padding: 16,
    marginHorizontal: 16, marginTop: 12,
    borderWidth: 1, borderColor: Colors.borderLight,
    shadowColor: Colors.navy, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06, shadowRadius: 12, elevation: 3,
  },
  title: { fontFamily: Typography.serif, fontSize: 15, fontWeight: '700', color: Colors.navy },
  trendBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  trendBadgeText: { ...Typography.pill },
  tooltip: {
    position: 'absolute', paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 12, shadowColor: Colors.navy, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 8, elevation: 5, zIndex: 10,
  },
  tooltipText: { color: '#fff', fontSize: 13, fontWeight: '700', fontFamily: Typography.serif },
  tooltipDate: { color: 'rgba(255,255,255,0.8)', fontSize: 9, fontWeight: '600' },
  hint: { textAlign: 'center', ...Typography.caption, color: Colors.textMuted, fontSize: 10, marginTop: 8 },
});