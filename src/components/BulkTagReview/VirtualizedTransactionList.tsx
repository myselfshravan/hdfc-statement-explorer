import React, { useRef, useCallback, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Transaction } from "@/types/transaction";
import { Tag } from "@/types/tags";
import { TagSuggestion } from "@/services/AutoTaggingService";
import { TransactionListItem } from "./TransactionListItem";

interface VirtualizedTransactionListProps {
  transactions: Array<{
    transaction: Transaction;
    suggestions: TagSuggestion[];
    currentTags: Tag[];
    isSelected: boolean;
    isExpanded: boolean;
  }>;
  onToggleSelect: (index: number) => void;
  onToggleExpand: (index: number) => void;
}

export function VirtualizedTransactionList({
  transactions,
  onToggleSelect,
  onToggleExpand,
}: VirtualizedTransactionListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  // Minimum height for non-expanded + buffer for expanded
  const estimateSize = useCallback((index: number) => {
    const item = transactions[index];
    return item.isExpanded ? 260 : 160; // Account for expanded state
  }, [transactions]);

  // Memoize virtualizer configuration
  const rowVirtualizer = useVirtualizer({
    count: transactions.length,
    getScrollElement: () => parentRef.current,
    estimateSize,
    overscan: 5,
    paddingStart: 8,
    paddingEnd: 8
  });

  const virtualItems = rowVirtualizer.getVirtualItems();

  // Optimize rendering with double buffering
  const [isScrolling, setIsScrolling] = React.useState(false);
  React.useEffect(() => {
    if (!parentRef.current) return;
    
    const scrollElement = parentRef.current;
    let scrollTimeout: NodeJS.Timeout;

    const handleScroll = () => {
      setIsScrolling(true);
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => setIsScrolling(false), 150);
    };

    scrollElement.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      scrollElement.removeEventListener('scroll', handleScroll);
      clearTimeout(scrollTimeout);
    };
  }, []);

  // Smooth scroll handler
  const smoothScroll = useCallback((element: HTMLDivElement, top: number) => {
    element.scrollTo({
      top,
      behavior: 'smooth'
    });
  }, []);

  if (!transactions || transactions.length === 0) {
    return (
      <div className="h-[400px] w-full flex items-center justify-center text-muted-foreground">
        No transactions to display
      </div>
    );
  }

  return (
    <div 
      ref={parentRef} 
      className="h-[500px] w-full overflow-y-auto bg-background px-4"
    >
      {/* Virtual list container */}
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
          className="relative"
        >
        {virtualItems.map((virtualItem) => {
          if (!transactions[virtualItem.index]) return null; // Guard against race conditions
          const item = transactions[virtualItem.index];
          return (
            <div
              key={`${item.transaction.chqRefNumber}-${virtualItem.index}`}
              data-key={`${item.transaction.chqRefNumber}-${virtualItem.index}`}
              style={{
                position: 'absolute',
                top: virtualItem.start,
                left: 0,
                width: '100%',
                minHeight: virtualItem.size,
                padding: '4px'
              }}
              onTransitionEnd={() => {
                if (item.isExpanded) {
                  smoothScroll(parentRef.current!, virtualItem.start);
                }
              }}
            >
              <TransactionListItem
                transaction={item.transaction}
                suggestions={item.suggestions}
                currentTags={item.currentTags}
                isSelected={item.isSelected}
                isExpanded={item.isExpanded}
                onSelect={(checked) => onToggleSelect(virtualItem.index)}
                onExpand={() => onToggleExpand(virtualItem.index)}
              />
            </div>
          );
        })}
        </div>
    </div>
  );
}
