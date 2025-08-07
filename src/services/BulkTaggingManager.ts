import { Transaction } from "@/types/transaction";
import { Tag, BatchTransactionTag } from "@/types/tags";
import { tagManager } from "@/utils/tagManager";
import { AutoTagResult, TagSuggestion, autoTaggingService } from "./AutoTaggingService";

export interface BulkTaggingOperation {
  id: string;
  timestamp: Date;
  operations: TaggingOperation[];
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  totalTransactions: number;
  processedTransactions: number;
  failedTransactions: number;
  undoData?: UndoData[];
}

export interface TaggingOperation {
  transaction: Transaction;
  tagsToAdd: Tag[];
  tagsToRemove: Tag[];
  suggestion?: TagSuggestion;
  status: 'pending' | 'completed' | 'failed';
  error?: string;
}

export interface UndoData {
  chqRefNumber: string;
  originalTags: Tag[];
  appliedTags: Tag[];
  removedTags: Tag[];
}

export interface BulkTaggingProgress {
  operationId: string;
  completed: number;
  total: number;
  currentTransaction?: string;
  errors: string[];
}

export interface BulkTaggingOptions {
  batchSize?: number; // Number of transactions to process in each batch
  confirmationRequired?: boolean; // Whether user confirmation is needed
  allowDuplicates?: boolean; // Whether to allow duplicate tags
  retryOnFailure?: boolean; // Whether to retry failed operations
  maxRetries?: number; // Maximum number of retries
}

export class BulkTaggingManager {
  private operations = new Map<string, BulkTaggingOperation>();
  private progressCallbacks = new Map<string, (progress: BulkTaggingProgress) => void>();

  /**
   * Prepare bulk tagging operation from auto-suggestions
   */
  public prepareBulkTaggingFromSuggestions(
    autoTagResults: AutoTagResult[],
    options: BulkTaggingOptions = {}
  ): BulkTaggingOperation {
    const operationId = this.generateOperationId();
    
    const operations: TaggingOperation[] = autoTagResults.map(result => ({
      transaction: result.transaction,
      tagsToAdd: result.suggestions.map(s => s.tag),
      tagsToRemove: [],
      suggestion: result.suggestions[0], // Use the highest confidence suggestion for reference
      status: 'pending' as const
    }));

    const bulkOperation: BulkTaggingOperation = {
      id: operationId,
      timestamp: new Date(),
      operations,
      status: 'pending',
      totalTransactions: operations.length,
      processedTransactions: 0,
      failedTransactions: 0
    };

    this.operations.set(operationId, bulkOperation);
    return bulkOperation;
  }

  /**
   * Prepare bulk tagging operation from user selection
   */
  public prepareBulkTagging(
    transactions: Transaction[],
    tagsToAdd: Tag[],
    tagsToRemove: Tag[] = [],
    options: BulkTaggingOptions = {}
  ): BulkTaggingOperation {
    const operationId = this.generateOperationId();
    
    const operations: TaggingOperation[] = transactions.map(transaction => ({
      transaction,
      tagsToAdd,
      tagsToRemove,
      status: 'pending' as const
    }));

    const bulkOperation: BulkTaggingOperation = {
      id: operationId,
      timestamp: new Date(),
      operations,
      status: 'pending',
      totalTransactions: operations.length,
      processedTransactions: 0,
      failedTransactions: 0
    };

    this.operations.set(operationId, bulkOperation);
    return bulkOperation;
  }

  /**
   * Execute bulk tagging operation with progress tracking
   */
  public async executeBulkTagging(
    operationId: string,
    options: BulkTaggingOptions = {}
  ): Promise<BulkTaggingOperation> {
    const operation = this.operations.get(operationId);
    if (!operation) {
      throw new Error(`Operation ${operationId} not found`);
    }

    if (operation.status !== 'pending') {
      throw new Error(`Operation ${operationId} is not in pending state`);
    }

    const defaultOptions: Required<BulkTaggingOptions> = {
      batchSize: 50,
      confirmationRequired: true,
      allowDuplicates: false,
      retryOnFailure: true,
      maxRetries: 3,
      ...options
    };

    operation.status = 'in_progress';
    operation.undoData = [];
    
    try {
      // Process operations in batches
      const batches = this.chunkArray(operation.operations, defaultOptions.batchSize);
      
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        await this.processBatch(operation, batch, defaultOptions);
        
        // Update progress
        this.updateProgress(operationId, operation);
        
        // Small delay to prevent overwhelming the database
        if (batchIndex < batches.length - 1) {
          await this.delay(100);
        }
      }

      // Check if all operations completed successfully
      const failedOps = operation.operations.filter(op => op.status === 'failed');
      operation.status = failedOps.length === 0 ? 'completed' : 'failed';
      operation.failedTransactions = failedOps.length;

      // Learn from successful operations
      await this.learnFromOperations(operation.operations.filter(op => op.status === 'completed'));

    } catch (error) {
      console.error('Bulk tagging operation failed:', error);
      operation.status = 'failed';
      throw error;
    } finally {
      this.updateProgress(operationId, operation);
    }

