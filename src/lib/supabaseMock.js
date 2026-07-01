import AsyncStorage from '@react-native-async-storage/async-storage';

const getItem = async (key, defaultValue) => {
  try {
    const item = await AsyncStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch { return defaultValue; }
};

const setItem = async (key, value) => {
  try { await AsyncStorage.setItem(key, JSON.stringify(value)); } catch {}
};

const MOCK_PROFILES = [
  { id: 'user-1', email: 'test1@daejin.ac.kr', student_id: '20201234', gender: '남', university: '대진대학교' },
  { id: 'user-2', email: 'test2@daejin.ac.kr', student_id: '20215678', gender: '여', university: '대진대학교' },
  { id: 'user-3', email: 'test3@daejin.ac.kr', student_id: '20229876', gender: '남', university: '대진대학교' },
];

export async function initMockData() {
  const existing = await AsyncStorage.getItem('mock_profiles');
  if (!existing) {
    await setItem('mock_profiles', MOCK_PROFILES);
    await setItem('mock_rooms', [
      {
        id: 'room-1', created_by: 'user-1',
        departure: '대진대역 1번출구', destination: '대진대 정문',
        departure_time: new Date(Date.now() + 30 * 60000).toISOString(),
        capacity: 4, gender_filter: 'anyone', status: 'recruiting',
        total_fare: 0, bank_account: '국민은행 123-456-789012',
        kakaopay_url: '', created_at: new Date().toISOString(),
      },
      {
        id: 'room-2', created_by: 'user-2',
        departure: '포천터미널', destination: '대진대 공학관',
        departure_time: new Date(Date.now() + 60 * 60000).toISOString(),
        capacity: 3, gender_filter: 'same_gender', status: 'recruiting',
        total_fare: 0, bank_account: '신한은행 987-654-321098',
        kakaopay_url: '', created_at: new Date().toISOString(),
      },
    ]);
    await setItem('mock_applicants', [
      { id: 'app-1', room_id: 'room-1', user_id: 'user-3', status: 'accepted', created_at: new Date().toISOString() },
    ]);
    await setItem('mock_chats', [
      { id: 'msg-1', room_id: 'room-1', sender_id: 'user-1', content: '안녕하세요! 대진대역 1번출구 다이소 앞에서 만나요.', created_at: new Date(Date.now() - 300000).toISOString() },
    ]);
    await setItem('mock_ratings', []);
  }
}

export const supabaseMock = {
  auth: {
    signUp: async ({ email, password, options }) => {
      const phone = options?.data?.phone || '';
      const gender = options?.data?.gender || '남';
      const profiles = await getItem('mock_profiles', []);
      if (profiles.some(p => p.email === email))
        return { data: null, error: { message: '이미 가입된 이메일입니다.' } };
      const userId = 'user-' + Math.random().toString(36).substr(2, 9);
      profiles.push({ id: userId, email, phone, gender });
      await setItem('mock_profiles', profiles);
      const session = { user: { id: userId, email, user_metadata: { phone, gender } } };
      await setItem('mock_current_session', session);
      return { data: session, error: null };
    },
    signInWithPassword: async ({ email }) => {
      const profiles = await getItem('mock_profiles', []);
      const profile = profiles.find(p => p.email === email);
      if (!profile) return { data: null, error: { message: '가입되지 않은 이메일이거나 비밀번호가 틀렸습니다.' } };
      const session = { user: { id: profile.id, email, user_metadata: { phone: profile.phone, gender: profile.gender } } };
      await setItem('mock_current_session', session);
      return { data: session, error: null };
    },
    signOut: async () => { await AsyncStorage.removeItem('mock_current_session'); return { error: null }; },
    getUser: async () => {
      const session = await getItem('mock_current_session', null);
      return { data: session, error: null };
    },
  },
  db: {
    getRooms: async () => {
      const rooms = await getItem('mock_rooms', []);
      const profiles = await getItem('mock_profiles', []);
      const applicants = await getItem('mock_applicants', []);
      return rooms.map(room => {
        const host = profiles.find(p => p.id === room.created_by) || { id: room.created_by, student_id: '알수없음', gender: '남' };
        const accepted = applicants.filter(a => a.room_id === room.id && a.status === 'accepted');
        return { ...room, host, participant_count: accepted.length + 1, accepted_user_ids: [room.created_by, ...accepted.map(a => a.user_id)] };
      }).sort((a, b) => new Date(a.departure_time) - new Date(b.departure_time));
    },
    createRoom: async (roomData, userId) => {
      const rooms = await getItem('mock_rooms', []);
      const newRoom = { id: 'room-' + Math.random().toString(36).substr(2, 9), created_by: userId, ...roomData, status: 'recruiting', total_fare: 0, estimated_fare: roomData.estimated_fare || 0, created_at: new Date().toISOString() };
      rooms.push(newRoom);
      await setItem('mock_rooms', rooms);
      return { data: newRoom, error: null };
    },
    updateRoomStatus: async (roomId, status) => {
      const rooms = await getItem('mock_rooms', []);
      const idx = rooms.findIndex(r => r.id === roomId);
      if (idx > -1) { rooms[idx].status = status; await setItem('mock_rooms', rooms); return { data: rooms[idx], error: null }; }
      return { data: null, error: { message: '방을 찾을 수 없습니다.' } };
    },
    updateRoomFare: async (roomId, fare, status = 'settlement') => {
      const rooms = await getItem('mock_rooms', []);
      const idx = rooms.findIndex(r => r.id === roomId);
      if (idx > -1) { rooms[idx].total_fare = parseInt(fare) || 0; rooms[idx].status = status; await setItem('mock_rooms', rooms); return { data: rooms[idx], error: null }; }
      return { data: null, error: { message: '방을 찾을 수 없습니다.' } };
    },
    updateDispatchInfo: async (roomId, carNumber, driverPhone) => {
      const rooms = await getItem('mock_rooms', []);
      const idx = rooms.findIndex(r => r.id === roomId);
      if (idx > -1) { rooms[idx].car_number = carNumber; rooms[idx].driver_phone = driverPhone; await setItem('mock_rooms', rooms); return { data: rooms[idx], error: null }; }
      return { data: null, error: { message: '방을 찾을 수 없습니다.' } };
    },
    getApplicants: async (roomId) => {
      const applicants = await getItem('mock_applicants', []);
      const profiles = await getItem('mock_profiles', []);
      return applicants.filter(a => a.room_id === roomId).map(a => {
        const user = profiles.find(p => p.id === a.user_id) || { id: a.user_id, student_id: '알수없음', gender: '남' };
        return { ...a, user };
      });
    },
    applyForRoom: async (roomId, userId) => {
      const applicants = await getItem('mock_applicants', []);
      if (applicants.some(a => a.room_id === roomId && a.user_id === userId)) return { error: { message: '이미 신청한 방입니다.' } };
      const newApp = { id: 'app-' + Math.random().toString(36).substr(2, 9), room_id: roomId, user_id: userId, status: 'pending', created_at: new Date().toISOString() };
      applicants.push(newApp);
      await setItem('mock_applicants', applicants);
      return { data: newApp, error: null };
    },
    updateApplicantStatus: async (applicantId, status) => {
      const applicants = await getItem('mock_applicants', []);
      const idx = applicants.findIndex(a => a.id === applicantId);
      if (idx > -1) { applicants[idx].status = status; await setItem('mock_applicants', applicants); return { data: applicants[idx], error: null }; }
      return { error: { message: '신청 항목을 찾을 수 없습니다.' } };
    },
    getMessages: async (roomId) => {
      const chats = await getItem('mock_chats', []);
      const profiles = await getItem('mock_profiles', []);
      return chats.filter(c => c.room_id === roomId).map(c => {
        const sender = profiles.find(p => p.id === c.sender_id) || { student_id: '알수없음' };
        return { ...c, sender };
      });
    },
    sendMessage: async (roomId, senderId, content, recipientId = null) => {
      const chats = await getItem('mock_chats', []);
      const newMsg = { id: 'msg-' + Math.random().toString(36).substr(2, 9), room_id: roomId, sender_id: senderId, recipient_id: recipientId, content, created_at: new Date().toISOString() };
      chats.push(newMsg);
      await setItem('mock_chats', chats);
      return { data: newMsg, error: null };
    },
    getMyApplications: async (userId) => {
      const applicants = await getItem('mock_applicants', []);
      const rooms = await getItem('mock_rooms', []);
      const profiles = await getItem('mock_profiles', []);
      return applicants.filter(a => a.user_id === userId).map(a => {
        const room = rooms.find(r => r.id === a.room_id);
        if (!room) return null;
        const host = profiles.find(p => p.id === room.created_by) || { student_id: '알수없음', gender: '남' };
        const accepted = applicants.filter(ap => ap.room_id === room.id && ap.status === 'accepted');
        return { ...a, room: { ...room, host, participant_count: accepted.length + 1, accepted_user_ids: [room.created_by, ...accepted.map(ap => ap.user_id)] } };
      }).filter(Boolean);
    },
    leaveRoom: async (roomId, userId) => {
      const applicants = await getItem('mock_applicants', []);
      await setItem('mock_applicants', applicants.filter(a => !(a.room_id === roomId && a.user_id === userId)));
      return { data: null, error: null };
    },
    submitRating: async ({ room_id, rater_id, ratee_id, score }) => {
      const ratings = await getItem('mock_ratings', []);
      if (ratings.some(r => r.room_id === room_id && r.rater_id === rater_id && r.ratee_id === ratee_id)) return { error: { message: '이미 평가한 사용자입니다.' } };
      ratings.push({ id: 'rating-' + Math.random().toString(36).substr(2, 9), room_id, rater_id, ratee_id, score, created_at: new Date().toISOString() });
      await setItem('mock_ratings', ratings);
      return { data: null, error: null };
    },
  },
};
