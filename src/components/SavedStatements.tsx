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
        <ScrollArea className="h-[300px]">
          <div className="space-y-4">
            {savedStatements.map((statement) => (
              <Card key={statement.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold">{statement.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {new Date(statement.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => loadStatement(statement.id)}
                    disabled={isLoading}
                  >
                    Load
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
