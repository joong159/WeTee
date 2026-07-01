import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../lib/api';

const REST_KEY = '12d2315e45f31eea37e639a1979a963b';

function haversineKm(a, b) {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const s = Math.sin(dLat / 2) ** 2
    + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function fareFromKm(km) {
  return Math.ceil((4800 + Math.max(0, km - 1.6) * 763.4) / 100) * 100;
}

async function calcFare(dep, dest) {
  try {
    const r = await fetch(
      'https://apis-navi.kakao.com/v1/directions?origin=' + dep.lng + ',' + dep.lat
        + '&destination=' + dest.lng + ',' + dest.lat + '&priority=RECOMMEND',
      { headers: { Authorization: 'KakaoAK ' + REST_KEY } }
    );
    const data = await r.json();
    if (data.routes?.[0]?.result_code === 0) {
      return fareFromKm(data.routes[0].summary.distance / 1000);
    }
  } catch {}
  return fareFromKm(haversineKm(dep, dest) * 1.3);
}

/* ── 장소 선택 버튼 ── */
function PlaceButton({ label, value, onPress }) {
  const selected = !!value;
  return (
    <TouchableOpacity style={[styles.placeBtn, selected && styles.placeBtnSelected]} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.placeBtnLeft}>
        <View style={[styles.placeDot, selected && styles.placeDotSelected]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.placeBtnLabel}>{label}</Text>
          <Text style={[styles.placeBtnValue, !selected && styles.placeBtnPlaceholder]} numberOfLines={1}>
            {value || '장소를 검색하세요'}
          </Text>
        </View>
      </View>
      <Text style={styles.placeBtnIcon}>🔍</Text>
    </TouchableOpacity>
  );
}

