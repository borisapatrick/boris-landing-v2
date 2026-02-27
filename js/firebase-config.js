// Firebase Configuration for Boris Enterprises
// Uses Firebase compat SDK (loaded via CDN script tags in HTML)

const firebaseConfig = {
  apiKey: "AIzaSyAnxm5FSWOMDRSUrV4EhqYTahGggEmf7aE",
  authDomain: "borisenterprises.com",
  projectId: "boris-enterprises",
  storageBucket: "boris-enterprises.firebasestorage.app",
  messagingSenderId: "783560275501",
  appId: "1:783560275501:web:5606c3191f3bf5205caaa4",
  measurementId: "G-HHCXX0J3C8"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Expose auth and Firestore references globally
const auth = firebase.auth();
const db = firebase.firestore();
