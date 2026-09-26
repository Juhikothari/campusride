// campusride-mobile/src/screens/admin/AdminBroadcastScreen.jsx
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiClient } from '../../services/api';

export function AdminBroadcastScreen({ navigation }) {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState('all'); // all | providers | seekers | college
  const [college, setCollege] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      Alert.alert('Required Fields', 'Title and message are required.');
      return;
    }
    if (audience === 'college' && !college.trim()) {
      Alert.alert('Required Field', 'Please specify the target college name.');
      return;
    }

    Alert.alert(
      'Send Broadcast',
      `Send "${title}" to ${audience === 'all' ? 'all campus users' : audience}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Broadcast',
          onPress: async () => {
            setSending(true);
            try {
              const res = await apiClient.post('/admin/notifications/broadcast', {
                title: title.trim(),
                message: message.trim(),
                audience,
                college: audience === 'college' ? college.trim() : undefined,
              });
              Alert.alert('Broadcast Delivered!', res.data?.message || 'Notification broadcasted successfully.');
              setTitle('');
              setMessage('');
            } catch (err) {
              Alert.alert('Failed', err.message || 'Broadcast delivery failed');
            } finally {
              setSending(false);
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.headerBadge}>COMMUNICATION</Text>
          <Text style={styles.heading}>Broadcast Notification</Text>
          <Text style={styles.sub}>Send urgent alerts and push announcements across the campus network.</Text>
        </View>

        <Text style={styles.label}>TARGET AUDIENCE</Text>
        <View style={styles.row}>
          {['all', 'providers', 'seekers', 'college'].map(a => (
            <TouchableOpacity
              key={a}
              style={[styles.chip, audience === a && styles.chipActive]}
              onPress={() => setAudience(a)}
            >
              <Text style={[styles.chipText, audience === a && styles.chipTextActive]}>
                {a.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {audience === 'college' && (
          <View style={styles.fieldBlock}>
            <Text style={styles.label}>COLLEGE / INSTITUTION</Text>
            <TextInput
              style={styles.input}
              placeholder="E.g. RV College of Engineering, PES..."
              placeholderTextColor="#6e7681"
              value={college}
              onChangeText={setCollege}
            />
          </View>
        )}

        <View style={styles.fieldBlock}>
          <Text style={styles.label}>NOTIFICATION TITLE</Text>
          <TextInput
            style={styles.input}
            placeholder="E.g. Campus Weather Alert / Route Update"
            placeholderTextColor="#6e7681"
            value={title}
            onChangeText={setTitle}
            maxLength={65}
          />
          <Text style={styles.charCount}>{title.length}/65</Text>
        </View>

        <View style={styles.fieldBlock}>
          <Text style={styles.label}>MESSAGE BODY</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Type notification message here..."
            placeholderTextColor="#6e7681"
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={4}
            maxLength={250}
          />
          <Text style={styles.charCount}>{message.length}/250</Text>
        </View>

        <TouchableOpacity
          style={[styles.sendBtn, sending && { opacity: 0.6 }]}
          onPress={handleSend}
          disabled={sending}
          activeOpacity={0.8}
        >
          <Text style={styles.sendBtnText}>{sending ? 'Broadcasting...' : '📢 Send Broadcast Alert'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#07090d',
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 20,
    paddingTop: 4,
  },
  headerBadge: {
    color: '#2dd4a0',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 2,
  },
  heading: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
  },
  sub: {
    color: '#8b949e',
    fontSize: 12,
    marginTop: 4,
    lineHeight: 18,
  },
  label: {
    color: '#8b949e',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    flex: 1,
    backgroundColor: '#161b22',
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#30363d',
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: 'rgba(45,212,160,0.15)',
    borderColor: '#2dd4a0',
  },
  chipText: {
    color: '#8b949e',
    fontSize: 11,
    fontWeight: '700',
  },
  chipTextActive: {
    color: '#2dd4a0',
    fontWeight: '800',
  },
  fieldBlock: {
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#0d1117',
    color: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#30363d',
    fontSize: 14,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  charCount: {
    color: '#6e7681',
    fontSize: 10,
    textAlign: 'right',
    marginTop: 4,
  },
  sendBtn: {
    backgroundColor: '#2dd4a0',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  sendBtnText: {
    color: '#07090d',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
});
