import React, { useState, useEffect } from "react";
import { SuperStatementManager } from "@/utils/superStatementManager";
import { useAuth } from "@/context/AuthContext";
import { Transaction, StatementSummary } from "@/types/transaction";
import { Tag } from "@/types/tags"; // Added Tag import
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
  const [transactionTags, setTransactionTags] = useState<Map<string, Tag[]>>( // Changed to store Tag[]
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
        setFilteredTransactions(txns); // Initialize filtered with all transactions
        setSummary(sum);
      } catch (error) {
        console.error("Error loading super statement:", error);
      } finally {
        setLoading(false);
      }
    };

    loadSuperStatement();
  }, [user]);

  // Load transaction tags in batches - RE-ENABLED
  useEffect(() => {
    const BATCH_SIZE = 100; // Reduced batch size for testing

    const loadTransactionTags = async () => {
      if (transactions.length === 0) {
        console.log("No transactions, skipping tag fetch."); // Added logging
        return;
      }

      const allTransactionIds = transactions.map((t) => t.transactionId);
      // Create a copy to avoid modifying the state directly during iteration
      const currentTagsMap = new Map(transactionTags);
      const combinedTagsMap = new Map<string, Tag[]>(); // Changed to store Tag[]

      console.log(`Fetching tags for ${allTransactionIds.length} transactions in batches of ${BATCH_SIZE}...`); // Added logging

      // Helper function to introduce delay
      const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

      for (let i = 0; i < allTransactionIds.length; i += BATCH_SIZE) {
        const batchIds = allTransactionIds.slice(i, i + BATCH_SIZE);
        if (batchIds.length > 0) {
          const batchNum = i / BATCH_SIZE + 1;
          console.log(`Fetching batch ${batchNum} (IDs: ${batchIds.length})`); // Added logging
          try {
            // Check if tags for this batch are already mostly loaded (e.g., from individual updates)
            // This is an optimization, might need refinement
            const needsFetch = batchIds.some(id => !currentTagsMap.has(id));
            if (!needsFetch) {
              console.log(`Batch ${batchNum} already loaded, skipping fetch.`);
              batchIds.forEach(id => {
                 if (currentTagsMap.has(id)) {
                    combinedTagsMap.set(id, currentTagsMap.get(id)!);
                 }
              });
              continue; // Skip fetch if not needed
            }

            const batchTagsMap = await tagManager.getTransactionsWithTags(batchIds);
            batchTagsMap.forEach((tags, txId) => {
              // Store the full Tag objects
              combinedTagsMap.set(txId, tags);
            });
            console.log(`Batch ${batchNum} fetched successfully.`); // Added logging
          } catch (error) {
             console.error(`Error fetching tags for batch ${batchNum}:`, error);
             // Optionally, decide how to handle partial failures
          } finally {
             // Add a delay before the next iteration (except for the last one)
             if (i + BATCH_SIZE < allTransactionIds.length) {
               console.log(`Waiting 200ms before next batch...`);
               await delay(200);
             }
          }
        }
      }

      console.log('Finished fetching all tag batches.'); // Added logging
      // Only update state if the new map is different (prevents potential loops)
      if (JSON.stringify(Array.from(combinedTagsMap.entries())) !== JSON.stringify(Array.from(transactionTags.entries()))) {
         setTransactionTags(combinedTagsMap);
      }
    };

    loadTransactionTags();
  // Only re-run if transactions array *reference* changes, not just content
  }, [transactions]);


  // Apply filters - RE-ENABLED
  useEffect(() => {
    let filtered = [...transactions];

    // Apply date filter
    if (dateRange?.from) { // Check if 'from' date exists
      filtered = filtered.filter(
        (tx) =>
          tx.date >= dateRange.from &&
          (!dateRange.to || tx.date <= dateRange.to)
      );
    }

    // Apply tag filter - RE-ENABLED
    if (selectedTagIds.length > 0) {
      filtered = filtered.filter((tx) => {
        // Now compare against tag IDs within the Tag objects
        const txTagObjects = transactionTags?.get(tx.transactionId) || [];
        const txTagIds = txTagObjects.map(t => t.id);
        return selectedTagIds.some((tagId) => txTagIds.includes(tagId));
      });
    }

    setFilteredTransactions(filtered);
  }, [dateRange, transactions, selectedTagIds, transactionTags]); // transactionTags re-added to dependencies

  // Handler to reload tags for a SPECIFIC transaction
  const handleTagsChange = async (changedTransactionId: string) => {
    console.log(`Refreshing tags for transaction ${changedTransactionId}...`);
    try {
      const updatedTags = await tagManager.getTransactionTags(changedTransactionId);
      // Update the state map immutably
      setTransactionTags(prevMap => {
        const newMap = new Map(prevMap);
        newMap.set(changedTransactionId, updatedTags);
        return newMap; // Return the new map to update state
      });
      console.log(`Tags refreshed for transaction ${changedTransactionId}.`);
    } catch (error) {
      console.error(`Error refreshing tags for transaction ${changedTransactionId}:`, error);
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
                      tags={transactionTags.get(transaction.transactionId) || []} // Pass tags as prop
                      // Pass the specific transactionId to the handler
                      onTagsChange={() => handleTagsChange(transaction.transactionId)}
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
