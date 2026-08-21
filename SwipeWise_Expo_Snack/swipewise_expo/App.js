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
} from 'react-native';

const BLUE = '#0798ff';
const CYAN = '#35d8ff';
const GREEN = '#2ee6a6';
const RED = '#ff6b7a';

const categories = [
  'Groceries', 'Gas', 'Dining / Restaurants', 'Shopping', 'Electronics', 'Travel',
  'Flight Ticket', 'Hotel', 'Rental Car', 'Pharmacy', 'Beauty', 'Clothing',
  'Home', 'Subscriptions', 'Other',
];

const cards = [
  {
    id: 'cibc-costco', bank: 'CIBC', name: 'Costco Mastercard', network: 'Mastercard', last4: '1234', fee: 0, accent: '#B51225',
    benefits: ['Purchase protection', 'Extended warranty'],
    rules: {
      Gas: ['cashback', 3, 1], 'Dining / Restaurants': ['cashback', 3, 1], Groceries: ['cashback', 1, 1],
      Shopping: ['cashback', 1, 1], Electronics: ['cashback', 1, 1], Other: ['cashback', 1, 1],
    },
  },
  {
    id: 'cibc-aventura', bank: 'CIBC', name: 'Aventura Visa', network: 'Visa', last4: '1134', fee: 139, accent: '#0071C8',
    benefits: ['Flight delay insurance', 'Lost baggage coverage', 'Trip interruption coverage', 'Rental vehicle coverage', 'Purchase protection'],
    rules: {
      Travel: ['points', 2, 1.15], 'Flight Ticket': ['points', 2, 1.15], Hotel: ['points', 2, 1.15],
      'Rental Car': ['points', 2, 1.15], Other: ['points', 1, 1.15],
    },
  },
  {
    id: 'td-aeroplan', bank: 'TD', name: 'Aeroplan Visa Infinite', network: 'Visa', last4: '5678', fee: 139, accent: '#138A65',
    benefits: ['Travel insurance', 'Purchase protection'],
    rules: {
      Groceries: ['points', 1.5, 1.6], Gas: ['points', 1.5, 1.6], 'Flight Ticket': ['points', 1.5, 1.6], Other: ['points', 1, 1.6],
    },
  },
  {
    id: 'rbc-avion', bank: 'RBC', name: 'Avion Visa Infinite', network: 'Visa', last4: '9012', fee: 120, accent: '#1E5FC4',
    benefits: ['Travel insurance', 'Purchase security'],
    rules: { Travel: ['points', 1.25, 1.5], Shopping: ['points', 1, 1.5], Other: ['points', 1, 1.5] },
  },
  {
    id: 'amex-cobalt', bank: 'American Express', name: 'Cobalt Card', network: 'American Express', last4: '4455', fee: 155.88, accent: '#247EB5',
    benefits: ['Mobile device insurance', 'Purchase protection', 'Travel accident coverage'],
    rules: { Groceries: ['points', 5, 1], 'Dining / Restaurants': ['points', 5, 1], Travel: ['points', 2, 1], Other: ['points', 1, 1] },
  },
];

const nearbyMerchants = [
  ['Costco', '0.4 km', ['Groceries', 'Gas', 'Pharmacy', 'Electronics', 'Dining / Restaurants', 'Other']],
  ['Walmart Supercentre', '0.7 km', ['Groceries', 'Electronics', 'Home', 'Clothing', 'Other']],
  ['Best Buy', '1.2 km', ['Electronics', 'Shopping', 'Other']],
  ['Shoppers Drug Mart', '1.6 km', ['Pharmacy', 'Beauty', 'Groceries', 'Electronics', 'Other']],
  ['Shell', '2.1 km', ['Gas', 'Shopping', 'Other']],
].map((m, i) => ({ id: `near-${i}`, name: m[0], subtitle: m[1], categories: m[2] }));

const onlineMerchants = [
  ['Amazon.ca', ['Electronics', 'Home', 'Clothing', 'Groceries', 'Shopping', 'Other']],
  ['Walmart.ca', ['Groceries', 'Electronics', 'Home', 'Clothing', 'Other']],
  ['BestBuy.ca', ['Electronics', 'Shopping', 'Other']],
  ['Apple', ['Electronics', 'Shopping', 'Other']],
  ['Air Canada', ['Flight Ticket', 'Travel', 'Other']],
  ['WestJet', ['Flight Ticket', 'Travel', 'Other']],
].map((m, i) => ({ id: `online-${i}`, name: m[0], subtitle: 'Online', categories: m[1] }));

