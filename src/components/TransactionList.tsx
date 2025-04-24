import React from "react";
import { useTransactions } from "@/context/TransactionContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(amount);
};

const formatDate = (date: Date): string => {
  return date.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const TransactionList: React.FC = () => {
  const { filteredTransactions } = useTransactions();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Transactions</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[600px] rounded-md border">
          <Table>
            <TableHeader className="sticky top-0 bg-white z-10 border-b">
              <TableRow>
                <TableHead className="w-[120px]">Date</TableHead>
                <TableHead className="min-w-[300px]">Description</TableHead>
                <TableHead className="w-[120px]">Category</TableHead>
                <TableHead className="text-right w-[150px]">Amount</TableHead>
                <TableHead className="text-right w-[150px]">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTransactions.map((transaction, index) => (
                <TableRow key={index} className="hover:bg-muted/50">
                  <TableCell>{formatDate(transaction.date)}</TableCell>
                  <TableCell className="max-w-xs truncate">
                    {transaction.narration}
                    {transaction.upiId && (
                      <span className="block text-xs text-gray-500">
                        UPI: {transaction.upiId}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                      {transaction.category}
                    </span>
                  </TableCell>
                  <TableCell
                    className={`text-right ${
                      transaction.type === "credit"
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {transaction.type === "credit" ? "+" : "-"}
                    {formatCurrency(transaction.amount)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(transaction.closingBalance)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {filteredTransactions.length === 0 && (
            <div className="py-8 text-center">
              <p className="text-gray-500">
                No transactions found with the selected filters
              </p>
            </div>
          )}
        </ScrollArea>
        <div className="p-4 text-sm text-gray-500">
          {filteredTransactions.length} transactions
        </div>
      </CardContent>
    </Card>
  );
};

export default TransactionList;
