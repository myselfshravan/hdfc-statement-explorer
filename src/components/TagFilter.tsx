import React, { useEffect, useState } from 'react';
import { Tag } from '@/types/tags';
import { tagManager } from '@/utils/tagManager';
import { useAuth } from '@/context/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

import { TagFilterProps } from "@/types/filter";

export function TagFilter({ onTagSelect, selectedTagIds }: TagFilterProps) {
  const { user } = useAuth();
  const [tags, setTags] = useState<Tag[]>([]);

  useEffect(() => {
    if (!user) return;

    tagManager.getUserTags(user.id)
      .then(setTags)
      .catch(error => console.error('Error loading tags:', error));
  }, [user]);

  const toggleTag = (tagId: string) => {
    const newSelection = selectedTagIds.includes(tagId)
      ? selectedTagIds.filter(id => id !== tagId)
      : [...selectedTagIds, tagId];
    onTagSelect(newSelection);
  };

  if (tags.length === 0) return null;

  return (
    <Card className="p-4">
      <h2 className="text-lg font-semibold mb-4">Filter by Tags</h2>
      <ScrollArea className="h-full">
        <div className="flex flex-wrap gap-2">
          {tags.map(tag => (
            <Badge
              key={tag.id}
              variant={selectedTagIds.includes(tag.id) ? 'default' : 'outline'}
              style={{
                backgroundColor: selectedTagIds.includes(tag.id) ? tag.color : 'transparent',
                borderColor: tag.color,
                color: selectedTagIds.includes(tag.id) ? 'white' : tag.color
              }}
              className="cursor-pointer"
              onClick={() => toggleTag(tag.id)}
            >
              {tag.name}
              {selectedTagIds.includes(tag.id) && (
                <span className="ml-1 text-xs">×</span>
              )}
            </Badge>
          ))}
        </div>
      </ScrollArea>
    </Card>
  );
}
