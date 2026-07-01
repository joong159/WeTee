import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, RefreshControl, ActivityIndicator,
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

function formatTime(isoString) {
  const d = new Date(isoString);
  const now = new Date();
  const diffMin = Math.floor((d - now) / 60000);
  if (diffMin < 0) return '출발완료';
  if (diffMin === 0) return '지금 출발';
  if (diffMin < 60) return `${diffMin}분 후`;
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  return m > 0 ? `${h}시간 ${m}분 후` : `${h}시간 후`;
}

function RoomCard({ room, currentUser, onPress }) {
  const st = STATUS_CONFIG[room.status] || STATUS_CONFIG.completed;
  const isMyRoom = room.created_by === currentUser?.id;
  const isAccepted = room.accepted_user_ids?.includes(currentUser?.id);
  const estimatedPerPerson = room.estimated_fare && room.capacity
    ? Math.ceil(room.estimated_fare / room.capacity)
    : 0;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.cardHeader}>
        <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
          <View style={[styles.statusDot, { backgroundColor: st.color }]} />
          <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
        </View>
        <Text style={styles.timeText}>{formatTime(room.departure_time)}</Text>
      </View>

      <Text style={styles.route}>
        {room.departure} → {room.destination}
      </Text>

      {estimatedPerPerson > 0 && (
        <View style={styles.fareRow}>
          <Text style={styles.fareLabel}>예상 1인 부담</Text>
          <Text style={styles.fareValue}>약 {estimatedPerPerson.toLocaleString()}원</Text>
        </View>
      )}

      <View style={styles.cardFooter}>
        <Text style={styles.metaText}>
          {room.gender_filter === 'same_gender' ? (room.host?.gender === '여' ? '여성만' : '남성만') : '누구나'}
        </Text>
        <Text style={styles.metaDot}>·</Text>
        <Text style={styles.metaText}>
          {room.participant_count}/{room.capacity}명
        </Text>
        {(isMyRoom || isAccepted) && (
          <>
            <Text style={styles.metaDot}>·</Text>
            <Text style={[styles.metaText, { color: '#2563EB', fontWeight: '600' }]}>
              {isMyRoom ? '내 방' : '참여중'}
            </Text>
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}

function matchesRoute(room, fromQuery, toQuery) {
  const dep = room.departure.toLowerCase();
  const dest = room.destination.toLowerCase();
  const from = fromQuery.toLowerCase().trim();
  const to = toQuery.toLowerCase().trim();

  if (from && to) {
    // 출발지와 목적지 모두 입력 시: 경로가 겹치는 방 포함
    const depMatch = dep.includes(from) || from.includes(dep);
    const destMatch = dest.includes(to) || to.includes(dest);
    // 내가 입력한 출발지가 방의 경로 중간일 수도 있음
    const passByDep = dep.includes(from) || dest.includes(from) || from.includes(dep);
    return (depMatch || passByDep) && destMatch;
  }
  if (from) return dep.includes(from) || from.includes(dep);
  if (to) return dest.includes(to) || to.includes(dest);
  return true;
}

export default function HomeScreen({ navigation, route }) {
  const currentUser = route?.params?.currentUser;
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchFrom, setSearchFrom] = useState('');
  const [searchTo, setSearchTo] = useState('');
  const [filter, setFilter] = useState('all');

  const loadRooms = useCallback(async () => {
    const data = await api.rooms.getAll();
    setRooms(Array.isArray(data) ? data : []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { loadRooms(); }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', loadRooms);
    return unsubscribe;
  }, [navigation, loadRooms]);

  const filtered = rooms.filter(r => {
    if (filter === 'recruiting' && r.status !== 'recruiting') return false;
    if (filter === 'myroom' && r.created_by !== currentUser?.id && !r.accepted_user_ids?.includes(currentUser?.id)) return false;
    if (searchFrom || searchTo) return matchesRoute(r, searchFrom, searchTo);
    return true;
  });

  const filters = [
    { key: 'all', label: '전체' },
    { key: 'recruiting', label: '모집중' },
    { key: 'myroom', label: '내 방' },
  ];

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <View style={styles.logoMark}><Text style={styles.logoMarkText}>W</Text></View>
          <Text style={styles.logoName}>위티</Text>
        </View>
        <Text style={styles.userLabel}>{currentUser?.user_metadata?.phone || currentUser?.email}</Text>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <View style={styles.searchRow}>
          <View style={styles.searchDot} />
          <TextInput
            style={styles.searchInput}
            placeholder="출발지 검색"
            placeholderTextColor="#9CA3AF"
            value={searchFrom}
            onChangeText={setSearchFrom}
          />
        </View>
        <View style={styles.searchDivider} />
        <View style={styles.searchRow}>
          <View style={[styles.searchDot, styles.searchDotDest]} />
          <TextInput
            style={styles.searchInput}
            placeholder="목적지 검색"
            placeholderTextColor="#9CA3AF"
            value={searchTo}
            onChangeText={setSearchTo}
          />
        </View>
      </View>

      {/* Filter chips */}
      <View style={styles.filterRow}>
        {filters.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
        {(searchFrom || searchTo) && (
          <Text style={styles.matchCount}>{filtered.length}개 매칭</Text>
        )}
      </View>

      {/* Room list */}
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <RoomCard
            room={item}
            currentUser={currentUser}
            onPress={() => navigation.navigate('ChatRoom', { room: item, currentUser })}
          />
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadRooms(); }} tintColor="#2563EB" />
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>🚕</Text>
            <Text style={styles.emptyTitle}>
              {searchFrom || searchTo ? '해당 경로의 방이 없어요' : '방이 없어요'}
            </Text>
            <Text style={styles.emptySub}>아래 + 버튼으로 방을 만들어보세요</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F5F7' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#EAEAEA',
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoMark: {
    width: 28, height: 28, borderRadius: 7, backgroundColor: '#2563EB',
    alignItems: 'center', justifyContent: 'center',
  },
  logoMarkText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  logoName: { fontSize: 17, fontWeight: '700', color: '#111827' },
  userLabel: { fontSize: 12, color: '#9CA3AF' },
  searchWrap: {
    backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: '#EAEAEA',
  },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchDot: {
    width: 10, height: 10, borderRadius: 5, backgroundColor: '#2563EB',
  },
  searchDotDest: { backgroundColor: '#EF4444' },
  searchDivider: {
    height: 1, backgroundColor: '#F4F5F7', marginLeft: 20, marginVertical: 4,
  },
  searchInput: {
    flex: 1, height: 38, color: '#111827', fontSize: 14,
  },
  filterRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#EAEAEA',
  },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14, backgroundColor: '#F4F5F7',
  },
  filterChipActive: { backgroundColor: '#EFF6FF' },
  filterText: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  filterTextActive: { color: '#2563EB', fontWeight: '600' },
  matchCount: { marginLeft: 'auto', fontSize: 12, color: '#9CA3AF' },
  listContent: { padding: 16, gap: 10, paddingBottom: 24 },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: '600' },
  timeText: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  route: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 8 },
  fareRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#F0FDF4', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 8,
  },
  fareLabel: { fontSize: 12, color: '#059669' },
  fareValue: { fontSize: 13, fontWeight: '700', color: '#059669' },
  cardFooter: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F4F5F7', paddingTop: 10, gap: 6 },
  metaText: { fontSize: 12, color: '#6B7280' },
  metaDot: { fontSize: 12, color: '#D1D5DB' },
  emptyWrap: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#374151', marginBottom: 4 },
  emptySub: { fontSize: 14, color: '#9CA3AF' },
});
