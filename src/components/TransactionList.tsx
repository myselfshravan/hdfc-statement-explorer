import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useTransactions } from "@/context/TransactionContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TransactionTags } from "./TransactionTags";
import { TagSuggestionDialog } from "./TagSuggestionDialog";
import { Tag } from "@/types/tags";
import { Transaction } from "@/types/transaction";
import { TagSuggestion, autoTaggingService } from "@/services/AutoTaggingService";
import { tagManager } from "@/utils/tagManager";
import { useToast } from "@/components/ui/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  Sparkles, 
  Check, 
  TrendingUp, 
  Info, 
  AlertCircle,
  Zap,
  Loader2
} from "lucide-react";

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(amount);
};

const formatDate = (date: Date): string => {
  return date.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

interface TransactionListProps {
  transactions?: Transaction[];
  isLoading?: boolean;
  showLoadMore?: boolean;
  isAnonymous?: boolean;
  enableAutoTagging?: boolean;
  showSuggestions?: boolean;
  onTagsChanged?: () => void;
}

const defaultTransactions: Transaction[] = [];

const TransactionList: React.FC<TransactionListProps> = ({ 
  transactions = defaultTransactions,
  isLoading = false,
  showLoadMore = false,
  isAnonymous = false,
  enableAutoTagging = true,
  showSuggestions = true,
  onTagsChanged
}) => {
  const { user } = useAuth();
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [transactionTagsMap, setTransactionTagsMap] = useState<Map<string, Tag[]>>(new Map());
  const [suggestions, setSuggestions] = useState<Map<string, TagSuggestion[]>>(new Map());
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isSuggestionDialogOpen, setIsSuggestionDialogOpen] = useState(false);
  const { toast } = useToast();

  // Load data when component mounts
  useEffect(() => {
    if (user && enableAutoTagging && !isAnonymous) {
      loadAutoTaggingData();
    }
  }, [user, enableAutoTagging, isAnonymous]);

  // Generate suggestions when transactions change
  useEffect(() => {
    if (availableTags.length > 0 && transactions.length > 0 && enableAutoTagging && showSuggestions) {
      generateSuggestions();
    }
  }, [transactions, availableTags, enableAutoTagging, showSuggestions]);

  const loadAutoTaggingData = async () => {
    try {
      const [tags, tagsMap] = await Promise.all([
        tagManager.getUserTags(),
        tagManager.getAllTransactionTags()
      ]);
      
      setAvailableTags(tags);
      setTransactionTagsMap(tagsMap);
      
      // Initialize auto-tagging service
      autoTaggingService.initialize(tags, tagsMap, transactions);
    } catch (error) {
      console.error('Failed to load auto-tagging data:', error);
    }
  };

  const generateSuggestions = async () => {
    if (isLoadingSuggestions) return;
    
    setIsLoadingSuggestions(true);
    try {
      const suggestionsMap = new Map<string, TagSuggestion[]>();
      
      // Generate suggestions for transactions without tags
      for (const transaction of transactions) {
        const existingTags = transactionTagsMap.get(transaction.chqRefNumber) || [];
        if (existingTags.length === 0 || showSuggestions) {
          const transactionSuggestions = autoTaggingService.generateSuggestions(transaction);
          if (transactionSuggestions.length > 0) {
            suggestionsMap.set(transaction.chqRefNumber, transactionSuggestions);
          }
        }
      }
      
      setSuggestions(suggestionsMap);
    } catch (error) {
      console.error('Failed to generate suggestions:', error);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  const handleTagsChange = () => {
    // Refresh data when tags change
    loadAutoTaggingData();
    onTagsChanged?.();
  };

  const openSuggestionDialog = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setIsSuggestionDialogOpen(true);
  };

  const quickApplyTopSuggestion = async (transaction: Transaction, suggestion: TagSuggestion) => {
    try {
      await tagManager.addTagToTransaction(transaction.chqRefNumber, suggestion.tag.id);
      
      // Learn from user action
      autoTaggingService.learnFromUserAction(transaction, [suggestion.tag]);
      
      // Remove suggestion from map
      const newSuggestions = new Map(suggestions);
      const transactionSuggestions = newSuggestions.get(transaction.chqRefNumber) || [];
      const updatedSuggestions = transactionSuggestions.filter(s => s.tag.id !== suggestion.tag.id);
      if (updatedSuggestions.length === 0) {
        newSuggestions.delete(transaction.chqRefNumber);
      } else {
        newSuggestions.set(transaction.chqRefNumber, updatedSuggestions);
      }
      setSuggestions(newSuggestions);
      
      toast({
        title: "Tag Applied",
        description: `Applied "${suggestion.tag.name}" to transaction`,
      });
      
      handleTagsChange();
    } catch (error) {
      console.error('Failed to apply suggestion:', error);
      toast({
        title: "Error",
        description: "Failed to apply tag suggestion",
        variant: "destructive",
      });
    }
  };

  const getSuggestionConfidenceIcon = (confidence: number) => {
    if (confidence >= 0.9) return <TrendingUp className="h-3 w-3" />;
    if (confidence >= 0.7) return <Info className="h-3 w-3" />;
    return <AlertCircle className="h-3 w-3" />;
  };

  const getSuggestionConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return "text-green-600";
    if (confidence >= 0.7) return "text-yellow-600";
    return "text-orange-600";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Transactions</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px] md:h-[600px] rounded-md border">
          <Table>
            <TableHeader className="sticky top-0 bg-white z-10 border-b">
              <TableRow>
                <TableHead className="w-[90px] md:w-[120px]">Date</TableHead>
                <TableHead className="min-w-[140px] md:min-w-[300px]">Description</TableHead>
                <TableHead className="hidden md:table-cell w-[120px]">Category</TableHead>
                <TableHead className="text-right w-[100px] md:w-[150px]">Amount</TableHead>
                <TableHead className="text-right hidden md:table-cell w-[150px]">Balance</TableHead>
                {!isAnonymous && (
                  <TableHead className="hidden md:table-cell w-[130px] text-center">Tags</TableHead>
                )}
                {!isAnonymous && enableAutoTagging && showSuggestions && (
                  <TableHead className="hidden md:table-cell w-[120px] text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      <span>AI</span>
                    </div>
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((transaction, index) => {
                const transactionSuggestions = suggestions.get(transaction.chqRefNumber) || [];
                const hasSuggestions = transactionSuggestions.length > 0;
                const topSuggestion = transactionSuggestions[0];
                const existingTags = transactionTagsMap.get(transaction.chqRefNumber) || [];
                
                return (
                  <TableRow key={index} className={`hover:bg-muted/50 ${
                    hasSuggestions ? 'bg-blue-50/30 dark:bg-blue-950/10' : ''
                  }`}>
                    <TableCell className="text-sm md:text-base">{formatDate(transaction.date)}</TableCell>
                    <TableCell className="max-w-[140px] md:max-w-xs truncate">
                      <div className="flex items-start gap-2">
                        <div className="flex-1">
                          <div className="text-sm md:text-base">{transaction.narration}</div>
                          {transaction.upiId && (
                            <div className="text-xs text-gray-500 truncate">
                              UPI: {transaction.upiId}
                            </div>
                          )}
                          <div className="md:hidden mt-1">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                              {transaction.category}
                            </span>
                          </div>
                          
                          {/* Mobile suggestions display */}
                          {!isAnonymous && enableAutoTagging && hasSuggestions && (
                            <div className="md:hidden mt-2">
                              <div className="flex flex-wrap gap-1">
                                {transactionSuggestions.slice(0, 2).map((suggestion) => (
                                  <Badge 
                                    key={suggestion.tag.id}
                                    variant="outline" 
                                    className="text-xs cursor-pointer hover:bg-primary/10"
                                    onClick={() => quickApplyTopSuggestion(transaction, suggestion)}
                                    style={{ borderColor: suggestion.tag.color }}
                                  >
                                    <Sparkles className="h-2 w-2 mr-1" />
                                    {suggestion.tag.name} ({Math.round(suggestion.confidence * 100)}%)
                                  </Badge>
                                ))}
                                {transactionSuggestions.length > 2 && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-5 text-xs px-2"
                                    onClick={() => openSuggestionDialog(transaction)}
                                  >
                                    +{transactionSuggestions.length - 2} more
                                  </Button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {/* Suggestion indicator */}
                        {!isAnonymous && enableAutoTagging && hasSuggestions && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className={`flex items-center ${
                                  getSuggestionConfidenceColor(topSuggestion.confidence)
                                }`}>
                                  {getSuggestionConfidenceIcon(topSuggestion.confidence)}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">
                                  {transactionSuggestions.length} suggestion{transactionSuggestions.length > 1 ? 's' : ''}
                                  <br />Top: {topSuggestion.tag.name} ({Math.round(topSuggestion.confidence * 100)}%)
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                        {transaction.category}
                      </span>
                    </TableCell>
                    <TableCell
                      className={`text-right text-sm md:text-base ${
                        transaction.type === "credit"
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {transaction.type === "credit" ? "+" : "-"}
                      {formatCurrency(transaction.amount)}
                    </TableCell>
                    <TableCell className="text-right hidden md:table-cell">
                      {formatCurrency(transaction.closingBalance)}
                    </TableCell>
                    {!isAnonymous && (
                      <TableCell className="hidden md:table-cell px-4 py-2 text-center">
                        <TransactionTags 
                          chqRefNumber={transaction.chqRefNumber}
                          tags={existingTags}
                          onTagsChange={handleTagsChange}
                        />
                      </TableCell>
                    )}
                    {!isAnonymous && enableAutoTagging && showSuggestions && (
                      <TableCell className="hidden md:table-cell px-2 py-2 text-center">
                        {isLoadingSuggestions ? (
                          <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                        ) : hasSuggestions ? (
                          <div className="flex flex-col gap-1">
                            {/* Top suggestion with quick apply */}
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-1 text-xs"
                                    onClick={() => quickApplyTopSuggestion(transaction, topSuggestion)}
                                  >
                                    <Check className="h-3 w-3 mr-1" />
                                    <span 
                                      className="w-2 h-2 rounded-full mr-1" 
                                      style={{ backgroundColor: topSuggestion.tag.color }}
                                    />
                                    {topSuggestion.tag.name}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs">
                                    Quick apply: {topSuggestion.tag.name}
                                    <br />Confidence: {Math.round(topSuggestion.confidence * 100)}%
                                    <br />Reason: {topSuggestion.reason}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            
                            {/* View all suggestions button */}
                            {transactionSuggestions.length > 1 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 px-1 text-xs text-muted-foreground"
                                onClick={() => openSuggestionDialog(transaction)}
                              >
                                <Sparkles className="h-2 w-2 mr-1" />
                                +{transactionSuggestions.length - 1} more
                              </Button>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">No suggestions</span>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {transactions.length === 0 && (
            <div className="py-8 text-center">
              <p className="text-gray-500">
                No transactions found with the selected filters
              </p>
            </div>
          )}
        </ScrollArea>
        <div className="p-4 text-sm text-gray-500 flex justify-between items-center">
          <span>{transactions.length} transactions</span>
          {!isAnonymous && enableAutoTagging && showSuggestions && (
            <div className="flex items-center gap-2 text-xs">
              {isLoadingSuggestions ? (
                <div className="flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Generating suggestions...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-primary" />
                    <span>{Array.from(suggestions.values()).reduce((sum, s) => sum + s.length, 0)} suggestions</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={generateSuggestions}
                    className="h-6 px-2 text-xs"
                  >
                    <Zap className="h-3 w-3 mr-1" />
                    Refresh
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
      
      {/* Tag Suggestion Dialog */}
      {selectedTransaction && (
        <TagSuggestionDialog
          isOpen={isSuggestionDialogOpen}
          onOpenChange={setIsSuggestionDialogOpen}
          transaction={selectedTransaction}
          availableTags={availableTags}
          currentTags={transactionTagsMap.get(selectedTransaction.chqRefNumber) || []}
          onTagsApplied={handleTagsChange}
        />
      )}
    </Card>
  );
};

export default TransactionList;
