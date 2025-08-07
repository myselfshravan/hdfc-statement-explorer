import { Transaction, StatementSummary } from "@/types/transaction";
import { Tag } from "@/types/tags";

export interface QueryResult {
  transactions: Transaction[];
  summary: {
    count: number;
    totalAmount: number;
    averageAmount: number;
    dateRange?: { start: Date; end: Date };
  };
  insights: string[];
}

export interface QueryFilters {
  dateRange?: { start?: Date; end?: Date };
  amountRange?: { min?: number; max?: number };
  transactionType?: 'credit' | 'debit';
  categories?: string[];
  merchants?: string[];
  tags?: string[];
  keywords?: string[];
}

export class TransactionQueryEngine {
  
  public processNaturalLanguageQuery(
    query: string,
    transactions: Transaction[],
    transactionTags: Map<string, Tag[]>
  ): QueryResult {
    console.log("🔍 Processing query:", query);
    console.log("📊 Available transactions:", transactions.length);
    
    const filters = this.parseQueryToFilters(query);
    console.log("🎯 Parsed filters:", {
      dateRange: filters.dateRange ? {
        start: filters.dateRange.start?.toLocaleDateString(),
        end: filters.dateRange.end?.toLocaleDateString()
      } : 'none',
      categories: filters.categories,
      transactionType: filters.transactionType,
      keywords: filters.keywords
    });
    
    const filteredTransactions = this.applyFilters(transactions, filters, transactionTags);
    console.log("✅ Filtered result:", filteredTransactions.length, "transactions found");
    
    if (filteredTransactions.length > 0) {
      console.log("📝 Sample transactions found:", 
        filteredTransactions.slice(0, 3).map(t => ({
          date: t.date.toLocaleDateString(),
          narration: t.narration.substring(0, 50),
          amount: t.amount
        }))
      );
    }
    
    return {
      transactions: filteredTransactions,
      summary: this.generateSummary(filteredTransactions),
      insights: this.generateInsights(query, filteredTransactions, transactions),
    };
  }

  private parseQueryToFilters(query: string): QueryFilters {
    const lowerQuery = query.toLowerCase();
    const filters: QueryFilters = {};

    // Date parsing
    filters.dateRange = this.extractDateRange(lowerQuery);
    
    // Amount parsing
    filters.amountRange = this.extractAmountRange(lowerQuery);
    
    // Transaction type
    if (lowerQuery.includes('income') || lowerQuery.includes('salary') || lowerQuery.includes('credit') || lowerQuery.includes('received')) {
      filters.transactionType = 'credit';
    } else if (lowerQuery.includes('expense') || lowerQuery.includes('spent') || lowerQuery.includes('paid') || lowerQuery.includes('debit')) {
      filters.transactionType = 'debit';
    }

    // Categories
    filters.categories = this.extractCategories(lowerQuery);
    
    // Merchants
    filters.merchants = this.extractMerchants(lowerQuery);
    
    // Keywords for narration search
    filters.keywords = this.extractKeywords(lowerQuery);

    return filters;
  }

  private extractDateRange(query: string): { start?: Date; end?: Date } | undefined {
    const now = new Date();
    const dateRange: { start?: Date; end?: Date } = {};

    // This month
    if (query.includes('this month') || query.includes('current month')) {
      dateRange.start = new Date(now.getFullYear(), now.getMonth(), 1);
      dateRange.end = now;
    }
    // Last month
    else if (query.includes('last month') || query.includes('previous month')) {
      dateRange.start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      dateRange.end = new Date(now.getFullYear(), now.getMonth(), 0);
    }
    // This year
    else if (query.includes('this year') || query.includes('current year')) {
      dateRange.start = new Date(now.getFullYear(), 0, 1);
      dateRange.end = now;
    }
    // Last year
    else if (query.includes('last year') || query.includes('previous year')) {
      dateRange.start = new Date(now.getFullYear() - 1, 0, 1);
      dateRange.end = new Date(now.getFullYear() - 1, 11, 31);
    }
    // Last X days
    else {
      const daysMatch = query.match(/(?:last|past)\s+(\d+)\s+days?/);
      if (daysMatch) {
        const days = parseInt(daysMatch[1]);
        dateRange.start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        dateRange.end = now;
      }
    }

    // Last X months
    const monthsMatch = query.match(/(?:last|past)\s+(\d+)\s+months?/);
    if (monthsMatch) {
      const months = parseInt(monthsMatch[1]);
      dateRange.start = new Date(now.getFullYear(), now.getMonth() - months, 1);
      dateRange.end = now;
    }

    // Specific months
    const months = [
      'january', 'february', 'march', 'april', 'may', 'june',
      'july', 'august', 'september', 'october', 'november', 'december'
    ];
    
    for (let i = 0; i < months.length; i++) {
      if (query.includes(months[i])) {
        // Default to current year unless specified
        const year = now.getFullYear();
        dateRange.start = new Date(year, i, 1);
        dateRange.end = new Date(year, i + 1, 0);
        break;
      }
    }

    return Object.keys(dateRange).length > 0 ? dateRange : undefined;
  }

