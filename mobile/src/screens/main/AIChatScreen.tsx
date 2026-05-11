import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { chatApi, profileApi, ChatMessage, HealthProfilePayload } from '../../services/api';
import { usePpgStore } from '../../store/ppgStore';
import { useAuthStore } from '../../store/authStore';
import { Colors, FontSize, Radius, Shadow, Spacing } from '../../constants/theme';

// ─── Types ────────────────────────────────────────────────────

interface UiMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}


const SUGGESTED_PROMPTS = [
  'What medications do I need to take today?',
  'Analyze my latest PPG reading.',
  'How stressed am I right now?',
  'Give me a breathing exercise.',
  'What does my HRV indicate?',
];

// ─── Message bubble ───────────────────────────────────────────

interface BubbleProps {
  message: UiMessage;
}

function Bubble({ message }: BubbleProps) {
  const isUser = message.role === 'user';

  if (message.role === 'system') {
    return (
      <View style={styles.systemBubble}>
        <Text style={styles.systemText}>{message.content}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.bubbleRow, isUser && styles.bubbleRowUser]}>
      {!isUser && (
        <LinearGradient
          colors={[Colors.primaryGradientStart, Colors.primaryGradientEnd]}
          style={styles.avatarGradient}
        >
          <Ionicons name="pulse" size={14} color="#fff" />
        </LinearGradient>
      )}
      <View
        style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleAssistant,
          Shadow.sm,
        ]}
      >
        <Text style={isUser ? styles.bubbleTextUser : styles.bubbleTextAssistant}>
          {message.content}
        </Text>
        <Text style={[styles.timestamp, isUser && { color: 'rgba(255,255,255,0.6)' }]}>
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────

