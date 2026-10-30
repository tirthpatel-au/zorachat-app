import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';
import { getBackendUrl, INITIAL_STORE, loadStore, saveStore, type Store } from './backend';

type Screen = 'welcome' | 'login' | 'create';
type Tab = 'Chats' | 'Friends' | 'Settings';

const ACCENTS: [string, string][] = [
  ['#58e3d5', '#3a7cff'],
  ['#7bc9ff', '#7559ff'],
  ['#a7f0de', '#4ba7ff'],
  ['#c6b8ff', '#8b4fff'],
];
const BRAND_NAME = 'Velora';
const PRIMARY_GRADIENT: [string, string] = ['#50e0d9', '#7b45ff'];
const PRIMARY_GRADIENT_STRONG: [string, string] = ['#1994ef', '#8548ff'];
const BRAND_COPY = 'A fluid social messaging experience designed around fast conversations, elegant profiles, and a calm cyan-to-violet visual rhythm.';
const QUICK_EMOJIS = ['😀', '😂', '😍', '😭', '👍', '🙏', '🔥', '❤️', '🎉', '😎', '🤝', '😊'];

type AnimatedPressableProps = React.ComponentProps<typeof Pressable> & {
  scaleTo?: number;
  containerStyle?: StyleProp<ViewStyle>;
};

