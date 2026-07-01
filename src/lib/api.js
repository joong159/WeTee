import { supabaseMock } from './supabaseMock';

const USE_MOCK = true;

export const api = {
  auth: {
    signUp: (params) => supabaseMock.auth.signUp(params),
    signIn: (params) => supabaseMock.auth.signInWithPassword(params),
    signOut: () => supabaseMock.auth.signOut(),
    getUser: () => supabaseMock.auth.getUser(),
  },
  rooms: {
    getAll: () => supabaseMock.db.getRooms(),
    create: (data, userId) => supabaseMock.db.createRoom(data, userId),
    updateStatus: (roomId, status) => supabaseMock.db.updateRoomStatus(roomId, status),
    updateFare: (roomId, fare, status) => supabaseMock.db.updateRoomFare(roomId, fare, status),
    updateDispatch: (roomId, carNumber, driverPhone) => supabaseMock.db.updateDispatchInfo(roomId, carNumber, driverPhone),
  },
  applicants: {
    getByRoom: (roomId) => supabaseMock.db.getApplicants(roomId),
    apply: (roomId, userId) => supabaseMock.db.applyForRoom(roomId, userId),
    updateStatus: (applicantId, status) => supabaseMock.db.updateApplicantStatus(applicantId, status),
    getMyApplications: (userId) => supabaseMock.db.getMyApplications(userId),
    leave: (roomId, userId) => supabaseMock.db.leaveRoom(roomId, userId),
  },
  chat: {
    getMessages: (roomId) => supabaseMock.db.getMessages(roomId),
    send: (roomId, senderId, content, recipientId) => supabaseMock.db.sendMessage(roomId, senderId, content, recipientId),
  },
  ratings: {
    submit: (params) => supabaseMock.db.submitRating(params),
  },
};
