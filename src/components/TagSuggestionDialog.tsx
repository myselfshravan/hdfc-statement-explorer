import React, { useState, useEffect } from "react";
import { Transaction } from "@/types/transaction";
import { Tag } from "@/types/tags";
import { TagSuggestion, autoTaggingService } from "@/services/AutoTaggingService";
import { tagManager } from "@/utils/tagManager";
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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Sparkles, 
  Check, 
  X, 
  Info, 
  Clock, 
  TrendingUp,
  AlertCircle,
  Loader2
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface TagSuggestionDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction;
  availableTags: Tag[];
  currentTags: Tag[];
  onTagsApplied?: (appliedTags: Tag[]) => void;
}

interface SuggestionWithState extends TagSuggestion {
  isSelected: boolean;
  isApplying: boolean;
}

export function TagSuggestionDialog({
  isOpen,
  onOpenChange,
  transaction,
  availableTags,
  currentTags,
  onTagsApplied
}: TagSuggestionDialogProps) {
  const [suggestions, setSuggestions] = useState<SuggestionWithState[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const { toast } = useToast();

  // Generate suggestions when dialog opens
  useEffect(() => {
    if (isOpen && transaction) {
      generateSuggestions();
    }
  }, [isOpen, transaction]);

  const generateSuggestions = async () => {
    setIsLoading(true);
    try {
      // Initialize the auto-tagging service with available tags
      autoTaggingService.initialize(availableTags, new Map(), [transaction]);
      
      const rawSuggestions = autoTaggingService.generateSuggestions(transaction);
      
      // Filter out tags that are already applied
      const filteredSuggestions = rawSuggestions.filter(suggestion =>
        !currentTags.some(currentTag => currentTag.id === suggestion.tag.id)
      );

      // Convert to suggestions with state
      const suggestionsWithState: SuggestionWithState[] = filteredSuggestions.map(suggestion => ({
        ...suggestion,
        isSelected: suggestion.confidence >= 0.8, // Auto-select high-confidence suggestions
        isApplying: false
      }));

      setSuggestions(suggestionsWithState);
    } catch (error) {
      console.error('Failed to generate suggestions:', error);
      toast({
        title: "Error",
        description: "Failed to generate tag suggestions",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSuggestion = (index: number) => {
    setSuggestions(prev => prev.map((suggestion, i) => 
      i === index 
        ? { ...suggestion, isSelected: !suggestion.isSelected }
        : suggestion
    ));
  };

  const applySelectedTags = async () => {
    const selectedSuggestions = suggestions.filter(s => s.isSelected);
    if (selectedSuggestions.length === 0) {
      return;
    }

    setIsApplying(true);

    try {
      const tagsToApply = selectedSuggestions.map(s => s.tag);
      
      // Apply tags one by one for better error handling
      for (const tag of tagsToApply) {
        await tagManager.addTagToTransaction(transaction.chqRefNumber, tag.id);
      }

      // Learn from user action
      autoTaggingService.learnFromUserAction(transaction, tagsToApply);

      toast({
        title: "Tags Applied",
        description: `Applied ${tagsToApply.length} tag${tagsToApply.length > 1 ? 's' : ''} successfully`,
      });

      // Notify parent component
      onTagsApplied?.(tagsToApply);

      // Close dialog
      onOpenChange(false);

    } catch (error) {
      console.error('Failed to apply tags:', error);
      toast({
        title: "Error",
        description: "Failed to apply some tags. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsApplying(false);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return "text-green-600";
    if (confidence >= 0.7) return "text-yellow-600";
    return "text-orange-600";
  };

  const getConfidenceIcon = (confidence: number) => {
    if (confidence >= 0.9) return <TrendingUp className="h-3 w-3" />;
    if (confidence >= 0.7) return <Info className="h-3 w-3" />;
    return <AlertCircle className="h-3 w-3" />;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Tag Suggestions
          </DialogTitle>
          <DialogDescription>
            Review AI-generated tag suggestions for this transaction
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Transaction Details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Transaction Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Date:</span>
                  <span className="ml-2">{formatDate(transaction.date)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Amount:</span>
                  <span className={`ml-2 font-medium ${
                    transaction.type === 'credit' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {transaction.type === 'credit' ? '+' : '-'}{formatCurrency(transaction.amount)}
                  </span>
                </div>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">Description:</span>
                <p className="mt-1 text-sm bg-muted p-2 rounded">
                  {transaction.narration}
                </p>
              </div>
              {transaction.merchant && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Merchant:</span>
                  <span className="ml-2">{transaction.merchant}</span>
                </div>
              )}
              {transaction.upiId && (
                <div className="text-sm">
                  <span className="text-muted-foreground">UPI ID:</span>
                  <span className="ml-2 font-mono text-xs">{transaction.upiId}</span>
                </div>
              )}
              
              {/* Current Tags */}
              {currentTags.length > 0 && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Current Tags:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {currentTags.map(tag => (
                      <Badge 
                        key={tag.id}
                        style={{ backgroundColor: tag.color }}
                        className="text-white text-xs"
                      >
                        {tag.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Suggestions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                AI Suggestions
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  Analyzing transaction...
                </div>
              ) : suggestions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                  No suggestions found for this transaction
                </div>
              ) : (
                <ScrollArea className="max-h-60">
                  <div className="space-y-3">
                    {suggestions.map((suggestion, index) => (
                      <div 
                        key={suggestion.tag.id}
                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          suggestion.isSelected 
                            ? 'bg-primary/5 border-primary/30' 
                            : 'hover:bg-muted/50'
                        }`}
                        onClick={() => toggleSuggestion(index)}
                      >
                        <Checkbox 
                          checked={suggestion.isSelected}
                          onChange={() => toggleSuggestion(index)}
                          className="mt-0.5"
                        />
                        
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge 
                              style={{ backgroundColor: suggestion.tag.color }}
                              className="text-white text-xs"
                            >
                              {suggestion.tag.name}
                            </Badge>
                            
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className={`flex items-center gap-1 text-xs ${getConfidenceColor(suggestion.confidence)}`}>
                                    {getConfidenceIcon(suggestion.confidence)}
                                    <span>{Math.round(suggestion.confidence * 100)}%</span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Confidence: {(suggestion.confidence * 100).toFixed(1)}%</p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {suggestion.confidence >= 0.9 ? 'Very High' :
                                     suggestion.confidence >= 0.7 ? 'High' : 'Medium'}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                          
                          <p className="text-xs text-muted-foreground">
                            {suggestion.reason}
                          </p>
                          
                          {suggestion.matchedKeywords.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {suggestion.matchedKeywords.map(keyword => (
                                <span 
                                  key={keyword}
                                  className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs bg-muted text-muted-foreground"
                                >
                                  {keyword}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={isApplying}
          >
            Cancel
          </Button>
          
          <Button 
            onClick={applySelectedTags}
            disabled={suggestions.filter(s => s.isSelected).length === 0 || isApplying}
            className="min-w-[100px]"
          >
            {isApplying ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Applying...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Apply ({suggestions.filter(s => s.isSelected).length})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}