function AnimatedPressable({
  children,
  onPressIn,
  onPressOut,
  scaleTo = 0.975,
  containerStyle,
  ...props
}: AnimatedPressableProps) {
  const scale = React.useRef(new Animated.Value(1)).current;

  const animateTo = (toValue: number) => {
    Animated.spring(scale, {
      toValue,
      tension: 280,
      friction: 18,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={[containerStyle, { transform: [{ scale }] }]}>
      <Pressable
        {...props}
        onPressIn={(event) => {
          animateTo(scaleTo);
          onPressIn?.(event);
        }}
        onPressOut={(event) => {
          animateTo(1);
          onPressOut?.(event);
        }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

export default function App() {
  const [store, setStore] = useState<Store>(INITIAL_STORE);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<Screen>('login');
  const [tab, setTab] = useState<Tab>('Chats');
  const [notice, setNotice] = useState('Login or create an account, then add a friend by email and chat.');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newAbout, setNewAbout] = useState('');
  const [chatSearch, setChatSearch] = useState('');
  const [searchEmail, setSearchEmail] = useState('');
  const [draft, setDraft] = useState('');
  const [selectedFriendEmail, setSelectedFriendEmail] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editAbout, setEditAbout] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyText, setBusyText] = useState('Loading...');
  const [chatOpen, setChatOpen] = useState(false);
  const [showEmojiTray, setShowEmojiTray] = useState(false);
  const isWeb = Platform.OS === 'web';
  const { width } = useWindowDimensions();
  const isCompactLayout = width < 900;
  const authMode = React.useRef(new Animated.Value(0)).current;

  const me = store.profiles.find((p) => p.email === store.currentUserEmail) ?? null;
  const friendsEmails = useMemo(() => {
    if (!me) return [];
    return store.requests
      .filter((r) => r.status === 'accepted' && (r.fromEmail === me.email || r.toEmail === me.email))
      .map((r) => (r.fromEmail === me.email ? r.toEmail : r.fromEmail));
  }, [me, store.requests]);
  const friends = store.profiles.filter((p) => friendsEmails.includes(p.email));
  const incoming = store.requests.filter((r) => r.toEmail === me?.email && r.status === 'pending');
  const outgoing = store.requests.filter((r) => r.fromEmail === me?.email && r.status === 'pending');
  const found = store.profiles.find((p) => p.email === searchEmail.trim().toLowerCase()) ?? null;
  const activeFriend = friends.find((p) => p.email === selectedFriendEmail) ?? null;
  const filteredFriends = friends.filter((p) => {
    const query = chatSearch.trim().toLowerCase();
    if (!query) return true;
    return p.name.toLowerCase().includes(query) || p.email.toLowerCase().includes(query);
  }).sort((a, b) => {
    const aThread = store.threads.find((t) => t.participants.includes(me?.email ?? '') && t.participants.includes(a.email));
    const bThread = store.threads.find((t) => t.participants.includes(me?.email ?? '') && t.participants.includes(b.email));
    const aUnread = aThread?.unreadCounts?.[me?.email ?? ''] ?? 0;
    const bUnread = bThread?.unreadCounts?.[me?.email ?? ''] ?? 0;
    if (aUnread !== bUnread) return bUnread - aUnread;
    return a.name.localeCompare(b.name);
  });
  const activeThread =
    me && activeFriend
      ? store.threads.find((t) => t.participants.includes(me.email) && t.participants.includes(activeFriend.email)) ??
        null
      : null;
  const totalUnread = me
    ? store.threads.reduce((sum, thread) => sum + (thread.unreadCounts?.[me.email] ?? 0), 0)
    : 0;

  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
    loadStore()
      .then((saved) => {
        setStore(saved);
      })
      .catch(() => {
        setNotice(`Shared backend offline. Run "npm run server" in the project folder, then refresh. Backend URL: ${getBackendUrl()}.`);
      })
      .finally(() => {
        setReady(true);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!ready) return;
    saveStore(store).catch(() => undefined);
  }, [ready, store]);

  useEffect(() => {
    if (me) {
      setEditName(me.name);
      setEditAbout(me.about);
      setEditPassword(me.password);
    }
  }, [me]);

  useEffect(() => {
    Animated.timing(authMode, {
      toValue: screen === 'create' ? 1 : 0,
      duration: 1150,
      useNativeDriver: true,
    }).start();
  }, [authMode, screen]);

  const patchStore = (updater: (current: Store) => Store) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setStore((current) => updater(current));
  };

  const renderIcon = (
    name: 'info' | 'chat' | 'logout' | 'bell' | 'back' | 'send',
    color: string,
    size: number
  ) => {
    if (!isWeb) {
      const iconName =
        name === 'info'
          ? 'information-circle-outline'
          : name === 'chat'
            ? 'chatbubble-ellipses-outline'
            : name === 'logout'
              ? 'log-out-outline'
              : name === 'bell'
                ? 'notifications'
                : name === 'back'
                  ? 'arrow-back'
                  : 'send';
      return <Ionicons name={iconName} size={size} color={color} />;
    }

    const glyph =
      name === 'info'
        ? 'i'
        : name === 'chat'
          ? '...'
          : name === 'logout'
            ? '->'
            : name === 'bell'
              ? '!'
              : name === 'back'
                ? '<'
                : '>';

    return <Text style={[styles.webIconGlyph, { color, fontSize: size }]}>{glyph}</Text>;
  };

  const renderBrandArtwork = (compact: boolean) => (
    <View style={[styles.brandLogoShell, compact && styles.brandLogoShellCompact]}>
      <LinearGradient
        colors={PRIMARY_GRADIENT}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.brandMark, compact && styles.brandMarkCompact]}
      >
        <Text style={[styles.brandMarkLetter, compact && styles.brandMarkLetterCompact]}>V</Text>
        <View style={[styles.brandMarkTail, compact && styles.brandMarkTailCompact]} />
      </LinearGradient>
    </View>
  );

  const smoothAction = (text: string, action: () => void) => {
    setBusyText(text);
    setBusy(true);
    setTimeout(() => {
      action();
      setBusy(false);
    }, 420);
  };

  const openChat = (email: string) => {
    setSelectedFriendEmail(email);
    setChatOpen(true);
    if (!me) {
      return;
    }
    patchStore((current) => ({
      ...current,
      threads: current.threads.map((thread) =>
        thread.participants.includes(me.email) && thread.participants.includes(email)
          ? {
              ...thread,
              unreadCounts: {
                ...(thread.unreadCounts ?? {}),
                [me.email]: 0,
              },
            }
          : thread
      ),
    }));
  };

  const createAccount = () => {
    const name = newName.trim();
    const email = newEmail.trim().toLowerCase();
    const password = newPassword.trim();
    if (!name || !email || !password) return setNotice('Name, email, and password are required.');
    if (!email.includes('@')) return setNotice('Enter a valid email.');
    if (password.length < 6) return setNotice('Password must be at least 6 characters.');
    if (store.profiles.some((p) => p.email === email)) return setNotice('That email already exists. Use login.');
    smoothAction('Creating account...', () => {
      patchStore((current) => ({
        ...current,
        profiles: [
          ...current.profiles,
          {
            id: `p-${Date.now()}`,
            name,
            email,
            password,
            about: newAbout.trim() || `Hey there! I am using ${BRAND_NAME}.`,
            accent: ACCENTS[current.profiles.length % ACCENTS.length],
          },
        ],
        currentUserEmail: email,
      }));
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      setNewAbout('');
      setScreen('login');
      setTab('Chats');
      setNotice(`${name} created and logged in.`);
    });
  };

  const login = () => {
    const email = loginEmail.trim().toLowerCase();
    const password = loginPassword.trim();
    if (!email || !password) return setNotice('Email and password are required.');
    const user = store.profiles.find((p) => p.email === email);
    if (!user) return setNotice('No user found with that email.');
    if (user.password !== password) return setNotice('Incorrect password.');
    smoothAction('Logging in...', () => {
      patchStore((current) => ({ ...current, currentUserEmail: email }));
      setLoginEmail('');
      setLoginPassword('');
      setScreen('login');
      setTab('Chats');
      setNotice(`Logged in as ${user.name}.`);
    });
  };

  const logout = () => {
    smoothAction('Logging out...', () => {
      patchStore((current) => ({ ...current, currentUserEmail: null }));
      setSelectedFriendEmail(null);
      setChatOpen(false);
      setSearchEmail('');
      setDraft('');
      setScreen('login');
      setNotice('Logged out. Login as another user to continue testing.');
    });
  };

  const sendRequest = () => {
    if (!me || !found) return;
    if (found.email === me.email) return setNotice('You cannot add yourself.');
    if (friendsEmails.includes(found.email)) {
      setSelectedFriendEmail(found.email);
      setTab('Chats');
      return setNotice(`${found.name} is already your friend.`);
    }
    const exists = store.requests.find(
      (r) =>
        ((r.fromEmail === me.email && r.toEmail === found.email) ||
          (r.fromEmail === found.email && r.toEmail === me.email)) &&
        r.status === 'pending'
    );
    if (exists) return setNotice('A pending request already exists.');
    smoothAction('Sending request...', () => {
      patchStore((current) => ({
        ...current,
        requests: [...current.requests, { id: `r-${Date.now()}`, fromEmail: me.email, toEmail: found.email, status: 'pending' }],
      }));
      setNotice(`Friend request sent to ${found.name}. Logout and login as that user to accept it.`);
    });
  };

  const acceptRequest = (requestId: string) => {
    smoothAction('Accepting request...', () => {
      patchStore((current) => {
        const request = current.requests.find((r) => r.id === requestId);
        if (!request) return current;
        const threadExists = current.threads.some(
          (t) => t.participants.includes(request.fromEmail) && t.participants.includes(request.toEmail)
        );
        return {
          ...current,
          requests: current.requests.map((r) => (r.id === requestId ? { ...r, status: 'accepted' } : r)),
          threads: threadExists
            ? current.threads
            : [
                ...current.threads,
                {
                  id: `t-${Date.now()}`,
                  participants: [request.fromEmail, request.toEmail],
                  unreadCounts: { [request.fromEmail]: 1, [request.toEmail]: 0 },
                  messages: [{ id: `m-${Date.now()}`, senderEmail: request.toEmail, text: 'We are now connected.', time: clock() }],
                },
              ],
        };
      });
      setNotice('Request accepted. Open Chats to start messaging.');
    });
  };

  const sendMessage = () => {
    if (!me || !activeThread) return;
    const text = draft.trim();
    if (!text) return;
    patchStore((current) => ({
      ...current,
      threads: current.threads.map((t) =>
        t.id === activeThread.id
          ? {
              ...t,
              messages: [...t.messages, { id: `m-${Date.now()}`, senderEmail: me.email, text, time: clock() }],
              unreadCounts: {
                ...(t.unreadCounts ?? {}),
                [me.email]: 0,
                [activeFriend?.email ?? '']: ((t.unreadCounts ?? {})[activeFriend?.email ?? ''] ?? 0) + 1,
              },
            }
          : t
      ),
    }));
    setDraft('');
    setShowEmojiTray(false);
  };

  const saveProfile = () => {
    if (!me || !editName.trim()) return setNotice('Profile name cannot be empty.');
    if (editPassword.trim().length < 6) return setNotice('Password must be at least 6 characters.');
    smoothAction('Saving profile...', () => {
      patchStore((current) => ({
        ...current,
        profiles: current.profiles.map((p) =>
          p.email === me.email
            ? {
                ...p,
                name: editName.trim(),
                password: editPassword.trim(),
                about: editAbout.trim() || `Hey there! I am using ${BRAND_NAME}.`,
              }
            : p
        ),
      }));
      setNotice('Profile updated.');
    });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.loading}>Loading {BRAND_NAME}...</Text>
      </View>
    );
  }

  return (
    <LinearGradient colors={['#eef7ff', '#fbf8ff']} style={styles.screen}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.screen}>
        <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {me ? appView() : authView()}
          {busy ? (
            <View style={styles.loadingOverlay}>
              <View style={styles.loadingCard}>
                <ActivityIndicator size="large" color="#5a61ff" />
                <Text style={styles.loadingCardText}>{busyText}</Text>
              </View>
            </View>
          ) : null}
        </KeyboardAvoidingView>
      </View>
    </LinearGradient>
  );

  function authView() {
    const isSignup = screen === 'create';
    const loginOpacity = authMode.interpolate({
      inputRange: [0, 0.45, 1],
      outputRange: [1, 0.15, 0],
    });
    const loginTranslate = authMode.interpolate({
      inputRange: [0, 1],
      outputRange: [0, -120],
    });
    const signupOpacity = authMode.interpolate({
      inputRange: [0, 0.55, 1],
      outputRange: [0, 0.15, 1],
    });
    const signupTranslate = authMode.interpolate({
      inputRange: [0, 1],
      outputRange: [120, 0],
    });
    const signinCopyOpacity = authMode.interpolate({
      inputRange: [0, 0.45, 1],
      outputRange: [1, 0.15, 0],
    });
    const signinCopyTranslate = authMode.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 120],
    });
    const signupCopyOpacity = authMode.interpolate({
      inputRange: [0, 0.55, 1],
      outputRange: [0, 0.15, 1],
    });
    const signupCopyTranslate = authMode.interpolate({
      inputRange: [0, 1],
      outputRange: [-120, 0],
    });
    const primaryShapeTranslate = authMode.interpolate({
      inputRange: [0, 1],
      outputRange: [120, -30],
    });
    const primaryShapeRotate = authMode.interpolate({
      inputRange: [0, 1],
      outputRange: ['12deg', '0deg'],
    });
    const primaryShapeSkew = authMode.interpolate({
      inputRange: [0, 1],
      outputRange: ['34deg', '0deg'],
    });
    const secondaryShapeTranslate = authMode.interpolate({
      inputRange: [0, 1],
      outputRange: [-120, 80],
    });
    const secondaryShapeRotate = authMode.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '-12deg'],
    });
    const secondaryShapeSkew = authMode.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '-34deg'],
    });

    return (
      <View style={styles.authPage}>
        <View style={styles.pageShell}>
          <View style={styles.authLayout}>
            <View style={styles.authBrandPanel}>
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.authShapePrimary,
                  {
                    transform: [
                      { translateX: primaryShapeTranslate },
                      { rotate: primaryShapeRotate },
                      { skewY: primaryShapeSkew },
                    ],
                  },
                ]}
              >
                <LinearGradient colors={['#0d1b31', '#143a61', '#6d46ff']} style={styles.authShapeFill} />
              </Animated.View>
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.authShapeSecondary,
                  {
                    transform: [
                      { translateX: secondaryShapeTranslate },
                      { rotate: secondaryShapeRotate },
                      { skewY: secondaryShapeSkew },
                    ],
                  },
                ]}
              />
              <Animated.View
                style={[
                  styles.brandWrap,
                  styles.brandWrapSignin,
                  {
                    opacity: signinCopyOpacity,
                    transform: [{ translateX: signinCopyTranslate }],
                  },
                ]}
                pointerEvents={isSignup ? 'none' : 'auto'}
              >
                <Text style={styles.welcomeEyebrow}>Welcome Back</Text>
                <Text style={styles.welcomeHeadline}>Pick up the conversation where you left off.</Text>
                <Text style={styles.welcomeText}>
                  Sign in to reach your chats, unread alerts, and friend connections inside {BRAND_NAME}.
                </Text>
              </Animated.View>
              <Animated.View
                style={[
                  styles.brandWrap,
                  styles.brandWrapSignup,
                  {
                    opacity: signupCopyOpacity,
                    transform: [{ translateX: signupCopyTranslate }],
                  },
                ]}
                pointerEvents={isSignup ? 'auto' : 'none'}
              >
                <Text style={styles.welcomeEyebrow}>Join Velora</Text>
                <Text style={styles.welcomeHeadline}>Create your profile and start connecting instantly.</Text>
                <Text style={styles.welcomeText}>
                  Set up your identity, add friends by email, and move into a cleaner messaging flow.
                </Text>
              </Animated.View>
            </View>
            <View style={styles.authDivider} />
            <View style={styles.authPanel}>
              <View style={styles.authPanelInner}>
                <View style={styles.brandInline}>
                  {renderBrandArtwork(false)}
                  <View style={styles.brandInlineText}>
                    <Text style={styles.brandTitle}>{BRAND_NAME}</Text>
                    <Text style={styles.brandSubtitle}>Connected Conversation</Text>
                  </View>
                </View>
                <View style={styles.noticeBox}>
                  {renderIcon('info', '#5f6e86', 18)}
                  <Text style={styles.notice}>{notice}</Text>
                </View>
                <View style={styles.authFormsFrame}>
                  <Animated.View
                    style={[
                      styles.authFormPanel,
                      {
                        opacity: loginOpacity,
                        transform: [{ translateX: loginTranslate }],
                      },
                    ]}
                    pointerEvents={isSignup ? 'none' : 'auto'}
                  >
                    <View style={styles.authCard}>
                      <Text style={styles.cardTitle}>Login</Text>
                      <TextInput value={loginEmail} onChangeText={setLoginEmail} autoCapitalize="none" keyboardType="email-address" placeholder="Email address" placeholderTextColor="#8c9aa5" style={styles.input} />
                      <TextInput value={loginPassword} onChangeText={setLoginPassword} placeholder="Password" placeholderTextColor="#8c9aa5" secureTextEntry style={styles.input} />
                      <AnimatedPressable onPress={login} style={styles.greenBtnWrap}>
                        <LinearGradient colors={PRIMARY_GRADIENT_STRONG} style={styles.greenBtn}>
                          <Text style={styles.greenBtnText}>Continue</Text>
                        </LinearGradient>
                      </AnimatedPressable>
                      <View style={styles.switchLink}>
                        <Text style={styles.switchText}>Don&apos;t have an account?</Text>
                        <AnimatedPressable onPress={() => setScreen('create')}>
                          <Text style={styles.switchAction}>Sign Up</Text>
                        </AnimatedPressable>
                      </View>
                    </View>
                  </Animated.View>
                  <Animated.View
                    style={[
                      styles.authFormPanel,
                      styles.authFormPanelOverlay,
                      {
                        opacity: signupOpacity,
                        transform: [{ translateX: signupTranslate }],
                      },
                    ]}
                    pointerEvents={isSignup ? 'auto' : 'none'}
                  >
                    <View style={styles.authCard}>
                      <Text style={styles.cardTitle}>Register</Text>
                      <TextInput value={newName} onChangeText={setNewName} placeholder="Name" placeholderTextColor="#8c9aa5" style={styles.input} />
                      <TextInput value={newEmail} onChangeText={setNewEmail} autoCapitalize="none" keyboardType="email-address" placeholder="Email address" placeholderTextColor="#8c9aa5" style={styles.input} />
                      <TextInput value={newPassword} onChangeText={setNewPassword} placeholder="Password" placeholderTextColor="#8c9aa5" secureTextEntry style={styles.input} />
                      <AnimatedPressable onPress={createAccount} style={styles.greenBtnWrap}>
                        <LinearGradient colors={PRIMARY_GRADIENT_STRONG} style={styles.greenBtn}>
                          <Text style={styles.greenBtnText}>Create and Login</Text>
                        </LinearGradient>
                      </AnimatedPressable>
                      <View style={styles.switchLink}>
                        <Text style={styles.switchText}>Already have an account?</Text>
                        <AnimatedPressable onPress={() => setScreen('login')}>
                          <Text style={styles.switchAction}>Sign In</Text>
                        </AnimatedPressable>
                      </View>
                    </View>
                  </Animated.View>
                </View>
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  }

  function appView() {
    if (!me) {
      return null;
    }

    const mobileThreadOpen = isCompactLayout && tab === 'Chats' && chatOpen && activeFriend && activeThread;

    return (
      <View style={[styles.appShell, isCompactLayout && styles.appShellCompact]}>
        {mobileThreadOpen ? null : (
          <View style={[styles.sidebarPanel, isCompactLayout && styles.sidebarPanelCompact]}>
            <View style={[styles.sidebarTopbar, isCompactLayout && styles.sidebarTopbarCompact]}>
              <LinearGradient colors={me.accent} style={styles.sidebarAvatar}>
                <Text style={styles.sidebarAvatarText}>{me.name.charAt(0).toUpperCase()}</Text>
              </LinearGradient>
              <View style={styles.sidebarTopbarActions}>
                <AnimatedPressable onPress={logout} style={styles.sidebarLogoutBtn}>
                  <Text style={styles.sidebarLogoutText}>Logout</Text>
                </AnimatedPressable>
              </View>
            </View>
            <View style={[styles.sidebarNav, isCompactLayout && styles.sidebarNavCompact]}>
              {(['Chats', 'Friends', 'Settings'] as Tab[]).map((item) => (
                <AnimatedPressable
                  key={item}
                  onPress={() => setTab(item)}
                  style={[styles.sidebarNavItem, isCompactLayout && styles.sidebarNavItemCompact, tab === item && styles.sidebarNavItemActive]}
                >
                  <View style={styles.sidebarNavLabelWrap}>
                    <Text style={[styles.sidebarNavLabel, tab === item && styles.sidebarNavLabelActive]}>{item}</Text>
                    {item === 'Friends' && incoming.length > 0 && tab !== 'Friends' ? <View style={styles.sidebarNavDot} /> : null}
                  </View>
                </AnimatedPressable>
              ))}
            </View>
            {tab === 'Chats' ? (
              <>
                <View style={[styles.sidebarSectionHeader, isCompactLayout && styles.sidebarSectionHeaderCompact]}>
                  <Text style={styles.sidebarSectionTitle}>Unread messages</Text>
                  <Text style={styles.sidebarSectionMeta}>
                    {totalUnread > 0 ? `${totalUnread} unread` : 'All caught up'}
                  </Text>
                </View>
                <View style={[styles.sidebarSearchWrap, isCompactLayout && styles.sidebarSearchWrapCompact]}>
                  <TextInput
                    value={chatSearch}
                    onChangeText={setChatSearch}
                    placeholder="Search or start new chat"
                    placeholderTextColor="#8e9aa4"
                    style={styles.sidebarSearchInput}
                  />
                </View>
                <ScrollView style={styles.chatListScroll} contentContainerStyle={styles.chatListContent}>
                  {filteredFriends.length === 0 ? (
                    <Text style={styles.sidebarHelper}>No chats yet. Add a friend from the Friends section.</Text>
                  ) : (
                    filteredFriends.map((friend) => {
                      const thread = store.threads.find((t) => t.participants.includes(me.email) && t.participants.includes(friend.email));
                      const last = thread?.messages[thread.messages.length - 1];
                      const unread = thread?.unreadCounts?.[me.email] ?? 0;
                      const previewPrefix = last?.senderEmail === me.email ? 'You: ' : '';
                      return (
                        <AnimatedPressable
                          key={friend.id}
                          onPress={() => openChat(friend.email)}
                          style={[styles.sidebarChatRow, isCompactLayout && styles.sidebarChatRowCompact, activeFriend?.email === friend.email && styles.sidebarChatRowActive]}
                        >
                          <LinearGradient colors={friend.accent} style={styles.sidebarChatAvatar}>
                            <Text style={styles.sidebarChatAvatarText}>{friend.name.charAt(0).toUpperCase()}</Text>
                          </LinearGradient>
                          <View style={styles.flex1}>
                            <View style={styles.sidebarChatHeader}>
                              <Text style={styles.sidebarChatName}>{friend.name}</Text>
                              <Text style={styles.sidebarChatTime}>{last?.time ?? ''}</Text>
                            </View>
                            <View style={styles.sidebarChatFooter}>
                              <Text numberOfLines={1} style={styles.sidebarChatPreview}>
                                {previewPrefix}
                                {last?.text ?? 'Tap to start chatting'}
                              </Text>
                              {unread > 0 ? (
                                <View style={styles.sidebarUnreadBadge}>
                                  <Text style={styles.sidebarUnreadText}>{unread}</Text>
                                </View>
                              ) : null}
                            </View>
                          </View>
                        </AnimatedPressable>
                      );
                    })
                  )}
                </ScrollView>
              </>
            ) : null}
            {tab === 'Friends' ? (
              <ScrollView
                style={[styles.sidebarSectionScroll, isCompactLayout && styles.sidebarSectionScrollCompact]}
                contentContainerStyle={[styles.sidebarSectionContent, isCompactLayout && styles.sidebarSectionContentCompact]}
              >
                {friendsTab()}
              </ScrollView>
            ) : null}
            {tab === 'Settings' ? (
              <ScrollView
                style={[styles.sidebarSectionScroll, isCompactLayout && styles.sidebarSectionScrollCompact]}
                contentContainerStyle={[styles.sidebarSectionContent, isCompactLayout && styles.sidebarSectionContentCompact]}
              >
                {settingsTab()}
              </ScrollView>
            ) : null}
          </View>
        )}

        {!isCompactLayout || mobileThreadOpen ? (
          <View style={[styles.conversationPanel, isCompactLayout && styles.conversationPanelCompact]}>
            {tab === 'Chats' && activeFriend && activeThread ? (
              <>
                <View style={[styles.conversationHeader, isCompactLayout && styles.conversationHeaderCompact]}>
                  {isCompactLayout ? (
                    <AnimatedPressable onPress={() => setChatOpen(false)} style={styles.sidebarIconBtn}>
                      {renderIcon('back', '#51606f', 18)}
                    </AnimatedPressable>
                  ) : null}
                  <LinearGradient colors={activeFriend.accent} style={styles.conversationAvatar}>
                    <Text style={styles.conversationAvatarText}>{activeFriend.name.charAt(0).toUpperCase()}</Text>
                  </LinearGradient>
                  <View style={styles.flex1}>
                    <Text style={styles.conversationTitle}>{activeFriend.name}</Text>
                    <Text numberOfLines={1} style={styles.conversationMeta}>
                      {activeFriend.email}
                    </Text>
                  </View>
                    <View style={styles.sidebarTopbarActions}>
                      <AnimatedPressable style={styles.sidebarIconBtn}>{renderIcon('info', '#61738a', 18)}</AnimatedPressable>
                    </View>
                </View>
                <ScrollView style={styles.chatCanvas} contentContainerStyle={[styles.chatCanvasContent, isCompactLayout && styles.chatCanvasContentCompact]}>
                  {activeThread.messages.map((msg) => {
                    const mine = msg.senderEmail === me.email;
                    const sender = store.profiles.find((p) => p.email === msg.senderEmail);
                    const readByFriend = mine && ((activeThread.unreadCounts?.[activeFriend.email] ?? 0) === 0);
                    return (
                      <View key={msg.id} style={[styles.msgWrap, mine ? styles.msgWrapMine : styles.msgWrapOther]}>
                        <View style={[styles.msgBubble, mine ? styles.msgMine : styles.msgOther]}>
                          {!mine ? <Text style={styles.msgSender}>{sender?.name ?? activeFriend.name}</Text> : null}
                          <Text style={styles.msgText}>{msg.text}</Text>
                          <View style={styles.msgMetaRow}>
                            <Text style={styles.msgTime}>{msg.time}</Text>
                            {mine ? (
                              <Text style={[styles.msgStatus, readByFriend ? styles.msgStatusRead : styles.msgStatusSent]}>
                                ✓✓
                              </Text>
                            ) : null}
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>
                {showEmojiTray ? (
                  <View style={styles.emojiTray}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.emojiTrayContent}>
                      {QUICK_EMOJIS.map((emoji) => (
                        <AnimatedPressable
                          key={emoji}
                          onPress={() => setDraft((current) => `${current}${emoji}`)}
                          style={styles.emojiChip}
                        >
                          <Text style={styles.emojiChipText}>{emoji}</Text>
                        </AnimatedPressable>
                      ))}
                    </ScrollView>
                  </View>
                ) : null}
                <View style={[styles.composerBar, isCompactLayout && styles.composerBarCompact]}>
                  <AnimatedPressable onPress={() => setShowEmojiTray((current) => !current)} style={styles.emojiToggleBtn}>
                    <Text style={styles.emojiToggleText}>☺</Text>
                  </AnimatedPressable>
                  <View style={styles.composer}>
                    <TextInput
                      value={draft}
                      onChangeText={setDraft}
                      placeholder="Type a message"
                      placeholderTextColor="#8c9aa5"
                      style={styles.composerInput}
                      onSubmitEditing={sendMessage}
                      blurOnSubmit={false}
                      returnKeyType="send"
                    />
                  </View>
                  <AnimatedPressable onPress={sendMessage} style={styles.sendBtn}>
                    {renderIcon('send', '#fff', 18)}
                  </AnimatedPressable>
                </View>
              </>
            ) : (
                <View style={styles.emptyConversation}>
                  {renderBrandArtwork(true)}
                  <Text style={styles.emptyConversationTitle}>{tab === 'Chats' ? `Welcome back, ${me.name}` : tab}</Text>
                  <Text style={styles.emptyConversationCopy}>
                    {tab === 'Chats'
                      ? 'Your inbox is on the left. Click any chat to open the conversation.'
                      : `Manage your ${tab.toLowerCase()} from the left sidebar without leaving the main app view.`}
                  </Text>
                </View>
            )}
          </View>
        ) : null}
      </View>
    );
  }

  function chatsTab() {
    return null;
  }

  function friendsTab() {
    return (
      <>
        <Text style={styles.blockTitle}>Find by Email</Text>
        <View style={styles.card}>
          <TextInput value={searchEmail} onChangeText={setSearchEmail} autoCapitalize="none" keyboardType="email-address" placeholder="Search exact email" placeholderTextColor="#8c9aa5" style={styles.input} />
          {searchEmail.trim().length === 0 ? <Text style={styles.helper}>Search another account by email.</Text> : null}
          {searchEmail.trim().length > 0 && found ? (
            <View style={styles.accountRow}>
              <LinearGradient colors={found.accent} style={styles.avatar}>
                <Text style={styles.avatarText}>{found.name.charAt(0).toUpperCase()}</Text>
              </LinearGradient>
              <View style={styles.flex1}>
                <Text style={styles.rowTitle}>{found.name}</Text>
                <Text style={styles.rowSub}>{found.email}</Text>
              </View>
              <AnimatedPressable onPress={sendRequest} style={styles.addBtn}>
                <Text style={styles.addBtnText}>{friendsEmails.includes(found.email) ? 'Chat' : 'Add'}</Text>
              </AnimatedPressable>
            </View>
          ) : null}
          {searchEmail.trim().length > 0 && !found ? <Text style={styles.helper}>No user found with that email.</Text> : null}
        </View>
        <Text style={styles.blockTitle}>Incoming Requests</Text>
        <View style={styles.card}>
          {incoming.length === 0 ? <Text style={styles.helper}>No incoming requests.</Text> : incoming.map((req) => {
            const sender = store.profiles.find((p) => p.email === req.fromEmail);
            if (!sender) return null;
            return (
              <View key={req.id} style={styles.requestRow}>
                <View style={styles.flex1}>
                  <Text style={styles.rowTitle}>{sender.name}</Text>
                  <Text style={styles.rowSub}>{sender.email}</Text>
                </View>
                <AnimatedPressable onPress={() => acceptRequest(req.id)} style={styles.acceptBtn}>
                  <Text style={styles.acceptBtnText}>Accept</Text>
                </AnimatedPressable>
              </View>
            );
          })}
        </View>
        <Text style={styles.blockTitle}>Outgoing Requests</Text>
        <View style={styles.card}>
          {outgoing.length === 0 ? <Text style={styles.helper}>No outgoing requests.</Text> : outgoing.map((req) => (
            <View key={req.id} style={styles.requestRow}>
              <View style={styles.flex1}>
                <Text style={styles.rowTitle}>{req.toEmail}</Text>
                <Text style={styles.rowSub}>Pending</Text>
              </View>
            </View>
          ))}
        </View>
      </>
    );
  }

  function settingsTab() {
    if (!me) {
      return null;
    }

    return (
      <>
        <Text style={styles.blockTitle}>Profile Settings</Text>
        <View style={styles.card}>
          <TextInput value={editName} onChangeText={setEditName} placeholder="Name" placeholderTextColor="#8c9aa5" style={styles.input} />
          <TextInput value={editAbout} onChangeText={setEditAbout} placeholder="About" placeholderTextColor="#8c9aa5" style={styles.input} />
          <TextInput value={editPassword} onChangeText={setEditPassword} placeholder="Password" placeholderTextColor="#8c9aa5" secureTextEntry style={styles.input} />
          <AnimatedPressable onPress={saveProfile} style={styles.greenBtnWrap}>
            <LinearGradient colors={PRIMARY_GRADIENT_STRONG} style={styles.greenBtn}>
              <Text style={styles.greenBtnText}>Save Profile</Text>
            </LinearGradient>
          </AnimatedPressable>
        </View>
        <Text style={styles.blockTitle}>Session</Text>
        <View style={styles.card}>
          <AnimatedPressable onPress={logout} style={styles.grayBtn}>
            <Text style={styles.grayBtnText}>Logout</Text>
          </AnimatedPressable>
        </View>
      </>
    );
  }
}

function clock() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  appShell: {
    flex: 1,
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    backgroundColor: '#e9ded6',
    borderRadius: Platform.OS === 'web' ? 0 : 20,
    overflow: 'hidden',
    borderWidth: Platform.OS === 'web' ? 0 : 1,
    borderColor: 'rgba(125,125,125,0.08)',
  },
  appShellCompact: {
    flexDirection: 'column',
    borderRadius: 0,
    borderWidth: 0,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f6f8ff' },
  loading: { fontSize: 18, fontWeight: '700', color: '#21466f' },
  pageScroll: { padding: 18, paddingBottom: 32 },
  pageShell: { width: '100%', maxWidth: 1120, alignSelf: 'center' },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(78,104,153,0.14)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingCard: { backgroundColor: '#ffffff', borderRadius: 24, paddingHorizontal: 28, paddingVertical: 24, alignItems: 'center', minWidth: 180, borderWidth: 1, borderColor: 'rgba(120,138,255,0.18)' },
  loadingCardText: { marginTop: 14, color: '#21466f', fontWeight: '700', fontSize: 15 },
  content: { paddingBottom: 32 },
  webIconGlyph: { fontWeight: '800', lineHeight: 20, textAlign: 'center', minWidth: 18 },
  authPage: { flex: 1, justifyContent: 'center', paddingHorizontal: Platform.OS === 'web' ? 24 : 16, paddingVertical: Platform.OS === 'web' ? 24 : 16 },
  authLayout: { flexDirection: Platform.OS === 'web' ? 'row' : 'column', alignItems: 'stretch', minHeight: Platform.OS === 'web' ? 700 : undefined },
  authBrandPanel: { flex: Platform.OS === 'web' ? 1 : undefined, minHeight: Platform.OS === 'web' ? 700 : 250, justifyContent: 'center', paddingRight: Platform.OS === 'web' ? 52 : 0, paddingLeft: Platform.OS === 'web' ? 0 : 8, paddingTop: Platform.OS === 'web' ? 0 : 22, paddingBottom: Platform.OS === 'web' ? 0 : 22, overflow: 'hidden', position: 'relative', backgroundColor: Platform.OS === 'web' ? 'transparent' : '#0f1d34' },
  authDivider: { alignSelf: 'stretch', width: Platform.OS === 'web' ? 1 : '100%', height: Platform.OS === 'web' ? '100%' : 1, backgroundColor: Platform.OS === 'web' ? 'rgba(113,129,187,0.26)' : 'rgba(113,129,187,0.18)', marginVertical: Platform.OS === 'web' ? 0 : 10 },
  authPanel: { flex: Platform.OS === 'web' ? 0.92 : undefined, justifyContent: 'center', paddingLeft: Platform.OS === 'web' ? 52 : 0, paddingTop: Platform.OS === 'web' ? 0 : 16 },
  authPanelInner: { width: '100%', maxWidth: 520, alignSelf: Platform.OS === 'web' ? 'flex-start' : 'stretch' },
  authShapePrimary: { position: 'absolute', right: Platform.OS === 'web' ? -185 : -140, top: Platform.OS === 'web' ? -100 : -80, width: Platform.OS === 'web' ? 760 : 500, height: Platform.OS === 'web' ? 620 : 360, opacity: 0.98 },
  authShapeFill: { flex: 1 },
  authShapeSecondary: { position: 'absolute', left: Platform.OS === 'web' ? -220 : -120, bottom: Platform.OS === 'web' ? -280 : -170, width: Platform.OS === 'web' ? 760 : 430, height: Platform.OS === 'web' ? 580 : 320, backgroundColor: '#0c2039', borderTopWidth: 2, borderTopColor: '#59dae1', opacity: Platform.OS === 'web' ? 1 : 0.92 },
  brandWrap: { position: 'absolute', width: '100%', maxWidth: Platform.OS === 'web' ? 420 : 320, paddingVertical: 10 },
  brandWrapSignin: { right: 0, alignItems: 'flex-end' },
  brandWrapSignup: { left: 0, alignItems: 'flex-start' },
  brandInline: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: Platform.OS === 'web' ? 26 : 18 },
  brandInlineText: { justifyContent: 'center' },
  brandLogoShell: { width: Platform.OS === 'web' ? 164 : 86, height: Platform.OS === 'web' ? 132 : 72, alignItems: 'center', justifyContent: 'center', marginBottom: Platform.OS === 'web' ? 20 : 0 },
  brandLogoShellCompact: { width: 42, height: 42, marginBottom: 0 },
  brandMark: { width: Platform.OS === 'web' ? 132 : 68, height: Platform.OS === 'web' ? 104 : 54, borderRadius: Platform.OS === 'web' ? 32 : 18, alignItems: 'center', justifyContent: 'center', position: 'relative', shadowColor: '#7b45ff', shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 4 },
  brandMarkCompact: { width: 42, height: 34, borderRadius: 12, shadowOpacity: 0, shadowRadius: 0, shadowOffset: { width: 0, height: 0 }, elevation: 0 },
  brandMarkLetter: { color: '#ffffff', fontSize: Platform.OS === 'web' ? 50 : 28, fontWeight: '900', letterSpacing: 1, transform: [{ translateY: Platform.OS === 'web' ? -3 : -1 }] },
  brandMarkLetterCompact: { fontSize: 18, transform: [{ translateY: -1 }] },
  brandMarkTail: { position: 'absolute', left: Platform.OS === 'web' ? 18 : 10, bottom: Platform.OS === 'web' ? -13 : -7, width: Platform.OS === 'web' ? 28 : 14, height: Platform.OS === 'web' ? 28 : 14, backgroundColor: '#45c6eb', transform: [{ rotate: '45deg' }], borderBottomLeftRadius: Platform.OS === 'web' ? 8 : 4 },
  brandMarkTailCompact: { left: 6, bottom: -5, width: 10, height: 10, borderBottomLeftRadius: 3 },
  brandTitle: { color: '#255d9f', fontSize: Platform.OS === 'web' ? 34 : 28, fontWeight: '800' },
  brandSubtitle: { color: '#6f63b0', fontSize: Platform.OS === 'web' ? 15 : 12, letterSpacing: 1.2, marginTop: 4, textTransform: 'uppercase' },
  brandCopy: { color: '#4f6786', fontSize: 15, lineHeight: 24, textAlign: 'left', maxWidth: 430, marginTop: 18 },
  brandFeatureList: { marginTop: 28, width: '100%', maxWidth: 420, gap: 14 },
  brandFeatureItem: { color: '#29456c', fontSize: 16, fontWeight: '600', paddingLeft: 18, borderLeftWidth: 3, borderLeftColor: '#7b45ff' },
  welcomeEyebrow: { color: '#98f4f0', fontSize: Platform.OS === 'web' ? 14 : 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 2.3, marginBottom: 14, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 },
  welcomeHeadline: { color: '#ffffff', fontSize: Platform.OS === 'web' ? 38 : 26, fontWeight: '900', lineHeight: Platform.OS === 'web' ? 48 : 34, maxWidth: Platform.OS === 'web' ? 380 : 280, textAlign: 'right', textShadowColor: 'rgba(0,0,0,0.34)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 10 },
  welcomeText: { color: 'rgba(246,251,255,0.96)', fontSize: Platform.OS === 'web' ? 16 : 14, lineHeight: Platform.OS === 'web' ? 28 : 22, marginTop: 18, maxWidth: Platform.OS === 'web' ? 360 : 270, textAlign: 'right', textShadowColor: 'rgba(0,0,0,0.24)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 },
  noticeBox: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18, backgroundColor: 'transparent', borderRadius: 0, paddingHorizontal: 0, paddingVertical: 0, borderWidth: 0 },
  notice: { flex: 1, color: '#465a77', fontSize: 13, lineHeight: 19 },
  popupCard: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-end', marginBottom: 14, backgroundColor: '#24436c', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12 },
  popupText: { color: '#fff', fontWeight: '700' },
  card: { backgroundColor: 'rgba(255,255,255,0.94)', borderRadius: 24, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(120,138,255,0.12)' },
  sidebarPanel: {
    width: Platform.OS === 'web' ? 360 : '100%',
    backgroundColor: '#f7f5f3',
    borderRightWidth: Platform.OS === 'web' ? 1 : 0,
    borderRightColor: '#d8d5d1',
  },
  sidebarPanelCompact: {
    width: '100%',
    flex: 1,
    borderRightWidth: 0,
  },
  sidebarTopbar: {
    height: 64,
    backgroundColor: '#f0f2f5',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#d8d5d1',
  },
  sidebarTopbarCompact: {
    height: 64 + (Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0) + 6,
    paddingHorizontal: 12,
    paddingTop: (Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0) + 6,
    alignItems: 'flex-start',
  },
  sidebarAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  sidebarAvatarText: { color: '#fff', fontWeight: '800' },
  sidebarTopbarActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sidebarIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sidebarLogoutBtn: {
    minWidth: 74,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
  },
  sidebarLogoutText: {
    color: '#61738a',
    fontSize: 13,
    fontWeight: '700',
  },
  sidebarNav: {
    flexDirection: 'row',
    backgroundColor: '#f7f5f3',
    borderBottomWidth: 1,
    borderBottomColor: '#ece7e2',
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 6,
    gap: 6,
  },
  sidebarNavCompact: {
    paddingHorizontal: 10,
    gap: 8,
  },
  sidebarNavItem: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sidebarNavItemCompact: {
    minHeight: 42,
  },
  sidebarNavItemActive: {
    backgroundColor: '#e9edef',
  },
  sidebarNavLabel: {
    color: '#667781',
    fontSize: 13,
    fontWeight: '700',
  },
  sidebarNavLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sidebarNavLabelActive: {
    color: '#111b21',
  },
  sidebarNavDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#53bdeb',
  },
  sidebarSearchWrap: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f7f5f3',
    borderBottomWidth: 1,
    borderBottomColor: '#ece7e2',
  },
  sidebarSearchWrapCompact: {
    paddingHorizontal: 10,
  },
  sidebarSectionHeader: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#f7f5f3',
  },
  sidebarSectionHeaderCompact: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
  },
  sidebarSectionTitle: {
    color: '#111b21',
    fontSize: 15,
    fontWeight: '700',
  },
  sidebarSectionMeta: {
    color: '#667781',
    fontSize: 12,
    marginTop: 2,
  },
  sidebarSearchInput: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#26333a',
    fontSize: 14,
  },
  chatListScroll: { flex: 1 },
  chatListContent: { paddingBottom: 12 },
  sidebarSectionScroll: { flex: 1, backgroundColor: '#f7f5f3' },
  sidebarSectionContent: { padding: 12, paddingBottom: 18 },
  sidebarSectionScrollCompact: { flex: 1 },
  sidebarSectionContentCompact: { padding: 10, paddingBottom: 16 },
  sidebarHelper: { color: '#6d7b83', paddingHorizontal: 16, paddingVertical: 20, lineHeight: 20 },
  sidebarChatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0ece8',
  },
  sidebarChatRowCompact: {
    paddingHorizontal: 10,
    paddingVertical: 11,
  },
  sidebarChatRowActive: { backgroundColor: '#f0f2f5' },
  sidebarChatAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  sidebarChatAvatarText: { color: '#fff', fontWeight: '800', fontSize: 18 },
  sidebarChatHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sidebarChatFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  sidebarChatName: { color: '#111b21', fontSize: 16, fontWeight: '500' },
  sidebarChatTime: { color: '#8696a0', fontSize: 11 },
  sidebarChatPreview: { flex: 1, color: '#667781', fontSize: 13 },
  sidebarUnreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#53bdeb',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  sidebarUnreadText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  conversationPanel: {
    flex: 1,
    backgroundColor: '#efeae2',
  },
  conversationPanelCompact: {
    width: '100%',
  },
  conversationHeader: {
    height: 64,
    backgroundColor: '#f0f2f5',
    borderBottomWidth: 1,
    borderBottomColor: '#d8d5d1',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  conversationHeaderCompact: {
    height: 64 + (Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0) + 6,
    paddingHorizontal: 10,
    paddingTop: (Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0) + 6,
    alignItems: 'flex-start',
  },
  conversationAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  conversationAvatarText: { color: '#fff', fontWeight: '800' },
  conversationTitle: { color: '#111b21', fontSize: 16, fontWeight: '600' },
  conversationMeta: { color: '#667781', fontSize: 12, marginTop: 2 },
  chatCanvas: { flex: 1, backgroundColor: '#e5ddd5' },
  chatCanvasContent: {
    paddingHorizontal: Platform.OS === 'web' ? 22 : 12,
    paddingVertical: Platform.OS === 'web' ? 18 : 12,
    gap: 10,
  },
  chatCanvasContentCompact: {
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  emojiTray: {
    backgroundColor: '#f0f2f5',
    borderTopWidth: 1,
    borderTopColor: '#d8d5d1',
    paddingTop: 8,
    paddingBottom: 6,
    paddingHorizontal: 8,
  },
  emojiTrayContent: {
    paddingRight: 8,
    gap: 8,
  },
  emojiChip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiChipText: {
    fontSize: 20,
  },
  composerBar: {
    backgroundColor: '#f0f2f5',
    borderTopWidth: 1,
    borderTopColor: '#d8d5d1',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  composerBarCompact: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  emojiToggleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  emojiToggleText: {
    fontSize: 20,
    color: '#667781',
  },
  emptyConversation: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#f8f9fa',
  },
  emptyConversationTitle: { color: '#41525d', fontSize: 30, fontWeight: '300', marginTop: 12 },
  emptyConversationCopy: { color: '#667781', fontSize: 14, textAlign: 'center', marginTop: 8, maxWidth: 300, lineHeight: 20 },
  authCard: { backgroundColor: 'transparent', borderRadius: 0, padding: 0, marginBottom: 20, shadowColor: 'transparent', shadowOpacity: 0, shadowRadius: 0, shadowOffset: { width: 0, height: 0 }, elevation: 0, borderWidth: 0 },
  authFormsFrame: { minHeight: Platform.OS === 'web' ? 360 : 332, position: 'relative' },
  authFormPanel: { width: '100%' },
  authFormPanelOverlay: { position: 'absolute', top: 0, left: 0, right: 0 },
  cardTitle: { color: '#142b47', fontSize: 20, fontWeight: '800', marginBottom: 12 },
  input: { backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 0, paddingHorizontal: 0, paddingVertical: 14, color: '#10243b', fontSize: 15, marginBottom: 18, borderWidth: 0, borderBottomWidth: 1, borderColor: 'rgba(72,103,168,0.38)' },
  greenBtnWrap: { borderRadius: 18, overflow: 'hidden', marginTop: 4 },
  greenBtn: { paddingVertical: 15, alignItems: 'center', justifyContent: 'center', borderRadius: 0 },
  greenBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  outlineBtn: { borderWidth: 1, borderColor: '#d5daf5', borderRadius: 0, paddingVertical: 15, alignItems: 'center', marginTop: 12, backgroundColor: 'transparent' },
  outlineBtnText: { color: '#24436c', fontWeight: '700', fontSize: 15 },
  linkBtn: { marginTop: 12, alignItems: 'center' },
  switchLink: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 22, flexWrap: 'wrap' },
  switchText: { color: '#4c607f', fontSize: 14 },
  switchAction: { color: '#5146e5', fontWeight: '800', fontSize: 14 },
  darkLinkText: { color: '#5d6f8e', fontWeight: '700' },
  accountRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  avatar: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: '800' },
  flex1: { flex: 1 },
  rowTitle: { color: '#20385d', fontSize: 15, fontWeight: '700' },
  rowSub: { color: '#6f7f99', marginTop: 2 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, paddingBottom: 10 },
  headerBrandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { color: '#21466f', fontSize: 26, fontWeight: '800' },
  headerSub: { color: '#6f7f99', marginTop: 2 },
  iconBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(120,138,255,0.12)' },
  tabs: { flexDirection: 'row', gap: 10, paddingBottom: 12 },
  tab: { flex: 1, backgroundColor: '#e8edfb', borderRadius: 16, paddingVertical: 12, alignItems: 'center' },
  tabActive: { backgroundColor: '#5a61ff' },
  tabLabel: { color: '#5f6e86', fontWeight: '700' },
  tabLabelActive: { color: '#fff' },
  profileHero: { borderRadius: 24, padding: 20, marginBottom: 16 },
  profileHeroName: { color: '#fff', fontSize: 24, fontWeight: '800', marginBottom: 4 },
  profileHeroAbout: { color: '#eef7ff', fontSize: 14 },
  blockTitle: { color: '#20385d', fontSize: 22, fontWeight: '800', marginBottom: 10 },
  helper: { color: '#6f7f99', fontSize: 14, lineHeight: 20 },
  chatRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  chatRowActive: { backgroundColor: '#eff2ff', borderRadius: 18, paddingHorizontal: 10 },
  chatMeta: { alignItems: 'flex-end', gap: 6 },
  time: { color: '#7a88a4', fontSize: 12, fontWeight: '700' },
  unreadBadge: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: '#5a61ff', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  unreadBadgeText: { color: '#fff', fontWeight: '800', fontSize: 11 },
  chatTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  chatScreenHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  backBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginRight: 10, borderWidth: 1, borderColor: 'rgba(120,138,255,0.12)' },
  smallAvatar: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 10, backgroundColor: '#5a61ff' },
  smallAvatarText: { color: '#fff', fontWeight: '800' },
  messages: { gap: 10, marginBottom: 16 },
  msgWrap: { maxWidth: '82%' },
  msgWrapMine: { alignSelf: 'flex-end' },
  msgWrapOther: { alignSelf: 'flex-start' },
  msgBubble: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, minWidth: 96, maxWidth: Platform.OS === 'web' ? 420 : 280, shadowColor: 'rgba(0,0,0,0.08)', shadowOpacity: 0.08, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  msgMine: { backgroundColor: '#d9fdd3', borderTopRightRadius: 2 },
  msgOther: { backgroundColor: '#ffffff', borderTopLeftRadius: 2 },
  msgSender: { color: '#53bdeb', fontSize: 12, fontWeight: '700', marginBottom: 4 },
  msgText: { color: '#111b21', fontSize: 14, lineHeight: 20 },
  msgMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 6 },
  msgTime: { color: '#667781', fontSize: 11, textAlign: 'right' },
  msgStatus: { fontSize: 11, fontWeight: '700' },
  msgStatusSent: { color: '#8696a0' },
  msgStatusRead: { color: '#53bdeb' },
  composer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 8, paddingLeft: 14, paddingRight: 10, minHeight: 44 },
  composerInput: { flex: 1, color: '#111b21', fontSize: 15, paddingVertical: 10 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#00a884', alignItems: 'center', justifyContent: 'center' },
  addBtn: { backgroundColor: '#5a61ff', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  addBtnText: { color: '#fff', fontWeight: '800' },
  requestRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  acceptBtn: { backgroundColor: '#5a61ff', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 },
  acceptBtnText: { color: '#fff', fontWeight: '800' },
  grayBtn: { backgroundColor: '#eef2fb', borderRadius: 18, paddingVertical: 14, alignItems: 'center', marginBottom: 12 },
  grayBtnText: { color: '#21466f', fontWeight: '800' },
});
