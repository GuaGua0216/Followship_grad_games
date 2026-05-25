// 1. 引入 Firebase 核心與 Firestore 資料庫模組
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, initializeFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBSzV-WpCBGzcNwOl0c3R6qYVeeiGRZAb8",
  authDomain: "followship-grad-game.firebaseapp.com",
  projectId: "followship-grad-game",
  storageBucket: "followship-grad-game.firebasestorage.app",
  messagingSenderId: "178560247798",
  appId: "1:178560247798:web:0941338c678cd33ea809d7",
  measurementId: "G-0FYZNYEFKF"
};

// 3. 初始化 Firebase
// 這裡加了一個 !getApps().length 的判斷：
// 這是為了避免 Next.js 在開發時「存檔熱重載」導致不斷重複初始化而發生錯誤
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// 4. 初始化我們需要的 Firestore 資料庫，並將它匯出 (export)
// experimentalAutoDetectLongPolling can make Firestore more reliable in
// browsers/networks that block the default streaming transport.
export const db = (() => {
  try {
    return initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true,
    });
  } catch {
    return getFirestore(app);
  }
})();
