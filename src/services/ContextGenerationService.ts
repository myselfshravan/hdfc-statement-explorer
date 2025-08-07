import { Transaction, StatementSummary } from "@/types/transaction";
import { Tag } from "@/types/tags";
import { FinancialAnalysisService, TransactionInsights } from "./FinancialAnalysisService";

export interface UserFinancialProfile {
  userId: string;
  totalTransactions: number;
  timeRange: { start: Date; end: Date };
  primarySpendingCategories: string[];
  financialPersona: 'conservative' | 'balanced' | 'spender' | 'investor';
  monthlyIncomePattern: 'regular' | 'irregular' | 'seasonal';
  riskTolerance: 'low' | 'medium' | 'high';
}

export interface ChatContext {
  systemPrompt: string;
  userContext: string;
  financialSummary: string;
  capabilities: string[];
}

export class ContextGenerationService {
  private financialAnalysisService: FinancialAnalysisService;

  constructor() {
    this.financialAnalysisService = new FinancialAnalysisService();
  }

  public generateChatContext(
    transactions: Transaction[],
    summary: StatementSummary | null,
    transactionTags: Map<string, Tag[]>,
    userQuery?: string
  ): ChatContext {
    const insights = this.financialAnalysisService.analyzeTransactions(transactions, transactionTags);
    const profile = this.createUserProfile(transactions, insights);
    
    return {
      systemPrompt: this.generateSystemPrompt(insights, profile),
      userContext: this.generateUserContext(profile, insights),
      financialSummary: this.generateFinancialSummary(summary, insights),
      capabilities: this.getAvailableCapabilities(transactions.length > 0),
    };
  }

  private generateSystemPrompt(insights: TransactionInsights, profile: UserFinancialProfile): string {
    const currentDate = new Date().toLocaleDateString('en-IN');
    
    return `You are an expert personal finance assistant with deep knowledge of Indian banking and financial practices. You are helping a user analyze their HDFC Bank account transactions and providing personalized financial insights.

CURRENT DATE: ${currentDate}

USER FINANCIAL PROFILE:
- Financial Persona: ${profile.financialPersona}
- Primary Spending: ${profile.primarySpendingCategories.slice(0, 3).join(', ')}
- Income Pattern: ${profile.monthlyIncomePattern}
- Transaction History: ${profile.totalTransactions} transactions from ${profile.timeRange.start.toLocaleDateString('en-IN')} to ${profile.timeRange.end.toLocaleDateString('en-IN')}
- Financial Health Score: ${insights.financialHealthScore.overall}/100

KEY FINANCIAL INSIGHTS:
- Savings Rate: ${insights.financialHealthScore.savingsRate}%
- Top Spending Categories: ${insights.spendingPatterns.slice(0, 3).map(p => `${p.category} (₹${p.totalAmount.toLocaleString('en-IN')})`).join(', ')}
- Monthly Cash Flow: ₹${insights.cashFlowAnalysis.averageMonthlyIncome.toLocaleString('en-IN')} income, ₹${insights.cashFlowAnalysis.averageMonthlyExpense.toLocaleString('en-IN')} expenses
- Spending Stability: ${insights.financialHealthScore.spendingVariability < 0.3 ? 'Stable' : insights.financialHealthScore.spendingVariability > 0.7 ? 'Highly Variable' : 'Moderate'}

${insights.anomalies.length > 0 ? `RECENT ANOMALIES:
${insights.anomalies.slice(0, 3).map(a => `- ${a.reason}`).join('\n')}` : ''}

${insights.recurringTransactions.length > 0 ? `RECURRING PAYMENTS:
${insights.recurringTransactions.slice(0, 3).map(r => `- ${r.merchant}: ₹${r.averageAmount.toFixed(0)} ${r.frequency}`).join('\n')}` : ''}

RECOMMENDATIONS:
${insights.financialHealthScore.recommendations.map(r => `- ${r}`).join('\n')}

IMPORTANT INSTRUCTIONS:
1. Always format currency amounts in Indian Rupees (₹) with proper formatting (e.g., ₹1,23,456)
2. Provide specific, actionable financial advice based on the user's actual transaction patterns
3. Reference specific merchants, categories, or amounts from their transaction history when relevant
4. Be encouraging and supportive while being honest about financial health
5. Use Indian financial context (EPF, PPF, SIP, etc.) when giving investment advice
6. When discussing trends, compare current period to previous periods using the available data
7. If asked about specific transactions, provide detailed breakdowns with dates and amounts
8. Suggest practical budgeting strategies based on their spending patterns
9. Alert them to any unusual spending patterns or potential fraud indicators
10. Keep responses conversational but informative, adapting to the user's financial literacy level

You have access to detailed transaction data including dates, amounts, merchants, categories (via tags), and can perform complex analysis on spending patterns, trends, and financial behavior.`;
  }

