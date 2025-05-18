import React, { useEffect, useCallback } from "react";
import { useTransactions } from "@/context/TransactionContext";
import { useAuth } from "@/context/AuthContext";
import SummaryStats from "./SummaryStats";
import TransactionList from "./TransactionList";
import SaveStatement from "./SaveStatement";
import { Card, CardContent, CardDescription } from "./ui/card";
import { Button } from "./ui/button";
import { LogIn } from "lucide-react";
import { Link, useParams, useNavigate } from "react-router-dom";

const StatementView: React.FC = () => {
  const {
    transactions,
    summary,
    loadStatement,
    isLoading,
    currentGroup,
    temporaryStatementId,
  } = useTransactions();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const shouldLoadStatement = useCallback(() => {
    if (!id) return false;
    if (!user && id !== temporaryStatementId) return false;
    if (id === temporaryStatementId && transactions.length > 0) return false;
    return true;
  }, [id, user, temporaryStatementId, transactions.length]);

  useEffect(() => {
    if (!id) {
      navigate("/");
      return;
    }

    if (!user && id !== temporaryStatementId) {
      navigate("/");
      return;
    }

    // Only load if necessary
    if (shouldLoadStatement()) {
      loadStatement(id);
    }
  }, [id, shouldLoadStatement, navigate, loadStatement]);

  // Don't show anything until we have transactions to display
  if (!transactions.length) {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600"></div>
          <p className="text-gray-600 font-medium">
            Loading your statement analysis...
          </p>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="flex flex-col gap-8 w-full max-w-7xl mx-auto py-8 px-4 md:px-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="text-center md:text-left">
          <h1 className="text-3xl font-bold text-gray-900">
            Statement Analysis
          </h1>
          <p className="text-gray-600 mt-2">
            Detailed insights into your transactions
          </p>
        </div>

        <div className="flex-shrink-0">
          {user ? (
            <SaveStatement />
          ) : (
            <Card className="bg-blue-50 border-blue-100">
              <CardContent className="py-4 px-6">
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="text-center sm:text-left">
                    <h3 className="font-medium text-blue-900">
                      Save Your Analysis
                    </h3>
                    <p className="text-sm text-blue-700">
                      Sign in to save and access later
                    </p>
                  </div>
                  <Button variant="outline" asChild className="bg-white">
                    <Link to="/auth" className="flex items-center gap-2">
                      <LogIn className="h-4 w-4" />
                      Sign In
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="grid gap-8">
        <section>
          <h2 className="text-xl font-semibold mb-4">Summary Overview</h2>
          <SummaryStats />
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">Transaction Details</h2>
          <TransactionList />
        </section>
      </div>
    </div>
  );
};

export default StatementView;
