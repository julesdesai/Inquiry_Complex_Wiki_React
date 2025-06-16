// src/firebase.js

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, getDocs, updateDoc, collection, query, where, writeBatch, deleteField, addDoc, setDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, listAll } from 'firebase/storage';

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyC0IRqSD5XoVPiC3yWE84By6fNF8rSM1eA",
  authDomain: "inquirycomplexbackend.firebaseapp.com",
  projectId: "inquirycomplexbackend",
  storageBucket: "inquirycomplexbackend.firebasestorage.app",
  messagingSenderId: "566694921536",
  appId: "1:566694921536:web:28989f87455f408cd966a5",
  measurementId: "G-T1CEV3YDQY"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

// Firestore methods with dynamic collection
export const getNode = async (nodeId, collectionName = 'nodes') => {
  const docRef = doc(db, collectionName, nodeId);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() };
  } else {
    return null;
  }
};

// Get children of a node (directly connected nodes only)
export const getChildNodes = async (parentId, collectionName = 'nodes') => {
  console.log(`Fetching children of ${parentId} from ${collectionName}`);
  
  try {
    if (!db) throw new Error("Firestore not initialized");
    
    const q = query(collection(db, collectionName), where('parent_id', '==', parentId));
    const querySnapshot = await getDocs(q);
    const children = [];
    
    querySnapshot.forEach((doc) => {
      children.push({ id: doc.id, ...doc.data() });
    });
    
    console.log(`Found ${children.length} children for ${parentId}`);
    return children;
  } catch (error) {
    console.error(`Error fetching children of ${parentId} from ${collectionName}:`, error);
    throw error;
  }
};

// Get root nodes (nodes with no parent)
export const getRootNodes = async (collectionName = 'nodes') => {
  const q = query(collection(db, collectionName), where('parent_id', '==', null));
  const querySnapshot = await getDocs(q);
  const rootNodes = [];
  
  querySnapshot.forEach((doc) => {
    rootNodes.push({ id: doc.id, ...doc.data() });
  });
  
  return rootNodes;
};

// Storage methods
export const uploadImage = async (nodeId, file, collectionName = 'nodes') => {
  const fileName = `${Date.now()}-${file.name}`;
  const storageRef = ref(storage, `${collectionName}/${nodeId}/images/${fileName}`);
  
  try {
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    return { id: snapshot.ref.name, url: downloadURL, name: file.name };
  } catch (error) {
    console.error('Error uploading image:', error);
    throw error;
  }
};

export const getNodeImages = async (nodeId, collectionName = 'nodes') => {
  const listRef = ref(storage, `${collectionName}/${nodeId}/images`);
  
  try {
    const res = await listAll(listRef);
    const images = await Promise.all(
      res.items.map(async (itemRef) => {
        const url = await getDownloadURL(itemRef);
        return {
          id: itemRef.name,
          url,
          name: itemRef.name
        };
      })
    );
    return images;
  } catch (error) {
    console.error('Error fetching images:', error);
    return [];
  }
};