export default function CreateRoomScreen({ navigation, route }) {
  const currentUser = route?.params?.currentUser;

  const [departure,    setDeparture]    = useState('');
  const [depCoords,    setDepCoords]    = useState(null);
  const [destination,  setDestination]  = useState('');
  const [destCoords,   setDestCoords]   = useState(null);
  const [hour,         setHour]         = useState('');
  const [minute,       setMinute]       = useState('');
  const [capacity,     setCapacity]     = useState('4');
  const [genderFilter, setGenderFilter] = useState('anyone');
  const [kakaopayLink, setKakaopayLink] = useState('');
  const [estimatedFare, setEstimatedFare] = useState('');
  const [loading,      setLoading]      = useState(false);
  const [calculating,  setCalculating]  = useState(false);

  const openSearch = (field) => {
    navigation.navigate('PlaceSearch', {
      title: field === 'departure' ? '출발지 검색' : '목적지 검색',
      onSelect: ({ name, coords }) => {
        if (field === 'departure') {
          setDeparture(name);
          setDepCoords(coords);
        } else {
          setDestination(name);
          setDestCoords(coords);
        }
      },
    });
  };

  const handleCalcFare = async () => {
    if (!departure || !destination) {
      Alert.alert('알림', '출발지와 목적지를 먼저 선택해주세요.');
      return;
    }
    if (!depCoords || !destCoords) {
      Alert.alert('알림', '장소 검색에서 선택해주세요.');
      return;
    }
    setCalculating(true);
    try {
      const fare = await calcFare(depCoords, destCoords);
      setEstimatedFare(String(fare));
    } catch (e) {
      Alert.alert('오류', e.message);
    } finally {
      setCalculating(false);
    }
  };

  const buildDepartureTime = () => {
    const now = new Date();
    const h = parseInt(hour) || now.getHours();
    const m = parseInt(minute) || 0;
    const d = new Date(now);
    d.setHours(h, m, 0, 0);
    if (d < now) d.setDate(d.getDate() + 1);
    return d.toISOString();
  };

  const handleCreate = async () => {
    if (!departure || !destination) return Alert.alert('오류', '출발지와 목적지를 입력해주세요.');
    if (!hour || !minute) return Alert.alert('오류', '출발 시간을 입력해주세요.');
    setLoading(true);
    const { error } = await api.rooms.create({
      departure,
      destination,
      departure_time: buildDepartureTime(),
      capacity: parseInt(capacity) || 4,
      gender_filter: genderFilter,
      kakaopay_link: kakaopayLink.trim(),
      estimated_fare: parseInt(estimatedFare) || 0,
    }, currentUser?.id || 'mock-user');
    setLoading(false);
    if (error) return Alert.alert('오류', error.message);
    Alert.alert('완료', '방이 만들어졌어요!', [{ text: '확인', onPress: () => navigation.goBack() }]);
  };

  const fareNum   = parseInt(estimatedFare) || 0;
  const capNum    = parseInt(capacity) || 4;
  const perPerson = fareNum > 0 ? Math.ceil(fareNum / capNum) : 0;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* ── 경로 ── */}
          <Text style={styles.sectionLabel}>경로</Text>
          <View style={styles.routeCard}>
            <PlaceButton label="출발지" value={departure} onPress={() => openSearch('departure')} />
            <View style={styles.routeDivider}>
              <View style={styles.routeLine} />
            </View>
            <PlaceButton label="목적지" value={destination} onPress={() => openSearch('destination')} />
          </View>

          {/* ── 출발 시간 ── */}
          <Text style={styles.sectionLabel}>출발 시간</Text>
          <View style={styles.timeRow}>
            <TextInput
              style={[styles.input, styles.timeInput]}
              placeholder="시 (0-23)"
              placeholderTextColor="#9CA3AF"
              value={hour}
              onChangeText={setHour}
              keyboardType="number-pad"
              maxLength={2}
            />
            <Text style={styles.timeSep}>:</Text>
            <TextInput
              style={[styles.input, styles.timeInput]}
              placeholder="분 (0-59)"
              placeholderTextColor="#9CA3AF"
              value={minute}
              onChangeText={setMinute}
              keyboardType="number-pad"
              maxLength={2}
            />
          </View>

          {/* ── 최대 인원 ── */}
          <Text style={styles.sectionLabel}>최대 인원</Text>
          <View style={styles.pillRow}>
            {['2', '3', '4'].map(n => (
              <TouchableOpacity
                key={n}
                style={[styles.pill, capacity === n && styles.pillActive]}
                onPress={() => setCapacity(n)}
              >
                <Text style={[styles.pillText, capacity === n && styles.pillTextActive]}>{n}명</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── 성별 제한 ── */}
          <Text style={styles.sectionLabel}>성별 제한</Text>
          <View style={styles.pillRow}>
            {[{ key: 'anyone', label: '누구나' }, { key: 'same_gender', label: '동성만' }].map(g => (
              <TouchableOpacity
                key={g.key}
                style={[styles.pill, genderFilter === g.key && styles.pillActive]}
                onPress={() => setGenderFilter(g.key)}
              >
                <Text style={[styles.pillText, genderFilter === g.key && styles.pillTextActive]}>{g.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── 예상 요금 ── */}
          <Text style={styles.sectionLabel}>예상 택시 요금</Text>
          <View style={styles.fareRow}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              placeholder="직접 입력 또는 자동계산 (원)"
              placeholderTextColor="#9CA3AF"
              value={estimatedFare ? Number(estimatedFare).toLocaleString() + '원' : ''}
              onChangeText={t => setEstimatedFare(t.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
            />
            <TouchableOpacity
              style={[styles.calcBtn, (!depCoords || !destCoords) && styles.calcBtnDisabled, calculating && { opacity: 0.6 }]}
              onPress={handleCalcFare}
              disabled={calculating}
            >
              {calculating
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.calcBtnText}>자동계산</Text>}
            </TouchableOpacity>
          </View>

          {perPerson > 0 && (
            <View style={styles.farePreview}>
              <Text style={styles.farePreviewLabel}>1인 예상 부담</Text>
              <Text style={styles.farePreviewAmount}>약 {perPerson.toLocaleString()}원</Text>
              <Text style={styles.farePreviewSub}>{fareNum.toLocaleString()}원 ÷ {capNum}명</Text>
            </View>
          )}

          {/* ── 카카오페이 ── */}
          <Text style={styles.sectionLabel}>
            카카오페이 링크 <Text style={styles.optional}>(선택)</Text>
          </Text>
          <TextInput
            style={styles.input}
            placeholder="카카오페이 앱 → 송금 → 내 QR → 링크 복사 후 붙여넣기"
            placeholderTextColor="#9CA3AF"
            value={kakaopayLink}
            onChangeText={setKakaopayLink}
            autoCapitalize="none"
            autoCorrect={false}
          />

          {/* ── 방 만들기 ── */}
          <TouchableOpacity
            style={[styles.cta, loading && { opacity: 0.6 }]}
            onPress={handleCreate}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>방 만들기</Text>}
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { padding: 20, paddingBottom: 48 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8, marginTop: 20 },
  optional: { fontSize: 12, fontWeight: '400', color: '#9CA3AF' },

  /* 경로 카드 */
  routeCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16,
    borderWidth: 1, borderColor: '#E5E7EB',
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  placeBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
    backgroundColor: '#FFFFFF',
  },
  placeBtnSelected: { backgroundColor: '#FFFFFF' },
  placeBtnLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  placeDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#D1D5DB', borderWidth: 2, borderColor: '#9CA3AF',
  },
  placeDotSelected: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  placeBtnLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '600', marginBottom: 2 },
  placeBtnValue: { fontSize: 15, fontWeight: '700', color: '#111827' },
  placeBtnPlaceholder: { color: '#9CA3AF', fontWeight: '400' },
  placeBtnIcon: { fontSize: 18 },
  routeDivider: { paddingHorizontal: 16, paddingVertical: 0, alignItems: 'flex-start', paddingLeft: 26 },
  routeLine: { width: 2, height: 14, backgroundColor: '#E5E7EB', marginLeft: 4 },

  /* 입력 */
  input: {
    height: 48, backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 14,
    color: '#111827', fontSize: 15, marginBottom: 4,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeInput: { flex: 1 },
  timeSep: { fontSize: 22, color: '#374151', fontWeight: '300', marginBottom: 4 },

  /* 인원/성별 */
  pillRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  pill: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 22, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#E5E7EB' },
  pillActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  pillText: { color: '#6B7280', fontSize: 14, fontWeight: '600' },
  pillTextActive: { color: '#FFFFFF' },

  /* 요금 */
  fareRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 4 },
  calcBtn: {
    height: 48, paddingHorizontal: 16, backgroundColor: '#2563EB',
    borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  },
  calcBtnDisabled: { backgroundColor: '#93C5FD' },
  calcBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  farePreview: {
    backgroundColor: '#F0FDF4', borderRadius: 14, padding: 16,
    alignItems: 'center', marginBottom: 4, marginTop: 4,
    borderWidth: 1, borderColor: '#BBF7D0',
  },
  farePreviewLabel: { fontSize: 12, color: '#059669', fontWeight: '600', marginBottom: 4 },
  farePreviewAmount: { fontSize: 22, color: '#047857', fontWeight: '800', marginBottom: 2 },
  farePreviewSub: { fontSize: 11, color: '#6EE7B7' },

  /* CTA */
  cta: {
    height: 54, backgroundColor: '#2563EB', borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', marginTop: 28,
    shadowColor: '#2563EB', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 6,
  },
  ctaText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
});
