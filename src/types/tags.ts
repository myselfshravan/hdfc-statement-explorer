export interface Tag {
  id: string;
  user_id: string;
  name: string;
  color?: string;
  created_at: string;
  updated_at: string;
}

export interface TransactionTag {
  transaction_id: string;
  tag_id: string;
  user_id: string;
  created_at: string;
}

export interface TagWithTransactions extends Tag {
  transaction_count: number;
}

export interface TransactionWithTags {
  transaction_id: string;
  tags: Tag[];
}

// List of predefined colors for tags
export const TAG_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#f59e0b", // amber
  "#84cc16", // lime
  "#22c55e", // green
  "#14b8a6", // teal
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#d946ef", // fuchsia
  "#ec4899", // pink
];