// Firestore data migration script
export const migrateJsonToFirestore = async (jsonData, collectionName = 'nodes') => {
  try {
    console.log(`🔥 FIREBASE: Starting migration to collection: ${collectionName}`);
    console.log(`📊 Data to migrate: ${Object.keys(jsonData).length} documents`);
    console.log(`🔗 Database instance:`, db ? 'Connected' : 'Not connected');
    
    if (!db) {
      throw new Error('Firebase database not initialized');
    }
    
    const batch = writeBatch(db);
    let docCount = 0;
    
    for (const [id, nodeData] of Object.entries(jsonData)) {
      console.log(`📋 Processing document ${docCount + 1}: ${id}`);
      console.log(`   Node type: ${nodeData.node_type}`);
      console.log(`   Summary: ${nodeData.summary?.substring(0, 50)}...`);
      
      const docRef = doc(db, collectionName, id);
      batch.set(docRef, nodeData);
      docCount++;
    }
    
    console.log(`🚀 Committing batch with ${docCount} documents to ${collectionName}`);
    console.log(`📍 Firebase project: ${db.app.options.projectId}`);
    
    await batch.commit();
    console.log(`✅ FIREBASE: Migration to ${collectionName} successful - ${docCount} documents uploaded`);
  } catch (error) {
    console.error(`❌ FIREBASE: Migration to ${collectionName} failed:`, error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    if (error.code === 'permission-denied') {
      console.error('🚫 Permission denied - check Firestore security rules');
    } else if (error.code === 'unavailable') {
      console.error('🌐 Firebase unavailable - check network connection');
    }
    
    throw error;
  }
};

/**
 * Updates a node's human rating
 * @param {string} nodeId - Node ID
 * @param {number} rating - Rating value (0-100)
 * @param {string} userId - User ID
 * @param {string} collectionName - Collection name
 * @returns {Promise<Object>} - The updated rating data
 */
export const updateHumanRating = async (nodeId, rating, userId = 'anonymous', collectionName = 'nodes') => {
  try {
    console.log(`Updating human rating for node ${nodeId} in collection ${collectionName}`);
    
    // Initialize Firestore if needed
    if (!db) throw new Error("Firestore not initialized");
    
    // Get a reference to the node document
    const nodeRef = doc(db, collectionName, nodeId);
    
    // Get the current node data
    const nodeSnap = await getDoc(nodeRef);
    
    if (!nodeSnap.exists()) {
      throw new Error(`Node ${nodeId} not found`);
    }
    
    const nodeData = nodeSnap.data();
    
    // Initialize humanRatings map if it doesn't exist
    const humanRatings = nodeData.humanRatings || {};
    
    // Add or update the user's rating
    humanRatings[userId] = {
      rating,
      timestamp: new Date().toISOString()
    };
    
    // Calculate the human average
    const ratings = Object.values(humanRatings).map(r => r.rating);
    const humanAverage = ratings.length > 0 
      ? Math.round(ratings.reduce((sum, r) => sum + r, 0) / ratings.length) 
      : 0;
    
    // Calculate the combined average (including AI if it exists)
    let combinedAverage = humanAverage;
    if (nodeData.aiRating !== undefined) {
      combinedAverage = Math.round((humanAverage * ratings.length + nodeData.aiRating) / (ratings.length + 1));
    }
    
    // Prepare the update data
    const updateData = {
      humanRatings,
      humanAverageRating: humanAverage,
      humanRatingCount: Object.keys(humanRatings).length,
      averageRating: combinedAverage,
      totalRatingCount: nodeData.aiRating !== undefined ? Object.keys(humanRatings).length + 1 : Object.keys(humanRatings).length,
      lastUpdated: new Date().toISOString()
    };
    
    // Update the document
    await updateDoc(nodeRef, updateData);
    
    return {
      averageRating: combinedAverage,
      humanAverageRating: humanAverage,
      humanRatingCount: Object.keys(humanRatings).length,
      totalRatingCount: updateData.totalRatingCount,
      aiRating: nodeData.aiRating
    };
  } catch (error) {
    console.error(`Error updating human rating for node ${nodeId}:`, error);
    throw error;
  }
};

/**
 * Updates a node's AI rating
 * @param {string} nodeId - Node ID
 * @param {number} rating - Rating value (0-100)
 * @param {string} collectionName - Collection name
 * @returns {Promise<Object>} - The updated rating data
 */
export const updateAIRating = async (nodeId, rating, collectionName = 'nodes') => {
  try {
    console.log(`Updating AI rating for node ${nodeId} in collection ${collectionName} to ${rating}`);
    
    // Initialize Firestore if needed
    if (!db) throw new Error("Firestore not initialized");
    
    // Get a reference to the node document
    const nodeRef = doc(db, collectionName, nodeId);
    
    // Get the current node data
    const nodeSnap = await getDoc(nodeRef);
    
    if (!nodeSnap.exists()) {
      throw new Error(`Node ${nodeId} not found`);
    }
    
    const nodeData = nodeSnap.data();
    
    // Calculate the human average
    const humanRatings = nodeData.humanRatings || {};
    const ratings = Object.values(humanRatings).map(r => r.rating);
    const humanAverage = ratings.length > 0 
      ? Math.round(ratings.reduce((sum, r) => sum + r, 0) / ratings.length) 
      : 0;
    
    // Calculate the combined average
    const combinedAverage = ratings.length > 0 
      ? Math.round((humanAverage * ratings.length + rating) / (ratings.length + 1)) 
      : rating;
    
    // Prepare the update data
    const updateData = {
      aiRating: rating,
      aiRatingTimestamp: new Date().toISOString(),
      averageRating: combinedAverage,
      totalRatingCount: Object.keys(humanRatings).length + 1,
      hasAiRating: true,
      lastUpdated: new Date().toISOString()
    };
    
    // Update the document
    await updateDoc(nodeRef, updateData);
    
    return {
      averageRating: combinedAverage,
      humanAverageRating: humanAverage,
      humanRatingCount: Object.keys(humanRatings).length,
      totalRatingCount: updateData.totalRatingCount,
      aiRating: rating
    };
  } catch (error) {
    console.error(`Error updating AI rating for node ${nodeId}:`, error);
    throw error;
  }
};

/**
 * Gets the AI rating for a node
 * @param {string} nodeId - Node ID
 * @param {string} collectionName - Collection name
 * @returns {Promise<{hasRating: boolean, rating: number|null}>} - Whether the node has an AI rating and the rating value
 */
export const getAIRating = async (nodeId, collectionName = 'nodes') => {
  try {
    if (!nodeId) {
      console.log('No nodeId provided to getAIRating');
      return { hasRating: false, rating: null };
    }
    
    console.log(`Checking AI rating for node: ${nodeId} in collection: ${collectionName}`);
    
    // Get the node data
    const nodeData = await getNode(nodeId, collectionName);
    
    if (!nodeData) {
      console.warn(`Node ${nodeId} not found in collection ${collectionName}`);
      return { hasRating: false, rating: null };
    }
    
    const hasRating = nodeData.aiRating !== undefined;
    
    console.log(`AI rating for node ${nodeId}: ${hasRating ? nodeData.aiRating : 'none'}`);
    
    return {
      hasRating,
      rating: hasRating ? nodeData.aiRating : null
    };
  } catch (error) {
    console.error(`Error checking AI rating for node ${nodeId}:`, error);
    return { hasRating: false, rating: null };
  }
};

/**
 * Gets the human rating for a specific user on a node
 * @param {string} nodeId - Node ID
 * @param {string} userId - User ID
 * @param {string} collectionName - Collection name
 * @returns {Promise<number|null>} - The user's rating or null if not found
 */
export const getUserRating = async (nodeId, userId, collectionName = 'nodes') => {
  try {
    // Get the node data
    const nodeData = await getNode(nodeId, collectionName);
    
    if (!nodeData || !nodeData.humanRatings || !nodeData.humanRatings[userId]) {
      return null;
    }
    
    return nodeData.humanRatings[userId].rating;
  } catch (error) {
    console.error(`Error getting user rating for node ${nodeId}:`, error);
    return null;
  }
};

/**
 * Migrates a node's ratings from any previous format to the new format
 * @param {string} nodeId - Node ID
 * @param {string} collectionName - Collection name
 * @returns {Promise<boolean>} - Whether the migration was successful
 */
export const migrateNodeRatings = async (nodeId, collectionName = 'nodes') => {
  try {
    console.log(`Migrating ratings for node ${nodeId} in collection ${collectionName}`);
    
    // Get a reference to the node document
    const nodeRef = doc(db, collectionName, nodeId);
    
    // Get the current node data
    const nodeSnap = await getDoc(nodeRef);
    
    if (!nodeSnap.exists()) {
      console.warn(`Node ${nodeId} not found, skipping migration`);
      return false;
    }
    
    const nodeData = nodeSnap.data();
    let needsMigration = false;
    let aiRating = null;
    
    // Initialize the new rating structure
    const humanRatings = {};
    
    // Check if we have the old array-based format
    if (Array.isArray(nodeData.ratings)) {
      needsMigration = true;
      console.log(`Node ${nodeId} has old array-based ratings format`);
      
      // Convert array ratings to the new structure
      nodeData.ratings.forEach(rating => {
        if (rating.userId === 'ai_rating_system') {
          aiRating = rating.rating;
        } else {
          humanRatings[rating.userId] = {
            rating: rating.rating,
            timestamp: rating.timestamp?.toDate?.() || new Date().toISOString()
          };
        }
      });
    }
    // Check if we have the old map-based format
    else if (nodeData.ratings && typeof nodeData.ratings === 'object') {
      needsMigration = true;
      console.log(`Node ${nodeId} has old map-based ratings format`);
      
      // Convert map ratings to the new structure
      Object.entries(nodeData.ratings).forEach(([userId, rating]) => {
        if (userId === 'ai_rating_system') {
          aiRating = rating;
        } else {
          humanRatings[userId] = {
            rating,
            timestamp: new Date().toISOString()
          };
        }
      });
    }
    
    // Skip if already using the new format or has no ratings
    if (!needsMigration) {
      console.log(`Node ${nodeId} already using the new format or has no ratings`);
      return false;
    }
    
    // Calculate the human average
    const ratings = Object.values(humanRatings).map(r => r.rating);
    const humanAverage = ratings.length > 0 
      ? Math.round(ratings.reduce((sum, r) => sum + r, 0) / ratings.length) 
      : 0;
    
    // Calculate the combined average
    let combinedAverage = humanAverage;
    if (aiRating !== null) {
      combinedAverage = ratings.length > 0 
        ? Math.round((humanAverage * ratings.length + aiRating) / (ratings.length + 1)) 
        : aiRating;
    }
    
    // Prepare the update data
    const updateData = {
      // Remove old ratings structures
      ratings: deleteField(),
      
      // Add new ratings structures
      humanRatings,
      humanAverageRating: humanAverage,
      humanRatingCount: Object.keys(humanRatings).length,
      averageRating: combinedAverage,
      totalRatingCount: aiRating !== null ? Object.keys(humanRatings).length + 1 : Object.keys(humanRatings).length,
      hasAiRating: aiRating !== null,
      lastUpdated: new Date().toISOString()
    };
    
    // Add AI rating if it exists
    if (aiRating !== null) {
      updateData.aiRating = aiRating;
      updateData.aiRatingTimestamp = new Date().toISOString();
    }
    
    // Update the document
    await updateDoc(nodeRef, updateData);
    
    console.log(`Successfully migrated ratings for node ${nodeId}`);
    return true;
  } catch (error) {
    console.error(`Error migrating ratings for node ${nodeId}:`, error);
    return false;
  }
};

/**
 * Migrates all nodes in a collection from old rating format to new rating format
 * @param {string} collectionName - Collection name
 * @returns {Promise<{total: number, migrated: number, failed: number}>} - Migration stats
 */
export const migrateAllNodeRatings = async (collectionName = 'nodes') => {
  try {
    console.log(`Migrating all node ratings in collection ${collectionName}`);
    
    // Get all documents in the collection
    const querySnapshot = await getDocs(collection(db, collectionName));
    
    const stats = {
      total: querySnapshot.size,
      migrated: 0,
      failed: 0
    };
    
    // Process each document in batches to avoid overwhelming Firebase
    const batchSize = 10;
    const batches = [];
    
    for (let i = 0; i < querySnapshot.docs.length; i += batchSize) {
      const batch = querySnapshot.docs.slice(i, i + batchSize);
      batches.push(batch);
    }
    
    // Process each batch sequentially
    for (const [index, batch] of batches.entries()) {
      console.log(`Processing batch ${index + 1}/${batches.length}`);
      
      // Process documents in the batch concurrently
      const results = await Promise.all(
        batch.map(async (docSnap) => {
          const success = await migrateNodeRatings(docSnap.id, collectionName);
          return { id: docSnap.id, success };
        })
      );
      
      // Update stats
      results.forEach(result => {
        if (result.success) {
          stats.migrated++;
        } else {
          stats.failed++;
        }
      });
    }
    
    console.log(`Migration complete: ${stats.migrated}/${stats.total} nodes migrated, ${stats.failed} failed`);
    return stats;
  } catch (error) {
    console.error(`Error migrating all node ratings:`, error);
    throw error;
  }
};

/**
 * Debugging helper to inspect a node's ratings
 * @param {string} nodeId - Node ID
 * @param {string} collectionName - Collection name
 */
export const debugNodeRatings = async (nodeId, collectionName = 'nodes') => {
  try {
    console.group(`%cDebugging node ratings for ${nodeId}`, 'color: blue; font-weight: bold');
    
    // Get the node data
    const nodeData = await getNode(nodeId, collectionName);
    
    if (!nodeData) {
      console.warn(`Node ${nodeId} not found`);
      console.groupEnd();
      return;
    }
    
    console.log('Node data:', nodeData);
    
    // Check for new rating format
    if (nodeData.humanRatings || nodeData.aiRating !== undefined) {
      console.log('Using new rating format');
      console.log('Human ratings:', nodeData.humanRatings || {});
      console.log('AI rating:', nodeData.aiRating);
      console.log('Human average:', nodeData.humanAverageRating);
      console.log('Combined average:', nodeData.averageRating);
      console.log('Human count:', nodeData.humanRatingCount);
      console.log('Total count:', nodeData.totalRatingCount);
    } 
    // Check for old ratings
    else if (nodeData.ratings) {
      console.log('Using old rating format');
      console.log('Ratings data:', nodeData.ratings);
      
      if (Array.isArray(nodeData.ratings)) {
        console.log('Ratings format: Array');
        
        // Check for AI rating
        const aiRating = nodeData.ratings.find(r => r.userId === 'ai_rating_system');
        console.log('AI rating:', aiRating);
        
        // Group ratings by userId
        const ratingsByUser = {};
        nodeData.ratings.forEach(r => {
          ratingsByUser[r.userId] = ratingsByUser[r.userId] || [];
          ratingsByUser[r.userId].push(r);
        });
        
        // Check for duplicate users
        const duplicateUsers = Object.entries(ratingsByUser)
          .filter(([_, ratings]) => ratings.length > 1)
          .map(([userId, ratings]) => ({
            userId,
            count: ratings.length,
            ratings: ratings.map(r => r.rating)
          }));
        
        if (duplicateUsers.length > 0) {
          console.warn('Found duplicate user ratings:', duplicateUsers);
        } else {
          console.log('No duplicate user ratings found');
        }
      } else {
        console.log('Ratings format: Object');
        console.log('AI rating:', nodeData.ratings['ai_rating_system']);
      }
    } else {
      console.log('No ratings found');
    }
    
    console.groupEnd();
  } catch (error) {
    console.error(`Error debugging node ratings:`, error);
    console.groupEnd();
  }
};

// Add global window functions for debugging in browser console
if (typeof window !== 'undefined') {
  window.debugNodeRatings = (nodeId, collectionName = 'nodes') => {
    debugNodeRatings(nodeId, collectionName).catch(console.error);
  };
  
  window.migrateNodeRatings = (nodeId, collectionName = 'nodes') => {
    migrateNodeRatings(nodeId, collectionName)
      .then(success => console.log(`Migration ${success ? 'successful' : 'not needed'}`))
      .catch(console.error);
  };
  
  window.migrateAllNodeRatings = (collectionName = 'nodes') => {
    migrateAllNodeRatings(collectionName)
      .then(stats => console.log('Migration stats:', stats))
      .catch(console.error);
  };
  
  console.log('Rating debugging and migration tools added to window object');
  
  window.testFirebaseConnection = async () => {
    try {
      console.log('🧪 Testing Firebase connection...');
      const testRef = doc(db, 'test', 'connection-test');
      await setDoc(testRef, {
        timestamp: new Date().toISOString(),
        message: 'Firebase connection test'
      });
      console.log('✅ Firebase connection test successful');
      return true;
    } catch (error) {
      console.error('❌ Firebase connection test failed:', error);
      return false;
    }
  };
  
  window.testMetadataStorage = async () => {
    try {
      console.log('🧪 Testing metadata storage...');
      const result = await storeTextMetadata('test-collection', {
        name: 'Test Text',
        author: 'Test Author',
        description: 'Test Description',
        rootNodeId: 'test-root-123',
        createdAt: new Date().toISOString(),
        nodeCount: 5,
        textLength: 1000
      });
      console.log('✅ Metadata storage test result:', result);
      return result;
    } catch (error) {
      console.error('❌ Metadata storage test failed:', error);
      return false;
    }
  };
}

// Text Metadata Management Functions

/**
 * Stores metadata for an uploaded text in Firebase
 * @param {string} collectionName - The collection name for the uploaded text
 * @param {Object} metadata - Metadata object containing name, author, description, etc.
 * @returns {Promise<boolean>} - Whether the operation was successful
 */
export const storeTextMetadata = async (collectionName, metadata) => {
  try {
    console.log(`🔥 FIREBASE: Storing metadata for collection: ${collectionName}`);
    console.log(`📋 Input metadata:`, metadata);
    
    const textMetadataRef = doc(db, 'textMetadata', collectionName);
    console.log(`📍 Firebase path: textMetadata/${collectionName}`);
    
    const metadataDoc = {
      collectionName,
      name: metadata.name || 'Untitled Text',
      author: metadata.author || null,
      description: metadata.description || null,
      rootNodeId: metadata.rootNodeId,
      createdAt: metadata.createdAt || new Date().toISOString(),
      nodeCount: metadata.nodeCount || 0,
      textLength: metadata.textLength || 0,
      isUserUploaded: true
    };
    
    console.log(`📄 Document to store:`, metadataDoc);
    
    await setDoc(textMetadataRef, metadataDoc);
    
    console.log(`✅ FIREBASE: Successfully stored metadata for ${collectionName}`);
    return true;
  } catch (error) {
    console.error(`❌ FIREBASE ERROR storing text metadata for ${collectionName}:`, error);
    console.error(`Error code:`, error.code);
    console.error(`Error message:`, error.message);
    return false;
  }
};

/**
 * Retrieves metadata for a specific uploaded text
 * @param {string} collectionName - The collection name
 * @returns {Promise<Object|null>} - The metadata object or null if not found
 */
export const getTextMetadata = async (collectionName) => {
  try {
    const textMetadataRef = doc(db, 'textMetadata', collectionName);
    const docSnap = await getDoc(textMetadataRef);
    
    if (docSnap.exists()) {
      return docSnap.data();
    } else {
      return null;
    }
  } catch (error) {
    console.error(`Error getting text metadata for ${collectionName}:`, error);
    return null;
  }
};

/**
 * Retrieves all uploaded text metadata
 * @returns {Promise<Array>} - Array of metadata objects
 */
export const getAllTextMetadata = async () => {
  try {
    console.log('Fetching all text metadata from Firebase');
    
    const textMetadataRef = collection(db, 'textMetadata');
    const q = query(textMetadataRef, where('isUserUploaded', '==', true));
    const querySnapshot = await getDocs(q);
    
    const metadataList = [];
    querySnapshot.forEach((doc) => {
      metadataList.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    console.log(`Found ${metadataList.length} uploaded texts`);
    return metadataList;
  } catch (error) {
    console.error('Error getting all text metadata:', error);
    return [];
  }
};

/**
 * Gets the root node ID for a collection from Firebase metadata
 * @param {string} collectionName - The collection name
 * @returns {Promise<string|null>} - The root node ID or null if not found
 */
export const getRootNodeFromMetadata = async (collectionName) => {
  try {
    const metadata = await getTextMetadata(collectionName);
    return metadata ? metadata.rootNodeId : null;
  } catch (error) {
    console.error(`Error getting root node for ${collectionName}:`, error);
    return null;
  }
};

/**
 * Checks if a collection name already exists
 * @param {string} collectionName - The collection name to check
 * @returns {Promise<boolean>} - Whether the collection exists
 */
export const collectionExists = async (collectionName) => {
  try {
    const metadata = await getTextMetadata(collectionName);
    return metadata !== null;
  } catch (error) {
    console.error(`Error checking if collection exists: ${collectionName}`, error);
    return false;
  }
};