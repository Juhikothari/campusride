import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  FlatList, Keyboard, KeyboardAvoidingView, Platform, StyleSheet,
  ActivityIndicator, Alert as RNAlert, Image, Modal,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import TopHeader from '../components/TopHeader';
import { API_BASE, getCommunityPosts, createCommunityPost, toggleCommunityLike, addCommunityReply, deleteCommunityPost, deleteCommunityReply, getChatMessages } from '../services/api';
import { uploadToCloudinaryWithRetry } from '../services/cloudinary';
import { resetCommunityUnreadCount } from '../hooks/useSocket';
import { colors, spacing, radius } from '../theme';
import { Btn, Alert } from '../components/UI';
import { getDisplayUSN } from '../utils/usn';

const TABS = ['Posts', 'College Chat'];
const POST_TYPES = [
  { value: 'general',   label: '💬 General' },
  { value: 'tip',       label: '💡 Tip' },
  { value: 'question',  label: '❓ Question' },
  { value: 'alert',     label: '🚨 Alert' },
];

// Sitcom lounge removed - clean community hub

export function getCategoryBadge(type) {
  switch ((type || '').toLowerCase()) {
    case 'alert':
      return { label: '🚨 CAMPUS ALERT', bg: 'rgba(255, 82, 82, 0.15)', border: '#ff5252', text: '#ff5252' };
    case 'tip':
      return { label: '💡 COMMUTE TIP', bg: 'rgba(245, 166, 35, 0.15)', border: '#f5a623', text: '#f5a623' };
    case 'question':
      return { label: '❓ QUESTION', bg: 'rgba(0, 229, 255, 0.15)', border: '#00e5ff', text: '#00e5ff' };
    case 'general':
    default:
      return { label: '💬 GENERAL', bg: 'rgba(168, 85, 247, 0.15)', border: '#a855f7', text: '#c084fc' };
  }
}

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
  const { isDark } = useTheme();
  const scrollRef = useRef(null);
  const [posts,     setPosts]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [content,   setContent]   = useState('');
  const [postType,  setPostType]  = useState('general');
  const [anonymous, setAnonymous] = useState(false);
  const [posting,   setPosting]   = useState(false);
  const [error,     setError]     = useState('');
  const [replyText, setReplyText] = useState({});
  const [showReply, setShowReply] = useState({});
  const [attachment, setAttachment] = useState(null); // { uri, name, type, uploaded, url }
  const [stagedAttachment, setStagedAttachment] = useState(null); // { uri, name, type } - cropped but not yet attached
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [showImageEditorModal, setShowImageEditorModal] = useState(false);
  const [showAttachModal, setShowAttachModal] = useState(false);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState(null);

  useEffect(() => {
    getCommunityPosts('community')
      .then(data => setPosts((Array.isArray(data) ? data : []).filter(p => p.type !== 'walk')))
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
        allowsEditing: false,
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        // Cropping an image only crops — stages it locally, does NOT attach until tick mark is clicked
        setStagedAttachment({
          uri: asset.uri,
          originalUri: asset.uri,
          name: asset.fileName || `post_image_${Date.now()}.jpg`,
          type: 'image',
          cropIndex: 0,
        });
        setShowImageEditorModal(true);
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
        allowsEditing: false,
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        // Cropping an image only crops — stages it locally, does NOT attach until tick mark is clicked
        setStagedAttachment({
          uri: asset.uri,
          originalUri: asset.uri,
          name: `camera_${Date.now()}.jpg`,
          type: 'image',
          cropIndex: 0,
        });
        setShowImageEditorModal(true);
      }
    } catch (err) {
      RNAlert.alert('Error', 'Unable to take photo: ' + err.message);
    }
  };

  const handleRecropStagedImage = async () => {
    if (!stagedAttachment?.uri || uploadingAttachment) return;
    try {
      const sourceUri = stagedAttachment.originalUri || stagedAttachment.uri;
      const currentIdx = stagedAttachment.cropIndex || 0;
      const nextIdx = (currentIdx + 1) % 4; // 0: Original, 1: 1:1 Square, 2: 16:9 Landscape/4:5 Portrait, 3: 4:3

      Image.getSize(sourceUri, async (origWidth, origHeight) => {
        try {
          if (nextIdx === 0) {
            setStagedAttachment(prev => ({
              ...prev,
              uri: sourceUri,
              cropIndex: 0,
            }));
            return;
          }

          let cropAction = null;
          if (nextIdx === 1) {
            // 1:1 Square center crop
            const size = Math.min(origWidth, origHeight);
            cropAction = {
              crop: {
                originX: Math.floor((origWidth - size) / 2),
                originY: Math.floor((origHeight - size) / 2),
                width: size,
                height: size,
              }
            };
          } else if (nextIdx === 2) {
            // 16:9 Landscape or 4:5 Portrait center crop
            if (origWidth >= origHeight) {
              const targetH = Math.min(origHeight, Math.floor(origWidth * 9 / 16));
              cropAction = {
                crop: {
                  originX: 0,
                  originY: Math.floor((origHeight - targetH) / 2),
                  width: origWidth,
                  height: targetH,
                }
              };
            } else {
              const targetW = Math.min(origWidth, Math.floor(origHeight * 4 / 5));
              cropAction = {
                crop: {
                  originX: Math.floor((origWidth - targetW) / 2),
                  originY: 0,
                  width: targetW,
                  height: origHeight,
                }
              };
            }
          } else if (nextIdx === 3) {
            // 4:3 Crop
            const targetH = Math.min(origHeight, Math.floor(origWidth * 3 / 4));
            cropAction = {
              crop: {
                originX: 0,
                originY: Math.floor((origHeight - targetH) / 2),
                width: origWidth,
                height: targetH,
              }
            };
          }

          if (cropAction) {
            const manipResult = await ImageManipulator.manipulateAsync(
              sourceUri,
              [cropAction],
              { compress: 0.88, format: ImageManipulator.SaveFormat.JPEG }
            );
            if (manipResult?.uri) {
              setStagedAttachment(prev => ({
                ...prev,
                uri: manipResult.uri,
                cropIndex: nextIdx,
              }));
            }
          }
        } catch (cropErr) {
          console.log('[InPlaceCrop] error:', cropErr);
        }
      }, (err) => {
        console.log('[InPlaceCrop] getSize error:', err);
      });
    } catch (err) {
      console.log('[Crop] error:', err);
    }
  };

  const handleRotateStagedImage = async () => {
    if (!stagedAttachment?.uri || uploadingAttachment) return;
    try {
      const manipResult = await ImageManipulator.manipulateAsync(
        stagedAttachment.uri,
        [{ rotate: 90 }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
      );
      if (manipResult && manipResult.uri) {
        setStagedAttachment(prev => ({
          ...prev,
          uri: manipResult.uri,
        }));
      }
    } catch (err) {
      console.log('Rotate error:', err);
    }
  };

  const handleConfirmAndUploadAttachment = async () => {
    if (!stagedAttachment || uploadingAttachment) return;
    setUploadingAttachment(true);
    setError('');
    try {
      const uploadedUrl = await uploadToCloudinaryWithRetry(stagedAttachment.uri, { type: 'image' });
      if (uploadedUrl) {
        setAttachment({
          uri: stagedAttachment.uri,
          name: stagedAttachment.name,
          type: 'image',
          url: uploadedUrl,
          uploaded: true,
        });
        setStagedAttachment(null);
        setShowImageEditorModal(false);
      } else {
        throw new Error('Upload returned empty URL');
      }
    } catch (err) {
      console.log('[Community] Image upload error:', err);
      RNAlert.alert('Upload Failed', 'Could not upload image. Please check your internet connection and try again.');
    } finally {
      setUploadingAttachment(false);
    }
  };

  const handlePost = async () => {
    if (!content.trim() && !attachment && !stagedAttachment) return;
    setPosting(true);
    setError('');
    try {
      let attachments = [];
      let finalAttachment = attachment;

      // If user cropped an image and didn't tap tick mark, attach & upload now
      if (!finalAttachment && stagedAttachment) {
        setUploadingAttachment(true);
        try {
          const uploadedUrl = await uploadToCloudinaryWithRetry(stagedAttachment.uri, { type: 'image' });
          if (uploadedUrl) {
            finalAttachment = {
              uri: stagedAttachment.uri,
              url: uploadedUrl,
              uploaded: true,
              name: stagedAttachment.name,
            };
            setAttachment(finalAttachment);
            setStagedAttachment(null);
          }
        } catch (uploadErr) {
          setError('Failed to upload image attachment. Check your connection.');
          setPosting(false);
          setUploadingAttachment(false);
          return;
        } finally {
          setUploadingAttachment(false);
        }
      }

      if (finalAttachment) {
        let finalUrl = finalAttachment.url;
        if (!finalUrl) {
          setUploadingAttachment(true);
          try {
            finalUrl = await uploadToCloudinaryWithRetry(finalAttachment.uri, { type: 'image' });
          } catch (uploadErr) {
            setError('Failed to upload image attachment. Check your connection.');
            setPosting(false);
            setUploadingAttachment(false);
            return;
          } finally {
            setUploadingAttachment(false);
          }
        }
        if (finalUrl) {
          attachments.push({
            url: finalUrl,
            type: 'image',
            name: finalAttachment.name || 'image.jpg',
          });
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
      setStagedAttachment(null);
    } catch (e) {
      setError(e.message || 'Failed to post');
    } finally {
      setPosting(false);
    }
  };

  const handleLike = async (postId) => {
    // 0ms immediate optimistic UI update
    let prevPosts = null;
    setPosts(prev => {
      prevPosts = prev;
      return prev.map(p => {
        if (p._id !== postId) return p;
        const currentLiked = p.userLiked !== undefined
          ? p.userLiked
          : (Array.isArray(p.likedBy) && p.likedBy.some(id => (id._id || id).toString() === (currentUserId || '').toString()));
        const currentLikes = typeof p.likes === 'number' ? p.likes : (Array.isArray(p.likedBy) ? p.likedBy.length : (Array.isArray(p.likes) ? p.likes.length : 0));
        const nextLiked = !currentLiked;
        const nextLikes = nextLiked ? currentLikes + 1 : Math.max(0, currentLikes - 1);
        return {
          ...p,
          userLiked: nextLiked,
          likes: nextLikes,
        };
      });
    });

    try {
      const updated = await toggleCommunityLike(postId);
      setPosts(prev => prev.map(p => {
        if (p._id !== postId) return p;
        return {
          ...p,
          likes: updated.likes,
          likedBy: updated.likedBy || p.likedBy,
          userLiked: updated.liked,
        };
      }));
    } catch {
      if (prevPosts) setPosts(prevPosts);
    }
  };

  const handleDeleteReply = (postId, replyId) => {
    RNAlert.alert('Delete Comment', 'Are you sure you want to delete this comment?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            setPosts(prev => prev.map(p => {
              if (p._id !== postId) return p;
              return { ...p, replies: (p.replies || []).filter(r => r._id !== replyId) };
            }));
            await deleteCommunityReply(postId, replyId);
          } catch (err) {
            RNAlert.alert('Notice', err.message || 'Failed to delete comment');
          }
        }
      }
    ]);
  };

  const handleReply = async (postId) => {
    const text = replyText[postId]?.trim();
    if (!text) return;

    // 0ms immediate optimistic comment update
    const tempReplyId = 'opt_' + Date.now();
    const optimisticReply = {
      _id: tempReplyId,
      content: text,
      text,
      authorName: user?.name || 'You',
      author: {
        _id: currentUserId,
        name: user?.name || 'You',
        usn: user?.usn,
      },
      createdAt: new Date().toISOString(),
    };

    setReplyText(r => ({ ...r, [postId]: '' }));
    setPosts(prev => prev.map(p => {
      if (p._id !== postId) return p;
      return {
        ...p,
        replies: [...(p.replies || []), optimisticReply],
      };
    }));

    try {
      const updated = await addCommunityReply(postId, text);
      setPosts(prev => prev.map(p => p._id === postId ? updated : p));
    } catch {
      // Revert if request failed
      setPosts(prev => prev.map(p => {
        if (p._id !== postId) return p;
        return {
          ...p,
          replies: (p.replies || []).filter(r => r._id !== tempReplyId),
        };
      }));
      RNAlert.alert('Notice', 'Failed to send comment. Please try again.');
    }
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
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={true}
      >
        {/* Compose */}
        <View style={[styles.composeCard, { backgroundColor: isDark ? colors.surface : '#ffffff', borderColor: isDark ? colors.border : '#e2e8f0' }]}>
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
            style={[styles.composeInput, {
              color: isDark ? '#ffffff' : '#0f172a',
              backgroundColor: isDark ? colors.surface2 : '#f8fafc',
              borderColor: isDark ? colors.border : '#cbd5e1',
              maxHeight: 160,
            }]}
            value={content}
            onChangeText={setContent}
            placeholder="Share something with your campus community…"
            placeholderTextColor={isDark ? '#8b96b0' : '#64748b'}
            cursorColor="#f5a623"
            selectionColor="rgba(245,166,35,0.3)"
            multiline
            scrollEnabled={true}
            maxLength={500}
          />
          {/* Staged Image Card (Before Attachment: Rotate, Crop, Attach tick, and Reject cross) */}
          {stagedAttachment && !attachment && (
            <View style={[styles.attachmentPreviewRow, { backgroundColor: isDark ? '#162235' : '#f1f5f9', borderColor: colors.accent, borderWidth: 1.5, padding: 8 }]}>
              <Image source={{ uri: stagedAttachment.uri }} style={styles.attachmentPreviewThumb} />
              <View style={{ flex: 1, paddingHorizontal: 6 }}>
                <Text style={[styles.attachmentPreviewName, { color: isDark ? '#ffffff' : '#0f172a' }]} numberOfLines={1}>{stagedAttachment.name}</Text>
                <Text style={{ color: colors.accent, fontSize: 10.5, fontWeight: '700' }}>
                  {uploadingAttachment ? '⏳ Attaching…' : '📷 Staged — tap ✓ to attach'}
                </Text>
              </View>

              <TouchableOpacity
                onPress={handleRotateStagedImage}
                disabled={uploadingAttachment}
                style={[styles.inlineStagingBtn, { backgroundColor: isDark ? '#1e293b' : '#e2e8f0', borderColor: colors.accent }]}
                activeOpacity={0.75}
              >
                <Text style={{ fontSize: 13, color: colors.accent }}>⟳</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleRecropStagedImage}
                disabled={uploadingAttachment}
                style={[styles.inlineStagingBtn, { backgroundColor: isDark ? '#1e293b' : '#e2e8f0', borderColor: colors.accent }]}
                activeOpacity={0.75}
              >
                <Text style={{ fontSize: 13, color: colors.accent }}>✂️</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleConfirmAndUploadAttachment}
                disabled={uploadingAttachment}
                style={[styles.inlineStagingBtn, { backgroundColor: '#2dd4a0', borderColor: '#2dd4a0' }]}
                activeOpacity={0.8}
              >
                {uploadingAttachment ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Text style={{ color: '#000', fontSize: 14, fontWeight: '900' }}>✓</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setStagedAttachment(null)}
                disabled={uploadingAttachment}
                style={[styles.inlineStagingBtn, { backgroundColor: 'rgba(255,82,82,0.15)', borderColor: colors.red }]}
              >
                <Text style={{ color: colors.red, fontSize: 14, fontWeight: '900' }}>✕</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Attached Image Preview (After Attachment: Rotate, Crop, and Attach options REMOVED) */}
          {attachment && (
            <View style={[styles.attachmentPreviewRow, { backgroundColor: isDark ? '#162235' : '#f1f5f9', borderColor: colors.green, borderWidth: 1.5 }]}>
              <Image source={{ uri: attachment.uri }} style={styles.attachmentPreviewThumb} />
              <View style={{ flex: 1, paddingHorizontal: 8 }}>
                <Text style={[styles.attachmentPreviewName, { color: isDark ? '#ffffff' : '#0f172a' }]} numberOfLines={1}>{attachment.name}</Text>
                <Text style={{ color: colors.green, fontSize: 11, fontWeight: '700' }}>
                  ✓ Image attached
                </Text>
              </View>

              {/* Only Remove button after attached */}
              <TouchableOpacity onPress={() => setAttachment(null)} style={styles.removeAttachmentBtn}>
                <Text style={styles.removeAttachmentText}>✕</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.composeToolbar}>
            {/* Single Attach button with Photo & Gallery options */}
            <TouchableOpacity
              onPress={() => setShowAttachModal(true)}
              style={styles.attachMainBtn}
              activeOpacity={0.75}
            >
              <Text style={styles.attachMainIcon}>📎</Text>
              <Text style={styles.attachMainText}>Attach</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setAnonymous(a => !a)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={[styles.checkbox, anonymous && styles.checkboxActive]}>
                {anonymous && <Text style={{ color: '#000', fontSize: 10, fontWeight: '800' }}>✓</Text>}
              </View>
              <Text style={{ color: isDark ? colors.text2 : '#475569', fontSize: 12 }}>Anonymous</Text>
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

      {/* Attach Modal with Take Photo or Upload options */}
      <Modal
        visible={showAttachModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAttachModal(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowAttachModal(false)}
        >
          <View style={styles.attachModalCard}>
            <Text style={styles.attachModalTitle}>📎 Attach Media</Text>
            <Text style={styles.attachModalSub}>Choose an option to add to your campus post</Text>

            <TouchableOpacity
              style={styles.attachModalOption}
              onPress={() => {
                setShowAttachModal(false);
                setTimeout(handleCameraPhoto, 200);
              }}
              activeOpacity={0.8}
            >
              <View style={[styles.attachIconWrap, { backgroundColor: 'rgba(0, 229, 255, 0.15)' }]}>
                <Text style={{ fontSize: 20 }}>📷</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.attachOptionTitle}>Take Photo</Text>
                <Text style={styles.attachOptionSub}>Capture directly with your camera</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.attachModalOption}
              onPress={() => {
                setShowAttachModal(false);
                setTimeout(handlePickImage, 200);
              }}
              activeOpacity={0.8}
            >
              <View style={[styles.attachIconWrap, { backgroundColor: 'rgba(45, 212, 160, 0.15)' }]}>
                <Text style={{ fontSize: 20 }}>🖼️</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.attachOptionTitle}>Choose from Gallery</Text>
                <Text style={styles.attachOptionSub}>Select and crop photo from library</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.attachModalCancelBtn}
              onPress={() => setShowAttachModal(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.attachModalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Full-Screen Photo Editor & Cropper Modal ── */}
      <Modal
        visible={showImageEditorModal && Boolean(stagedAttachment)}
        transparent={false}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => {
          if (!uploadingAttachment) {
            setShowImageEditorModal(false);
            setStagedAttachment(null);
          }
        }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }}>
          {/* Clean Top Bar: Back Arrow & Title */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 14,
            borderBottomWidth: 1,
            borderBottomColor: '#1c2638',
            backgroundColor: '#0a0e17',
          }}>
            <TouchableOpacity
              onPress={() => {
                if (!uploadingAttachment) {
                  setShowImageEditorModal(false);
                  setStagedAttachment(null);
                }
              }}
              style={{ padding: 6, marginRight: 12 }}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={{ color: '#ffffff', fontSize: 24, fontWeight: '700' }}>←</Text>
            </TouchableOpacity>
            <View>
              <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '800' }}>Photo Staging & Crop</Text>
              <Text style={{ color: '#8b96b0', fontSize: 11 }}>Adjust photo before uploading to community</Text>
            </View>
          </View>

          {/* Full Screen Image Preview with 3x3 Grid Overlay */}
          <View style={{ flex: 1, backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center', padding: 12 }}>
            <View style={{ width: '100%', height: '88%', position: 'relative', justifyContent: 'center', alignItems: 'center' }}>
              {stagedAttachment?.uri ? (
                <Image
                  source={{ uri: stagedAttachment.uri }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="contain"
                />
              ) : null}

              {/* Crop Grid Lines (3x3 grid) */}
              <View pointerEvents="none" style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                borderWidth: 1.5,
                borderColor: 'rgba(255, 255, 255, 0.45)',
              }}>
                <View style={{ position: 'absolute', top: '33.33%', left: 0, right: 0, height: 1, backgroundColor: 'rgba(255, 255, 255, 0.25)' }} />
                <View style={{ position: 'absolute', top: '66.66%', left: 0, right: 0, height: 1, backgroundColor: 'rgba(255, 255, 255, 0.25)' }} />
                <View style={{ position: 'absolute', left: '33.33%', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(255, 255, 255, 0.25)' }} />
                <View style={{ position: 'absolute', left: '66.66%', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(255, 255, 255, 0.25)' }} />
              </View>
            </View>
          </View>

          {/* Bottom Floating Staging Bar with ONLY the 4 options: Rotate, Crop, Attach ✓, Cancel ✕ */}
          <View style={{
            paddingHorizontal: 8,
            paddingVertical: 12,
            backgroundColor: '#0a0e17',
            borderTopWidth: 1,
            borderTopColor: '#1c2638',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            {/* 1. Rotate */}
            <TouchableOpacity
              onPress={handleRotateStagedImage}
              disabled={uploadingAttachment}
              style={{
                flex: 1,
                marginHorizontal: 3,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                backgroundColor: '#162235',
                borderWidth: 1.2,
                borderColor: colors.accent,
                borderRadius: radius.md,
                paddingVertical: 10,
                paddingHorizontal: 2,
              }}
              activeOpacity={0.75}
            >
              <Text style={{ fontSize: 14 }}>⟳</Text>
              <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '800' }} numberOfLines={1}>Rotate</Text>
            </TouchableOpacity>

            {/* 2. Crop */}
            <TouchableOpacity
              onPress={handleRecropStagedImage}
              disabled={uploadingAttachment}
              style={{
                flex: 1,
                marginHorizontal: 3,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                backgroundColor: '#162235',
                borderWidth: 1.2,
                borderColor: colors.accent,
                borderRadius: radius.md,
                paddingVertical: 10,
                paddingHorizontal: 2,
              }}
              activeOpacity={0.75}
            >
              <Text style={{ fontSize: 14 }}>✂️</Text>
              <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '800' }} numberOfLines={1}>Crop</Text>
            </TouchableOpacity>

            {/* 3. Attach (✓) */}
            <TouchableOpacity
              onPress={handleConfirmAndUploadAttachment}
              disabled={uploadingAttachment}
              style={{
                flex: 1,
                marginHorizontal: 3,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                backgroundColor: '#2dd4a0',
                borderRadius: radius.md,
                paddingVertical: 10,
                paddingHorizontal: 2,
              }}
              activeOpacity={0.8}
            >
              {uploadingAttachment ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <>
                  <Text style={{ color: '#000', fontSize: 14, fontWeight: '900' }}>✓</Text>
                  <Text style={{ color: '#000', fontSize: 12, fontWeight: '900' }} numberOfLines={1}>Attach</Text>
                </>
              )}
            </TouchableOpacity>

            {/* 4. Cancel (✕) */}
            <TouchableOpacity
              onPress={() => {
                if (!uploadingAttachment) {
                  setShowImageEditorModal(false);
                  setStagedAttachment(null);
                }
              }}
              disabled={uploadingAttachment}
              style={{
                flex: 1,
                marginHorizontal: 3,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                backgroundColor: 'rgba(255, 82, 82, 0.2)',
                borderWidth: 1.2,
                borderColor: colors.red,
                borderRadius: radius.md,
                paddingVertical: 10,
                paddingHorizontal: 2,
              }}
              activeOpacity={0.75}
            >
              <Text style={{ color: colors.red, fontSize: 14, fontWeight: '900' }}>✕</Text>
              <Text style={{ color: colors.red, fontSize: 12, fontWeight: '800' }} numberOfLines={1}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Full-Screen Image Viewer Modal for Post Photos */}
      <Modal
        visible={Boolean(previewPhotoUrl)}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setPreviewPhotoUrl(null)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.96)', justifyContent: 'center', alignItems: 'center' }}>
          <TouchableOpacity
            style={{
              position: 'absolute',
              top: 40,
              right: 20,
              zIndex: 999,
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: 'rgba(255,255,255,0.2)',
              justifyContent: 'center',
              alignItems: 'center',
            }}
            onPress={() => setPreviewPhotoUrl(null)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={{ color: '#ffffff', fontSize: 22, fontWeight: '900' }}>✕</Text>
          </TouchableOpacity>
          {previewPhotoUrl ? (
            <Image
              source={{ uri: previewPhotoUrl }}
              style={{ width: '96%', height: '82%' }}
              resizeMode="contain"
            />
          ) : null}
        </SafeAreaView>
      </Modal>

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
        const badge = getCategoryBadge(post.displayType || post.type);

        return (
          <View key={post._id} style={[styles.postCard, { backgroundColor: isDark ? colors.surface : '#ffffff', borderColor: isDark ? colors.border : '#e2e8f0' }]}>
            {/* Top Category Badge Displayed Prominently Above Post Content */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <View style={[styles.postCategoryBadge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
                <Text style={[styles.postCategoryBadgeText, { color: badge.text }]}>
                  {badge.label}
                </Text>
              </View>
              {isOwner && (
                <TouchableOpacity
                  onPress={() => handleDelete(post._id)}
                  style={styles.deleteBadgeBtn}
                  activeOpacity={0.7}
                >
                  <Text style={{ color: colors.red, fontSize: 11, fontWeight: '700' }}>🗑️ Delete</Text>
                </TouchableOpacity>
              )}
            </View>

            <Text style={{ color: isDark ? colors.text : '#0f172a', fontSize: 14.5, lineHeight: 21, marginBottom: 10 }}>{post.content}</Text>
            
            {Array.isArray(post.attachments) && post.attachments.map((att, attIdx) => att?.url ? (
              <TouchableOpacity
                key={attIdx}
                activeOpacity={0.9}
                onPress={() => setPreviewPhotoUrl(att.url)}
                style={{ marginBottom: 10, borderRadius: radius.md, overflow: 'hidden', backgroundColor: '#0a0e17' }}
              >
                <Image
                  source={{ uri: att.url }}
                  style={{ width: '100%', height: 240, borderRadius: radius.md }}
                  resizeMode="contain"
                />
                <View style={{
                  position: 'absolute',
                  bottom: 8,
                  right: 8,
                  backgroundColor: 'rgba(0,0,0,0.7)',
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: radius.sm,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                }}>
                  <Text style={{ color: '#ffffff', fontSize: 11, fontWeight: '700' }}>🔍 Tap to expand</Text>
                </View>
              </TouchableOpacity>
            ) : null)}

            <View style={styles.postFooterRow}>
              <Text style={{ color: isDark ? colors.text3 : '#64748b', fontSize: 11 }}>
                👤 {post.anonymous ? 'Anonymous Commuter' : (post.author?.name || post.authorName || 'Campus Commuter')} · {timeAgo(post.createdAt)}
              </Text>
              
              <View style={{ flexDirection: 'row', gap: 16 }}>
                {(() => {
                  const likeCount = typeof post.likes === 'number' ? post.likes : (Array.isArray(post.likedBy) ? post.likedBy.length : (Array.isArray(post.likes) ? post.likes.length : 0));
                  const isLiked = post.userLiked !== undefined
                    ? post.userLiked
                    : (Array.isArray(post.likedBy) && post.likedBy.some(id => (id._id || id).toString() === (currentUserId || '').toString()));
                  return (
                    <TouchableOpacity onPress={() => handleLike(post._id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Text style={{ fontSize: 14 }}>{isLiked ? '❤️' : '🤍'}</Text>
                      <Text style={[{ color: isLiked ? colors.accent : (isDark ? colors.text2 : '#475569'), fontSize: 12, fontWeight: isLiked ? '700' : '500' }]}>
                        {likeCount}
                      </Text>
                    </TouchableOpacity>
                  );
                })()}
                <TouchableOpacity onPress={() => setShowReply(s => ({ ...s, [post._id]: !s[post._id] }))} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={{ fontSize: 14 }}>💬</Text>
                  <Text style={{ color: isDark ? colors.text2 : '#475569', fontSize: 12 }}>{post.replies?.length || 0}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {showReply[post._id] && (
              <View style={{ marginTop: 10, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <TextInput
                  style={[styles.replyInput, {
                    flex: 1,
                    maxHeight: 110,
                    minHeight: 44,
                    color: isDark ? '#ffffff' : '#0f172a',
                    backgroundColor: isDark ? '#162235' : '#f1f5f9',
                    borderColor: isDark ? '#26344d' : '#cbd5e1',
                    fontSize: 14,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                  }]}
                  value={replyText[post._id] || ''}
                  onChangeText={t => setReplyText(r => ({ ...r, [post._id]: t }))}
                  placeholder="Write a reply…"
                  placeholderTextColor={isDark ? '#8b96b0' : '#64748b'}
                  cursorColor="#f5a623"
                  selectionColor="rgba(245,166,35,0.3)"
                  multiline={true}
                  scrollEnabled={true}
                  onFocus={() => {
                    setTimeout(() => {
                      scrollRef.current?.scrollToEnd({ animated: true });
                    }, 250);
                  }}
                />
                <TouchableOpacity onPress={() => handleReply(post._id)} style={styles.replyBtn}>
                  <Text style={{ color: '#000', fontWeight: '700', fontSize: 12 }}>Send</Text>
                </TouchableOpacity>
              </View>
            )}
            {(post.replies || []).map((r, i) => {
              const replyAuthorId = (r.authorId?._id || r.authorId || '').toString();
              const postAuthorId = (post.author?._id || post.author || '').toString();
              const myIdStr = (currentUserId || '').toString();
              const canDeleteReply = replyAuthorId === myIdStr || postAuthorId === myIdStr || user?.role === 'admin';

              return (
                <View key={r._id || i} style={[styles.reply, { backgroundColor: isDark ? colors.surface2 : '#f8fafc', borderColor: isDark ? colors.border : '#e2e8f0', borderWidth: 1 }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ color: colors.accent, fontSize: 11, fontWeight: '700' }}>
                      {r.authorName || 'User'}
                    </Text>
                    {canDeleteReply && (
                      <TouchableOpacity
                        onPress={() => handleDeleteReply(post._id, r._id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={{ color: colors.red, fontSize: 11, fontWeight: '600' }}>🗑️ Delete</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={{ color: isDark ? colors.text : '#1e293b', fontSize: 13, marginTop: 3 }}>{r.content}</Text>
                </View>
              );
            })}
          </View>
        );
      })}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── College Chat Tab ──────────────────────────────────────────────
function CollegeChatTab({ user }) {
  const [messages, setMessages] = useState([]);
  const [input,    setInput]    = useState('');
  const [loading,  setLoading]  = useState(true);
  const [anonymous,setAnonymous]= useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const socketRef  = useRef(null);
  const flatRef    = useRef(null);
  const insets     = useSafeAreaInsets();
  const { isDark } = useTheme();

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardVisible(true);
        setKeyboardHeight(e.endCoordinates?.height || 0);
        setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
        setKeyboardHeight(0);
      }
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (!user?.college) return;
    getChatMessages(user.college)
      .then(data => setMessages(Array.isArray(data) ? data : []))
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
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ flex: 1, marginTop: 40 }} />
      ) : (
        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={(item, i) => item._id || String(i)}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={true}
          onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => {
            const isMe = item.senderId === myId;
            return (
              <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
                <View style={[
                  styles.msgBubble,
                  isMe ? styles.msgBubbleMe : { backgroundColor: isDark ? colors.surface2 : '#f1f5f9', borderColor: isDark ? colors.border : '#e2e8f0', borderWidth: 1 }
                ]}>
                  {!isMe && (
                    <Text style={{ color: colors.accent, fontSize: 11, fontWeight: '700', marginBottom: 2 }}>
                      {item.anonymous ? 'Anonymous' : item.senderName}
                      {item.senderUsn ? ` · ${getDisplayUSN(item.senderUsn, 'Buddy')}` : ''}
                    </Text>
                  )}
                  <Text style={[styles.msgText, isMe ? styles.msgTextMe : { color: isDark ? colors.text : '#0f172a' }]}>{item.message}</Text>
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
      <View style={[
        styles.chatInput,
        {
          backgroundColor: isDark ? '#0c121e' : '#ffffff',
          borderTopColor: isDark ? '#1c2638' : '#e2e8f0',
          paddingBottom: Math.max(insets.bottom, 10),
        }
      ]}>
        <TouchableOpacity
          onPress={() => setAnonymous(a => !a)}
          style={{ padding: 8, justifyContent: 'center', alignItems: 'center' }}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 20 }}>{anonymous ? '🎭' : '🎓'}</Text>
        </TouchableOpacity>
        <TextInput
          style={[
            styles.chatTextInput,
            {
              color: isDark ? '#ffffff' : '#0f172a',
              backgroundColor: isDark ? '#162235' : '#f1f5f9',
              borderColor: isDark ? '#26344d' : '#cbd5e1',
            }
          ]}
          value={input}
          onChangeText={setInput}
          placeholder={anonymous ? 'Send anonymously…' : 'Message your college…'}
          placeholderTextColor={isDark ? '#8b96b0' : '#64748b'}
          cursorColor="#f5a623"
          selectionColor="rgba(245,166,35,0.3)"
          multiline={true}
          scrollEnabled={true}
          textAlignVertical="center"
          returnKeyType="default"
        />
        <TouchableOpacity style={styles.sendBtn} onPress={sendMsg} activeOpacity={0.8}>
          <Text style={{ color: '#000', fontSize: 16, fontWeight: '800' }}>➤</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ── Main Screen ───────────────────────────────────────────────────
export default function CommunityScreen({ navigation }) {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    resetCommunityUnreadCount();
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? colors.bg : '#f8fafc' }} edges={['top']}>
      <TopHeader 
        title="Campus Community" 
        subtitle="Campus Posts & Student Chat" 
        showBack={navigation?.canGoBack ? navigation.canGoBack() : false} 
      />

      {/* Tabs */}
      <View style={[styles.tabBar, { backgroundColor: isDark ? colors.surface : '#ffffff', borderBottomColor: isDark ? colors.border : '#e2e8f0' }]}>
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
  editorModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    padding: 20,
  },
  editorModalCard: {
    borderRadius: radius.xxl,
    borderWidth: 1.5,
    padding: 18,
  },
  editorModalTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  editorCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editorPreviewBox: {
    width: '100%',
    height: 270,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  editorButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  editorBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 11,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  editorConfirmBtn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  editorBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  tabBar:  { flexDirection: 'row', backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab:     { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.accent },
  tabText:   { color: colors.text2, fontSize: 14, fontWeight: '600' },
  tabTextActive: { color: colors.accent },

  // Sitcom styles removed

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
    padding: spacing.md, marginBottom: 12,
  },
  postCategoryBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  postCategoryBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  deleteBadgeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,82,82,0.1)',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.red + '44',
  },
  postFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
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
    backgroundColor: '#0c121e', borderTopWidth: 1.5, borderTopColor: '#1c2638',
    paddingHorizontal: 12, paddingVertical: 10,
  },
  chatTextInput: {
    flex: 1, backgroundColor: '#162235', borderRadius: 22,
    paddingHorizontal: 16, paddingVertical: 10,
    color: '#ffffff', fontSize: 15, minHeight: 44, maxHeight: 110,
    borderWidth: 1.5, borderColor: '#26344d',
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
  cropActionBtn: {
    backgroundColor: 'rgba(245,166,35,0.15)',
    borderWidth: 1,
    borderColor: colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.md,
    marginRight: 6,
  },
  attachTickBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.green,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  inlineStagingBtn: {
    width: 30,
    height: 30,
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
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
  attachMainBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accentDim,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.accent + '44',
  },
  attachMainIcon: {
    fontSize: 15,
  },
  attachMainText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  postAttachmentImage: {
    width: '100%',
    height: 190,
    borderRadius: radius.md,
    marginBottom: 10,
    backgroundColor: '#161b22',
  },

  /* Attach Modal Styles */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
    padding: spacing.md,
    paddingBottom: 28,
  },
  attachModalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  attachModalTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 4,
  },
  attachModalSub: {
    color: colors.text2,
    fontSize: 12,
    marginBottom: 16,
  },
  attachModalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface2,
    borderRadius: radius.lg,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  attachIconWrap: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachOptionTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  attachOptionSub: {
    color: colors.text3,
    fontSize: 11,
    marginTop: 2,
  },
  attachModalCancelBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  attachModalCancelText: {
    color: colors.text3,
    fontSize: 13.5,
    fontWeight: '600',
  },
});
