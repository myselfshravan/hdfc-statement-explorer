import { Transaction } from "@/types/transaction";
import { Tag } from "@/types/tags";

export interface TagSuggestion {
  tag: Tag;
  confidence: number; // 0-1 score indicating confidence of suggestion
  reason: string; // Human-readable reason for the suggestion
  matchedKeywords: string[]; // Keywords that triggered this suggestion
}

export interface AutoTagResult {
  transaction: Transaction;
  suggestions: TagSuggestion[];
  autoApplied: boolean; // Whether suggestions were automatically applied
}

interface TaggingRule {
  id: string;
  pattern: string | RegExp;
  tagNames: string[];
  priority: number;
  matchType: 'keyword' | 'regex' | 'merchant' | 'upi' | 'category';
  confidence: number;
  description: string;
}

export class AutoTaggingService {
  private taggingRules: TaggingRule[] = [];
  private availableTags: Tag[] = [];
  private userTaggingHistory: Map<string, string[]> = new Map(); // Pattern -> Tag names

  constructor() {
    this.initializeDefaultRules();
  }

  /**
   * Initialize with available tags and user tagging history for personalization
   */
  public initialize(tags: Tag[], transactionTagsMap: Map<string, Tag[]>, transactions: Transaction[]) {
    this.availableTags = tags;
    this.buildUserTaggingHistory(transactionTagsMap, transactions);
  }

