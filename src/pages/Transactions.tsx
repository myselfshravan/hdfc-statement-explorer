import React from "react";
import { SuperStatementManager } from "@/utils/superStatementManager";
import { useAuth } from "@/context/AuthContext";
import { Transaction } from "@/types/transaction";
import { Tag } from "@/types/tags";
import { TransactionTags } from "@/components/TransactionTags";
import { tagManager } from "@/utils/tagManager";
import { Card } from "@/components/ui/card";
import { useSearchParams } from "react-router-dom";
import Loading from "@/components/Loading";
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

export default function Transactions() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [transactions, setTransactions] = React.useState<Transaction[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [transactionTags, setTransactionTags] = React.useState<
    Map<string, Tag[]>
  >(new Map());

  React.useEffect(() => {
    const loadTransactions = async () => {
      if (!user) return;

      try {
        const txns = await superStatementManager.getSuperStatementTransactions(
          user.id
        );
        setTransactions(txns);
      } catch (error) {
        console.error("Error loading transactions:", error);
      } finally {
        setLoading(false);
      }
    };

    loadTransactions();
  }, [user]);

  // Load tags when transactions change
  React.useEffect(() => {
    const loadTransactionTags = async () => {
      if (transactions.length === 0) return;
      try {
        const tagsMap = await tagManager.getAllTransactionTags();
        setTransactionTags(tagsMap);
      } catch (error) {
        console.error("Tag loading error:", error);
      }
    };

    loadTransactionTags();
  }, [transactions]);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loading />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-100 via-white to-purple-100 p-2 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="relative backdrop-blur-2xl bg-white/40 rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-white/40">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-200/20 via-purple-100/20 to-blue-100/20 rounded-2xl opacity-80" />
          <div className="relative">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              All Transactions
            </h1>
            <p className="mt-2 text-gray-600">
              Showing {transactions.length} transactions
            </p>
          </div>
        </div>

        {/* Transactions Table Card */}
        <Card className="relative overflow-hidden backdrop-blur-2xl bg-white/40 border border-white/40 shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-200/20 via-purple-100/20 to-blue-100/20 opacity-80" />
          <div className="relative">
            {/* Desktop view */}
            <div className="hidden md:block">
              <div className="overflow-auto max-h-[calc(100vh-250px)]">
                <Table>
                  <TableHeader className="sticky top-0 bg-white/80 backdrop-blur-2xl shadow-lg border-b border-white/40">
                    <TableRow>
                      <TableHead className="w-[100px] !bg-transparent">
                        Date
                      </TableHead>
                      <TableHead className="min-w-[300px] !bg-transparent">
                        Description
                      </TableHead>
                      <TableHead className="w-[80px] !bg-transparent">
                        Type
                      </TableHead>
                      <TableHead className="text-right w-[120px] !bg-transparent">
                        Amount
                      </TableHead>
                      <TableHead className="text-right w-[120px] !bg-transparent">
                        Balance
                      </TableHead>
                      <TableHead className="w-[180px] text-center !bg-transparent">
                        Tags
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((transaction, index) => (
                      <TableRow
                        key={transaction.chqRefNumber}
                        className="group"
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
                              <div className="text-sm text-gray-600">
                                {getDescription(transaction.narration)}
                              </div>
                            )}
                            {transaction.upiId && (
                              <div className="text-xs text-gray-500 font-mono">
                                {getUpiOnly(transaction.upiId)}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              transaction.type === "credit"
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            } backdrop-blur-sm`}
                          >
                            {transaction.type}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          <span
                            className={`font-medium ${
                              transaction.type === "credit"
                                ? "text-green-600"
                                : "text-red-600"
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
            <div className="md:hidden space-y-4 px-2">
              {transactions.map((transaction) => (
                <div
                  key={transaction.chqRefNumber}
                  className="p-4 rounded-xl bg-white/40 backdrop-blur-2xl border border-white/40 shadow-lg"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-medium text-gray-900">
                      {formatDate(transaction.date)}
                    </span>
                    <span
                      className={`inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        transaction.type === "credit"
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {transaction.type}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="font-medium text-gray-900">
                      {getPayeeName(transaction.narration)}
                    </div>

                    {getDescription(transaction.narration) && (
                      <div className="text-sm text-gray-600">
                        {getDescription(transaction.narration)}
                      </div>
                    )}

                    {transaction.upiId && (
                      <div className="text-xs text-gray-500 font-mono break-all">
                        {getUpiOnly(transaction.upiId)}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-200">
                    <div className="space-y-1">
                      <div className="text-sm text-gray-500">Amount</div>
                      <div
                        className={`font-medium ${
                          transaction.type === "credit"
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {formatAmount(transaction.amount)}
                      </div>
                    </div>
                    <div className="space-y-1 text-right">
                      <div className="text-sm text-gray-500">Balance</div>
                      <div className="font-medium text-gray-900">
                        {formatAmount(transaction.closingBalance)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-gray-200/50 text-center">
                    <TransactionTags
                      chqRefNumber={transaction.chqRefNumber}
                      tags={transactionTags.get(transaction.chqRefNumber) || []}
                      onTagsChange={() =>
                        handleTagsChange(transaction.chqRefNumber)
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