  private extractAmountRange(query: string): { min?: number; max?: number } | undefined {
    const amountRange: { min?: number; max?: number } = {};

    // Greater than amount
    const greaterMatch = query.match(/(?:above|over|more than|greater than)\s*(?:₹|rs\.?|rupees?)\s*(\d+(?:,\d+)*(?:\.\d+)?)/i);
    if (greaterMatch) {
      amountRange.min = parseFloat(greaterMatch[1].replace(/,/g, ''));
    }

    // Less than amount
    const lessMatch = query.match(/(?:below|under|less than)\s*(?:₹|rs\.?|rupees?)\s*(\d+(?:,\d+)*(?:\.\d+)?)/i);
    if (lessMatch) {
      amountRange.max = parseFloat(lessMatch[1].replace(/,/g, ''));
    }

    // Between amounts
    const betweenMatch = query.match(/between\s*(?:₹|rs\.?|rupees?)\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(?:and|to)\s*(?:₹|rs\.?|rupees?)\s*(\d+(?:,\d+)*(?:\.\d+)?)/i);
    if (betweenMatch) {
      amountRange.min = parseFloat(betweenMatch[1].replace(/,/g, ''));
      amountRange.max = parseFloat(betweenMatch[2].replace(/,/g, ''));
    }

    return Object.keys(amountRange).length > 0 ? amountRange : undefined;
  }

  private extractCategories(query: string): string[] {
    const categories: string[] = [];
    const categoryMappings = {
      'food': ['food', 'dining', 'restaurant', 'zomato', 'swiggy', 'delivery'],
      'transport': ['transport', 'transportation', 'uber', 'ola', 'taxi', 'fuel', 'petrol'],
      'shopping': ['shopping', 'amazon', 'flipkart', 'mall', 'store'],
      'entertainment': ['entertainment', 'movie', 'netflix', 'spotify', 'gaming'],
      'utilities': ['utility', 'utilities', 'electricity', 'water', 'gas', 'internet'],
      'healthcare': ['healthcare', 'medical', 'hospital', 'pharmacy', 'doctor'],
      'education': ['education', 'school', 'college', 'course', 'training'],
      'investment': ['investment', 'mutual fund', 'sip', 'stocks', 'trading'],
    };

    for (const [category, keywords] of Object.entries(categoryMappings)) {
      if (keywords.some(keyword => query.includes(keyword))) {
        categories.push(category);
      }
    }

    return categories;
  }

  private extractMerchants(query: string): string[] {
    const merchants: string[] = [];
    const commonMerchants = [
      'zomato', 'swiggy', 'amazon', 'flipkart', 'uber', 'ola',
      'netflix', 'spotify', 'paytm', 'phonepe', 'googlepay',
      'bigbasket', 'grofers', 'myntra', 'ajio'
    ];

    commonMerchants.forEach(merchant => {
      if (query.includes(merchant.toLowerCase())) {
        merchants.push(merchant);
      }
    });

    return merchants;
  }

  private extractKeywords(query: string): string[] {
    const keywords: string[] = [];
    
    // Remove common words and extract meaningful terms
    const commonWords = new Set([
      'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours',
      'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', 'her', 'hers',
      'herself', 'it', 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves',
      'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'is', 'are',
      'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does',
      'did', 'doing', 'a', 'an', 'the', 'and', 'but', 'if', 'or', 'because', 'as', 'until',
      'while', 'of', 'at', 'by', 'for', 'with', 'about', 'against', 'between', 'into',
      'through', 'during', 'before', 'after', 'above', 'below', 'up', 'down', 'in', 'out',
      'on', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'show', 'tell',
      'how', 'much', 'many', 'spent', 'transactions', 'money'
    ]);

    const words = query.toLowerCase().split(/\s+/);
    words.forEach(word => {
      const cleanWord = word.replace(/[^\w]/g, '');
      if (cleanWord.length > 2 && !commonWords.has(cleanWord) && !this.isNumber(cleanWord)) {
        keywords.push(cleanWord);
      }
    });

    return keywords;
  }

