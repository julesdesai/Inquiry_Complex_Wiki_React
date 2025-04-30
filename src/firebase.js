// src/firebase.js

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, getDocs, updateDoc, collection, query, where, writeBatch, arrayUnion } from 'firebase/firestore';
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
  const batch = writeBatch(db);
  
  for (const [id, nodeData] of Object.entries(jsonData)) {
    const docRef = doc(db, collectionName, id);
    batch.set(docRef, nodeData);
  }
  
  try {
    await batch.commit();
    console.log(`Migration to ${collectionName} successful`);
  } catch (error) {
    console.error('Migration failed:', error);
  }
};

/**
 * Updates a node's rating by adding a new user rating to the ratings array
 * and recalculating the average rating
 * 
 * @param {string} nodeId - The ID of the node to update
 * @param {number} rating - The rating value (0-100)
 * @param {string} userId - The ID of the user submitting the rating
 * @param {string} collectionName - The collection name (dynamically set based on the selected graph)
 * @returns {Promise<{averageRating: number, totalRatings: number}>} - The updated average rating and total count
 */
export const updateNodeRating = async (nodeId, rating, userId = 'anonymous', collectionName) => {
  try {
    console.log(`Updating rating for node ${nodeId} in collection ${collectionName} to ${rating}`);
    const docRef = doc(db, collectionName, nodeId);
    
    // First, get the current document to check if ratings exist
    const docSnap = await getDoc(docRef);
    const docData = docSnap.data();
    
    // Initialize our ratings structure if it doesn't exist
    let ratings = docData.ratings || [];
    let userRatingIndex = ratings.findIndex(r => r.userId === userId);
    
    // If user has already rated, update their rating, otherwise add new rating
    if (userRatingIndex >= 0) {
      // Create a new array with the updated rating
      const newRatings = [...ratings];
      newRatings[userRatingIndex] = { userId, rating, timestamp: new Date() };
      
      // Update the document with the new ratings array
      await updateDoc(docRef, {
        ratings: newRatings,
        averageRating: calculateAverageRating(newRatings),
        totalRatings: newRatings.length
      });
    } else {
      // Add new rating to the array
      const newRating = { userId, rating, timestamp: new Date() };
      const newRatings = [...ratings, newRating];
      
      // Update the document with the new ratings array
      await updateDoc(docRef, {
        ratings: arrayUnion(newRating),
        averageRating: calculateAverageRating(newRatings),
        totalRatings: newRatings.length
      });
    }
    
    // Calculate the new average
    const updatedDocSnap = await getDoc(docRef);
    const updatedData = updatedDocSnap.data();
    
    return {
      averageRating: updatedData.averageRating,
      totalRatings: updatedData.totalRatings
    };
  } catch (error) {
    console.error(`Error updating node rating in collection ${collectionName}:`, error);
    throw error;
  }
};

/**
 * Calculates the average rating from an array of ratings
 * @param {Array} ratings - Array of rating objects with rating property
 * @returns {number} - The average rating rounded to 1 decimal place
 */
function calculateAverageRating(ratings) {
  if (!ratings || ratings.length === 0) return 0;
  
  const sum = ratings.reduce((total, ratingObj) => total + ratingObj.rating, 0);
  return Math.round((sum / ratings.length) * 10) / 10; // Round to 1 decimal
}