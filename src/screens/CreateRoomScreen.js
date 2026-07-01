import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../lib/api';

const SUGGESTIONS = {
  departure: ['대진대역 1번출구', '포천터미널', '의정부역', '동두천역', '소요산역', '학교 정문', '학교 후문'],
  destination: ['대진대 정문', '대진대 공학관', '대진대 기숙사', '대진대역', '포천터미널', '의정부역'],
};

function SuggestionChips({ items, onSelect }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
      {items.map(s => (
        <TouchableOpacity key={s} style={styles.chip} onPress={() => onSelect(s)}>
          <Text style={styles.chipText}>{s}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

export default function CreateRoomScreen({ navigation, route }) {
  const currentUser = route?.params?.currentUser;
  const [departure, setDeparture] = useState('');
  const [destination, setDestination] = useState('');
  const [hour, setHour] = useState('');
  const [minute, setMinute] = useState('');
  const [capacity, setCapacity] = useState('4');
  const [genderFilter, setGenderFilter] = useState('anyone');
  const [bankAccount, setBankAccount] = useState('');
  const [estimatedFare, setEstimatedFare] = useState('');
  const [loading, setLoading] = useState(false);

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
    if (!bankAccount) return Alert.alert('오류', '정산 계좌를 입력해주세요.');

    setLoading(true);
    const { data, error } = await api.rooms.create({
      departure,
      destination,
      departure_time: buildDepartureTime(),
      capacity: parseInt(capacity) || 4,
      gender_filter: genderFilter,
      bank_account: bankAccount,
      estimated_fare: parseInt(estimatedFare) || 0,
    }, currentUser?.id || 'mock-user');
    setLoading(false);

    if (error) return Alert.alert('오류', error.message);
    Alert.alert('완료', '방이 만들어졌어요!', [
      { text: '확인', onPress: () => navigation.goBack() },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.sectionLabel}>출발지</Text>
          <TextInput
            style={styles.input}
            placeholder="출발지 입력"
            placeholderTextColor="#9CA3AF"
            value={departure}
            onChangeText={setDeparture}
          />
          <SuggestionChips items={SUGGESTIONS.departure} onSelect={setDeparture} />

          <Text style={styles.sectionLabel}>목적지</Text>
          <TextInput
            style={styles.input}
            placeholder="목적지 입력"
            placeholderTextColor="#9CA3AF"
            value={destination}
            onChangeText={setDestination}
          />
          <SuggestionChips items={SUGGESTIONS.destination} onSelect={setDestination} />

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

          <Text style={styles.sectionLabel}>성별 제한</Text>
          <View style={styles.pillRow}>
            {[
              { key: 'anyone', label: '누구나' },
              { key: 'same_gender', label: '동성만' },
            ].map(g => (
              <TouchableOpacity
                key={g.key}
                style={[styles.pill, genderFilter === g.key && styles.pillActive]}
                onPress={() => setGenderFilter(g.key)}
              >
                <Text style={[styles.pillText, genderFilter === g.key && styles.pillTextActive]}>{g.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.sectionLabel}>예상 택시 요금 (전체)</Text>
          <TextInput
            style={styles.input}
            placeholder="예) 12000 (원)"
            placeholderTextColor="#9CA3AF"
            value={estimatedFare}
            onChangeText={setEstimatedFare}
            keyboardType="number-pad"
          />
          {estimatedFare ? (
            <View style={styles.farePreview}>
              <Text style={styles.farePreviewText}>
                1인 예상 부담: 약 {Math.ceil(parseInt(estimatedFare) / parseInt(capacity)).toLocaleString()}원
              </Text>
            </View>
          ) : null}

          <Text style={styles.sectionLabel}>정산 계좌</Text>
          <TextInput
            style={styles.input}
            placeholder="예) 국민은행 123-456-789012 홍길동"
            placeholderTextColor="#9CA3AF"
            value={bankAccount}
            onChangeText={setBankAccount}
          />

          <TouchableOpacity
            style={[styles.cta, loading && { opacity: 0.6 }]}
            onPress={handleCreate}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.ctaText}>방 만들기</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: { padding: 20, paddingBottom: 40 },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8, marginTop: 16 },
  input: {
    height: 48, backgroundColor: '#F9FAFB', borderRadius: 10, paddingHorizontal: 14,
    color: '#111827', fontSize: 15, marginBottom: 8, borderWidth: 1, borderColor: '#E5E7EB',
  },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#EFF6FF',
    borderRadius: 14, marginRight: 6,
  },
  chipText: { fontSize: 13, color: '#2563EB', fontWeight: '500' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeInput: { flex: 1 },
  timeSep: { fontSize: 20, color: '#374151', fontWeight: '300', marginBottom: 8 },
  pillRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  pill: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#F4F5F7', borderWidth: 1, borderColor: '#E5E7EB',
  },
  pillActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  pillText: { color: '#6B7280', fontSize: 13, fontWeight: '500' },
  pillTextActive: { color: '#FFFFFF' },
  farePreview: {
    backgroundColor: '#F0FDF4', borderRadius: 8, padding: 10, marginBottom: 4,
  },
  farePreviewText: { fontSize: 13, color: '#059669', fontWeight: '600', textAlign: 'center' },
  cta: {
    height: 50, backgroundColor: '#2563EB', borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', marginTop: 24,
  },
  ctaText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
