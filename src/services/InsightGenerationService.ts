import { Transaction } from "@/types/transaction";
import { Tag } from "@/types/tags";
import { TransactionInsights, SpendingPattern, MerchantAnalysis } from "./FinancialAnalysisService";

export interface FinancialAdvice {
  id: string;
  type: 'budget' | 'savings' | 'investment' | 'expense_reduction' | 'cash_flow' | 'goal_setting';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  actionItems: string[];
  potentialSavings?: number;
  timeframe: string;
  category?: string;
}

export interface PersonalizedInsights {
  financialAdvice: FinancialAdvice[];
  budgetRecommendations: BudgetRecommendation[];
  savingsOpportunities: SavingsOpportunity[];
  spendingAlerts: SpendingAlert[];
  goalSuggestions: GoalSuggestion[];
}

export interface BudgetRecommendation {
  category: string;
  currentSpending: number;
  recommendedBudget: number;
  difference: number;
  reasoning: string;
}

export interface SavingsOpportunity {
  opportunity: string;
  potentialMonthlySavings: number;
  difficulty: 'easy' | 'medium' | 'hard';
  description: string;
  actionSteps: string[];
}

export interface SpendingAlert {
  type: 'overspending' | 'unusual_pattern' | 'subscription_reminder' | 'duplicate_charge';
  message: string;
  severity: 'info' | 'warning' | 'critical';
  transactions?: Transaction[];
  amount?: number;
}

export interface GoalSuggestion {
  goal: string;
  targetAmount: number;
  timeframe: string;
  monthlyContribution: number;
  reasoning: string;
  priority: number;
}

export class InsightGenerationService {
  
  public generatePersonalizedInsights(
    insights: TransactionInsights,
    transactions: Transaction[],
    transactionTags: Map<string, Tag[]>
  ): PersonalizedInsights {
    return {
      financialAdvice: this.generateFinancialAdvice(insights, transactions),
      budgetRecommendations: this.generateBudgetRecommendations(insights),
      savingsOpportunities: this.identifySavingsOpportunities(insights, transactions, transactionTags),
      spendingAlerts: this.generateSpendingAlerts(insights, transactions),
      goalSuggestions: this.suggestFinancialGoals(insights, transactions),
    };
  }

