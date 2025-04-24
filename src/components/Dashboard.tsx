import React from "react";
import { useTransactions } from "@/context/TransactionContext";
import { useAuth } from "@/context/AuthContext";
import FileUploader from "./FileUploader";
import SummaryStats from "./SummaryStats";
import TransactionList from "./TransactionList";
import SaveStatement from "./SaveStatement";
import { SavedStatements } from "./SavedStatements";
import { Card, CardDescription } from "./ui/card";
import { Button } from "./ui/button";
import { LogIn } from "lucide-react";
import { Link } from "react-router-dom";

const Dashboard: React.FC = () => {
  const { transactions, summary } = useTransactions();
  const { user } = useAuth();
  const hasData = transactions.length > 0;

  return (
    <div className="flex flex-col gap-6 w-full">
      {!hasData && (
        <div className="grid grid-cols-1 gap-6 pt-10 px-4 md:px-0">
          <div className="flex items-center justify-center w-full">
            <FileUploader />
          </div>
          <div className="flex items-center justify-center">
            <SavedStatements />
          </div>
        </div>
      )}

      {hasData && (
        <>
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
        </>
      )}
    </div>
  );
};

export default Dashboard;
