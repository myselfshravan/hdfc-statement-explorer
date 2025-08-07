import { Transaction, StatementSummary } from "@/types/transaction";
import { Tag } from "@/types/tags";

export interface SpendingPattern {
  category: string;
  totalAmount: number;
  transactionCount: number;
  averageAmount: number;
  monthlyTrend: number; // percentage change from previous period
}

export interface MerchantAnalysis {
  merchant: string;
  totalSpent: number;
  transactionCount: number;
  averageAmount: number;
  lastTransactionDate: Date;
  frequency: 'high' | 'medium' | 'low';
}

export interface CashFlowAnalysis {
  weeklyPattern: Array<{ week: number; inflow: number; outflow: number; net: number }>;
  monthlyPattern: Array<{ month: string; inflow: number; outflow: number; net: number }>;
  averageMonthlyIncome: number;
  averageMonthlyExpense: number;
  cashFlowStability: number; // 0-1 score
}

export interface FinancialHealthScore {
  overall: number; // 0-100
  savingsRate: number;
  spendingVariability: number;
  expenseCategories: SpendingPattern[];
  recommendations: string[];
}

export interface TransactionInsights {
  spendingPatterns: SpendingPattern[];
  topMerchants: MerchantAnalysis[];
  cashFlowAnalysis: CashFlowAnalysis;
  financialHealthScore: FinancialHealthScore;
  anomalies: Array<{
    type: 'unusual_amount' | 'new_merchant' | 'spending_spike';
    transaction: Transaction;
    reason: string;
  }>;
  recurringTransactions: Array<{
    pattern: string;
    merchant: string;
    averageAmount: number;
    frequency: string;
    nextExpected?: Date;
  }>;
}

export class FinancialAnalysisService {
  
  public analyzeTransactions(
    transactions: Transaction[],
    transactionTags: Map<string, Tag[]>
  ): TransactionInsights {
    const sortedTransactions = [...transactions].sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    );

