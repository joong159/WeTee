import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../lib/api';

export default function LoginScreen({ onLogin }) {
  const [tab, setTab] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState('남');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) return Alert.alert('오류', '이메일과 비밀번호를 입력해주세요.');
    setLoading(true);
    const { data, error } = await api.auth.signIn({ email, password });
    setLoading(false);
    if (error) return Alert.alert('로그인 실패', error.message);
    onLogin(data.user);
  };

  const handleSignup = async () => {
    if (!email || !password || !phone) return Alert.alert('오류', '모든 항목을 입력해주세요.');
    if (password.length < 6) return Alert.alert('오류', '비밀번호는 6자 이상이어야 합니다.');
    if (phone.replace(/-/g, '').length < 10) return Alert.alert('오류', '올바른 휴대폰 번호를 입력해주세요.');
    setLoading(true);
    const { data, error } = await api.auth.signUp({
      email, password,
      options: { data: { phone, gender } },
    });
    setLoading(false);
    if (error) return Alert.alert('가입 실패', error.message);
    Alert.alert('가입 완료', '환영합니다!', [{ text: '확인', onPress: () => onLogin(data.user) }]);
  };

  const formatPhone = (text) => {
    const digits = text.replace(/\D/g, '');
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Hero */}
          <View style={styles.hero}>
            <View style={styles.logoMark}>
              <Text style={styles.logoMarkText}>W</Text>
            </View>
            <Text style={styles.brandName}>위티</Text>
            <Text style={styles.brandSub}>대학생 택시 동승 매칭</Text>
          </View>

          {/* Tabs */}
          <View style={styles.tabs}>
            {['login', 'signup'].map(t => (
              <TouchableOpacity key={t} style={styles.tab} onPress={() => setTab(t)} activeOpacity={0.7}>
                <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                  {t === 'login' ? '로그인' : '회원가입'}
                </Text>
                {tab === t && <View style={styles.tabUnderline} />}
              </TouchableOpacity>
            ))}
          </View>

          {/* Form */}
          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="이메일"
              placeholderTextColor="#9CA3AF"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TextInput
              style={styles.input}
              placeholder="비밀번호"
              placeholderTextColor="#9CA3AF"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            {tab === 'signup' && (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="휴대폰 번호 (010-0000-0000)"
                  placeholderTextColor="#9CA3AF"
                  value={phone}
                  onChangeText={t => setPhone(formatPhone(t))}
                  keyboardType="phone-pad"
                  maxLength={13}
                />
                <Text style={styles.fieldLabel}>성별</Text>
                <View style={styles.pillRow}>
                  {['남', '여'].map(g => (
                    <TouchableOpacity
                      key={g}
                      style={[styles.pill, gender === g && styles.pillActive]}
                      onPress={() => setGender(g)}
                    >
                      <Text style={[styles.pillText, gender === g && styles.pillTextActive]}>{g}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <TouchableOpacity
              style={[styles.cta, loading && { opacity: 0.6 }]}
              onPress={tab === 'login' ? handleLogin : handleSignup}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.ctaText}>{tab === 'login' ? '로그인' : '가입하기'}</Text>
              )}
            </TouchableOpacity>

            {tab === 'login' && (
              <View style={styles.testHint}>
                <Text style={styles.testHintText}>테스트: test1@daejin.ac.kr / 아무 비밀번호</Text>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827' },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 48, paddingBottom: 40 },
  hero: { alignItems: 'flex-start', marginBottom: 40 },
  logoMark: {
    width: 40, height: 40, borderRadius: 10, backgroundColor: '#2563EB',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  logoMarkText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  brandName: { color: '#FFFFFF', fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  brandSub: { color: '#6B7280', fontSize: 14, marginTop: 4 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#374151', marginBottom: 24 },
  tab: { marginRight: 24, paddingBottom: 10, position: 'relative' },
  tabText: { color: '#6B7280', fontSize: 15, fontWeight: '500' },
  tabTextActive: { color: '#FFFFFF', fontWeight: '600' },
  tabUnderline: { position: 'absolute', bottom: -1, left: 0, right: 0, height: 2, backgroundColor: '#2563EB' },
  form: {},
  input: {
    height: 48, backgroundColor: '#1F2937', borderRadius: 10, paddingHorizontal: 14,
    color: '#FFFFFF', fontSize: 15, marginBottom: 12, borderWidth: 1, borderColor: '#374151',
  },
  fieldLabel: { color: '#9CA3AF', fontSize: 12, fontWeight: '500', marginBottom: 8, marginTop: 4 },
  pillRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  pill: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#1F2937', borderWidth: 1, borderColor: '#374151',
  },
  pillActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  pillText: { color: '#9CA3AF', fontSize: 13, fontWeight: '500' },
  pillTextActive: { color: '#FFFFFF' },
  cta: {
    height: 50, backgroundColor: '#2563EB', borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', marginTop: 8,
  },
  ctaText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  testHint: { alignItems: 'center', marginTop: 16 },
  testHintText: { color: '#4B5563', fontSize: 12 },
});
