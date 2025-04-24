import React, { useState, useEffect } from 'react';
import { Tag, TAG_COLORS } from '@/types/tags';
import { tagManager } from '@/utils/tagManager';
import { useAuth } from '@/context/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface TagManagerProps {
  transactionId: string;
  onTagsChange?: () => void;
}

export function TagManager({ transactionId, onTagsChange }: TagManagerProps) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [tags, setTags] = useState<Tag[]>([]);
  const [transactionTags, setTransactionTags] = useState<Tag[]>([]);
  const [newTagName, setNewTagName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Load all user tags and transaction tags
  useEffect(() => {
    const loadTags = async () => {
      if (!user) return;
      
      try {
        const [userTags, txTags] = await Promise.all([
          tagManager.getUserTags(user.id),
          tagManager.getTransactionTags(transactionId)
        ]);
        setTags(userTags);
        setTransactionTags(txTags);
      } catch (error) {
        console.error('Error loading tags:', error);
      }
    };

    loadTags();
  }, [user, transactionId]);

  const createNewTag = async () => {
    if (!user || !newTagName.trim()) return;

    setIsLoading(true);
    try {
      const newTag = await tagManager.createTag(user.id, newTagName.trim());
      setTags([...tags, newTag]);
      setNewTagName('');
    } catch (error) {
      console.error('Error creating tag:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTag = async (tag: Tag) => {
    if (!user) return;

    const isTagged = transactionTags.some(t => t.id === tag.id);
    
    try {
      if (isTagged) {
        await tagManager.removeTagFromTransaction(transactionId, tag.id);
        setTransactionTags(prev => prev.filter(t => t.id !== tag.id));
      } else {
        await tagManager.addTagToTransaction(user.id, transactionId, tag.id);
        setTransactionTags(prev => [...prev, tag]);
      }
      onTagsChange?.();
    } catch (error) {
      console.error('Error toggling tag:', error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 border-dashed"
        >
          Manage Tags
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage Tags</DialogTitle>
        </DialogHeader>

        {/* Current tags */}
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {transactionTags.map(tag => (
              <Badge
                key={tag.id}
                style={{ backgroundColor: tag.color }}
                className="cursor-pointer"
                onClick={() => toggleTag(tag)}
              >
                {tag.name}
              </Badge>
            ))}
          </div>

          {/* Create new tag */}
          <div className="flex gap-2">
            <Input
              placeholder="New tag name"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && createNewTag()}
            />
            <Button
              onClick={createNewTag}
              disabled={isLoading || !newTagName.trim()}
            >
              Add
            </Button>
          </div>

          {/* Available tags */}
          <div className="border rounded-md p-4">
            <h3 className="text-sm font-medium mb-2">Available Tags</h3>
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => (
                <TooltipProvider key={tag.id}>
                  <Tooltip>
                    <TooltipTrigger>
                      <Badge
                        variant={transactionTags.some(t => t.id === tag.id) ? 'default' : 'outline'}
                        style={{
                          backgroundColor: transactionTags.some(t => t.id === tag.id) ? tag.color : 'transparent',
                          borderColor: tag.color,
                          color: transactionTags.some(t => t.id === tag.id) ? 'white' : tag.color
                        }}
                        className="cursor-pointer"
                        onClick={() => toggleTag(tag)}
                      >
                        {tag.name}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      Click to {transactionTags.some(t => t.id === tag.id) ? 'remove' : 'add'} tag
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
