// campusride-mobile/src/components/ImageEditorModal.jsx
// Matches the interactive post-community photo editor (CropView + Rotate + Confirm ✓)
import React, { useRef, useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, ActivityIndicator, Alert as RNAlert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImageManipulator from 'expo-image-manipulator';
import CropView from './CropView';
import { useTheme } from '../context/ThemeContext';
import { colors, radius } from '../theme';

export default function ImageEditorModal({
  visible,
  uri,
  title = 'Crop & Attach Photo',
  subtitle = 'Crop freely, rotate, or tap ✓ to continue',
  confirmLabel = 'Apply ✓',
  onCancel,
  onRetake,
  onConfirm,
}) {
  const { isDark } = useTheme();
  const cropRef = useRef(null);
  const [currentUri, setCurrentUri] = useState(uri);
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    setCurrentUri(uri || null);
    setBusy(false);
  }, [uri, visible]);

  const handleRotate = async () => {
    const activeUri = currentUri || uri;
    if (!activeUri || busy) return;
    setBusy(true);
    try {
      const manipResult = await ImageManipulator.manipulateAsync(
        activeUri,
        [{ rotate: 90 }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
      );
      if (manipResult?.uri) {
        setCurrentUri(manipResult.uri);
      }
    } catch (err) {
      RNAlert.alert('Rotate Error', err?.message || 'Unable to rotate image.');
    } finally {
      setBusy(false);
    }
  };

  const handleApply = async () => {
    const activeUri = currentUri || uri;
    if (!activeUri || busy) return;
    setBusy(true);
    try {
      let finalUri = activeUri;
      if (cropRef.current?.getCropped) {
        const res = await cropRef.current.getCropped();
        if (res?.uri) finalUri = res.uri;
      }
      await onConfirm?.(finalUri);
    } catch (err) {
      console.log('[ImageEditorModal] Crop confirm fallback:', err?.message);
      await onConfirm?.(activeUri);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      visible={Boolean(visible && (currentUri || uri))}
      transparent={false}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => { if (!busy) onCancel?.(); }}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? '#000000' : '#f8fafc' }}>
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: isDark ? '#1c2638' : '#e2e8f0',
          backgroundColor: isDark ? '#0a0e17' : '#ffffff',
        }}>
          <TouchableOpacity
            onPress={() => { if (!busy) (onRetake ? onRetake() : onCancel?.()); }}
            style={{ padding: 6, marginRight: 12 }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={{ color: isDark ? '#ffffff' : '#0f172a', fontSize: 24, fontWeight: '700' }}>←</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ color: isDark ? '#ffffff' : '#0f172a', fontSize: 16, fontWeight: '800' }}>{title}</Text>
            <Text style={{ color: isDark ? '#8b96b0' : '#475569', fontSize: 11 }}>{subtitle}</Text>
          </View>
        </View>

        <View style={{ flex: 1, backgroundColor: isDark ? '#000000' : '#0f172a' }}>
          {(currentUri || uri) ? (
            <CropView ref={cropRef} uri={currentUri || uri} accent={colors.accent} />
          ) : null}
        </View>

        <View style={{
          paddingHorizontal: 16,
          paddingVertical: 14,
          backgroundColor: isDark ? '#0a0e17' : '#ffffff',
          borderTopWidth: 1,
          borderTopColor: isDark ? '#1c2638' : '#e2e8f0',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}>
          <TouchableOpacity
            onPress={handleRotate}
            disabled={busy}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              backgroundColor: isDark ? '#162235' : '#f1f5f9',
              borderWidth: 1.2,
              borderColor: colors.accent,
              borderRadius: radius.md,
              paddingVertical: 12,
              paddingHorizontal: 8,
            }}
            activeOpacity={0.75}
          >
            <Text style={{ fontSize: 16 }}>⟳</Text>
            <Text style={{ color: colors.accent, fontSize: 14, fontWeight: '800' }} numberOfLines={1}>Rotate</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleApply}
            disabled={busy}
            style={{
              flex: 1.3,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              backgroundColor: '#2dd4a0',
              borderRadius: radius.md,
              paddingVertical: 12,
              paddingHorizontal: 8,
            }}
            activeOpacity={0.8}
          >
            {busy ? (
              <ActivityIndicator color="#000000" size="small" />
            ) : (
              <Text style={{ color: '#000000', fontSize: 14, fontWeight: '800' }}>{confirmLabel}</Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
