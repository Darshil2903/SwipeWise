import { requireSupabase } from '../lib/supabase';

async function getCardProductsBySlugs(slugs) {
  if (!slugs.length) return [];
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('card_products')
    .select('id, slug, active, data_status, product_status, verification_status')
    .in('slug', slugs)
    .eq('active', true)
    .eq('data_status', 'verified');

  if (error) throw error;
  return data || [];
}

export async function getWalletCardSlugs(userId) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('user_cards')
    .select('card_product:card_products!inner(slug)')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data || []).map((row) => row.card_product?.slug).filter(Boolean);
}

export async function addWalletCard(userId, cardSlug) {
  const supabase = requireSupabase();
  const [product] = await getCardProductsBySlugs([cardSlug]);
  if (!product) throw new Error(`Card product "${cardSlug}" is not an active verified product in Supabase.`);

  const { error } = await supabase.from('user_cards').upsert(
    {
      user_id: userId,
      card_product_id: product.id,
      is_active: true,
    },
    { onConflict: 'user_id,card_product_id' }
  );

  if (error) throw error;
}

export async function removeWalletCard(userId, cardSlug) {
  const supabase = requireSupabase();
  const [product] = await getCardProductsBySlugs([cardSlug]);
  if (!product) return;

  const { error } = await supabase
    .from('user_cards')
    .delete()
    .eq('user_id', userId)
    .eq('card_product_id', product.id);

  if (error) throw error;
}

export async function syncWallet(userId, cardSlugs) {
  const supabase = requireSupabase();
  const products = await getCardProductsBySlugs(cardSlugs);

  if (products.length !== cardSlugs.length) {
    const found = new Set(products.map((p) => p.slug));
    const missing = cardSlugs.filter((slug) => !found.has(slug));
    throw new Error(`These card products are not active verified Supabase products: ${missing.join(', ')}.`);
  }

  const { data: existing, error: existingError } = await supabase
    .from('user_cards')
    .select('id, card_product_id')
    .eq('user_id', userId);
  if (existingError) throw existingError;

  const desiredIds = new Set(products.map((product) => product.id));
  const existingIds = new Set((existing || []).map((row) => row.card_product_id));

  const rowsToInsert = products
    .filter((product) => !existingIds.has(product.id))
    .map((product) => ({
      user_id: userId,
      card_product_id: product.id,
      is_active: true,
    }));

  if (rowsToInsert.length) {
    const { error: insertError } = await supabase.from('user_cards').insert(rowsToInsert);
    if (insertError) throw insertError;
  }

  const rowIdsToDelete = (existing || [])
    .filter((row) => !desiredIds.has(row.card_product_id))
    .map((row) => row.id);

  if (rowIdsToDelete.length) {
    const { error: deleteError } = await supabase.from('user_cards').delete().in('id', rowIdsToDelete);
    if (deleteError) throw deleteError;
  }
}
