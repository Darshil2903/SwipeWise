import React, { useEffect, useMemo, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  StyleSheet,
  StatusBar,
  Modal,
  Switch,
  Platform,
  Alert,
  ActivityIndicator,
  useColorScheme,
} from 'react-native';

import { isSupabaseConfigured, supabase } from './lib/supabase';
import { signInWithEmail, signOut, signUpWithEmail } from './services/authService';
import {
  completeOnboarding,
  getProfileAndSettings,
  rewardPreferenceFromDb,
  rewardPreferenceToDb,
  updateUserSettings,
} from './services/profileService';
import { addWalletCard, getWalletCardSlugs, removeWalletCard, syncWallet } from './services/walletService';
import { clearPurchases, createPurchase, getPurchases } from './services/purchaseService';
import { getVerifiedReferenceData } from './services/cardReferenceService';
import { recommendCards, WARNING_CODES } from './engine/recommendationEngine';
import { productionPointValuations } from './engine/pointValuations';
import { GENERIC_PURCHASE_CATEGORIES } from './config/merchantCatalog';
import { createManualMerchant, nearbyConfidenceLabel, searchCatalogMerchants, toRecommendationMerchantContext } from './services/merchantNormalization';
import { getNearbyMerchants, searchInStoreMerchants, searchOnlineMerchants } from './services/merchantProviderService';
import { requestForegroundCoordinates } from './services/locationService';

const BLUE = '#0798ff';
const CYAN = '#35d8ff';
const GREEN = '#2ee6a6';
const RED = '#ff6b7a';

const categories = GENERIC_PURCHASE_CATEGORIES;

const money = (n) => `$${Number(n || 0).toFixed(2)}`;

const normalizeAmountText = (value) => {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return '';
  if (trimmed === '.') return '0.';
  return /^\d+(?:\.\d{0,2})?$/.test(trimmed) ? trimmed : null;
};

const parseAmountText = (value) => {
  const normalized = normalizeAmountText(value);
  if (normalized == null || normalized === '') return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const verifiedDate = (value) => value ? new Date(value).toLocaleDateString() : 'Not available';

function rewardLabel(candidate) {
  if (!candidate) return 'Reward data unavailable';
  if (candidate.rewardKind === 'cashback') return `${Number(candidate.rewardRate || 0).toFixed(2).replace(/\.00$/, '')}% cashback`;
  if (candidate.rewardKind === 'points') return `${Number(candidate.rewardRate || 0).toFixed(2).replace(/\.00$/, '')}× ${friendlyRewardCurrency(candidate.rewardCurrency)}`;
  return 'Reward data unavailable';
}

function friendlyRewardCurrency(value) {
  return ({
    AEROPLAN_POINTS: 'Aeroplan points',
    AVENTURA_POINTS: 'Aventura points',
    AVION_POINTS: 'Avion points',
    MEMBERSHIP_REWARDS_POINTS: 'Membership Rewards points',
    WORLD_OF_HYATT_POINTS: 'World of Hyatt points',
    CAD_CASHBACK: 'cashback',
  })[value] || String(value || 'points').replaceAll('_', ' ').toLowerCase();
}

function warningText(code) {
  return ({
    [WARNING_CODES.ACCEPTANCE_UNKNOWN]: 'Merchant card-network acceptance is not confirmed yet.',
    [WARNING_CODES.POINT_VALUE_UNAVAILABLE]: 'No SwipeWise point valuation is configured for this reward currency, so no cash-equivalent value is invented.',
    [WARNING_CODES.CAP_PROGRESS_UNKNOWN]: 'Cap usage cannot be fully verified from optional SwipeWise purchase logs, so the engine uses a conservative rate.',
    [WARNING_CODES.CAP_PERIOD_UNRESOLVED]: 'The issuer cap period cannot be derived safely from the current data.',
    [WARNING_CODES.MERCHANT_CLASSIFICATION_REQUIRED]: 'A verified merchant/MCC classification is needed before an accelerated category rate can be applied.',
    [WARNING_CODES.STALE_DATA_WARNING]: 'Some reference data is marked stale.',
    [WARNING_CODES.UNCERTAIN_DATA_WARNING]: 'Some reference data is uncertain and was not silently treated as verified.',
    [WARNING_CODES.CACHE_STALE]: 'Using cached verified reference data because the latest refresh failed.',
    [WARNING_CODES.POST_CAP_RATE_USED]: 'A post-cap or conservative fallback rate is being used.',
    [WARNING_CODES.SHARED_CAP]: 'This reward rule shares a spending cap with other categories.',
    [WARNING_CODES.TEMPORARY_PROMOTION]: 'A time-limited verified rule applies to this purchase context.',
    [WARNING_CODES.LOGGED_PURCHASES_ONLY]: 'Cap tracking uses only purchases voluntarily logged in SwipeWise.',
    [WARNING_CODES.BENEFIT_CONDITIONS_APPLY]: 'Relevant protections have eligibility/payment/certificate conditions; coverage is not guaranteed by this recommendation.',
  })[code] || code.replaceAll('_', ' ').toLowerCase();
}

function AppShell({ theme, children }) {
  const t = makeTheme(theme);
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]}>
      <StatusBar barStyle={theme === 'light' ? 'dark-content' : 'light-content'} />
      <View pointerEvents="none" style={[styles.glow, { backgroundColor: BLUE, opacity: theme === 'light' ? 0.08 : 0.15 }]} />
      {children}
    </SafeAreaView>
  );
}

function makeTheme(mode) {
  const light = mode === 'light';
  return {
    bg: light ? '#f6fbff' : '#020a13',
    bg2: light ? '#eef7ff' : '#06182a',
    text: light ? '#071421' : '#f5fbff',
    secondary: light ? '#617080' : '#8ea6ba',
    card: light ? 'rgba(255,255,255,0.82)' : 'rgba(9,31,50,0.82)',
    border: light ? 'rgba(0,149,255,0.22)' : 'rgba(53,216,255,0.25)',
    input: light ? '#ffffff' : '#071b2d',
  };
}

function Logo({ compact = false, t }) {
  return (
    <View style={{ alignItems: 'center', gap: compact ? 2 : 7 }}>
      <Text style={[styles.logoS, { fontSize: compact ? 38 : 82 }]}>S</Text>
      {!compact && <Text style={[styles.logoText, { color: t.text }]}>SwipeWise</Text>}
    </View>
  );
}

function Glass({ t, children, style }) {
  return <View style={[styles.glass, { backgroundColor: t.card, borderColor: t.border }, style]}>{children}</View>;
}

function Header({ t, title, subtitle }) {
  return (
    <View style={{ gap: 5, width: '100%' }}>
      <Text style={[styles.h1, { color: t.text }]}>{title}</Text>
      {subtitle ? <Text style={[styles.sub, { color: t.secondary }]}>{subtitle}</Text> : null}
    </View>
  );
}

function Button({ t, title, onPress, secondary = false, disabled = false }) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [
      styles.button,
      { backgroundColor: secondary ? t.card : BLUE, borderColor: secondary ? t.border : BLUE, opacity: disabled ? 0.45 : pressed ? 0.75 : 1 },
    ]}>
      <Text style={{ color: secondary ? t.text : 'white', fontWeight: '800', fontSize: 15 }}>{title}</Text>
    </Pressable>
  );
}

function RowButton({ t, title, subtitle, onPress, selected = false, icon = '›' }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.65 : 1 }]}>
      <Glass t={t} style={styles.rowCard}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.text, fontWeight: '700', fontSize: 15 }}>{title}</Text>
          {subtitle ? <Text style={{ color: t.secondary, marginTop: 3, fontSize: 12 }}>{subtitle}</Text> : null}
        </View>
        <Text style={{ color: selected ? CYAN : t.secondary, fontSize: selected ? 20 : 23 }}>{selected ? '◉' : icon}</Text>
      </Glass>
    </Pressable>
  );
}

function CardVisual({ t, card, compact = false }) {
  return (
    <View style={[styles.cardVisual, { backgroundColor: card.accent, minHeight: compact ? 118 : 150 }]}> 
      <View style={styles.cardShine} />
      <Text style={styles.cardBank}>{card.bank}</Text>
      <Text style={styles.cardName}>{card.name}</Text>
      <View style={{ flex: 1 }} />
      <View style={styles.cardBottom}>
        <Text style={styles.cardLast}>Card product</Text>
        <Text style={styles.cardNetwork}>{card.network}</Text>
      </View>
    </View>
  );
}

function DemoBanner({ t }) {
  return (
    <View style={[styles.demo, { borderColor: '#d99c21' }]}>
      <Text style={{ color: '#e8aa2e', fontSize: 11 }}>⚠ Merchant discovery uses foreground-only location and a server-side provider proxy when configured. No private provider key is stored in Expo.</Text>
    </View>
  );
}

function Stat({ t, title, value, accent = CYAN }) {
  return (
    <Glass t={t} style={{ flex: 1 }}>
      <Text style={{ color: t.secondary, fontSize: 11 }}>{title}</Text>
      <Text style={{ color: accent, fontWeight: '900', fontSize: 19, marginTop: 6 }}>{value}</Text>
    </Glass>
  );
}

