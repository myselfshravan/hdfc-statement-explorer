import React from "react";
import { Transaction } from "@/types/transaction";
import { Tag } from "@/types/tags";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, ChevronUp } from "lucide-react";
import { TagSuggestion } from "@/services/AutoTaggingService";

interface TransactionListItemProps {
  transaction: Transaction;
  suggestions: TagSuggestion[];
  currentTags: Tag[];
  isSelected: boolean;
  isExpanded: boolean;
  onSelect: (checked: boolean) => void;
  onExpand: () => void;
}

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

function TransactionListItemComponent({
  transaction,
  suggestions,
  currentTags,
  isSelected,
  isExpanded,
  onSelect,
  onExpand,
}: TransactionListItemProps) {
  return (
    <div className="p-4 border rounded-lg bg-white">
      <div className="flex items-start gap-3">
        <Checkbox 
          checked={isSelected}
          onCheckedChange={onSelect}
          className="mt-1"
          disabled={suggestions.length === 0}
        />
        
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">
                {formatDate(transaction.date)}
              </span>
              <span className={`text-sm font-medium ${
                transaction.type === 'credit' ? 'text-green-600' : 'text-red-600'
              }`}>
                {transaction.type === 'credit' ? '+' : '-'}{formatCurrency(transaction.amount)}
              </span>
              {currentTags.length > 0 && (
                <div className="flex gap-1">
                  {currentTags.slice(0, 2).map(tag => (
                    <Badge key={tag.id} variant="outline" className="text-xs">
                      {tag.name}
                    </Badge>
                  ))}
                  {currentTags.length > 2 && (
                    <Badge variant="outline" className="text-xs">
                      +{currentTags.length - 2}
                    </Badge>
                  )}
                </div>
              )}
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={onExpand}
              disabled={suggestions.length === 0}
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
          
          <p className="text-sm text-muted-foreground truncate">
            {transaction.narration}
          </p>

          {suggestions.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Suggestions:</span>
              <div className="flex flex-wrap gap-2">
                {(isExpanded ? suggestions : suggestions.slice(0, 3)).map(suggestion => (
                  <Badge 
                    key={suggestion.tag.id}
                    style={{ backgroundColor: suggestion.tag.color }}
                    className="text-white text-xs"
                  >
                    {suggestion.tag.name}
                    <span className="ml-1 opacity-75">
                      {Math.round(suggestion.confidence * 100)}%
                    </span>
                  </Badge>
                ))}
                {!isExpanded && suggestions.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{suggestions.length - 3} more
                  </Badge>
                )}
              </div>
            </div>
          )}

          {isExpanded && suggestions.length > 0 && (
            <div className="space-y-2 mt-3 pt-3 border-t">
              {suggestions.map(suggestion => (
                <div key={suggestion.tag.id} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                  <div className="flex items-center gap-2">
                    <Badge 
                      style={{ backgroundColor: suggestion.tag.color }}
                      className="text-white text-xs"
                    >
                      {suggestion.tag.name}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {Math.round(suggestion.confidence * 100)}% confidence
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground max-w-md truncate">
                    {suggestion.reason}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export const TransactionListItem = React.memo(TransactionListItemComponent);
