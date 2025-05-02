import React, { useState, useEffect } from "react";
import { SuperStatementManager } from "@/utils/superStatementManager";
import { useAuth } from "@/context/AuthContext";
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
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
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
  const [filteredTransactions, setFilteredTransactions] = useState<
    Transaction[]
  >([]);
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

  useEffect(() => {
    const BATCH_SIZE = 100;

    const loadTransactionTags = async () => {
      if (transactions.length === 0) return;

      const allTransactionIds = transactions.map((t) => t.transactionId);
      const currentTagsMap = new Map(transactionTags);
      const combinedTagsMap = new Map<string, Tag[]>();

      for (let i = 0; i < allTransactionIds.length; i += BATCH_SIZE) {
        const batchIds = allTransactionIds.slice(i, i + BATCH_SIZE);
        if (batchIds.length > 0) {
          try {
            const needsFetch = batchIds.some((id) => !currentTagsMap.has(id));
            if (!needsFetch) {
              batchIds.forEach((id) => {
                if (currentTagsMap.has(id)) {
                  combinedTagsMap.set(id, currentTagsMap.get(id)!);
                }
              });
              continue;
            }

            const batchTagsMap = await tagManager.getTransactionsWithTags(
              batchIds
            );
            batchTagsMap.forEach((tags, txId) => {
              combinedTagsMap.set(txId, tags);
            });

            if (i + BATCH_SIZE < allTransactionIds.length) {
              await new Promise((resolve) => setTimeout(resolve, 200));
            }
          } catch (error) {
            console.error(`Error fetching tags for batch:`, error);
          }
        }
      }

      if (
        JSON.stringify(Array.from(combinedTagsMap.entries())) !==
        JSON.stringify(Array.from(transactionTags.entries()))
      ) {
        setTransactionTags(combinedTagsMap);
      }
    };

    loadTransactionTags();
  }, [transactions]);

  useEffect(() => {
    let filtered = [...transactions];
    
    const monthParam = searchParams.get('month')?.toLowerCase();
    if (monthParam) {
      // Convert month name to number (0-based index)
      const months = ['january', 'february', 'march', 'april', 'may', 'june', 
                     'july', 'august', 'september', 'october', 'november', 'december'];
      const targetMonth = months.indexOf(monthParam);
      if (targetMonth !== -1) {
        // Get all matching month transactions
        filtered = filtered.filter(tx => tx.date.getMonth() === targetMonth);
        
        // Find latest year for this month
        if (filtered.length > 0) {
          const latestYear = Math.max(...filtered.map(tx => tx.date.getFullYear()));
          filtered = filtered.filter(tx => tx.date.getFullYear() === latestYear);
        }
      }
    } else if (dateRange?.from) {
      filtered = filtered.filter(
        (tx) =>
          tx.date >= dateRange.from &&
          (!dateRange.to || tx.date <= dateRange.to)
      );
    }

    if (selectedTagIds.length > 0) {
      filtered = filtered.filter((tx) => {
        const txTagObjects = transactionTags?.get(tx.transactionId) || [];
        const txTagIds = txTagObjects.map((t) => t.id);
        return selectedTagIds.some((tagId) => txTagIds.includes(tagId));
      });
    }

    setFilteredTransactions(filtered);
  }, [dateRange, transactions, selectedTagIds, transactionTags]);

  const handleTagsChange = async (changedTransactionId: string) => {
    try {
      const updatedTags = await tagManager.getTransactionTags(
        changedTransactionId
      );
      setTransactionTags((prevMap) => {
        const newMap = new Map(prevMap);
        newMap.set(changedTransactionId, updatedTags);
        return newMap;
      });
    } catch (error) {
      console.error(`Error refreshing tags for transaction:`, error);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  const summaryStats = {
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
  };

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
          <Card>
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Transactions</h2>
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
                  style={{ maxHeight: "calc(100vh - 400px)" }}
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
                          key={transaction.transactionId}
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
                                {transaction.narration.split("-")[0]}
                              </div>
                              {transaction.narration.split("-").length > 1 && (
                                <div className="text-sm text-muted-foreground">
                                  {transaction.narration
                                    .split("-")
                                    .slice(1)
                                    .join("-")}
                                </div>
                              )}
                              {transaction.upiId && (
                                <div className="text-xs text-muted-foreground font-mono">
                                  {transaction.upiId}
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
                              transactionId={transaction.transactionId}
                              tags={
                                transactionTags.get(
                                  transaction.transactionId
                                ) || []
                              }
                              onTagsChange={() =>
                                handleTagsChange(transaction.transactionId)
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
                      key={transaction.transactionId}
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

                      <div className="space-y-2">
                        <div className="font-medium">
                          {transaction.narration.split("-")[0]}
                        </div>
                        {transaction.narration.split("-").length > 1 && (
                          <div className="text-sm text-muted-foreground">
                            {transaction.narration
                              .split("-")
                              .slice(1)
                              .join("-")}
                          </div>
                        )}
                        {transaction.upiId && (
                          <div className="text-xs text-muted-foreground font-mono">
                            {transaction.upiId}
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
                            transactionId={transaction.transactionId}
                            tags={
                              transactionTags.get(transaction.transactionId) ||
                              []
                            }
                            onTagsChange={() =>
                              handleTagsChange(transaction.transactionId)
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
