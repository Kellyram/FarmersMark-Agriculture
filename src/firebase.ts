import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyALYTlhYEwXBKphjybKlrvco6DvxP1J6e0",
  authDomain: "farmersmark-agriculture.firebaseapp.com",
  projectId: "farmersmark-agriculture",
  storageBucket: "farmersmark-agriculture.firebasestorage.app",
  messagingSenderId: "1030666165439",
  appId: "1:1030666165439:web:71ee0b0b44d7ce22c77a0a"
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(firebaseApp);
