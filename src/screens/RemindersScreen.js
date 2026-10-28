import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { patients } from '../data/mockData';
import { formatDate, daysUntil } from '../utils/helpers';
import Colors from '../constants/colors';
import Typography from '../constants/typography';

export default function RemindersScreen() {
  const { currentPatientId } = useAuth();
  const insets = useSafeAreaInsets();

  // Reminders are not stored on-device yet. The demo reminders in mockData
  // belong to a sample patient, so they are not shown as the user's own.
  const storedReminders = [];
  const filteredReminders = storedReminders.filter(r => r.patient_id === currentPatientId);

  // Sort reminders by due date
  const sortedReminders = [...filteredReminders].sort(
    (a, b) => new Date(a.due_date) - new Date(b.due_date)
  );

  const overdue = sortedReminders.filter(r => daysUntil(r.due_date) < 0);
  const upcoming = sortedReminders.filter(r => daysUntil(r.due_date) >= 0 && daysUntil(r.due_date) <= 7);
  const later = sortedReminders.filter(r => daysUntil(r.due_date) > 7);

  const renderReminder = (reminder, index) => {
    const p = patients.find(pt => pt.id === reminder.patient_id);
    const days = daysUntil(reminder.due_date);
    const isOverdue = days < 0;
    const isUrgent = days >= 0 && days <= 3;

    return (
      <Animated.View
        key={reminder.id}
        entering={FadeInDown.delay(100 + index * 60).springify().damping(18)}
      >
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
          style={styles.reminderCard}
        >
          <View style={[styles.reminderIcon, {
            backgroundColor: isOverdue ? Colors.dangerBg : isUrgent ? Colors.warnBg : Colors.tealLight,
          }]}>
            <Ionicons
              name={isOverdue ? 'alert-circle' : 'calendar'}
              size={20}
              color={isOverdue ? Colors.danger : isUrgent ? Colors.warn : Colors.tealDark}
            />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.reminderTest}>{reminder.test_name}</Text>
              {isOverdue && (
                <View style={styles.overdueBadge}>
                  <Text style={styles.overdueBadgeText}>Overdue</Text>
                </View>
              )}
            </View>\n            <Text style={styles.reminderDate}>
              {formatDate(reminder.due_date)} · {isOverdue
                ? `${Math.abs(days)} days overdue`
                : days === 0
                  ? 'Today'
                  : `${days} day${days !== 1 ? 's' : ''} away`}
            </Text>
            <Text style={styles.reminderMessage}>{reminder.message}</Text>
          </View>
          <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderSection = (title, items, icon) => {
    if (items.length === 0) return null;
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name={icon} size={14} color={Colors.textMuted} />
          <Text style={styles.sectionTitle}>{title}</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{items.length}</Text>
          </View>
        </View>
        {items.map((r, i) => renderReminder(r, i))}
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      {/* Header */}
      <Animated.View entering={FadeIn} style={[styles.header, { paddingTop: insets.top + 4 }]}>
        <View>
          <Text style={styles.headerTitle}>Reminders</Text>
          <Text style={styles.headerSub}>
            Your upcoming tests
          </Text>
        </View>
        <View style={[styles.roleBadge, { backgroundColor: Colors.tealLight }]}>
          <Ionicons
            name="person"
            size={14}
            color={Colors.tealDark}
          />
        </View>
      </Animated.View>

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* Summary card */}
        <Animated.View entering={FadeInDown.delay(50).springify()} style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={[styles.summaryItem, { borderRightWidth: 1, borderRightColor: Colors.borderLight }]}>
              <Text style={[styles.summaryValue, { color: Colors.danger }]}>{overdue.length}</Text>
              <Text style={styles.summaryLabel}>Overdue</Text>
            </View>
            <View style={[styles.summaryItem, { borderRightWidth: 1, borderRightColor: Colors.borderLight }]}>
              <Text style={[styles.summaryValue, { color: Colors.warn }]}>{upcoming.length}</Text>
              <Text style={styles.summaryLabel}>This week</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: Colors.tealDark }]}>{later.length}</Text>
              <Text style={styles.summaryLabel}>Scheduled</Text>
            </View>
          </View>
        </Animated.View>

        {renderSection('Overdue', overdue, 'alert-circle-outline')}
        {renderSection('This week', upcoming, 'time-outline')}
        {renderSection('Scheduled', later, 'calendar-outline')}

        {sortedReminders.length === 0 && (
          <Animated.View entering={FadeIn.delay(200)} style={styles.emptyState}>
            <Ionicons name="checkmark-circle" size={48} color={Colors.tealMuted} />
            <Text style={styles.emptyTitle}>All caught up!</Text>
            <Text style={styles.emptyDesc}>No upcoming reminders.</Text>
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 14,
    backgroundColor: Colors.tealLight,
    borderBottomWidth: 1, borderBottomColor: Colors.tealMuted,
  },
  headerTitle: { ...Typography.h3, color: Colors.navy },
  headerSub: { ...Typography.labelSmall, color: Colors.textMuted, marginTop: 2 },
  roleBadge: {
    width: 36, height: 36, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },

  summaryCard: {
    marginHorizontal: 16, marginTop: 16, borderRadius: 20, overflow: 'hidden',
    backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.borderLight,
    shadowColor: Colors.navy, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05, shadowRadius: 12, elevation: 3,
  },
  summaryRow: { flexDirection: 'row' },
  summaryItem: { flex: 1, alignItems: 'center', paddingVertical: 18 },
  summaryValue: { fontFamily: Typography.serif, fontSize: 24, fontWeight: '700' },
  summaryLabel: { ...Typography.labelSmall, color: Colors.textMuted, marginTop: 4 },

  section: { marginTop: 24, marginHorizontal: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  sectionTitle: { ...Typography.label, color: Colors.textSecondary, flex: 1 },
  countBadge: {
    backgroundColor: Colors.tealLight, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10,
  },
  countBadgeText: { ...Typography.pill, color: Colors.tealDark },

  reminderCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.white, borderRadius: 16, padding: 16,
    marginBottom: 8, borderWidth: 1, borderColor: Colors.borderLight,
  },
  reminderIcon: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  reminderTest: { ...Typography.body, fontWeight: '700', color: Colors.navy },
  reminderPatient: { ...Typography.caption, color: Colors.textSecondary, marginTop: 1 },
  reminderDate: { ...Typography.caption, color: Colors.textMuted, marginTop: 3 },
  reminderMessage: { ...Typography.bodySmall, color: Colors.textSecondary, marginTop: 4 },

  overdueBadge: {
    backgroundColor: Colors.dangerBg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
    borderWidth: 1, borderColor: Colors.dangerBorder,
  },
  overdueBadgeText: { ...Typography.pill, color: Colors.danger },

  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyTitle: { ...Typography.h4, color: Colors.navy, marginTop: 16 },
  emptyDesc: { ...Typography.body, color: Colors.textMuted, marginTop: 4 },
});
