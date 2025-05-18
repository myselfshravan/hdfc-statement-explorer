import React, { useEffect } from "react";
import { useTransactions } from "@/context/TransactionContext";
import { useAuth } from "@/context/AuthContext";
import SummaryStats from "./SummaryStats";
import TransactionList from "./TransactionList";
import SaveStatement from "./SaveStatement";
import { Card, CardDescription } from "./ui/card";
import { Button } from "./ui/button";
import { LogIn } from "lucide-react";
import { Link, useParams } from "react-router-dom";

const StatementView: React.FC = () => {
  const { transactions, summary, loadStatement, isLoading, currentGroup } = useTransactions();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const hasData = transactions.length > 0;

  useEffect(() => {
    if (id && user && !isLoading && (!transactions.length || currentGroup?.statements[0]?.id !== id)) {
      loadStatement(id);
    }
  }, [id, user, isLoading, currentGroup, transactions]);

  if (!hasData) {
    return null;
  }

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-6 px-4 md:px-8 lg:max-w-6xl lg:mx-auto text-center md:text-left w-full">
        <div className="w-full md:w-auto">
          <h2 className="text-2xl font-bold">Statement Analysis</h2>
        </div>
        {user ? (
          <div className="w-full md:w-auto flex justify-center md:justify-end">
            <SaveStatement />
          </div>
        ) : (
          <div className="w-full md:w-auto flex justify-center md:justify-end">
            <Card className="p-4">
              <CardDescription className="flex flex-col sm:flex-row sm:items-center gap-2">
                <span>Sign in to save this statement</span>
                <Button variant="outline" asChild size="sm">
                  <Link to="/auth" className="flex items-center gap-1">
                    <LogIn className="h-4 w-4" />
                    Sign In
                  </Link>
                </Button>
              </CardDescription>
            </Card>
          </div>
        )}
      </div>

      <div className="flex flex-col w-full max-w-6xl mx-auto px-2 md:px-4 lg:px-6 gap-4">
        <SummaryStats />
        <TransactionList />
      </div>
    </div>
  );
};

export default StatementView;
