import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform, Alert, Linking, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../lib/api';

const STATUS_LABELS = {
  recruiting: '모집중', full: '마감', in_progress: '이동중',
  settlement: '정산중', completed: '완료',
};

function haversineKm(a, b) {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const s = Math.sin(dLat / 2) ** 2
    + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180)
    * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

// 탑승 좌표 기반 탑승 비율 계산 (0.1 ~ 1.0)
function calcRideRatio(room, boardingLat, boardingLng) {
  if (!room.dep_lat || !room.dest_lat || !boardingLat) return 1.0;
  const dep  = { lat: room.dep_lat,  lng: room.dep_lng  };
  const dest = { lat: room.dest_lat, lng: room.dest_lng };
  const boarding = { lat: boardingLat, lng: boardingLng };
  const total = haversineKm(dep, dest);
  if (total === 0) return 1.0;
  const depToBoarding = haversineKm(dep, boarding);
  return Math.max(0.1, Math.min(1.0, 1 - depToBoarding / total));
}

// 비율 기반 정산: 각자의 탑승 비율에 따라 분배
function splitFareByRatio(totalFare, participants) {
  const totalRatio = participants.reduce((s, p) => s + p.ratio, 0);
  return participants.map(p => ({
    ...p,
    share: totalRatio > 0 ? Math.ceil(totalFare * p.ratio / totalRatio) : Math.ceil(totalFare / participants.length),
  }));
}

