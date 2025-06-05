// Updated NodePage.js with ancestral chain implementation
import React, { useState, useEffect } from 'react';
import { Upload, X, ChevronRight, ArrowUp, ArrowDown, BookOpen, Layers, Box, HelpCircle, 
         MessageCircle, GitBranch, ArrowRight, Clipboard, Image, Star, AlertCircle, 
         Plus, Cpu, Users, ChevronLeft } from 'lucide-react';
import { getNode, getChildNodes, uploadImage, getNodeImages, updateHumanRating, getUserRating } from '../firebase';
import { getFilledPromptTemplate } from '../services/promptService';
import { generateAndUploadImage } from '../services/imageGenerationService';
import aiRatingService from '../services/aiRatingService';
import Toast from './CopyToast';
import ExplanationPanel from './ExplanationPanel';
import RatingSlider from './RatingSlider';
import NodeCreationInterface from './NodeCreationInterface';
import SourceTag from './SourceTag';
import { getUserModifiedNodes } from '../firebase';

// New component for displaying the ancestral chain
const AncestralChain = ({ ancestors }) => {
  if (!ancestors || ancestors.length === 0) return null;
  
  // If we have 3 or fewer ancestors, show them all
  // Otherwise, show the root, an ellipsis, and the last 3 ancestors
  const displayAncestors = ancestors.length <= 3 
    ? ancestors 
    : [ancestors[0], ...ancestors.slice(-3)];
  
  return (
    <div className="flex items-center flex-wrap gap-1 text-sm text-stone-600 mt-2">
      {displayAncestors.map((ancestor, index) => (
        <React.Fragment key={ancestor.id}>
          {/* If we're showing a non-consecutive chain and this is the first item after the root */}
          {ancestors.length > 3 && index === 1 && (
            <span className="text-stone-400 mx-1">…</span>
          )}
          
          <span className="font-medium bg-stone-100 px-2 py-1 rounded">
            {ancestor.summary}
          </span>
          
          {/* Add separator arrows between items, but not after the last one */}
          {index < displayAncestors.length - 1 && (
            <ChevronRight className="w-4 h-4 text-stone-400" />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

const NodePage = ({ nodeId, onNavigate, collectionName = 'nodes' }) => {
  // Basic node data
  const [node, setNode] = useState(null);
  const [parentNode, setParentNode] = useState(null);
  const [childNodes, setChildNodes] = useState([]);
  
  // New state for ancestral chain
  const [ancestors, setAncestors] = useState([]);
  const [loadingAncestors, setLoadingAncestors] = useState(false);
  
  // Loading states
  const [loading, setLoading] = useState(true);
  const [loadingParent, setLoadingParent] = useState(false);
  const [loadingChildren, setLoadingChildren] = useState(false);
  const [loadingImages, setLoadingImages] = useState(false);
  
  // Image related states
  const [images, setImages] = useState([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadPreview, setUploadPreview] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  
  // Rating related states
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [aiRatingProcessing, setAiRatingProcessing] = useState(false);
  const [aiRating, setAiRating] = useState(null);
  const [showAiRating, setShowAiRating] = useState(false);
  const [userRating, setUserRating] = useState(null);
  
  // Other UI states
  const [copying, setCopying] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("Copied to clipboard!");
  const [toastIcon, setToastIcon] = useState(() => <Clipboard className="w-4 h-4" />);
  const [error, setError] = useState(null);
  const [generationError, setGenerationError] = useState(null);
  const [showExplanationPanel, setShowExplanationPanel] = useState(false);
  const [currentExplanationStyle, setCurrentExplanationStyle] = useState('standard');
  const [pendingExplanationRequest, setPendingExplanationRequest] = useState(false);

  const [modifiedNodes, setModifiedNodes] = useState([]);
  const [loadingModifiedNodes, setLoadingModifiedNodes] = useState(false);
  const [showModifiedNodesModal, setShowModifiedNodesModal] = useState(false);

  // Reset states when nodeId changes
  useEffect(() => {
    // Reset rating-related states
    setAiRating(null);
    setShowAiRating(false);
    setAiRatingProcessing(false);
    setUserRating(null);
    
    // Reset other states as needed
    setSelectedImage(null);
    setShowUploadModal(false);
    setShowExplanationPanel(false);
    setCurrentExplanationStyle('standard');
    setPendingExplanationRequest(false);
    setAncestors([]);
    
    console.log(`NodePage: nodeId changed to ${nodeId}, states reset`);
  }, [nodeId]);

  // Open explanation panel after style is set
  useEffect(() => {
    if (pendingExplanationRequest) {
      console.log(`NodePage: Opening explanation panel with style: ${currentExplanationStyle}`);
      setShowExplanationPanel(true);
      setPendingExplanationRequest(false);
    }
  }, [pendingExplanationRequest, currentExplanationStyle]);

  // Step 1: Load the current node first (highest priority)
  useEffect(() => {
    const loadCurrentNode = async () => {
      setLoading(true);
      setError(null);
      
      try {
        console.log(`Loading node: ${nodeId}`);
        const nodeData = await getNode(nodeId, collectionName);
        
        if (nodeData) {
          setNode(nodeData);
          // After we have the node, trigger the other data loading processes
          // Don't await these - let them load independently
          loadParentNode(nodeData.parent_id);
          loadChildNodes();
          loadNodeImages();
          
          // If we have a parent_id, also load the ancestral chain
          if (nodeData.parent_id) {
            loadAncestralChain(nodeData);
          }
        } else {
          setError(`Node ${nodeId} not found`);
        }
      } catch (err) {
        console.error('Error loading node:', err);
        setError(`Failed to load node: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
    
    loadCurrentNode();
  }, [nodeId, collectionName]);

  // New function to load the ancestral chain
  const loadAncestralChain = async (currentNode) => {
    if (!currentNode || !currentNode.parent_id) {
      setAncestors([]);
      return;
    }

    setLoadingAncestors(true);
    try {
      console.log(`Loading ancestral chain for node: ${currentNode.id}`);
      
      let ancestorChain = [];
      let parentId = currentNode.parent_id;
      
      // Traverse up the tree until we reach the root node (no parent_id)
      while (parentId) {
        const ancestorNode = await getNode(parentId, collectionName);
        if (!ancestorNode) break;
        
        // Add this ancestor to the beginning of the chain
        // This ensures the root is always first in the array
        ancestorChain.unshift(ancestorNode);
        
        // Move to the next parent
        parentId = ancestorNode.parent_id;
      }
      
      console.log(`Found ${ancestorChain.length} ancestors`);
      setAncestors(ancestorChain);
    } catch (err) {
      console.error('Error loading ancestral chain:', err);
      // Don't set a critical error - ancestral chain is not critical
      setAncestors([]);
    } finally {
      setLoadingAncestors(false);
    }
  };

  // Handle explanation button clicks
  const handleExplanationClick = (style) => {
    console.log(`NodePage: Setting explanation style to ${style}`);
    // Set style first, then set a flag to open the panel in the next render cycle
    setCurrentExplanationStyle(style);
    setPendingExplanationRequest(true);
  };

  // Add a function to load modified nodes
const loadModifiedNodes = async () => {
  setLoadingModifiedNodes(true);
  try {
    console.log(`Loading user-modified nodes from ${collectionName}`);
    const nodes = await getUserModifiedNodes(collectionName);
    setModifiedNodes(nodes);
    setShowModifiedNodesModal(true);
  } catch (error) {
    console.error('Error loading modified nodes:', error);
    // Show error toast
    setToastMessage("Failed to load modified nodes");
    setToastIcon(() => <AlertCircle className="w-4 h-4" />);
    setShowToast(true);
  } finally {
    setLoadingModifiedNodes(false);
  }
};

  // Load user's rating and check for AI rating when node loads
  useEffect(() => {
    const loadUserRating = async () => {
      if (!node || !node.id) return;
      
      try {
        // Get userId from localStorage or other auth source
        const userId = localStorage.getItem('userId') || null;
        if (!userId) return;
        
        // Get user's rating for this node
        const rating = await getUserRating(node.id, userId, collectionName);
        setUserRating(rating);
        
        // If user has rated, check for AI rating
        if (rating !== null) {
          checkForAiRating();
        }
      } catch (error) {
        console.error('Error loading user rating:', error);
      }
    };
    
    loadUserRating();
  }, [node, collectionName]);

  // Function to check for AI rating
  const checkForAiRating = async () => {
    if (!node || !node.id) return;
    
    try {
      const { hasRating, rating } = await aiRatingService.getAIRating(node.id, collectionName);
      
      if (hasRating) {
        console.log(`Found existing AI rating for node ${node.id}: ${rating}`);
        setAiRating(rating);
        setShowAiRating(true);
      }
    } catch (error) {
      console.error(`Error checking for AI rating for node ${node.id}:`, error);
    }
  };

  // Step 2: Load the parent node if available (medium priority)
  const loadParentNode = async (parentId) => {
    if (!parentId) {
      setParentNode(null);
      return;
    }
    
    setLoadingParent(true);
    try {
      console.log(`Loading parent node: ${parentId}`);
      const parentData = await getNode(parentId, collectionName);
      setParentNode(parentData);
    } catch (err) {
      console.error('Error loading parent node:', err);
      // Don't set an error - parent node is not critical
    } finally {
      setLoadingParent(false);
    }
  };

  // Step 3: Load child nodes (medium priority)
  const loadChildNodes = async () => {
    setLoadingChildren(true);
    try {
      console.log(`Loading child nodes for: ${nodeId}`);
      const children = await getChildNodes(nodeId, collectionName);
      
      // Sort children by node_type
      const sortedChildren = children.sort((a, b) => {
        const typeOrder = ['question', 'thesis', 'reason', 'antithesis', 'synthesis', 'direct_reply'];
        return typeOrder.indexOf(a.node_type) - typeOrder.indexOf(b.node_type);
      });
      
      setChildNodes(sortedChildren);
    } catch (err) {
      console.error('Error loading child nodes:', err);
      // Don't set an error - child nodes are not critical
      setChildNodes([]);
    } finally {
      setLoadingChildren(false);
    }
  };

  // Step 4: Load images (lowest priority)
  const loadNodeImages = async () => {
    setLoadingImages(true);
    try {
      console.log(`Loading images for node: ${nodeId}`);
      const nodeImages = await getNodeImages(nodeId, collectionName);
      setImages(nodeImages);
    } catch (err) {
      console.error('Error loading images:', err);
      // Don't set an error - images are not critical
      setImages([]);
    } finally {
      setLoadingImages(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadPreview({
          file,
          preview: reader.result
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = async () => {
    if (!uploadPreview) return;

    setUploading(true);
    try {
      const uploadedImage = await uploadImage(nodeId, uploadPreview.file, collectionName);
      setImages(prev => [...prev, uploadedImage]);
      setUploadPreview(null);
      setShowUploadModal(false);
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image. Please try again.');
    } finally {
      setUploading(false);
    }
  };
  
  const handleCopyPrompt = async () => {
    try {
      setCopying(true);
      
      // Get the prompt template from the text file and fill it with node data
      const promptTemplatePath = '/prompts/image_generation/imagePrompt.txt';
      const prompt = await getFilledPromptTemplate(promptTemplatePath, node);
      
      // Try using clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(prompt);
      } else {
        // Fallback method
        const textArea = document.createElement('textarea');
        textArea.value = prompt;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        textArea.remove();
        
        if (!successful) {
          throw new Error('Fallback clipboard copy failed');
        }
      }
      
      // Show toast notification
      setToastMessage("Copied to clipboard!");
      setToastIcon(() => <Clipboard className="w-4 h-4" />);
      setShowToast(true);
      
      // Visual feedback on button
      setTimeout(() => {
        setCopying(false);
      }, 2000);
    } catch (error) {
      console.error('Error copying prompt to clipboard:', error);
      alert('Failed to copy prompt. Please try again: ' + error.message);
      setCopying(false);
    }
  };
  
  // Function to handle image generation
  const handleGenerateImage = async () => {
    try {
      setGenerating(true);
      setGenerationError(null);
      
      // Get the prompt template from the text file and fill it with node data
      const promptTemplatePath = '/prompts/image_generation/imagePrompt.txt';
      const prompt = await getFilledPromptTemplate(promptTemplatePath, node);
      
      // Generate and upload the image
      const uploadedImage = await generateAndUploadImage(nodeId, prompt, collectionName);
      
      // Add the new image to the images state
      setImages(prev => [...prev, uploadedImage]);
      
      // Show toast notification
      setToastMessage("Image generated successfully!");
      setToastIcon(() => <Image className="w-4 h-4" />);
      setShowToast(true);
      
      // Reset generation state
      setTimeout(() => {
        setGenerating(false);
      }, 2000);
    } catch (error) {
      console.error('Error generating image:', error);
      setGenerationError(error.message);
      setGenerating(false);
    }
  };

  // Handle rating submission with updated rating system
  const handleRatingSubmit = async (rating) => {
    try {
      setRatingSubmitting(true);
      
      // Generate a random user ID if authentication is not implemented
      // In a real app, you'd use the authenticated user's ID
      const userId = localStorage.getItem('userId') || `user_${Math.random().toString(36).substr(2, 9)}`;
      
      // Store the userId for future use
      if (!localStorage.getItem('userId')) {
        localStorage.setItem('userId', userId);
      }
      
      // Update the user rating in the database
      const result = await updateHumanRating(nodeId, rating, userId, collectionName);
      
      // Update local state with the new rating data
      setUserRating(rating);
      setNode(prevNode => ({
        ...prevNode,
        averageRating: result.averageRating,
        totalRatingCount: result.totalRatingCount,
        humanAverageRating: result.humanAverageRating,
        humanRatingCount: result.humanRatingCount
      }));
      
      // Show toast notification
      setToastMessage("Rating submitted successfully!");
      setToastIcon(() => <Star className="w-4 h-4" />);
      setShowToast(true);
      
      console.log(`Successfully rated node ${nodeId} in collection ${collectionName} with rating ${rating}`);
      
      // After user has submitted a rating, trigger or show AI rating
      if (aiRating) {
        // If we already have an AI rating, just show it
        setShowAiRating(true);
      } else {
        // Otherwise trigger a new one
        triggerNodeAIRating();
      }
      
      return true;
    } catch (error) {
      console.error(`Error submitting rating for node ${nodeId}:`, error);
      
      // Show error toast
      setToastMessage("Failed to submit rating");
      setToastIcon(() => <AlertCircle className="w-4 h-4" />);
      setShowToast(true);
      
      return false;
    } finally {
      setRatingSubmitting(false);
    }
  };
  
  // Helper function to trigger the AI rating
  const triggerNodeAIRating = async () => {
    try {
      console.log(`Checking if AI rating is needed for node ${nodeId}`);
      
      // Set a loading state for AI rating
      setAiRatingProcessing(true);
      
      // Trigger the AI rating
      const aiRatingResult = await aiRatingService.triggerAIRating(nodeId, collectionName);
      
      if (aiRatingResult) {
        console.log(`AI rated node ${nodeId} with a rating of ${aiRatingResult.aiRating}`);
        
        // Store the AI rating in component state
        setAiRating(aiRatingResult.aiRating);
        setShowAiRating(true);
        
        // If this is a new AI rating (not one that already existed), update the node data
        if (!aiRatingResult.alreadyExists && aiRatingResult.updatedAverageRating) {
          setNode(prevNode => ({
            ...prevNode,
            averageRating: aiRatingResult.updatedAverageRating,
            totalRatingCount: aiRatingResult.updatedTotalRatings
          }));
        }
        
        // Show AI rating toast notification
        setToastMessage(`AI rated this node: ${aiRatingResult.aiRating}/100`);
        setToastIcon(() => <Cpu className="w-4 h-4" />);
        setShowToast(true);
      }
    } catch (error) {
      console.error(`Error triggering AI rating for node ${nodeId}:`, error);
      // Don't show an error toast, as this is a background process
    } finally {
      setAiRatingProcessing(false);
    }
  };
  
  // Handler for when children are generated successfully
  const handleChildrenGenerated = (newChildren) => {
    if (!newChildren || newChildren.length === 0) return;
    
    // Update the child nodes in state
    setChildNodes(prevChildren => {
      // Combine with existing children and sort
      const allChildren = [...prevChildren, ...newChildren].sort((a, b) => {
        const typeOrder = ['question', 'thesis', 'reason', 'antithesis', 'synthesis', 'direct_reply'];
        return typeOrder.indexOf(a.node_type) - typeOrder.indexOf(b.node_type);
      });
      
      return allChildren;
    });
    
    // Get the icon for the generated node type
    const nodeType = newChildren[0].node_type;
    const typeInfo = getNodeTypeInfo(nodeType);
    
    // Show a toast notification
    setToastMessage(`Generated ${newChildren.length} ${nodeType} node${newChildren.length > 1 ? 's' : ''} successfully!`);
    setToastIcon(() => typeInfo.icon || <Plus className="w-4 h-4" />);
    setShowToast(true);
  };
  
  // Node type icons and colors
  const getNodeTypeInfo = (type) => {
    switch (type) {
      case 'question':
        return { icon: <HelpCircle className="w-4 h-4" />, color: 'bg-purple-50 text-purple-700 border-purple-200' };
      case 'thesis':
        return { icon: <BookOpen className="w-4 h-4" />, color: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'reason':
        return { icon: <MessageCircle className="w-4 h-4" />, color: 'bg-green-50 text-green-700 border-green-200' };
      case 'antithesis':
        return { icon: <GitBranch className="w-4 h-4" />, color: 'bg-red-50 text-red-700 border-red-200' };
      case 'synthesis':
        return { icon: <Layers className="w-4 h-4" />, color: 'bg-yellow-50 text-yellow-700 border-yellow-200' };
      case 'direct_reply':
        return { icon: <ArrowRight className="w-4 h-4" />, color: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
      default:
        return { icon: <Box className="w-4 h-4" />, color: 'bg-gray-50 text-gray-700 border-gray-200' };
    }
  };
  
  // Format node type for display
  const formatNodeType = (type) => {
    if (type === 'direct_reply') return 'Direct Reply';
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-xl text-stone-600">Loading node...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-xl text-red-600">{error}</div>
      </div>
    );
  }

  if (!node) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-xl text-red-600">Node not found</div>
      </div>
    );
  }

  const nodeTypeInfo = getNodeTypeInfo(node.node_type);

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-8 mb-6 border border-stone-100">
          <h1 className="text-4xl font-bold mb-4 text-stone-800">{node.summary}</h1>
          <div className="flex items-center gap-3 text-sm">
            <span className={`px-3 py-1.5 rounded-full border flex items-center gap-2 ${nodeTypeInfo.color}`}>
              {nodeTypeInfo.icon}
              {formatNodeType(node.node_type)}
            </span>
            <span className="px-3 py-1.5 bg-stone-100 text-stone-700 rounded-full border border-stone-200">
              Depth: {node.depth}
            </span>
            <SourceTag userGenerated={node.user_generated} />
          </div>
        </div>

        {/* Navigation with Ancestral Chain */}
      
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6 border border-stone-100">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              {node.parent_id && (
                <button
                  onClick={() => onNavigate(node.parent_id)}
                  className="flex items-center gap-2 px-4 py-2 bg-stone-100 hover:bg-stone-200 rounded-md text-stone-700 transition"
                >
                  <ArrowUp className="w-4 h-4" />
                  Parent
                </button>
              )}
              
              {/* Add the User Modified Nodes button here */}
              <button
                onClick={loadModifiedNodes}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-100 hover:bg-indigo-200 rounded-md text-indigo-700 transition"
                disabled={loadingModifiedNodes}
              >
                <Users className="w-4 h-4" />
                {loadingModifiedNodes ? 'Loading...' : 'User Modified Nodes'}
              </button>
            </div>
            
            <div className="flex gap-2">
              {loadingChildren ? (
                <div className="flex items-center gap-2 px-4 py-2 bg-stone-100 rounded-md text-stone-700">
                  <ArrowDown className="w-4 h-4" />
                  Loading...
                </div>
              ) : childNodes.length > 0 ? (
                <div className="flex items-center gap-2 px-4 py-2 bg-stone-100 rounded-md text-stone-700">
                  <ArrowDown className="w-4 h-4" />
                  {childNodes.length} Response{childNodes.length !== 1 ? 's' : ''}
                </div>
              ) : null}
            </div>
          </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow-sm p-8 mb-6 border border-stone-100">
          {/* Rating section - Only visible if user has rated */}
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-semibold text-stone-800">Basic Structure</h2>
              
              {/* Only show ratings if the user has submitted a rating */}
              {userRating !== null && node.node_type !== 'question' && (
                <div className="flex flex-wrap items-center gap-3 mt-2">
                  {/* Combined average rating */}
                  {node.averageRating > 0 && (
                    <div className="bg-stone-50 border border-stone-200 rounded-md px-3 py-1.5 inline-flex items-center gap-2">
                      <Star className={`w-4 h-4 ${node.averageRating > 75 ? 'text-yellow-500' : node.averageRating > 50 ? 'text-yellow-400' : 'text-stone-500'}`} />
                      <span className="text-sm text-stone-700">
                        <span className="font-medium">{node.averageRating}</span>/100
                      </span>
                      <span className="text-xs text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full">
                        {node.totalRatingCount || 0} {node.totalRatingCount === 1 ? 'rating' : 'ratings'}
                      </span>
                    </div>
                  )}

                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {node.node_type !== 'question' && (
                <RatingSlider 
                  initialValue={userRating || 50} 
                  onSubmit={handleRatingSubmit}
                  disabled={ratingSubmitting}
                />
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleExplanationClick('standard')}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition"
                  disabled={pendingExplanationRequest}
                >
                  <BookOpen className="w-4 h-4" />
                  Explain This!
                </button>
                <button
                  onClick={() => handleExplanationClick('simple')}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition"
                  disabled={pendingExplanationRequest}
                >
                  <BookOpen className="w-4 h-4" />
                  Explain in Simple English
                </button>
              </div>
            </div>
          </div>

          {/* Node Content Display */}
          <div className="prose prose-stone max-w-none">
            {node.content.split('},').map((proposition, index) => (
              <div key={index} className="mb-3 p-4 bg-stone-50 rounded-lg border border-stone-100">
                <p className="text-stone-700 leading-relaxed">
                  {proposition.replace(/[{}]/g, '').trim()}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Image Gallery */}
        <div className="bg-white rounded-lg shadow-sm p-8 mb-6 border border-stone-100">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
            <h2 className="text-2xl font-semibold text-stone-800">Image Gallery</h2>
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              <button
                onClick={handleCopyPrompt}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-stone-600 text-white rounded-md hover:bg-stone-700 transition flex-1 sm:flex-initial"
                disabled={copying}
              >
                <Clipboard className="w-4 h-4" />
                <span className="whitespace-nowrap">{copying ? 'Copied!' : 'Copy Prompt'}</span>
              </button>
              {images.length === 0 && (
                <button
                  onClick={handleGenerateImage}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition flex-1 sm:flex-initial"
                  disabled={generating}
                >
                  <Image className="w-4 h-4" />
                  <span className="whitespace-nowrap">{generating ? 'Generating...' : 'Generate'}</span>
                </button>
              )}
              <button
                onClick={() => setShowUploadModal(true)}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-stone-800 text-white rounded-md hover:bg-stone-900 transition flex-1 sm:flex-initial"
                disabled={uploading}
              >
                <Upload className="w-4 h-4" />
                <span className="whitespace-nowrap">Upload</span>
              </button>
            </div>
          </div>

          {generationError && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-md mb-4">
              <p className="text-sm">Error generating image: {generationError}</p>
            </div>
          )}

          {loadingImages ? (
            <div className="text-center py-10 text-stone-500">
              Loading images...
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {images.map((image) => (
                <div
                  key={image.id}
                  className="relative aspect-square rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-stone-400 transition"
                  onClick={() => setSelectedImage(image)}
                >
                  <img
                    src={image.url}
                    alt={image.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
              {images.length === 0 && (
                <div className="col-span-full text-center text-stone-500 py-8">
                  No images uploaded yet
                </div>
              )}
            </div>
          )}
        </div>

        {/* Child Nodes grouped by type */}
        {loadingChildren ? (
          <div className="bg-white rounded-lg shadow-sm p-8 border border-stone-100 text-center py-4">
            <div className="text-stone-500">Loading related nodes...</div>
          </div>
        ) : childNodes.length > 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-8 border border-stone-100">
            {/* Group children by node type */}
            {['question', 'thesis', 'reason', 'antithesis', 'synthesis', 'direct_reply'].map(nodeType => {
              const childrenOfType = childNodes.filter(child => child.node_type === nodeType);
              if (childrenOfType.length === 0) return null;
              
              const typeInfo = getNodeTypeInfo(nodeType);
              
              // Handle proper pluralization
              const getTypeTitle = (type, count) => {
                const titles = {
                  'question': count > 1 ? 'Questions' : 'Question',
                  'thesis': count > 1 ? 'Theses' : 'Thesis',
                  'reason': count > 1 ? 'Reasons' : 'Reason',
                  'antithesis': count > 1 ? 'Antitheses' : 'Antithesis',
                  'synthesis': count > 1 ? 'Syntheses' : 'Synthesis',
                  'direct_reply': count > 1 ? 'Direct Replies' : 'Direct Reply'
                };
                return titles[type] || formatNodeType(type);
              };
              
              return (
                <div key={nodeType} className="mb-8 last:mb-0">
                  <h3 className="text-lg font-semibold mb-3 text-stone-700 flex items-center gap-2">
                    <span className={`p-1.5 rounded-md ${typeInfo.color}`}>
                      {typeInfo.icon}
                    </span>
                    {getTypeTitle(nodeType, childrenOfType.length)}
                  </h3>
                  <div className="space-y-2 ml-8">
                    {childrenOfType.map((child) => (
                      <button
                        key={child.id}
                        onClick={() => onNavigate(child.id)}
                        className="w-full text-left p-4 bg-stone-50 hover:bg-stone-100 rounded-lg border border-stone-100 flex justify-between items-center group transition"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-stone-700">{child.summary}</span>
                          <SourceTag userGenerated={child.user_generated} />
                        </div>
                        <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-stone-600 transition" />
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        {/* Node Creation Interface - hidden for terminal nodes and terminal node types */}
        {!node.terminal && !['reason', 'direct_reply'].includes(node.node_type) && (
          <NodeCreationInterface
            node={node}
            collectionName={collectionName}
            onSuccess={handleChildrenGenerated}
          />
        )}
      </div>

      {/* Debug Info - Node UUID */}
      <div className="w-full text-center pb-3">
        <span className="text-xs text-stone-300 select-all font-mono">
          {node.id}
        </span>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-stone-800">Upload Image</h3>
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadPreview(null);
                }}
                className="text-stone-500 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!uploadPreview ? (
              <div className="border-2 border-dashed border-stone-300 rounded-lg p-6 text-center">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="fileInput"
                />
                <label
                  htmlFor="fileInput"
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  <Upload className="w-8 h-8 text-stone-400" />
                  <span className="text-sm text-stone-600">
                    Click to select an image or drag and drop
                  </span>
                </label>
              </div>
            ) : (
              <div className="space-y-4">
                <img
                  src={uploadPreview.preview}
                  alt="Preview"
                  className="w-full h-48 object-cover rounded-lg"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setUploadPreview(null)}
                    className="px-4 py-2 text-stone-600 hover:text-stone-800"
                    disabled={uploading}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpload}
                    className="px-4 py-2 bg-stone-800 text-white rounded-md hover:bg-stone-900 disabled:bg-stone-400"
                    disabled={uploading}
                  >
                    {uploading ? 'Uploading...' : 'Upload'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Image Lightbox */}
      {selectedImage && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedImage(null)}
        >
          <div className="max-w-4xl max-h-full">
            <img
              src={selectedImage.url}
              alt={selectedImage.name}
              className="max-w-full max-h-[90vh] object-contain"
            />
          </div>
        </div>
      )}
      
      {/* Toast Notification */}
      <Toast 
        show={showToast} 
        onClose={() => setShowToast(false)}
        message={toastMessage}
        icon={toastIcon}
      />
      
      {/* Explanation Panel */}
      <ExplanationPanel
        isOpen={showExplanationPanel}
        onClose={() => setShowExplanationPanel(false)}
        nodeData={{...node, collectionName}} // Pass collection name to explanation panel
        collectionName={collectionName}
        currentStyle={currentExplanationStyle} // Pass the selected explanation style
      />

      {/* User Modified Nodes Modal */}
      {showModifiedNodesModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-stone-800">User Modified Nodes</h3>
              <button
                onClick={() => setShowModifiedNodesModal(false)}
                className="text-stone-500 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingModifiedNodes ? (
              <div className="text-center py-10 text-stone-500">
                Loading modified nodes...
              </div>
            ) : modifiedNodes.length > 0 ? (
              <div className="space-y-3">
                {modifiedNodes.map((node) => (
                  <button
                    key={node.id}
                    onClick={() => {
                      onNavigate(node.id);
                      setShowModifiedNodesModal(false);
                    }}
                    className="w-full text-left p-4 bg-stone-50 hover:bg-stone-100 rounded-lg border border-stone-100 flex justify-between items-center group transition"
                  >
                    <div className="flex flex-col">
                      <span className="text-stone-700 font-medium">{node.summary}</span>
                      <div className="flex items-center gap-2 mt-1">
                        {node.node_type && (
                          <span className={`px-2 py-0.5 text-xs rounded-full ${getNodeTypeInfo(node.node_type).color}`}>
                            {formatNodeType(node.node_type)}
                          </span>
                        )}
                        {node.humanRatingCount > 0 && (
                          <span className="text-xs text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full">
                            {node.humanRatingCount} {node.humanRatingCount === 1 ? 'rating' : 'ratings'}
                          </span>
                        )}
                        {node.hasImages && (
                          <span className="text-xs text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Image className="w-3 h-3" />
                            Images
                          </span>
                        )}
                        {node.user_generated && (
                          <span className="text-xs text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            User created
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-stone-600 transition" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-stone-500">
                No modified nodes found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NodePage;