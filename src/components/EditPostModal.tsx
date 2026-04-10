import { useState } from 'react';
import { X, Save, Loader2, Tag } from 'lucide-react';
import type { FeedPost } from '@/types/firestore.types';

interface EditPostModalProps {
  post: FeedPost;
  onClose: () => void;
  onSubmit: (
  postId: string,
  data: {
    title: string;
    description: string;
    tags: string[];
    image?: File | null; // ✅ NEW
    removeImage?: boolean; // ✅ NEW
  }
) => Promise<void>;
}

const EditPostModal = ({ post, onClose, onSubmit }: EditPostModalProps) => {
  const [image, setImage] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [title, setTitle] = useState(post.title);
  const [description, setDescription] = useState(post.description);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(post.tags || []);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleAddTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed) && tags.length < 5) {
      setTags([...tags, trimmed]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    if (!description.trim()) {
      setError('Description is required');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(post.id, {
  title: title.trim(),
  description: description.trim(),
  tags,
  image,
  removeImage,
});

      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update post');
    }
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-lg bg-card rounded-xl shadow-xl animate-scale-in 
             max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display font-bold text-xl text-foreground">Edit Post</h2>
            <p className="text-sm text-muted-foreground mt-1">Update your post</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-secondary transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm mb-4">
              {error}
            </div>
          )}

          {/* Title */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-foreground mb-2">
              Title <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What's on your mind?"
              className="input-field"
              maxLength={100}
            />
          </div>

          {/* Description */}
<div className="mb-4">
  <label className="block text-sm font-medium text-foreground mb-2">
    Description <span className="text-destructive">*</span>
  </label>
  <textarea
    value={description}
    onChange={(e) => setDescription(e.target.value)}
    placeholder="Tell us more about your post..."
    className="input-field min-h-[120px] resize-none"
    maxLength={1000}
  />
</div>

{/* Image */}
<div className="mb-6">
  <label className="block text-sm font-medium text-foreground mb-2">
    Image (optional)
  </label>

  {/* Existing image preview */}
  {post.imageUrl && !removeImage && !image && (
    <div className="relative mb-3">
      <img
        src={post.imageUrl}
        alt="Post"
        className="rounded-lg max-h-48 object-cover"
      />
      <button
        type="button"
        onClick={() => setRemoveImage(true)}
        className="absolute top-2 right-2 bg-background/80 p-1 rounded-full"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )}

  {/* New image preview */}
  {image && (
    <div className="relative mb-3">
      <img
        src={URL.createObjectURL(image)}
        alt="Preview"
        className="rounded-lg max-h-48 object-cover"
      />
      <button
        type="button"
        onClick={() => setImage(null)}
        className="absolute top-2 right-2 bg-background/80 p-1 rounded-full"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )}

  {/* Upload input */}
  {!image && (
    <input
      type="file"
      accept="image/*"
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) {
          setImage(file);
          setRemoveImage(false);
        }
      }}
      className="block w-full text-sm"
    />
  )}
</div>

{/* Tags */}
<div className="mb-6">
  <label className="block text-sm font-medium text-foreground mb-2">
    Tags (optional)
  </label>

  <div className="flex gap-2 mb-2">
    <div className="relative flex-1">
      <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <input
        type="text"
        value={tagInput}
        onChange={(e) => setTagInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Add a tag and press Enter"
        className="input-field pl-10"
        maxLength={20}
      />
    </div>

    <button
      type="button"
      onClick={handleAddTag}
      className="btn-secondary"
      disabled={!tagInput.trim() || tags.length >= 5}
    >
      Add
    </button>
  </div>

  {tags.length > 0 && (
    <div className="flex flex-wrap gap-2 mb-1">
      {tags.map((tag) => (
        <span
          key={tag}
          className="px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary flex items-center gap-1"
        >
          {tag}
          <button
            type="button"
            onClick={() => handleRemoveTag(tag)}
            className="hover:text-destructive"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
    </div>
  )}

  <p className="text-xs text-muted-foreground mt-1">
    Max 5 tags
  </p>
</div>

{/* Actions */}
<div className="flex items-center justify-end gap-3">
  <button
    type="button"
    onClick={onClose}
    className="btn-secondary"
    disabled={submitting}
  >
    Cancel
  </button>

  <button
    type="submit"
    disabled={submitting}
    className="btn-primary flex items-center gap-2"
  >
    {submitting ? (
      <>
        <Loader2 className="w-4 h-4 animate-spin" />
        Saving...
      </>
    ) : (
      <>
        <Save className="w-4 h-4" />
        Save Changes
      </>
    )}
  </button>
</div>
</form> </div> </div> ); }; export default EditPostModal;