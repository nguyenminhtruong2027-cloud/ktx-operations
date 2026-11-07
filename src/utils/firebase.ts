import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyACPyQ0dp3O0dTYi09QbCZ-D621200bubU',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'vanhanh-lantrai.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'vanhanh-lantrai',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'vanhanh-lantrai.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '758551913426',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:758551913426:web:45681c5b54e9fae1d79e0b',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-FEC2X8WLX9',
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  firebaseConfig.apiKey !== 'your_firebase_api_key'
);

export const app = isFirebaseConfigured
  ? (getApps().length === 0 ? initializeApp(firebaseConfig) : getApp())
  : null;

export const db = app ? getFirestore(app) : null;
export const auth = app ? getAuth(app) : null;
export const storage = app ? getStorage(app) : null;

export async function uploadTaskProofImage(dataUrl: string, storagePath: string): Promise<string> {
  if (!storage) return dataUrl;
  try {
    const storageRef = ref(storage, storagePath);
    await uploadString(storageRef, dataUrl, 'data_url');
    return await getDownloadURL(storageRef);
  } catch {
    return dataUrl;
  }
}

export async function pushToFirestore<T>(collectionName: string, docId: string, data: T): Promise<void> {
  if (!db) return;
  try {
    await setDoc(
      doc(db, collectionName, docId),
      {
        payload: data,
        updatedAt: Date.now(),
      },
      { merge: true }
    );
  } catch {
    // Fallback silently to localStorage when offline or rules restrict write
  }
}

export function subscribeFirestoreDoc<T>(
  collectionName: string,
  docId: string,
  onData: (data: T) => void
): () => void {
  if (!db) return () => {};
  try {
    return onSnapshot(
      doc(db, collectionName, docId),
      (snapshot) => {
        if (snapshot.exists()) {
          const raw = snapshot.data();
          if (raw && raw.payload !== undefined) {
            onData(raw.payload as T);
          }
        }
      },
      () => {
        // Ignore snapshot permission/offline errors
      }
    );
  } catch {
    return () => {};
  }
}

export { firebaseConfig };