  private generateUserContext(profile: UserFinancialProfile, insights: TransactionInsights): string {
    const topCategory = insights.spendingPatterns[0];
    const topMerchant = insights.topMerchants[0];
    
    let context = `User is a ${profile.financialPersona} spender with ${profile.monthlyIncomePattern} income patterns. `;
    
    if (topCategory) {
      context += `Primary spending category is ${topCategory.category} (₹${topCategory.totalAmount.toLocaleString('en-IN')}, ${topCategory.transactionCount} transactions). `;
    }
    
    if (topMerchant) {
      context += `Most frequent merchant: ${topMerchant.merchant} (₹${topMerchant.totalSpent.toLocaleString('en-IN')}). `;
    }
    
    if (insights.financialHealthScore.savingsRate < 0) {
      context += `Currently spending more than earning (negative savings rate). `;
    } else if (insights.financialHealthScore.savingsRate < 10) {
      context += `Low savings rate - needs guidance on expense management. `;
    } else if (insights.financialHealthScore.savingsRate > 20) {
      context += `Good savings rate - may benefit from investment advice. `;
    }
    
    return context;
  }

  private generateFinancialSummary(summary: StatementSummary | null, insights: TransactionInsights): string {
    if (!summary) return "No statement summary available.";
    
    const netFlow = summary.totalCredit - summary.totalDebit;
    const period = `${summary.startDate.toLocaleDateString('en-IN')} to ${summary.endDate.toLocaleDateString('en-IN')}`;
    
    return `FINANCIAL SUMMARY (${period}):
• Total Income: ₹${summary.totalCredit.toLocaleString('en-IN')} (${summary.creditCount} transactions)
• Total Expenses: ₹${summary.totalDebit.toLocaleString('en-IN')} (${summary.debitCount} transactions)
• Net Cash Flow: ₹${netFlow.toLocaleString('en-IN')} ${netFlow >= 0 ? '(Positive)' : '(Negative)'}
• Account Balance: ₹${summary.startingBalance.toLocaleString('en-IN')} → ₹${summary.endingBalance.toLocaleString('en-IN')}
• Total Transactions: ${summary.transactionCount}

TOP EXPENSE CATEGORIES:
${insights.spendingPatterns.slice(0, 5).map((p, i) => 
  `${i + 1}. ${p.category}: ₹${p.totalAmount.toLocaleString('en-IN')} (${p.transactionCount} transactions, avg ₹${p.averageAmount.toFixed(0)})`
).join('\n')}

CASH FLOW PATTERN:
• Average Monthly Income: ₹${insights.cashFlowAnalysis.averageMonthlyIncome.toLocaleString('en-IN')}
• Average Monthly Expenses: ₹${insights.cashFlowAnalysis.averageMonthlyExpense.toLocaleString('en-IN')}
• Cash Flow Stability: ${(insights.cashFlowAnalysis.cashFlowStability * 100).toFixed(0)}%`;
  }

