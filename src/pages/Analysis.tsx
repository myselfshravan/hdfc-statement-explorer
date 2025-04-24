import React, { useState, useEffect } from "react";
import { SuperStatementManager } from "@/utils/superStatementManager";
import { useAuth } from "@/context/AuthContext";
import { Transaction, StatementSummary } from "@/types/transaction";
import { TransactionTags } from "@/components/TransactionTags";
import { Card } from "@/components/ui/card";
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
  const [transactionTags, setTransactionTags] = useState<Map<string, string[]>>(
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

  // Load transaction tags
  useEffect(() => {
    const loadTransactionTags = async () => {
      if (transactions.length === 0) return;

      const tagsMap = await tagManager.getTransactionsWithTags(
        transactions.map((t) => t.transactionId)
      );

      // Convert Tags[] to tagIds[] for easier filtering
      const tagIdsMap = new Map<string, string[]>();
      tagsMap.forEach((tags, txId) => {
        tagIdsMap.set(
          txId,
          tags.map((t) => t.id)
        );
      });

      setTransactionTags(tagIdsMap);
    };

    loadTransactionTags();
  }, [transactions]);

  // Apply filters
  useEffect(() => {
    let filtered = [...transactions];

    // Apply date filter
    if (dateRange) {
      filtered = filtered.filter(
        (tx) =>
          tx.date >= dateRange.from &&
          (!dateRange.to || tx.date <= dateRange.to)
      );
    }

    // Apply tag filter
    if (selectedTagIds.length > 0) {
      filtered = filtered.filter((tx) => {
        const txTags = transactionTags.get(tx.transactionId) || [];
        return selectedTagIds.some((tagId) => txTags.includes(tagId));
      });
    }

    setFilteredTransactions(filtered);
  }, [dateRange, transactions, selectedTagIds, transactionTags]);

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
    <div className="container mx-auto py-6 space-y-6">
      <h1 className="text-3xl font-bold">Transaction Analysis</h1>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Date Range Filter */}
        <Card className="p-4">
          <h2 className="text-lg font-semibold mb-4">Date Range Filter</h2>
          <Calendar
            mode="range"
            selected={dateRange}
            onSelect={(range) => setDateRange(range || undefined)}
            numberOfMonths={2}
            className="rounded-md border"
          />
        </Card>

        {/* Tag Filter */}
        <TagFilter onTagSelect={setSelectedTagIds} />
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <h3 className="text-sm font-medium text-gray-500">
            Total Transactions
          </h3>
          <p className="text-2xl font-bold">{summaryStats.totalTransactions}</p>
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
              summaryStats.netCashflow >= 0 ? "text-green-600" : "text-red-600"
            }`}
          >
            {formatAmount(summaryStats.netCashflow)}
          </p>
        </Card>
      </div>

      {/* Transactions Table */}
      <Card className="p-4">
        <h2 className="text-lg font-semibold mb-4">Transactions</h2>
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
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
