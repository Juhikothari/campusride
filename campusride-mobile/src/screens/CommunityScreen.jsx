import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  FlatList, KeyboardAvoidingView, Platform, StyleSheet,
  ActivityIndicator, Alert as RNAlert, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import TopHeader from '../components/TopHeader';
import { API_BASE, getCommunityPosts, createCommunityPost, toggleCommunityLike, addCommunityReply, deleteCommunityPost, getChatMessages } from '../services/api';
import { uploadToCloudinaryWithRetry } from '../services/cloudinary';
import { colors, spacing, radius } from '../theme';
import { Btn, Alert } from '../components/UI';

const TABS = ['Posts', 'College Chat'];
const POST_TYPES = [
  { value: 'general',   label: '💬 General' },
  { value: 'tip',       label: '💡 Tip' },
  { value: 'question',  label: '❓ Question' },
  { value: 'alert',     label: '🚨 Alert' },
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
  const [attachment, setAttachment] = useState(null); // { uri, name, type }
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  useEffect(() => {
    getCommunityPosts()
      .then(data => setPosts(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        RNAlert.alert('Permission Denied', 'Camera roll access is needed to attach images.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        setAttachment({
          uri: asset.uri,
          name: asset.fileName || `post_image_${Date.now()}.jpg`,
          type: 'image',
        });
      }
    } catch (err) {
      RNAlert.alert('Error', 'Unable to pick image: ' + err.message);
    }
  };

  const handleCameraPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        RNAlert.alert('Permission Denied', 'Camera permission is needed to take photos.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        setAttachment({
          uri: asset.uri,
          name: `camera_${Date.now()}.jpg`,
          type: 'image',
        });
      }
    } catch (err) {
      RNAlert.alert('Error', 'Unable to take photo: ' + err.message);
    }
  };

  const handlePost = async () => {
    if (!content.trim() && !attachment) return;
    setPosting(true);
    setError('');
    try {
      let attachments = [];
      if (attachment) {
        setUploadingAttachment(true);
        try {
          const uploadedUrl = await uploadToCloudinaryWithRetry(attachment.uri, {
            type: 'image',
          });
          attachments.push({
            url: uploadedUrl,
            type: 'image',
            name: attachment.name || 'image.jpg',
          });
        } catch (uploadErr) {
          setError('Failed to upload image attachment. Check your connection.');
          setPosting(false);
          setUploadingAttachment(false);
          return;
        } finally {
          setUploadingAttachment(false);
        }
      }

      // Backend enum compatibility fallback: map 'general' and 'question' to 'tip'
      const safeType = (postType === 'general' || postType === 'question') ? 'tip' : (postType || 'tip');
      const post = await createCommunityPost({
        content: content.trim() || 'Shared an image',
        type: safeType,
        anonymous,
        attachments,
      });
      setPosts(prev => [{ ...post, displayType: postType }, ...prev]);
      setContent('');
      setAttachment(null);
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

  const handleDelete = (postId) => {
    RNAlert.alert(
      '🗑️ Delete Post',
      'Are you sure you want to delete this community post?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setPosts(prev => prev.filter(p => p._id !== postId));
              await deleteCommunityPost(postId);
            } catch (err) {
              console.error('Delete post error:', err);
              RNAlert.alert('Notice', err.message || 'Failed to delete post');
            }
          }
        }
      ]
    );
  };

  const currentUserId = user?._id || user?.id || user?.userId;

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
        {/* Attachment preview if an image is selected */}
        {attachment && (
          <View style={styles.attachmentPreviewRow}>
            <Image source={{ uri: attachment.uri }} style={styles.attachmentPreviewThumb} />
            <View style={{ flex: 1, paddingHorizontal: 8 }}>
              <Text style={styles.attachmentPreviewName} numberOfLines={1}>{attachment.name}</Text>
              <Text style={styles.attachmentPreviewSub}>Ready to upload with post</Text>
            </View>
            <TouchableOpacity onPress={() => setAttachment(null)} style={styles.removeAttachmentBtn}>
              <Text style={styles.removeAttachmentText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.composeToolbar}>
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <TouchableOpacity onPress={handlePickImage} style={styles.attachActionBtn} activeOpacity={0.75}>
              <Text style={styles.attachActionIcon}>🖼️</Text>
              <Text style={styles.attachActionText}>Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleCameraPhoto} style={styles.attachActionBtn} activeOpacity={0.75}>
              <Text style={styles.attachActionIcon}>📷</Text>
              <Text style={styles.attachActionText}>Camera</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => setAnonymous(a => !a)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={[styles.checkbox, anonymous && styles.checkboxActive]}>
              {anonymous && <Text style={{ color: '#000', fontSize: 10, fontWeight: '800' }}>✓</Text>}
            </View>
            <Text style={{ color: colors.text2, fontSize: 12 }}>Anonymous</Text>
          </TouchableOpacity>

          <Btn
            label={posting ? 'Posting…' : 'Post'}
            onPress={handlePost}
            loading={posting || uploadingAttachment}
            style={{ paddingHorizontal: 16, paddingVertical: 8 }}
          />
        </View>
        <Alert message={error} />
      </View>

      {/* Posts */}
      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 32 }} />
      ) : posts.map(post => {
        const isOwner = Boolean(
          (post.author?._id && String(post.author._id) === String(currentUserId)) ||
          (post.author && String(post.author) === String(currentUserId)) ||
          (post.authorId && String(post.authorId) === String(currentUserId)) ||
          user?.role === 'admin'
        );

        return (
          <View key={post._id} style={styles.postCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '700' }}>
                  {POST_TYPES.find(t => t.value === post.type)?.label || '💬'}
                </Text>
                <Text style={{ color: colors.text2, fontSize: 11, marginTop: 1 }}>
                  {post.anonymous ? 'Anonymous' : (post.author?.name || post.authorName || 'Campus Commuter')} · {timeAgo(post.createdAt)}
                </Text>
              </View>
              {isOwner && (
                <TouchableOpacity
                  onPress={() => handleDelete(post._id)}
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    backgroundColor: 'rgba(255,82,82,0.1)',
                    borderRadius: radius.sm,
                    borderWidth: 1,
                    borderColor: colors.red + '44'
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={{ color: colors.red, fontSize: 11, fontWeight: '700' }}>🗑️ Delete</Text>
                </TouchableOpacity>
              )}
            </View>
          <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20, marginBottom: 10 }}>{post.content}</Text>
          {Array.isArray(post.attachments) && post.attachments.map((att, attIdx) => att?.url ? (
            <Image
              key={attIdx}
              source={{ uri: att.url }}
              style={styles.postAttachmentImage}
              resizeMode="cover"
            />
          ) : null)}
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
      );
    })}
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

  const collegeCommunityTitle = user?.college ? `${user.college} Community` : 'Campus Community';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <TopHeader title={collegeCommunityTitle} subtitle="Campus Forum & Chat" />

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
  attachmentPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#30363d',
    borderRadius: radius.md,
    padding: 8,
    marginBottom: 10,
  },
  attachmentPreviewThumb: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: '#21262d',
  },
  attachmentPreviewName: {
    color: '#e6edf3',
    fontSize: 12,
    fontWeight: '700',
  },
  attachmentPreviewSub: {
    color: '#8b949e',
    fontSize: 10,
    marginTop: 2,
  },
  removeAttachmentBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,82,82,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeAttachmentText: {
    color: '#ff5252',
    fontSize: 12,
    fontWeight: '800',
  },
  composeToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#21262d',
  },
  attachActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#161b22',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  attachActionIcon: {
    fontSize: 13,
  },
  attachActionText: {
    color: '#c9d1d9',
    fontSize: 11,
    fontWeight: '600',
  },
  postAttachmentImage: {
    width: '100%',
    height: 190,
    borderRadius: radius.md,
    marginBottom: 10,
    backgroundColor: '#161b22',
  },
});
