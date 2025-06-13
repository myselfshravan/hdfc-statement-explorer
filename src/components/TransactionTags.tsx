import React from 'react'; // Removed useEffect, useState
import { Tag } from '@/types/tags';
import { Badge } from "@/components/ui/badge";
import { TagManager } from './TagManager';
import { tagManager } from '@/utils/tagManager'; // Keep for refresh logic

interface TransactionTagsProps {
  chqRefNumber: string;
  tags: Tag[]; // Expect tags as a prop
  onTagsChange: () => void; // Expect a refresh handler
}

export function TransactionTags({ chqRefNumber, tags, onTagsChange }: TransactionTagsProps) {
  // Removed internal state and useEffect

  return (
    <div className="inline-flex items-center space-x-1.5 justify-center">
      <div className="flex items-center min-w-0 space-x-1 justify-center">
        {tags.slice(0, 2).map(tag => (
          <Badge
            key={tag.id}
            style={{ backgroundColor: tag.color }}
            variant="secondary"
            className="text-white text-[11px] leading-tight whitespace-nowrap max-w-[100px] font-normal"
          >
            {tag.name}
          </Badge>
        ))}
        {tags.length > 2 && (
          <span className="text-[11px] text-muted-foreground">
            +{tags.length - 2}
          </span>
        )}
      </div>
      <TagManager
        chqRefNumber={chqRefNumber}
        transactionTags={tags}
        onTagsChange={onTagsChange}
        showEditMode={tags.length > 0}
      />
    </div>
  );
}
