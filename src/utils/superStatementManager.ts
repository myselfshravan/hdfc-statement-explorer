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
  private async generateTransactionId(
    transaction: Omit<Transaction, "transactionId">
  ): Promise<string> {
    const details = `${transaction.date.toISOString()}_${
      transaction.narration
    }_${transaction.amount}_${transaction.type}`;

    // Convert the string to an ArrayBuffer for the Web Crypto API
    const encoder = new TextEncoder();
    const data = encoder.encode(details);

    // Generate the SHA-256 hash
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);

    // Convert the hash buffer to a hex string
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

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
      startingBalance:
        sorted[0].closingBalance -
        (sorted[0].creditAmount - sorted[0].debitAmount),
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

  private validateBalances(transactions: Transaction[]): void {
    const sorted = [...transactions].sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    );

    let currentBalance =
      sorted[0].closingBalance -
      (sorted[0].creditAmount - sorted[0].debitAmount);

    for (const transaction of sorted) {
      const expectedBalance =
        currentBalance + (transaction.creditAmount - transaction.debitAmount);

      if (Math.abs(expectedBalance - transaction.closingBalance) > 0.01) {
        console.warn(
          `Balance mismatch for transaction ${transaction.transactionId}`
        );
        transaction.closingBalance = expectedBalance;
      }

      currentBalance = transaction.closingBalance;
    }
  }

  public async mergeStatement(
    userId: string,
    newTransactions: Transaction[],
    newSummary: StatementSummary
  ): Promise<SuperStatement> {
    // Get existing super statement or create new one
    let superStatement = await this.getSuperStatement(userId);

    // Generate IDs for new transactions
    const processedTransactions = await Promise.all(
      newTransactions.map(async (t) => ({
        ...t,
        transactionId: await this.generateTransactionId(t), // Await the promise here
      }))
    );

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
      // Merge new transactions with existing ones
      const mergedTransactions = [...superStatement.transactions];

      // Add only non-duplicate transactions
      for (const newTx of processedTransactions) {
        if (
          !mergedTransactions.some(
            (t) => t.transactionId === newTx.transactionId
          )
        ) {
          mergedTransactions.push(newTx);
        }
      }

      // Sort by date and validate running balances
      mergedTransactions.sort((a, b) => a.date.getTime() - b.date.getTime());
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
