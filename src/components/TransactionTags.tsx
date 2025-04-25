import React from 'react'; // Removed useEffect, useState
import { Tag } from '@/types/tags';
import { Badge } from "@/components/ui/badge";
import { TagManager } from './TagManager';
import { tagManager } from '@/utils/tagManager'; // Keep for refresh logic

interface TransactionTagsProps {
  transactionId: string;
  tags: Tag[]; // Expect tags as a prop
  onTagsChange: () => void; // Expect a refresh handler
}

export function TransactionTags({ transactionId, tags, onTagsChange }: TransactionTagsProps) {
  // Removed internal state and useEffect

  return (
    <div className="flex items-center gap-2">
      {/* Tags display */}
      <div className="flex flex-wrap gap-1">
        {tags.map(tag => (
          <Badge
            key={tag.id}
            style={{ backgroundColor: tag.color }}
            variant="secondary"
            className="text-white text-xs"
          >
            {tag.name}
          </Badge>
        ))}
      </div>
      
      {/* Show edit icon if tags exist, else show "Add Tags" */}
      <TagManager
        transactionId={transactionId}
        transactionTags={tags}
        onTagsChange={onTagsChange}
        showEditMode={tags.length > 0}
      />
    </div>
  );
}
