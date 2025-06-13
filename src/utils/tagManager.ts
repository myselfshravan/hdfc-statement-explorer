import { supabase } from "@/lib/supabaseClient";
import {
  Tag,
  TransactionTag,
  TagWithTransactions,
  TAG_COLORS,
  BatchTransactionTag,
  TagOperationError
} from "@/types/tags";

export class TagManager {
  async createTag(name: string, color?: string): Promise<Tag> {
    if (!color) {
      // Randomly select a color if none provided
      color = TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
    }

    // Check if tag already exists since they're global
    const { data: existingTag, error: searchError } = await supabase
      .from('tags')
      .select()
      .eq('name', name)
      .single();

    if (searchError && searchError.code !== 'PGRST116') { // PGRST116 means no rows returned
      throw new TagOperationError(
        `Error checking existing tag: ${searchError.message}`,
        searchError.code,
        searchError.details
      );
    }

    if (existingTag) {
      throw new TagOperationError(
        `Tag "${name}" already exists`,
        'TAG_EXISTS'
      );
    }

    const { data, error } = await supabase
      .from('tags')
      .insert({
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

    if (error) {
      throw new TagOperationError(
        `Failed to create tag: ${error.message}`,
        error.code,
        error.details
      );
    }
    return data;
  }

  async deleteTag(tagId: string): Promise<void> {
    const { error } = await supabase
      .from('tags')
      .delete()
      .eq('id', tagId);

    if (error) {
      throw new TagOperationError(
        `Failed to update tag: ${error.message}`,
        error.code,
        error.details
      );
    }
  }

  async getUserTags(): Promise<TagWithTransactions[]> {
    const { data, error } = await supabase
      .from('tags')
      .select('*, transaction_tags(count)')
      .order('name');

    if (error) {
      throw new TagOperationError(
        `Failed to delete tag: ${error.message}`,
        error.code,
        error.details
      );
    }

    return data.map(tag => ({
      ...tag,
      transaction_count: tag.transaction_tags?.[0]?.count || 0
    }));
  }

  async getTransactionTags(chqRefNumber: string): Promise<Tag[]> {
    const { data, error } = await supabase
      .from('transaction_tags')
      .select('tags(*)')
      .eq('chq_ref_number', chqRefNumber);

    if (error) {
      throw new TagOperationError(
        `Failed to get user tags: ${error.message}`,
        error.code,
        error.details
      );
    }

    return data.map(item => item.tags);
  }

  async addTagToTransaction(
    chqRefNumber: string,
    tagId: string
  ): Promise<void> {
    const { error } = await supabase
      .from('transaction_tags')
      .insert({
        chq_ref_number: chqRefNumber,
        tag_id: tagId
      });

    if (error) {
      // If error is due to unique constraint, ignore it (idempotent operation)
      if (error.code !== '23505') {
        throw new TagOperationError(
          `Failed to add tag to transaction: ${error.message}`,
          error.code,
          error.details
        );
      }
    }
  }

  async removeTagFromTransaction(chqRefNumber: string, tagId: string): Promise<void> {
    const { error } = await supabase
      .from('transaction_tags')
      .delete()
      .eq('chq_ref_number', chqRefNumber)
      .eq('tag_id', tagId);

    if (error) {
      throw new TagOperationError(
        `Failed to get transaction tags: ${error.message}`,
        error.code,
        error.details
      );
    }
  }

  async getTaggedTransactions(tagId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('transaction_tags')
      .select('chq_ref_number')
      .eq('tag_id', tagId);

    if (error) {
      throw new TagOperationError(
        `Failed to remove tag from transaction: ${error.message}`,
        error.code,
        error.details
      );
    }

    return data.map(item => item.chq_ref_number);
  }

  // Batch operations for efficiency
  async addTagsToTransaction(
    chqRefNumber: string,
    tagIds: string[]
  ): Promise<void> {
    const batchTags: BatchTransactionTag[] = tagIds.map(tagId => ({
      chq_ref_number: chqRefNumber,
      tag_id: tagId
    }));

    const { error } = await supabase
      .from('transaction_tags')
      .insert(batchTags);

    if (error) {
      throw new TagOperationError(
        `Failed to get tagged transactions: ${error.message}`,
        error.code,
        error.details
      );
    }
  }

  async removeTagsFromTransaction(
    chqRefNumber: string,
    tagIds: string[]
  ): Promise<void> {
    const { error } = await supabase
      .from('transaction_tags')
      .delete()
      .eq('chq_ref_number', chqRefNumber)
      .in('tag_id', tagIds);

    if (error) {
      throw new TagOperationError(
        `Failed to add tags to transaction: ${error.message}`,
        error.code,
        error.details
      );
    }
  }

  // Get all transactions with their tags
  async getTransactionsWithTags(chqRefNumbers: string[]): Promise<Map<string, Tag[]>> {
    const { data, error } = await supabase
      .from('transaction_tags')
      .select('chq_ref_number, tags(*)')
      .in('chq_ref_number', chqRefNumbers);

    if (error) {
      throw new TagOperationError(
        `Failed to remove tags from transaction: ${error.message}`,
        error.code,
        error.details
      );
    }

    const tagsMap = new Map<string, Tag[]>();
    
    // Initialize map with empty arrays
    chqRefNumbers.forEach(ref => tagsMap.set(ref, []));
    
    // Fill in tags where they exist
    data.forEach(item => {
      const existingTags = tagsMap.get(item.chq_ref_number) || [];
      existingTags.push(item.tags);
      tagsMap.set(item.chq_ref_number, existingTags);
    });

    return tagsMap;
  }
}

// Export singleton instance
export const tagManager = new TagManager();