    return operation;
  }

  /**
   * Cancel an ongoing bulk tagging operation
   */
  public cancelOperation(operationId: string): boolean {
    const operation = this.operations.get(operationId);
    if (!operation) {
      return false;
    }

    if (operation.status === 'in_progress') {
      operation.status = 'cancelled';
      this.updateProgress(operationId, operation);
      return true;
    }

    return false;
  }

  /**
   * Undo a completed bulk tagging operation
   */
  public async undoBulkTagging(operationId: string): Promise<boolean> {
    const operation = this.operations.get(operationId);
    if (!operation || !operation.undoData || operation.status !== 'completed') {
      return false;
    }

    try {
      for (const undoItem of operation.undoData) {
        // Remove applied tags
        for (const tag of undoItem.appliedTags) {
          await tagManager.removeTagFromTransaction(undoItem.chqRefNumber, tag.id);
        }

        // Re-add original tags that were removed
        for (const tag of undoItem.removedTags) {
          await tagManager.addTagToTransaction(undoItem.chqRefNumber, tag.id);
        }
      }

      return true;
    } catch (error) {
      console.error('Failed to undo bulk tagging operation:', error);
      return false;
    }
  }

  /**
   * Get operation status and progress
   */
  public getOperationStatus(operationId: string): BulkTaggingOperation | null {
    return this.operations.get(operationId) || null;
  }

  /**
   * Subscribe to progress updates
   */
  public onProgress(operationId: string, callback: (progress: BulkTaggingProgress) => void) {
    this.progressCallbacks.set(operationId, callback);
  }

  /**
   * Unsubscribe from progress updates
   */
  public offProgress(operationId: string) {
    this.progressCallbacks.delete(operationId);
  }

  /**
   * Clean up completed operations older than specified days
   */
  public cleanupOperations(daysOld: number = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    for (const [operationId, operation] of this.operations.entries()) {
      if (operation.timestamp < cutoffDate && 
          (operation.status === 'completed' || operation.status === 'failed' || operation.status === 'cancelled')) {
        this.operations.delete(operationId);
        this.progressCallbacks.delete(operationId);
      }
    }
  }

  /**
   * Get summary statistics for all operations
   */
  public getOperationsSummary() {
    const operations = Array.from(this.operations.values());
    return {
      total: operations.length,
      pending: operations.filter(op => op.status === 'pending').length,
      inProgress: operations.filter(op => op.status === 'in_progress').length,
      completed: operations.filter(op => op.status === 'completed').length,
      failed: operations.filter(op => op.status === 'failed').length,
      cancelled: operations.filter(op => op.status === 'cancelled').length,
      totalTransactionsProcessed: operations.reduce((sum, op) => sum + op.processedTransactions, 0)
    };
  }

  private async processBatch(
    operation: BulkTaggingOperation,
    batch: TaggingOperation[],
    options: Required<BulkTaggingOptions>
  ) {
    const promises = batch.map(async (tagOp) => {
      if (operation.status === 'cancelled') {
        return;
      }

      try {
        await this.processTaggingOperation(tagOp, options);
        
        // Store undo data
        if (tagOp.status === 'completed' && operation.undoData) {
          const currentTags = await tagManager.getTransactionTags(tagOp.transaction.chqRefNumber);
          operation.undoData.push({
            chqRefNumber: tagOp.transaction.chqRefNumber,
            originalTags: currentTags,
            appliedTags: tagOp.tagsToAdd,
            removedTags: tagOp.tagsToRemove
          });
        }
        
        operation.processedTransactions++;
      } catch (error) {
        console.error(`Failed to process transaction ${tagOp.transaction.chqRefNumber}:`, error);
        tagOp.status = 'failed';
        tagOp.error = error instanceof Error ? error.message : 'Unknown error';
        operation.failedTransactions++;
      }
    });

    await Promise.allSettled(promises);
  }

  private async processTaggingOperation(
    tagOp: TaggingOperation,
    options: Required<BulkTaggingOptions>
  ) {
    const { transaction, tagsToAdd, tagsToRemove } = tagOp;

    // Get current tags if we need to check for duplicates
    let currentTags: Tag[] = [];
    if (!options.allowDuplicates) {
      currentTags = await tagManager.getTransactionTags(transaction.chqRefNumber);
    }

    // Remove tags first
    for (const tag of tagsToRemove) {
      await tagManager.removeTagFromTransaction(transaction.chqRefNumber, tag.id);
    }

    // Add new tags
    for (const tag of tagsToAdd) {
      // Skip if tag already exists and duplicates not allowed
      if (!options.allowDuplicates && currentTags.some(t => t.id === tag.id)) {
        continue;
      }

      await tagManager.addTagToTransaction(transaction.chqRefNumber, tag.id);
    }

    tagOp.status = 'completed';
  }

  private async learnFromOperations(completedOperations: TaggingOperation[]) {
    for (const operation of completedOperations) {
      if (operation.suggestion && operation.tagsToAdd.length > 0) {
        // Learn from successful auto-tagging
        autoTaggingService.learnFromUserAction(
          operation.transaction,
          operation.tagsToAdd
        );
      }
    }
  }

  private updateProgress(operationId: string, operation: BulkTaggingOperation) {
    const callback = this.progressCallbacks.get(operationId);
    if (callback) {
      callback({
        operationId,
        completed: operation.processedTransactions,
        total: operation.totalTransactions,
        currentTransaction: operation.operations.find(op => op.status === 'pending')?.transaction.narration,
        errors: operation.operations.filter(op => op.error).map(op => op.error!)
      });
    }
  }

  private generateOperationId(): string {
    return `bulk_tag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const bulkTaggingManager = new BulkTaggingManager();