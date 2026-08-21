import { requireSupabase } from '../lib/supabase';

export const rewardPreferenceToDb = (value) => {
  if (value === 'Cashback') return 'cashback';
  if (value === 'Travel Points') return 'travel_points';
  return 'overall';
};

export const rewardPreferenceFromDb = (value) => {
  if (value === 'cashback') return 'Cashback';
  if (value === 'travel_points') return 'Travel Points';
  return 'Maximum Overall Value';
};

export async function getProfileAndSettings(userId) {
  const supabase = requireSupabase();

  const [{ data: profile, error: profileError }, { data: settings, error: settingsError }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).single(),
    supabase.from('user_settings').select('*').eq('user_id', userId).single(),
  ]);

  if (profileError) throw profileError;
  if (settingsError) throw settingsError;

  return { profile, settings };
}

export async function updateProfile(userId, values) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('profiles')
    .update(values)
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateUserSettings(userId, values) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('user_settings')
    .update(values)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function completeOnboarding(userId, { displayName, rewardPreference, appearance }) {
  const [profile] = await Promise.all([
    updateProfile(userId, {
      display_name: displayName,
      onboarding_completed: true,
    }),
    updateUserSettings(userId, {
      reward_preference: rewardPreferenceToDb(rewardPreference),
      appearance,
    }),
  ]);

  return profile;
}
