import { requireSupabase } from '../lib/supabase';

async function cardIdMap(slugs) {
  const unique = [...new Set(slugs.filter(Boolean))];
  if (!unique.length) return {};

  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('card_products')
    .select('id, slug')
    .in('slug', unique);

  if (error) throw error;
  return Object.fromEntries((data || []).map((row) => [row.slug, row.id]));
}

export async function createPurchase(userId, purchase) {
  const supabase = requireSupabase();
  const ids = await cardIdMap([purchase.recommendedCardId, purchase.usedCardId]);

  if (!ids[purchase.recommendedCardId] || !ids[purchase.usedCardId]) {
    throw new Error('The recommended or used card is missing from Supabase reference data. Run backend/demo_seed.sql.');
  }

  const row = {
    user_id: userId,
    merchant_name: purchase.merchant,
    purchase_mode: purchase.mode === 'Online' ? 'online' : 'in_store',
    category: purchase.category,
    amount: purchase.amount ?? null,
    recommended_card_id: ids[purchase.recommendedCardId],
    used_card_id: ids[purchase.usedCardId],
    estimated_reward: purchase.reward ?? null,
    recommendation_followed: Boolean(purchase.followed),
    override_reason: purchase.overrideReason || null,
    notes: purchase.notes || null,
    purchased_at: purchase.date || new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('purchases')
    .insert(row)
    .select(`
      id,
      merchant_name,
      purchase_mode,
      category,
      amount,
      estimated_reward,
      recommendation_followed,
      override_reason,
      notes,
      purchased_at,
      recommended_card:card_products!purchases_recommended_card_id_fkey(slug),
      used_card:card_products!purchases_used_card_id_fkey(slug)
    `)
    .single();

  if (error) throw error;
  return mapPurchaseRow(data);
}

export async function getPurchases(userId) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('purchases')
    .select(`
      id,
      merchant_name,
      purchase_mode,
      category,
      amount,
      estimated_reward,
      recommendation_followed,
      override_reason,
      notes,
      purchased_at,
      recommended_card:card_products!purchases_recommended_card_id_fkey(slug),
      used_card:card_products!purchases_used_card_id_fkey(slug)
    `)
    .eq('user_id', userId)
    .order('purchased_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(mapPurchaseRow);
}

export async function clearPurchases(userId) {
  const supabase = requireSupabase();
  const { error } = await supabase.from('purchases').delete().eq('user_id', userId);
  if (error) throw error;
}

function mapPurchaseRow(row) {
  return {
    id: row.id,
    date: row.purchased_at,
    mode: row.purchase_mode === 'online' ? 'Online' : 'In Store',
    merchant: row.merchant_name,
    category: row.category,
    amount: row.amount == null ? null : Number(row.amount),
    recommendedCardId: row.recommended_card?.slug || null,
    usedCardId: row.used_card?.slug || null,
    reward: row.estimated_reward == null ? null : Number(row.estimated_reward),
    followed: Boolean(row.recommendation_followed),
    overrideReason: row.override_reason || null,
    notes: row.notes || '',
  };
}