const shouldAskAmount = (category) => ['Electronics', 'Flight Ticket', 'Travel', 'Rental Car', 'Hotel'].includes(category);
const money = (n) => `$${Number(n || 0).toFixed(2)}`;

function relevantBenefits(benefits, category) {
  const keys = category === 'Rental Car' ? ['rental', 'vehicle']
    : ['Flight Ticket', 'Travel', 'Hotel'].includes(category) ? ['travel', 'flight', 'baggage', 'trip', 'accident']
    : category === 'Electronics' ? ['warranty', 'purchase', 'device']
    : ['purchase', 'warranty'];
  return benefits.filter((b) => keys.some((k) => b.toLowerCase().includes(k))).slice(0, 4);
}

function rankCards(wallet, category, amount, preference) {
  return wallet.map((card) => {
    const rule = card.rules[category] || card.rules.Other;
    const [kind, rate, pointValue] = rule;
    const percent = kind === 'cashback' ? rate : rate * pointValue;
    const benefits = relevantBenefits(card.benefits, category);
    const reward = amount ? amount * percent / 100 : null;
    const benefitScore = preference === 'Cashback' ? 0 : benefits.length * 0.22;
    const bonus = preference === 'Cashback' ? (kind === 'cashback' ? 0.45 : -0.15)
      : preference === 'Travel Points' ? (kind === 'points' ? 0.45 : 0) : 0;
    return { card, kind, rate, percent, benefits, reward, score: percent + benefitScore + bonus };
  }).sort((a, b) => b.score - a.score);
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
        <Text style={styles.cardLast}>•••• {card.last4}</Text>
        <Text style={styles.cardNetwork}>{card.network}</Text>
      </View>
    </View>
  );
}

