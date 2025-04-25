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
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<StatementSummary | null>(null);
  const [filteredTransactions, setFilteredTransactions] = useState<
    Transaction[]
  >([]);
  const [dateRange, setDateRange] = useState<CalendarDateRange | undefined>();
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

    if (dateRange?.from) {
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
                {formatDate(filteredTransactions.reduce((min, tx) => 
                  tx.date < min ? tx.date : min, filteredTransactions[0].date))} - {formatDate(filteredTransactions.reduce((max, tx) => 
                  tx.date > max ? tx.date : max, filteredTransactions[0].date))}
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
                onSelect={(range) => setDateRange(range || undefined)}
                numberOfMonths={2}
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
          <Card className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Transactions</h2>
                <span className="text-sm text-muted-foreground">
                  Showing {filteredTransactions.length} of {transactions.length}{" "}
                  transactions
                </span>
              </div>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead>Tags</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransactions.map((transaction) => (
                      <TableRow key={transaction.transactionId}>
                        <TableCell>{formatDate(transaction.date)}</TableCell>
                        <TableCell>
                          <div>{transaction.narration}</div>
                          {transaction.upiId && (
                            <div className="text-sm text-gray-500">
                              UPI: {transaction.upiId}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                              transaction.type === "credit"
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {transaction.type}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={
                              transaction.type === "credit"
                                ? "text-green-600"
                                : "text-red-600"
                            }
                          >
                            {formatAmount(transaction.amount)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatAmount(transaction.closingBalance)}
                        </TableCell>
                        <TableCell>
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
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
        </div>
      </div>
    </div>
  );
}