  /**
   * Generate tag suggestions for a single transaction
   */
  public generateSuggestions(transaction: Transaction): TagSuggestion[] {
    const suggestions: TagSuggestion[] = [];
    const narrationLower = transaction.narration.toLowerCase();

    // Apply each tagging rule
    for (const rule of this.taggingRules) {
      const matchResult = this.applyRule(rule, transaction);
      if (matchResult.matches) {
        for (const tagName of rule.tagNames) {
          const tag = this.availableTags.find(t => 
            t.name.toLowerCase() === tagName.toLowerCase()
          );
          if (tag) {
            // Check for existing suggestion to avoid duplicates
            const existingSuggestion = suggestions.find(s => s.tag.id === tag.id);
            if (!existingSuggestion) {
              suggestions.push({
                tag,
                confidence: this.calculateConfidence(rule, matchResult, transaction),
                reason: this.generateReason(rule, matchResult),
                matchedKeywords: matchResult.keywords
              });
            }
          }
        }
      }
    }

    // Add suggestions from user history patterns
    const historyBasedSuggestions = this.getSuggestionsFromHistory(transaction);
    suggestions.push(...historyBasedSuggestions);

    // Sort by confidence and remove duplicates
    return suggestions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5) // Limit to top 5 suggestions
      .filter((suggestion, index, array) => 
        array.findIndex(s => s.tag.id === suggestion.tag.id) === index
      );
  }

  /**
   * Generate suggestions for multiple transactions
   */
  public generateBulkSuggestions(transactions: Transaction[]): AutoTagResult[] {
    return transactions.map(transaction => ({
      transaction,
      suggestions: this.generateSuggestions(transaction),
      autoApplied: false
    }));
  }

  /**
   * Get transactions that have high-confidence suggestions for bulk tagging
   */
  public getHighConfidenceSuggestions(
    transactions: Transaction[], 
    minimumConfidence: number = 0.8
  ): AutoTagResult[] {
    return this.generateBulkSuggestions(transactions)
      .filter(result => 
        result.suggestions.length > 0 && 
        result.suggestions[0].confidence >= minimumConfidence
      );
  }

  /**
   * Learn from user tagging decisions to improve future suggestions
   */
  public learnFromUserAction(
    transaction: Transaction, 
    appliedTags: Tag[], 
    rejectedSuggestions: TagSuggestion[] = []
  ) {
    const patterns = this.extractPatternsFromTransaction(transaction);
    const tagNames = appliedTags.map(tag => tag.name);

    // Store positive patterns
    patterns.forEach(pattern => {
      const existingTags = this.userTaggingHistory.get(pattern) || [];
      const updatedTags = [...new Set([...existingTags, ...tagNames])];
      this.userTaggingHistory.set(pattern, updatedTags);
    });

    // TODO: Implement negative learning from rejected suggestions
    // This would help reduce false positives over time
  }

  private initializeDefaultRules() {
    this.taggingRules = [
      // Food & Dining
      {
        id: 'food_delivery',
        pattern: /zomato|swiggy|foodpanda|uber eats|dominos|pizza|mcdonald|kfc|subway/i,
        tagNames: ['Food', 'Dining', 'Food Delivery'],
        priority: 10,
        matchType: 'keyword',
        confidence: 0.9,
        description: 'Food delivery and restaurant transactions'
      },
      {
        id: 'grocery',
        pattern: /bigbasket|grofers|blinkit|instamart|fresh|grocery|supermarket|dmart|reliance|more/i,
        tagNames: ['Grocery', 'Food', 'Shopping'],
        priority: 9,
        matchType: 'keyword',
        confidence: 0.85,
        description: 'Grocery and food shopping'
      },

      // Transportation
      {
        id: 'ride_sharing',
        pattern: /uber|ola|rapido|namma yatri|taxi|cab/i,
        tagNames: ['Transportation', 'Travel', 'Ride Sharing'],
        priority: 10,
        matchType: 'keyword',
        confidence: 0.9,
        description: 'Ride sharing and taxi services'
      },
      {
        id: 'fuel',
        pattern: /petrol|diesel|fuel|hp|ioc|bpcl|shell|essar/i,
        tagNames: ['Transportation', 'Fuel', 'Vehicle'],
        priority: 8,
        matchType: 'keyword',
        confidence: 0.85,
        description: 'Fuel and petrol expenses'
      },
      {
        id: 'public_transport',
        pattern: /metro|bus|train|irctc|railway|bmtc|dmrc/i,
        tagNames: ['Transportation', 'Travel', 'Public Transport'],
        priority: 7,
        matchType: 'keyword',
        confidence: 0.8,
        description: 'Public transportation'
      },

      // Shopping
      {
        id: 'ecommerce',
        pattern: /amazon|flipkart|myntra|ajio|nykaa|meesho|snapdeal|paytm mall/i,
        tagNames: ['Shopping', 'Online Shopping', 'E-commerce'],
        priority: 9,
        matchType: 'keyword',
        confidence: 0.9,
        description: 'E-commerce and online shopping'
      },

      // Entertainment
      {
        id: 'streaming',
        pattern: /netflix|prime|hotstar|zee5|sony liv|voot|youtube|spotify|gaana/i,
        tagNames: ['Entertainment', 'Streaming', 'Subscription'],
        priority: 8,
        matchType: 'keyword',
        confidence: 0.9,
        description: 'Streaming and entertainment subscriptions'
      },
      {
        id: 'movies_events',
        pattern: /pvr|inox|cinepolis|bookmyshow|movie|cinema|concert|event/i,
        tagNames: ['Entertainment', 'Movies', 'Events'],
        priority: 7,
        matchType: 'keyword',
        confidence: 0.8,
        description: 'Movies and entertainment events'
      },

      // Utilities
      {
        id: 'electricity',
        pattern: /bescom|mseb|kseb|electricity|power|current|bill/i,
        tagNames: ['Utilities', 'Electricity', 'Bills'],
        priority: 8,
        matchType: 'keyword',
        confidence: 0.85,
        description: 'Electricity and power bills'
      },
      {
        id: 'telecom',
        pattern: /airtel|jio|vodafone|bsnl|mobile|recharge|broadband|internet|wifi/i,
        tagNames: ['Utilities', 'Telecom', 'Internet', 'Bills'],
        priority: 8,
        matchType: 'keyword',
        confidence: 0.85,
        description: 'Telecom and internet services'
      },

      // Healthcare
      {
        id: 'healthcare',
        pattern: /hospital|clinic|doctor|pharmacy|medicine|medical|health|apollo|fortis/i,
        tagNames: ['Healthcare', 'Medical', 'Medicine'],
        priority: 7,
        matchType: 'keyword',
        confidence: 0.8,
        description: 'Healthcare and medical expenses'
      },

      // Financial Services
      {
        id: 'investments',
        pattern: /sip|mutual fund|zerodha|upstox|groww|paytm money|edelweiss|icici direct/i,
        tagNames: ['Investment', 'SIP', 'Mutual Fund'],
        priority: 9,
        matchType: 'keyword',
        confidence: 0.9,
        description: 'Investment and mutual fund transactions'
      },
      {
        id: 'insurance',
        pattern: /insurance|premium|lic|hdfc life|icici prudential|bajaj allianz/i,
        tagNames: ['Insurance', 'Premium', 'Investment'],
        priority: 8,
        matchType: 'keyword',
        confidence: 0.85,
        description: 'Insurance premiums and policies'
      },

      // UPI-based patterns
      {
        id: 'upi_transfer',
        pattern: /UPI-.*-\w+@\w+/i,
        tagNames: ['UPI Transfer', 'Digital Payment'],
        priority: 5,
        matchType: 'upi',
        confidence: 0.7,
        description: 'UPI-based transactions'
      },

      // Credit/Income patterns
      {
        id: 'salary',
        pattern: /salary|sal cr|income|wages|pay|payroll/i,
        tagNames: ['Salary', 'Income', 'Credit'],
        priority: 9,
        matchType: 'keyword',
        confidence: 0.9,
        description: 'Salary and income transactions'
      },
      {
        id: 'interest',
        pattern: /int cr|interest credit|fd interest|saving interest/i,
        tagNames: ['Interest', 'Investment Income', 'Credit'],
        priority: 8,
        matchType: 'keyword',
        confidence: 0.85,
        description: 'Interest earnings'
      }
    ];

    // Sort rules by priority
    this.taggingRules.sort((a, b) => b.priority - a.priority);
  }

  private applyRule(rule: TaggingRule, transaction: Transaction): {
    matches: boolean;
    keywords: string[];
    confidence: number;
  } {
    const narration = transaction.narration.toLowerCase();
    const keywords: string[] = [];
    let matches = false;

    switch (rule.matchType) {
      case 'keyword':
      case 'regex':
        if (rule.pattern instanceof RegExp) {
          const match = narration.match(rule.pattern);
          if (match) {
            matches = true;
            keywords.push(match[0]);
          }
        }
        break;

      case 'merchant':
        if (transaction.merchant) {
          const merchantLower = transaction.merchant.toLowerCase();
          if (typeof rule.pattern === 'string' && merchantLower.includes(rule.pattern.toLowerCase())) {
            matches = true;
            keywords.push(transaction.merchant);
          } else if (rule.pattern instanceof RegExp && rule.pattern.test(merchantLower)) {
            matches = true;
            keywords.push(transaction.merchant);
          }
        }
        break;

      case 'upi':
        if (transaction.upiId && rule.pattern instanceof RegExp) {
          if (rule.pattern.test(narration)) {
            matches = true;
            keywords.push(transaction.upiId);
          }
        }
        break;

      case 'category':
        if (transaction.category) {
          const categoryLower = transaction.category.toLowerCase();
          if (typeof rule.pattern === 'string' && categoryLower.includes(rule.pattern.toLowerCase())) {
            matches = true;
            keywords.push(transaction.category);
          }
        }
        break;
    }

    return {
      matches,
      keywords,
      confidence: rule.confidence
    };
  }

  private calculateConfidence(
    rule: TaggingRule, 
    matchResult: { matches: boolean; keywords: string[]; confidence: number }, 
    transaction: Transaction
  ): number {
    let confidence = rule.confidence;

    // Boost confidence for exact merchant matches
    if (rule.matchType === 'merchant' && matchResult.keywords.length > 0) {
      confidence = Math.min(confidence + 0.1, 1.0);
    }

    // Boost confidence for UPI transactions with clear merchant info
    if (transaction.upiId && transaction.merchant) {
      confidence = Math.min(confidence + 0.05, 1.0);
    }

    // Reduce confidence for very generic narrations
    if (transaction.narration.length < 10) {
      confidence = Math.max(confidence - 0.1, 0.1);
    }

    return Number(confidence.toFixed(2));
  }

  private generateReason(rule: TaggingRule, matchResult: { keywords: string[] }): string {
    const keywords = matchResult.keywords.join(', ');
    return `${rule.description}. Matched: ${keywords}`;
  }

  private getSuggestionsFromHistory(transaction: Transaction): TagSuggestion[] {
    const suggestions: TagSuggestion[] = [];
    const patterns = this.extractPatternsFromTransaction(transaction);

    patterns.forEach(pattern => {
      const historicalTags = this.userTaggingHistory.get(pattern);
      if (historicalTags) {
        historicalTags.forEach(tagName => {
          const tag = this.availableTags.find(t => t.name.toLowerCase() === tagName.toLowerCase());
          if (tag && !suggestions.find(s => s.tag.id === tag.id)) {
            suggestions.push({
              tag,
              confidence: 0.75, // History-based suggestions get moderate confidence
              reason: `Based on your previous tagging pattern: "${pattern}"`,
              matchedKeywords: [pattern]
            });
          }
        });
      }
    });

    return suggestions;
  }

  private extractPatternsFromTransaction(transaction: Transaction): string[] {
    const patterns: string[] = [];
    const narration = transaction.narration.toLowerCase();

    // Extract merchant patterns
    if (transaction.merchant) {
      patterns.push(transaction.merchant.toLowerCase());
    }

    // Extract UPI ID domain patterns
    if (transaction.upiId) {
      const domain = transaction.upiId.split('@')[1];
      if (domain) {
        patterns.push(`@${domain}`);
      }
    }

    // Extract common word patterns (2-3 word combinations)
    const words = narration.split(/\s+/).filter(word => word.length > 3);
    for (let i = 0; i < words.length - 1; i++) {
      patterns.push(`${words[i]} ${words[i + 1]}`);
      if (i < words.length - 2) {
        patterns.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
      }
    }

    return patterns;
  }

  private buildUserTaggingHistory(
    transactionTagsMap: Map<string, Tag[]>, 
    transactions: Transaction[]
  ) {
    transactions.forEach(transaction => {
      const tags = transactionTagsMap.get(transaction.chqRefNumber);
      if (tags && tags.length > 0) {
        const patterns = this.extractPatternsFromTransaction(transaction);
        const tagNames = tags.map(tag => tag.name);

        patterns.forEach(pattern => {
          const existingTags = this.userTaggingHistory.get(pattern) || [];
          const updatedTags = [...new Set([...existingTags, ...tagNames])];
          this.userTaggingHistory.set(pattern, updatedTags);
        });
      }
    });
  }
}

// Export singleton instance
export const autoTaggingService = new AutoTaggingService();