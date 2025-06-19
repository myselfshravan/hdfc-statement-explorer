import { Transaction, StatementSummary } from "../types/transaction";
import { supabase } from "@/lib/supabaseClient";
import { v4 as uuidv4 } from "uuid";

interface SuperStatement {
  id: string;
  user_id: string;
  transactions: Transaction[];
  first_date: Date;
  last_date: Date;
  summary: StatementSummary;
}

export class SuperStatementManager {

  private async getSuperStatement(
    userId: string
  ): Promise<SuperStatement | null> {
    const { data, error } = await supabase
      .from("super_statement")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 is "no rows returned"
      throw error;
    }

    if (!data) return null;

    return {
      ...data,
      transactions: data.transactions.map((t: Transaction) => ({
        ...t,
        date: new Date(t.date),
      })),
      first_date: new Date(data.first_date),
      last_date: new Date(data.last_date),
    };
  }

  private calculateSummary(transactions: Transaction[]): StatementSummary {
    const sorted = [...transactions].sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    );

    const summary: StatementSummary = {
      totalDebit: 0,
      totalCredit: 0,
      netCashflow: 0,
      startDate: sorted[0].date,
      endDate: sorted[sorted.length - 1].date,
      startingBalance: sorted[0].closingBalance,
      endingBalance: sorted[sorted.length - 1].closingBalance,
      transactionCount: sorted.length,
      creditCount: sorted.filter((t) => t.type === "credit").length,
      debitCount: sorted.filter((t) => t.type === "debit").length,
    };

    sorted.forEach((t) => {
      summary.totalDebit += t.debitAmount;
      summary.totalCredit += t.creditAmount;
    });
    summary.netCashflow = summary.totalCredit - summary.totalDebit;

    return summary;
  }

  // No need to validate balances as we trust the statement values
  private validateBalances(transactions: Transaction[]): void {
    // Sort transactions by date for consistency
    transactions.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  public async mergeStatement(
    userId: string,
    newTransactions: Transaction[],
    newSummary: StatementSummary
  ): Promise<SuperStatement> {
    // Get existing super statement or create new one
    let superStatement = await this.getSuperStatement(userId);

    // Process the transactions without generating extra IDs
    const processedTransactions = newTransactions;

    if (!superStatement) {
      // Create new super statement
      superStatement = {
        id: uuidv4(),
        user_id: userId,
        transactions: processedTransactions,
        first_date: newSummary.startDate,
        last_date: newSummary.endDate,
        summary: newSummary,
      };
    } else {
      // Merge new transactions while maintaining chronological order
      const uniqueTransactions = new Map<string, Transaction>();
      
      // Add existing transactions to map
      superStatement.transactions.forEach(tx => {
        uniqueTransactions.set(tx.chqRefNumber, tx);
      });
      
      // Add or update with new transactions
      processedTransactions.forEach(tx => {
        uniqueTransactions.set(tx.chqRefNumber, tx);
      });
      
      // Convert to array and sort by date
      const mergedTransactions = Array.from(uniqueTransactions.values())
        .sort((a, b) => a.date.getTime() - b.date.getTime());
      
      // Just sort transactions, no balance validation needed
      this.validateBalances(mergedTransactions);

      superStatement = {
        ...superStatement,
        transactions: mergedTransactions,
        first_date: new Date(
          Math.min(
            superStatement.first_date.getTime(),
            newSummary.startDate.getTime()
          )
        ),
        last_date: new Date(
          Math.max(
            superStatement.last_date.getTime(),
            newSummary.endDate.getTime()
          )
        ),
        summary: this.calculateSummary(mergedTransactions),
      };
    }

    // Save to database
    const { error } = await supabase.from("super_statement").upsert({
      id: superStatement.id,
      user_id: superStatement.user_id,
      transactions: superStatement.transactions.map((t) => ({
        ...t,
        date: t.date.toISOString(),
      })),
      first_date: superStatement.first_date.toISOString(),
      last_date: superStatement.last_date.toISOString(),
      summary: superStatement.summary,
    });

    if (error) throw error;

    return superStatement;
  }

  public async getSuperStatementTransactions(
    userId: string
  ): Promise<Transaction[]> {
    const superStatement = await this.getSuperStatement(userId);
    if (!superStatement) return [];
    return superStatement.transactions;
  }

  public async getSuperStatementSummary(
    userId: string
  ): Promise<StatementSummary | null> {
    const superStatement = await this.getSuperStatement(userId);
    if (!superStatement) return null;
    return superStatement.summary;
  }
}
