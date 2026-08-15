import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  FlatList, KeyboardAvoidingView, Platform, StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { API_BASE, getCommunityPosts, createCommunityPost, toggleCommunityLike, addCommunityReply, deleteCommunityPost, getChatMessages } from '../services/api';
import { colors, spacing, radius } from '../theme';
import { Btn, Alert } from '../components/UI';

const TABS = ['Posts', 'College Chat'];
const POST_TYPES = [
  { value: 'tip',       label: '💡 Tip' },
  { value: 'question',  label: '❓ Question' },
  { value: 'alert',     label: '🚨 Alert' },
  { value: 'walk',      label: '🚶 Walk' },
  { value: 'general',   label: '💬 General' },
];

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Posts Tab ─────────────────────────────────────────────────────
function PostsTab({ user }) {
  const [posts,     setPosts]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [content,   setContent]   = useState('');
  const [postType,  setPostType]  = useState('general');
  const [anonymous, setAnonymous] = useState(false);
  const [posting,   setPosting]   = useState(false);
  const [error,     setError]     = useState('');
  const [replyText, setReplyText] = useState({});
  const [showReply, setShowReply] = useState({});

  useEffect(() => {
    getCommunityPosts()
      .then(data => setPosts(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handlePost = async () => {
    if (!content.trim()) return;
    setPosting(true);
    setError('');
    try {
      const post = await createCommunityPost({ content, type: postType, anonymous });
      setPosts(prev => [post, ...prev]);
      setContent('');
    } catch (e) {
      setError(e.message || 'Failed to post');
    } finally {
      setPosting(false);
    }
  };

  const handleLike = async (postId) => {
    try {
      const updated = await toggleCommunityLike(postId);
      setPosts(prev => prev.map(p => p._id === postId ? { ...p, likes: updated.likes } : p));
    } catch {}
  };

  const handleReply = async (postId) => {
    const text = replyText[postId]?.trim();
    if (!text) return;
    try {
      const updated = await addCommunityReply(postId, text);
      setPosts(prev => prev.map(p => p._id === postId ? updated : p));
      setReplyText(r => ({ ...r, [postId]: '' }));
      setShowReply(s => ({ ...s, [postId]: false }));
    } catch {}
  };

  const handleDelete = async (postId) => {
    try {
      await deleteCommunityPost(postId);
      setPosts(prev => prev.filter(p => p._id !== postId));
    } catch {}
  };

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
      {/* Compose */}
      <View style={styles.composeCard}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {POST_TYPES.map(t => (
              <TouchableOpacity
                key={t.value}
                onPress={() => setPostType(t.value)}
                style={[styles.typeChip, postType === t.value && styles.typeChipActive]}
              >
                <Text style={[styles.typeChipText, postType === t.value && styles.typeChipTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
        <TextInput
          style={styles.composeInput}
          value={content}
          onChangeText={setContent}
          placeholder="Share something with your campus community…"
          placeholderTextColor={colors.text3}
          multiline
          maxLength={500}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
          <TouchableOpacity onPress={() => setAnonymous(a => !a)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={[styles.checkbox, anonymous && styles.checkboxActive]}>
              {anonymous && <Text style={{ color: '#000', fontSize: 10, fontWeight: '800' }}>✓</Text>}
            </View>
            <Text style={{ color: colors.text2, fontSize: 13 }}>Post anonymously</Text>
          </TouchableOpacity>
          <Btn label={posting ? '…' : 'Post'} onPress={handlePost} loading={posting} style={{ paddingHorizontal: 20, paddingVertical: 8 }} />
        </View>
        <Alert message={error} />
      </View>

      {/* Posts */}
      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 32 }} />
      ) : posts.map(post => (
        <View key={post._id} style={styles.postCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <View>
              <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '700' }}>
                {POST_TYPES.find(t => t.value === post.type)?.label || '💬'}
              </Text>
              <Text style={{ color: colors.text2, fontSize: 11, marginTop: 1 }}>
                {post.anonymous ? 'Anonymous' : post.authorName} · {timeAgo(post.createdAt)}
              </Text>
            </View>
            {post.authorId === user?._id && (
              <TouchableOpacity onPress={() => handleDelete(post._id)}>
                <Text style={{ color: colors.red, fontSize: 12 }}>Delete</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20, marginBottom: 10 }}>{post.content}</Text>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <TouchableOpacity onPress={() => handleLike(post._id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: 14 }}>❤️</Text>
              <Text style={{ color: colors.text2, fontSize: 12 }}>{post.likes?.length || 0}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowReply(s => ({ ...s, [post._id]: !s[post._id] }))} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: 14 }}>💬</Text>
              <Text style={{ color: colors.text2, fontSize: 12 }}>{post.replies?.length || 0}</Text>
            </TouchableOpacity>
          </View>
          {showReply[post._id] && (
            <View style={{ marginTop: 10, flexDirection: 'row', gap: 8 }}>
              <TextInput
                style={[styles.replyInput, { flex: 1 }]}
                value={replyText[post._id] || ''}
                onChangeText={t => setReplyText(r => ({ ...r, [post._id]: t }))}
                placeholder="Write a reply…"
                placeholderTextColor={colors.text3}
              />
              <TouchableOpacity onPress={() => handleReply(post._id)} style={styles.replyBtn}>
                <Text style={{ color: '#000', fontWeight: '700', fontSize: 12 }}>Send</Text>
              </TouchableOpacity>
            </View>
          )}
          {(post.replies || []).map((r, i) => (
            <View key={i} style={styles.reply}>
              <Text style={{ color: colors.accent, fontSize: 11, fontWeight: '600' }}>{r.authorName || 'User'}</Text>
              <Text style={{ color: colors.text, fontSize: 13, marginTop: 2 }}>{r.content}</Text>
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

// ── College Chat Tab ──────────────────────────────────────────────
function CollegeChatTab({ user }) {
  const [messages, setMessages] = useState([]);
  const [input,    setInput]    = useState('');
  const [loading,  setLoading]  = useState(true);
  const [anonymous,setAnonymous]= useState(false);
  const socketRef  = useRef(null);
  const flatRef    = useRef(null);

  useEffect(() => {
    if (!user?.college) return;
    getChatMessages(user.college)
      .then(data => setMessages(Array.isArray(data) ? data.reverse() : []))
      .catch(() => {})
      .finally(() => setLoading(false));

    const socket = io(API_BASE, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    socket.on('connect', () => {
      socket.emit('join-college-chat', { userId: user._id || user.userId });
    });
    socket.on('receive-community-message', (msg) => {
      setMessages(prev => [...prev, msg]);
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    });
    socket.on('community-message-deleted', ({ messageId }) => {
      setMessages(prev => prev.filter(m => m._id !== messageId));
    });
    return () => socket.disconnect();
  }, [user?.college]);

  const sendMsg = () => {
    if (!input.trim() || !socketRef.current) return;
    socketRef.current.emit('send-community-message', {
      userId: user._id || user.userId,
      message: input.trim(),
      anonymous,
    });
    setInput('');
  };

  const deleteMsg = (messageId) => {
    socketRef.current?.emit('delete-community-message', { userId: user._id || user.userId, messageId });
  };

  const myId = user?._id || user?.userId;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ flex: 1, marginTop: 40 }} />
      ) : (
        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={(item, i) => item._id || String(i)}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: 16 }}
          onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => {
            const isMe = item.senderId === myId;
            return (
              <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
                <View style={[styles.msgBubble, isMe && styles.msgBubbleMe]}>
                  {!isMe && (
                    <Text style={{ color: colors.accent, fontSize: 11, fontWeight: '700', marginBottom: 2 }}>
                      {item.anonymous ? 'Anonymous' : item.senderName}
                      {item.senderUsn ? ` · ${item.senderUsn}` : ''}
                    </Text>
                  )}
                  <Text style={[styles.msgText, isMe && styles.msgTextMe]}>{item.message}</Text>
                  {isMe && (
                    <TouchableOpacity onPress={() => deleteMsg(item._id)} style={{ marginTop: 4, alignSelf: 'flex-end' }}>
                      <Text style={{ color: 'rgba(0,0,0,0.4)', fontSize: 10 }}>Delete</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}
      <View style={styles.chatInput}>
        <TouchableOpacity onPress={() => setAnonymous(a => !a)} style={{ padding: 8 }}>
          <Text style={{ fontSize: 18, opacity: anonymous ? 1 : 0.4 }}>🕵️</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.chatTextInput}
          value={input}
          onChangeText={setInput}
          placeholder={anonymous ? 'Send anonymously…' : 'Message your college…'}
          placeholderTextColor={colors.text3}
          onSubmitEditing={sendMsg}
          returnKeyType="send"
        />
        <TouchableOpacity style={styles.sendBtn} onPress={sendMsg}>
          <Text style={{ color: '#000', fontSize: 16 }}>↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ── Main Screen ───────────────────────────────────────────────────
export default function CommunityScreen() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      {/* Tabs */}
      <View style={styles.tabBar}>
        {TABS.map((tab, i) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === i && styles.tabActive]}
            onPress={() => setActiveTab(i)}
          >
            <Text style={[styles.tabText, activeTab === i && styles.tabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <View style={{ flex: 1 }}>
        {activeTab === 0 ? <PostsTab user={user} /> : <CollegeChatTab user={user} />}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  tabBar:  { flexDirection: 'row', backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab:     { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.accent },
  tabText:   { color: colors.text2, fontSize: 14, fontWeight: '600' },
  tabTextActive: { color: colors.accent },

  composeCard: {
    backgroundColor: colors.surface, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md,
  },
  typeChip: { borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 10, paddingVertical: 5 },
  typeChipActive:     { borderColor: colors.accent, backgroundColor: colors.accentDim },
  typeChipText:       { color: colors.text2, fontSize: 12 },
  typeChipTextActive: { color: colors.accent },
  composeInput: {
    color: colors.text, fontSize: 14, lineHeight: 20, minHeight: 70,
    backgroundColor: colors.surface2, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    padding: 10, textAlignVertical: 'top',
  },
  checkbox: {
    width: 18, height: 18, borderRadius: 4, borderWidth: 2,
    borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: colors.accent, borderColor: colors.accent },

  postCard: {
    backgroundColor: colors.surface, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, marginBottom: 10,
  },
  replyInput: {
    backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, color: colors.text, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13,
  },
  replyBtn: {
    backgroundColor: colors.accent, borderRadius: radius.md,
    paddingHorizontal: 14, paddingVertical: 8, justifyContent: 'center',
  },
  reply: {
    backgroundColor: colors.surface2, borderRadius: radius.md,
    padding: 8, marginTop: 6,
  },

  msgRow:   { marginBottom: 10, alignItems: 'flex-start' },
  msgRowMe: { alignItems: 'flex-end' },
  msgBubble: {
    backgroundColor: colors.surface2, borderRadius: radius.lg,
    borderTopLeftRadius: 4, padding: 10, maxWidth: '80%',
  },
  msgBubbleMe: {
    backgroundColor: colors.accent,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: 4,
  },
  msgText:   { color: colors.text, fontSize: 14, lineHeight: 19 },
  msgTextMe: { color: '#000' },

  chatInput: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border,
    padding: 10,
  },
  chatTextInput: {
    flex: 1, backgroundColor: colors.surface2, borderRadius: radius.full,
    paddingHorizontal: 14, paddingVertical: 10,
    color: colors.text, fontSize: 14,
    borderWidth: 1, borderColor: colors.border,
  },
  sendBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
  },
});
