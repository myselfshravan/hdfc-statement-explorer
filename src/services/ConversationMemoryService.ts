import { Transaction } from "@/types/transaction";
import { Tag } from "@/types/tags";

export interface ConversationContext {
  userId: string;
  sessionId: string;
  userPreferences: UserPreferences;
  conversationHistory: ConversationEntry[];
  financialFocus: FinancialFocus;
  lastUpdated: Date;
}

export interface UserPreferences {
  preferredCategories: string[];
  frequentQueries: string[];
  budgetConcerns: string[];
  financialGoals: string[];
  communicationStyle: 'detailed' | 'concise' | 'conversational';
  notificationPreferences: {
    spendingAlerts: boolean;
    budgetReminders: boolean;
    savingsOpportunities: boolean;
  };
}

export interface ConversationEntry {
  id: string;
  timestamp: Date;
  userQuery: string;
  response: string;
  queryType: 'spending' | 'budget' | 'savings' | 'analysis' | 'general';
  relevantTransactions?: string[]; // Transaction IDs
  insights: string[];
  userFeedback?: 'helpful' | 'not_helpful';
}

export interface FinancialFocus {
  primaryConcerns: string[];
  recentTopics: string[];
  spendingCategoriesOfInterest: string[];
  budgetingNeeds: string[];
  investmentInterest: boolean;
}

export class ConversationMemoryService {
  private static readonly STORAGE_KEY = 'conversation-memory';
  private static readonly SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