  private isNumber(str: string): boolean {
    return /^\d+$/.test(str);
  }

  private applyFilters(
    transactions: Transaction[],
    filters: QueryFilters,
    transactionTags: Map<string, Tag[]>
  ): Transaction[] {
    let filtered = [...transactions];

    // Apply date filter
    if (filters.dateRange) {
      filtered = filtered.filter(t => {
        if (filters.dateRange!.start && t.date < filters.dateRange!.start) return false;
        if (filters.dateRange!.end && t.date > filters.dateRange!.end) return false;
        return true;
      });
    }

    // Apply amount filter
    if (filters.amountRange) {
      filtered = filtered.filter(t => {
        if (filters.amountRange!.min && t.amount < filters.amountRange!.min) return false;
        if (filters.amountRange!.max && t.amount > filters.amountRange!.max) return false;
        return true;
      });
    }

    // Apply transaction type filter
    if (filters.transactionType) {
      filtered = filtered.filter(t => t.type === filters.transactionType);
    }

    // Apply category filter (via tags or auto-categorization)
    if (filters.categories && filters.categories.length > 0) {
      filtered = filtered.filter(t => {
        const tags = transactionTags.get(t.chqRefNumber) || [];
        const tagNames = tags.map(tag => tag.name.toLowerCase());
        
        // Check if transaction has matching tags
        const hasMatchingTag = filters.categories!.some(category =>
          tagNames.some(tagName => tagName.includes(category.toLowerCase()))
        );
        
        // Also check narration for category keywords if no matching tags
        if (!hasMatchingTag) {
          return filters.categories!.some(category =>
            this.matchesCategoryInNarration(t.narration, category)
          );
        }
        
        return hasMatchingTag;
      });
    }

    // Apply merchant filter
    if (filters.merchants && filters.merchants.length > 0) {
      filtered = filtered.filter(t => 
        t.merchant && filters.merchants!.some(merchant =>
          t.merchant!.toLowerCase().includes(merchant.toLowerCase())
        )
      );
    }

    // Apply keyword filter
    if (filters.keywords && filters.keywords.length > 0) {
      filtered = filtered.filter(t =>
        filters.keywords!.some(keyword =>
          t.narration.toLowerCase().includes(keyword.toLowerCase())
        )
      );
    }

    return filtered.sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  private matchesCategoryInNarration(narration: string, category: string): boolean {
    const lowerNarration = narration.toLowerCase();
    const lowerCategory = category.toLowerCase();
    
    const categoryKeywords = {
      'food': ['food', 'restaurant', 'zomato', 'swiggy', 'dining', 'cafe', 'hotel'],
      'transport': ['uber', 'ola', 'taxi', 'fuel', 'petrol', 'transport', 'metro'],
      'shopping': ['amazon', 'flipkart', 'shopping', 'mall', 'store', 'myntra'],
      'entertainment': ['movie', 'netflix', 'spotify', 'gaming', 'entertainment'],
      'utilities': ['electricity', 'water', 'gas', 'internet', 'utility', 'bill'],
      'healthcare': ['hospital', 'pharmacy', 'medical', 'doctor', 'health'],
    };

    const keywords = categoryKeywords[lowerCategory as keyof typeof categoryKeywords] || [lowerCategory];
    return keywords.some(keyword => lowerNarration.includes(keyword));
  }

  private generateSummary(transactions: Transaction[]) {
    if (transactions.length === 0) {
      return { count: 0, totalAmount: 0, averageAmount: 0 };
    }

    const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);
    const sortedTransactions = transactions.sort((a, b) => a.date.getTime() - b.date.getTime());
    
    return {
      count: transactions.length,
      totalAmount,
      averageAmount: totalAmount / transactions.length,
      dateRange: {
        start: sortedTransactions[0].date,
        end: sortedTransactions[sortedTransactions.length - 1].date,
      },
    };
  }

