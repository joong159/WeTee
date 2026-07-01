import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const REST_KEY = '12d2315e45f31eea37e639a1979a963b';

function categoryIcon(cat) {
  if (!cat) return '📍';
  if (cat.includes('지하철') || cat.includes('역')) return '🚇';
  if (cat.includes('버스')) return '🚌';
  if (cat.includes('대학') || cat.includes('학교')) return '🏫';
  if (cat.includes('병원') || cat.includes('의원') || cat.includes('약국')) return '🏥';
  if (cat.includes('카페') || cat.includes('커피')) return '☕';
  if (cat.includes('편의점') || cat.includes('마트')) return '🏪';
  if (cat.includes('음식') || cat.includes('식당') || cat.includes('맛집')) return '🍽️';
  if (cat.includes('주차')) return '🅿️';
  if (cat.includes('공원')) return '🌳';
  if (cat.includes('숙박') || cat.includes('호텔')) return '🏨';
  return '📍';
}

function shortCategory(cat) {
  if (!cat) return '';
  const parts = cat.split('>');
  return parts[parts.length - 1].trim();
}

export default function PlaceSearchScreen({ navigation, route }) {
  const { title, onSelect } = route.params;
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState(null);
  const inputRef  = useRef(null);
  const debounce  = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(t);
  }, []);

  const handleChange = (text) => {
    setQuery(text);
    if (debounce.current) clearTimeout(debounce.current);
    if (!text.trim()) { setResults([]); setApiError(null); return; }
    debounce.current = setTimeout(() => doSearch(text.trim()), 280);
  };

  const doSearch = async (q) => {
    setLoading(true);
    setApiError(null);
    try {
      const r = await fetch(
        'https://dapi.kakao.com/v2/local/search/keyword.json?query='
          + encodeURIComponent(q) + '&size=15',
        { headers: { Authorization: 'KakaoAK ' + REST_KEY } }
      );
      const data = await r.json();
      if (data.errorType || data.code || !r.ok) {
        const msg = data.message || data.errorType || `HTTP ${r.status}`;
        setApiError(msg);
        setResults([]);
      } else {
        setResults(data.documents || []);
      }
    } catch (e) {
      setApiError('네트워크 오류: ' + e.message);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (place) => {
    onSelect({
      name:   place.place_name,
      coords: { lat: parseFloat(place.y), lng: parseFloat(place.x) },
    });
    navigation.goBack();
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.item} onPress={() => handleSelect(item)} activeOpacity={0.65}>
      <View style={styles.iconWrap}>
        <Text style={styles.iconEmoji}>{categoryIcon(item.category_name)}</Text>
      </View>
      <View style={styles.itemInfo}>
        <Text style={styles.itemName} numberOfLines={1}>{item.place_name}</Text>
        <Text style={styles.itemSub} numberOfLines={1}>
          {shortCategory(item.category_name)}
          {item.category_name && (item.road_address_name || item.address_name) ? '  ·  ' : ''}
          {item.road_address_name || item.address_name}
        </Text>
      </View>
      <Text style={styles.itemArrow}>›</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* ── 검색 헤더 ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <View style={styles.searchBar}>
          <Text style={styles.searchMag}>🔍</Text>
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            placeholder={title}
            placeholderTextColor="#9CA3AF"
            value={query}
            onChangeText={handleChange}
            returnKeyType="search"
            autoCorrect={false}
            clearButtonMode="never"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => { setQuery(''); setResults([]); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <View style={styles.clearCircle}><Text style={styles.clearText}>✕</Text></View>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── 결과 ── */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>검색 중...</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={results.length === 0 ? { flex: 1 } : null}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          ListEmptyComponent={
            <View style={styles.center}>
              {apiError ? (
                <>
                  <Text style={styles.emptyEmoji}>⚠️</Text>
                  <Text style={styles.emptyTitle}>API 오류</Text>
                  <Text style={[styles.emptySub, { color: '#EF4444', marginBottom: 10, textAlign: 'center', paddingHorizontal: 32 }]}>{apiError}</Text>
                  <Text style={[styles.emptySub, { textAlign: 'center', paddingHorizontal: 32 }]}>
                    카카오 개발자 콘솔 → 내 앱 → 제품 설정 → 카카오맵 활성화 필요
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.emptyEmoji}>{query ? '😔' : '🗺️'}</Text>
                  <Text style={styles.emptyTitle}>
                    {query ? '검색 결과가 없어요' : '장소를 검색해보세요'}
                  </Text>
                  <Text style={styles.emptySub}>
                    {query ? '다른 검색어를 입력해보세요' : '지하철역, 건물명, 주소 등'}
                  </Text>
                </>
              )}
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },

  /* 헤더 */
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
  },
  backBtn: { paddingRight: 4 },
  backArrow: { fontSize: 32, color: '#111827', lineHeight: 36, marginTop: -2 },
  searchBar: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F3F4F6', borderRadius: 14,
    paddingHorizontal: 14, height: 48, gap: 8,
  },
  searchMag: { fontSize: 16 },
  searchInput: { flex: 1, fontSize: 16, color: '#111827', padding: 0 },
  clearCircle: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center',
  },
  clearText: { fontSize: 10, color: '#6B7280', fontWeight: '700' },

  /* 결과 아이템 */
  item: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14, gap: 14,
  },
  iconWrap: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center',
  },
  iconEmoji: { fontSize: 22 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 3 },
  itemSub: { fontSize: 12, color: '#9CA3AF', lineHeight: 16 },
  itemArrow: { fontSize: 22, color: '#D1D5DB' },
  sep: { height: 1, backgroundColor: '#F9FAFB', marginLeft: 78 },

  /* 빈 상태 / 로딩 */
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 60 },
  loadingText: { marginTop: 10, fontSize: 14, color: '#9CA3AF' },
  emptyEmoji: { fontSize: 48, marginBottom: 14 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#374151', marginBottom: 6 },
  emptySub: { fontSize: 13, color: '#9CA3AF' },
});
