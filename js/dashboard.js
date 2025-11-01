import { db, auth } from './firebase-config.js';
import { collection, query, where, getDocs, limit, orderBy } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

// --- Helper Functions ---
const formatCurrency = (num) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);

// Lấy ngày hôm nay dạng YYYY-MM-DD
const getTodayString = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
};

// Lấy ngày đầu và cuối tháng dạng YYYY-MM-DD
const getMonthRange = () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    // Ngày cuối tháng không cần thiết nếu ta dùng query >= startOfMonth
    return { startOfMonth };
};

// --- Logic Dashboard ---

// 1. Tải Dashboard cho User
const loadUserDashboard = async (userId) => {
    console.log("Loading User Dashboard");
    document.getElementById('user-dashboard').classList.remove('hidden');
    
    const salariesCol = collection(db, 'salaries');
    const today = getTodayString();
    const { startOfMonth } = getMonthRange();

    try {
        // Widget 1: Lương hôm nay
        const todayQuery = query(salariesCol, where('userId', '==', userId), where('date', '==', today));
        const todaySnap = await getDocs(todayQuery);
        let todayTotal = 0;
        todaySnap.forEach(doc => {
            todayTotal += doc.data().amount;
        });
        document.getElementById('today-salary').textContent = formatCurrency(todayTotal);

        // Widget 2: Lương tháng này
        const monthQuery = query(salariesCol, where('userId', '==', userId), where('date', '>=', startOfMonth));
        const monthSnap = await getDocs(monthQuery);
        let monthTotal = 0;
        monthSnap.forEach(doc => {
            monthTotal += doc.data().amount;
        });
        document.getElementById('month-salary').textContent = formatCurrency(monthTotal);

        // Widget 3: Thông báo mới nhất
        const annoucementQuery = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'), limit(1));
        const annoucementSnap = await getDocs(annoucementQuery);
        if (!annoucementSnap.empty) {
            const latest = annoucementSnap.docs[0].data();
            document.getElementById('latest-announcement-title').textContent = latest.title;
            document.getElementById('latest-announcement-content').textContent = latest.content.substring(0, 200) + '...'; // Rút gọn
        }

    } catch (error) {
        console.error("Lỗi tải user dashboard:", error);
    }
};

// 2. Tải Dashboard cho Admin
const loadAdminDashboard = async () => {
    console.log("Loading Admin Dashboard");
    document.getElementById('admin-dashboard').classList.remove('hidden');
    
    // (Đây là ví dụ, bạn cần query phức tạp hơn hoặc dùng Cloud Function để đếm)
    // Client-side query để đếm rất tốn kém và chậm.
    try {
        // Widget 1: Tổng CTV (Cần query cả collection)
        const usersSnap = await getDocs(collection(db, 'users'));
        document.getElementById('admin-total-users').textContent = usersSnap.size;

        // Widget 2 & 3: Lương (Tốn kém)
        const salariesSnap = await getDocs(collection(db, 'salaries'));
        let totalPaid = 0;
        let totalPending = 0;
        salariesSnap.forEach(doc => {
            const data = doc.data();
            if (data.status === 'đã thanh toán') totalPaid += data.amount;
            if (data.status === 'chờ xử lý') totalPending += data.amount;
        });
        document.getElementById('admin-total-paid').textContent = formatCurrency(totalPaid);
        document.getElementById('admin-total-pending').textContent = formatCurrency(totalPending);

    } catch (error) {
        console.error("Lỗi tải admin dashboard:", error);
    }
};


// --- Khởi chạy ---
// Lắng nghe event 'profileLoaded' từ main.js
document.addEventListener('profileLoaded', (e) => {
    const userProfile = e.detail;
    
    if (userProfile.role === 'admin') {
        loadAdminDashboard();
    } else {
        const userId = auth.currentUser.uid;
        loadUserDashboard(userId);
    }
});
