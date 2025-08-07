import React, { useReducer, useMemo, useCallback } from "react";
import { Transaction } from "@/types/transaction";
import { Tag } from "@/types/tags";
import { AutoTagResult, TagSuggestion, autoTaggingService } from "@/services/AutoTaggingService";
import { 
  BulkTaggingOperation, 
  BulkTaggingProgress,
  bulkTaggingManager 
} from "@/services/BulkTaggingManager";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2, Play, RotateCcw, Sparkles } from "lucide-react";

import { VirtualizedTransactionList } from "./VirtualizedTransactionList";
import { FilterControls, ConfidenceFilter, StatusFilter } from "./FilterControls";

interface BulkTagReviewProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  transactions: Transaction[];
  availableTags: Tag[];
  transactionTagsMap: Map<string, Tag[]>;
  onBulkTaggingComplete?: (results: BulkTaggingOperation) => void;
}

interface ReviewState {
  reviewTransactions: Array<{
    transaction: Transaction;
    suggestions: TagSuggestion[];
    currentTags: Tag[];
    isSelected: boolean;
    isExpanded: boolean;
  }>;
  isAnalyzing: boolean;
  bulkOperation: BulkTaggingOperation | null;
  progress: BulkTaggingProgress | null;
  isExecuting: boolean;
  statusFilter: StatusFilter;
  confidenceFilter: ConfidenceFilter;
  searchQuery: string;
}

type ReviewAction =
  | { type: "SET_TRANSACTIONS"; payload: AutoTagResult[] }
  | { type: "SET_ANALYZING"; payload: boolean }
  | { type: "TOGGLE_SELECT"; payload: number }
  | { type: "TOGGLE_EXPAND"; payload: number }
  | { type: "SELECT_ALL"; payload: boolean }
  | { type: "SELECT_BY_CONFIDENCE"; payload: number }
  | { type: "SET_STATUS_FILTER"; payload: StatusFilter }
  | { type: "SET_CONFIDENCE_FILTER"; payload: ConfidenceFilter }
  | { type: "SET_SEARCH_QUERY"; payload: string }
  | { type: "SET_BULK_OPERATION"; payload: BulkTaggingOperation | null }
  | { type: "SET_PROGRESS"; payload: BulkTaggingProgress | null }
  | { type: "SET_EXECUTING"; payload: boolean };

function reviewReducer(
  state: ReviewState,
  action: ReviewAction,
  transactionTagsMap: Map<string, Tag[]>
): ReviewState {
  switch (action.type) {
    case "SET_TRANSACTIONS":
      return {
        ...state,
        reviewTransactions: action.payload.map(result => ({
          ...result,
          isSelected: result.suggestions.length > 0 && result.suggestions[0].confidence >= 0.8,
          isExpanded: false,
          currentTags: transactionTagsMap.get(result.transaction.chqRefNumber) || [],
        })),
      };
    case "SET_ANALYZING":
      return { ...state, isAnalyzing: action.payload };
    case "TOGGLE_SELECT":
      return {
        ...state,
        reviewTransactions: state.reviewTransactions.map((item, index) =>
          index === action.payload ? { ...item, isSelected: !item.isSelected } : item
        ),
      };
    case "TOGGLE_EXPAND":
      return {
        ...state,
        reviewTransactions: state.reviewTransactions.map((item, index) =>
          index === action.payload ? { ...item, isExpanded: !item.isExpanded } : item
        ),
      };
    case "SELECT_ALL":
      return {
        ...state,
        reviewTransactions: state.reviewTransactions.map(item => ({
          ...item,
          isSelected: action.payload,
        })),
      };
    case "SELECT_BY_CONFIDENCE":
      return {
        ...state,
        reviewTransactions: state.reviewTransactions.map(item => ({
          ...item,
          isSelected:
            item.suggestions.length > 0 && item.suggestions[0].confidence >= action.payload,
        })),
      };
    case "SET_STATUS_FILTER":
      return { ...state, statusFilter: action.payload };
    case "SET_CONFIDENCE_FILTER":
      return { ...state, confidenceFilter: action.payload };
    case "SET_SEARCH_QUERY":
      return { ...state, searchQuery: action.payload };
    case "SET_BULK_OPERATION":
      return { ...state, bulkOperation: action.payload };
    case "SET_PROGRESS":
      return { ...state, progress: action.payload };
    case "SET_EXECUTING":
      return { ...state, isExecuting: action.payload };
    default:
      return state;
  }
}

const initialState: ReviewState = {
  reviewTransactions: [],
  isAnalyzing: false,
  bulkOperation: null,
  progress: null,
  isExecuting: false,
  statusFilter: 'with_suggestions',
  confidenceFilter: 'all',
  searchQuery: '',
};