    return {
      spendingPatterns: this.analyzeSpendingPatterns(sortedTransactions, transactionTags),
      topMerchants: this.analyzeMerchants(sortedTransactions),
      cashFlowAnalysis: this.analyzeCashFlow(sortedTransactions),
      financialHealthScore: this.calculateFinancialHealth(sortedTransactions, transactionTags),
      anomalies: this.detectAnomalies(sortedTransactions),
      recurringTransactions: this.findRecurringTransactions(sortedTransactions),
    };
  }

  private analyzeSpendingPatterns(
    transactions: Transaction[],
    transactionTags: Map<string, Tag[]>
  ): SpendingPattern[] {
    const categoryMap = new Map<string, { total: number; count: number; amounts: number[] }>();
    
    transactions.filter(t => t.type === 'debit').forEach(transaction => {
      const tags = transactionTags.get(transaction.chqRefNumber) || [];
      const categories = tags.length > 0 
        ? tags.map(tag => tag.name)
        : [this.categorizeTransaction(transaction)];

      categories.forEach(category => {
        if (!categoryMap.has(category)) {
          categoryMap.set(category, { total: 0, count: 0, amounts: [] });
        }
        const data = categoryMap.get(category)!;
        data.total += transaction.amount;
        data.count += 1;
        data.amounts.push(transaction.amount);
      });
    });

    return Array.from(categoryMap.entries()).map(([category, data]) => ({
      category,
      totalAmount: data.total,
      transactionCount: data.count,
      averageAmount: data.total / data.count,
      monthlyTrend: this.calculateTrend(transactions, category, transactionTags),
    })).sort((a, b) => b.totalAmount - a.totalAmount);
  }

  private analyzeMerchants(transactions: Transaction[]): MerchantAnalysis[] {
    const merchantMap = new Map<string, {
      total: number;
      count: number;
      amounts: number[];
      lastDate: Date;
    }>();

    transactions.filter(t => t.type === 'debit' && t.merchant).forEach(transaction => {
      const merchant = transaction.merchant!;
      if (!merchantMap.has(merchant)) {
        merchantMap.set(merchant, {
          total: 0,
          count: 0,
          amounts: [],
          lastDate: transaction.date,
        });
      }
      const data = merchantMap.get(merchant)!;
      data.total += transaction.amount;
      data.count += 1;
      data.amounts.push(transaction.amount);
      if (transaction.date > data.lastDate) {
        data.lastDate = transaction.date;
      }
    });

    return Array.from(merchantMap.entries())
      .map(([merchant, data]) => ({
        merchant,
        totalSpent: data.total,
        transactionCount: data.count,
        averageAmount: data.total / data.count,
        lastTransactionDate: data.lastDate,
        frequency: this.calculateFrequency(data.count, transactions.length),
      }))
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 10);
  }

  private analyzeCashFlow(transactions: Transaction[]): CashFlowAnalysis {
    const now = new Date();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    const recentTransactions = transactions.filter(t => t.date >= threeMonthsAgo);

    const monthlyData = this.groupByMonth(recentTransactions);
    const weeklyData = this.groupByWeek(recentTransactions);

    return {
      weeklyPattern: weeklyData,
      monthlyPattern: monthlyData,
      averageMonthlyIncome: this.calculateAverageIncome(monthlyData),
      averageMonthlyExpense: this.calculateAverageExpense(monthlyData),
      cashFlowStability: this.calculateCashFlowStability(monthlyData),
    };
  }

  private calculateFinancialHealth(
    transactions: Transaction[],
    transactionTags: Map<string, Tag[]>
  ): FinancialHealthScore {
    const last3Months = this.getLastNMonthsTransactions(transactions, 3);
    const totalIncome = last3Months.filter(t => t.type === 'credit').reduce((sum, t) => sum + t.amount, 0);
    const totalExpense = last3Months.filter(t => t.type === 'debit').reduce((sum, t) => sum + t.amount, 0);
    
    const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0;
    const spendingVariability = this.calculateSpendingVariability(last3Months);
    
    const spendingPatterns = this.analyzeSpendingPatterns(last3Months, transactionTags);
    
    let overallScore = 50; // Base score
    
    // Adjust score based on savings rate
    if (savingsRate > 20) overallScore += 25;
    else if (savingsRate > 10) overallScore += 15;
    else if (savingsRate > 0) overallScore += 5;
    else overallScore -= 20;
    
    // Adjust for spending variability (lower variability is better)
    if (spendingVariability < 0.3) overallScore += 15;
    else if (spendingVariability > 0.7) overallScore -= 15;
    
    overallScore = Math.max(0, Math.min(100, overallScore));

    return {
      overall: Math.round(overallScore),
      savingsRate: Math.round(savingsRate * 100) / 100,
      spendingVariability: Math.round(spendingVariability * 100) / 100,
      expenseCategories: spendingPatterns.slice(0, 5),
      recommendations: this.generateRecommendations(savingsRate, spendingVariability, spendingPatterns),
    };
  }

  private detectAnomalies(transactions: Transaction[]) {
    const anomalies: Array<{
      type: 'unusual_amount' | 'new_merchant' | 'spending_spike';
      transaction: Transaction;
      reason: string;
    }> = [];

    const last30Days = this.getLastNDaysTransactions(transactions, 30);
    const previous30Days = this.getTransactionsBetween(
      transactions,
      60, // 60 days ago
      30  // 30 days ago
    );

    // Detect unusual amounts
    const amounts = previous30Days.map(t => t.amount);
    const avgAmount = amounts.reduce((sum, amt) => sum + amt, 0) / amounts.length;
    const stdDev = Math.sqrt(amounts.reduce((sum, amt) => sum + Math.pow(amt - avgAmount, 2), 0) / amounts.length);

    last30Days.forEach(transaction => {
      if (Math.abs(transaction.amount - avgAmount) > 2 * stdDev) {
        anomalies.push({
          type: 'unusual_amount',
          transaction,
          reason: `Amount ₹${transaction.amount.toFixed(2)} is ${Math.abs(transaction.amount - avgAmount) > 3 * stdDev ? 'significantly' : 'unusually'} ${transaction.amount > avgAmount ? 'higher' : 'lower'} than typical transactions`,
        });
      }
    });

    // Detect new merchants
    const previousMerchants = new Set(previous30Days.map(t => t.merchant).filter(Boolean));
    last30Days.forEach(transaction => {
      if (transaction.merchant && !previousMerchants.has(transaction.merchant)) {
        anomalies.push({
          type: 'new_merchant',
          transaction,
          reason: `First transaction with ${transaction.merchant}`,
        });
      }
    });

    return anomalies.slice(0, 5); // Return top 5 anomalies
  }

  private findRecurringTransactions(transactions: Transaction[]) {
    const merchantFrequency = new Map<string, Transaction[]>();
    
    transactions.filter(t => t.merchant).forEach(transaction => {
      const merchant = transaction.merchant!;
      if (!merchantFrequency.has(merchant)) {
        merchantFrequency.set(merchant, []);
      }
      merchantFrequency.get(merchant)!.push(transaction);
    });

    return Array.from(merchantFrequency.entries())
      .filter(([_, txns]) => txns.length >= 3) // At least 3 transactions
      .map(([merchant, txns]) => {
        const sortedTxns = txns.sort((a, b) => a.date.getTime() - b.date.getTime());
        const intervals = [];
        for (let i = 1; i < sortedTxns.length; i++) {
          const daysDiff = Math.floor((sortedTxns[i].date.getTime() - sortedTxns[i-1].date.getTime()) / (1000 * 60 * 60 * 24));
          intervals.push(daysDiff);
        }
        
        const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
        const avgAmount = txns.reduce((sum, t) => sum + t.amount, 0) / txns.length;
        
        let frequency = 'irregular';
        if (avgInterval >= 28 && avgInterval <= 32) frequency = 'monthly';
        else if (avgInterval >= 6 && avgInterval <= 8) frequency = 'weekly';
        else if (avgInterval >= 13 && avgInterval <= 16) frequency = 'bi-weekly';
        
        return {
          pattern: frequency,
          merchant,
          averageAmount: avgAmount,
          frequency: `Every ${Math.round(avgInterval)} days`,
          nextExpected: frequency !== 'irregular' 
            ? new Date(sortedTxns[sortedTxns.length - 1].date.getTime() + avgInterval * 24 * 60 * 60 * 1000)
            : undefined,
        };
      })
      .filter(item => item.pattern !== 'irregular')
      .slice(0, 5);
  }

  // Helper methods
  private categorizeTransaction(transaction: Transaction): string {
    const narration = transaction.narration.toLowerCase();
    
    if (narration.includes('food') || narration.includes('zomato') || narration.includes('swiggy')) {
      return 'Food & Dining';
    }
    if (narration.includes('fuel') || narration.includes('petrol') || narration.includes('gas')) {
      return 'Fuel';
    }
    if (narration.includes('shopping') || narration.includes('amazon') || narration.includes('flipkart')) {
      return 'Shopping';
    }
    if (narration.includes('uber') || narration.includes('ola') || narration.includes('transport')) {
      return 'Transportation';
    }
    if (narration.includes('electricity') || narration.includes('water') || narration.includes('utility')) {
      return 'Utilities';
    }
    if (narration.includes('medical') || narration.includes('hospital') || narration.includes('pharmacy')) {
      return 'Healthcare';
    }
    if (narration.includes('movie') || narration.includes('entertainment') || narration.includes('netflix')) {
      return 'Entertainment';
    }
    
    return 'Others';
  }

  private calculateTrend(transactions: Transaction[], category: string, transactionTags: Map<string, Tag[]>): number {
    // Calculate monthly trend for the category
    const now = new Date();
    const currentMonth = this.getMonthTransactions(transactions, now, transactionTags, category);
    const previousMonth = this.getMonthTransactions(
      transactions,
      new Date(now.getFullYear(), now.getMonth() - 1, 1),
      transactionTags,
      category
    );

    const currentTotal = currentMonth.reduce((sum, t) => sum + t.amount, 0);
    const previousTotal = previousMonth.reduce((sum, t) => sum + t.amount, 0);

    if (previousTotal === 0) return 0;
    return ((currentTotal - previousTotal) / previousTotal) * 100;
  }

  private getMonthTransactions(
    transactions: Transaction[],
    date: Date,
    transactionTags: Map<string, Tag[]>,
    category: string
  ): Transaction[] {
    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    
    return transactions.filter(t => {
      if (t.date < startOfMonth || t.date > endOfMonth) return false;
      
      const tags = transactionTags.get(t.chqRefNumber) || [];
      const categories = tags.length > 0 
        ? tags.map(tag => tag.name)
        : [this.categorizeTransaction(t)];
      
      return categories.includes(category);
    });
  }

  private calculateFrequency(transactionCount: number, totalTransactions: number): 'high' | 'medium' | 'low' {
    const ratio = transactionCount / totalTransactions;
    if (ratio > 0.1) return 'high';
    if (ratio > 0.05) return 'medium';
    return 'low';
  }

  private groupByMonth(transactions: Transaction[]) {
    const monthGroups = new Map<string, { inflow: number; outflow: number }>();
    
    transactions.forEach(transaction => {
      const monthKey = `${transaction.date.getFullYear()}-${String(transaction.date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthGroups.has(monthKey)) {
        monthGroups.set(monthKey, { inflow: 0, outflow: 0 });
      }
      
      const data = monthGroups.get(monthKey)!;
      if (transaction.type === 'credit') {
        data.inflow += transaction.amount;
      } else {
        data.outflow += transaction.amount;
      }
    });

    return Array.from(monthGroups.entries())
      .map(([month, data]) => ({
        month,
        inflow: data.inflow,
        outflow: data.outflow,
        net: data.inflow - data.outflow,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  private groupByWeek(transactions: Transaction[]) {
    const weekGroups = new Map<number, { inflow: number; outflow: number }>();
    
    transactions.forEach(transaction => {
      const weekNumber = this.getWeekNumber(transaction.date);
      
      if (!weekGroups.has(weekNumber)) {
        weekGroups.set(weekNumber, { inflow: 0, outflow: 0 });
      }
      
      const data = weekGroups.get(weekNumber)!;
      if (transaction.type === 'credit') {
        data.inflow += transaction.amount;
      } else {
        data.outflow += transaction.amount;
      }
    });

    return Array.from(weekGroups.entries())
      .map(([week, data]) => ({
        week,
        inflow: data.inflow,
        outflow: data.outflow,
        net: data.inflow - data.outflow,
      }))
      .sort((a, b) => a.week - b.week)
      .slice(-12); // Last 12 weeks
  }

  private getWeekNumber(date: Date): number {
    const startDate = new Date(date.getFullYear(), 0, 1);
    const days = Math.floor((date.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
    return Math.ceil((days + startDate.getDay() + 1) / 7);
  }

  private calculateAverageIncome(monthlyData: Array<{ inflow: number; outflow: number }>): number {
    if (monthlyData.length === 0) return 0;
    return monthlyData.reduce((sum, data) => sum + data.inflow, 0) / monthlyData.length;
  }

  private calculateAverageExpense(monthlyData: Array<{ inflow: number; outflow: number }>): number {
    if (monthlyData.length === 0) return 0;
    return monthlyData.reduce((sum, data) => sum + data.outflow, 0) / monthlyData.length;
  }

  private calculateCashFlowStability(monthlyData: Array<{ net: number }>): number {
    if (monthlyData.length < 2) return 0;
    
    const netFlows = monthlyData.map(d => d.net);
    const avgNet = netFlows.reduce((sum, net) => sum + net, 0) / netFlows.length;
    const variance = netFlows.reduce((sum, net) => sum + Math.pow(net - avgNet, 2), 0) / netFlows.length;
    const stdDev = Math.sqrt(variance);
    
    // Stability score: lower standard deviation relative to mean = higher stability
    const coefficientOfVariation = Math.abs(avgNet) > 0 ? stdDev / Math.abs(avgNet) : 1;
    return Math.max(0, Math.min(1, 1 - coefficientOfVariation));
  }

  private getLastNMonthsTransactions(transactions: Transaction[], months: number): Transaction[] {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - months);
    return transactions.filter(t => t.date >= cutoffDate);
  }

  private getLastNDaysTransactions(transactions: Transaction[], days: number): Transaction[] {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    return transactions.filter(t => t.date >= cutoffDate);
  }

  private getTransactionsBetween(transactions: Transaction[], daysAgo: number, endDaysAgo: number): Transaction[] {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgo);
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - endDaysAgo);
    return transactions.filter(t => t.date >= startDate && t.date <= endDate);
  }

  private calculateSpendingVariability(transactions: Transaction[]): number {
    const debits = transactions.filter(t => t.type === 'debit');
    if (debits.length < 2) return 0;
    
    const amounts = debits.map(t => t.amount);
    const avg = amounts.reduce((sum, amt) => sum + amt, 0) / amounts.length;
    const variance = amounts.reduce((sum, amt) => sum + Math.pow(amt - avg, 2), 0) / amounts.length;
    const stdDev = Math.sqrt(variance);
    
    return avg > 0 ? stdDev / avg : 0;
  }

  private generateRecommendations(
    savingsRate: number,
    spendingVariability: number,
    spendingPatterns: SpendingPattern[]
  ): string[] {
    const recommendations: string[] = [];
    
    if (savingsRate < 10) {
      recommendations.push("Consider increasing your savings rate to at least 10% of your income for better financial security.");
    }
    
    if (spendingVariability > 0.6) {
      recommendations.push("Your spending patterns are quite variable. Try creating a monthly budget to maintain consistency.");
    }
    
    const topCategory = spendingPatterns[0];
    if (topCategory && topCategory.monthlyTrend > 20) {
      recommendations.push(`Your ${topCategory.category} spending has increased by ${topCategory.monthlyTrend.toFixed(1)}%. Consider reviewing these expenses.`);
    }
    
    if (spendingPatterns.some(p => p.category.includes('Food') && p.totalAmount > 15000)) {
      recommendations.push("High food delivery expenses detected. Cooking at home more often could lead to significant savings.");
    }
    
    return recommendations.slice(0, 3); // Limit to top 3 recommendations
  }
}