import { db, auth } from './firebase-config.js';
import { collection, query, where, orderBy, limit, startAfter, onSnapshot, getDocs } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import { showToast } from './main.js'; // Import hàm helper

const tableBody = document.getElementById('salary-table-body');
const loadMoreBtn = document.getElementById('load-more-btn');

let currentUserId = null;
let lastVisibleDoc = null; // Dùng cho pagination "Tải thêm"
let unsubscribeSalaryListener = null; // Để ngắt kết nối real-time
let initialLoad = true; // Cờ để xử lý tải lần đầu

// --- Helper Functions ---
const formatCurrency = (num) => new Intl.NumberFormat('vi-VN').format(num);

const getStatusClass = (status) => {
    switch (status) {
        case 'chờ xử lý': return 'status-pending';
        case 'đã thanh toán': return 'status-paid';
        case 'đã hủy bỏ': return 'status-cancelled';
        default: return '';
    }
};

// Hàm render 1 hàng
const renderSalaryRow = (doc) => {
    const data = doc.data();
    const tr = document.createElement('tr');
    tr.dataset.docId = doc.id; // Quan trọng cho real-time update
    
    tr.innerHTML = `
        <td>${data.date}</td>
        <td>${formatCurrency(data.amount)}</td>
        <td>
            <span class="status-badge ${getStatusClass(data.status)}">
                ${data.status}
            </span>
        </td>
        <td>${data.method}</td>
    `;
    return tr;
};

// Hàm xử lý thay đổi real-time
const handleSalarySnapshot = (snapshot) => {
    if (initialLoad) {
        tableBody.innerHTML = ''; // Xóa "Đang tải..." chỉ ở lần đầu
        initialLoad = false;
    }
    
    snapshot.docChanges().forEach((change) => {
        const doc = change.doc;
        const existingRow = tableBody.querySelector(`[data-doc-id="${doc.id}"]`);
        
        if (change.type === 'added') {
            const newRow = renderSalaryRow(doc);
            tableBody.prepend(newRow); // Thêm lên đầu (vì sắp xếp desc)
        }
        if (change.type === 'modified') {
            if (existingRow) {
                // Cập nhật hàng cũ
                const updatedRow = renderSalaryRow(doc);
                existingRow.replaceWith(updatedRow);
            }
        }
        if (change.type === 'removed') {
            if (existingRow) {
                existingRow.remove();
            }
        }
    });

    // Cập nhật con trỏ cho pagination "Tải thêm"
    if (!snapshot.empty) {
        lastVisibleDoc = snapshot.docs[snapshot.docs.length - 1];
    }
    
    if (snapshot.docs.length < 20) {
        loadMoreBtn.classList.add('hidden'); // Ẩn nút nếu đã hết
    } else {
        loadMoreBtn.classList.remove('hidden');
    }

    if (tableBody.innerHTML === '') {
        tableBody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Không có dữ liệu lương.</td></tr>';
    }
};

// 1. Lắng nghe 20 mục lương MỚI NHẤT (real-time)
const listenForLatestSalaries = (userId) => {
    if (unsubscribeSalaryListener) {
        unsubscribeSalaryListener(); // Hủy listener cũ
    }
    
    const q = query(
        collection(db, 'salaries'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'), // Sắp xếp theo ngày tạo
        limit(20)
    );
    
    initialLoad = true; // Reset cờ
    tableBody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Đang tải dữ liệu...</td></tr>';
    
    unsubscribeSalaryListener = onSnapshot(q, handleSalarySnapshot, (error) => {
        console.error("Lỗi real-time salary:", error);
        showToast("Lỗi kết nối real-time. Vui lòng F5.", true);
    });
};

// 2. Xử lý "Tải thêm" (Không real-time)
const loadMoreSalaries = async () => {
    if (!lastVisibleDoc || !currentUserId) {
        loadMoreBtn.classList.add('hidden');
        return;
    }
    
    loadMoreBtn.disabled = true;
    loadMoreBtn.textContent = 'Đang tải...';

    try {
        const q = query(
            collection(db, 'salaries'),
            where('userId', '==', currentUserId),
            orderBy('createdAt', 'desc'),
            startAfter(lastVisibleDoc), // Bắt đầu từ sau doc cuối cùng
            limit(20)
        );
        
        const docSnap = await getDocs(q);
        
        if (docSnap.empty) {
            showToast("Đã tải tất cả dữ liệu.");
            loadMoreBtn.classList.add('hidden');
            return;
        }

        docSnap.forEach(doc => {
            const row = renderSalaryRow(doc);
            tableBody.append(row); // Nối vào cuối bảng
        });
        
        lastVisibleDoc = docSnap.docs[docSnap.docs.length - 1]; // Cập nhật con trỏ
        
        if (docSnap.docs.length < 20) {
            loadMoreBtn.classList.add('hidden'); // Hết dữ liệu
        }

    } catch (error) {
        console.error("Lỗi tải thêm:", error);
        showToast("Lỗi khi tải thêm dữ liệu.", true);
    } finally {
        loadMoreBtn.disabled = false;
        loadMoreBtn.textContent = 'Tải thêm';
    }
};

// --- Khởi chạy ---
document.addEventListener('DOMContentLoaded', () => {
    currentUserId = auth.currentUser?.uid;
    if (currentUserId) {
        listenForLatestSalaries(currentUserId);
        loadMoreBtn.addEventListener('click', loadMoreSalaries);
    } else {
        // Chờ auth-guard xử lý, nhưng nếu lỗi...
        console.error("Không tìm thấy User ID!");
        tableBody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Lỗi xác thực.</td></tr>';
    }
});