  private createUserProfile(transactions: Transaction[], insights: TransactionInsights): UserFinancialProfile {
    const sortedTransactions = [...transactions].sort((a, b) => a.date.getTime() - b.date.getTime());
    
    // If no transactions, create a minimal profile
    if (sortedTransactions.length === 0) {
      const now = new Date();
      return {
        userId: 'current-user',
        totalTransactions: 0,
        timeRange: { start: now, end: now },
        primarySpendingCategories: [],
        financialPersona: 'balanced',
        monthlyIncomePattern: 'regular',
        riskTolerance: 'medium',
      };
    }
    
    const timeRange = {
      start: sortedTransactions[0].date,
      end: sortedTransactions[sortedTransactions.length - 1].date,
    };

    const primaryCategories = insights.spendingPatterns.slice(0, 3).map(p => p.category);
    const savingsRate = insights.financialHealthScore.savingsRate;
    const spendingVariability = insights.financialHealthScore.spendingVariability;

    // Determine financial persona
    let financialPersona: UserFinancialProfile['financialPersona'] = 'balanced';
    if (savingsRate > 25 && spendingVariability < 0.3) {
      financialPersona = 'conservative';
    } else if (savingsRate < 5 || spendingVariability > 0.7) {
      financialPersona = 'spender';
    } else if (savingsRate > 15 && insights.spendingPatterns.some(p => p.category.includes('Investment'))) {
      financialPersona = 'investor';
    }

    // Determine income pattern
    let monthlyIncomePattern: UserFinancialProfile['monthlyIncomePattern'] = 'regular';
    if (insights.cashFlowAnalysis.cashFlowStability < 0.5) {
      monthlyIncomePattern = 'irregular';
    }
    // Check for seasonal patterns (simplified)
    const monthlyVariations = insights.cashFlowAnalysis.monthlyPattern;
    const hasSeasonalPattern = monthlyVariations.length > 6 && 
      monthlyVariations.some(m => Math.abs(m.inflow - insights.cashFlowAnalysis.averageMonthlyIncome) > 
      insights.cashFlowAnalysis.averageMonthlyIncome * 0.5);
    if (hasSeasonalPattern) {
      monthlyIncomePattern = 'seasonal';
    }

    // Determine risk tolerance based on spending patterns and financial health
    let riskTolerance: UserFinancialProfile['riskTolerance'] = 'medium';
    if (savingsRate > 20 && spendingVariability < 0.3) {
      riskTolerance = 'low';
    } else if (savingsRate > 15 && insights.spendingPatterns.some(p => 
      p.category.includes('Investment') || p.category.includes('Trading'))) {
      riskTolerance = 'high';
    }

    return {
      userId: 'current-user', // This would come from auth context
      totalTransactions: transactions.length,
      timeRange,
      primarySpendingCategories: primaryCategories,
      financialPersona,
      monthlyIncomePattern,
      riskTolerance,
    };
  }

  private getAvailableCapabilities(hasTransactions: boolean): string[] {
    const baseCapabilities = [
      "Analyze spending patterns and trends",
      "Provide personalized financial advice",
      "Explain transaction categories and patterns",
      "Generate budget recommendations",
      "Identify unusual transactions or spending spikes",
    ];

    if (hasTransactions) {
      return [
        ...baseCapabilities,
        "Compare spending across different time periods",
        "Analyze merchant-wise spending patterns",
        "Track recurring payments and subscriptions",
        "Calculate financial health scores",
        "Detect potential savings opportunities",
        "Provide cash flow analysis and forecasting",
        "Identify spending anomalies and fraud indicators",
        "Generate detailed expense category breakdowns",
      ];
    }

    return baseCapabilities;
  }

  public generateQuerySpecificContext(
    userQuery: string,
    insights: TransactionInsights,
    transactions: Transaction[]
  ): string {
    const query = userQuery.toLowerCase();
    
    // Query-specific context generation
    if (query.includes('spending') || query.includes('expense')) {
      return this.generateSpendingContext(insights);
    }
    
    if (query.includes('income') || query.includes('salary') || query.includes('credit')) {
      return this.generateIncomeContext(transactions, insights);
    }
    
    if (query.includes('budget') || query.includes('save') || query.includes('saving')) {
      return this.generateBudgetContext(insights);
    }
    
    if (query.includes('merchant') || query.includes('shop') || query.includes('store')) {
      return this.generateMerchantContext(insights);
    }
    
    if (query.includes('anomaly') || query.includes('unusual') || query.includes('strange')) {
      return this.generateAnomalyContext(insights);
    }
    
    if (query.includes('trend') || query.includes('pattern') || query.includes('month')) {
      return this.generateTrendContext(insights);
    }
    
    return "";
  }

