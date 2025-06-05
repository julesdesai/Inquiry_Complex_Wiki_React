// src/App.js
import React, { useState, useEffect } from 'react';
import NodePage from './components/NodePage';
import GraphSelection from './components/GraphSelection';
import { getNode, getRootNodes } from './firebase';

// Configuration mapping each graph to its known root node ID
const ROOT_NODE_CONFIG = {
  'knowledge': '004d648a-1557-4549-8b22-fd1ae43fcd33', 
  'freedom': 'a5e92802-75b0-4c29-ad4f-f07d15889d15', 
  'reasons': 'afb54e2d-3b82-464a-80d1-f766da42395b' , 
  'semantics': '069e0a67-8365-46b0-a5db-6c8013f18563',
  'human_flourishing': 'ed7c4c1a-0dae-4857-977a-f3af8295f2b4',
  'AGI': 'af659166-31de-476b-aa91-66c7934a0b6a', 
  'lewis-counterfactual-dependence-times-arrow': 'a240deac-w532-714f-5983-6f8w9d9d1pdq',
  'frankfurt-alternate-possibilities': '4a1456eb-4265-4a26-aw4j-60c7d1d25d24',
  'plato-sophist': '1122f3d5-ea0f-4136-8a8e-4c494aaa1e20',
  'shanahan-simulacra': '44de1re6-1542-4216-bf55-sg156111fgf8',
  'williams-moral-luck': 'w156cf22-1b5b-11c8-b6aa-dw135d59y7d6'
};

const App = () => {
  const [selectedGraph, setSelectedGraph] = useState(
    localStorage.getItem('selectedGraph') || null
  );
  const [currentNodeId, setCurrentNodeId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // For debugging
  useEffect(() => {
    console.log('App state:', { selectedGraph, currentNodeId, loading, error });
  }, [selectedGraph, currentNodeId, loading, error]);

  useEffect(() => {
    let isMounted = true;
    let timeoutId = null;
    
    // Set a loading timeout to prevent infinite loading
    const setupLoadingTimeout = () => {
      return setTimeout(() => {
        if (isMounted) {
          console.error("Loading timeout reached");
          setError("Loading timeout reached. Please try again.");
          setLoading(false);
        }
      }, 10000); // 10 second timeout
    };

    const initializeSelectedGraph = async () => {
      if (!selectedGraph) {
        setLoading(false);
        return;
      }
      
      if (isMounted) {
        setLoading(true);
        setError(null);
      }
      
      // Save selected graph to localStorage
      localStorage.setItem('selectedGraph', selectedGraph);
      
      // Set a loading timeout
      timeoutId = setupLoadingTimeout();
      
      try {
        console.log(`Initializing graph: ${selectedGraph}`);
        
        // Get the root node ID from configuration
        const rootNodeId = ROOT_NODE_CONFIG[selectedGraph];
        
        if (rootNodeId) {
          console.log(`Attempting to use configured root node: ${rootNodeId}`);
          
          // Check if this node exists
          const node = await getNode(rootNodeId, selectedGraph);
          
          if (node) {
            console.log(`Successfully found root node: ${rootNodeId}`);
            if (isMounted) {
              setCurrentNodeId(rootNodeId);
              setLoading(false);
              clearTimeout(timeoutId);
            }
            return;
          } else {
            console.warn(`Root node not found: ${rootNodeId}`);
          }
        }
        
        // If we get here, we couldn't find the configured root node
        if (isMounted) {
          setError(`Could not find the starting node: ${rootNodeId} for graph: ${selectedGraph}.`);
          setLoading(false);
          clearTimeout(timeoutId);
        }
      } catch (error) {
        console.error('Error initializing graph:', error);
        if (isMounted) {
          setError(`Error loading graph: ${error.message}`);
          setCurrentNodeId(null);
          setLoading(false);
          clearTimeout(timeoutId);
        }
      }
    };

    initializeSelectedGraph();
    
    // Cleanup function
    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [selectedGraph]);

  const handleSelectGraph = (graphId) => {
    console.log(`Selected graph: ${graphId}`);
    setSelectedGraph(graphId);
    setCurrentNodeId(null); // Reset current node
    setError(null);
  };

  const handleBackToGraphSelection = () => {
    setSelectedGraph(null);
    setCurrentNodeId(null);
    setError(null);
    localStorage.removeItem('selectedGraph');
  };

  if (!selectedGraph) {
    return <GraphSelection onSelectGraph={handleSelectGraph} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl text-stone-600 mb-2">Loading graph...</div>
          <div className="text-sm text-stone-500 mb-2">Collection: {selectedGraph}</div>
          <div className="text-xs text-stone-400">This may take a moment</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-center max-w-lg p-6">
          <div className="text-xl text-red-600 mb-4">{error}</div>
          <button
            onClick={handleBackToGraphSelection}
            className="px-4 py-2 bg-stone-800 text-white rounded-md hover:bg-stone-900"
          >
            Back to Graph Selection
          </button>
        </div>
      </div>
    );
  }

  if (!currentNodeId) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl text-red-600 mb-4">No starting node found</div>
          <button
            onClick={handleBackToGraphSelection}
            className="px-4 py-2 bg-stone-800 text-white rounded-md hover:bg-stone-900"
          >
            Back to Graph Selection
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-stone-800 text-white p-3 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="font-medium">Current Graph:</span>
          <span className="bg-stone-700 px-2 py-1 rounded text-sm">
            {selectedGraph.charAt(0).toUpperCase() + selectedGraph.slice(1)}
          </span>
        </div>
        <button
          onClick={handleBackToGraphSelection}
          className="px-3 py-1 bg-stone-700 text-white rounded hover:bg-stone-600 text-sm"
        >
          Change Graph
        </button>
      </div>
      
      <NodePage
        nodeId={currentNodeId}
        onNavigate={setCurrentNodeId}
        collectionName={selectedGraph}
      />
    </>
  );
};

export default App;