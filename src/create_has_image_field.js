// update-has-image.js - Script to mark documents that have images in storage
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore';
import { getStorage, ref, listAll } from 'firebase/storage';

// Using the Firebase configuration from your existing script
const firebaseConfig = {
  apiKey: "AIzaSyC0IRqSD5XoVPiC3yWE84By6fNF8rSM1eA",
  authDomain: "inquirycomplexbackend.firebaseapp.com",
  projectId: "inquirycomplexbackend",
  storageBucket: "inquirycomplexbackend.firebasestorage.app",
  messagingSenderId: "566694921536",
  appId: "1:566694921536:web:28989f87455f408cd966a5",
  measurementId: "G-T1CEV3YDQY"
};

console.log('Initializing Firebase...');
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
console.log('Firebase initialized successfully');

// Function to update documents with 'has_image' field
const updateDocumentsWithImages = async () => {
  console.log('Starting the process to update documents with images...');
  
  try {
    // List all files in the storage bucket
    console.log('Listing all files in storage...');
    const rootRef = ref(storage);
    const listResult = await listAll(rootRef);
    
    // Create a map to track collections and their subdirectories
    const collectionsMap = new Map();
    
    // Process all collection references
    for (const collectionRef of listResult.prefixes) {
      const collectionID = collectionRef.name;
      console.log(`Processing collection: ${collectionID}`);
      
      // List all document prefixes (UUIDs) in this collection
      const collectionListResult = await listAll(collectionRef);
      
      // Store the list of document IDs for this collection
      collectionsMap.set(collectionID, collectionListResult.prefixes.map(prefix => prefix.name));
      
      console.log(`Found ${collectionListResult.prefixes.length} document directories in ${collectionID}`);
    }
    
    // Process each collection and its documents
    let totalDocuments = 0;
    let updatedDocuments = 0;
    let notFoundDocuments = 0;
    
    for (const [collectionID, documentIDs] of collectionsMap.entries()) {
      console.log(`Updating documents in collection: ${collectionID} (${documentIDs.length} documents)`);
      
      // Process documents in batches to avoid timeout
      const BATCH_SIZE = 50;
      for (let i = 0; i < documentIDs.length; i += BATCH_SIZE) {
        const batch = documentIDs.slice(i, i + BATCH_SIZE);
        const updatePromises = [];
        
        for (const documentID of batch) {
          totalDocuments++;
          
          // Reference to the document
          const docRef = doc(db, collectionID, documentID);
          
          // Check if document exists
          try {
            const docSnapshot = await getDoc(docRef);
            
            if (docSnapshot.exists()) {
              // Update the document with has_image = true
              updatePromises.push(
                updateDoc(docRef, { has_image: true })
                  .then(() => {
                    updatedDocuments++;
                    if (updatedDocuments % 10 === 0) {
                      console.log(`Updated ${updatedDocuments} documents so far`);
                    }
                  })
                  .catch(err => {
                    console.error(`Error updating document ${collectionID}/${documentID}:`, err);
                  })
              );
            } else {
              notFoundDocuments++;
              console.warn(`Document ${collectionID}/${documentID} not found in Firestore.`);
            }
          } catch (error) {
            console.error(`Error checking document ${collectionID}/${documentID}:`, error);
          }
        }
        
        // Wait for all updates in this batch to complete
        await Promise.all(updatePromises);
        console.log(`Processed batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(documentIDs.length/BATCH_SIZE)}`);
        
        // Add a small delay between batches to prevent overwhelming Firestore
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.log('\nProcess completed!');
    console.log(`Total documents processed: ${totalDocuments}`);
    console.log(`Documents updated: ${updatedDocuments}`);
    console.log(`Documents not found: ${notFoundDocuments}`);
    
  } catch (error) {
    console.error('Error:', error);
    console.error('Error details:', {
      code: error.code,
      message: error.message
    });
  }
};

// Run the script
updateDocumentsWithImages().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});