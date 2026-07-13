import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, FlatList,
  StyleSheet, RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../lib/api';

function haversineKm(a, b) {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const s = Math.sin(dLat / 2) ** 2
    + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180)
    * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

// 점 P가 선분 A→B 위에 있는지 (거리 thresholdKm 이내)
function isNearSegment(p, a, b, thresholdKm = 3) {
  const dx = b.lng - a.lng;
  const dy = b.lat - a.lat;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return haversineKm(p, a) < thresholdKm;
  const t = Math.max(0, Math.min(1, ((p.lng - a.lng) * dx + (p.lat - a.lat) * dy) / len2));
  const closest = { lat: a.lat + t * dy, lng: a.lng + t * dx };
  return haversineKm(p, closest) < thresholdKm;
}

// 사용자 경로(userDep→userDest)와 방 경로(roomDep→roomDest)의 유사도 판별
function routeSimilarity(room, userDep, userDest) {
  if (!room.dep_lat || !room.dest_lat) return 'none';
  const rd = { lat: room.dep_lat,  lng: room.dep_lng  };
  const rt = { lat: room.dest_lat, lng: room.dest_lng };

  const depDist  = haversineKm(userDep, rd);
  const destDist = haversineKm(userDest, rt);

  // 출발지끼리, 목적지끼리 가까우면 "같은 경로" (각각 4km 이내)
  if (depDist < 4 && destDist < 4) return 'same';

  // 내 출발지가 방 경로 위에 있고, 내 목적지도 방 경로 위에 있으면 "경유 가능"
  const depOnRoute  = isNearSegment(userDep, rd, rt, 4);
  const destOnRoute = isNearSegment(userDest, rd, rt, 4);
  if (depOnRoute && destOnRoute) return 'waypoint';

  // 방향이 비슷하고 출발 or 목적지 중 하나라도 가까우면 "비슷한 경로"
  const udx = userDest.lng - userDep.lng;
  const udy = userDest.lat - userDep.lat;
  const rdx = rt.lng - rd.lng;
  const rdy = rt.lat - rd.lat;
  const dot = udx * rdx + udy * rdy;
  const mag = Math.sqrt((udx ** 2 + udy ** 2) * (rdx ** 2 + rdy ** 2));
  if (mag > 0 && dot / mag > 0.65 && (depDist < 5 || destDist < 5)) return 'similar';

  return 'none';
}

const STATUS_CONFIG = {
  recruiting: { label: '모집중', color: '#10B981', bg: '#D1FAE5' },
  full:       { label: '마감',   color: '#EF4444', bg: '#FEE2E2' },
  in_progress: { label: '이동중', color: '#F59E0B', bg: '#FEF3C7' },
  settlement: { label: '정산중', color: '#8B5CF6', bg: '#EDE9FE' },
  completed:  { label: '완료',   color: '#6B7280', bg: '#F3F4F6' },
};

