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
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-center">
              Statement Analysis
            </h2>
            {user ? (
              <SaveStatement />
            ) : (
              <Card className="p-4">
                <CardDescription className="flex items-center gap-2">
                  Sign in to save this statement
                  <Button variant="outline" asChild size="sm">
                    <Link to="/auth">
                      <LogIn className="h-4 w-4 mr-2" />
                      Sign In
                    </Link>
                  </Button>
                </CardDescription>
              </Card>
            )}
          </div>
          <div className="flex flex-col max-w-6xl mx-auto gap-4">
            <SummaryStats />
            <TransactionList />
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;
