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
  transactionTags: Tag[];
  onTagsChange?: () => void;
  showEditMode?: boolean;
}

export function TagManager({ transactionId, transactionTags: initialTransactionTags, onTagsChange, showEditMode = false }: TagManagerProps) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [allUserTags, setAllUserTags] = useState<Tag[]>([]); // Renamed state for clarity
  const [currentTransactionTags, setCurrentTransactionTags] = useState<Tag[]>(initialTransactionTags); // Use prop for initial state
  // Removed state related to new tag creation: newTagName, selectedColor, isLoading, createError
  const [isLoadingUserTags, setIsLoadingUserTags] = useState(false); // State for loading user tags
  const [toggleStates, setToggleStates] = useState<Record<string, { isLoading: boolean; error: string | null }>>({}); // State for toggling individual tags

  // Helper to update toggle state for a specific tag
  const setTagToggleState = (tagId: string, state: { isLoading: boolean; error: string | null }) => {
    setToggleStates(prev => ({ ...prev, [tagId]: state }));
  };

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

  // Removed createNewTag function

  const toggleTag = async (tag: Tag) => {
    if (!user) return;

    // Use internal state for checking if tagged
    const isTagged = currentTransactionTags.some(t => t.id === tag.id);

    setTagToggleState(tag.id, { isLoading: true, error: null }); // Set loading state

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
      setTagToggleState(tag.id, { isLoading: false, error: null }); // Clear loading state on success
    } catch (error: any) {
      console.error('Error toggling tag:', error);
      setTagToggleState(tag.id, { isLoading: false, error: error.message || 'Failed to update tag' }); // Set error state
      // Optional: Revert optimistic UI update if needed
      // setCurrentTransactionTags(initialTransactionTags); // Or revert based on previous state
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-1 hover:bg-accent hover:text-accent-foreground flex items-center gap-1"
        >
          {!showEditMode && <span className="text-[11px] text-muted-foreground">Add tags</span>}
          {showEditMode ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3 text-muted-foreground">
              <path d="M12 20h9"></path>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3 text-muted-foreground">
              <path d="M12 5v14M5 12h14"></path>
            </svg>
          )}
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
                className="cursor-pointer text-[11px] leading-none whitespace-nowrap px-2 py-[3px]"
                onClick={() => toggleTag(tag)}
              >
                {tag.name}
              </Badge>
            ))}
          </div>

          {/* Removed Create new tag section (Input, Button, Error, Color Picker) */}

          {/* Available tags */}
          <div className="border rounded-md p-4 mt-4"> {/* Added margin-top for spacing */}
            <h3 className="text-sm font-medium mb-2">Available Tags</h3>
            {isLoadingUserTags ? (
              <div>Loading available tags...</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {allUserTags.map(tag => { // Use allUserTags state
                  const tagToggleState = toggleStates[tag.id] || { isLoading: false, error: null };
                  const isCurrentlyTagged = currentTransactionTags.some(t => t.id === tag.id);
                  return (
                  <TooltipProvider key={tag.id}>
                    <Tooltip>
                      <TooltipTrigger disabled={tagToggleState.isLoading}>
                        <Badge
                          // Use internal state for styling
                          variant={isCurrentlyTagged ? 'default' : 'outline'}
                          style={{
                            backgroundColor: isCurrentlyTagged ? tag.color : 'transparent',
                            borderColor: tag.color,
                            color: isCurrentlyTagged ? 'white' : tag.color,
                            opacity: tagToggleState.isLoading ? 0.5 : 1, // Dim if loading
                            cursor: tagToggleState.isLoading ? 'wait' : 'pointer',
                          }}
                          className={`transition-opacity text-[11px] leading-none whitespace-nowrap px-2 py-[3px] ${tagToggleState.isLoading ? '' : 'cursor-pointer'}`}
                          onClick={() => !tagToggleState.isLoading && toggleTag(tag)} // Prevent click while loading
                        >
                          {tagToggleState.isLoading ? '...' : tag.name} {/* Show loading indicator */}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        {tagToggleState.error ? (
                           <span className="text-red-600">{tagToggleState.error}</span>
                        ) : tagToggleState.isLoading ? (
                           'Updating...'
                        ) : (
                           `Click to ${isCurrentlyTagged ? 'remove' : 'add'} tag`
                        )}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                );
              })}
            </div>
          )} {/* <-- Corrected closing structure */}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