const SIMILARITY_BADGE = {
  same:     { label: '같은 경로 추천', color: '#2563EB', bg: '#EFF6FF' },
  waypoint: { label: '탑승 가능 경유', color: '#7C3AED', bg: '#F5F3FF' },
  similar:  { label: '비슷한 경로',   color: '#059669', bg: '#ECFDF5' },
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

function RoomCard({ room, currentUser, onPress, similarity }) {
  const st = STATUS_CONFIG[room.status] || STATUS_CONFIG.completed;
  const isMyRoom = room.created_by === currentUser?.id;
  const isAccepted = room.accepted_user_ids?.includes(currentUser?.id);
  const estimatedPerPerson = room.estimated_fare && room.capacity
    ? Math.ceil(room.estimated_fare / room.capacity)
    : 0;
  const badge = similarity && similarity !== 'none' ? SIMILARITY_BADGE[similarity] : null;

  return (
    <TouchableOpacity
      style={[styles.card, badge && styles.cardHighlight]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {badge && (
        <View style={[styles.simBadge, { backgroundColor: badge.bg }]}>
          <Text style={[styles.simBadgeText, { color: badge.color }]}>✦ {badge.label}</Text>
        </View>
      )}
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

      {room.estimated_fare > 0 && (
        <View style={styles.fareRow}>
          <Text style={styles.fareLabel}>총액 약 {room.estimated_fare.toLocaleString()}원</Text>
          <Text style={styles.fareDivider}>|</Text>
          <Text style={styles.fareValue}>인당 약 {estimatedPerPerson.toLocaleString()}원</Text>
        </View>
      )}

      <View style={styles.cardFooter}>
        <Text style={styles.metaText}>
          {room.gender_filter === 'same_gender'
            ? (room.host?.gender === '여' ? '여성만' : '남성만')
            : '누구나'}
        </Text>
        <Text style={styles.metaDot}>·</Text>
        <Text style={styles.metaText}>{room.participant_count}/{room.capacity}명</Text>
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

// 검색 위치 선택 버튼
function PlacePickerBtn({ label, color, value, onPress, onClear }) {
  return (
    <TouchableOpacity style={styles.pickerBtn} onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.pickerDot, { backgroundColor: color }]} />
      <Text
        style={[styles.pickerText, !value && styles.pickerPlaceholder]}
        numberOfLines={1}
      >
        {value || label}
      </Text>
      {value ? (
        <TouchableOpacity
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          onPress={onClear}
        >
          <View style={styles.clearCircle}><Text style={styles.clearX}>✕</Text></View>
        </TouchableOpacity>
      ) : (
        <Text style={styles.pickerSearch}>🔍</Text>
      )}
    </TouchableOpacity>
  );
}

const SORT_ORDER = { same: 0, waypoint: 1, similar: 2, none: 3 };

export default function HomeScreen({ navigation, route }) {
  const currentUser = route?.params?.currentUser;
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');

  const [depName,   setDepName]   = useState('');
  const [depCoords, setDepCoords] = useState(null);
  const [destName,  setDestName]  = useState('');
  const [destCoords, setDestCoords] = useState(null);

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

  const openSearch = (field) => {
    navigation.navigate('PlaceSearch', {
      title: field === 'dep' ? '출발지 검색' : '목적지 검색',
      onSelect: ({ name, coords }) => {
        if (field === 'dep') { setDepName(name); setDepCoords(coords); }
        else                 { setDestName(name); setDestCoords(coords); }
      },
    });
  };

  const getSimilarity = (room) => {
    if (!depCoords || !destCoords) return 'none';
    return routeSimilarity(room, depCoords, destCoords);
  };

  const filtered = rooms
    .filter(r => {
      if (filter === 'recruiting' && r.status !== 'recruiting') return false;
      if (filter === 'myroom' && r.created_by !== currentUser?.id && !r.accepted_user_ids?.includes(currentUser?.id)) return false;
      return true;
    })
    .map(r => ({ ...r, _sim: getSimilarity(r) }))
    .sort((a, b) => SORT_ORDER[a._sim] - SORT_ORDER[b._sim]);

  const hasSearch = depCoords && destCoords;
  const recommendCount = hasSearch ? filtered.filter(r => r._sim !== 'none').length : 0;

  const filters = [
    { key: 'all',        label: '전체' },
    { key: 'recruiting', label: '모집중' },
    { key: 'myroom',     label: '내 방' },
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

      {/* 경로 검색 */}
      <View style={styles.searchWrap}>
        <PlacePickerBtn
          label="출발지를 선택하세요"
          color="#2563EB"
          value={depName}
          onPress={() => openSearch('dep')}
          onClear={() => { setDepName(''); setDepCoords(null); }}
        />
        <View style={styles.searchDivider} />
        <PlacePickerBtn
          label="목적지를 선택하세요"
          color="#EF4444"
          value={destName}
          onPress={() => openSearch('dest')}
          onClear={() => { setDestName(''); setDestCoords(null); }}
        />
      </View>

      {/* 추천 안내 */}
      {hasSearch && (
        <View style={styles.recommendBanner}>
          <Text style={styles.recommendText}>
            {recommendCount > 0
              ? `🎯 비슷한 경로 방 ${recommendCount}개를 상단에 추천했어요`
              : '해당 경로와 겹치는 방이 없어요'}
          </Text>
        </View>
      )}

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
        <Text style={styles.matchCount}>{filtered.length}개</Text>
      </View>

      {/* Room list */}
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <RoomCard
            room={item}
            currentUser={currentUser}
            onPress={() => navigation.navigate('ChatRoom', { room: item, currentUser, userDepCoords: depCoords })}
            similarity={item._sim}
          />
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadRooms(); }}
            tintColor="#2563EB"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>🚕</Text>
            <Text style={styles.emptyTitle}>방이 없어요</Text>
            <Text style={styles.emptySub}>아래 + 버튼으로 방을 만들어보세요</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#F4F5F7' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#EAEAEA',
  },
  logoRow:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoMark:     { width: 28, height: 28, borderRadius: 7, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  logoMarkText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  logoName:     { fontSize: 17, fontWeight: '700', color: '#111827' },
  userLabel:    { fontSize: 12, color: '#9CA3AF' },

  searchWrap: {
    backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: '#EAEAEA',
  },
  pickerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10, height: 44,
  },
  pickerDot: { width: 10, height: 10, borderRadius: 5 },
  pickerText: { flex: 1, fontSize: 14, color: '#111827', fontWeight: '500' },
  pickerPlaceholder: { color: '#9CA3AF', fontWeight: '400' },
  pickerSearch: { fontSize: 16 },
  clearCircle: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center',
  },
  clearX: { fontSize: 9, color: '#6B7280', fontWeight: '700' },
  searchDivider: { height: 1, backgroundColor: '#F4F5F7', marginLeft: 20 },

  recommendBanner: {
    backgroundColor: '#EFF6FF', paddingHorizontal: 16, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: '#DBEAFE',
  },
  recommendText: { fontSize: 13, color: '#2563EB', fontWeight: '600' },

  filterRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#EAEAEA',
  },
  filterChip:       { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14, backgroundColor: '#F4F5F7' },
  filterChipActive: { backgroundColor: '#EFF6FF' },
  filterText:       { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  filterTextActive: { color: '#2563EB', fontWeight: '600' },
  matchCount:       { marginLeft: 'auto', fontSize: 12, color: '#9CA3AF' },

  listContent: { padding: 16, gap: 10, paddingBottom: 24 },

  card: {
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  cardHighlight: {
    borderWidth: 1.5, borderColor: '#2563EB',
    shadowColor: '#2563EB', shadowOpacity: 0.12, elevation: 4,
  },
  simBadge: {
    alignSelf: 'flex-start', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3, marginBottom: 8,
  },
  simBadgeText: { fontSize: 11, fontWeight: '700' },

  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusDot:   { width: 6, height: 6, borderRadius: 3 },
  statusText:  { fontSize: 12, fontWeight: '600' },
  timeText:    { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  route:       { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 8 },

  fareRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#F0FDF4', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 8,
  },
  fareLabel:   { fontSize: 12, color: '#059669' },
  fareDivider: { fontSize: 12, color: '#A7F3D0', marginHorizontal: 6 },
  fareValue:   { fontSize: 12, fontWeight: '700', color: '#059669' },

  cardFooter: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F4F5F7', paddingTop: 10, gap: 6 },
  metaText:   { fontSize: 12, color: '#6B7280' },
  metaDot:    { fontSize: 12, color: '#D1D5DB' },

  emptyWrap:  { alignItems: 'center', paddingTop: 80 },
  emptyIcon:  { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#374151', marginBottom: 4 },
  emptySub:   { fontSize: 14, color: '#9CA3AF' },
});
