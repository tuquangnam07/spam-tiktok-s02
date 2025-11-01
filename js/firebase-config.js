// HƯỚND DẪN: KHÔNG CHỈNH SỬA FILE NÀY.
// Các giá trị "YOUR_..." sẽ tự động được thay thế bằng
// biến môi trường (Environment Variables) khi triển khai trên Cloudflare Pages.
// Khi chạy ở local, bạn có thể tạm thời thay thế chúng để test.

const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_FIREBASE_AUTH_DOMAIN",
  projectId: "YOUR_FIREBASE_PROJECT_ID",
  storageBucket: "YOUR_FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "YOUR_FIREBASE_MESSAGING_SENDER_ID",
  appId: "YOUR_FIREBASE_APP_ID"
};

// Import SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { getFirestore, serverTimestamp, Timestamp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

// Khởi tạo Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Export các dịch vụ để các file khác sử dụng
export { app, auth, db, serverTimestamp, Timestamp };