  public getOrCreateConversationContext(userId: string): ConversationContext {
    const stored = localStorage.getItem(ConversationMemoryService.STORAGE_KEY);
    
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.userId === userId && this.isSessionValid(parsed.lastUpdated)) {
          return {
            ...parsed,
            lastUpdated: new Date(parsed.lastUpdated),
            conversationHistory: parsed.conversationHistory.map((entry: any) => ({
              ...entry,
              timestamp: new Date(entry.timestamp),
            })),
          };
        }
      } catch (error) {
        console.warn('Failed to parse conversation memory:', error);
      }
    }

    // Create new context
    return {
      userId,
      sessionId: this.generateSessionId(),
      userPreferences: this.getDefaultPreferences(),
      conversationHistory: [],
      financialFocus: {
        primaryConcerns: [],
        recentTopics: [],
        spendingCategoriesOfInterest: [],
        budgetingNeeds: [],
        investmentInterest: false,
      },
      lastUpdated: new Date(),
    };
  }

  public addConversationEntry(
    context: ConversationContext,
    userQuery: string,
    response: string,
    queryType: ConversationEntry['queryType'],
    insights: string[] = [],
    relevantTransactions?: string[]
  ): ConversationContext {
    const entry: ConversationEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      userQuery,
      response,
      queryType,
      insights,
      relevantTransactions,
    };

    const updatedContext = {
      ...context,
      conversationHistory: [...context.conversationHistory.slice(-20), entry], // Keep last 20 conversations
      lastUpdated: new Date(),
    };

    // Update user preferences based on the conversation
    this.updateUserPreferences(updatedContext, userQuery, queryType);
    this.updateFinancialFocus(updatedContext, userQuery, queryType, insights);

    this.saveConversationContext(updatedContext);
    return updatedContext;
  }

  public generateContextualPrompt(
    context: ConversationContext,
    currentQuery: string
  ): string {
    let contextualInfo = '';

    // Add user preferences context
    if (context.userPreferences.preferredCategories.length > 0) {
      contextualInfo += `User typically asks about: ${context.userPreferences.preferredCategories.join(', ')}\n`;
    }

    // Add recent conversation context
    const recentConversations = context.conversationHistory.slice(-3);
    if (recentConversations.length > 0) {
      contextualInfo += `Recent conversation topics:\n`;
      recentConversations.forEach((conv, index) => {
        contextualInfo += `${index + 1}. User asked: "${conv.userQuery}" (Type: ${conv.queryType})\n`;
      });
    }

    // Add financial focus
    if (context.financialFocus.primaryConcerns.length > 0) {
      contextualInfo += `User's main financial concerns: ${context.financialFocus.primaryConcerns.join(', ')}\n`;
    }

    // Add communication style preference
    contextualInfo += `Communication style: ${context.userPreferences.communicationStyle}\n`;

    // Add goals context
    if (context.userPreferences.financialGoals.length > 0) {
      contextualInfo += `Financial goals: ${context.userPreferences.financialGoals.join(', ')}\n`;
    }

    if (contextualInfo) {
      return `CONVERSATION CONTEXT:\n${contextualInfo}\n`;
    }

    return '';
  }

  public getFrequentlyAskedQuestions(context: ConversationContext): string[] {
    const queryFrequency = new Map<string, number>();
    
    context.conversationHistory.forEach(entry => {
      const normalizedQuery = this.normalizeQuery(entry.userQuery);
      queryFrequency.set(normalizedQuery, (queryFrequency.get(normalizedQuery) || 0) + 1);
    });

    return Array.from(queryFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([query]) => query);
  }

  public getSuggestedFollowUpQuestions(
    context: ConversationContext,
    lastResponse: string,
    lastQueryType: ConversationEntry['queryType']
  ): string[] {
    const suggestions: string[] = [];

    switch (lastQueryType) {
      case 'spending':
        suggestions.push(
          'How can I reduce my spending in this category?',
          'Show me my spending trends over time',
          'What are some alternatives to save money?'
        );
        break;
      case 'budget':
        suggestions.push(
          'What percentage of my income should I allocate to this?',
          'How does this compare to recommended budgets?',
          'Show me ways to optimize my budget'
        );
        break;
      case 'analysis':
        suggestions.push(
          'What actions should I take based on this analysis?',
          'How can I improve my financial health score?',
          'Show me my progress over time'
        );
        break;
      case 'savings':
        suggestions.push(
          'What are my biggest savings opportunities?',
          'How much should I be saving each month?',
          'Show me investment options for my savings'
        );
        break;
    }

    // Add personalized suggestions based on user's history
    const frequentTopics = context.financialFocus.recentTopics.slice(-3);
    frequentTopics.forEach(topic => {
      if (!suggestions.some(s => s.toLowerCase().includes(topic.toLowerCase()))) {
        suggestions.push(`Tell me more about my ${topic} patterns`);
      }
    });

    return suggestions.slice(0, 4);
  }

  public updateUserFeedback(
    context: ConversationContext,
    conversationId: string,
    feedback: 'helpful' | 'not_helpful'
  ): ConversationContext {
    const updatedHistory = context.conversationHistory.map(entry =>
      entry.id === conversationId ? { ...entry, userFeedback: feedback } : entry
    );

    const updatedContext = {
      ...context,
      conversationHistory: updatedHistory,
      lastUpdated: new Date(),
    };

    this.saveConversationContext(updatedContext);
    return updatedContext;
  }

  private updateUserPreferences(
    context: ConversationContext,
    userQuery: string,
    queryType: ConversationEntry['queryType']
  ): void {
    const query = userQuery.toLowerCase();

    // Update preferred categories
    const categories = ['food', 'transport', 'shopping', 'entertainment', 'utilities', 'healthcare'];
    categories.forEach(category => {
      if (query.includes(category) && !context.userPreferences.preferredCategories.includes(category)) {
        context.userPreferences.preferredCategories.push(category);
      }
    });

    // Update frequent queries
    const normalizedQuery = this.normalizeQuery(userQuery);
    if (!context.userPreferences.frequentQueries.includes(normalizedQuery)) {
      context.userPreferences.frequentQueries.push(normalizedQuery);
    }
    // Keep only recent queries
    context.userPreferences.frequentQueries = context.userPreferences.frequentQueries.slice(-10);

    // Detect financial goals
    if (query.includes('save') || query.includes('budget') || query.includes('goal')) {
      const goalKeywords = ['emergency fund', 'vacation', 'house', 'car', 'investment', 'retirement'];
      goalKeywords.forEach(goal => {
        if (query.includes(goal) && !context.userPreferences.financialGoals.includes(goal)) {
          context.userPreferences.financialGoals.push(goal);
        }
      });
    }

    // Detect communication style preference
    if (context.conversationHistory.length > 5) {
      const avgResponseLength = context.conversationHistory
        .slice(-5)
        .reduce((sum, entry) => sum + entry.response.length, 0) / 5;
      
      if (avgResponseLength > 1000) {
        context.userPreferences.communicationStyle = 'detailed';
      } else if (avgResponseLength < 300) {
        context.userPreferences.communicationStyle = 'concise';
      } else {
        context.userPreferences.communicationStyle = 'conversational';
      }
    }
  }

  private updateFinancialFocus(
    context: ConversationContext,
    userQuery: string,
    queryType: ConversationEntry['queryType'],
    insights: string[]
  ): void {
    const query = userQuery.toLowerCase();

    // Update recent topics
    if (!context.financialFocus.recentTopics.includes(queryType)) {
      context.financialFocus.recentTopics.push(queryType);
    }
    context.financialFocus.recentTopics = context.financialFocus.recentTopics.slice(-10);

    // Detect primary concerns
    const concerns = [
      'overspending', 'budgeting', 'saving', 'debt', 'investment',
      'emergency fund', 'retirement', 'cash flow'
    ];
    concerns.forEach(concern => {
      if ((query.includes(concern) || insights.some(insight => insight.toLowerCase().includes(concern))) &&
          !context.financialFocus.primaryConcerns.includes(concern)) {
        context.financialFocus.primaryConcerns.push(concern);
      }
    });

    // Detect investment interest
    if (query.includes('invest') || query.includes('mutual fund') || query.includes('stock')) {
      context.financialFocus.investmentInterest = true;
    }

    // Update spending categories of interest
    const spendingCategories = ['food', 'transport', 'shopping', 'entertainment'];
    spendingCategories.forEach(category => {
      if (query.includes(category) && 
          !context.financialFocus.spendingCategoriesOfInterest.includes(category)) {
        context.financialFocus.spendingCategoriesOfInterest.push(category);
      }
    });
  }

  private normalizeQuery(query: string): string {
    return query.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 100); // Limit length
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  private getDefaultPreferences(): UserPreferences {
    return {
      preferredCategories: [],
      frequentQueries: [],
      budgetConcerns: [],
      financialGoals: [],
      communicationStyle: 'conversational',
      notificationPreferences: {
        spendingAlerts: true,
        budgetReminders: true,
        savingsOpportunities: true,
      },
    };
  }

  private isSessionValid(lastUpdated: string | Date): boolean {
    const lastUpdateTime = typeof lastUpdated === 'string' ? new Date(lastUpdated) : lastUpdated;
    return Date.now() - lastUpdateTime.getTime() < ConversationMemoryService.SESSION_DURATION;
  }

  private saveConversationContext(context: ConversationContext): void {
    try {
      localStorage.setItem(ConversationMemoryService.STORAGE_KEY, JSON.stringify(context));
    } catch (error) {
      console.warn('Failed to save conversation context:', error);
    }
  }

  public clearConversationMemory(userId: string): void {
    localStorage.removeItem(ConversationMemoryService.STORAGE_KEY);
  }
}