  private generateSpendingContext(insights: TransactionInsights): string {
    const topCategories = insights.spendingPatterns.slice(0, 5);
    return `SPENDING ANALYSIS CONTEXT:
${topCategories.map((cat, i) => 
  `${i + 1}. ${cat.category}: ₹${cat.totalAmount.toLocaleString('en-IN')} (${cat.transactionCount} transactions, trend: ${cat.monthlyTrend > 0 ? '+' : ''}${cat.monthlyTrend.toFixed(1)}%)`
).join('\n')}

Spending variability: ${insights.financialHealthScore.spendingVariability < 0.3 ? 'Low' : insights.financialHealthScore.spendingVariability > 0.7 ? 'High' : 'Moderate'}`;
  }

  private generateIncomeContext(transactions: Transaction[], insights: TransactionInsights): string {
    const incomeTransactions = transactions.filter(t => t.type === 'credit');
    const totalIncome = incomeTransactions.reduce((sum, t) => sum + t.amount, 0);
    
    return `INCOME ANALYSIS CONTEXT:
Total Income: ₹${totalIncome.toLocaleString('en-IN')} from ${incomeTransactions.length} transactions
Average Monthly Income: ₹${insights.cashFlowAnalysis.averageMonthlyIncome.toLocaleString('en-IN')}
Income Stability: ${insights.cashFlowAnalysis.cashFlowStability > 0.7 ? 'High' : insights.cashFlowAnalysis.cashFlowStability > 0.4 ? 'Moderate' : 'Low'}
Savings Rate: ${insights.financialHealthScore.savingsRate.toFixed(1)}%`;
  }

  private generateBudgetContext(insights: TransactionInsights): string {
    const monthlyExpense = insights.cashFlowAnalysis.averageMonthlyExpense;
    const monthlyIncome = insights.cashFlowAnalysis.averageMonthlyIncome;
    const idealBudget = monthlyIncome * 0.8; // 80% of income for expenses
    
    return `BUDGET ANALYSIS CONTEXT:
Current Monthly Expenses: ₹${monthlyExpense.toLocaleString('en-IN')}
Monthly Income: ₹${monthlyIncome.toLocaleString('en-IN')}
Recommended Budget: ₹${idealBudget.toLocaleString('en-IN')} (80% of income)
Budget Status: ${monthlyExpense > idealBudget ? 'Over Budget' : 'Within Budget'}
Potential Monthly Savings: ₹${(monthlyIncome - monthlyExpense).toLocaleString('en-IN')}`;
  }

  private generateMerchantContext(insights: TransactionInsights): string {
    const topMerchants = insights.topMerchants.slice(0, 5);
    return `MERCHANT SPENDING CONTEXT:
${topMerchants.map((merchant, i) => 
  `${i + 1}. ${merchant.merchant}: ₹${merchant.totalSpent.toLocaleString('en-IN')} (${merchant.transactionCount} transactions, avg ₹${merchant.averageAmount.toFixed(0)})`
).join('\n')}`;
  }

  private generateAnomalyContext(insights: TransactionInsights): string {
    if (insights.anomalies.length === 0) {
      return "ANOMALY CONTEXT: No significant anomalies detected in recent transactions.";
    }
    
    return `ANOMALY CONTEXT:
${insights.anomalies.map((anomaly, i) => 
  `${i + 1}. ${anomaly.type.replace('_', ' ').toUpperCase()}: ${anomaly.reason} (₹${anomaly.transaction.amount.toLocaleString('en-IN')} on ${anomaly.transaction.date.toLocaleDateString('en-IN')})`
).join('\n')}`;
  }

  private generateTrendContext(insights: TransactionInsights): string {
    const trendingCategories = insights.spendingPatterns
      .filter(p => Math.abs(p.monthlyTrend) > 10)
      .slice(0, 3);
    
    if (trendingCategories.length === 0) {
      return "TREND CONTEXT: Spending patterns are relatively stable with no major trends.";
    }
    
    return `TREND CONTEXT:
${trendingCategories.map(cat => 
  `${cat.category}: ${cat.monthlyTrend > 0 ? 'Increased' : 'Decreased'} by ${Math.abs(cat.monthlyTrend).toFixed(1)}% (₹${cat.totalAmount.toLocaleString('en-IN')} total)`
).join('\n')}`;
  }
}