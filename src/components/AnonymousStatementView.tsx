import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { Transaction, StatementSummary } from "@/types/transaction";
import TransactionList from "@/components/TransactionList";
import SummaryStats from "@/components/SummaryStats";

interface AnonymousData {
  transactions: Transaction[];
  summary: StatementSummary;
  timestamp: number;
}

export const AnonymousStatementView: React.FC = () => {
  const [data, setData] = useState<AnonymousData | null>(null);

  useEffect(() => {
    const storedData = localStorage.getItem("anonymousStatement");
    if (storedData) {
      try {
        const parsedData = JSON.parse(storedData);
        // Convert date strings back to Date objects
        parsedData.transactions = parsedData.transactions.map((t: Omit<Transaction, 'date' | 'valueDate'> & {
          date: string;
          valueDate: string;
        }) => ({
          ...t,
          date: new Date(t.date),
          valueDate: new Date(t.valueDate)
        }));
        parsedData.summary = {
          ...parsedData.summary,
          startDate: new Date(parsedData.summary.startDate),
          endDate: new Date(parsedData.summary.endDate)
        };
        setData(parsedData);
      } catch (error) {
        console.error("Failed to parse stored statement:", error);
      }
    }
  }, []);

  if (!data) {
    return (
      <Card className="w-full max-w-4xl mx-auto my-4">
        <CardContent className="pt-6">
          <div className="text-center p-6">
            <p className="text-lg text-gray-600">No statement data found</p>
            <p className="text-sm text-gray-500 mt-2">
              Please upload a statement in anonymous mode to view analysis
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto my-4">
      <Alert className="mb-4 border-yellow-500 bg-yellow-50">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Anonymous Mode</AlertTitle>
        <AlertDescription>
          This statement analysis is stored locally in your browser and will be lost when you clear your browser data.
          Sign in to save and manage your statements permanently.
        </AlertDescription>
      </Alert>

      <SummaryStats summary={data.summary} />

      <Card>
        <CardContent className="pt-6">
          <TransactionList 
            transactions={data.transactions}
            isLoading={false}
            showLoadMore={false}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default AnonymousStatementView;
