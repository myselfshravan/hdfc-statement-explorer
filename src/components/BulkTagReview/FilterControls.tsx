import React, { memo } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Filter, Search } from "lucide-react";
import { debounce } from "lodash";

export type ConfidenceFilter = 'all' | 'high' | 'medium' | 'low';
export type StatusFilter = 'all' | 'with_suggestions' | 'no_suggestions';

interface FilterControlsProps {
  statusFilter: StatusFilter;
  confidenceFilter: ConfidenceFilter;
  searchQuery: string;
  onStatusFilterChange: (value: StatusFilter) => void;
  onConfidenceFilterChange: (value: ConfidenceFilter) => void;
  onSearchQueryChange: (value: string) => void;
  onSelectAll: (select: boolean) => void;
  onSelectHighConfidence: () => void;
}

function FilterControlsComponent({
  statusFilter,
  confidenceFilter,
  searchQuery,
  onStatusFilterChange,
  onConfidenceFilterChange,
  onSearchQueryChange,
  onSelectAll,
  onSelectHighConfidence,
}: FilterControlsProps) {
  // Debounce the search handler
  const debouncedSearch = React.useMemo(
    () => debounce((value: string) => onSearchQueryChange(value), 300),
    [onSearchQueryChange]
  );

  // Cleanup debounce on unmount
  React.useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4" />
        <span className="text-sm font-medium">Filters:</span>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label htmlFor="transaction-filter">Transaction Type</Label>
          <Select value={statusFilter} onValueChange={onStatusFilterChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Transactions</SelectItem>
              <SelectItem value="with_suggestions">With Suggestions</SelectItem>
              <SelectItem value="no_suggestions">No Suggestions</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="confidence-filter">Confidence Level</Label>
          <Select value={confidenceFilter} onValueChange={onConfidenceFilterChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Confidence</SelectItem>
              <SelectItem value="high">High (80%+)</SelectItem>
              <SelectItem value="medium">Medium (60-80%)</SelectItem>
              <SelectItem value="low">Low (&lt;60%)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="search">Search Transactions</Label>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="search"
              placeholder="Search narration, merchant, UPI..."
              value={searchQuery}
              onChange={(e) => debouncedSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </div>

      <Separator className="my-4" />

      <div className="flex flex-wrap gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onSelectAll(true)}
        >
          Select All
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => onSelectAll(false)}
        >
          Clear All
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={onSelectHighConfidence}
        >
          High Confidence Only
        </Button>
      </div>
    </div>
  );
}

export const FilterControls = memo(FilterControlsComponent);
