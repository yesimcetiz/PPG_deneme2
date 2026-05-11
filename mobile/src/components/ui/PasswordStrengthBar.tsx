/**
 * PasswordStrengthBar.tsx
 * ──────────────────────────────────────────────────────────────────────────
 * Kullanıcı şifre yazarken anlık güç göstergesi.
 *
 * Nasıl çalışır:
 * 1. password prop'u her değiştiğinde 4 kural kontrol edilir
 * 2. Geçilen kural sayısına göre renk ve etiket belirlenir
 * 3. Her kural için ✓ veya ✗ ikonlu satır gösterilir
 *
 * Kullanım:
 *   <PasswordStrengthBar password={password} />
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, FontSize, Radius, Spacing } from '../../constants/theme';

// ─── Kural tanımları ────────────────────────────────────────

interface Rule {
  label: string;
  test: (pw: string) => boolean;
}

const RULES: Rule[] = [
  { label: 'En az 8 karakter',   test: (pw) => pw.length >= 8 },
  { label: 'En az 1 büyük harf', test: (pw) => /[A-Z]/.test(pw) },
  { label: 'En az 1 küçük harf', test: (pw) => /[a-z]/.test(pw) },
  { label: 'En az 1 rakam',      test: (pw) => /[0-9]/.test(pw) },
];

// ─── Güç seviyeleri ─────────────────────────────────────────

type StrengthLevel = 'empty' | 'weak' | 'fair' | 'good' | 'strong';

interface StrengthConfig {
  label: string;
  color: string;
  barCount: number; // 1-4 arası kaç bar dolu
}

const STRENGTH_MAP: Record<number, StrengthLevel> = {
  0: 'empty',
  1: 'weak',
  2: 'fair',
  3: 'good',
  4: 'strong',
};

const STRENGTH_CONFIG: Record<StrengthLevel, StrengthConfig> = {
  empty:  { label: '',        color: Colors.border,   barCount: 0 },
  weak:   { label: 'Zayıf',  color: Colors.error,    barCount: 1 },
  fair:   { label: 'Orta',   color: '#F59E0B',        barCount: 2 },
  good:   { label: 'İyi',    color: '#3B82F6',        barCount: 3 },
  strong: { label: 'Güçlü',  color: Colors.success,   barCount: 4 },
};

// ─── Bileşen ────────────────────────────────────────────────

interface Props {
  password: string;
  showRules?: boolean; // kural listesini göster/gizle (default: true)
}

export default function PasswordStrengthBar({ password, showRules = true }: Props) {
  if (!password) return null; // Kullanıcı henüz yazmadıysa gösterme

  // Her kuralı test et
  const results = RULES.map((rule) => ({
    label:  rule.label,
    passed: rule.test(password),
  }));

  // Kaç kural geçildi?
  const passedCount = results.filter((r) => r.passed).length;
  const level       = STRENGTH_MAP[passedCount] ?? 'weak';
  const config      = STRENGTH_CONFIG[level];

  return (
    <View style={styles.container}>
      {/* ── 4 Parçalı Bar ── */}
      <View style={styles.barRow}>
        {[1, 2, 3, 4].map((i) => (
          <View
            key={i}
            style={[
              styles.barSegment,
              {
                backgroundColor: i <= config.barCount
                  ? config.color
                  : Colors.border,
              },
            ]}
          />
        ))}
        {config.label ? (
          <Text style={[styles.strengthLabel, { color: config.color }]}>
            {config.label}
          </Text>
        ) : null}
      </View>

      {/* ── Kural Listesi ── */}
      {showRules && (
        <View style={styles.ruleList}>
          {results.map((r) => (
            <View key={r.label} style={styles.ruleRow}>
              <Text style={[styles.ruleIcon, { color: r.passed ? Colors.success : Colors.textMuted }]}>
                {r.passed ? '✓' : '○'}
              </Text>
              <Text style={[styles.ruleText, { color: r.passed ? Colors.success : Colors.textMuted }]}>
                {r.label}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Yardımcı: dışarıdan validation için kullan ─────────────

/**
 * Kayıt butonunu aktif etmeden önce kontrolü buradan yapabilirsin:
 *   const { isValid } = validatePassword(password);
 */
export function validatePassword(password: string): { isValid: boolean; errors: string[] } {
  const errors = RULES
    .filter((r) => !r.test(password))
    .map((r) => r.label);
  return { isValid: errors.length === 0, errors };
}

// ─── Stiller ────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },

  // Bar
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: Spacing.sm,
  },
  barSegment: {
    flex: 1,
    height: 4,
    borderRadius: Radius.full,
  },
  strengthLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    marginLeft: 4,
    minWidth: 44,
    textAlign: 'right',
  },

  // Kurallar
  ruleList: {
    gap: 3,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ruleIcon: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    width: 12,
  },
  ruleText: {
    fontSize: FontSize.xs,
  },
});
