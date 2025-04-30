// src/components/RatingSlider.js
import React, { useState } from 'react';
import { Star } from 'lucide-react';

const RatingSlider = ({ initialValue = 50, onSubmit, disabled = false }) => {
  const [rating, setRating] = useState(initialValue);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await onSubmit(rating);
      // Success notification is handled in the parent component
    } catch (error) {
      console.error('Error submitting rating:', error);
    } finally {
      setSubmitting(false);
    }
  };

  // Determine star color based on rating
  const getStarColor = (value) => {
    if (value >= 75) return 'text-yellow-500';
    if (value >= 50) return 'text-yellow-400';
    if (value >= 25) return 'text-stone-500';
    return 'text-stone-400';
  };

  return (
    <div className="flex items-center bg-stone-50 border border-stone-200 rounded-md px-3 py-2 gap-3">
      <div className="flex flex-col">
        <div className="flex items-center gap-1.5 mb-1">
          <Star className={`w-4 h-4 ${getStarColor(rating)}`} />
          <span className="text-xs font-medium text-stone-600">Your Rating</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            id="rating-slider"
            type="range"
            min="0"
            max="100"
            value={rating}
            onChange={(e) => setRating(parseInt(e.target.value))}
            className="w-24 md:w-32 h-2 accent-stone-700"
            disabled={disabled || submitting}
          />
          <span className="text-sm font-medium text-stone-700 w-8 text-center bg-stone-100 px-1.5 py-0.5 rounded">{rating}</span>
        </div>
      </div>
      <button
        onClick={handleSubmit}
        disabled={disabled || submitting}
        className="px-3 py-1.5 bg-stone-800 text-white text-sm rounded hover:bg-stone-900 transition disabled:bg-stone-300 font-medium"
      >
        {submitting ? 'Saving...' : 'Rate'}
      </button>
    </div>
  );
};

export default RatingSlider;
