import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../lib/api';

const STATUS_CONFIG = {
  recruiting: { label: '모집중', color: '#10B981', bg: '#D1FAE5' },
  full: { label: '마감', color: '#EF4444', bg: '#FEE2E2' },
  in_progress: { label: '이동중', color: '#F59E0B', bg: '#FEF3C7' },
  settlement: { label: '정산중', color: '#8B5CF6', bg: '#EDE9FE' },
  completed: { label: '완료', color: '#6B7280', bg: '#F3F4F6' },
};

function TripCard({ item, currentUser, onPress, onLeave }) {
  const room = item.room;
  if (!room) return null;
  const st = STATUS_CONFIG[room.status] || STATUS_CONFIG.completed;
  const perPerson = room.total_fare > 0 && room.participant_count > 0
    ? Math.ceil(room.total_fare / room.participant_count) : 0;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.cardHeader}>
        <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
          <View style={[styles.statusDot, { backgroundColor: st.color }]} />
          <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
        </View>
        <Text style={[styles.appStatus, item.status === 'accepted' ? styles.appAccepted : styles.appPending]}>
          {item.status === 'accepted' ? '승인됨' : item.status === 'pending' ? '대기중' : '거절됨'}
        </Text>
      </View>

      <Text style={styles.route}>{room.departure} → {room.destination}</Text>

      {perPerson > 0 && (
        <Text style={styles.fareText}>예상 분담금: {perPerson.toLocaleString()}원</Text>
      )}

      <View style={styles.cardFooter}>
        <Text style={styles.metaText}>{room.participant_count}/{room.capacity}명</Text>
        {item.status !== 'rejected' && room.status !== 'completed' && (
          <TouchableOpacity
            style={styles.leaveBtn}
            onPress={(e) => { e.stopPropagation?.(); onLeave(); }}
          >
            <Text style={styles.leaveBtnText}>나가기</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function MyTripsScreen({ navigation, route }) {
  const currentUser = route?.params?.currentUser;
  const [applications, setApplications] = useState([]);
  const [myRooms, setMyRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('applied');

  const loadData = useCallback(async () => {
    const [apps, allRooms] = await Promise.all([
      api.applicants.getMyApplications(currentUser?.id || ''),
      api.rooms.getAll(),
    ]);
    setApplications(apps || []);
    setMyRooms((allRooms || []).filter(r => r.created_by === currentUser?.id));
    setLoading(false);
  }, [currentUser?.id]);

  useEffect(() => {
    loadData();
    const unsubscribe = navigation.addListener('focus', loadData);
    return unsubscribe;
  }, [navigation, loadData]);

  const handleLeave = async (roomId) => {
    Alert.alert('나가기', '정말 이 방에서 나가시겠어요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '나가기', style: 'destructive',
        onPress: async () => {
          await api.applicants.leave(roomId, currentUser?.id);
          loadData();
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingWrap}><ActivityIndicator size="large" color="#2563EB" /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>내 여정</Text>
      </View>

      <View style={styles.tabs}>
        {[
          { key: 'applied', label: '신청한 방' },
          { key: 'hosted', label: '만든 방' },
        ].map(t => (
          <TouchableOpacity key={t.key} style={styles.tab} onPress={() => setTab(t.key)}>
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
            {tab === t.key && <View style={styles.tabUnderline} />}
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'applied' ? (
        <FlatList
          data={applications}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <TripCard
              item={item}
              currentUser={currentUser}
              onPress={() => navigation.navigate('ChatRoom', { room: item.room, currentUser, userDepCoords: null })}
              onLeave={() => handleLeave(item.room?.id)}
            />
          )}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyTitle}>신청한 방이 없어요</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={myRooms}
          keyExtractor={item => item.id}
          renderItem={({ item }) => {
            const st = STATUS_CONFIG[item.status] || STATUS_CONFIG.completed;
            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => navigation.navigate('ManageRoom', { room: item, currentUser })}
                activeOpacity={0.75}
              >
                <View style={styles.cardHeader}>
                  <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                    <View style={[styles.statusDot, { backgroundColor: st.color }]} />
                    <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
                  </View>
                  <Text style={styles.manageHint}>관리하기 →</Text>
                </View>
                <Text style={styles.route}>{item.departure} → {item.destination}</Text>
                <Text style={styles.metaText}>{item.participant_count}/{item.capacity}명</Text>
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyIcon}>🏠</Text>
              <Text style={styles.emptyTitle}>만든 방이 없어요</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F5F7' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#EAEAEA',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  tabs: {
    flexDirection: 'row', backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: '#EAEAEA',
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12, position: 'relative' },
  tabText: { fontSize: 14, color: '#9CA3AF', fontWeight: '500' },
  tabTextActive: { color: '#2563EB', fontWeight: '600' },
  tabUnderline: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, backgroundColor: '#2563EB' },
  list: { padding: 16, gap: 10, paddingBottom: 24 },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: '600' },
  appStatus: { fontSize: 12, fontWeight: '600' },
  appAccepted: { color: '#10B981' },
  appPending: { color: '#F59E0B' },
  route: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 8 },
  fareText: { fontSize: 13, color: '#2563EB', fontWeight: '500', marginBottom: 8 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#F4F5F7', paddingTop: 10 },
  metaText: { fontSize: 12, color: '#6B7280' },
  leaveBtn: { paddingHorizontal: 12, paddingVertical: 5, backgroundColor: '#FEE2E2', borderRadius: 8 },
  leaveBtnText: { color: '#EF4444', fontSize: 12, fontWeight: '600' },
  manageHint: { fontSize: 12, color: '#2563EB', fontWeight: '500' },
  emptyWrap: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#374151' },
});
