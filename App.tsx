import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from 'react-native';

type Profile = { id: string; name: string; email: string; about: string; accent: [string, string] };
type FriendRequest = { id: string; fromEmail: string; toEmail: string; status: 'pending' | 'accepted' };
type Message = { id: string; senderEmail: string; text: string; time: string };
type Thread = { id: string; participants: [string, string]; messages: Message[]; unreadCounts?: Record<string, number> };
type Store = { profiles: Profile[]; requests: FriendRequest[]; threads: Thread[]; currentUserEmail: string | null };
type Screen = 'welcome' | 'login' | 'create';
type Tab = 'Chats' | 'Friends' | 'Settings';

const STORAGE_KEY = 'pulse-chat-storage-v3';
const INITIAL: Store = { profiles: [], requests: [], threads: [], currentUserEmail: null };
const ACCENTS: [string, string][] = [
  ['#25D366', '#129c4b'],
  ['#7bc8ff', '#528cff'],
  ['#ffc88f', '#ff9d6f'],
  ['#dbc8ff', '#a68cff'],
];

export default function App() {
  const [store, setStore] = useState<Store>(INITIAL);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<Screen>('welcome');
  const [tab, setTab] = useState<Tab>('Chats');
  const [notice, setNotice] = useState('Login or create an account, then add a friend by email and chat.');
  const [loginEmail, setLoginEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newAbout, setNewAbout] = useState('');
  const [searchEmail, setSearchEmail] = useState('');
  const [draft, setDraft] = useState('');
  const [selectedFriendEmail, setSelectedFriendEmail] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editAbout, setEditAbout] = useState('');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyText, setBusyText] = useState('Loading...');
  const [chatOpen, setChatOpen] = useState(false);

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
  const activeFriend = friends.find((p) => p.email === selectedFriendEmail) ?? friends[0] ?? null;
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
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved) {
          const parsed = JSON.parse(saved) as Store;
          setStore({
            ...parsed,
            threads: parsed.threads.map((thread) => ({
              ...thread,
              unreadCounts: thread.unreadCounts ?? {},
            })),
          });
        }
      })
      .finally(() => {
        setReady(true);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(store)).catch(() => undefined);
  }, [ready, store]);

  useEffect(() => {
    if (me) {
      setEditName(me.name);
      setEditAbout(me.about);
      if (!selectedFriendEmail && friends[0]) setSelectedFriendEmail(friends[0].email);
    }
  }, [friends, me, selectedFriendEmail]);

  const patchStore = (updater: (current: Store) => Store) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setStore((current) => updater(current));
  };

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
    if (!name || !email) return setNotice('Name and email are required.');
    if (!email.includes('@')) return setNotice('Enter a valid email.');
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
          about: newAbout.trim() || 'Hey there! I am using Zorachat.',
            accent: ACCENTS[current.profiles.length % ACCENTS.length],
          },
        ],
        currentUserEmail: email,
      }));
      setNewName('');
      setNewEmail('');
      setNewAbout('');
      setScreen('welcome');
      setTab('Chats');
      setNotice(`${name} created and logged in.`);
    });
  };

  const login = () => {
    const email = loginEmail.trim().toLowerCase();
    const user = store.profiles.find((p) => p.email === email);
    if (!user) return setNotice('No user found with that email.');
    smoothAction('Logging in...', () => {
      patchStore((current) => ({ ...current, currentUserEmail: email }));
      setLoginEmail('');
      setScreen('welcome');
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
  };

  const saveProfile = () => {
    if (!me || !editName.trim()) return setNotice('Profile name cannot be empty.');
    smoothAction('Saving profile...', () => {
      patchStore((current) => ({
        ...current,
        profiles: current.profiles.map((p) =>
        p.email === me.email ? { ...p, name: editName.trim(), about: editAbout.trim() || 'Hey there! I am using Zorachat.' } : p
        ),
      }));
      setNotice('Profile updated.');
    });
  };

  const resetAll = () => {
    Alert.alert('Reset app', 'Delete all local accounts, requests, and chats?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: () => {
          patchStore(() => INITIAL);
          setScreen('welcome');
          setSelectedFriendEmail(null);
          setChatOpen(false);
          setSearchEmail('');
          setDraft('');
          setNotice('Everything was cleared. Start fresh.');
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.loading}>Loading Pulse Chat...</Text>
      </View>
    );
  }

  return (
    <LinearGradient colors={['#efeae2', '#f6f7f8']} style={styles.screen}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.screen}>
        <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {me ? appView() : authView()}
          {busy ? (
            <View style={styles.loadingOverlay}>
              <View style={styles.loadingCard}>
                <ActivityIndicator size="large" color="#25D366" />
                <Text style={styles.loadingCardText}>{busyText}</Text>
              </View>
            </View>
          ) : null}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );

  function authView() {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.brandWrap}>
          <LinearGradient colors={['#1574FF', '#2AEF74']} style={styles.brandMark}>
            <Text style={styles.brandMarkText}>ZO</Text>
          </LinearGradient>
          <Text style={styles.brandTitle}>Zorachat</Text>
          <Text style={styles.brandSubtitle}>Dynamic Messaging</Text>
        </View>
        <View style={styles.noticeBox}>
          <Ionicons name="information-circle-outline" size={18} color="#54656f" />
          <Text style={styles.notice}>{notice}</Text>
        </View>

        {screen === 'welcome' ? (
          <View style={styles.card}>
            <Pressable onPress={() => setScreen('login')} style={styles.greenBtnWrap}>
              <LinearGradient colors={['#25D366', '#1aaa52']} style={styles.greenBtn}>
                <Text style={styles.greenBtnText}>Login</Text>
              </LinearGradient>
            </Pressable>
            <Pressable onPress={() => setScreen('create')} style={styles.outlineBtn}>
              <Text style={styles.outlineBtnText}>Create New Account</Text>
            </Pressable>
            <Pressable onPress={resetAll} style={styles.linkBtn}>
              <Text style={styles.linkBtnText}>Reset local app data</Text>
            </Pressable>
          </View>
        ) : null}

        {screen === 'login' ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Login</Text>
            <TextInput value={loginEmail} onChangeText={setLoginEmail} autoCapitalize="none" keyboardType="email-address" placeholder="Email address" placeholderTextColor="#8c9aa5" style={styles.input} />
            <Pressable onPress={login} style={styles.greenBtnWrap}>
              <LinearGradient colors={['#25D366', '#1aaa52']} style={styles.greenBtn}>
                <Text style={styles.greenBtnText}>Continue</Text>
              </LinearGradient>
            </Pressable>
            <Pressable onPress={() => setScreen('welcome')} style={styles.linkBtn}>
              <Text style={styles.darkLinkText}>Back</Text>
            </Pressable>
          </View>
        ) : null}

        {screen === 'create' ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Create Account</Text>
            <TextInput value={newName} onChangeText={setNewName} placeholder="Name" placeholderTextColor="#8c9aa5" style={styles.input} />
            <TextInput value={newEmail} onChangeText={setNewEmail} autoCapitalize="none" keyboardType="email-address" placeholder="Email address" placeholderTextColor="#8c9aa5" style={styles.input} />
            <TextInput value={newAbout} onChangeText={setNewAbout} placeholder="About" placeholderTextColor="#8c9aa5" style={styles.input} />
            <Pressable onPress={createAccount} style={styles.greenBtnWrap}>
              <LinearGradient colors={['#25D366', '#1aaa52']} style={styles.greenBtn}>
                <Text style={styles.greenBtnText}>Create and Login</Text>
              </LinearGradient>
            </Pressable>
            <Pressable onPress={() => setScreen('welcome')} style={styles.linkBtn}>
              <Text style={styles.darkLinkText}>Back</Text>
            </Pressable>
          </View>
        ) : null}

        {store.profiles.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Existing Accounts</Text>
            {store.profiles.map((p) => (
              <View key={p.id} style={styles.accountRow}>
                <LinearGradient colors={p.accent} style={styles.avatar}>
                  <Text style={styles.avatarText}>{p.name.charAt(0).toUpperCase()}</Text>
                </LinearGradient>
                <View style={styles.flex1}>
                  <Text style={styles.rowTitle}>{p.name}</Text>
                  <Text style={styles.rowSub}>{p.email}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    );
  }

  function appView() {
    if (!me) {
      return null;
    }

    return (
      <View style={styles.screen}>
        <View style={styles.header}>
          <View>
            <View style={styles.headerBrandRow}>
              <LinearGradient colors={['#1574FF', '#2AEF74']} style={styles.headerLogo}>
                <Text style={styles.headerLogoText}>ZO</Text>
              </LinearGradient>
              <Text style={styles.headerTitle}>Zorachat</Text>
            </View>
            <Text style={styles.headerSub}>{me.name}</Text>
          </View>
          <Pressable onPress={logout} style={styles.iconBtn}>
            <Ionicons name="log-out-outline" size={18} color="#54656f" />
          </Pressable>
        </View>
        <View style={styles.noticeBox}>
          <Ionicons name="chatbubble-ellipses-outline" size={18} color="#54656f" />
          <Text style={styles.notice}>{notice}</Text>
        </View>
        {totalUnread > 0 ? (
          <View style={styles.popupCard}>
            <Ionicons name="notifications" size={18} color="#fff" />
            <Text style={styles.popupText}>
              {totalUnread} unread {totalUnread === 1 ? 'message' : 'messages'}
            </Text>
          </View>
        ) : null}
        <View style={styles.tabs}>
          {(['Chats', 'Friends', 'Settings'] as Tab[]).map((item) => (
            <Pressable key={item} onPress={() => setTab(item)} style={[styles.tab, tab === item && styles.tabActive]}>
              <Text style={[styles.tabLabel, tab === item && styles.tabLabelActive]}>{item}</Text>
            </Pressable>
          ))}
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          {tab === 'Chats' ? chatsTab() : null}
          {tab === 'Friends' ? friendsTab() : null}
          {tab === 'Settings' ? settingsTab() : null}
        </ScrollView>
      </View>
    );
  }

  function chatsTab() {
    if (!me) {
      return null;
    }

    if (chatOpen && activeFriend && activeThread) {
      return (
        <>
          <View style={styles.chatScreenHeader}>
            <Pressable onPress={() => setChatOpen(false)} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={20} color="#111b21" />
            </Pressable>
            <LinearGradient colors={activeFriend.accent} style={styles.smallAvatar}>
              <Text style={styles.smallAvatarText}>{activeFriend.name.charAt(0).toUpperCase()}</Text>
            </LinearGradient>
            <View style={styles.flex1}>
              <Text style={styles.rowTitle}>{activeFriend.name}</Text>
              <Text style={styles.rowSub}>{activeFriend.email}</Text>
            </View>
          </View>
          <View style={styles.card}>
            <View style={styles.messages}>
              {activeThread.messages.map((msg) => {
                const mine = msg.senderEmail === me.email;
                return (
                  <View key={msg.id} style={[styles.msgWrap, mine ? styles.msgWrapMine : styles.msgWrapOther]}>
                    <View style={[styles.msgBubble, mine ? styles.msgMine : styles.msgOther]}>
                      <Text style={styles.msgText}>{msg.text}</Text>
                      <Text style={styles.msgTime}>{msg.time}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
            <View style={styles.composer}>
              <TextInput value={draft} onChangeText={setDraft} placeholder={`Message ${activeFriend.name}`} placeholderTextColor="#8c9aa5" style={styles.composerInput} />
              <Pressable onPress={sendMessage} style={styles.sendBtn}>
                <Ionicons name="send" size={18} color="#fff" />
              </Pressable>
            </View>
          </View>
        </>
      );
    }

    return (
      <>
        <LinearGradient colors={me.accent} style={styles.profileHero}>
          <Text style={styles.profileHeroName}>{me.name}</Text>
          <Text style={styles.profileHeroAbout}>{me.about}</Text>
        </LinearGradient>
        <Text style={styles.blockTitle}>Chats</Text>
        <View style={styles.card}>
          {friends.length === 0 ? (
            <Text style={styles.helper}>No chats yet. Add a friend from the Friends tab.</Text>
          ) : (
            friends.map((friend) => {
              const thread = store.threads.find((t) => t.participants.includes(me.email) && t.participants.includes(friend.email));
              const last = thread?.messages[thread.messages.length - 1];
              const unread = thread?.unreadCounts?.[me.email] ?? 0;
              return (
                <Pressable key={friend.id} onPress={() => openChat(friend.email)} style={[styles.chatRow, activeFriend?.email === friend.email && styles.chatRowActive]}>
                  <LinearGradient colors={friend.accent} style={styles.avatar}>
                    <Text style={styles.avatarText}>{friend.name.charAt(0).toUpperCase()}</Text>
                  </LinearGradient>
                  <View style={styles.flex1}>
                    <Text style={styles.rowTitle}>{friend.name}</Text>
                    <Text style={styles.rowSub}>{last?.text ?? 'No messages yet'}</Text>
                  </View>
                  <View style={styles.chatMeta}>
                    <Text style={styles.time}>{last?.time ?? ''}</Text>
                    {unread > 0 ? (
                      <View style={styles.unreadBadge}>
                        <Text style={styles.unreadBadgeText}>{unread}</Text>
                      </View>
                    ) : null}
                  </View>
                </Pressable>
              );
            })
          )}
        </View>
      </>
    );
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
              <Pressable onPress={sendRequest} style={styles.addBtn}>
                <Text style={styles.addBtnText}>{friendsEmails.includes(found.email) ? 'Chat' : 'Add'}</Text>
              </Pressable>
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
                <Pressable onPress={() => acceptRequest(req.id)} style={styles.acceptBtn}>
                  <Text style={styles.acceptBtnText}>Accept</Text>
                </Pressable>
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
          <Pressable onPress={saveProfile} style={styles.greenBtnWrap}>
            <LinearGradient colors={['#25D366', '#1aaa52']} style={styles.greenBtn}>
              <Text style={styles.greenBtnText}>Save Profile</Text>
            </LinearGradient>
          </Pressable>
        </View>
        <Text style={styles.blockTitle}>Session</Text>
        <View style={styles.card}>
          <Pressable onPress={logout} style={styles.grayBtn}>
            <Text style={styles.grayBtnText}>Logout</Text>
          </Pressable>
          <Pressable onPress={resetAll} style={styles.redBtn}>
            <Text style={styles.redBtnText}>Reset All Local Data</Text>
          </Pressable>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f6f7f8' },
  loading: { fontSize: 18, fontWeight: '700', color: '#111b21' },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(17,27,33,0.18)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingCard: { backgroundColor: '#fff', borderRadius: 24, paddingHorizontal: 28, paddingVertical: 24, alignItems: 'center', minWidth: 180 },
  loadingCardText: { marginTop: 14, color: '#111b21', fontWeight: '700', fontSize: 15 },
  content: { padding: 18, paddingBottom: 32 },
  brandWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 10, marginBottom: 10 },
  brandMark: { width: 120, height: 120, borderRadius: 34, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  brandMarkText: { color: '#fff', fontSize: 42, fontWeight: '800', letterSpacing: 1 },
  brandTitle: { color: '#0d4aa5', fontSize: 34, fontWeight: '800' },
  brandSubtitle: { color: '#6f8798', fontSize: 16, letterSpacing: 1.4, marginTop: 4, textTransform: 'uppercase' },
  noticeBox: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 18, marginBottom: 14, backgroundColor: '#fff', borderRadius: 18, padding: 14 },
  notice: { flex: 1, color: '#54656f', fontSize: 13, lineHeight: 19 },
  popupCard: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-end', marginHorizontal: 18, marginBottom: 14, backgroundColor: '#111b21', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12 },
  popupText: { color: '#fff', fontWeight: '700' },
  card: { backgroundColor: '#fff', borderRadius: 24, padding: 16, marginBottom: 16 },
  cardTitle: { color: '#111b21', fontSize: 20, fontWeight: '800', marginBottom: 12 },
  input: { backgroundColor: '#f0f2f5', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, color: '#111b21', fontSize: 15, marginBottom: 12 },
  greenBtnWrap: { borderRadius: 18, overflow: 'hidden', marginTop: 4 },
  greenBtn: { paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
  greenBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  outlineBtn: { borderWidth: 1, borderColor: '#d8dee2', borderRadius: 18, paddingVertical: 15, alignItems: 'center', marginTop: 12 },
  outlineBtnText: { color: '#111b21', fontWeight: '700', fontSize: 15 },
  linkBtn: { marginTop: 12, alignItems: 'center' },
  linkBtnText: { color: '#d04c45', fontWeight: '700' },
  darkLinkText: { color: '#54656f', fontWeight: '700' },
  accountRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  avatar: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: '800' },
  flex1: { flex: 1 },
  rowTitle: { color: '#111b21', fontSize: 15, fontWeight: '700' },
  rowSub: { color: '#667781', marginTop: 2 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingTop: 8, paddingBottom: 10 },
  headerBrandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerLogo: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  headerLogoText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  headerTitle: { color: '#111b21', fontSize: 26, fontWeight: '800' },
  headerSub: { color: '#667781', marginTop: 2 },
  iconBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', gap: 10, paddingHorizontal: 18, paddingBottom: 12 },
  tab: { flex: 1, backgroundColor: '#dfe5e7', borderRadius: 16, paddingVertical: 12, alignItems: 'center' },
  tabActive: { backgroundColor: '#25D366' },
  tabLabel: { color: '#54656f', fontWeight: '700' },
  tabLabelActive: { color: '#fff' },
  profileHero: { borderRadius: 24, padding: 20, marginBottom: 16 },
  profileHeroName: { color: '#fff', fontSize: 24, fontWeight: '800', marginBottom: 4 },
  profileHeroAbout: { color: '#f0fff7', fontSize: 14 },
  blockTitle: { color: '#111b21', fontSize: 22, fontWeight: '800', marginBottom: 10 },
  helper: { color: '#667781', fontSize: 14, lineHeight: 20 },
  chatRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  chatRowActive: { backgroundColor: '#f1fff5', borderRadius: 18, paddingHorizontal: 10 },
  chatMeta: { alignItems: 'flex-end', gap: 6 },
  time: { color: '#7a8a92', fontSize: 12, fontWeight: '700' },
  unreadBadge: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: '#25D366', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  unreadBadgeText: { color: '#fff', fontWeight: '800', fontSize: 11 },
  chatTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  chatScreenHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  backBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  smallAvatar: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 10, backgroundColor: '#25D366' },
  smallAvatarText: { color: '#fff', fontWeight: '800' },
  messages: { gap: 10, marginBottom: 16 },
  msgWrap: { maxWidth: '82%' },
  msgWrapMine: { alignSelf: 'flex-end' },
  msgWrapOther: { alignSelf: 'flex-start' },
  msgBubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  msgMine: { backgroundColor: '#dcf8c6', borderBottomRightRadius: 6 },
  msgOther: { backgroundColor: '#f0f2f5', borderBottomLeftRadius: 6 },
  msgText: { color: '#111b21', fontSize: 14, lineHeight: 20 },
  msgTime: { color: '#667781', fontSize: 11, marginTop: 6, textAlign: 'right' },
  composer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f2f5', borderRadius: 22, paddingLeft: 16, paddingRight: 8, paddingVertical: 8 },
  composerInput: { flex: 1, color: '#111b21', fontSize: 14, paddingVertical: 8 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#25D366', alignItems: 'center', justifyContent: 'center' },
  addBtn: { backgroundColor: '#25D366', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  addBtnText: { color: '#fff', fontWeight: '800' },
  requestRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  acceptBtn: { backgroundColor: '#25D366', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 },
  acceptBtnText: { color: '#fff', fontWeight: '800' },
  grayBtn: { backgroundColor: '#f0f2f5', borderRadius: 18, paddingVertical: 14, alignItems: 'center', marginBottom: 12 },
  grayBtnText: { color: '#111b21', fontWeight: '800' },
  redBtn: { backgroundColor: '#fde9e7', borderRadius: 18, paddingVertical: 14, alignItems: 'center' },
  redBtnText: { color: '#c24840', fontWeight: '800' },
});