  private generateFinancialAdvice(insights: TransactionInsights, transactions: Transaction[]): FinancialAdvice[] {
    const advice: FinancialAdvice[] = [];
    const healthScore = insights.financialHealthScore;
    const monthlyIncome = insights.cashFlowAnalysis.averageMonthlyIncome;
    const monthlyExpense = insights.cashFlowAnalysis.averageMonthlyExpense;

    // Emergency Fund Advice
    if (healthScore.savingsRate < 20) {
      advice.push({
        id: 'emergency_fund',
        type: 'savings',
        priority: 'high',
        title: 'Build an Emergency Fund',
        description: 'Your current savings rate is low. Building an emergency fund should be your top priority.',
        actionItems: [
          'Set up automatic transfer of 10% of income to savings account',
          'Start with a goal of ₹50,000 emergency fund',
          'Keep emergency fund in a separate high-yield savings account',
          'Avoid using emergency fund for non-emergencies'
        ],
        potentialSavings: monthlyIncome * 0.1,
        timeframe: '6-12 months',
        category: 'Emergency Planning'
      });
    }

    // Budget Management Advice
    if (healthScore.spendingVariability > 0.6) {
      advice.push({
        id: 'budget_control',
        type: 'budget',
        priority: 'high',
        title: 'Improve Budget Control',
        description: 'Your spending patterns are highly variable. A structured budget will help maintain financial stability.',
        actionItems: [
          'Use the 50/30/20 rule: 50% needs, 30% wants, 20% savings',
          'Track daily expenses using a mobile app',
          'Set weekly spending limits for discretionary categories',
          'Review and adjust budget monthly'
        ],
        timeframe: '1-3 months',
        category: 'Budget Management'
      });
    }

    // Investment Advice
    if (healthScore.savingsRate > 15 && monthlyIncome > 50000) {
      advice.push({
        id: 'investment_planning',
        type: 'investment',
        priority: 'medium',
        title: 'Start Investment Portfolio',
        description: 'With a good savings rate, consider investing for long-term wealth building.',
        actionItems: [
          'Start SIP in diversified equity mutual funds (₹5,000/month)',
          'Consider ELSS funds for tax savings under 80C',
          'Open PPF account for long-term tax-free returns',
          'Invest in index funds for low-cost diversification'
        ],
        potentialSavings: monthlyIncome * 0.15,
        timeframe: '1-2 months to start',
        category: 'Investment Planning'
      });
    }

    // Debt Management
    const highSpendingCategories = insights.spendingPatterns.filter(p => p.totalAmount > monthlyIncome * 0.3);
    if (highSpendingCategories.length > 0) {
      advice.push({
        id: 'expense_reduction',
        type: 'expense_reduction',
        priority: 'medium',
        title: 'Reduce High-Expense Categories',
        description: `Your ${highSpendingCategories[0].category} spending is quite high relative to your income.`,
        actionItems: [
          `Set a monthly limit of ₹${(monthlyIncome * 0.2).toFixed(0)} for ${highSpendingCategories[0].category}`,
          'Look for cheaper alternatives or bulk purchasing options',
          'Track each transaction in this category',
          'Review monthly and find areas to cut back'
        ],
        potentialSavings: highSpendingCategories[0].totalAmount * 0.2,
        timeframe: '2-4 weeks',
        category: highSpendingCategories[0].category
      });
    }

    // Cash Flow Optimization
    if (insights.cashFlowAnalysis.cashFlowStability < 0.5) {
      advice.push({
        id: 'cash_flow_stability',
        type: 'cash_flow',
        priority: 'high',
        title: 'Improve Cash Flow Stability',
        description: 'Your cash flow is quite variable, which can lead to financial stress.',
        actionItems: [
          'Create a cash flow calendar to predict income and expenses',
          'Build a buffer of 2 months expenses in checking account',
          'Consider setting up automatic bill payments to avoid late fees',
          'Look for ways to smooth out irregular income'
        ],
        timeframe: '1-3 months',
        category: 'Cash Flow Management'
      });
    }

    return advice.slice(0, 4); // Return top 4 pieces of advice
  }

  private generateBudgetRecommendations(insights: TransactionInsights): BudgetRecommendation[] {
    const recommendations: BudgetRecommendation[] = [];
    const totalExpense = insights.cashFlowAnalysis.averageMonthlyExpense;
    const totalIncome = insights.cashFlowAnalysis.averageMonthlyIncome;

    // 50/30/20 rule-based recommendations
    const needs = totalIncome * 0.5;
    const wants = totalIncome * 0.3;
    const savings = totalIncome * 0.2;

    insights.spendingPatterns.slice(0, 5).forEach(pattern => {
      let recommendedBudget: number;
      let reasoning: string;

      // Categorize as needs vs wants
      const isNeed = this.isNecessaryCategory(pattern.category);
      
      if (isNeed) {
        recommendedBudget = Math.min(pattern.totalAmount, needs * 0.6); // Max 60% of needs budget
        reasoning = `Essential category - recommended to stay within ${((recommendedBudget / totalIncome) * 100).toFixed(1)}% of income`;
      } else {
        recommendedBudget = Math.min(pattern.totalAmount, wants * 0.4); // Max 40% of wants budget
        reasoning = `Discretionary spending - consider limiting to ${((recommendedBudget / totalIncome) * 100).toFixed(1)}% of income`;
      }

      if (pattern.totalAmount > recommendedBudget * 1.2) { // Only show if significantly over budget
        recommendations.push({
          category: pattern.category,
          currentSpending: pattern.totalAmount,
          recommendedBudget,
          difference: pattern.totalAmount - recommendedBudget,
          reasoning
        });
      }
    });

    return recommendations;
  }

