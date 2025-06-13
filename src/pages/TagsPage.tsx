import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { tagManager } from '@/utils/tagManager';
import { TagWithTransactions, TAG_COLORS, Tag } from '@/types/tags';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";

export function TagsPage() {
  const { user } = useAuth();
  const [tags, setTags] = useState<TagWithTransactions[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State for Add/Edit/Delete
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false); // Reinstate state
  const [newTagName, setNewTagName] = useState('');
  const [selectedColor, setSelectedColor] = useState<string>(TAG_COLORS[0]);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false); // Keep manual state for Edit
  const [editingTag, setEditingTag] = useState<TagWithTransactions | null>(null);
  const [editTagName, setEditTagName] = useState('');
  const [editTagColor, setEditTagColor] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const [deletingTag, setDeletingTag] = useState<TagWithTransactions | null>(null); // Still needed for context in delete dialog
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // --- Data Fetching ---
  const fetchTags = async () => {
    if (!user) {
      setIsLoading(false);
      setError("User not logged in.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const userTags = await tagManager.getUserTags();
      setTags(userTags);
    } catch (err) {
      console.error("Error fetching tags:", err);
      setError(err instanceof Error ? err.message : "Failed to load tags.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTags();
  }, [user]);

  // --- Handlers ---
  const handleCreateTag = async () => { // Removed closeDialog parameter
    if (!newTagName.trim()) return;
    setIsCreating(true);
    setCreateError(null);
    try {
      const newTagData = await tagManager.createTag(newTagName.trim(), selectedColor);
      setTags(prevTags => [...prevTags, { ...newTagData, transaction_count: 0 }]);
      setNewTagName(''); // Reset form
      setSelectedColor(TAG_COLORS[0]); // Reset form
      setIsAddDialogOpen(false); // Close the dialog on success using state
    } catch (err) {
      console.error("Error creating tag:", err);
      if (err instanceof Error) {
        setCreateError(err.message);
      } else {
        setCreateError("Failed to create tag.");
      }
      // Keep dialog open on error
    } finally {
      setIsCreating(false);
    }
  };

  const handleOpenEditDialog = (tag: TagWithTransactions) => {
    setEditingTag(tag);
    setEditTagName(tag.name);
    setEditTagColor(tag.color || TAG_COLORS[0]);
    setUpdateError(null);
    setIsEditDialogOpen(true);
  };

  const handleUpdateTag = async () => {
    if (!editingTag || !editTagName.trim()) return;
    setIsUpdating(true);
    setUpdateError(null);
    try {
      const updatedTagData = await tagManager.updateTag(editingTag.id, {
        name: editTagName.trim(),
        color: editTagColor,
      });
      setTags(prevTags =>
        prevTags.map(tag =>
          tag.id === editingTag.id ? { ...tag, ...updatedTagData } : tag
        )
      );
      setIsEditDialogOpen(false); // Close dialog on success
    } catch (err) {
      console.error("Error updating tag:", err);
      setUpdateError(err instanceof Error ? err.message : "Failed to update tag.");
      // Keep dialog open on error
    } finally {
      setIsUpdating(false);
    }
  };

  const prepareToDeleteTag = (tag: TagWithTransactions) => {
    setDeletingTag(tag);
    setDeleteError(null);
  };

  // Modified handleDeleteTag to accept an optional callback for closing,
  // but primarily relies on AlertDialogCancel/AlertDialogAction for closing.
  const handleDeleteTag = async (onSuccessClose?: () => void) => {
    if (!deletingTag) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await tagManager.deleteTag(deletingTag.id);
      setTags(prevTags => prevTags.filter(tag => tag.id !== deletingTag.id));
      if (onSuccessClose) onSuccessClose(); // Optionally close if callback provided
    } catch (err) {
      if (err instanceof Error) {
        console.error("Error deleting tag:", err);
        if ('code' in err && err.code === '23503') {
          setDeleteError("Cannot delete tag: It is assigned to transactions.");
        } else {
          setDeleteError(err.message || "Failed to delete tag.");
        }
      }
      // Keep dialog open on error by not calling onSuccessClose
      throw err; // Re-throw error to potentially prevent default close in AlertDialogAction
    } finally {
      setIsDeleting(false);
    }
  };

  // --- Render ---
  return (
    <div className="container mx-auto p-4">
      {/* Edit Tag Dialog (Uses manual state) */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Tag: {editingTag?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              placeholder="Tag name"
              value={editTagName}
              onChange={(e) => setEditTagName(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              {TAG_COLORS.map(color => (
                <div
                  key={color}
                  className={`w-6 h-6 rounded-full cursor-pointer border-2 ${editTagColor === color ? 'border-black' : 'border-transparent'}`}
                  style={{ backgroundColor: color }}
                  onClick={() => setEditTagColor(color)}
                />
              ))}
            </div>
            {updateError && <p className="text-sm text-red-600">{updateError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateTag} disabled={isUpdating || !editTagName.trim()}>
              {isUpdating ? 'Updating...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Main Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Manage Global Tags</CardTitle>
          {/* Add New Tag Dialog (Uses manual state) */}
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
               <Button onClick={() => { setCreateError(null); setNewTagName(''); setSelectedColor(TAG_COLORS[0]); setIsAddDialogOpen(true); }}>Add New Tag</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Create New Global Tag</DialogTitle>
                <p className="text-sm text-muted-foreground mt-2">
                  Tags are shared across all users. Please ensure the tag name is clear and meaningful for everyone.
                </p>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <Input
                  placeholder="Tag name"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  {TAG_COLORS.map(color => (
                    <div
                      key={color}
                      className={`w-6 h-6 rounded-full cursor-pointer border-2 ${selectedColor === color ? 'border-black' : 'border-transparent'}`}
                      style={{ backgroundColor: color }}
                      onClick={() => setSelectedColor(color)}
                    />
                  ))}
                </div>
                {createError && <p className="text-sm text-red-600">{createError}</p>}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleCreateTag} disabled={isCreating || !newTagName.trim()}>
                  {isCreating ? 'Creating...' : 'Create Tag'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {isLoading && <p>Loading tags...</p>}
          {error && <p className="text-red-600">Error: {error}</p>}
          {!isLoading && !error && (
            <div className="space-y-2">
              {tags.length === 0 ? (
                <p>No tags created yet.</p>
              ) : (
                tags.map(tag => (
                  <div key={tag.id} className="flex items-center justify-between p-2 border rounded">
                    <div className="flex items-center gap-2">
                       <Badge style={{ backgroundColor: tag.color }} className="text-white">
                         {tag.name}
                       </Badge>
                       <span className="text-sm text-muted-foreground">
                         ({tag.transaction_count} transactions)
                       </span>
                    </div>
                    <div className="flex gap-2">
                      {/* Edit Button */}
                      <Button variant="outline" size="sm" onClick={() => handleOpenEditDialog(tag)}>Edit</Button>

                      {/* Delete Confirmation Dialog Structure (inside map) */}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm" onClick={() => prepareToDeleteTag(tag)}>Delete</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This will permanently delete the tag
                              "<span className="font-semibold">{deletingTag?.id === tag.id ? tag.name : ''}</span>". {/* Show name only if it's the one being deleted */}
                              {deletingTag?.id === tag.id && deletingTag.transaction_count > 0 && (
                                <span className="block text-yellow-600 mt-2">
                                  This tag is assigned to {deletingTag.transaction_count} transaction(s).
                                </span>
                              )}
                               {deleteError && deletingTag?.id === tag.id && <p className="text-sm text-red-600 mt-2">{deleteError}</p>}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setDeleteError(null)}>Cancel</AlertDialogCancel>
                             <AlertDialogAction
                                onClick={async (event) => {
                                  try {
                                    // Attempt to delete. If successful, Shadcn closes the dialog.
                                    await handleDeleteTag();
                                  } catch (err) {
                                    // If handleDeleteTag throws (e.g., on DB error), prevent default closing.
                                    event.preventDefault();
                                  }
                                }}
                                disabled={isDeleting && deletingTag?.id === tag.id} // Disable only the specific action button
                                className="bg-red-600 hover:bg-red-700"
                              >
                                {isDeleting && deletingTag?.id === tag.id ? 'Deleting...' : 'Yes, delete tag'}
                              </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
