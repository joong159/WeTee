import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet,
  Alert, TextInput, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../lib/api';

export default function ManageRoomScreen({ route, navigation }) {
  const { room: initialRoom, currentUser } = route.params;
  const [room, setRoom] = useState(initialRoom);
  const [applicants, setApplicants] = useState([]);
  const [fareInput, setFareInput] = useState(String(initialRoom.total_fare || ''));
  const [loading, setLoading] = useState(false);

  const loadApplicants = async () => {
    const apps = await api.applicants.getByRoom(room.id);
    setApplicants(apps || []);
  };

  useEffect(() => { loadApplicants(); }, []);

  const handleApplicantAction = async (applicantId, status) => {
    const { error } = await api.applicants.updateStatus(applicantId, status);
    if (error) return Alert.alert('오류', error.message);
    loadApplicants();
  };

  const handleStatusChange = async (status) => {
    setLoading(true);
    const { error } = await api.rooms.updateStatus(room.id, status);
    setLoading(false);
    if (error) return Alert.alert('오류', error.message);
    setRoom(prev => ({ ...prev, status }));
  };

  const handleSettlement = async () => {
    if (!fareInput) return Alert.alert('오류', '요금을 입력해주세요.');
    setLoading(true);
    const { data, error } = await api.rooms.updateFare(room.id, fareInput, 'settlement');
    setLoading(false);
    if (error) return Alert.alert('오류', error.message);
    if (data) setRoom(data);
    Alert.alert('완료', '정산 정보가 저장되었습니다. 채팅방에서 참여자들에게 안내해주세요.');
  };

  const STATUS_FLOW = [
    { from: 'recruiting', to: 'in_progress', label: '탑승 시작', color: '#F59E0B' },
    { from: 'in_progress', to: 'settlement', label: '정산 시작', color: '#8B5CF6' },
    { from: 'settlement', to: 'completed', label: '완료 처리', color: '#10B981' },
  ];

  const nextStatus = STATUS_FLOW.find(s => s.from === room.status);

  const acceptedApplicants = applicants.filter(a => a.status === 'accepted');
  const pendingApplicants = applicants.filter(a => a.status === 'pending');

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Room info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>방 정보</Text>
          <Text style={styles.route}>{room.departure} → {room.destination}</Text>
          <Text style={styles.meta}>{room.participant_count}/{room.capacity}명 · {room.gender_filter === 'same_gender' ? '동성만' : '누구나'}</Text>
        </View>

        {/* Status action */}
        {nextStatus && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>상태 변경</Text>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: nextStatus.color }, loading && { opacity: 0.6 }]}
              onPress={() => handleStatusChange(nextStatus.to)}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.actionBtnText}>{nextStatus.label}</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* Settlement */}
        {(room.status === 'in_progress' || room.status === 'settlement') && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>정산 처리</Text>
            <TextInput
              style={styles.input}
              placeholder="총 요금 입력 (원)"
              placeholderTextColor="#9CA3AF"
              value={fareInput}
              onChangeText={setFareInput}
              keyboardType="number-pad"
            />
            {fareInput ? (
              <Text style={styles.perPersonText}>
                1인 부담: {Math.ceil(parseInt(fareInput) / (room.participant_count || 1)).toLocaleString()}원
              </Text>
            ) : null}
            <TouchableOpacity style={styles.settlementBtn} onPress={handleSettlement}>
              <Text style={styles.settlementBtnText}>정산 공지</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Pending applicants */}
        {pendingApplicants.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>신청 대기 ({pendingApplicants.length})</Text>
            {pendingApplicants.map(app => (
              <View key={app.id} style={styles.applicantCard}>
                <View style={styles.applicantInfo}>
                  <Text style={styles.applicantId}>{app.user?.student_id}</Text>
                  <Text style={styles.applicantGender}>{app.user?.gender}</Text>
                </View>
                <View style={styles.applicantActions}>
                  <TouchableOpacity
                    style={styles.acceptBtn}
                    onPress={() => handleApplicantAction(app.id, 'accepted')}
                  >
                    <Text style={styles.acceptBtnText}>수락</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.rejectBtn}
                    onPress={() => handleApplicantAction(app.id, 'rejected')}
                  >
                    <Text style={styles.rejectBtnText}>거절</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Accepted participants */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>참여 중 ({acceptedApplicants.length + 1}명)</Text>
          <View style={styles.applicantCard}>
            <Text style={styles.applicantId}>{currentUser?.user_metadata?.student_id || '나'} (호스트)</Text>
          </View>
          {acceptedApplicants.map(app => (
            <View key={app.id} style={styles.applicantCard}>
              <Text style={styles.applicantId}>{app.user?.student_id}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F5F7' },
  scroll: { padding: 16, gap: 12, paddingBottom: 40 },
  section: {
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  route: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 4 },
  meta: { fontSize: 13, color: '#6B7280' },
  actionBtn: {
    height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
  },
  actionBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  input: {
    height: 48, backgroundColor: '#F9FAFB', borderRadius: 10, paddingHorizontal: 14,
    color: '#111827', fontSize: 15, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 8,
  },
  perPersonText: { fontSize: 13, color: '#6B7280', marginBottom: 12, textAlign: 'right' },
  settlementBtn: {
    height: 44, backgroundColor: '#8B5CF6', borderRadius: 10, alignItems: 'center', justifyContent: 'center',
  },
  settlementBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  applicantCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F4F5F7',
  },
  applicantInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  applicantId: { fontSize: 14, color: '#374151', fontWeight: '500' },
  applicantGender: { fontSize: 12, color: '#9CA3AF' },
  applicantActions: { flexDirection: 'row', gap: 8 },
  acceptBtn: { paddingHorizontal: 14, paddingVertical: 6, backgroundColor: '#10B981', borderRadius: 8 },
  acceptBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  rejectBtn: { paddingHorizontal: 14, paddingVertical: 6, backgroundColor: '#FEE2E2', borderRadius: 8 },
  rejectBtnText: { color: '#EF4444', fontSize: 13, fontWeight: '600' },
});