  private identifySavingsOpportunities(
    insights: TransactionInsights,
    transactions: Transaction[],
    transactionTags: Map<string, Tag[]>
  ): SavingsOpportunity[] {
    const opportunities: SavingsOpportunity[] = [];

    // Subscription optimization
    const subscriptions = this.identifySubscriptions(transactions);
    if (subscriptions.length > 3) {
      const totalSubscriptionCost = subscriptions.reduce((sum, sub) => sum + sub.amount, 0);
      opportunities.push({
        opportunity: 'Optimize Subscriptions',
        potentialMonthlySavings: totalSubscriptionCost * 0.3,
        difficulty: 'easy',
        description: `You have ${subscriptions.length} subscription services costing ₹${totalSubscriptionCost.toFixed(0)}/month`,
        actionSteps: [
          'Review all subscription services and cancel unused ones',
          'Look for annual plans that offer discounts',
          'Consider family plans for streaming services',
          'Set calendar reminders before free trial periods end'
        ]
      });
    }

    // Food delivery optimization
    const foodSpending = insights.spendingPatterns.find(p => 
      p.category.toLowerCase().includes('food') || p.category.toLowerCase().includes('dining')
    );
    if (foodSpending && foodSpending.totalAmount > 8000) {
      opportunities.push({
        opportunity: 'Reduce Food Delivery Costs',
        potentialMonthlySavings: foodSpending.totalAmount * 0.4,
        difficulty: 'medium',
        description: `High food delivery spending of ₹${foodSpending.totalAmount.toFixed(0)}/month`,
        actionSteps: [
          'Plan meals and cook at home 3-4 times per week',
          'Use food delivery only on weekends',
          'Look for bulk cooking and meal prep strategies',
          'Find nearby affordable restaurants for dining out'
        ]
      });
    }

    // Transportation optimization
    const transportSpending = insights.spendingPatterns.find(p => 
      p.category.toLowerCase().includes('transport') || p.category.toLowerCase().includes('fuel')
    );
    if (transportSpending && transportSpending.totalAmount > 5000) {
      opportunities.push({
        opportunity: 'Optimize Transportation Costs',
        potentialMonthlySavings: transportSpending.totalAmount * 0.25,
        difficulty: 'medium',
        description: `Transportation costs are ₹${transportSpending.totalAmount.toFixed(0)}/month`,
        actionSteps: [
          'Use public transport or carpool when possible',
          'Plan trips to reduce unnecessary travel',
          'Consider monthly transport passes if available',
          'Walk or cycle for short distances'
        ]
      });
    }

    // High-frequency small purchases
    const smallPurchases = transactions.filter(t => 
      t.type === 'debit' && t.amount < 500 && t.amount > 50
    );
    if (smallPurchases.length > 50) {
      const totalSmallPurchases = smallPurchases.reduce((sum, t) => sum + t.amount, 0);
      opportunities.push({
        opportunity: 'Control Impulse Purchases',
        potentialMonthlySavings: totalSmallPurchases * 0.3,
        difficulty: 'hard',
        description: `Many small purchases (₹50-500) totaling ₹${totalSmallPurchases.toFixed(0)}/month`,
        actionSteps: [
          'Wait 24 hours before making non-essential purchases',
          'Use a shopping list and stick to it',
          'Set a weekly allowance for discretionary spending',
          'Find free or low-cost alternatives for entertainment'
        ]
      });
    }

    return opportunities.slice(0, 3);
  }