  private generateInsights(query: string, filteredTransactions: Transaction[], allTransactions: Transaction[]): string[] {
    const insights: string[] = [];
    
    if (filteredTransactions.length === 0) {
      insights.push("No transactions found matching your criteria.");
      return insights;
    }

    const percentage = (filteredTransactions.length / allTransactions.length) * 100;
    insights.push(`These ${filteredTransactions.length} transactions represent ${percentage.toFixed(1)}% of your total transactions.`);

    // Amount insights
    const amounts = filteredTransactions.map(t => t.amount).sort((a, b) => a - b);
    const median = amounts[Math.floor(amounts.length / 2)];
    const highest = Math.max(...amounts);
    const lowest = Math.min(...amounts);

    if (amounts.length > 1) {
      insights.push(`Amount range: ₹${lowest.toFixed(2)} to ₹${highest.toFixed(2)}, median: ₹${median.toFixed(2)}.`);
    }

    // Frequency insights
    if (query.includes('month') || query.includes('frequency')) {
      const monthlyFrequency = this.calculateMonthlyFrequency(filteredTransactions);
      if (monthlyFrequency > 0) {
        insights.push(`Average frequency: ${monthlyFrequency.toFixed(1)} transactions per month.`);
      }
    }

    // Merchant insights
    const merchants = new Map<string, number>();
    filteredTransactions.forEach(t => {
      if (t.merchant) {
        merchants.set(t.merchant, (merchants.get(t.merchant) || 0) + 1);
      }
    });

    if (merchants.size > 0) {
      const topMerchant = Array.from(merchants.entries()).reduce((a, b) => a[1] > b[1] ? a : b);
      insights.push(`Most frequent merchant: ${topMerchant[0]} (${topMerchant[1]} transactions).`);
    }

    // Trend insights
    if (filteredTransactions.length > 5) {
      const trend = this.calculateTrend(filteredTransactions);
      if (Math.abs(trend) > 10) {
        insights.push(`${trend > 0 ? 'Increasing' : 'Decreasing'} trend detected (${Math.abs(trend).toFixed(1)}% change).`);
      }
    }

    return insights.slice(0, 4); // Limit to 4 insights
  }

  private calculateMonthlyFrequency(transactions: Transaction[]): number {
    if (transactions.length === 0) return 0;
    
    const sortedTransactions = transactions.sort((a, b) => a.date.getTime() - b.date.getTime());
    const firstDate = sortedTransactions[0].date;
    const lastDate = sortedTransactions[sortedTransactions.length - 1].date;
    
    const monthsDiff = (lastDate.getFullYear() - firstDate.getFullYear()) * 12 + 
                      (lastDate.getMonth() - firstDate.getMonth()) + 1;
    
    return transactions.length / monthsDiff;
  }

  private calculateTrend(transactions: Transaction[]): number {
    if (transactions.length < 4) return 0;
    
    const sortedTransactions = transactions.sort((a, b) => a.date.getTime() - b.date.getTime());
    const midPoint = Math.floor(sortedTransactions.length / 2);
    
    const firstHalf = sortedTransactions.slice(0, midPoint);
    const secondHalf = sortedTransactions.slice(midPoint);
    
    const firstHalfAvg = firstHalf.reduce((sum, t) => sum + t.amount, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((sum, t) => sum + t.amount, 0) / secondHalf.length;
    
    return ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;
  }

  public suggestQueries(transactions: Transaction[], transactionTags: Map<string, Tag[]>): string[] {
    const suggestions: string[] = [];
    
    // Basic suggestions
    suggestions.push("Show my spending this month");
    suggestions.push("How much did I spend on food last month?");
    suggestions.push("What are my largest expenses?");
    
    // Category-based suggestions
    const categories = new Set<string>();
    transactions.forEach(t => {
      const tags = transactionTags.get(t.chqRefNumber) || [];
      tags.forEach(tag => categories.add(tag.name));
    });
    
    Array.from(categories).slice(0, 3).forEach(category => {
      suggestions.push(`Show my ${category} expenses`);
    });

    // Merchant-based suggestions
    const merchants = new Map<string, number>();
    transactions.forEach(t => {
      if (t.merchant) {
        merchants.set(t.merchant, (merchants.get(t.merchant) || 0) + 1);
      }
    });
    
    const topMerchants = Array.from(merchants.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2);
    
    topMerchants.forEach(([merchant]) => {
      suggestions.push(`How much did I spend at ${merchant}?`);
    });

    // Time-based suggestions
    suggestions.push("Compare my spending this month vs last month");
    suggestions.push("Show transactions above ₹1000");
    suggestions.push("What unusual transactions do I have?");

    return suggestions.slice(0, 8);
  }
}