import { requireSupabase } from '../lib/supabase';

export async function signUpWithEmail({ displayName, email, password }) {
  const supabase = requireSupabase();
  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      data: {
        display_name: displayName.trim(),
      },
    },
  });

  if (error) throw error;
  return data;
}

export async function signInWithEmail({ email, password }) {
  const supabase = requireSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  if (error) throw error;
  return data;
}

export async function signOut() {
  const supabase = requireSupabase();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