  private generateSpendingAlerts(insights: TransactionInsights, transactions: Transaction[]): SpendingAlert[] {
    const alerts: SpendingAlert[] = [];
    const monthlyExpense = insights.cashFlowAnalysis.averageMonthlyExpense;

    // Overspending alerts
    insights.spendingPatterns.forEach(pattern => {
      if (pattern.monthlyTrend > 25) {
        alerts.push({
          type: 'overspending',
          message: `${pattern.category} spending increased by ${pattern.monthlyTrend.toFixed(1)}% this period (₹${pattern.totalAmount.toFixed(0)})`,
          severity: 'warning',
          amount: pattern.totalAmount
        });
      }
    });

    // Anomaly alerts
    insights.anomalies.slice(0, 2).forEach(anomaly => {
      alerts.push({
        type: 'unusual_pattern',
        message: anomaly.reason,
        severity: anomaly.type === 'unusual_amount' ? 'warning' : 'info',
        transactions: [anomaly.transaction],
        amount: anomaly.transaction.amount
      });
    });

    // Subscription reminders
    const subscriptions = this.identifySubscriptions(transactions);
    subscriptions.slice(0, 2).forEach(sub => {
      alerts.push({
        type: 'subscription_reminder',
        message: `Regular charge from ${sub.merchant} - ₹${sub.amount.toFixed(0)} (consider reviewing if still needed)`,
        severity: 'info',
        amount: sub.amount
      });
    });

    return alerts.slice(0, 4);
  }

  private suggestFinancialGoals(insights: TransactionInsights, transactions: Transaction[]): GoalSuggestion[] {
    const goals: GoalSuggestion[] = [];
    const monthlyIncome = insights.cashFlowAnalysis.averageMonthlyIncome;
    const monthlySavings = monthlyIncome - insights.cashFlowAnalysis.averageMonthlyExpense;

    // Emergency fund goal
    if (monthlySavings > 0) {
      const emergencyFundTarget = insights.cashFlowAnalysis.averageMonthlyExpense * 6;
      goals.push({
        goal: '6-Month Emergency Fund',
        targetAmount: emergencyFundTarget,
        timeframe: '18-24 months',
        monthlyContribution: Math.min(monthlySavings * 0.5, emergencyFundTarget / 18),
        reasoning: 'Essential financial safety net for unexpected expenses',
        priority: 1
      });
    }

    // Down payment for property
    if (monthlyIncome > 75000 && monthlySavings > 15000) {
      goals.push({
        goal: 'Property Down Payment',
        targetAmount: 1500000,
        timeframe: '5-7 years',
        monthlyContribution: 20000,
        reasoning: 'Real estate investment for long-term wealth building',
        priority: 2
      });
    }

    // Vacation fund
    if (monthlySavings > 5000) {
      goals.push({
        goal: 'Annual Vacation Fund',
        targetAmount: 150000,
        timeframe: '12 months',
        monthlyContribution: 12500,
        reasoning: 'Planned leisure and travel expenses',
        priority: 3
      });
    }

    // Retirement planning
    if (monthlyIncome > 50000) {
      const retirementTarget = monthlyIncome * 12 * 25; // 25x annual income
      goals.push({
        goal: 'Retirement Planning',
        targetAmount: retirementTarget,
        timeframe: '25-30 years',
        monthlyContribution: Math.min(monthlyIncome * 0.15, retirementTarget / (25 * 12)),
        reasoning: 'Long-term financial security and independence',
        priority: 2
      });
    }

    return goals.sort((a, b) => a.priority - b.priority).slice(0, 3);
  }

  private isNecessaryCategory(category: string): boolean {
    const necessaryCategories = [
      'utilities', 'healthcare', 'groceries', 'rent', 'mortgage', 
      'insurance', 'fuel', 'education', 'debt payment'
    ];
    
    return necessaryCategories.some(necessary => 
      category.toLowerCase().includes(necessary)
    );
  }

