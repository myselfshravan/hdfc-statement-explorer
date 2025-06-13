# HDFC Statement Analyser - Technical Documentation

## Database Structure

### 1. Statements Table

- Stores individual bank statements uploaded by users
- Each statement contains:
  - `id`: UUID primary key
  - `user_id`: References auth.users
  - `name`: Statement name
  - `summary`: Statement summary (jsonb)
  - `transactions`: Array of parsed transactions
  - `created_at`: Timestamp
  - Protected by RLS policies for user-specific access

### 2. Super Statement Table

- Consolidated view of all statements for a user
- Structure:
  - `id`: UUID primary key
  - `user_id`: References auth.users
  - `transactions`: Array of all unique transactions
  - `first_date`: Earliest transaction date
  - `last_date`: Latest transaction date
  - `summary`: Consolidated summary stats
- Maintains unique transactions using Chq./Ref.No. as identifier
- Protected by RLS policies for secure access

## Transaction Handling

### Statement Upload Process

1. Parse HDFC Excel statement
2. Extract transactions and calculate summary
3. Save to statements table
4. Merge into super_statement:
   - Filter duplicates using Chq./Ref.No.
   - Maintain chronological order
   - Recalculate running balances
   - Update consolidated summary

### Statement Deletion Process

1. Delete from statements table
2. Update super_statement:
   - Remove transactions by Chq./Ref.No.
   - Recalculate summary
   - If no transactions remain, delete super_statement

## Key Design Decisions

### 1. Transaction Identification

- Use bank-provided Chq./Ref.No. as natural identifier
- Ensures accurate deduplication across statements
- Maintains data integrity when merging statements

### 2. Data Consistency

- Validate running balances during merge
- Auto-correct minor balance discrepancies
- Maintain transaction order by date

### 3. Security

- Row Level Security (RLS) policies on all tables
- User-specific access control
- Secure deletion with user verification

## Database Migrations

### Initial Setup

1. Create statements table with basic structure
2. Add statement_groups for potential future grouping
3. Establish super_statement for consolidated view

### Key Updates

1. Added unique constraint on Chq./Ref.No.
2. Added delete policies for both tables
3. Modified super_statement structure for better performance
