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

// 중간 합류 금액 계산: 각 사람의 탑승 비율에 따라 금액 분배
function calcFareShare(totalFare, participants) {
  if (!participants || participants.length === 0) return 0;
  const totalRatio = participants.reduce((sum, p) => sum + (p.rideRatio || 1), 0);
  return participants.map(p => ({
    ...p,
    share: Math.ceil(totalFare * (p.rideRatio || 1) / totalRatio),
  }));
}

export default function ChatRoomScreen({ route, navigation }) {
  const { room: initialRoom, currentUser } = route.params;
  const [room, setRoom] = useState(initialRoom);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [applicants, setApplicants] = useState([]);
  const [myApplication, setMyApplication] = useState(null);
  const [infoExpanded, setInfoExpanded] = useState(true);
  const [selectedPartnerId, setSelectedPartnerId] = useState(null);
  const flatListRef = useRef(null);
  const pollRef = useRef(null);

  const isHost = room.created_by === currentUser?.id;
  const isParticipant = room.accepted_user_ids?.includes(currentUser?.id) && !isHost;
  const canChat = isHost || isParticipant;

  // 1:1 채팅 상대: 참여자이면 항상 호스트, 호스트이면 선택된 참여자
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

  // 1:1 메시지 필터: 나 ↔ 상대방 메시지만 표시
  const filteredMessages = partnerId
    ? messages.filter(m =>
        (m.sender_id === currentUser?.id && m.recipient_id === partnerId) ||
        (m.sender_id === partnerId && m.recipient_id === currentUser?.id)
      )
    : [];

  const handleApply = async () => {
    if (!currentUser) return Alert.alert('오류', '로그인이 필요합니다.');
    const { error } = await api.applicants.apply(room.id, currentUser.id);
    if (error) return Alert.alert('오류', error.message);
    Alert.alert('신청 완료', '호스트 승인을 기다려주세요.');
    loadData();
  };

  const handleSend = async () => {
    const content = inputText.trim();
    if (!content || !canChat || !partnerId) return;
    setInputText('');
    const { error } = await api.chat.send(room.id, currentUser?.id || '', content, partnerId);
    if (!error) loadData();
  };

  const handleKakaoMap = () => {
    navigation.navigate('KakaoMap', {
      departure: room.departure,
      destination: room.destination,
      estimatedFare: room.estimated_fare || 0,
      capacity: room.capacity || 4,
    });
  };

  const handleToss = () => {
    const perPerson = room.participant_count > 0 && room.total_fare > 0
      ? Math.ceil(room.total_fare / room.participant_count) : 0;
    const account = room.bank_account || '';
    const parts = account.split(' ');
    const url = `supertoss://send?amount=${perPerson}&bank=${encodeURIComponent(parts[0] || '')}&accountNumber=${parts[1] || ''}&origin=qr&recipient=${encodeURIComponent(parts[2] || '')}&memo=${encodeURIComponent('위티 택시비')}`;
    Linking.openURL(url).catch(() => {
      Linking.openURL('https://toss.im').catch(() => Alert.alert('오류', '토스 앱을 열 수 없습니다.'));
    });
  };

  const estimatedPerPerson = room.estimated_fare && room.capacity
    ? Math.ceil(room.estimated_fare / room.capacity) : 0;
  const actualPerPerson = room.participant_count > 0 && room.total_fare > 0
    ? Math.ceil(room.total_fare / room.participant_count) : 0;

  // 호스트용: 수락된 참여자 목록
  const acceptedApplicants = applicants.filter(a => a.status === 'accepted');

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

  // 호스트가 참여자를 아직 선택하지 않은 경우: 참여자 목록 표시
  if (isHost && !selectedPartnerId) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        {/* 방 정보 */}
        <TouchableOpacity style={styles.infoCard} onPress={() => setInfoExpanded(v => !v)} activeOpacity={0.8}>
          <View style={styles.infoCardHeader}>
            <Text style={styles.infoRoute}>{room.departure} → {room.destination}</Text>
            <Text style={styles.infoToggle}>{infoExpanded ? '▲' : '▼'}</Text>
          </View>
          {infoExpanded && (
            <View style={styles.infoDetails}>
              <InfoRow label="상태" value={STATUS_LABELS[room.status] || room.status} />
              <InfoRow label="인원" value={`${room.participant_count}/${room.capacity}명`} />
              {estimatedPerPerson > 0 && (
                <InfoRow label="예상 1인 부담" value={`약 ${estimatedPerPerson.toLocaleString()}원`} />
              )}
              {actualPerPerson > 0 && (
                <InfoRow label="실제 1인 부담" value={`${actualPerPerson.toLocaleString()}원`} />
              )}
              <TouchableOpacity style={styles.kakaoMapBtn} onPress={handleKakaoMap}>
                <Text style={styles.kakaoMapBtnText}>카카오맵으로 경로 보기</Text>
              </TouchableOpacity>
            </View>
          )}
        </TouchableOpacity>

        {/* 참여자 선택 */}
        <View style={styles.partnerListHeader}>
          <Text style={styles.partnerListTitle}>참여자와 1:1 대화</Text>
        </View>
        <ScrollView style={styles.partnerList}>
          {acceptedApplicants.length === 0 ? (
            <View style={styles.emptyMsgs}>
              <Text style={styles.emptyMsgsText}>아직 참여자가 없어요</Text>
            </View>
          ) : (
            acceptedApplicants.map(app => (
              <TouchableOpacity
                key={app.id}
                style={styles.partnerItem}
                onPress={() => setSelectedPartnerId(app.user_id)}
              >
                <View style={styles.partnerAvatar}>
                  <Text style={styles.partnerAvatarText}>
                    {(app.user?.student_id || app.user?.phone || '?').slice(-2)}
                  </Text>
                </View>
                <View>
                  <Text style={styles.partnerName}>{app.user?.phone || app.user?.student_id}</Text>
                  <Text style={styles.partnerSub}>{app.user?.gender === '여' ? '여성' : '남성'}</Text>
                </View>
                <Text style={styles.partnerArrow}>›</Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        {/* 뒤로가기 (호스트용) */}
        {isHost && (
          <TouchableOpacity style={styles.backBar} onPress={() => setSelectedPartnerId(null)}>
            <Text style={styles.backBarText}>← 참여자 목록으로</Text>
          </TouchableOpacity>
        )}

        {/* 방 정보 카드 */}
        <TouchableOpacity style={styles.infoCard} onPress={() => setInfoExpanded(v => !v)} activeOpacity={0.8}>
          <View style={styles.infoCardHeader}>
            <Text style={styles.infoRoute}>{room.departure} → {room.destination}</Text>
            <Text style={styles.infoToggle}>{infoExpanded ? '▲' : '▼'}</Text>
          </View>
          {infoExpanded && (
            <View style={styles.infoDetails}>
              <InfoRow label="상태" value={STATUS_LABELS[room.status] || room.status} />
              <InfoRow label="인원" value={`${room.participant_count}/${room.capacity}명`} />
              {estimatedPerPerson > 0 && (
                <InfoRow label="예상 1인 부담" value={`약 ${estimatedPerPerson.toLocaleString()}원`} />
              )}
              {actualPerPerson > 0 && (
                <InfoRow label="실제 1인 부담" value={`${actualPerPerson.toLocaleString()}원`} />
              )}
              {room.bank_account && <InfoRow label="계좌" value={room.bank_account} />}
              <TouchableOpacity style={styles.kakaoMapBtn} onPress={handleKakaoMap}>
                <Text style={styles.kakaoMapBtnText}>카카오맵으로 경로 보기</Text>
              </TouchableOpacity>
              {room.status === 'settlement' && actualPerPerson > 0 && (
                <TouchableOpacity style={styles.tossBtn} onPress={handleToss}>
                  <Text style={styles.tossBtnText}>토스로 {actualPerPerson.toLocaleString()}원 보내기</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </TouchableOpacity>

        {/* 메시지 */}
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

        {/* 입력창 또는 신청 버튼 */}
        {canChat ? (
          <View style={styles.inputBar}>
            <TextInput
              style={styles.chatInput}
              placeholder="메시지 입력..."
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
        ) : myApplication ? (
          <View style={styles.pendingBar}>
            <Text style={styles.pendingText}>
              {myApplication.status === 'pending' ? '호스트 승인 대기중' : '신청이 거절되었습니다'}
            </Text>
          </View>
        ) : (
          room.status === 'recruiting' && room.participant_count < room.capacity && (
            <TouchableOpacity style={styles.applyBtn} onPress={handleApply}>
              <Text style={styles.applyBtnText}>참여 신청하기</Text>
            </TouchableOpacity>
          )
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
  tossBtn: {
    marginTop: 6, backgroundColor: '#0064FF', borderRadius: 10,
    paddingVertical: 10, alignItems: 'center',
  },
  tossBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  partnerListHeader: {
    backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#EAEAEA',
  },
  partnerListTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  partnerList: { flex: 1 },
  partnerItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F4F5F7',
  },
  partnerAvatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#EFF6FF',
    alignItems: 'center', justifyContent: 'center',
  },
  partnerAvatarText: { fontSize: 14, fontWeight: '700', color: '#2563EB' },
  partnerName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  partnerSub: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  partnerArrow: { marginLeft: 'auto', fontSize: 20, color: '#D1D5DB' },
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
  bubble: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, maxWidth: '100%' },
  bubbleMine: { backgroundColor: '#2563EB', borderBottomRightRadius: 4 },
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