function DemoBanner({ t }) {
  return (
    <View style={[styles.demo, { borderColor: '#d99c21' }]}>
      <Text style={{ color: '#e8aa2e', fontSize: 11 }}>⚠ Prototype uses demo reward rates — do not use for real financial decisions yet.</Text>
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

function Onboarding({ theme, setTheme, onFinish, setUserName, selectedIds, setSelectedIds, rewardPreference, setRewardPreference }) {
  const t = makeTheme(theme);
  const [stage, setStage] = useState(0);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [setupIds, setSetupIds] = useState(selectedIds);

  const next = () => setStage((s) => s + 1);
  const toggleCard = (id) => setSetupIds((ids) => ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);

  return (
    <AppShell theme={theme}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        {stage === 0 && <>
          <View style={{ flex: 1, minHeight: 125 }} />
          <Logo t={t} />
          <Text style={[styles.bigCenter, { color: t.text }]}>Welcome to SwipeWise</Text>
          <Text style={[styles.tagline, { color: t.secondary }]}>Swipe smarter. Earn more.\nFind the right card for every purchase.</Text>
          <View style={{ flex: 1, minHeight: 90 }} />
          <Button t={t} title="Get Started" onPress={next} />
          <Button t={t} title="Sign In" secondary onPress={next} />
        </>}

        {stage === 1 && <>
          <Header t={t} title="Create Account" subtitle="Let's get started" />
          <Field t={t} value={name} onChangeText={setName} placeholder="Full Name" />
          <Field t={t} value={email} onChangeText={setEmail} placeholder="Email Address" keyboardType="email-address" />
          <Field t={t} value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry />
          <View style={{ flex: 1, minHeight: 120 }} />
          <Button t={t} title="Create Account" onPress={() => { setUserName(name.trim() || 'Ayan'); next(); }} />
          <Text style={[styles.tiny, { color: t.secondary }]}>Prototype authentication is local in this converted v0.1.</Text>
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
          <Header t={t} title="Add Your Cards" subtitle="Manually add the cards you own. We never ask for card numbers or CVV." />
          <Pressable onPress={next}>
            <Glass t={t} style={{ alignItems: 'center', paddingVertical: 32 }}>
              <Text style={{ color: CYAN, fontSize: 40 }}>＋</Text>
              <Text style={{ color: t.text, fontWeight: '800' }}>Add a Card</Text>
            </Glass>
          </Pressable>
          <Text style={{ color: t.secondary }}>{setupIds.length} card(s) selected</Text>
          <View style={{ flex: 1, minHeight: 120 }} />
          <Button t={t} title="Next" onPress={() => { if (!setupIds.length) setSetupIds([cards[0].id]); setStage(5); }} />
        </>}

        {stage === 4 && <>
          <Header t={t} title="Select Card Type" subtitle="Choose the type of card you want to add." />
          {['Credit Card', 'Debit Card', 'Prepaid Card', 'Store Card'].map((x) => <RowButton key={x} t={t} title={x} onPress={() => {}} />)}
          <Text style={[styles.sectionTitle, { color: t.text }]}>Card Catalog</Text>
          {cards.map((c) => <RowButton key={c.id} t={t} title={`${c.bank} ${c.name}`} subtitle={`•••• ${c.last4}`} selected={setupIds.includes(c.id)} onPress={() => toggleCard(c.id)} />)}
          <Button t={t} title="Done" onPress={() => setStage(3)} />
        </>}

        {stage === 5 && <>
          <Header t={t} title="Your Wallet" subtitle={`${Math.max(setupIds.length, 1)} Card Added!`} />
          {(setupIds.length ? cards.filter((c) => setupIds.includes(c.id)) : [cards[0]]).map((c) => <CardVisual key={c.id} t={t} card={c} compact />)}
          <View style={{ flex: 1, minHeight: 90 }} />
          <Button t={t} title="Continue" onPress={() => { setSelectedIds(setupIds.length ? setupIds : [cards[0].id]); next(); }} />
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
          <Text style={[styles.tagline, { color: t.secondary }]}>SwipeWise is ready to help you pay smarter.</Text>
          <View style={{ flex: 1, minHeight: 100 }} />
          <Button t={t} title="Start Using App" onPress={onFinish} />
          <Pressable onPress={() => setTheme(theme === 'dark' ? 'light' : 'dark')}><Text style={{ color: t.secondary, textAlign: 'center' }}>Preview {theme === 'dark' ? 'Light' : 'Dark'} Mode</Text></Pressable>
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

function QuickSwipe({ theme, wallet, rewardPreference, onClose, onSave }) {
  const t = makeTheme(theme);
  const [step, setStep] = useState('mode');
  const [mode, setMode] = useState(null);
  const [merchant, setMerchant] = useState(null);
  const [category, setCategory] = useState('Other');
  const [amountText, setAmountText] = useState('');
  const [usedCard, setUsedCard] = useState(null);
  const [notes, setNotes] = useState('');
  const [why, setWhy] = useState(false);
  const amount = Number(amountText.replace(/[^0-9.]/g, '')) || null;
  const ranked = useMemo(() => rankCards(wallet, category, amount, rewardPreference), [wallet, category, amountText, rewardPreference]);
  const best = ranked[0];

  const pickMerchant = (m) => { setMerchant(m); setStep('category'); };
  const pickCategory = (c) => { setCategory(c); setStep(shouldAskAmount(c) ? 'amount' : 'best'); };

  const save = () => {
    if (!best || !usedCard || !merchant) return;
    const r = ranked.find((x) => x.card.id === usedCard.id);
    onSave({
      id: `${Date.now()}`, date: new Date().toISOString(), mode, merchant: merchant.name, category,
      amount, recommendedCardId: best.card.id, usedCardId: usedCard.id,
      reward: r?.reward || 0, followed: usedCard.id === best.card.id, notes,
    });
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <AppShell theme={theme}>
        <View style={styles.modalTop}><Pressable onPress={onClose}><Text style={{ color: CYAN, fontWeight: '800' }}>Cancel</Text></Pressable><Text style={{ color: t.text, fontWeight: '900' }}>Quick Swipe</Text><View style={{ width: 46 }} /></View>
        <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
          {step === 'mode' && <>
            <Header t={t} title="Where are you making a purchase?" />
            <BigChoice t={t} title="In Store" subtitle="Find nearby stores" onPress={() => { setMode('In Store'); setStep('merchant'); }} />
            <BigChoice t={t} title="Online" subtitle="Choose an online merchant" onPress={() => { setMode('Online'); setStep('merchant'); }} />
          </>}

          {step === 'merchant' && <>
            <Header t={t} title={mode === 'In Store' ? 'Nearby Stores' : 'Where are you shopping?'} subtitle={mode === 'In Store' ? 'Demo nearby merchants' : 'Select an online merchant'} />
            {(mode === 'In Store' ? nearbyMerchants : onlineMerchants).map((m) => <RowButton key={m.id} t={t} title={m.name} subtitle={m.subtitle} onPress={() => pickMerchant(m)} />)}
            <RowButton t={t} title="Other (Enter Manually)" onPress={() => pickMerchant({ id: 'other', name: 'Other Merchant', subtitle: mode, categories })} />
          </>}

          {step === 'category' && <>
            <Header t={t} title="What are you buying today?" subtitle={merchant?.name} />
            {(merchant?.categories || categories).map((c) => <RowButton key={c} t={t} title={c} onPress={() => pickCategory(c)} />)}
          </>}

          {step === 'amount' && <>
            <Header t={t} title="How much is your purchase?" subtitle="Optional — this helps compare estimated reward value." />
            <Field t={t} value={amountText} onChangeText={setAmountText} placeholder="$ 0.00" keyboardType="decimal-pad" />
            <View style={{ flex: 1, minHeight: 130 }} />
            <Button t={t} title="Continue" onPress={() => setStep('best')} />
            <Button t={t} title="Skip for now" secondary onPress={() => { setAmountText(''); setStep('best'); }} />
          </>}

          {step === 'best' && best && <>
            <Header t={t} title="Your Best Card" subtitle={`${merchant?.name} • ${category}`} />
            <DemoBanner t={t} />
            <CardVisual t={t} card={best.card} />
            <Glass t={t}>
              <Text style={{ color: CYAN, fontWeight: '900', fontSize: 24 }}>{best.kind === 'cashback' ? `${best.rate.toFixed(1)}% cashback` : `${best.rate.toFixed(1)}× points`}</Text>
              {best.reward != null && <Text style={{ color: t.text, fontWeight: '800', marginTop: 7 }}>Estimated reward value: {money(best.reward)}</Text>}
              {best.benefits.map((b) => <Text key={b} style={{ color: t.secondary, marginTop: 6 }}>✓ {b}</Text>)}
            </Glass>
            <Button t={t} title="Why this card?" secondary onPress={() => setWhy(true)} />
            <Button t={t} title="I Used This Card" onPress={() => { setUsedCard(best.card); setStep('log'); }} />
            <Button t={t} title="Choose Another Card" secondary onPress={() => setStep('override')} />
          </>}

          {step === 'override' && <>
            <Header t={t} title="Choose Another Card" subtitle="You're always in control." />
            {ranked.map((r) => <RowButton key={r.card.id} t={t} title={`${r.card.bank} ${r.card.name}`} subtitle={`Estimated value ${r.percent.toFixed(2)}%`} onPress={() => { setUsedCard(r.card); setStep('log'); }} />)}
          </>}

          {step === 'log' && <>
            <Header t={t} title="Log Your Purchase" subtitle="Optional details help SwipeWise learn your spending patterns." />
            {!amountText && <Field t={t} value={amountText} onChangeText={setAmountText} placeholder="Amount (optional)" keyboardType="decimal-pad" />}
            <Field t={t} value={notes} onChangeText={setNotes} placeholder="Notes (optional)" multiline />
            {usedCard && <Glass t={t}><Text style={{ color: t.secondary }}>Card used</Text><Text style={{ color: t.text, fontWeight: '800', marginTop: 4 }}>{usedCard.bank} {usedCard.name}</Text></Glass>}
            <View style={{ flex: 1, minHeight: 100 }} />
            <Button t={t} title="Save Purchase" onPress={() => { save(); setStep('saved'); }} />
            <Button t={t} title="Skip" secondary onPress={onClose} />
          </>}

          {step === 'saved' && <>
            <View style={{ flex: 1, minHeight: 120 }} />
            <Text style={styles.complete}>✓</Text>
            <Text style={[styles.bigCenter, { color: t.text }]}>Purchase Saved! 🎉</Text>
            <Text style={[styles.tagline, { color: t.secondary }]}>We'll use this to improve your spending insights.</Text>
            <View style={{ flex: 1, minHeight: 100 }} />
            <Button t={t} title="Done" onPress={onClose} />
          </>}
        </ScrollView>

        <Modal visible={why} animationType="fade" transparent onRequestClose={() => setWhy(false)}>
          <View style={styles.overlay}><View style={[styles.sheet, { backgroundColor: t.bg2 }]}>
            <ScrollView contentContainerStyle={{ gap: 12 }}>
              <Header t={t} title="Why This Card?" subtitle="SwipeWise compared all cards in your wallet." />
              {best && <CardVisual t={t} card={best.card} compact />}
              {best && <Glass t={t}>
                <Text style={{ color: t.text, fontWeight: '900' }}>{best.kind === 'cashback' ? `${best.rate}% cashback` : `${best.rate}× points`}</Text>
                <Text style={{ color: CYAN, marginTop: 6 }}>Estimated reward-equivalent: {best.percent.toFixed(2)}%</Text>
                {best.benefits.map((b) => <Text key={b} style={{ color: t.secondary, marginTop: 5 }}>✓ {b}</Text>)}
              </Glass>}
              <Text style={[styles.sectionTitle, { color: t.text }]}>Other cards</Text>
              {ranked.slice(1).map((r) => <RowButton key={r.card.id} t={t} title={r.card.name} subtitle={`${r.percent.toFixed(2)}%`} onPress={() => {}} />)}
              <Button t={t} title="Got It" onPress={() => setWhy(false)} />
            </ScrollView>
          </View></View>
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

function Wallet({ t, wallet, selectedIds, setSelectedIds }) {
  const [detail, setDetail] = useState(null);
  const [adding, setAdding] = useState(false);
  return <ScrollView contentContainerStyle={styles.tabPage}>
    <Header t={t} title="My Cards" subtitle={`${wallet.length} cards in your wallet`} />
    {wallet.map((c) => <Pressable key={c.id} onPress={() => setDetail(c)}><CardVisual t={t} card={c} compact /></Pressable>)}
    <Button t={t} title="Add Card" onPress={() => setAdding(true)} />
    <DemoBanner t={t} />
    <Modal visible={adding} animationType="slide" onRequestClose={() => setAdding(false)}><View style={{ flex: 1, backgroundColor: t.bg }}><ScrollView contentContainerStyle={styles.page}><Header t={t} title="Add Card" />{cards.map((c) => <RowButton key={c.id} t={t} title={`${c.bank} ${c.name}`} subtitle={`•••• ${c.last4}`} selected={selectedIds.includes(c.id)} onPress={() => setSelectedIds((ids) => ids.includes(c.id) ? ids : [...ids, c.id])} />)}<Button t={t} title="Done" onPress={() => setAdding(false)} /></ScrollView></View></Modal>
    <Modal visible={!!detail} animationType="slide" onRequestClose={() => setDetail(null)}>{detail && <CardDetails t={t} card={detail} onClose={() => setDetail(null)} onRemove={() => { setSelectedIds((ids) => ids.filter((x) => x !== detail.id)); setDetail(null); }} />}</Modal>
  </ScrollView>;
}

function CardDetails({ t, card, onClose, onRemove }) {
  return <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}><ScrollView contentContainerStyle={styles.page}><Header t={t} title={card.name} subtitle={card.bank} /><CardVisual t={t} card={card} /><DemoBanner t={t} /><Glass t={t}><DetailRow t={t} a="Network" b={card.network} /><DetailRow t={t} a="Annual Fee" b={money(card.fee)} /><DetailRow t={t} a="Card ending" b={`•••• ${card.last4}`} /></Glass><Glass t={t}><Text style={[styles.sectionTitle, { color: t.text }]}>Demo Rewards</Text>{Object.entries(card.rules).map(([cat, r]) => <DetailRow key={cat} t={t} a={cat} b={r[0] === 'cashback' ? `${r[1]}%` : `${r[1]}×`} />)}</Glass><Glass t={t}><Text style={[styles.sectionTitle, { color: t.text }]}>Benefits</Text>{card.benefits.map((b) => <Text key={b} style={{ color: t.secondary, marginVertical: 3 }}>✓ {b}</Text>)}</Glass><Button t={t} title="Remove Card" secondary onPress={onRemove} /><Button t={t} title="Back" onPress={onClose} /></ScrollView></SafeAreaView>;
}

function DetailRow({ t, a, b }) { return <View style={styles.detailRow}><Text style={{ color: t.secondary }}>{a}</Text><Text style={{ color: t.text, fontWeight: '800', textAlign: 'right', flex: 1 }}>{b}</Text></View>; }

function Insights({ t, purchases, wallet }) {
  const [sub, setSub] = useState('Overview');
  const totalSpend = purchases.reduce((s, p) => s + (p.amount || 0), 0);
  const totalRewards = purchases.reduce((s, p) => s + (p.reward || 0), 0);
  const byCat = categories.map((c) => ({ c, v: purchases.filter((p) => p.category === c).reduce((s, p) => s + (p.amount || 0), 0) })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
  const topCat = byCat[0]?.c || 'Groceries';
  const candidate = cards.find((c) => !wallet.some((w) => w.id === c.id)) || cards[cards.length - 1];
  return <ScrollView contentContainerStyle={styles.tabPage}>
    <Header t={t} title="Insights" subtitle="Your SwipeWise overview" />
    <View style={styles.segment}>{['Overview', 'Spending', 'Rewards', 'Impact', 'Recommend'].map((x) => <Pressable key={x} onPress={() => setSub(x)} style={[styles.segmentItem, sub === x && { backgroundColor: BLUE }]}><Text style={{ color: sub === x ? 'white' : t.secondary, fontSize: 11, fontWeight: '800' }}>{x}</Text></Pressable>)}</View>
    {sub === 'Overview' && <><View style={{ flexDirection: 'row', gap: 10 }}><Stat t={t} title="Total Spend" value={money(totalSpend)} /><Stat t={t} title="Rewards" value={money(totalRewards)} accent={GREEN} /></View><Glass t={t}><Text style={[styles.sectionTitle, { color: t.text }]}>Top Categories</Text>{byCat.length ? byCat.slice(0, 5).map((x) => <DetailRow key={x.c} t={t} a={x.c} b={money(x.v)} />) : <Text style={{ color: t.secondary }}>Log purchases to build your insights.</Text>}</Glass></>}
    {sub === 'Spending' && <><Header t={t} title="Spending Trends" subtitle="Based only on purchases you choose to log." />{byCat.length ? byCat.map((x) => <Glass key={x.c} t={t}><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: t.text, fontWeight: '800' }}>{x.c}</Text><Text style={{ color: CYAN }}>{money(x.v)}</Text></View><View style={[styles.barBg, { backgroundColor: t.input }]}><View style={[styles.barFill, { width: `${Math.max(8, Math.min(100, (x.v / (byCat[0]?.v || 1)) * 100))}%` }]} /></View></Glass>) : <Glass t={t}><Text style={{ color: t.secondary }}>No spending data yet.</Text></Glass>}</>}
    {sub === 'Rewards' && <><Text style={[styles.rewardBig, { color: GREEN }]}>{money(totalRewards)}</Text>{wallet.map((c) => <Glass key={c.id} t={t}><DetailRow t={t} a={c.name} b={money(purchases.filter((p) => p.usedCardId === c.id).reduce((s, p) => s + (p.reward || 0), 0))} /></Glass>)}<DemoBanner t={t} /></>}
    {sub === 'Impact' && <><Glass t={t}><Text style={{ color: t.secondary, textAlign: 'center' }}>You've earned</Text><Text style={[styles.rewardBig, { color: t.text }]}>{money(totalRewards)}</Text><Text style={{ color: t.secondary, textAlign: 'center' }}>in estimated rewards from logged purchases</Text></Glass><View style={{ flexDirection: 'row', gap: 10 }}><Stat t={t} title="Optimized Purchases" value={`${purchases.filter((p) => p.followed).length}`} /><Stat t={t} title="Logged Purchases" value={`${purchases.length}`} /></View></>}
    {sub === 'Recommend' && <><DemoBanner t={t} /><Glass t={t}><Text style={[styles.sectionTitle, { color: t.text }]}>Potential fit for {topCat}</Text><Text style={{ color: CYAN, fontWeight: '900' }}>{candidate.bank} {candidate.name}</Text><Text style={{ color: t.secondary, marginTop: 8 }}>Future production logic can compare your verified spending with cards you do not own, fees, rewards and benefits.</Text></Glass><CardVisual t={t} card={candidate} compact /></>}
  </ScrollView>;
}

function HistoryModal({ theme, purchases, wallet, onClose }) {
  const t = makeTheme(theme);
  const [selected, setSelected] = useState(null);
  const getCard = (id) => cards.find((c) => c.id === id)?.name || 'Card';
  return <Modal visible animationType="slide" onRequestClose={onClose}><AppShell theme={theme}><ScrollView contentContainerStyle={styles.page}><Header t={t} title={selected ? 'Purchase Detail' : 'History'} />{!selected ? purchases.map((p) => <RowButton key={p.id} t={t} title={p.merchant} subtitle={`${new Date(p.date).toLocaleDateString()} • ${p.category}`} icon={p.amount ? money(p.amount) : '›'} onPress={() => setSelected(p)} />) : <><Header t={t} title={selected.merchant} subtitle={`${new Date(selected.date).toLocaleString()} • ${selected.mode}`} /><Glass t={t}><DetailRow t={t} a="Amount" b={selected.amount ? money(selected.amount) : 'Not entered'} /><DetailRow t={t} a="Category" b={selected.category} /><DetailRow t={t} a="Recommended" b={getCard(selected.recommendedCardId)} /><DetailRow t={t} a="Card used" b={getCard(selected.usedCardId)} /><DetailRow t={t} a="Est. reward" b={money(selected.reward)} /><DetailRow t={t} a="Followed recommendation" b={selected.followed ? 'Yes' : 'No'} /></Glass>{selected.notes ? <Glass t={t}><Text style={{ color: t.text }}>{selected.notes}</Text></Glass> : null}<Button t={t} title="Back to History" secondary onPress={() => setSelected(null)} /></>}<Button t={t} title="Done" onPress={onClose} /></ScrollView></AppShell></Modal>;
}

function Settings({ t, theme, setTheme, userName, rewardPreference, setRewardPreference, onReset, onClear }) {
  const [page, setPage] = useState('Settings');
  const [notifs, setNotifs] = useState({ alerts: true, recs: true, summary: true, updates: true, marketing: false });
  const back = () => setPage('Settings');
  if (page !== 'Settings') return <ScrollView contentContainerStyle={styles.tabPage}><Pressable onPress={back}><Text style={{ color: CYAN, fontWeight: '800' }}>‹ Settings</Text></Pressable><Header t={t} title={page} />
    {page === 'Profile' && <><Text style={styles.avatar}>●</Text><Text style={[styles.bigCenter, { color: t.text }]}>{userName}</Text><Text style={[styles.tagline, { color: t.secondary }]}>Prototype account</Text>{['Personal Info', 'Communication', 'Security'].map((x) => <RowButton key={x} t={t} title={x} onPress={() => {}} />)}</>}
    {page === 'Appearance & Text' && <>{['light', 'dark', 'system'].map((x) => <RowButton key={x} t={t} title={x[0].toUpperCase() + x.slice(1)} selected={(theme === x) || (x === 'system' && !['light','dark'].includes(theme))} onPress={() => setTheme(x === 'system' ? (Platform.OS === 'web' ? 'dark' : 'dark') : x)} />)}<Glass t={t}><Text style={[styles.sectionTitle, { color: t.text }]}>Preview</Text><Logo t={t} compact /></Glass></>}
    {page === 'Reward Preference' && <>{['Maximum Overall Value', 'Cashback', 'Travel Points'].map((p) => <RowButton key={p} t={t} title={p} selected={rewardPreference === p} onPress={() => setRewardPreference(p)} />)}</>}
    {page === 'Notifications' && <>{Object.entries(notifs).map(([k, v]) => <Glass key={k} t={t} style={styles.switchRow}><Text style={{ color: t.text, fontWeight: '700' }}>{({ alerts:'Purchase Alerts', recs:'New Recommendations', summary:'Monthly Summary', updates:'Rewards Updates', marketing:'Marketing Emails' })[k]}</Text><Switch value={v} onValueChange={(nv) => setNotifs((n) => ({ ...n, [k]: nv }))} /></Glass>)}</>}
    {page === 'Data & Privacy' && <><Glass t={t}><Text style={{ color: t.text, fontWeight: '800' }}>Location</Text><Text style={{ color: t.secondary, marginTop: 5 }}>Access is only simulated in the Snack build.</Text></Glass><Glass t={t}><Text style={{ color: t.text }}>SwipeWise v0.1 stores selections and logs only in current app memory. It does not store full card numbers, CVV or PIN.</Text></Glass><Button t={t} title="Clear Purchase History" secondary onPress={onClear} /><Button t={t} title="Reset App / Prototype Data" secondary onPress={onReset} /></>}
    {page === 'Help & Support' && <>{['FAQ', 'Contact Us', 'Report an Issue', 'Video Tutorials'].map((x) => <RowButton key={x} t={t} title={x} onPress={() => {}} />)}<Text style={{ color: t.secondary }}>Support actions are placeholders in v0.1.</Text></>}
    {page === 'About SwipeWise' && <><View style={{ minHeight: 70 }} /><Logo t={t} /><Text style={[styles.tagline, { color: t.secondary }]}>Version 0.1.0\nConverted from SwiftUI → Expo React Native</Text></>}
    {page === 'Action Button' && <><Glass t={t}><Text style={{ color: t.text, fontWeight: '800' }}>Quick Swipe shortcut</Text><Text style={{ color: t.secondary, marginTop: 5 }}>Native iPhone Action Button/App Intents require a native iOS build. This Snack version keeps the Quick Swipe feature inside the app.</Text></Glass></>}
    {page === 'Data & Sync' && <><Glass t={t}><Text style={{ color: t.text, fontWeight: '800' }}>Local prototype</Text><Text style={{ color: t.secondary, marginTop: 5 }}>Supabase schema from your Xcode project is included in the ZIP for the next backend milestone.</Text></Glass></>}
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

function MainApp({ theme, setTheme, userName, selectedIds, setSelectedIds, rewardPreference, setRewardPreference, purchases, setPurchases, onReset }) {
  const t = makeTheme(theme);
  const [tab, setTab] = useState('Home');
  const [quick, setQuick] = useState(false);
  const [history, setHistory] = useState(false);
  const wallet = cards.filter((c) => selectedIds.includes(c.id));
  const safeWallet = wallet.length ? wallet : cards.slice(0, 1);
  return <AppShell theme={theme}>
    <View style={{ flex: 1 }}>
      {tab === 'Home' && <Home t={t} userName={userName} purchases={purchases} onQuick={() => setQuick(true)} onHistory={() => setHistory(true)} />}
      {tab === 'Wallet' && <Wallet t={t} wallet={safeWallet} selectedIds={selectedIds} setSelectedIds={setSelectedIds} />}
      {tab === 'Insights' && <Insights t={t} purchases={purchases} wallet={safeWallet} />}
      {tab === 'Settings' && <Settings t={t} theme={theme} setTheme={setTheme} userName={userName} rewardPreference={rewardPreference} setRewardPreference={setRewardPreference} onReset={onReset} onClear={() => setPurchases([])} />}
      <TabBar t={t} tab={tab} setTab={setTab} />
    </View>
    {quick && <QuickSwipe theme={theme} wallet={safeWallet} rewardPreference={rewardPreference} onClose={() => setQuick(false)} onSave={(p) => setPurchases((old) => [p, ...old])} />}
    {history && <HistoryModal theme={theme} purchases={purchases} wallet={safeWallet} onClose={() => setHistory(false)} />}
  </AppShell>;
}

export default function App() {
  const [splash, setSplash] = useState(true);
  const [onboarded, setOnboarded] = useState(false);
  const [theme, setTheme] = useState('dark');
  const [userName, setUserName] = useState('Ayan');
  const [selectedIds, setSelectedIds] = useState([cards[0].id, cards[1].id, cards[2].id]);
  const [rewardPreference, setRewardPreference] = useState('Maximum Overall Value');
  const [purchases, setPurchases] = useState([]);

  const reset = () => { setPurchases([]); setSelectedIds([cards[0].id, cards[1].id, cards[2].id]); setOnboarded(false); setSplash(false); };
  if (splash) return <Splash theme={theme} onDone={() => setSplash(false)} />;
  if (!onboarded) return <Onboarding theme={theme} setTheme={setTheme} onFinish={() => setOnboarded(true)} setUserName={setUserName} selectedIds={selectedIds} setSelectedIds={setSelectedIds} rewardPreference={rewardPreference} setRewardPreference={setRewardPreference} />;
  return <MainApp theme={theme} setTheme={setTheme} userName={userName} selectedIds={selectedIds} setSelectedIds={setSelectedIds} rewardPreference={rewardPreference} setRewardPreference={setRewardPreference} purchases={purchases} setPurchases={setPurchases} onReset={reset} />;
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