function formatTime(iso) {
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function InfoRow({ label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export default function ChatRoomScreen({ route, navigation }) {
  const { room: initialRoom, currentUser, userDepCoords } = route.params;
  const [room, setRoom]             = useState(initialRoom);
  const [messages, setMessages]     = useState([]);
  const [inputText, setInputText]   = useState('');
  const [applicants, setApplicants] = useState([]);
  const [myApplication, setMyApplication] = useState(null);
  const [infoExpanded, setInfoExpanded]   = useState(true);
  const [selectedPartnerId, setSelectedPartnerId] = useState(null);
  const [showSettlement, setShowSettlement] = useState(false);
  const [settleFare, setSettleFare] = useState('');
  const flatListRef = useRef(null);
  const pollRef    = useRef(null);

  const isHost       = room.created_by === currentUser?.id;
  const isParticipant = room.accepted_user_ids?.includes(currentUser?.id) && !isHost;
  // 호스트도 채팅 가능 (파트너 선택 후 채팅창에서)
  const canChat = !!currentUser;
  const partnerId = isHost ? selectedPartnerId : room.created_by;

  const loadData = useCallback(async () => {
    const msgs = await api.chat.getMessages(room.id);
    setMessages(msgs || []);
    const apps = await api.applicants.getByRoom(room.id);
    setApplicants(apps || []);
    const myApps = await api.applicants.getMyApplications(currentUser?.id || '');
    const mine = myApps?.find(a => a.room?.id === room.id);
    setMyApplication(mine || null);
  }, [room.id, currentUser?.id]);

  useEffect(() => {
    loadData();
    pollRef.current = setInterval(loadData, 5000);
    return () => clearInterval(pollRef.current);
  }, [loadData]);

  const filteredMessages = partnerId
    ? messages.filter(m =>
        (m.sender_id === currentUser?.id && m.recipient_id === partnerId) ||
        (m.sender_id === partnerId        && m.recipient_id === currentUser?.id)
      )
    : [];

  const handleApplicantAction = async (applicantId, status) => {
    const { error } = await api.applicants.updateStatus(applicantId, status);
    if (error) return Alert.alert('오류', error.message);
    loadData();
  };

  const handleApply = async () => {
    if (!currentUser) return Alert.alert('오류', '로그인이 필요합니다.');
    const { error } = await api.applicants.apply(room.id, currentUser.id, userDepCoords || null);
    if (error) return Alert.alert('오류', error.message);
    Alert.alert('신청 완료', '호스트 승인을 기다려주세요.');
    loadData();
  };

  const handleSend = async () => {
    const content = inputText.trim();
    if (!content || !canChat || !partnerId) return;
    setInputText('');
    await api.chat.send(room.id, currentUser?.id || '', content, partnerId);
    loadData();
  };

  const handleKakaoMap = () => {
    navigation.navigate('KakaoMap', {
      departure: room.departure,
      destination: room.destination,
      estimatedFare: room.estimated_fare || 0,
      capacity: room.capacity || 4,
    });
  };

  const handleKakaoPay = (amount) => {
    const link = room.kakaopay_link || '';
    if (!link) return Alert.alert('카카오페이 링크 없음', '호스트가 카카오페이 링크를 등록하지 않았어요.');
    Linking.openURL(link).catch(() =>
      Alert.alert('오류', '카카오페이 앱을 열 수 없습니다.')
    );
  };

  const handleSettleConfirm = async () => {
    const fare = parseInt(settleFare.replace(/[^0-9]/g, '')) || 0;
    if (!fare) return Alert.alert('오류', '실제 요금을 입력해주세요.');
    await api.rooms.updateFare(room.id, fare, 'settlement');
    Alert.alert('정산 시작', '참여자들에게 카카오페이로 송금 요청을 보내세요.');
    setShowSettlement(false);
    setRoom(r => ({ ...r, total_fare: fare, status: 'settlement' }));
  };

  const estimatedPerPerson = room.estimated_fare && room.capacity
    ? Math.ceil(room.estimated_fare / room.capacity) : 0;
  const actualPerPerson = room.participant_count > 0 && room.total_fare > 0
    ? Math.ceil(room.total_fare / room.participant_count) : 0;

  const acceptedApplicants = applicants.filter(a => a.status === 'accepted');
  const allApplicants      = applicants;

  // 정산 참여자 목록 (호스트 + 수락된 신청자)
  const settleParticipants = [
    { userId: room.created_by, name: '호스트 (나)', ratio: 1.0, boarding_lat: null },
    ...acceptedApplicants.map(a => ({
      userId: a.user_id,
      name: a.user?.phone || a.user?.student_id || '참여자',
      boarding_lat: a.boarding_lat,
      boarding_lng: a.boarding_lng,
      ratio: calcRideRatio(room, a.boarding_lat, a.boarding_lng),
    })),
  ];
  const settleFareNum = parseInt(settleFare.replace(/[^0-9]/g, '')) || room.total_fare || 0;
  const splitResult = splitFareByRatio(settleFareNum, settleParticipants);

  const renderMessage = ({ item }) => {
    const isMine = item.sender_id === currentUser?.id;
    return (
      <View style={[styles.msgRow, isMine ? styles.msgRowMine : styles.msgRowOther]}>
        {!isMine && (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(item.sender?.student_id || item.sender?.phone || '?').slice(-2)}</Text>
          </View>
        )}
        <View style={{ maxWidth: '72%' }}>
          {!isMine && <Text style={styles.senderName}>{item.sender?.phone || item.sender?.student_id}</Text>}
          <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
            <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>{item.content}</Text>
          </View>
          <Text style={[styles.timeLabel, isMine && { textAlign: 'right' }]}>{formatTime(item.created_at)}</Text>
        </View>
      </View>
    );
  };

  // 방 정보 카드 (공통)
  const InfoCard = () => (
    <TouchableOpacity style={styles.infoCard} onPress={() => setInfoExpanded(v => !v)} activeOpacity={0.8}>
      <View style={styles.infoCardHeader}>
        <Text style={styles.infoRoute}>{room.departure} → {room.destination}</Text>
        <Text style={styles.infoToggle}>{infoExpanded ? '▲' : '▼'}</Text>
      </View>
      {infoExpanded && (
        <View style={styles.infoDetails}>
          <InfoRow label="상태"   value={STATUS_LABELS[room.status] || room.status} />
          <InfoRow label="인원"   value={`${room.participant_count}/${room.capacity}명`} />
          {room.estimated_fare > 0 && (
            <InfoRow label="예상 총 요금"  value={`약 ${room.estimated_fare.toLocaleString()}원`} />
          )}
          {estimatedPerPerson > 0 && (
            <InfoRow label="예상 인당 금액" value={`약 ${estimatedPerPerson.toLocaleString()}원`} />
          )}
          {room.total_fare > 0 && (
            <InfoRow label="실제 총 요금"  value={`${room.total_fare.toLocaleString()}원`} />
          )}
          {actualPerPerson > 0 && (
            <InfoRow label="실제 인당 금액" value={`${actualPerPerson.toLocaleString()}원`} />
          )}
          <TouchableOpacity style={styles.kakaoMapBtn} onPress={handleKakaoMap}>
            <Text style={styles.kakaoMapBtnText}>카카오맵으로 경로 보기</Text>
          </TouchableOpacity>
          {room.kakaopay_link ? (
            <TouchableOpacity style={styles.kakaoPayBtn} onPress={() => handleKakaoPay(actualPerPerson || estimatedPerPerson)}>
              <Text style={styles.kakaoPayBtnText}>
                카카오페이로 정산
                {(actualPerPerson || estimatedPerPerson) > 0
                  ? `  ${(actualPerPerson || estimatedPerPerson).toLocaleString()}원` : ''}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}
    </TouchableOpacity>
  );

  // ── 정산 패널 (호스트) ──────────────────────────────────
  if (isHost && showSettlement) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <InfoCard />
        <View style={styles.settleHeader}>
          <TouchableOpacity onPress={() => setShowSettlement(false)}>
            <Text style={styles.backBarText}>← 뒤로</Text>
          </TouchableOpacity>
          <Text style={styles.settleTitle}>중간 합류 정산</Text>
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.settleScroll}>
          {/* 실제 요금 입력 */}
          <Text style={styles.settleSection}>실제 택시 요금</Text>
          <View style={styles.settleInputRow}>
            <TextInput
              style={styles.settleInput}
              placeholder="실제 요금 입력 (원)"
              placeholderTextColor="#9CA3AF"
              keyboardType="number-pad"
              value={settleFare}
              onChangeText={setSettleFare}
            />
          </View>

          {/* 참여자별 금액 */}
          <Text style={styles.settleSection}>참여자별 부담 금액</Text>
          <View style={styles.settleCard}>
            {splitResult.map((p, i) => {
              const ratioPercent = Math.round(p.ratio * 100);
              const hasBoardingPoint = p.boarding_lat && p.boarding_lat !== room.dep_lat;
              return (
                <View key={p.userId} style={[styles.settleRow, i > 0 && styles.settleRowBorder]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.settlePersonName}>{p.name}</Text>
                    {hasBoardingPoint ? (
                      <Text style={styles.settleBoardingTag}>📍 중간 탑승 · {ratioPercent}% 구간</Text>
                    ) : (
                      <Text style={styles.settleFullTag}>전 구간 탑승</Text>
                    )}
                  </View>
                  <Text style={styles.settleAmount}>
                    {settleFareNum > 0 ? p.share.toLocaleString() + '원' : '-'}
                  </Text>
                </View>
              );
            })}
          </View>

          {settleFareNum > 0 && (
            <Text style={styles.settleSumNote}>
              * 탑승 구간 비율에 따라 계산됩니다 (합계 오차 가능)
            </Text>
          )}

          <TouchableOpacity style={styles.settleConfirmBtn} onPress={handleSettleConfirm}>
            <Text style={styles.settleConfirmText}>정산 시작하기</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── 호스트: 참여자 목록 ────────────────────────────────
  if (isHost && !selectedPartnerId) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <InfoCard />
        <View style={styles.partnerListHeader}>
          <Text style={styles.partnerListTitle}>참여자 목록</Text>
          <View style={styles.headerBtns}>
            <TouchableOpacity style={styles.settleStartBtn} onPress={() => setShowSettlement(true)}>
              <Text style={styles.settleStartText}>정산</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.settleStartBtn, { backgroundColor: '#F3F4F6', marginLeft: 6 }]}
              onPress={() => navigation.navigate('ManageRoom', { room, currentUser })}
            >
              <Text style={[styles.settleStartText, { color: '#374151' }]}>방 관리</Text>
            </TouchableOpacity>
          </View>
        </View>
        <ScrollView style={styles.partnerList}>
          {allApplicants.length === 0 ? (
            <View style={styles.emptyMsgs}>
              <Text style={styles.emptyMsgsText}>아직 신청자가 없어요</Text>
            </View>
          ) : (
            allApplicants.map(app => {
              const ratio = calcRideRatio(room, app.boarding_lat, app.boarding_lng);
              const hasMidJoin = app.boarding_lat && ratio < 0.99;
              const isPending = app.status === 'pending';
              return (
                <View key={app.id} style={styles.partnerItem}>
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 }}
                    onPress={() => setSelectedPartnerId(app.user_id)}
                  >
                    <View style={styles.partnerAvatar}>
                      <Text style={styles.partnerAvatarText}>
                        {(app.user?.student_id || app.user?.phone || '?').slice(-2)}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.partnerName}>{app.user?.phone || app.user?.student_id}</Text>
                      <Text style={styles.partnerSub}>
                        {hasMidJoin
                          ? `📍 중간 탑승 (${Math.round(ratio * 100)}% 구간)`
                          : app.user?.gender === '여' ? '여성' : '남성'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  {isPending ? (
                    <View style={styles.actionBtns}>
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
                  ) : (
                    <View style={[styles.statusPill,
                      app.status === 'accepted' ? styles.statusPillAccepted : styles.statusPillRejected
                    ]}>
                      <Text style={styles.statusPillText}>
                        {app.status === 'accepted' ? '수락' : '거절'}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── 채팅 화면 (호스트 파트너 선택 후 / 일반 참여자) ───
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        {isHost && (
          <TouchableOpacity style={styles.backBar} onPress={() => setSelectedPartnerId(null)}>
            <Text style={styles.backBarText}>← 참여자 목록으로</Text>
          </TouchableOpacity>
        )}

        <InfoCard />

        <FlatList
          ref={flatListRef}
          data={filteredMessages}
          keyExtractor={item => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.msgList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <View style={styles.emptyMsgs}>
              <Text style={styles.emptyMsgsText}>아직 메시지가 없어요. 첫 인사를 해보세요!</Text>
            </View>
          }
        />

        {/* 비참여자 신청 버튼 / 대기 상태 */}
        {!isHost && !isParticipant && (
          myApplication ? (
            <View style={styles.pendingBar}>
              <Text style={styles.pendingText}>
                {myApplication.status === 'pending' ? '⏳ 호스트 승인 대기중' : '❌ 신청이 거절되었습니다'}
              </Text>
            </View>
          ) : (
            room.status === 'recruiting' && room.participant_count < room.capacity && (
              <TouchableOpacity style={styles.applyBtn} onPress={handleApply}>
                <Text style={styles.applyBtnText}>
                  참여 신청하기{userDepCoords ? ' (중간 탑승)' : ''}
                </Text>
              </TouchableOpacity>
            )
          )
        )}

        {/* 채팅 입력 */}
        {canChat && partnerId && (
          <View style={styles.inputBar}>
            <TextInput
              style={styles.chatInput}
              placeholder={isParticipant ? '메시지 입력...' : '호스트에게 문의하기...'}
              placeholderTextColor="#9CA3AF"
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={handleSend}
              returnKeyType="send"
              multiline
            />
            <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
              <Text style={styles.sendBtnText}>전송</Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F5F7' },
  backBar: {
    backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#EAEAEA',
  },
  backBarText: { fontSize: 14, color: '#2563EB', fontWeight: '500' },

  infoCard: { backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#EAEAEA', padding: 14 },
  infoCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoRoute: { fontSize: 14, fontWeight: '700', color: '#111827', flex: 1 },
  infoToggle: { color: '#9CA3AF', fontSize: 12, marginLeft: 8 },
  infoDetails: { marginTop: 10, gap: 6 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between' },
  infoLabel: { fontSize: 12, color: '#9CA3AF', fontWeight: '500' },
  infoValue: { fontSize: 12, color: '#374151', fontWeight: '600' },
  kakaoMapBtn: {
    marginTop: 8, backgroundColor: '#FEE500', borderRadius: 10,
    paddingVertical: 10, alignItems: 'center',
  },
  kakaoMapBtnText: { color: '#111827', fontSize: 14, fontWeight: '700' },
  kakaoPayBtn: {
    marginTop: 6, backgroundColor: '#FEE500', borderRadius: 10,
    paddingVertical: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center',
  },
  kakaoPayBtnText: { color: '#3C1E1E', fontSize: 14, fontWeight: '700' },

  /* 참여자 목록 */
  partnerListHeader: {
    backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#EAEAEA',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  partnerListTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  headerBtns: { flexDirection: 'row', alignItems: 'center' },
  settleStartBtn: {
    backgroundColor: '#EFF6FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
  },
  settleStartText: { fontSize: 13, color: '#2563EB', fontWeight: '600' },
  partnerList: { flex: 1 },
  partnerItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F4F5F7',
  },
  actionBtns: { flexDirection: 'row', gap: 6 },
  acceptBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#D1FAE5', borderRadius: 8 },
  acceptBtnText: { color: '#059669', fontSize: 13, fontWeight: '600' },
  rejectBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#FEE2E2', borderRadius: 8 },
  rejectBtnText: { color: '#EF4444', fontSize: 13, fontWeight: '600' },
  partnerAvatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#EFF6FF',
    alignItems: 'center', justifyContent: 'center',
  },
  partnerAvatarText: { fontSize: 14, fontWeight: '700', color: '#2563EB' },
  partnerName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  partnerSub: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  partnerArrow: { fontSize: 20, color: '#D1D5DB' },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginRight: 6 },
  statusPillPending:  { backgroundColor: '#FEF3C7' },
  statusPillAccepted: { backgroundColor: '#D1FAE5' },
  statusPillRejected: { backgroundColor: '#FEE2E2' },
  statusPillText: { fontSize: 11, fontWeight: '600', color: '#374151' },

  /* 정산 패널 */
  settleHeader: {
    backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#EAEAEA',
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  settleTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  settleScroll: { padding: 16, gap: 12, paddingBottom: 40 },
  settleSection: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 6, marginTop: 8 },
  settleInputRow: { marginBottom: 8 },
  settleInput: {
    height: 48, backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 14,
    color: '#111827', fontSize: 15, borderWidth: 1, borderColor: '#E5E7EB',
  },
  settleCard: {
    backgroundColor: '#FFFFFF', borderRadius: 14,
    borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden',
  },
  settleRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 8 },
  settleRowBorder: { borderTopWidth: 1, borderTopColor: '#F4F5F7' },
  settlePersonName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  settleFullTag:     { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  settleBoardingTag: { fontSize: 11, color: '#7C3AED', fontWeight: '600', marginTop: 2 },
  settleAmount: { fontSize: 16, fontWeight: '800', color: '#2563EB', minWidth: 70, textAlign: 'right' },
  settleSumNote: { fontSize: 11, color: '#9CA3AF', textAlign: 'center', marginTop: 4 },
  settleConfirmBtn: {
    height: 52, backgroundColor: '#2563EB', borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', marginTop: 16,
  },
  settleConfirmText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  /* 채팅 */
  msgList: { padding: 16, gap: 12, paddingBottom: 8 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  msgRowMine: { flexDirection: 'row-reverse' },
  msgRowOther: {},
  avatar: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: '#E5E7EB',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 11, fontWeight: '600', color: '#374151' },
  senderName: { fontSize: 11, color: '#9CA3AF', marginBottom: 3, marginLeft: 2 },
  bubble: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16 },
  bubbleMine:  { backgroundColor: '#2563EB', borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: '#FFFFFF', borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 14, color: '#111827', lineHeight: 20 },
  bubbleTextMine: { color: '#FFFFFF' },
  timeLabel: { fontSize: 10, color: '#9CA3AF', marginTop: 3, marginHorizontal: 4 },
  emptyMsgs: { alignItems: 'center', paddingTop: 40 },
  emptyMsgsText: { color: '#9CA3AF', fontSize: 13 },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', backgroundColor: '#FFFFFF',
    borderTopWidth: 1, borderTopColor: '#EAEAEA', padding: 10, gap: 8,
  },
  chatInput: {
    flex: 1, minHeight: 40, maxHeight: 100, backgroundColor: '#F4F5F7',
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10,
    color: '#111827', fontSize: 14,
  },
  sendBtn: {
    height: 40, paddingHorizontal: 16, backgroundColor: '#2563EB',
    borderRadius: 20, alignItems: 'center', justifyContent: 'center',
  },
  sendBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  pendingBar: {
    backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#EAEAEA',
    padding: 16, alignItems: 'center',
  },
  pendingText: { color: '#9CA3AF', fontSize: 14 },
  applyBtn: {
    backgroundColor: '#2563EB', margin: 16, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  applyBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});
