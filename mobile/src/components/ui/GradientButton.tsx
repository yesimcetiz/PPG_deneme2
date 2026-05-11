import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Radius, FontSize, Spacing } from '../../constants/theme';

interface Props {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  variant?: 'solid' | 'outline';
}

export default function GradientButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  style,
  variant = 'solid',
}: Props) {
  if (variant === 'outline') {
    return (
      <TouchableOpacity
        style={[styles.outline, style]}
        onPress={onPress}
        activeOpacity={0.75}
        disabled={disabled || loading}
      >
        <Text style={styles.outlineText}>{label}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.82}
      disabled={disabled || loading}
      style={[styles.wrapper, style, (disabled || loading) && styles.disabled]}
    >
      <LinearGradient
        colors={[Colors.primaryGradientStart, Colors.primaryGradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradient}
      >
        {loading ? (
          <ActivityIndicator color={Colors.white} size="small" />
        ) : (
          <Text style={styles.label}>{label}</Text>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: Radius.md,
    overflow: 'hidden',
    marginTop: Spacing.md,
  },
  gradient: {
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: Colors.white,
    fontSize: FontSize.md,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  disabled: {
    opacity: 0.55,
  },
  outline: {
    height: 50,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
  },
  outlineText: {
    color: Colors.primaryMid,
    fontSize: FontSize.md,
    fontWeight: '500',
  },
});