  private identifySubscriptions(transactions: Transaction[]): Array<{ merchant: string; amount: number }> {
    const subscriptionKeywords = [
      'netflix', 'amazon prime', 'spotify', 'youtube', 'hotstar',
      'zee5', 'voot', 'subscription', 'monthly', 'annual'
    ];

    const merchantFrequency = new Map<string, { count: number; amounts: number[]; dates: Date[] }>();
    
    transactions.filter(t => t.type === 'debit').forEach(transaction => {
      const narration = transaction.narration.toLowerCase();
      const merchant = transaction.merchant?.toLowerCase() || '';
      
      const isSubscription = subscriptionKeywords.some(keyword => 
        narration.includes(keyword) || merchant.includes(keyword)
      );
      
      if (isSubscription || (transaction.merchant && this.isRegularAmount(transaction, transactions))) {
        const key = transaction.merchant || 'Unknown Service';
        if (!merchantFrequency.has(key)) {
          merchantFrequency.set(key, { count: 0, amounts: [], dates: [] });
        }
        const data = merchantFrequency.get(key)!;
        data.count += 1;
        data.amounts.push(transaction.amount);
        data.dates.push(transaction.date);
      }
    });

    return Array.from(merchantFrequency.entries())
      .filter(([_, data]) => data.count >= 2) // At least 2 transactions
      .map(([merchant, data]) => ({
        merchant,
        amount: data.amounts.reduce((sum, amt) => sum + amt, 0) / data.amounts.length
      }));
  }

  private isRegularAmount(transaction: Transaction, allTransactions: Transaction[]): boolean {
    const sameAmountTransactions = allTransactions.filter(t => 
      Math.abs(t.amount - transaction.amount) < 10 && // Within ₹10
      t.merchant === transaction.merchant &&
      t.chqRefNumber !== transaction.chqRefNumber
    );
    
    return sameAmountTransactions.length >= 1; // Found at least one other similar transaction
  }

  public generateMonthlyFinancialReport(
    insights: TransactionInsights,
    transactions: Transaction[],
    transactionTags: Map<string, Tag[]>
  ): string {
    const personalizedInsights = this.generatePersonalizedInsights(insights, transactions, transactionTags);
    const monthlyIncome = insights.cashFlowAnalysis.averageMonthlyIncome;
    const monthlyExpense = insights.cashFlowAnalysis.averageMonthlyExpense;
    
    let report = `# Monthly Financial Report\n\n`;
    
    // Overall Health
    report += `## Financial Health Score: ${insights.financialHealthScore.overall}/100\n\n`;
    
    // Cash Flow Summary
    report += `## Cash Flow Summary\n`;
    report += `- Monthly Income: ₹${monthlyIncome.toLocaleString('en-IN')}\n`;
    report += `- Monthly Expenses: ₹${monthlyExpense.toLocaleString('en-IN')}\n`;
    report += `- Net Cash Flow: ₹${(monthlyIncome - monthlyExpense).toLocaleString('en-IN')}\n`;
    report += `- Savings Rate: ${insights.financialHealthScore.savingsRate.toFixed(1)}%\n\n`;
    
    // Top Recommendations
    report += `## Priority Actions\n`;
    personalizedInsights.financialAdvice.slice(0, 3).forEach((advice, index) => {
      report += `${index + 1}. **${advice.title}** (${advice.priority} priority)\n`;
      report += `   - ${advice.description}\n`;
      report += `   - Timeframe: ${advice.timeframe}\n\n`;
    });
    
    // Savings Opportunities
    if (personalizedInsights.savingsOpportunities.length > 0) {
      report += `## Savings Opportunities\n`;
      personalizedInsights.savingsOpportunities.forEach(opportunity => {
        report += `- **${opportunity.opportunity}**: Save ₹${opportunity.potentialMonthlySavings.toFixed(0)}/month (${opportunity.difficulty} difficulty)\n`;
      });
      report += '\n';
    }
    
    // Spending Alerts
    if (personalizedInsights.spendingAlerts.length > 0) {
      report += `## Spending Alerts\n`;
      personalizedInsights.spendingAlerts.forEach(alert => {
        const icon = alert.severity === 'critical' ? '🚨' : alert.severity === 'warning' ? '⚠️' : 'ℹ️';
        report += `${icon} ${alert.message}\n`;
      });
      report += '\n';
    }
    
    return report;
  }
}