export function BulkTagReview({
  isOpen,
  onOpenChange,
  transactions,
  availableTags,
  transactionTagsMap,
  onBulkTaggingComplete
}: BulkTagReviewProps) {
  const [state, dispatch] = useReducer(
    (state: ReviewState, action: ReviewAction) => reviewReducer(state, action, transactionTagsMap),
    initialState
  );
  const { toast } = useToast();

  // Generate suggestions when dialog opens
  React.useEffect(() => {
    if (isOpen && transactions.length > 0) {
      generateAllSuggestions();
    }
  }, [isOpen, transactions]);

  const generateAllSuggestions = async () => {
    dispatch({ type: "SET_ANALYZING", payload: true });
    try {
      autoTaggingService.initialize(availableTags, transactionTagsMap, transactions);
      const autoTagResults = autoTaggingService.generateBulkSuggestions(transactions);
      dispatch({ type: "SET_TRANSACTIONS", payload: autoTagResults });
    } catch (error) {
      console.error('Failed to generate bulk suggestions:', error);
      toast({
        title: "Error",
        description: "Failed to generate tag suggestions",
        variant: "destructive",
      });
    } finally {
      dispatch({ type: "SET_ANALYZING", payload: false });
    }
  };

  // Memoize filtered transactions
  const filteredTransactions = useMemo(() => {
    return state.reviewTransactions.filter(item => {
      // Status filter
      if (state.statusFilter === 'with_suggestions' && item.suggestions.length === 0) return false;
      if (state.statusFilter === 'no_suggestions' && item.suggestions.length > 0) return false;

      // Confidence filter
      if (state.confidenceFilter !== 'all' && item.suggestions.length > 0) {
        const confidence = item.suggestions[0].confidence;
        switch (state.confidenceFilter) {
          case 'high':
            if (confidence < 0.8) return false;
            break;
          case 'medium':
            if (confidence < 0.6 || confidence >= 0.8) return false;
            break;
          case 'low':
            if (confidence >= 0.6) return false;
            break;
        }
      }

      // Search filter
      if (state.searchQuery.trim()) {
        const query = state.searchQuery.toLowerCase();
        return (
          item.transaction.narration.toLowerCase().includes(query) ||
          item.transaction.merchant?.toLowerCase().includes(query) ||
          item.transaction.upiId?.toLowerCase().includes(query)
        );
      }

      return true;
    });
  }, [state.reviewTransactions, state.statusFilter, state.confidenceFilter, state.searchQuery]);

  // Memoized event handlers
  const handleToggleSelect = useCallback((index: number) => {
    // Find the actual transaction index in the unfiltered list
    const targetTransaction = filteredTransactions[index];
    const originalIndex = state.reviewTransactions.findIndex(
      item => item.transaction.chqRefNumber === targetTransaction.transaction.chqRefNumber
    );
    if (originalIndex !== -1) {
      dispatch({ type: "TOGGLE_SELECT", payload: originalIndex });
    }
  }, [filteredTransactions, state.reviewTransactions]);

  const handleToggleExpand = useCallback((index: number) => {
    // Find the actual transaction index in the unfiltered list
    const targetTransaction = filteredTransactions[index];
    const originalIndex = state.reviewTransactions.findIndex(
      item => item.transaction.chqRefNumber === targetTransaction.transaction.chqRefNumber
    );
    if (originalIndex !== -1) {
      dispatch({ type: "TOGGLE_EXPAND", payload: originalIndex });
    }
  }, [filteredTransactions, state.reviewTransactions]);

  const handleSelectAll = useCallback((select: boolean) => {
    dispatch({ type: "SELECT_ALL", payload: select });
  }, []);

  const handleSelectHighConfidence = useCallback(() => {
    dispatch({ type: "SELECT_BY_CONFIDENCE", payload: 0.8 });
  }, []);

  const executeBulkTagging = async () => {
    const selectedTransactions = state.reviewTransactions.filter(item => 
      item.isSelected && item.suggestions.length > 0
    );

    if (selectedTransactions.length === 0) {
      toast({
        title: "No Selection",
        description: "Please select transactions to tag",
        variant: "destructive",
      });
      return;
    }

    dispatch({ type: "SET_EXECUTING", payload: true });

    try {
      const autoTagResults: AutoTagResult[] = selectedTransactions.map(item => ({
        transaction: item.transaction,
        suggestions: item.suggestions,
        autoApplied: false
      }));

      const operation = bulkTaggingManager.prepareBulkTaggingFromSuggestions(
        autoTagResults,
        { 
          batchSize: 20,
          confirmationRequired: false,
          allowDuplicates: false
        }
      );

      dispatch({ type: "SET_BULK_OPERATION", payload: operation });

      bulkTaggingManager.onProgress(operation.id, (progressUpdate) => {
        dispatch({ type: "SET_PROGRESS", payload: progressUpdate });
      });

      const completedOperation = await bulkTaggingManager.executeBulkTagging(operation.id);
      
      toast({
        title: "Bulk Tagging Complete",
        description: `Successfully tagged ${completedOperation.processedTransactions} transactions`,
      });

      onBulkTaggingComplete?.(completedOperation);

      setTimeout(() => {
        onOpenChange(false);
      }, 1500);

    } catch (error) {
      console.error('Bulk tagging failed:', error);
      toast({
        title: "Error",
        description: "Failed to complete bulk tagging operation",
        variant: "destructive",
      });
    } finally {
      dispatch({ type: "SET_EXECUTING", payload: false });
    }
  };

  const undoBulkTagging = async () => {
    if (!state.bulkOperation) return;

    try {
      const success = await bulkTaggingManager.undoBulkTagging(state.bulkOperation.id);
      if (success) {
        toast({
          title: "Undo Complete",
          description: "Bulk tagging operation has been reversed",
        });
        dispatch({ type: "SET_BULK_OPERATION", payload: null });
        dispatch({ type: "SET_PROGRESS", payload: null });
      } else {
        throw new Error("Undo operation failed");
      }
    } catch (error) {
      toast({
        title: "Undo Failed",
        description: "Could not reverse the bulk tagging operation",
        variant: "destructive",
      });
    }
  };

  const selectedCount = filteredTransactions.filter(item => item.isSelected).length;
  const totalSuggestions = filteredTransactions.reduce((sum, item) => sum + item.suggestions.length, 0);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] p-6 flex flex-col gap-4">
        <DialogHeader className="space-y-2">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="h-5 w-5 text-primary" />
            Bulk Tag Review & Apply
          </DialogTitle>
          <DialogDescription className="text-base">
            Review and apply AI-generated tag suggestions to multiple transactions
          </DialogDescription>
        </DialogHeader>

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4">
          <Card className="p-3">
            <div className="text-sm text-muted-foreground">Total Transactions</div>
            <div className="text-xl font-bold">{transactions.length}</div>
          </Card>
          <Card className="p-3">
            <div className="text-sm text-muted-foreground">With Suggestions</div>
            <div className="text-xl font-bold">
              {state.reviewTransactions.filter(t => t.suggestions.length > 0).length}
            </div>
          </Card>
          <Card className="p-3">
            <div className="text-sm text-muted-foreground">Selected</div>
            <div className="text-xl font-bold text-primary">{selectedCount}</div>
          </Card>
          <Card className="p-3">
            <div className="text-sm text-muted-foreground">Total Tags</div>
            <div className="text-xl font-bold">{totalSuggestions}</div>
          </Card>
        </div>

        <FilterControls
          statusFilter={state.statusFilter}
          confidenceFilter={state.confidenceFilter}
          searchQuery={state.searchQuery}
          onStatusFilterChange={(value) => dispatch({ type: "SET_STATUS_FILTER", payload: value })}
          onConfidenceFilterChange={(value) => dispatch({ type: "SET_CONFIDENCE_FILTER", payload: value })}
          onSearchQueryChange={(value) => dispatch({ type: "SET_SEARCH_QUERY", payload: value })}
          onSelectAll={handleSelectAll}
          onSelectHighConfidence={handleSelectHighConfidence}
        />

        {/* Progress Bar (if executing) */}
        {state.progress && (
          <Card className="p-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Processing...</span>
                <span className="text-sm text-muted-foreground">
                  {state.progress.completed} / {state.progress.total}
                </span>
              </div>
              <Progress value={(state.progress.completed / state.progress.total) * 100} />
              {state.progress.currentTransaction && (
                <p className="text-xs text-muted-foreground truncate">
                  Current: {state.progress.currentTransaction}
                </p>
              )}
              {state.progress.errors.length > 0 && (
                <p className="text-xs text-red-600">
                  {state.progress.errors.length} error(s) encountered
                </p>
              )}
            </div>
          </Card>
        )}

        {/* Main content area - Transaction List */}
        <div className="flex-1 min-h-0 overflow-hidden rounded-lg border bg-card">
          {state.isAnalyzing ? (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground bg-background/80">
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white shadow-sm border">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Analyzing {transactions.length} transactions...</span>
              </div>
            </div>
          ) : filteredTransactions.length > 0 ? (
          <VirtualizedTransactionList
            transactions={filteredTransactions}
            onToggleSelect={handleToggleSelect}
            onToggleExpand={handleToggleExpand}
          />
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              No transactions match the current filters
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <div className="flex gap-2 mr-auto">
            {state.bulkOperation?.status === 'completed' && (
              <Button 
                variant="outline" 
                onClick={undoBulkTagging}
                className="text-red-600 hover:text-red-700"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Undo
              </Button>
            )}
          </div>

          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={state.isExecuting}
          >
            Cancel
          </Button>
          
          <Button 
            onClick={executeBulkTagging}
            disabled={selectedCount === 0 || state.isExecuting || state.isAnalyzing}
            className="min-w-[140px]"
          >
            {state.isExecuting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Processing...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Apply Tags ({selectedCount})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
