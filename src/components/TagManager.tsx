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
  transactionTags: Tag[]; // Accept current tags as prop
  onTagsChange?: () => void;
}

export function TagManager({ transactionId, transactionTags: initialTransactionTags, onTagsChange }: TagManagerProps) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [allUserTags, setAllUserTags] = useState<Tag[]>([]); // Renamed state for clarity
  const [currentTransactionTags, setCurrentTransactionTags] = useState<Tag[]>(initialTransactionTags); // Use prop for initial state
  const [newTagName, setNewTagName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingUserTags, setIsLoadingUserTags] = useState(false); // State for loading user tags

  // Update internal state if the prop changes (e.g., after parent refresh)
  useEffect(() => {
    setCurrentTransactionTags(initialTransactionTags);
  }, [initialTransactionTags]);

  // Load all user tags ONLY when the dialog opens
  useEffect(() => {
    const loadUserTags = async () => {
      if (isOpen && user && allUserTags.length === 0) { // Only load if open and not already loaded
        setIsLoadingUserTags(true);
        try {
          const userTags = await tagManager.getUserTags(user.id);
          setAllUserTags(userTags);
        } catch (error) {
          console.error('Error loading user tags:', error);
        } finally {
          setIsLoadingUserTags(false);
        }
      }
    };
    loadUserTags();
  }, [isOpen, user]); // Removed transactionId dependency

  const createNewTag = async () => {
    if (!user || !newTagName.trim()) return;

    setIsLoading(true);
    try {
      const newTag = await tagManager.createTag(user.id, newTagName.trim());
      setAllUserTags([...allUserTags, newTag]); // Update all user tags list
      setNewTagName('');
    } catch (error) {
      console.error('Error creating tag:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTag = async (tag: Tag) => {
    if (!user) return;

    // Use internal state for checking if tagged
    const isTagged = currentTransactionTags.some(t => t.id === tag.id);

    try {
      if (isTagged) {
        await tagManager.removeTagFromTransaction(transactionId, tag.id);
        // Update internal state immediately for responsiveness
        setCurrentTransactionTags(prev => prev.filter(t => t.id !== tag.id));
      } else {
        await tagManager.addTagToTransaction(user.id, transactionId, tag.id);
        // Update internal state immediately
        setCurrentTransactionTags(prev => [...prev, tag]);
      }
      // Notify parent component AFTER successful DB operation
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
            {currentTransactionTags.map(tag => ( // Use internal state
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
            {isLoadingUserTags ? (
              <div>Loading available tags...</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {allUserTags.map(tag => ( // Use allUserTags state
                  <TooltipProvider key={tag.id}>
                    <Tooltip>
                      <TooltipTrigger>
                        <Badge
                          // Use internal state for styling
                          variant={currentTransactionTags.some(t => t.id === tag.id) ? 'default' : 'outline'}
                          style={{
                            backgroundColor: currentTransactionTags.some(t => t.id === tag.id) ? tag.color : 'transparent',
                            borderColor: tag.color,
                            color: currentTransactionTags.some(t => t.id === tag.id) ? 'white' : tag.color
                          }}
                          className="cursor-pointer"
                          onClick={() => toggleTag(tag)}
                        >
                          {tag.name}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        {/* Use internal state for tooltip text */}
                        Click to {currentTransactionTags.some(t => t.id === tag.id) ? 'remove' : 'add'} tag
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
            </div>
          )} {/* <-- Added missing closing parenthesis */}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
