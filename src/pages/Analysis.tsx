import React, { useState, useEffect } from "react";
import { SuperStatementManager } from "@/utils/superStatementManager";
import { useAuth } from "@/context/AuthContext";
import { Maximize2, Minimize2 } from "lucide-react";
import { Transaction, StatementSummary } from "@/types/transaction";
import { Tag } from "@/types/tags";
import { TransactionTags } from "@/components/TransactionTags";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarDateRange } from "@/types/transaction";
import { Calendar } from "@/components/ui/calendar";
import { TagFilter } from "@/components/TagFilter";
import { useSearchParams } from "react-router-dom";
import { tagManager } from "@/utils/tagManager";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const superStatementManager = new SuperStatementManager();

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(amount);
}

export default function Analysis() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<StatementSummary | null>(null);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [loadingProgress, setLoadingProgress] = useState({ loaded: 0, total: 0 });
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [isTableFullScreen, setIsTableFullScreen] = useState(false);
  // Initialize date range from URL params
  const initDateRange = (): CalendarDateRange | undefined => {
    const fromStr = searchParams.get("from");
    const toStr = searchParams.get("to");
    if (!fromStr) return undefined;

    const range: CalendarDateRange = {
      from: new Date(fromStr),
    };
    if (toStr) {
      range.to = new Date(toStr);
    }
    return range;
  };

  const [dateRange, setDateRange] = useState<CalendarDateRange | undefined>(
    initDateRange()
  );
  const [loading, setLoading] = useState(true);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [transactionTags, setTransactionTags] = useState<Map<string, Tag[]>>(
    new Map()
  );

  useEffect(() => {
    const loadSuperStatement = async () => {
      if (!user) return;

      try {
        const [txns, sum] = await Promise.all([
          superStatementManager.getSuperStatementTransactions(user.id),
          superStatementManager.getSuperStatementSummary(user.id),
        ]);

        setTransactions(txns);
        setFilteredTransactions(txns);
        setSummary(sum);
      } catch (error) {
        console.error("Error loading super statement:", error);
      } finally {
        setLoading(false);
      }
    };

    loadSuperStatement();
  }, [user]);

  const loadTransactionTags = React.useCallback(async () => {
    if (transactions.length === 0) return;

    setLoadingProgress({ loaded: 0, total: transactions.length });
    setLoadingError(null);

    try {
      // Get all tags in one query
      const tagsMap = await tagManager.getAllTransactionTags();
      
      // Update state with complete map
      setTransactionTags(tagsMap);

      // Update progress
      setLoadingProgress({ loaded: transactions.length, total: transactions.length });

    } catch (error) {
      setLoadingError('Failed to load transaction tags');
      console.error('Tag loading error:', error);
    }
  }, [transactions]);

  // Load tags when transactions change
  useEffect(() => {
    loadTransactionTags();
  }, [loadTransactionTags]);

  useEffect(() => {
    let filtered = [...transactions];

    const monthParam = searchParams.get("month")?.toLowerCase();
    if (monthParam) {
      // Convert month name to number (0-based index)
      const months = [
        "january",
        "february",
        "march",
        "april",
        "may",
        "june",
        "july",
        "august",
        "september",
        "october",
        "november",
        "december",
      ];
      const targetMonth = months.indexOf(monthParam);
      if (targetMonth !== -1) {
        // Get all matching month transactions
        filtered = filtered.filter((tx) => tx.date.getMonth() === targetMonth);

        // Find latest year for this month
        if (filtered.length > 0) {
          const latestYear = Math.max(
            ...filtered.map((tx) => tx.date.getFullYear())
          );
          filtered = filtered.filter(
            (tx) => tx.date.getFullYear() === latestYear
          );
        }
      }
    } else if (dateRange?.from) {
      filtered = filtered.filter(
        (tx) =>
          tx.date >= dateRange.from &&
          (!dateRange.to || tx.date <= dateRange.to)
      );
    }

    // Apply tag filtering
    if (selectedTagIds.length > 0) {
      const selectedTagsSet = new Set(selectedTagIds);
      filtered = filtered.filter(tx => {
        const txTags = transactionTags.get(tx.chqRefNumber) || [];
        // Check if any of the transaction's tags are in the selected set
        return txTags.some(tag => selectedTagsSet.has(tag.id));
      });
    }

    setFilteredTransactions(filtered);
  }, [dateRange, transactions, selectedTagIds, transactionTags, searchParams]);

  // Memoize summary stats calculation to avoid recalculation on every render
  const summaryStats = React.useMemo(() => ({
    totalTransactions: filteredTransactions.length,
    totalDebit: filteredTransactions.reduce(
      (sum, tx) => sum + tx.debitAmount,
      0
    ),
    totalCredit: filteredTransactions.reduce(
      (sum, tx) => sum + tx.creditAmount,
      0
    ),
    netCashflow: filteredTransactions.reduce(
      (sum, tx) => sum + (tx.creditAmount - tx.debitAmount),
      0
    ),
  }), [filteredTransactions]);

  const handleTagsChange = async (chqRefNumber: string) => {
    try {
      const updatedTags = await tagManager.getTransactionTags(chqRefNumber);
      setTransactionTags((prevMap) => {
        const newMap = new Map(prevMap);
        newMap.set(chqRefNumber, updatedTags);
        return newMap;
      });
    } catch (error) {
      console.error(`Error refreshing tags for transaction:`, error);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }


  function getPayeeName(narration: string) {
    return narration?.split("-")[1] || "UPI Transaction";
  }

  function getDescription(narration: string) {
    const parts = narration?.split("-");
    if (parts.length > 4)
      return parts
        .slice(4)
        .join(" ")
        .replace(/[^a-zA-Z0-9\s]/g, "")
        .trim();
    return null;
  }

  function getUpiOnly(upiId: string) {
    return upiId?.split("-")[0];
  }

  return (
    <div className="container mx-auto py-6 max-w-7xl">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
          <h1 className="text-3xl font-bold mb-4 md:mb-0">
            Transaction Analysis
          </h1>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDateRange(undefined);
                setSelectedTagIds([]);
                // Clear URL params
                searchParams.delete("from");
                searchParams.delete("to");
                setSearchParams(searchParams);
              }}
              className="text-sm"
            >
              Clear Filters
            </Button>
          </div>
        </div>

        {/* Loading Progress */}
        {loadingProgress.total > 0 && loadingProgress.loaded < loadingProgress.total && (
          <div className="mb-4 bg-blue-50 rounded-lg px-4 py-3 shadow">
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm text-blue-700 font-medium">
                Loading transaction tags...
              </span>
              <span className="text-xs text-blue-600">
                {Math.round((loadingProgress.loaded / loadingProgress.total) * 100)}%
              </span>
            </div>
            <div className="w-full bg-blue-100 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${(loadingProgress.loaded / loadingProgress.total) * 100}%`
                }}
              />
            </div>
          </div>
        )}

        {/* Error Message */}
        {loadingError && (
          <div className="mb-4 bg-red-50 border border-red-100 rounded-lg px-4 py-3">
            <div className="text-sm text-red-600">
              {loadingError}
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <h3 className="text-sm font-medium text-gray-500">
              Total Transactions
            </h3>
            <p className="text-2xl font-bold">
              {summaryStats.totalTransactions}
            </p>
            {filteredTransactions.length > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                {formatDate(
                  filteredTransactions.reduce(
                    (min, tx) => (tx.date < min ? tx.date : min),
                    filteredTransactions[0].date
                  )
                )}{" "}
                -{" "}
                {formatDate(
                  filteredTransactions.reduce(
                    (max, tx) => (tx.date > max ? tx.date : max),
                    filteredTransactions[0].date
                  )
                )}
              </p>
            )}
          </Card>
          <Card className="p-4">
            <h3 className="text-sm font-medium text-gray-500">Total Debit</h3>
            <p className="text-2xl font-bold text-red-600">
              {formatAmount(summaryStats.totalDebit)}
            </p>
          </Card>
          <Card className="p-4">
            <h3 className="text-sm font-medium text-gray-500">Total Credit</h3>
            <p className="text-2xl font-bold text-green-600">
              {formatAmount(summaryStats.totalCredit)}
            </p>
          </Card>
          <Card className="p-4">
            <h3 className="text-sm font-medium text-gray-500">Net Cashflow</h3>
            <p
              className={`text-2xl font-bold ${
                summaryStats.netCashflow >= 0
                  ? "text-green-600"
                  : "text-red-600"
              }`}
            >
              {formatAmount(summaryStats.netCashflow)}
            </p>
          </Card>
        </div>

        {/* Main Content */}
        <div className="flex flex-col gap-6 items-center justify-center">
          {/* Left side: Calendar */}
          <div className="flex-1">
            <Card className="p-4">
              <h2 className="text-lg font-semibold mb-4">Date Range</h2>
              <Calendar
                mode="range"
                selected={dateRange}
                onSelect={(range) => {
                  setDateRange(range || undefined);

                  // Update URL params
                  if (!range) {
                    searchParams.delete("from");
                    searchParams.delete("to");
                  } else {
                    searchParams.set("from", range.from.toISOString());
                    if (range.to) {
                      searchParams.set("to", range.to.toISOString());
                    } else {
                      searchParams.delete("to");
                    }
                  }
                  setSearchParams(searchParams);
                }}
                numberOfMonths={1}
                className="rounded-md border"
              />
            </Card>
          </div>

          {/* Right side: Tag Filter and Transaction List */}
          <div className="flex-1">
            <Card className="p-4">
              <h2 className="text-lg font-semibold mb-4">Filter by Tags</h2>
              <TagFilter
                onTagSelect={setSelectedTagIds}
                selectedTagIds={selectedTagIds}
              />
            </Card>
          </div>

          {/* Transactions Table */}
          <Card className={`${isTableFullScreen ? 'fixed inset-0 z-50 m-0 rounded-none' : ''}`}>
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-4">
                <h2 className="text-lg font-semibold">Transactions</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  className="hidden md:flex items-center gap-2"
                  onClick={() => setIsTableFullScreen(!isTableFullScreen)}
                >
                  {isTableFullScreen ? (
                    <>
                      <Minimize2 className="h-4 w-4" />
                      Exit Full Screen
                    </>
                  ) : (
                    <>
                      <Maximize2 className="h-4 w-4" />
                      Full Screen
                    </>
                  )}
                </Button>
              </div>
              <span className="text-sm text-muted-foreground">
                Showing {filteredTransactions.length} of {transactions.length}{" "}
                transactions
              </span>
            </div>
            <div>
              {/* Desktop view */}
              <div className="hidden md:block rounded-md border">
                <div
                  className="overflow-auto"
                  style={{ 
                    maxHeight: isTableFullScreen 
                      ? "calc(100vh - 73px)" // Header height
                      : "calc(100vh - 400px)",
                    transition: "max-height 0.3s ease-in-out"
                  }}
                >
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10 border-b">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-[100px]">Date</TableHead>
                        <TableHead className="min-w-[300px]">
                          Description
                        </TableHead>
                        <TableHead className="w-[80px]">Type</TableHead>
                        <TableHead className="text-right w-[120px]">
                          Amount
                        </TableHead>
                        <TableHead className="text-right w-[120px]">
                          Balance
                        </TableHead>
                        <TableHead className="w-[200px] text-center">
                          Tags
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTransactions.map((transaction, index) => (
                        <TableRow
                          key={transaction.chqRefNumber}
                          className={`${
                            index % 2 === 0 ? "bg-muted/50" : ""
                          } transition-colors`}
                        >
                          <TableCell className="font-medium">
                            {formatDate(transaction.date)}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <div className="font-medium">
                                {getPayeeName(transaction.narration)}
                              </div>
                              {getDescription(transaction.narration) && (
                                <div className="text-sm text-muted-foreground">
                                  {getDescription(transaction.narration)}
                                </div>
                              )}
                              {transaction.upiId && (
                                <div className="text-xs text-muted-foreground font-mono">
                                  {getUpiOnly(transaction.upiId)}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                transaction.type === "credit"
                                  ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                                  : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                              }`}
                            >
                              {transaction.type}
                            </span>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            <span
                              className={`font-medium ${
                                transaction.type === "credit"
                                  ? "text-green-600 dark:text-green-400"
                                  : "text-red-600 dark:text-red-400"
                              }`}
                            >
                              {formatAmount(transaction.amount)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {formatAmount(transaction.closingBalance)}
                          </TableCell>
                          <TableCell className="text-center">
                            <TransactionTags
                              chqRefNumber={transaction.chqRefNumber}
                              tags={
                                transactionTags.get(transaction.chqRefNumber) ||
                                []
                              }
                              onTagsChange={() =>
                                handleTagsChange(transaction.chqRefNumber)
                              }
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Mobile view */}
              <div className="md:hidden rounded-md border">
                <div
                  className="space-y-4 p-4 overflow-auto"
                  style={{ maxHeight: "calc(100vh - 400px)" }}
                >
                  {filteredTransactions.map((transaction, index) => (
                    <div
                      key={transaction.chqRefNumber}
                      className={`rounded-lg border p-4 ${
                        index % 2 === 0 ? "bg-muted/50" : ""
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-medium">
                          {formatDate(transaction.date)}
                        </span>
                        <span
                          className={`inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            transaction.type === "credit"
                              ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                              : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                          }`}
                        >
                          {transaction.type}
                        </span>
                      </div>

                      <div className="space-y-1">
                        {/* Transaction Actor Name (e.g., Merchant or Person) */}
                        <div className="font-medium">
                          {getPayeeName(transaction.narration) ||
                            "UPI Transaction"}
                        </div>

                        {/* Description / Context (e.g., payment purpose) */}
                        <div className="text-sm text-muted-foreground">
                          {getDescription(transaction.narration)}
                        </div>

                        {/* UPI ID */}
                        {transaction.upiId && (
                          <div className="text-xs text-muted-foreground font-mono break-all">
                            {getUpiOnly(transaction.upiId)}
                          </div>
                        )}
                      </div>

                      <div className="flex justify-between items-center mt-3 pt-3 border-t">
                        <div className="space-y-1">
                          <div className="text-sm text-muted-foreground">
                            Amount
                          </div>
                          <div
                            className={`font-medium ${
                              transaction.type === "credit"
                                ? "text-green-600 dark:text-green-400"
                                : "text-red-600 dark:text-red-400"
                            }`}
                          >
                            {formatAmount(transaction.amount)}
                          </div>
                        </div>
                        <div className="space-y-1 text-right">
                          <div className="text-sm text-muted-foreground">
                            Balance
                          </div>
                          <div className="font-medium">
                            {formatAmount(transaction.closingBalance)}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t">
                        <div className="flex justify-center">
                          <TransactionTags
                            chqRefNumber={transaction.chqRefNumber}
                            tags={
                              transactionTags.get(transaction.chqRefNumber) ||
                              []
                            }
                            onTagsChange={() =>
                              handleTagsChange(transaction.chqRefNumber)
                            }
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
