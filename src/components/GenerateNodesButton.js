// src/components/GenerateNodesButton.js
import React, { useState } from 'react';
import { Plus, Loader, AlertCircle, Check, ChevronDown } from 'lucide-react';
import { generateChildNodes, getPossibleChildNodeTypes, isTerminalNodeType } from '../services/nodeGenerationService';

const GenerateNodesButton = ({ node, collectionName, onSuccess, disabled }) => {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedType, setSelectedType] = useState(null);
  
  // Get available child types for this node
  const possibleChildTypes = getPossibleChildNodeTypes(node.node_type);
  const canGenerateChildren = possibleChildTypes.length > 0 && !node.terminal;
  
  // Handle node generation for a specific child type
  const handleGenerateClick = async (childType) => {
    if (generating || !canGenerateChildren) return;
    
    setGenerating(true);
    setError(null);
    setSuccess(false);
    setSelectedType(childType);
    setShowDropdown(false);
    
    try {
      const childNodes = await generateChildNodes(node, childType, collectionName);
      
      console.log(`Generated ${childNodes.length} ${childType} nodes`);
      setSuccess(true);
      
      // Call the onSuccess callback with the new nodes
      if (onSuccess && typeof onSuccess === 'function') {
        onSuccess(childNodes);
      }
      
      // Reset success state after 3 seconds
      setTimeout(() => {
        setSuccess(false);
        setSelectedType(null);
      }, 3000);
    } catch (err) {
      console.error(`Error generating ${childType} nodes:`, err);
      setError(err.message || `Failed to generate ${childType} nodes`);
    } finally {
      setGenerating(false);
    }
  };
  
  // Don't render anything if generation is not available for this node type
  if (!canGenerateChildren) {
    return null;
  }
  
  // Format the child type for display
  const formatChildType = (type) => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };
  
  // Button text based on state
  const getButtonText = () => {
    if (generating) return `Generating ${formatChildType(selectedType)}...`;
    if (success) return 'Generated Successfully!';
    
    // If there's only one option, just show that
    if (possibleChildTypes.length === 1) {
      return `Generate ${formatChildType(possibleChildTypes[0])}`;
    }
    
    // Otherwise show a more generic label
    return 'Generate';
  };
  
  // Render a dropdown for multiple options, or a single button for one option
  if (possibleChildTypes.length === 1) {
    // Single button for one option
    return (
      <div className="relative">
        <button
          onClick={() => handleGenerateClick(possibleChildTypes[0])}
          disabled={generating || disabled || success}
          className={`flex items-center gap-2 px-4 py-2 rounded-md transition ${
            success 
              ? 'bg-green-600 text-white' 
              : 'bg-indigo-600 text-white hover:bg-indigo-700'
          } disabled:opacity-60 disabled:cursor-not-allowed`}
        >
          {generating ? (
            <Loader className="w-4 h-4 animate-spin" />
          ) : success ? (
            <Check className="w-4 h-4" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          {getButtonText()}
        </button>
        
        {error && (
          <div className="absolute top-full left-0 right-0 mt-2 p-2 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    );
  }
  
  // Dropdown for multiple options
  return (
    <div className="relative">
      <div className="flex gap-2">
        {/* Dropdown button */}
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          disabled={generating || disabled || success}
          className={`flex items-center gap-2 px-4 py-2 rounded-md transition ${
            success 
              ? 'bg-green-600 text-white' 
              : 'bg-indigo-600 text-white hover:bg-indigo-700'
          } disabled:opacity-60 disabled:cursor-not-allowed`}
        >
          {generating ? (
            <Loader className="w-4 h-4 animate-spin" />
          ) : success ? (
            <Check className="w-4 h-4" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          {getButtonText()}
          {!generating && !success && possibleChildTypes.length > 1 && (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>
      </div>
      
      {/* Dropdown menu */}
      {showDropdown && (
        <div className="absolute top-full left-0 mt-2 bg-white rounded-md shadow-lg border border-stone-200 z-10 min-w-[200px]">
          <div className="py-1">
            {possibleChildTypes.map((type) => (
              <button
                key={type}
                onClick={() => handleGenerateClick(type)}
                className="w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-100 transition"
              >
                Generate {formatChildType(type)}
              </button>
            ))}
          </div>
        </div>
      )}
      
      {error && (
        <div className="absolute top-full left-0 right-0 mt-2 p-2 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

export default GenerateNodesButton;