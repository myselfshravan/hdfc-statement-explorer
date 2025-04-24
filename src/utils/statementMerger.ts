import {
  Transaction,
  StatementSummary,
  Statement,
  StatementGroup,
  DateRangeNode,
} from "../types/transaction";
import { v4 as uuidv4 } from "uuid";

export class StatementMerger {
  private root: DateRangeNode | null = null;

  // Generate unique transaction ID based on transaction details
  generateTransactionId(
    transaction: Omit<Transaction, "transactionId">
  ): Promise<string> {
    const details = `${transaction.date.toISOString()}_${
      transaction.narration
    }_${transaction.amount}_${transaction.type}`;

    const encoder = new TextEncoder();
    const data = encoder.encode(details);

    return crypto.subtle.digest("SHA-256", data).then((hashBuffer) => {
      return Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    });
  }

  // Insert a new date range node into the B-tree
  private insertNode(node: DateRangeNode): void {
    if (!this.root) {
      this.root = node;
      return;
    }

    let current = this.root;
    while (true) {
      if (node.startDate < current.startDate) {
        if (!current.left) {
          current.left = node;
          break;
        }
        current = current.left;
      } else {
        if (!current.right) {
          current.right = node;
          break;
        }
        current = current.right;
      }
    }
  }

  // Find overlapping or continuous statement groups
  private findOverlappingGroups(startDate: Date, endDate: Date): string[] {
    const overlapping: string[] = [];

    const searchNode = (node: DateRangeNode | undefined) => {
      if (!node) return;

      // Check for overlap or continuity (1-day gap is considered continuous)
      const isOverlapping =
        (startDate <= node.endDate && endDate >= node.startDate) ||
        Math.abs(node.endDate.getTime() - startDate.getTime()) <= 86400000 || // 1 day in milliseconds
        Math.abs(node.startDate.getTime() - endDate.getTime()) <= 86400000;

      if (isOverlapping) {
        overlapping.push(node.groupId);
      }

      // Search both subtrees as we might have multiple overlapping groups
      searchNode(node.left);
      searchNode(node.right);
    };

    searchNode(this.root);
    return overlapping;
  }

  // Merge statements and update summary
  private async mergeStatements(
    statements: Statement[]
  ): Promise<StatementGroup> {
    // Sort statements by date
    statements.sort(
      (a, b) => a.summary.startDate.getTime() - b.summary.startDate.getTime()
    );

    // Initialize merged summary
    const mergedSummary: StatementSummary = {
      totalDebit: 0,
      totalCredit: 0,
      netCashflow: 0,
      startDate: statements[0].summary.startDate,
      endDate: statements[statements.length - 1].summary.endDate,
      startingBalance: statements[0].summary.startingBalance,
      endingBalance: statements[statements.length - 1].summary.endingBalance,
      transactionCount: 0,
      creditCount: 0,
      debitCount: 0,
    };

    // Use a Map to deduplicate transactions
    const uniqueTransactions = new Map<string, Transaction>();

    // Process all statements
    for (const statement of statements) {
      for (const transaction of statement.transactions) {
        const transactionId = await this.generateTransactionId(transaction);
        if (!uniqueTransactions.has(transactionId)) {
          uniqueTransactions.set(transactionId, {
            ...transaction,
            transactionId,
            statementId: statement.id,
          });
        }
      }

      // Update summary totals
      mergedSummary.totalDebit += statement.summary.totalDebit;
      mergedSummary.totalCredit += statement.summary.totalCredit;
    }

    // Calculate final summary
    const transactions = Array.from(uniqueTransactions.values());
    mergedSummary.transactionCount = transactions.length;
    mergedSummary.creditCount = transactions.filter(
      (t) => t.type === "credit"
    ).length;
    mergedSummary.debitCount = transactions.filter(
      (t) => t.type === "debit"
    ).length;
    mergedSummary.netCashflow =
      mergedSummary.totalCredit - mergedSummary.totalDebit;

    // Validate running balances
    this.validateRunningBalances(transactions);

    return {
      id: uuidv4(),
      userId: statements[0].groupId.split("_")[0], // Assuming groupId format: userId_groupId
      firstDate: mergedSummary.startDate,
      lastDate: mergedSummary.endDate,
      mergedSummary,
      statements,
    };
  }

  // Validate running balances and fix any discrepancies
  private validateRunningBalances(transactions: Transaction[]): void {
    let currentBalance =
      transactions[0].closingBalance -
      (transactions[0].creditAmount - transactions[0].debitAmount);

    for (const transaction of transactions) {
      const expectedBalance =
        currentBalance + (transaction.creditAmount - transaction.debitAmount);

      if (Math.abs(expectedBalance - transaction.closingBalance) > 0.01) {
        console.warn(
          `Balance discrepancy detected for transaction: ${transaction.transactionId}`
        );
        transaction.closingBalance = expectedBalance;
      }

      currentBalance = transaction.closingBalance;
    }
  }

  // Main method to process a new statement
  public async processNewStatement(
    statement: Statement
  ): Promise<StatementGroup> {
    // Find any overlapping or continuous groups
    const overlappingGroups = this.findOverlappingGroups(
      statement.summary.startDate,
      statement.summary.endDate
    );

    if (overlappingGroups.length === 0) {
      // Create new group for this statement
      const group: StatementGroup = {
        id: uuidv4(),
        userId: statement.groupId.split("_")[0],
        firstDate: statement.summary.startDate,
        lastDate: statement.summary.endDate,
        mergedSummary: statement.summary,
        statements: [statement],
      };

      // Add to B-tree
      this.insertNode({
        groupId: group.id,
        startDate: group.firstDate,
        endDate: group.lastDate,
      });

      return group;
    }

    // Merge with existing group(s)
    const statementsToMerge = [statement];
    // TODO: Fetch existing statements from database using overlappingGroups IDs
    // statementsToMerge.push(...existingStatements);

    return await this.mergeStatements(statementsToMerge);
  }
}

// Export singleton instance
export const statementMerger = new StatementMerger();
