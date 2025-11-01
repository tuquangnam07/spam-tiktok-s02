import { auth } from '../js/firebase-config.js';
import { signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";

const loginForm = document.getElementById('login-form');
const loginButton = document.getElementById('login-button');
const btnText = loginButton.querySelector('.btn-text');
const spinner = loginButton.querySelector('.spinner');

// Hàm hiển thị Toast
const showToast = (message, isError = false) => {
    Toastify({
        text: message,
        duration: 3000,
        close: true,
        gravity: "top",
        position: "right",
        style: {
            background: isError ? "linear-gradient(to right, #e74c3c, #c0392b)" : "linear-gradient(to right, #00b09b, #96c93d)",
        },
    }).showToast();
};

// 1. Xử lý đăng nhập
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    // Hiển thị loading, vô hiệu hóa nút
    loginButton.disabled = true;
    btnText.classList.add('hidden');
    spinner.classList.remove('hidden');

    try {
        await signInWithEmailAndPassword(auth, email, password);
        // Đăng nhập thành công, onAuthStateChanged sẽ xử lý chuyển hướng
        showToast("Đăng nhập thành công! Đang chuyển hướng...");
        // (Không cần chuyển hướng ở đây, onAuthStateChanged sẽ làm)
    } catch (error) {
        // Xử lý lỗi
        console.error("Lỗi Đăng nhập:", error.code);
        let errorMessage = "Đăng nhập thất bại. Vui lòng thử lại.";
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            errorMessage = "Sai email hoặc mật khẩu.";
        }
        showToast(errorMessage, true);
        
        // Trả lại trạng thái nút
        loginButton.disabled = false;
        btnText.classList.remove('hidden');
        spinner.classList.add('hidden');
    }
});

// 2. Auth Guard: Kiểm tra nếu user đã đăng nhập, chuyển hướng họ vào /trangchu/
onAuthStateChanged(auth, (user) => {
    if (user) {
        // User đã đăng nhập
        console.log("User đã đăng nhập, chuyển hướng tới /trangchu/");
        window.location.href = '/trangchu/';
    } else {
        // User chưa đăng nhập, ở lại trang login
        console.log("User chưa đăng nhập.");
    }
});
