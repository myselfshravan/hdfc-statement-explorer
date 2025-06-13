import React from "react";
import { useTransactions } from "@/context/TransactionContext";
import { Card } from "@/components/ui/card";
import { ArrowDown, ArrowUp, Calendar, Filter } from "lucide-react";

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
};

const SummaryStats: React.FC = () => {
  const { summary, filteredTransactions } = useTransactions();

  if (!summary) return null;

  // Calculate filtered summary values
  const totalFilteredDebit = filteredTransactions.reduce(
    (sum, t) => sum + t.debitAmount,
    0
  );
  const totalFilteredCredit = filteredTransactions.reduce(
    (sum, t) => sum + t.creditAmount,
    0
  );
  const netFilteredCashflow = totalFilteredCredit - totalFilteredDebit;

  function formatSimpleDate(date: Date) {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return { day, month, year };
  }
  const start = formatSimpleDate(summary.startDate);
  const end = formatSimpleDate(summary.endDate);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 w-full px-2">
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-500">Date Range</h3>
          <div className="p-1.5 rounded-md bg-purple-50">
            <Calendar className="h-4 w-4 text-purple-600" />
          </div>
        </div>
        <div className="mt-2 text-gray-800">
          <p className="text-sm font-medium">
            {start.day}/{start.month}/{start.year} - {end.day}/{end.month}/{end.year}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {filteredTransactions.length} of {summary.transactionCount}{" "}
            transactions
          </p>
        </div>
      </Card>
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-500">Total Credits</h3>
          <div className="p-1.5 rounded-md bg-green-50">
            <ArrowDown className="h-4 w-4 text-green-600" />
          </div>
        </div>
        <div className="mt-2">
          <p className="text-xl md:text-2xl font-bold text-gray-800">
            {formatCurrency(totalFilteredCredit)}
          </p>
          {filteredTransactions.length !== summary.transactionCount && (
            <p className="text-xs text-gray-500 mt-1">
              Total: {formatCurrency(summary.totalCredit)}
            </p>
          )}
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-500">Total Debits</h3>
          <div className="p-1.5 rounded-md bg-red-50">
            <ArrowUp className="h-4 w-4 text-red-600" />
          </div>
        </div>
        <div className="mt-2">
          <p className="text-xl md:text-2xl font-bold text-gray-800">
            {formatCurrency(totalFilteredDebit)}
          </p>
          {filteredTransactions.length !== summary.transactionCount && (
            <p className="text-xs text-gray-500 mt-1">
              Total: {formatCurrency(summary.totalDebit)}
            </p>
          )}
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-500">Net Cashflow</h3>
          <div className="p-1.5 rounded-md bg-blue-50">
            <Filter className="h-4 w-4 text-blue-600" />
          </div>
        </div>
        <div className="mt-2">
          <p
            className={`text-xl md:text-2xl font-bold ${
              netFilteredCashflow >= 0 ? "text-green-600" : "text-red-600"
            }`}
          >
            {formatCurrency(netFilteredCashflow)}
          </p>
          {filteredTransactions.length !== summary.transactionCount && (
            <p className="text-xs text-gray-500 mt-1">
              Total: {formatCurrency(summary.netCashflow)}
            </p>
          )}
        </div>
      </Card>
    </div>
  );
};

export default SummaryStats;
