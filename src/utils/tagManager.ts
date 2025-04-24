import { supabase } from "@/lib/supabaseClient";
import { Tag, TransactionTag, TagWithTransactions, TAG_COLORS } from "@/types/tags";

export class TagManager {
  async createTag(userId: string, name: string, color?: string): Promise<Tag> {
    if (!color) {
      // Randomly select a color if none provided
      color = TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
    }

    const { data, error } = await supabase
      .from('tags')
      .insert({
        user_id: userId,
        name,
        color
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateTag(tagId: string, updates: Partial<Tag>): Promise<Tag> {
    const { data, error } = await supabase
      .from('tags')
      .update(updates)
      .eq('id', tagId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteTag(tagId: string): Promise<void> {
    const { error } = await supabase
      .from('tags')
      .delete()
      .eq('id', tagId);

    if (error) throw error;
  }

  async getUserTags(userId: string): Promise<TagWithTransactions[]> {
    const { data, error } = await supabase
      .from('tags')
      .select('*, transaction_tags(count)')
      .eq('user_id', userId);

    if (error) throw error;

    return data.map(tag => ({
      ...tag,
      transaction_count: tag.transaction_tags?.[0]?.count || 0
    }));
  }

  async getTransactionTags(transactionId: string): Promise<Tag[]> {
    const { data, error } = await supabase
      .from('transaction_tags')
      .select('tags(*)')
      .eq('transaction_id', transactionId);

    if (error) throw error;

    return data.map(item => item.tags);
  }

  async addTagToTransaction(
    userId: string,
    transactionId: string,
    tagId: string
  ): Promise<void> {
    const { error } = await supabase
      .from('transaction_tags')
      .insert({
        user_id: userId,
        transaction_id: transactionId,
        tag_id: tagId
      });

    if (error) {
      // If error is due to unique constraint, ignore it (idempotent operation)
      if (error.code !== '23505') throw error;
    }
  }

  async removeTagFromTransaction(transactionId: string, tagId: string): Promise<void> {
    const { error } = await supabase
      .from('transaction_tags')
      .delete()
      .eq('transaction_id', transactionId)
      .eq('tag_id', tagId);

    if (error) throw error;
  }

  async getTaggedTransactions(tagId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('transaction_tags')
      .select('transaction_id')
      .eq('tag_id', tagId);

    if (error) throw error;

    return data.map(item => item.transaction_id);
  }

  // Batch operations for efficiency
  async addTagsToTransaction(
    userId: string,
    transactionId: string,
    tagIds: string[]
  ): Promise<void> {
    const { error } = await supabase
      .from('transaction_tags')
      .insert(
        tagIds.map(tagId => ({
          user_id: userId,
          transaction_id: transactionId,
          tag_id: tagId
        }))
      );

    if (error) throw error;
  }

  async removeTagsFromTransaction(
    transactionId: string,
    tagIds: string[]
  ): Promise<void> {
    const { error } = await supabase
      .from('transaction_tags')
      .delete()
      .eq('transaction_id', transactionId)
      .in('tag_id', tagIds);

    if (error) throw error;
  }

  // Get all transactions with their tags
  async getTransactionsWithTags(transactionIds: string[]): Promise<Map<string, Tag[]>> {
    const { data, error } = await supabase
      .from('transaction_tags')
      .select('transaction_id, tags(*)')
      .in('transaction_id', transactionIds);

    if (error) throw error;

    const tagsMap = new Map<string, Tag[]>();
    
    // Initialize map with empty arrays
    transactionIds.forEach(id => tagsMap.set(id, []));
    
    // Fill in tags where they exist
    data.forEach(item => {
      const existingTags = tagsMap.get(item.transaction_id) || [];
      existingTags.push(item.tags);
      tagsMap.set(item.transaction_id, existingTags);
    });

    return tagsMap;
  }
}

// Export singleton instance
export const tagManager = new TagManager();
