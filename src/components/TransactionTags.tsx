import React, { useEffect, useState } from 'react';
import { Tag } from '@/types/tags';
import { Badge } from "@/components/ui/badge";
import { TagManager } from './TagManager';
import { tagManager } from '@/utils/tagManager';

interface TransactionTagsProps {
  transactionId: string;
}

export function TransactionTags({ transactionId }: TransactionTagsProps) {
  const [tags, setTags] = useState<Tag[]>([]);

  useEffect(() => {
    // Load initial tags
    tagManager.getTransactionTags(transactionId)
      .then(setTags)
      .catch(error => console.error('Error loading tags:', error));
  }, [transactionId]);

  return (
    <div className="flex items-center gap-2">
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
      <TagManager
        transactionId={transactionId}
        onTagsChange={() => {
          // Refresh tags when changes occur
          tagManager.getTransactionTags(transactionId)
            .then(setTags)
            .catch(error => console.error('Error refreshing tags:', error));
        }}
      />
    </div>
  );
}
