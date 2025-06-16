import { migrateJsonToFirestore, storeTextMetadata } from '../firebase';

export const processTextFile = async (name, description, textContent) => {
  try {
    const response = await fetch('/api/process-text', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: name.trim(),
        description: description.trim(),
        textContent: textContent.trim()
      })
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Processing failed');
    }

    return result;
  } catch (error) {
    console.error('Error processing text:', error);
    throw error;
  }
};

export const uploadInquiryComplexToFirebase = async (collectionName, inquiryComplexData, metadata) => {
  try {
    console.log(`🔥 FIREBASE UPLOAD STARTING`);
    console.log(`Collection: ${collectionName}`);
    console.log(`Node count: ${Object.keys(inquiryComplexData).length}`);
    console.log(`Metadata:`, metadata);
    
    // Upload the node data to the collection
    console.log(`📝 Uploading ${Object.keys(inquiryComplexData).length} nodes to collection: ${collectionName}`);
    await migrateJsonToFirestore(inquiryComplexData, collectionName);
    console.log(`✅ Node data uploaded successfully to collection: ${collectionName}`);
    
    // Find and store the root node ID
    const rootNodeId = findRootNode(inquiryComplexData);
    console.log(`🎯 Found root node ID: ${rootNodeId}`);
    
    // Store metadata in Firebase for global access
    const metadataWithRoot = {
      ...metadata,
      rootNodeId,
      nodeCount: Object.keys(inquiryComplexData).length
    };
    
    console.log(`📊 Storing metadata for collection: ${collectionName}`);
    console.log(`Metadata to store:`, metadataWithRoot);
    
    console.log(`🔧 Calling storeTextMetadata function...`);
    const metadataResult = await storeTextMetadata(collectionName, metadataWithRoot);
    console.log(`📋 storeTextMetadata returned:`, metadataResult);
    
    if (!metadataResult) {
      console.error(`❌ Metadata storage failed for collection: ${collectionName}`);
      throw new Error('Failed to store metadata in Firebase');
    }
    
    console.log(`✅ Metadata uploaded successfully for collection: ${collectionName}`);
    
    console.log(`🎉 FIREBASE UPLOAD COMPLETED - Collection: ${collectionName}`);
    
    return {
      success: true,
      collectionName,
      rootNodeId,
      nodeCount: Object.keys(inquiryComplexData).length,
      metadata: metadataWithRoot
    };
  } catch (error) {
    console.error('❌ FIREBASE UPLOAD ERROR:', error);
    console.error('Error details:', error.message);
    console.error('Stack trace:', error.stack);
    throw new Error(`Failed to upload to Firebase: ${error.message}`);
  }
};

export const findRootNode = (inquiryComplexData) => {
  // First look for a text node with no parent (new structure)
  for (const [nodeId, nodeData] of Object.entries(inquiryComplexData)) {
    if (nodeData.node_type === 'text' && nodeData.parent_id === null) {
      return nodeId;
    }
  }
  
  // Fallback to question node with no parent (old structure)
  for (const [nodeId, nodeData] of Object.entries(inquiryComplexData)) {
    if (nodeData.node_type === 'question' && nodeData.parent_id === null) {
      return nodeId;
    }
  }
  
  const firstNode = Object.keys(inquiryComplexData)[0];
  console.warn('No root text or question node found, using first node as root:', firstNode);
  return firstNode;
};