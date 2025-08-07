import { supabase } from "@/lib/supabaseClient";
import {
  Tag,
  TagWithTransactions,
  TAG_COLORS,
  BatchTransactionTag,
  TagOperationError
} from "@/types/tags";

interface BulkOperationResult {
  success: number;
  failed: number;
  errors: string[];
}

interface TagUsageStats {
  tagId: string;
  tagName: string;
  usageCount: number;
  recentUsage: Date | null;
  averageAmount: number;
  transactionTypes: { credit: number; debit: number };
}

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

    return data.map((tag: any) => ({
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

    return data.map((item: any) => item.tags);
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

    return data.map((item: any) => item.chq_ref_number);
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

  // Get all transaction tags in one query
  async getAllTransactionTags(): Promise<Map<string, Tag[]>> {
    const { data, error } = await supabase
      .from('transaction_tags')
      .select('chq_ref_number, tags(*)')
      .order('chq_ref_number');

    if (error) {
      throw new TagOperationError(
        `Failed to fetch all transaction tags: ${error.message}`,
        error.code,
        error.details
      );
    }

    const tagsMap = new Map<string, Tag[]>();
    
    // Group tags by chq_ref_number
    data.forEach((item: any) => {
      const tags = tagsMap.get(item.chq_ref_number) || [];
      if (item.tags) {
        tags.push(item.tags);
      }
      tagsMap.set(item.chq_ref_number, tags);
    });

    return tagsMap;
  }

  // Get specific transactions with their tags
  async getTransactionsWithTags(chqRefNumbers: string[]): Promise<Map<string, Tag[]>> {
    const { data, error } = await supabase
      .from('transaction_tags')
      .select('chq_ref_number, tags(*)')
      .in('chq_ref_number', chqRefNumbers)
      .order('chq_ref_number');

    if (error) {
      throw new TagOperationError(
        `Failed to fetch transaction tags: ${error.message}`,
        error.code,
        error.details
      );
    }

    const tagsMap = new Map<string, Tag[]>();
    
    // Initialize map with empty arrays
    chqRefNumbers.forEach(ref => tagsMap.set(ref, []));
    
    // Fill in tags where they exist
    data.forEach((item: any) => {
      if (item.tags) {
        const existingTags = tagsMap.get(item.chq_ref_number) || [];
        existingTags.push(item.tags);
        tagsMap.set(item.chq_ref_number, existingTags);
      }
    });

    return tagsMap;
  }

  // Enhanced bulk operations for auto-tagging system
  
  /**
   * Apply multiple tags to multiple transactions efficiently
   */
  async bulkApplyTags(
    operations: Array<{ chqRefNumber: string; tagIds: string[] }>
  ): Promise<BulkOperationResult> {
    const result: BulkOperationResult = {
      success: 0,
      failed: 0,
      errors: []
    };

    if (operations.length === 0) {
      return result;
    }

    try {
      // Flatten all operations into individual tag assignments
      const batchTags: BatchTransactionTag[] = [];
      operations.forEach(op => {
        op.tagIds.forEach(tagId => {
          batchTags.push({
            chq_ref_number: op.chqRefNumber,
            tag_id: tagId
          });
        });
      });

      // Insert in chunks to avoid hitting query size limits
      const chunkSize = 100;
      for (let i = 0; i < batchTags.length; i += chunkSize) {
        const chunk = batchTags.slice(i, i + chunkSize);
        
        const { error } = await supabase
          .from('transaction_tags')
          .insert(chunk);

        if (error) {
          result.errors.push(`Chunk ${Math.floor(i / chunkSize) + 1}: ${error.message}`);
          result.failed += chunk.length;
        } else {
          result.success += chunk.length;
        }
      }
    } catch (error) {
      result.errors.push(`Bulk operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.failed = operations.length;
    }

    return result;
  }

  /**
   * Remove multiple tags from multiple transactions efficiently
   */
  async bulkRemoveTags(
    operations: Array<{ chqRefNumber: string; tagIds: string[] }>
  ): Promise<BulkOperationResult> {
    const result: BulkOperationResult = {
      success: 0,
      failed: 0,
      errors: []
    };

    try {
      for (const operation of operations) {
        const { error } = await supabase
          .from('transaction_tags')
          .delete()
          .eq('chq_ref_number', operation.chqRefNumber)
          .in('tag_id', operation.tagIds);

        if (error) {
          result.errors.push(`Transaction ${operation.chqRefNumber}: ${error.message}`);
          result.failed += operation.tagIds.length;
        } else {
          result.success += operation.tagIds.length;
        }
      }
    } catch (error) {
      result.errors.push(`Bulk remove operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Get comprehensive tag usage statistics
   */
  async getTagUsageStats(): Promise<TagUsageStats[]> {
    const { data, error } = await supabase
      .from('tags')
      .select(`
        id,
        name,
        transaction_tags(
          chq_ref_number,
          created_at
        )
      `);

    if (error) {
      throw new TagOperationError(
        `Failed to fetch tag usage stats: ${error.message}`,
        error.code,
        error.details
      );
    }

    return data.map((tag: any) => {
      const usage = tag.transaction_tags || [];
      const usageCount = usage.length;
      const recentUsage = usage.length > 0 
        ? new Date(Math.max(...usage.map((u: any) => new Date(u.created_at).getTime())))
        : null;

      return {
        tagId: tag.id,
        tagName: tag.name,
        usageCount,
        recentUsage,
        averageAmount: 0, // Would need transaction data to calculate
        transactionTypes: { credit: 0, debit: 0 } // Would need transaction data to calculate
      };
    });
  }

  /**
   * Get untagged transactions for auto-tagging suggestions
   */
  async getUntaggedTransactionRefs(): Promise<string[]> {
    // This would need to be implemented with knowledge of all transaction chq_ref_numbers
    // For now, return empty array - this would be called from the service that has transaction data
    return [];
  }

  /**
   * Find similar transactions based on existing tags
   */
  async findSimilarTransactions(chqRefNumber: string, limit: number = 10): Promise<string[]> {
    // Get tags for the given transaction
    const transactionTags = await this.getTransactionTags(chqRefNumber);
    
    if (transactionTags.length === 0) {
      return [];
    }

    const tagIds = transactionTags.map(tag => tag.id);

    // Find other transactions that share tags
    const { data, error } = await supabase
      .from('transaction_tags')
      .select('chq_ref_number')
      .in('tag_id', tagIds)
      .neq('chq_ref_number', chqRefNumber)
      .limit(limit);

    if (error) {
      throw new TagOperationError(
        `Failed to find similar transactions: ${error.message}`,
        error.code,
        error.details
      );
    }

    // Return unique transaction references
    return Array.from(new Set(data.map((item: any) => item.chq_ref_number)));
  }

  /**
   * Get tag suggestions based on transaction patterns
   */
  async getPopularTagsForPattern(
    _pattern: string, 
    limit: number = 5
  ): Promise<Tag[]> {
    // This is a simplified implementation
    // In a real scenario, you'd analyze narration patterns and find commonly used tags
    const { data, error } = await supabase
      .from('tags')
      .select('*, transaction_tags(count)')
      .order('transaction_tags.count', { ascending: false })
      .limit(limit);

    if (error) {
      throw new TagOperationError(
        `Failed to get popular tags: ${error.message}`,
        error.code,
        error.details
      );
    }

    return data.filter((tag: any) => tag.transaction_tags && tag.transaction_tags.length > 0);
  }

  /**
   * Clean up orphaned tags (tags with no associated transactions)
   */
  async cleanupOrphanedTags(): Promise<number> {
    const { data: orphanedTags, error: selectError } = await supabase
      .rpc('find_orphaned_tags'); // This would need a custom SQL function

    if (selectError) {
      // Fallback to JavaScript-based cleanup
      const { data: allTags, error: tagsError } = await supabase
        .from('tags')
        .select('id, name');

      if (tagsError) {
        throw new TagOperationError(
          `Failed to fetch tags for cleanup: ${tagsError.message}`,
          tagsError.code,
          tagsError.details
        );
      }

      let orphanedCount = 0;
      
      for (const tag of allTags || []) {
        const { data: usage, error: usageError } = await supabase
          .from('transaction_tags')
          .select('chq_ref_number')
          .eq('tag_id', tag.id)
          .limit(1);

        if (!usageError && (!usage || usage.length === 0)) {
          const { error: deleteError } = await supabase
            .from('tags')
            .delete()
            .eq('id', tag.id);

          if (!deleteError) {
            orphanedCount++;
          }
        }
      }

      return orphanedCount;
    }

    const { error: deleteError } = await supabase
      .from('tags')
      .delete()
      .in('id', orphanedTags.map((tag: any) => tag.id));

    if (deleteError) {
      throw new TagOperationError(
        `Failed to delete orphaned tags: ${deleteError.message}`,
        deleteError.code,
        deleteError.details
      );
    }

    return orphanedTags.length;
  }

  /**
   * Get tagging completion statistics
   */
  async getTaggingStats(
    totalTransactionCount: number
  ): Promise<{
    totalTransactions: number;
    taggedTransactions: number;
    untaggedTransactions: number;
    averageTagsPerTransaction: number;
    mostUsedTags: Array<{ tag: Tag; count: number }>;
    taggingCompletionRate: number;
  }> {
    // Get all tagged transactions count
    const { data: taggedData, error: taggedError } = await supabase
      .from('transaction_tags')
      .select('chq_ref_number', { count: 'exact', head: true });

    if (taggedError) {
      throw new TagOperationError(
        `Failed to get tagging stats: ${taggedError.message}`,
        taggedError.code,
        taggedError.details
      );
    }

    const taggedTransactionCount = taggedData?.length || 0;
    const untaggedCount = totalTransactionCount - taggedTransactionCount;

    // Get most used tags
    const { data: popularTags, error: popularError } = await supabase
      .from('tags')
      .select(`
        *,
        transaction_tags(count)
      `)
      .order('transaction_tags.count', { ascending: false })
      .limit(10);

    if (popularError) {
      throw new TagOperationError(
        `Failed to get popular tags: ${popularError.message}`,
        popularError.code,
        popularError.details
      );
    }

    const mostUsedTags = (popularTags || []).map((tag: any) => ({
      tag,
      count: tag.transaction_tags?.[0]?.count || 0
    }));

    // Calculate average tags per transaction
    const { data: totalTags, error: totalError } = await supabase
      .from('transaction_tags')
      .select('*', { count: 'exact', head: true });

    if (totalError) {
      throw new TagOperationError(
        `Failed to count total tags: ${totalError.message}`,
        totalError.code,
        totalError.details
      );
    }

    const totalTagAssignments = totalTags?.length || 0;
    const averageTagsPerTransaction = taggedTransactionCount > 0 
      ? totalTagAssignments / taggedTransactionCount 
      : 0;

    return {
      totalTransactions: totalTransactionCount,
      taggedTransactions: taggedTransactionCount,
      untaggedTransactions: untaggedCount,
      averageTagsPerTransaction: Number(averageTagsPerTransaction.toFixed(2)),
      mostUsedTags,
      taggingCompletionRate: totalTransactionCount > 0 
        ? Number(((taggedTransactionCount / totalTransactionCount) * 100).toFixed(1))
        : 0
    };
  }
}

// Export singleton instance
export const tagManager = new TagManager();
