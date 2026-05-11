import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Colors, FontSize } from '../../constants/theme';

const { width } = Dimensions.get('window');

interface Props {
  tall?: boolean; // welcome ekranı için daha uzun header
}

export default function AuthHeader({ tall = false }: Props) {
  return (
    <View style={[styles.container, tall && styles.tall]}>
      {tall && (
        <View style={styles.iconWrap}>
          <Svg width={52} height={52} viewBox="0 0 52 52">
            <Path
              d="M26 8 C18 8 12 15 12 22 C12 33 26 42 26 42 C26 42 40 33 40 22 C40 15 34 8 26 8Z"
              fill="rgba(255,255,255,0.25)"
            />
            <Path
              d="M26 13 C20 13 16 18 16 23 C16 30 26 37 26 37 C26 37 36 30 36 23 C36 18 32 13 26 13Z"
              fill="rgba(255,255,255,0.55)"
            />
          </Svg>
        </View>
      )}
      <Text style={styles.appName}>Stress Less</Text>
      {tall && <Text style={styles.tagline}>kişisel stres takip sistemi</Text>}

      {/* Dalga */}
      <View style={styles.wave}>
        <Svg
          width={width}
          height={36}
          viewBox={`0 0 ${width} 36`}
          preserveAspectRatio="none"
        >
          <Path
            d={`M0 36 C${width * 0.22} 10 ${width * 0.45} 0 ${width * 0.65} 10 C${width * 0.82} 18 ${width * 0.92} 6 ${width} 0 L${width} 36 Z`}
            fill={Colors.white}
          />
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.primary,
    paddingTop: 60,
    paddingBottom: 36,
    alignItems: 'center',
  },
  tall: {
    paddingTop: 80,
    paddingBottom: 44,
  },
  iconWrap: {
    marginBottom: 12,
  },
  appName: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.white,
    letterSpacing: 1,
  },
  tagline: {
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.65)',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  wave: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
});
