import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../lib/api';

function StatCard({ label, value }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function MenuItem({ label, onPress, danger }) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
      <Text style={[styles.menuLabel, danger && styles.menuLabelDanger]}>{label}</Text>
      <Text style={styles.menuArrow}>›</Text>
    </TouchableOpacity>
  );
}

export default function ProfileScreen({ route, onLogout }) {
  const currentUser = route?.params?.currentUser;
  const meta = currentUser?.user_metadata || {};

  const handleLogout = () => {
    Alert.alert('로그아웃', '정말 로그아웃 하시겠어요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '로그아웃', style: 'destructive',
        onPress: async () => {
          await api.auth.signOut();
          if (onLogout) onLogout();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>프로필</Text>
        </View>

        {/* Avatar + info */}
        <View style={styles.profileSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(meta.student_id || '').slice(-2) || '?'}</Text>
          </View>
          <Text style={styles.studentId}>{meta.student_id || '미입력'}</Text>
          <Text style={styles.email}>{currentUser?.email}</Text>
          <View style={styles.tagRow}>
            {meta.gender && (
              <View style={styles.tag}>
                <Text style={styles.tagText}>{meta.gender}</Text>
              </View>
            )}
            {meta.university && (
              <View style={styles.tag}>
                <Text style={styles.tagText}>{meta.university}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Menu */}
        <View style={styles.menuSection}>
          <Text style={styles.menuSectionTitle}>계정</Text>
          <MenuItem label="프로필 수정" onPress={() => Alert.alert('준비중', '곧 지원될 예정입니다.')} />
          <MenuItem label="알림 설정" onPress={() => Alert.alert('준비중', '곧 지원될 예정입니다.')} />
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.menuSectionTitle}>앱 정보</Text>
          <MenuItem label="이용약관" onPress={() => Alert.alert('준비중')} />
          <MenuItem label="개인정보처리방침" onPress={() => Alert.alert('준비중')} />
          <MenuItem label="버전 정보" onPress={() => Alert.alert('앱 버전', 'WeTee v1.0.0')} />
        </View>

        <View style={styles.menuSection}>
          <MenuItem label="로그아웃" onPress={handleLogout} danger />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F5F7' },
  header: {
    backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#EAEAEA',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  profileSection: {
    backgroundColor: '#FFFFFF', alignItems: 'center', paddingVertical: 28, paddingHorizontal: 20,
    borderBottomWidth: 1, borderBottomColor: '#EAEAEA', marginBottom: 12,
  },
  avatar: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: '#2563EB',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  avatarText: { color: '#FFFFFF', fontSize: 24, fontWeight: '700' },
  studentId: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 4 },
  email: { fontSize: 13, color: '#9CA3AF', marginBottom: 12 },
  tagRow: { flexDirection: 'row', gap: 8 },
  tag: { paddingHorizontal: 12, paddingVertical: 5, backgroundColor: '#EFF6FF', borderRadius: 14 },
  tagText: { fontSize: 13, color: '#2563EB', fontWeight: '500' },
  menuSection: { backgroundColor: '#FFFFFF', marginBottom: 12, borderTopWidth: 1, borderTopColor: '#EAEAEA', borderBottomWidth: 1, borderBottomColor: '#EAEAEA' },
  menuSectionTitle: { fontSize: 11, fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
  menuItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#F4F5F7' },
  menuLabel: { fontSize: 15, color: '#374151' },
  menuLabelDanger: { color: '#EF4444' },
  menuArrow: { fontSize: 18, color: '#D1D5DB' },
});
