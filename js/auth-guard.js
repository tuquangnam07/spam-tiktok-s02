import { auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";

// Đây là một IIFE (Immediately Invoked Function Expression) để kiểm tra auth ngay lập tức
(function() {
    onAuthStateChanged(auth, (user) => {
        if (!user) {
            // Nếu không có user VÀ chúng ta không ở trang login
            // (Mặc dù script này chỉ chạy ở /trangchu/, đây là check an toàn)
            console.log("Auth Guard: Không tìm thấy user. Đang chuyển hướng đến /login/");
            window.location.href = '/login/';
        } else {
            // User đã đăng nhập.
            // Ngăn chặn FOUC (Flash of Unstyled Content) bằng cách hiển thị body
            document.body.style.display = 'block'; 
        }
    });

    // Ẩn body mặc định để chờ check auth, tránh FOUC
    // Thêm 'display: none' vào body bằng inline style hoặc CSS
    // Ví dụ: <body style="display: none;">
    // auth-guard sẽ set 'display: block' khi xác thực thành công.
    // Cách làm đơn giản hơn là giả định đã login và redirect nếu sai.
})();
