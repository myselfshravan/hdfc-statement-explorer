import React from "react";
import { useTransactions } from "@/context/TransactionContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

export function SavedStatements() {
  const { savedStatements, loadStatement, isLoading } = useTransactions();

  if (savedStatements.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Saved Statements</CardTitle>
          <CardDescription>No saved statements found</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Saved Statements</CardTitle>
        <CardDescription>
          Click on a statement to load its transactions
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px] pr-2">
          <div className="space-y-4">
            {savedStatements.map((statement) => (
              <Card key={statement.id} className="p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-0">
                  {/* Name and Date */}
                  <div>
                    <h4 className="text-base font-semibold text-gray-900">
                      {statement.name}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {new Date(statement.created_at).toLocaleDateString(
                        undefined,
                        {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        }
                      )}
                    </p>
                  </div>

                  {/* Buttons */}
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:items-center">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => loadStatement(statement.id)}
                      disabled={isLoading}
                      className="w-full sm:w-auto"
                    >
                      Load
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