export default function AIChatScreen() {
  const user = useAuthStore((s) => s.user);
  const { stressLevel, heartRate, hrvRmssd } = usePpgStore();

  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [healthProfile, setHealthProfile] = useState<
    (HealthProfilePayload & { id: number; user_id: number }) | null
  >(null);

  const listRef = useRef<FlatList<UiMessage>>(null);

  // ── Boot: silently fetch health profile once ───────────────
  useEffect(() => {
    (async () => {
      try {
        const profile = await profileApi.get();
        setHealthProfile(profile);
      } catch {
        // Profile may not exist yet for new users — that's fine
      } finally {
        setIsInitializing(false);
        setMessages([
          {
            id: 'welcome',
            role: 'assistant',
            content: `Hi ${user?.full_name?.split(' ')[0] ?? 'there'}! 👋 I'm your personal health assistant. I have access to your health profile and latest sensor readings. Ask me anything — from medication reminders to stress analysis.`,
            timestamp: new Date(),
          },
        ]);
      }
    })();
  }, [user?.full_name]);

  // ── Build conversation history for API (exclude system messages) ──
  const buildHistory = useCallback(
    (currentMessages: UiMessage[]): ChatMessage[] =>
      currentMessages
        .filter((m) => m.role !== 'system')
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    [],
  );

  // ── Send message ───────────────────────────────────────────
  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      const userMsg: UiMessage = {
        id: `u-${Date.now()}`,
        role: 'user',
        content: trimmed,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInputText('');
      setIsLoading(true);

      setTimeout(() => {
        listRef.current?.scrollToEnd({ animated: true });
      }, 100);

      try {
        const history = buildHistory([...messages, userMsg]);

        const response = await chatApi.send({
          message: trimmed,
          conversation_history: history,
          // Silently inject health context — never surfaced to UI
          health_context: {
            medications:         healthProfile?.medications,
            diagnoses:           healthProfile?.diagnoses,
            stress_source:       healthProfile?.stress_source,
            avg_stress_level:    healthProfile?.avg_stress_level,
            latest_stress_level: stressLevel ?? undefined,
            latest_heart_rate:   heartRate ?? undefined,
            latest_hrv_rmssd:    hrvRmssd ?? undefined,
          },
        });

        const assistantMsg: UiMessage = {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: response.reply,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMsg]);
        setTimeout(() => {
          listRef.current?.scrollToEnd({ animated: true });
        }, 100);
      } catch {
        const errMsg: UiMessage = {
          id: `err-${Date.now()}`,
          role: 'system',
          content: 'Could not reach the AI. Please try again.',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errMsg]);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, isLoading, healthProfile, stressLevel, heartRate, hrvRmssd, buildHistory],
  );

  // ── Suggested prompt chips ─────────────────────────────────
  const showSuggestions = messages.length <= 1 && !isLoading;

  if (isInitializing) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primaryMid} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <LinearGradient
          colors={[Colors.primaryGradientStart, Colors.primaryGradientEnd]}
          style={styles.headerIconWrap}
        >
          <Ionicons name="sparkles" size={18} color="#fff" />
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>AI Health Assistant</Text>
          <Text style={styles.headerSub}>
            {stressLevel
              ? `Current stress: ${stressLevel}`
              : 'Personalized to your health profile'}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* ── Messages ── */}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <Bubble message={item} />}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListFooterComponent={
            isLoading ? (
              <View style={styles.typingIndicator}>
                <View style={styles.typingDots}>
                  <ActivityIndicator size="small" color={Colors.primaryMid} />
                  <Text style={styles.typingText}>Thinking…</Text>
                </View>
              </View>
            ) : null
          }
        />

        {/* ── Suggested prompts ── */}
        {showSuggestions && (
          <View style={styles.suggestionsWrap}>
            <Text style={styles.suggestionsLabel}>Try asking</Text>
            <View style={styles.chips}>
              {SUGGESTED_PROMPTS.map((p) => (
                <TouchableOpacity
                  key={p}
                  style={styles.chip}
                  onPress={() => sendMessage(p)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.chipText}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* ── Input bar ── */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Ask about your health…"
            placeholderTextColor={Colors.textMuted}
            multiline
            maxLength={1000}
            returnKeyType="send"
            onSubmitEditing={() => sendMessage(inputText)}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              (!inputText.trim() || isLoading) && styles.sendBtnDisabled,
            ]}
            onPress={() => sendMessage(inputText)}
            disabled={!inputText.trim() || isLoading}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[Colors.primaryGradientStart, Colors.primaryGradientEnd]}
              style={styles.sendBtnGradient}
            >
              <Ionicons name="arrow-up" size={18} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    gap: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerIconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  headerSub: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 1 },

  // Messages
  messageList: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.lg,
    gap: Spacing.md,
  },
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  bubbleRowUser: { flexDirection: 'row-reverse' },
  avatarGradient: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  bubbleUser: {
    backgroundColor: Colors.primaryMid,
    borderBottomRightRadius: Radius.sm,
  },
  bubbleAssistant: {
    backgroundColor: Colors.surface,
    borderBottomLeftRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bubbleTextUser: { fontSize: FontSize.sm, color: '#fff', lineHeight: 20 },
  bubbleTextAssistant: { fontSize: FontSize.sm, color: Colors.text, lineHeight: 20 },
  timestamp: { fontSize: 10, color: Colors.textMuted, marginTop: 4, alignSelf: 'flex-end' },

  systemBubble: {
    alignSelf: 'center',
    backgroundColor: Colors.errorLight,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
  },
  systemText: { fontSize: FontSize.xs, color: Colors.error },

  // Typing
  typingIndicator: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  typingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  typingText: { fontSize: FontSize.xs, color: Colors.textMuted },

  // Suggestions
  suggestionsWrap: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  suggestionsLabel: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: '600',
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipText: { fontSize: FontSize.xs, color: Colors.primaryMid, fontWeight: '500' },

  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    paddingBottom: Platform.OS === 'ios' ? Spacing.lg : Spacing.md,
    gap: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.white,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: Colors.inputBg,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: FontSize.sm,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sendBtn: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden' },
  sendBtnDisabled: { opacity: 0.45 },
  sendBtnGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