function BackendSetupRequired({ theme }) {
  const t = makeTheme(theme);
  return (
    <AppShell theme={theme}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={{ flex: 1, minHeight: 90 }} />
        <Logo t={t} />
        <Header t={t} title="Connect Supabase" subtitle="SwipeWise is ready for the real backend, but this copy does not have your project values yet." />
        <Glass t={t}>
          <Text style={{ color: t.text, fontWeight: '800' }}>Create a .env file in the project root with:</Text>
          <Text style={{ color: CYAN, marginTop: 10, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>EXPO_PUBLIC_SUPABASE_URL=...</Text>
          <Text style={{ color: CYAN, marginTop: 6, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...</Text>
          <Text style={{ color: t.secondary, marginTop: 12 }}>Then stop Expo and run npx expo start again.</Text>
        </Glass>
        <Text style={[styles.tiny, { color: t.secondary }]}>Never put a service-role key or sb_secret_* key in the Expo app.</Text>
      </ScrollView>
    </AppShell>
  );
}

function LoadingScreen({ theme, message = 'Connecting to SwipeWise…' }) {
  const t = makeTheme(theme);
  return (
    <AppShell theme={theme}>
      <View style={styles.centerPage}>
        <View style={{ flex: 1 }} />
        <Logo t={t} compact />
        <ActivityIndicator size="large" color={CYAN} style={{ marginTop: 24 }} />
        <Text style={[styles.tagline, { color: t.secondary }]}>{message}</Text>
        <View style={{ flex: 1 }} />
      </View>
    </AppShell>
  );
}

function BackendProblem({ theme, message, onRetry, onSignOut }) {
  const t = makeTheme(theme);
  return (
    <AppShell theme={theme}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={{ minHeight: 70 }} />
        <Header t={t} title="Supabase setup needs attention" subtitle="SwipeWise connected to Supabase, but one of the required database operations failed." />
        <Glass t={t}><Text style={{ color: RED, fontWeight: '700' }}>{message}</Text></Glass>
        <Text style={{ color: t.secondary }}>Make sure the base Supabase schema and the Chat 05 verified card-data migration are applied, and that reference-table RLS allows verified rows to be read.</Text>
        <Button t={t} title="Try Again" onPress={onRetry} />
        {onSignOut ? <Button t={t} title="Sign Out" secondary onPress={onSignOut} /> : null}
      </ScrollView>
    </AppShell>
  );
}

function Splash({ theme, onDone }) {
  const t = makeTheme(theme);
  useEffect(() => { const x = setTimeout(onDone, 1100); return () => clearTimeout(x); }, []);
  return (
    <AppShell theme={theme}>
      <View style={styles.centerPage}>
        <View style={{ flex: 1 }} />
        <Logo t={t} />
        <Text style={[styles.tagline, { color: t.secondary }]}>Use the right card.\nEvery time.</Text>
        <View style={{ flex: 1 }} />
        <View style={styles.pill} />
      </View>
    </AppShell>
  );
}

function Onboarding({
  theme,
  appearance,
  onAppearanceChange,
  session,
  onFinish,
  userName,
  setUserName,
  selectedIds,
  setSelectedIds,
  rewardPreference,
  setRewardPreference,
  catalog,
}) {
  const t = makeTheme(theme);
  const [stage, setStage] = useState(session ? 2 : 0);
  const [name, setName] = useState(userName || '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [setupIds, setSetupIds] = useState(selectedIds);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    if (session && stage < 2) setStage(2);
  }, [session, stage]);

  useEffect(() => {
    if (selectedIds.length) setSetupIds(selectedIds);
  }, [selectedIds]);

  useEffect(() => {
    if (userName && !name) setName(userName);
  }, [userName, name]);

  const next = () => setStage((s) => s + 1);
  const toggleCard = (id) => setSetupIds((ids) => ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);

  const createAccount = async () => {
    setAuthError('');
    setAuthMessage('');
    if (!name.trim()) return setAuthError('Please enter your display name.');
    if (!email.trim()) return setAuthError('Please enter your email address.');
    if (password.length < 6) return setAuthError('Password must be at least 6 characters.');
    if (password !== confirmPassword) return setAuthError('Passwords do not match.');

    setAuthBusy(true);
    try {
      const data = await signUpWithEmail({ displayName: name, email, password });
      setUserName(name.trim());
      if (data.session) {
        setStage(2);
      } else {
        setAuthMessage('Account created. Confirm your email, then return here and sign in. For the first development test, you can temporarily disable Confirm Email in Supabase Auth settings.');
      }
    } catch (error) {
      setAuthError(error.message || 'Could not create account.');
    } finally {
      setAuthBusy(false);
    }
  };

  const login = async () => {
    setAuthError('');
    setAuthMessage('');
    if (!email.trim() || !password) return setAuthError('Enter your email and password.');
    setAuthBusy(true);
    try {
      await signInWithEmail({ email, password });
    } catch (error) {
      setAuthError(error.message || 'Could not sign in.');
    } finally {
      setAuthBusy(false);
    }
  };

  const finish = async () => {
    setAuthError('');
    setFinishing(true);
    try {
      await onFinish({ selectedIds: setupIds, rewardPreference, appearance, displayName: name || userName });
    } catch (error) {
      setAuthError(error.message || 'Could not finish setup.');
    } finally {
      setFinishing(false);
    }
  };

  return (
    <AppShell theme={theme}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        {stage === 0 && <>
          <View style={{ flex: 1, minHeight: 125 }} />
          <Logo t={t} />
          <Text style={[styles.bigCenter, { color: t.text }]}>Welcome to SwipeWise</Text>
          <Text style={[styles.tagline, { color: t.secondary }]}>Swipe smarter. Earn more.\nFind the right card for every purchase.</Text>
          <View style={{ flex: 1, minHeight: 90 }} />
          <Button t={t} title="Get Started" onPress={() => { setAuthError(''); setStage(1); }} />
          <Button t={t} title="Sign In" secondary onPress={() => { setAuthError(''); setStage(10); }} />
        </>}

        {stage === 1 && <>
          <Header t={t} title="Create Account" subtitle="Create your real SwipeWise account with Supabase Auth." />
          <Field t={t} value={name} onChangeText={setName} placeholder="Display Name" autoCapitalize="words" />
          <Field t={t} value={email} onChangeText={setEmail} placeholder="Email Address" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
          <Field t={t} value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry autoCapitalize="none" />
          <Field t={t} value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Confirm Password" secureTextEntry autoCapitalize="none" />
          {authError ? <Text style={{ color: RED, fontWeight: '700' }}>{authError}</Text> : null}
          {authMessage ? <Glass t={t}><Text style={{ color: t.secondary }}>{authMessage}</Text></Glass> : null}
          <View style={{ flex: 1, minHeight: 80 }} />
          <Button t={t} title={authBusy ? 'Creating Account…' : 'Create Account'} disabled={authBusy} onPress={createAccount} />
          <Button t={t} title="Already have an account? Sign In" secondary onPress={() => { setAuthError(''); setStage(10); }} />
          <Text style={[styles.tiny, { color: t.secondary }]}>SwipeWise stores your account, wallet selections, settings and purchase logs in Supabase. It never asks for full card number, CVV, PIN or expiry.</Text>
        </>}

        {stage === 10 && <>
          <Header t={t} title="Sign In" subtitle="Welcome back to SwipeWise" />
          <Field t={t} value={email} onChangeText={setEmail} placeholder="Email Address" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
          <Field t={t} value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry autoCapitalize="none" />
          {authError ? <Text style={{ color: RED, fontWeight: '700' }}>{authError}</Text> : null}
          <View style={{ flex: 1, minHeight: 120 }} />
          <Button t={t} title={authBusy ? 'Signing In…' : 'Sign In'} disabled={authBusy} onPress={login} />
          <Button t={t} title="Create a New Account" secondary onPress={() => { setAuthError(''); setStage(1); }} />
          <Button t={t} title="Back" secondary onPress={() => { setAuthError(''); setStage(0); }} />
        </>}

        {stage === 2 && <>
          <Header t={t} title="How SwipeWise Works" />
          <Glass t={t}>
            <HowStep t={t} n="1" title="Tell us where and what you're buying" />
            <HowStep t={t} n="2" title="We compare your cards" />
            <HowStep t={t} n="3" title="We show the best card to use" />
          </Glass>
          <View style={{ flex: 1, minHeight: 150 }} />
          <Button t={t} title="Next" onPress={next} />
        </>}

        {stage === 3 && <>
          <Header t={t} title="Add Your Cards" subtitle="Manually add the card products you own. We never ask for card numbers or CVV." />
          <Pressable onPress={() => setStage(4)}>
            <Glass t={t} style={{ alignItems: 'center', paddingVertical: 32 }}>
              <Text style={{ color: CYAN, fontSize: 40 }}>＋</Text>
              <Text style={{ color: t.text, fontWeight: '800' }}>Add a Card</Text>
            </Glass>
          </Pressable>
          <Text style={{ color: t.secondary }}>{setupIds.length} card(s) selected</Text>
          <View style={{ flex: 1, minHeight: 120 }} />
          <Button t={t} title="Next" disabled={!setupIds.length} onPress={() => setStage(5)} />
        </>}

        {stage === 4 && <>
          <Header t={t} title="Select Card Type" subtitle="Choose the exact verified card product you own." />
          {['Credit Card', 'Debit Card', 'Prepaid Card', 'Store Card'].map((x) => <RowButton key={x} t={t} title={x} onPress={() => {}} />)}
          <Text style={[styles.sectionTitle, { color: t.text }]}>Card Catalog</Text>
          {catalog.map((c) => <RowButton key={c.id} t={t} title={c.name} subtitle={`${c.network} • verified ${verifiedDate(c.verifiedAt)}`} selected={setupIds.includes(c.id)} onPress={() => toggleCard(c.id)} />)}
          <Button t={t} title="Done" onPress={() => setStage(3)} />
        </>}

        {stage === 5 && <>
          <Header t={t} title="Your Wallet" subtitle={`${setupIds.length} Card${setupIds.length === 1 ? '' : 's'} Added`} />
          {catalog.filter((c) => setupIds.includes(c.id)).map((c) => <CardVisual key={c.id} t={t} card={c} compact />)}
          <View style={{ flex: 1, minHeight: 90 }} />
          <Button t={t} title="Continue" disabled={!setupIds.length} onPress={() => { setSelectedIds(setupIds); next(); }} />
        </>}

        {stage === 6 && <>
          <Header t={t} title="What Matters Most?" subtitle="Choose your reward preference. You can change this anytime." />
          {['Maximum Overall Value', 'Cashback', 'Travel Points'].map((p) => <RowButton key={p} t={t} title={p} selected={rewardPreference === p} onPress={() => setRewardPreference(p)} />)}
          <View style={{ flex: 1, minHeight: 130 }} />
          <Button t={t} title="Continue" onPress={next} />
        </>}

        {stage === 7 && <>
          <Header t={t} title="Enable Location?" subtitle="We use your location only when you ask for nearby stores." />
          <Text style={styles.locationIcon}>⌖</Text>
          <View style={{ flex: 1, minHeight: 80 }} />
          <Button t={t} title="Enable Location" onPress={next} />
          <Button t={t} title="Not Now" secondary onPress={next} />
        </>}

        {stage === 8 && <>
          <Header t={t} title="Add to Action Button" subtitle="Quick Swipe can be opened from inside the app now; native Action Button support comes later." />
          <View style={styles.actionCircle}><Logo t={t} compact /></View>
          <View style={{ flex: 1, minHeight: 80 }} />
          <Button t={t} title="Continue" onPress={next} />
          <Button t={t} title="Skip" secondary onPress={next} />
        </>}

        {stage === 9 && <>
          <View style={{ flex: 1, minHeight: 130 }} />
          <Text style={styles.complete}>✓</Text>
          <Text style={[styles.bigCenter, { color: t.text }]}>You're All Set! 🎉</Text>
          <Text style={[styles.tagline, { color: t.secondary }]}>Your wallet and settings will now sync to Supabase.</Text>
          {authError ? <Text style={{ color: RED, fontWeight: '700', textAlign: 'center' }}>{authError}</Text> : null}
          <View style={{ flex: 1, minHeight: 100 }} />
          <Button t={t} title={finishing ? 'Saving Setup…' : 'Start Using App'} disabled={finishing} onPress={finish} />
          <Pressable onPress={() => onAppearanceChange(appearance === 'dark' ? 'light' : 'dark')}><Text style={{ color: t.secondary, textAlign: 'center' }}>Preview {theme === 'dark' ? 'Light' : 'Dark'} Mode</Text></Pressable>
        </>}
      </ScrollView>
    </AppShell>
  );
}

function HowStep({ t, n, title }) {
  return <View style={styles.how}><View style={styles.howNum}><Text style={{ color: 'white', fontWeight: '900' }}>{n}</Text></View><Text style={{ color: t.text, flex: 1, fontWeight: '700' }}>{title}</Text></View>;
}

function Field({ t, ...props }) {
  return <TextInput placeholderTextColor={t.secondary} style={[styles.input, { color: t.text, backgroundColor: t.input, borderColor: t.border }]} {...props} />;
}

function QuickSwipe({ theme, wallet, rewardPreference, purchases, referenceMeta, onClose, onSave }) {
  const t = makeTheme(theme);
  const [step, setStep] = useState('mode');
  const [mode, setMode] = useState(null);
  const [merchant, setMerchant] = useState(null);
  const [category, setCategory] = useState('Other');
  const [amountText, setAmountText] = useState('');
  const [usedCard, setUsedCard] = useState(null);
  const [notes, setNotes] = useState('');
  const [why, setWhy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [merchantQuery, setMerchantQuery] = useState('');
  const [merchantResults, setMerchantResults] = useState([]);
  const [manualMerchantName, setManualMerchantName] = useState('');
  const [merchantBusy, setMerchantBusy] = useState(false);
  const [merchantError, setMerchantError] = useState('');
  const [foregroundCoords, setForegroundCoords] = useState(null);
  const [locationState, setLocationState] = useState('not_requested');
  const amount = parseAmountText(amountText);

  const handleAmountTextChange = (value) => {
    const normalized = normalizeAmountText(value);
    if (normalized != null) setAmountText(normalized);
  };

  const buildResult = (nextCategory = category, nextAmount = amount) => {
    const merchantContext = toRecommendationMerchantContext(merchant);
    return recommendCards({
      cards: wallet,
      context: {
        ...merchantContext,
        purchaseMode: mode,
        purchaseCategory: nextCategory,
        amount: nextAmount,
        purchaseDate: new Date().toISOString(),
        country: 'CA',
      },
      rewardPreference,
      pointValuations: productionPointValuations,
      purchases,
      referenceMeta,
    });
  };

  const result = useMemo(
    () => buildResult(category, amount),
    [wallet, category, amountText, rewardPreference, merchant, mode, purchases, referenceMeta]
  );
  const ranked = result.ranked_cards || [];
  const best = ranked[0] || null;
  const bestCard = best ? wallet.find((card) => card.id === best.cardSlug) : null;

  const pickMerchant = (nextMerchant) => {
    setMerchant(nextMerchant);
    setMerchantError('');
    setCategory('Other');
    setStep('category');
  };

  const pickCategory = (nextCategory) => {
    setCategory(nextCategory);
    const preview = buildResult(nextCategory, null);
    setStep(preview.amount_required ? 'amount' : 'best');
  };

  const openOnlineSearch = () => {
    setMode('Online');
    setMerchantQuery('');
    setMerchantResults(searchOnlineMerchants('', { limit: 10 }));
    setMerchantError('');
    setStep('merchant_search');
  };

  const openInStore = () => {
    setMode('In Store');
    setMerchantError('');
    setStep('in_store_start');
  };

  const openMerchantSearch = () => {
    const normalizedMode = mode === 'Online' ? 'online' : 'in_store';
    setMerchantQuery('');
    setMerchantResults(searchCatalogMerchants('', { mode: normalizedMode, limit: 10 }));
    setMerchantError('');
    setStep('merchant_search');
  };

  const handleFindNearby = async () => {
    if (merchantBusy) return;
    setMerchantBusy(true);
    setMerchantError('');
    try {
      setLocationState('requesting');
      const location = await requestForegroundCoordinates();
      if (location.status !== 'granted' || !location.coords) {
        setLocationState(location.status || 'denied');
        setMerchantError('Location is not available. You can still search for a merchant or enter one manually.');
        return;
      }
      setLocationState('granted');
      setForegroundCoords(location.coords);
      const nearby = await getNearbyMerchants(location.coords);
      if (!nearby.length) {
        setMerchantError('No nearby merchants were returned. Search or enter the merchant manually.');
        return;
      }
      setMerchantResults(nearby);
      setStep('nearby');
    } catch (error) {
      setLocationState('error');
      setMerchantError(error?.message || 'Nearby merchant discovery is unavailable. Search or enter the merchant manually.');
    } finally {
      setMerchantBusy(false);
    }
  };

  const handleMerchantSearch = async () => {
    const query = merchantQuery.trim();
    if (!query) {
      setMerchantResults(mode === 'Online'
        ? searchOnlineMerchants('', { limit: 10 })
        : searchCatalogMerchants('', { mode: 'in_store', limit: 10 }));
      return;
    }
    setMerchantBusy(true);
    setMerchantError('');
    try {
      const results = mode === 'Online'
        ? searchOnlineMerchants(query, { limit: 12 })
        : await searchInStoreMerchants(query, { coords: foregroundCoords, limit: 12 });
      setMerchantResults(results);
      if (!results.length) setMerchantError('No known match found. You can use the exact name you entered manually.');
    } catch (error) {
      setMerchantError(error?.message || 'Merchant search is unavailable. You can still enter the merchant manually.');
      setMerchantResults([]);
    } finally {
      setMerchantBusy(false);
    }
  };

  const openManualEntry = (prefill = '') => {
    setManualMerchantName(prefill || merchantQuery || '');
    setMerchantError('');
    setStep('manual_merchant');
  };

  const useManualMerchant = () => {
    const manual = createManualMerchant(manualMerchantName, { mode: mode || 'In Store' });
    if (!manual) {
      setMerchantError('Enter the merchant name before continuing.');
      return;
    }
    pickMerchant(manual);
  };

  const save = async () => {
    if (!best || !usedCard || !merchant || saving) return;
    const used = ranked.find((candidate) => candidate.cardSlug === usedCard.id);
    setSaveError('');
    setSaving(true);
    try {
      await onSave({
        id: `${Date.now()}`, date: new Date().toISOString(), mode, merchant: merchant.name, category,
        amount, recommendedCardId: best.cardSlug, usedCardId: usedCard.id,
        reward: used?.estimatedRewardValue ?? null, followed: usedCard.id === best.cardSlug, overrideReason: null, notes,
      });
      setStep('saved');
    } catch (error) {
      setSaveError(error.message || 'Could not save this purchase.');
    } finally {
      setSaving(false);
    }
  };

  const merchantEvidence = merchant ? [
    `Merchant: ${merchant.name}`,
    `Identity: ${merchant.normalizationStatus || 'UNKNOWN'}${merchant.enteredName && merchant.enteredName !== merchant.name ? ` (entered as “${merchant.enteredName}”)` : ''}`,
    `MCC: ${merchant.mccEvidence?.status === 'VERIFIED' ? merchant.mccEvidence.value : 'Unknown — not assumed'}`,
    `Card-network acceptance: ${merchant.acceptance?.status === 'VERIFIED' ? merchant.acceptance.networks.join(', ') : 'Unknown — engine will warn rather than guess'}`,
  ] : [];

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <AppShell theme={theme}>
        <View style={styles.modalTop}><Pressable onPress={onClose}><Text style={{ color: CYAN, fontWeight: '800' }}>Cancel</Text></Pressable><Text style={{ color: t.text, fontWeight: '900' }}>Quick Swipe</Text><View style={{ width: 46 }} /></View>
        <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
          {step === 'mode' && <>
            <Header t={t} title="Where are you making a purchase?" subtitle="Location never decides this for you." />
            <BigChoice t={t} title="In Store" subtitle="Find nearby stores or search manually" onPress={openInStore} />
            <BigChoice t={t} title="Online" subtitle="Search an online merchant" onPress={openOnlineSearch} />
          </>}

          {step === 'in_store_start' && <>
            <Header t={t} title="Choose the Store" subtitle="Use foreground location only if you want nearby suggestions." />
            {merchantError ? <Glass t={t}><Text style={{ color: '#e8aa2e' }}>{merchantError}</Text></Glass> : null}
            <Button t={t} title={merchantBusy ? 'Finding Nearby Stores…' : 'Find Nearby Stores'} disabled={merchantBusy} onPress={handleFindNearby} />
            <Button t={t} title="Search Merchant" secondary onPress={openMerchantSearch} />
            <Button t={t} title="Enter Merchant Manually" secondary onPress={() => openManualEntry('')} />
            <Text style={{ color: t.secondary, fontSize: 11, textAlign: 'center' }}>Foreground / when-in-use only. Raw coordinates are not written to purchase history or analytics.</Text>
            {locationState === 'denied' ? <Text style={{ color: t.secondary, fontSize: 11, textAlign: 'center' }}>Location denied — Quick Swipe remains fully usable.</Text> : null}
          </>}

          {step === 'nearby' && <>
            <Header t={t} title="Nearby Stores" subtitle="You choose the merchant. Closest is never auto-selected." />
            {merchantResults.map((item) => <RowButton
              key={item.providerPlaceId || item.id}
              t={t}
              title={item.name}
              subtitle={`${item.distanceMeters == null ? 'Distance unavailable' : `${Math.round(item.distanceMeters)} m`} • ${nearbyConfidenceLabel(item)}${item.address ? ` • ${item.address}` : ''}`}
              onPress={() => pickMerchant(item)}
            />)}
            <Text style={{ color: t.secondary, fontSize: 11, textAlign: 'center' }}>Nearby POI source: TomTom via the SwipeWise backend. Provider categories are hints only, not guaranteed transaction MCCs.</Text>
            <Button t={t} title="Search Merchant" secondary onPress={openMerchantSearch} />
            <Button t={t} title="Enter Manually" secondary onPress={() => openManualEntry('')} />
            <Button t={t} title="Back" secondary onPress={() => setStep('in_store_start')} />
          </>}

          {step === 'merchant_search' && <>
            <Header t={t} title={mode === 'Online' ? 'Search Online Merchant' : 'Search Merchant'} subtitle={mode === 'Online' ? 'Popular merchants appear below. Location is not used.' : 'Search works even if location is denied.'} />
            <Field t={t} value={merchantQuery} onChangeText={setMerchantQuery} placeholder={mode === 'Online' ? 'Amazon, Best Buy, Air Canada…' : 'Costco, Shell, local store…'} autoCapitalize="words" />
            <Button t={t} title={merchantBusy ? 'Searching…' : 'Search'} disabled={merchantBusy} onPress={handleMerchantSearch} />
            {merchantError ? <Glass t={t}><Text style={{ color: '#e8aa2e' }}>{merchantError}</Text></Glass> : null}
            {merchantResults.map((item) => <RowButton
              key={`${item.providerPlaceId || item.id}:${item.address || ''}`}
              t={t}
              title={item.name}
              subtitle={item.provider === 'tomtom'
                ? `${item.distanceMeters == null ? 'TomTom result' : `${Math.round(item.distanceMeters)} m`} ${item.address ? `• ${item.address}` : ''}`
                : `${item.normalizedCategory || (mode === 'Online' ? 'Online merchant' : 'Known merchant')} • SwipeWise catalog`}
              onPress={() => pickMerchant(item)}
            />)}
            {merchantQuery.trim() ? <Button t={t} title={`Use “${merchantQuery.trim()}” Manually`} secondary onPress={() => openManualEntry(merchantQuery.trim())} /> : null}
            <Button t={t} title="Enter Another Merchant Manually" secondary onPress={() => openManualEntry('')} />
            <Button t={t} title="Back" secondary onPress={() => setStep(mode === 'Online' ? 'mode' : 'in_store_start')} />
          </>}

          {step === 'manual_merchant' && <>
            <Header t={t} title="Enter Merchant" subtitle="SwipeWise preserves the name you give us and does not invent MCC or network acceptance." />
            <Field t={t} value={manualMerchantName} onChangeText={setManualMerchantName} placeholder="Merchant name" autoCapitalize="words" />
            {merchantError ? <Text style={{ color: RED }}>{merchantError}</Text> : null}
            <Button t={t} title="Continue" disabled={!manualMerchantName.trim()} onPress={useManualMerchant} />
            <Button t={t} title="Back" secondary onPress={() => setStep(mode === 'Online' ? 'merchant_search' : 'in_store_start')} />
          </>}

          {step === 'category' && <>
            <Header t={t} title="What are you buying today?" subtitle={merchant?.name} />
            {(merchant?.categories || categories).map((c) => <RowButton key={c} t={t} title={c} onPress={() => pickCategory(c)} />)}
          </>}

          {step === 'amount' && <>
            <Header t={t} title="How much is your purchase?" subtitle="This verified rule can change the winner based on the transaction amount." />
            <Field t={t} value={amountText} onChangeText={handleAmountTextChange} placeholder="$ 0.00" keyboardType="decimal-pad" />
            <Button t={t} title="Continue" disabled={!amount} onPress={() => setStep('best')} />
            <Button t={t} title="Skip Amount" secondary onPress={() => setStep('best')} />
          </>}

          {step === 'best' && <>
            <Header t={t} title="Your Best Card" subtitle={`${merchant?.name} • ${category}`} />
            {merchant && (merchant.normalizationStatus !== 'KNOWN' || merchant.acceptance?.status !== 'VERIFIED' || merchant.mccEvidence?.status !== 'VERIFIED') ? <Glass t={t}>
              <Text style={{ color: t.text, fontWeight: '800' }}>Merchant context</Text>
              {merchantEvidence.map((line) => <Text key={line} style={{ color: t.secondary, marginTop: 5 }}>• {line}</Text>)}
            </Glass> : null}
            {!best || !bestCard ? <Glass t={t}><Text style={{ color: RED, fontWeight: '800' }}>SwipeWise does not have enough verified data to make a recommendation for this context.</Text></Glass> : <>
              <CardVisual t={t} card={bestCard} />
              <Glass t={t}>
                <Text style={{ color: CYAN, fontWeight: '900', fontSize: 24 }}>{rewardLabel(best)}</Text>
                {best.estimatedRewardValue != null && <Text style={{ color: t.text, fontWeight: '800', marginTop: 7 }}>Estimated reward value: {money(best.estimatedRewardValue)}</Text>}
                {best.estimatedRewardUnits != null && best.rewardKind === 'points' && <Text style={{ color: t.secondary, marginTop: 5 }}>Estimated points: {best.estimatedRewardUnits.toFixed(0)} {friendlyRewardCurrency(best.rewardCurrency)}</Text>}
                {best.benefitHighlights.map((benefit) => <Text key={benefit.id} style={{ color: t.secondary, marginTop: 6 }}>✓ {benefit.details || benefit.benefit_type}{benefit.conditionsApply ? ' — conditions apply' : ''}</Text>)}
                <Text style={{ color: t.secondary, marginTop: 8 }}>Data confidence: {result.data_confidence}</Text>
              </Glass>
              {!!result.warning_codes.length && <Glass t={t}>{result.warning_codes.slice(0, 5).map((code) => <Text key={code} style={{ color: '#e8aa2e', marginVertical: 3 }}>⚠ {warningText(code)}</Text>)}</Glass>}
              <Button t={t} title="Why This Card?" secondary onPress={() => setWhy(true)} />
              <Button t={t} title="I Used This Card" onPress={() => { setUsedCard(bestCard); setStep('log'); }} />
              <Button t={t} title="Choose Another" secondary onPress={() => setStep('override')} />
            </>}
          </>}

          {step === 'override' && <>
            <Header t={t} title="Choose Another Card" subtitle="You are always in control." />
            {ranked.map((candidate) => {
              const card = wallet.find((item) => item.id === candidate.cardSlug);
              return card ? <RowButton key={candidate.cardSlug} t={t} title={card.name} subtitle={rewardLabel(candidate)} onPress={() => { setUsedCard(card); setStep('log'); }} /> : null;
            })}
            <Button t={t} title="Back" secondary onPress={() => setStep('best')} />
          </>}

          {step === 'log' && <>
            <Header t={t} title="Log Purchase" subtitle={`${merchant?.name} • ${usedCard?.name || ''}`} />
            <Field t={t} value={amountText} onChangeText={handleAmountTextChange} placeholder="Amount (optional)" keyboardType="decimal-pad" />
            <Field t={t} value={notes} onChangeText={setNotes} placeholder="Notes (optional)" />
            {saveError ? <Text style={{ color: RED }}>{saveError}</Text> : null}
            <Button t={t} title={saving ? 'Saving…' : 'Save Purchase'} disabled={saving} onPress={save} />
            <Button t={t} title="Skip" secondary onPress={onClose} />
          </>}

          {step === 'saved' && <>
            <View style={{ alignItems: 'center', marginTop: 80, gap: 16 }}><Text style={{ color: GREEN, fontSize: 70 }}>✓</Text><Header t={t} title="Purchase Saved" subtitle={amount ? 'Your logged purchase is stored in Supabase.' : 'Purchase logged without inventing a reward dollar value.'} /></View>
            <Button t={t} title="Done" onPress={onClose} />
          </>}
        </ScrollView>

        <Modal visible={why} animationType="slide" onRequestClose={() => setWhy(false)}>
          <AppShell theme={theme}>
            <ScrollView contentContainerStyle={styles.page}>
              <Header t={t} title="Why This Card?" subtitle="Deterministic result from verified financial rules plus explicit merchant context." />
              {best && bestCard && <CardVisual t={t} card={bestCard} compact />}
              {best && <Glass t={t}>
                <Text style={{ color: t.text, fontWeight: '900' }}>{rewardLabel(best)}</Text>
                {best.estimatedEquivalentPercent != null ? <Text style={{ color: CYAN, marginTop: 6 }}>SwipeWise estimated equivalent: {best.estimatedEquivalentPercent.toFixed(2)}%</Text> : <Text style={{ color: '#e8aa2e', marginTop: 6 }}>No cash-equivalent point value is being assumed.</Text>}
                <Text style={{ color: t.secondary, marginTop: 7 }}>Rule: {best.primaryRule?.category || 'Base'}{best.primaryRule?.merchant_pattern ? ` • ${best.primaryRule.merchant_pattern}` : ''}</Text>
                <Text style={{ color: t.secondary, marginTop: 5 }}>Last verified: {verifiedDate(best.verifiedAt)}</Text>
                {best.reasonCodes.map((code) => <Text key={code} style={{ color: t.secondary, marginTop: 5 }}>• {code.replaceAll('_', ' ').toLowerCase()}</Text>)}
              </Glass>}
              {merchant ? <Glass t={t}><Text style={{ color: t.text, fontWeight: '800' }}>Merchant evidence passed to the engine</Text>{merchantEvidence.map((line) => <Text key={line} style={{ color: t.secondary, marginTop: 5 }}>• {line}</Text>)}</Glass> : null}
              <Text style={[styles.sectionTitle, { color: t.text }]}>Ranked Alternatives</Text>
              {ranked.map((candidate, index) => <Glass key={candidate.cardSlug} t={t}><DetailRow t={t} a={`#${index + 1} ${candidate.cardName}`} b={rewardLabel(candidate)} />{candidate.warningCodes.slice(0, 2).map((code) => <Text key={code} style={{ color: '#e8aa2e', fontSize: 11, marginTop: 4 }}>⚠ {warningText(code)}</Text>)}</Glass>)}
              <Button t={t} title="Back" onPress={() => setWhy(false)} />
            </ScrollView>
          </AppShell>
        </Modal>
      </AppShell>
    </Modal>
  );
}

function BigChoice({ t, title, subtitle, onPress }) {
  return <Pressable onPress={onPress}><Glass t={t} style={{ minHeight: 120, justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: CYAN, fontSize: 28 }}>▣</Text><Text style={{ color: t.text, fontWeight: '900', fontSize: 18, marginTop: 8 }}>{title}</Text><Text style={{ color: t.secondary, marginTop: 4 }}>{subtitle}</Text></Glass></Pressable>;
}

function Home({ t, userName, purchases, onQuick, onHistory }) {
  const totalSpend = purchases.reduce((s, p) => s + (p.amount || 0), 0);
  const totalRewards = purchases.reduce((s, p) => s + (p.reward || 0), 0);
  return <ScrollView contentContainerStyle={styles.tabPage}>
    <View style={styles.homeTop}><View style={{ flex: 1 }}><Text style={[styles.h1, { color: t.text }]}>Good morning, {userName} 👋</Text><Text style={[styles.sub, { color: t.secondary }]}>Here's your SwipeWise overview</Text></View><Logo t={t} compact /></View>
    <DemoBanner t={t} />
    <Pressable onPress={onQuick}><Glass t={t} style={styles.quickCard}><Text style={{ color: CYAN, fontSize: 25 }}>⚡</Text><View style={{ flex: 1 }}><Text style={{ color: t.text, fontWeight: '900' }}>Find My Best Card</Text><Text style={{ color: t.secondary, fontSize: 12 }}>Quick Swipe</Text></View><Text style={{ color: t.secondary, fontSize: 24 }}>›</Text></Glass></Pressable>
    <View style={{ flexDirection: 'row', gap: 10 }}><Stat t={t} title="Total Spent" value={money(totalSpend)} accent={t.text} /><Stat t={t} title="Est. Rewards" value={money(totalRewards)} accent={GREEN} /></View>
    <Glass t={t}>
      <Text style={[styles.sectionTitle, { color: t.text }]}>Recent Purchases</Text>
      {!purchases.length ? <Text style={{ color: t.secondary }}>No purchases yet. Use Quick Swipe and log your first one.</Text> : purchases.slice(0, 4).map((p) => <View key={p.id} style={styles.purchaseRow}><View style={{ flex: 1 }}><Text style={{ color: t.text, fontWeight: '800' }}>{p.merchant}</Text><Text style={{ color: t.secondary, fontSize: 11 }}>{p.category}</Text></View><Text style={{ color: t.text }}>{p.amount ? money(p.amount) : '—'}</Text></View>)}
      {!!purchases.length && <Pressable onPress={onHistory}><Text style={{ color: CYAN, fontWeight: '800', marginTop: 12 }}>View History</Text></Pressable>}
    </Glass>
  </ScrollView>;
}

function Wallet({ t, wallet, catalog, selectedIds, onAddCard, onRemoveCard }) {
  const [detail, setDetail] = useState(null);
  const [adding, setAdding] = useState(false);
  const [busyCardId, setBusyCardId] = useState(null);

  const add = async (cardId) => {
    if (selectedIds.includes(cardId) || busyCardId) return;
    setBusyCardId(cardId);
    try {
      await onAddCard(cardId);
    } catch (error) {
      Alert.alert('Could not add card', error.message || 'Please try again.');
    } finally {
      setBusyCardId(null);
    }
  };

  const remove = async (cardId) => {
    if (busyCardId) return;
    setBusyCardId(cardId);
    try {
      await onRemoveCard(cardId);
      setDetail(null);
    } catch (error) {
      Alert.alert('Could not remove card', error.message || 'Please try again.');
    } finally {
      setBusyCardId(null);
    }
  };

  return <ScrollView contentContainerStyle={styles.tabPage}>
    <Header t={t} title="My Cards" subtitle={`${wallet.length} cards in your wallet`} />
    {!wallet.length ? <Glass t={t}><Text style={{ color: t.secondary }}>No cards in your wallet yet. Add at least one verified card product before using Quick Swipe.</Text></Glass> : null}
    {wallet.map((c) => <Pressable key={c.id} onPress={() => setDetail(c)}><CardVisual t={t} card={c} compact /></Pressable>)}
    <Button t={t} title="Add Card" onPress={() => setAdding(true)} />
    <Modal visible={adding} animationType="slide" onRequestClose={() => setAdding(false)}>
      <View style={{ flex: 1, backgroundColor: t.bg }}>
        <ScrollView contentContainerStyle={styles.page}>
          <Header t={t} title="Add Card" subtitle="Select the exact active verified Supabase product you own." />
          {catalog.map((c) => <RowButton key={c.id} t={t} title={c.name} subtitle={busyCardId === c.id ? 'Saving…' : `${c.network} • verified ${verifiedDate(c.verifiedAt)}`} selected={selectedIds.includes(c.id)} onPress={() => add(c.id)} />)}
          <Button t={t} title="Done" onPress={() => setAdding(false)} />
        </ScrollView>
      </View>
    </Modal>
    <Modal visible={!!detail} animationType="slide" onRequestClose={() => setDetail(null)}>
      {detail && <CardDetails t={t} card={detail} onClose={() => setDetail(null)} onRemove={() => remove(detail.id)} />}
    </Modal>
  </ScrollView>;
}

function CardDetails({ t, card, onClose, onRemove }) {
  const sortedRules = [...(card.rewardRules || [])].sort((a, b) => (a.category || '').localeCompare(b.category || '') || (a.merchant_pattern || '').localeCompare(b.merchant_pattern || ''));
  return <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}><ScrollView contentContainerStyle={styles.page}>
    <Header t={t} title={card.name} subtitle={card.bank} />
    <CardVisual t={t} card={card} />
    <Glass t={t}>
      <DetailRow t={t} a="Network" b={card.network} />
      <DetailRow t={t} a="Annual Fee" b={card.annualFee == null ? 'Not available' : money(card.annualFee)} />
      <DetailRow t={t} a="Verification" b={card.verificationStatus} />
      <DetailRow t={t} a="Last verified" b={verifiedDate(card.verifiedAt)} />
    </Glass>
    <Glass t={t}>
      <Text style={[styles.sectionTitle, { color: t.text }]}>Verified Reward Rules</Text>
      {sortedRules.length ? sortedRules.map((rule) => <View key={rule.id} style={{ marginVertical: 5 }}><DetailRow t={t} a={`${rule.category}${rule.merchant_pattern ? ` • ${rule.merchant_pattern}` : ''}`} b={rule.reward_kind === 'cashback' ? `${rule.rate}%` : `${rule.rate}× ${friendlyRewardCurrency(rule.reward_currency)}`} />{rule.spend_cap != null ? <Text style={{ color: t.secondary, fontSize: 11 }}>Cap: {money(rule.spend_cap)}{rule.post_cap_rate != null ? ` • then ${rule.post_cap_rate}${rule.reward_kind === 'cashback' ? '%' : '×'}` : ''}</Text> : null}</View>) : <Text style={{ color: t.secondary }}>No verified reward rules are readable.</Text>}
    </Glass>
    <Glass t={t}>
      <Text style={[styles.sectionTitle, { color: t.text }]}>Verified Benefits</Text>
      {(card.benefits || []).length ? card.benefits.map((benefit) => <View key={benefit.id} style={{ marginVertical: 5 }}><Text style={{ color: t.text, fontWeight: '800' }}>{benefit.details || benefit.benefit_type}</Text>{benefit.coverage_limit ? <Text style={{ color: t.secondary, marginTop: 2 }}>{benefit.coverage_limit}</Text> : null}</View>) : <Text style={{ color: t.secondary }}>No verified benefits are readable.</Text>}
    </Glass>
    <Text style={{ color: t.secondary, fontSize: 11 }}>Issuer/source terms govern. Coverage limits are metadata, not recommendation dollars.</Text>
    <Button t={t} title="Remove Card" secondary onPress={onRemove} /><Button t={t} title="Back" onPress={onClose} />
  </ScrollView></SafeAreaView>;
}

function DetailRow({ t, a, b }) { return <View style={styles.detailRow}><Text style={{ color: t.secondary }}>{a}</Text><Text style={{ color: t.text, fontWeight: '800', textAlign: 'right', flex: 1 }}>{b}</Text></View>; }

function Insights({ t, purchases, wallet, catalog }) {
  const [sub, setSub] = useState('Overview');
  const totalSpend = purchases.reduce((s, p) => s + (p.amount || 0), 0);
  const totalRewards = purchases.reduce((s, p) => s + (p.reward || 0), 0);
  const byCat = categories.map((c) => ({ c, v: purchases.filter((p) => p.category === c).reduce((s, p) => s + (p.amount || 0), 0) })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
  const topCat = byCat[0]?.c || 'Groceries';
  const candidate = catalog.find((c) => !wallet.some((w) => w.id === c.id)) || catalog[catalog.length - 1];
  return <ScrollView contentContainerStyle={styles.tabPage}>
    <Header t={t} title="Insights" subtitle="Your SwipeWise overview" />
    <View style={styles.segment}>{['Overview', 'Spending', 'Rewards', 'Impact', 'Recommend'].map((x) => <Pressable key={x} onPress={() => setSub(x)} style={[styles.segmentItem, sub === x && { backgroundColor: BLUE }]}><Text style={{ color: sub === x ? 'white' : t.secondary, fontSize: 11, fontWeight: '800' }}>{x}</Text></Pressable>)}</View>
    {sub === 'Overview' && <><View style={{ flexDirection: 'row', gap: 10 }}><Stat t={t} title="Total Spend" value={money(totalSpend)} /><Stat t={t} title="Rewards" value={money(totalRewards)} accent={GREEN} /></View><Glass t={t}><Text style={[styles.sectionTitle, { color: t.text }]}>Top Categories</Text>{byCat.length ? byCat.slice(0, 5).map((x) => <DetailRow key={x.c} t={t} a={x.c} b={money(x.v)} />) : <Text style={{ color: t.secondary }}>Log purchases to build your insights.</Text>}</Glass></>}
    {sub === 'Spending' && <><Header t={t} title="Spending Trends" subtitle="Based only on purchases you choose to log." />{byCat.length ? byCat.map((x) => <Glass key={x.c} t={t}><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: t.text, fontWeight: '800' }}>{x.c}</Text><Text style={{ color: CYAN }}>{money(x.v)}</Text></View><View style={[styles.barBg, { backgroundColor: t.input }]}><View style={[styles.barFill, { width: `${Math.max(8, Math.min(100, (x.v / (byCat[0]?.v || 1)) * 100))}%` }]} /></View></Glass>) : <Glass t={t}><Text style={{ color: t.secondary }}>No spending data yet.</Text></Glass>}</>}
    {sub === 'Rewards' && <><Text style={[styles.rewardBig, { color: GREEN }]}>{money(totalRewards)}</Text>{wallet.map((c) => <Glass key={c.id} t={t}><DetailRow t={t} a={c.name} b={money(purchases.filter((p) => p.usedCardId === c.id).reduce((s, p) => s + (p.reward || 0), 0))} /></Glass>)}<DemoBanner t={t} /></>}
    {sub === 'Impact' && <><Glass t={t}><Text style={{ color: t.secondary, textAlign: 'center' }}>You've earned</Text><Text style={[styles.rewardBig, { color: t.text }]}>{money(totalRewards)}</Text><Text style={{ color: t.secondary, textAlign: 'center' }}>in estimated rewards from logged purchases</Text></Glass><View style={{ flexDirection: 'row', gap: 10 }}><Stat t={t} title="Optimized Purchases" value={`${purchases.filter((p) => p.followed).length}`} /><Stat t={t} title="Logged Purchases" value={`${purchases.length}`} /></View></>}
    {sub === 'Recommend' && <><Glass t={t}><Text style={[styles.sectionTitle, { color: t.text }]}>Future recommendation area</Text><Text style={{ color: t.secondary }}>New-card recommendations are intentionally separate from checkout ranking and are not implemented in this Chat 06 milestone.</Text></Glass>{candidate ? <CardVisual t={t} card={candidate} compact /> : null}</>}
  </ScrollView>;
}

function HistoryModal({ theme, purchases, wallet, catalog, onClose }) {
  const t = makeTheme(theme);
  const [selected, setSelected] = useState(null);
  const getCard = (id) => catalog.find((c) => c.id === id)?.name || 'Card';
  return <Modal visible animationType="slide" onRequestClose={onClose}><AppShell theme={theme}><ScrollView contentContainerStyle={styles.page}><Header t={t} title={selected ? 'Purchase Detail' : 'History'} />{!selected ? purchases.map((p) => <RowButton key={p.id} t={t} title={p.merchant} subtitle={`${new Date(p.date).toLocaleDateString()} • ${p.category}`} icon={p.amount ? money(p.amount) : '›'} onPress={() => setSelected(p)} />) : <><Header t={t} title={selected.merchant} subtitle={`${new Date(selected.date).toLocaleString()} • ${selected.mode}`} /><Glass t={t}><DetailRow t={t} a="Amount" b={selected.amount ? money(selected.amount) : 'Not entered'} /><DetailRow t={t} a="Category" b={selected.category} /><DetailRow t={t} a="Recommended" b={getCard(selected.recommendedCardId)} /><DetailRow t={t} a="Card used" b={getCard(selected.usedCardId)} /><DetailRow t={t} a="Est. reward" b={selected.reward == null ? 'Not estimated' : money(selected.reward)} /><DetailRow t={t} a="Followed recommendation" b={selected.followed ? 'Yes' : 'No'} /></Glass>{selected.notes ? <Glass t={t}><Text style={{ color: t.text }}>{selected.notes}</Text></Glass> : null}<Button t={t} title="Back to History" secondary onPress={() => setSelected(null)} /></>}<Button t={t} title="Done" onPress={onClose} /></ScrollView></AppShell></Modal>;
}

function Settings({
  t,
  appearance,
  onAppearanceChange,
  userName,
  rewardPreference,
  onRewardPreferenceChange,
  onClear,
  onSignOut,
}) {
  const [page, setPage] = useState('Settings');
  const [notifs, setNotifs] = useState({ alerts: true, recs: true, summary: true, updates: true, marketing: false });
  const back = () => setPage('Settings');

  if (page !== 'Settings') return <ScrollView contentContainerStyle={styles.tabPage}>
    <Pressable onPress={back}><Text style={{ color: CYAN, fontWeight: '800' }}>‹ Settings</Text></Pressable>
    <Header t={t} title={page} />
    {page === 'Profile' && <>
      <Text style={styles.avatar}>●</Text>
      <Text style={[styles.bigCenter, { color: t.text }]}>{userName}</Text>
      <Text style={[styles.tagline, { color: t.secondary }]}>Supabase account</Text>
      {['Personal Info', 'Communication', 'Security'].map((x) => <RowButton key={x} t={t} title={x} onPress={() => {}} />)}
      <Button t={t} title="Sign Out" secondary onPress={onSignOut} />
    </>}
    {page === 'Appearance & Text' && <>
      {['system', 'light', 'dark'].map((x) => <RowButton key={x} t={t} title={x[0].toUpperCase() + x.slice(1)} selected={appearance === x} onPress={() => onAppearanceChange(x)} />)}
      <Glass t={t}><Text style={[styles.sectionTitle, { color: t.text }]}>Preview</Text><Logo t={t} compact /></Glass>
    </>}
    {page === 'Reward Preference' && <>
      {['Maximum Overall Value', 'Cashback', 'Travel Points'].map((p) => <RowButton key={p} t={t} title={p} selected={rewardPreference === p} onPress={() => onRewardPreferenceChange(p)} />)}
    </>}
    {page === 'Notifications' && <>
      {Object.entries(notifs).map(([k, v]) => <Glass key={k} t={t} style={styles.switchRow}><Text style={{ color: t.text, fontWeight: '700' }}>{({ alerts:'Purchase Alerts', recs:'New Recommendations', summary:'Monthly Summary', updates:'Rewards Updates', marketing:'Marketing Emails' })[k]}</Text><Switch value={v} onValueChange={(nv) => setNotifs((n) => ({ ...n, [k]: nv }))} /></Glass>)}
      <Text style={{ color: t.secondary, fontSize: 12 }}>Notification toggles are still local UI placeholders in this milestone. The database has a settings field ready for them.</Text>
    </>}
    {page === 'Data & Privacy' && <>
      <Glass t={t}><Text style={{ color: t.text, fontWeight: '800' }}>Location</Text><Text style={{ color: t.secondary, marginTop: 5 }}>Location is requested only when you tap Find Nearby Stores. Denying location keeps Search Merchant and Enter Manually available.</Text></Glass>
      <Glass t={t}><Text style={{ color: t.text }}>Your account, wallet selections, settings and logged purchases now sync through Supabase. SwipeWise still does not store full card numbers, CVV, PIN or expiry.</Text></Glass>
      <Button t={t} title="Clear Purchase History" secondary onPress={onClear} />
    </>}
    {page === 'Help & Support' && <>{['FAQ', 'Contact Us', 'Report an Issue', 'Video Tutorials'].map((x) => <RowButton key={x} t={t} title={x} onPress={() => {}} />)}<Text style={{ color: t.secondary }}>Support actions remain placeholders in this milestone.</Text></>}
    {page === 'About SwipeWise' && <><View style={{ minHeight: 70 }} /><Logo t={t} /><Text style={[styles.tagline, { color: t.secondary }]}>Version 0.3.0\nExpo React Native + Supabase + verified recommendation engine</Text></>}
    {page === 'Action Button' && <><Glass t={t}><Text style={{ color: t.text, fontWeight: '800' }}>Quick Swipe shortcut</Text><Text style={{ color: t.secondary, marginTop: 5 }}>Native iPhone Action Button/App Intents require a native iOS build. This backend milestone leaves that feature unchanged.</Text></Glass></>}
    {page === 'Data & Sync' && <><Glass t={t}><Text style={{ color: t.text, fontWeight: '800' }}>Supabase connected</Text><Text style={{ color: t.secondary, marginTop: 5 }}>Authentication sessions, wallet selections, settings and purchase history use your Supabase development project. Checkout recommendations now consume active verified Supabase card products, reward rules and benefits. Point cash-equivalent values remain separate estimates and are not invented.</Text></Glass></>}
  </ScrollView>;

  return <ScrollView contentContainerStyle={styles.tabPage}><Header t={t} title="Settings" />
    <Text style={[styles.sectionLabel, { color: t.secondary }]}>ACCOUNT</Text><RowButton t={t} title="Profile" onPress={() => setPage('Profile')} />
    <Text style={[styles.sectionLabel, { color: t.secondary }]}>PREFERENCES</Text><RowButton t={t} title="Appearance & Text" onPress={() => setPage('Appearance & Text')} /><RowButton t={t} title="Reward Preference" onPress={() => setPage('Reward Preference')} />
    <Text style={[styles.sectionLabel, { color: t.secondary }]}>SWIPEWISE</Text><RowButton t={t} title="Action Button" onPress={() => setPage('Action Button')} /><RowButton t={t} title="Notifications" onPress={() => setPage('Notifications')} /><RowButton t={t} title="Data & Sync" onPress={() => setPage('Data & Sync')} />
    <Text style={[styles.sectionLabel, { color: t.secondary }]}>PRIVACY & SUPPORT</Text><RowButton t={t} title="Data & Privacy" onPress={() => setPage('Data & Privacy')} /><RowButton t={t} title="Help & Support" onPress={() => setPage('Help & Support')} /><RowButton t={t} title="About SwipeWise" onPress={() => setPage('About SwipeWise')} />
  </ScrollView>;
}

function TabBar({ t, tab, setTab }) {
  return <View style={[styles.tabBar, { backgroundColor: t.bg2, borderColor: t.border }]}>{[['Home','⌂'],['Wallet','▣'],['Insights','⌁'],['Settings','⚙']].map(([name, icon]) => <Pressable key={name} onPress={() => setTab(name)} style={styles.tabBtn}><Text style={{ color: tab === name ? CYAN : t.secondary, fontSize: 20 }}>{icon}</Text><Text style={{ color: tab === name ? CYAN : t.secondary, fontSize: 10, fontWeight: '800' }}>{name}</Text></Pressable>)}</View>;
}

function MainApp({
  theme,
  appearance,
  onAppearanceChange,
  userName,
  selectedIds,
  rewardPreference,
  onRewardPreferenceChange,
  purchases,
  onAddCard,
  onRemoveCard,
  onSavePurchase,
  onClearPurchases,
  onSignOut,
  catalog,
  referenceMeta,
}) {
  const t = makeTheme(theme);
  const [tab, setTab] = useState('Home');
  const [quick, setQuick] = useState(false);
  const [history, setHistory] = useState(false);
  const wallet = catalog.filter((c) => selectedIds.includes(c.id));

  const openQuickSwipe = () => {
    if (!wallet.length) {
      Alert.alert('Add a card first', 'SwipeWise can only recommend cards that are in your wallet.');
      setTab('Wallet');
      return;
    }
    setQuick(true);
  };

  return <AppShell theme={theme}>
    <View style={{ flex: 1 }}>
      {tab === 'Home' && <Home t={t} userName={userName} purchases={purchases} onQuick={openQuickSwipe} onHistory={() => setHistory(true)} />}
      {tab === 'Wallet' && <Wallet t={t} wallet={wallet} catalog={catalog} selectedIds={selectedIds} onAddCard={onAddCard} onRemoveCard={onRemoveCard} />}
      {tab === 'Insights' && <Insights t={t} purchases={purchases} wallet={wallet} catalog={catalog} />}
      {tab === 'Settings' && <Settings t={t} appearance={appearance} onAppearanceChange={onAppearanceChange} userName={userName} rewardPreference={rewardPreference} onRewardPreferenceChange={onRewardPreferenceChange} onClear={onClearPurchases} onSignOut={onSignOut} />}
      <TabBar t={t} tab={tab} setTab={setTab} />
    </View>
    {quick && <QuickSwipe theme={theme} wallet={wallet} rewardPreference={rewardPreference} purchases={purchases} referenceMeta={referenceMeta} onClose={() => setQuick(false)} onSave={onSavePurchase} />}
    {history && <HistoryModal theme={theme} purchases={purchases} wallet={wallet} catalog={catalog} onClose={() => setHistory(false)} />}
  </AppShell>;
}

export default function App() {
  const systemColorScheme = useColorScheme();
  const [splash, setSplash] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [referenceLoading, setReferenceLoading] = useState(true);
  const [referenceData, setReferenceData] = useState(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [backendError, setBackendError] = useState('');
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [appearance, setAppearance] = useState('system');
  const [userName, setUserName] = useState('SwipeWise User');
  const [selectedIds, setSelectedIds] = useState([]);
  const [rewardPreference, setRewardPreference] = useState('Maximum Overall Value');
  const [purchases, setPurchases] = useState([]);

  const theme = appearance === 'system'
    ? (systemColorScheme === 'light' ? 'light' : 'dark')
    : appearance;

  useEffect(() => {
    if (!supabase) {
      setReferenceLoading(false);
      return;
    }
    let mounted = true;
    getVerifiedReferenceData()
      .then((data) => { if (mounted) setReferenceData(data); })
      .catch((error) => { if (mounted) setBackendError(error.message || 'Could not load verified card reference data.'); })
      .finally(() => { if (mounted) setReferenceLoading(false); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return undefined;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) setBackendError(error.message);
      setSession(data?.session || null);
      setAuthLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setAuthLoading(false);
      setBackendError('');
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const hydrateUser = async (userId) => {
    setBackendError('');
    setDataLoading(true);
    try {
      const [{ profile: nextProfile, settings }, walletSlugs, history] = await Promise.all([
        getProfileAndSettings(userId),
        getWalletCardSlugs(userId),
        getPurchases(userId),
      ]);

      setProfile(nextProfile);
      setUserName(nextProfile.display_name || 'SwipeWise User');
      setSelectedIds(walletSlugs);
      setRewardPreference(rewardPreferenceFromDb(settings.reward_preference));
      setAppearance(settings.appearance || 'system');
      setPurchases(history);
    } catch (error) {
      setBackendError(error.message || 'Could not load your SwipeWise data.');
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    if (!session?.user?.id) {
      setProfile(null);
      setUserName('SwipeWise User');
      setSelectedIds([]);
      setRewardPreference('Maximum Overall Value');
      setPurchases([]);
      return;
    }
    hydrateUser(session.user.id);
  }, [session?.user?.id]);

  const finishOnboarding = async ({ selectedIds: setupIds, rewardPreference: preference, appearance: selectedAppearance, displayName }) => {
    if (!session?.user?.id) throw new Error('Your Supabase session is missing. Please sign in again.');
    if (!setupIds.length) throw new Error('Add at least one card before finishing setup.');

    await syncWallet(session.user.id, setupIds);
    const nextProfile = await completeOnboarding(session.user.id, {
      displayName: displayName || userName,
      rewardPreference: preference,
      appearance: selectedAppearance,
    });

    setSelectedIds(setupIds);
    setRewardPreference(preference);
    setAppearance(selectedAppearance);
    setProfile(nextProfile);
  };

  const handleAddCard = async (cardId) => {
    if (!session?.user?.id) throw new Error('Please sign in again.');
    await addWalletCard(session.user.id, cardId);
    setSelectedIds((ids) => ids.includes(cardId) ? ids : [...ids, cardId]);
  };

  const handleRemoveCard = async (cardId) => {
    if (!session?.user?.id) throw new Error('Please sign in again.');
    await removeWalletCard(session.user.id, cardId);
    setSelectedIds((ids) => ids.filter((id) => id !== cardId));
  };

  const handleSavePurchase = async (purchase) => {
    if (!session?.user?.id) throw new Error('Please sign in again.');
    const saved = await createPurchase(session.user.id, purchase);
    setPurchases((old) => [saved, ...old]);
    return saved;
  };

  const handleRewardPreferenceChange = async (value) => {
    if (!session?.user?.id) return;
    const previous = rewardPreference;
    setRewardPreference(value);
    try {
      await updateUserSettings(session.user.id, { reward_preference: rewardPreferenceToDb(value) });
    } catch (error) {
      setRewardPreference(previous);
      Alert.alert('Could not save preference', error.message || 'Please try again.');
    }
  };

  const handleAppearanceChange = async (value) => {
    const previous = appearance;
    setAppearance(value);
    if (!session?.user?.id) return;
    try {
      await updateUserSettings(session.user.id, { appearance: value });
    } catch (error) {
      setAppearance(previous);
      Alert.alert('Could not save appearance', error.message || 'Please try again.');
    }
  };

  const handleClearPurchases = async () => {
    if (!session?.user?.id) return;
    try {
      await clearPurchases(session.user.id);
      setPurchases([]);
    } catch (error) {
      Alert.alert('Could not clear history', error.message || 'Please try again.');
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      Alert.alert('Could not sign out', error.message || 'Please try again.');
    }
  };

  if (!isSupabaseConfigured) return <BackendSetupRequired theme={theme} />;
  if (splash) return <Splash theme={theme} onDone={() => setSplash(false)} />;
  if (authLoading || dataLoading || referenceLoading) return <LoadingScreen theme={theme} message="Loading verified SwipeWise data…" />;
  if (backendError) return <BackendProblem theme={theme} message={backendError} onRetry={() => session?.user?.id ? hydrateUser(session.user.id) : setBackendError('')} onSignOut={session ? handleSignOut : null} />;
  // A signed-in user should never render onboarding until their profile/settings have hydrated.
  if (session && !profile) return <LoadingScreen theme={theme} />;

  if (!session || !profile?.onboarding_completed) {
    return <Onboarding
      theme={theme}
      appearance={appearance}
      onAppearanceChange={handleAppearanceChange}
      session={session}
      onFinish={finishOnboarding}
      userName={userName}
      setUserName={setUserName}
      selectedIds={selectedIds}
      setSelectedIds={setSelectedIds}
      rewardPreference={rewardPreference}
      setRewardPreference={setRewardPreference}
      catalog={referenceData?.cards || []}
    />;
  }

  return <MainApp
    theme={theme}
    appearance={appearance}
    onAppearanceChange={handleAppearanceChange}
    userName={userName}
    selectedIds={selectedIds}
    rewardPreference={rewardPreference}
    onRewardPreferenceChange={handleRewardPreferenceChange}
    purchases={purchases}
    onAddCard={handleAddCard}
    onRemoveCard={handleRemoveCard}
    onSavePurchase={handleSavePurchase}
    onClearPurchases={handleClearPurchases}
    onSignOut={handleSignOut}
    catalog={referenceData?.cards || []}
    referenceMeta={referenceData || {}}
  />;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  glow: { position: 'absolute', width: 320, height: 320, borderRadius: 999, top: -180, right: -120 },
  page: { flexGrow: 1, padding: 20, gap: 13, maxWidth: 560, width: '100%', alignSelf: 'center' },
  tabPage: { padding: 18, paddingBottom: 105, gap: 13, maxWidth: 620, width: '100%', alignSelf: 'center' },
  centerPage: { flex: 1, padding: 26, alignItems: 'center' },
  logoS: { fontWeight: '900', color: CYAN, letterSpacing: -5, textShadowColor: BLUE, textShadowRadius: 18 },
  logoText: { fontSize: 24, fontWeight: '900' },
  tagline: { textAlign: 'center', lineHeight: 21, marginTop: 6 },
  pill: { width: 55, height: 3, borderRadius: 4, backgroundColor: CYAN, marginBottom: 25 },
  h1: { fontSize: 24, fontWeight: '900' },
  sub: { fontSize: 13, lineHeight: 19 },
  bigCenter: { fontSize: 25, fontWeight: '900', textAlign: 'center', marginTop: 8 },
  tiny: { fontSize: 10, lineHeight: 15, textAlign: 'center' },
  glass: { borderWidth: 1, borderRadius: 18, padding: 15, overflow: 'hidden' },
  rowCard: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 58 },
  button: { minHeight: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, paddingHorizontal: 14 },
  input: { minHeight: 52, borderRadius: 13, borderWidth: 1, paddingHorizontal: 14, fontSize: 16 },
  how: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  howNum: { width: 32, height: 32, borderRadius: 10, backgroundColor: BLUE, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontWeight: '900', fontSize: 16, marginBottom: 8 },
  sectionLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1, marginTop: 5 },
  locationIcon: { color: CYAN, fontSize: 120, textAlign: 'center', marginTop: 40, textShadowColor: BLUE, textShadowRadius: 24 },
  actionCircle: { width: 190, height: 190, borderRadius: 100, borderWidth: 1, borderColor: CYAN, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginTop: 24 },
  complete: { fontSize: 100, color: CYAN, textAlign: 'center', fontWeight: '300', textShadowColor: CYAN, textShadowRadius: 20 },
  cardVisual: { width: '100%', borderRadius: 18, padding: 17, overflow: 'hidden' },
  cardShine: { position: 'absolute', width: 180, height: 180, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.12)', right: -75, top: -90 },
  cardBank: { color: 'white', fontSize: 12, fontWeight: '800' },
  cardName: { color: 'white', fontSize: 18, fontWeight: '900', marginTop: 6, maxWidth: '82%' },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardLast: { color: 'white', fontSize: 12, fontWeight: '700' },
  cardNetwork: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '800' },
  demo: { borderWidth: 1, borderRadius: 11, padding: 9, backgroundColor: 'rgba(217,156,33,0.07)' },
  modalTop: { minHeight: 52, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.64)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '84%', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20 },
  quickCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  homeTop: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  purchaseRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(120,160,190,0.25)' },
  detailRow: { flexDirection: 'row', gap: 16, justifyContent: 'space-between', paddingVertical: 7 },
  segment: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  segmentItem: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(100,150,180,0.12)' },
  barBg: { height: 8, borderRadius: 10, overflow: 'hidden', marginTop: 10 },
  barFill: { height: '100%', borderRadius: 10, backgroundColor: BLUE },
  rewardBig: { fontSize: 42, fontWeight: '900', textAlign: 'center', marginVertical: 18 },
  avatar: { color: CYAN, fontSize: 90, textAlign: 'center', lineHeight: 92 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tabBar: { position: 'absolute', left: 0, right: 0, bottom: 0, minHeight: 76, borderTopWidth: 1, flexDirection: 'row', paddingBottom: Platform.OS === 'ios' ? 15 : 7, paddingTop: 7 },
  tabBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
});