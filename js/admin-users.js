import { app, auth, db, serverTimestamp } from './firebase-config.js';
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc, query, orderBy, limit, startAfter, getCountFromServer } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { showToast, showLoader, hideLoader, showButtonSpinner, hideButtonSpinner } from './main.js';

// DOM Elements
const usersTableBody = document.getElementById('users-table-body');
const addUserBtn = document.getElementById('add-user-btn');
const exportUsersBtn = document.getElementById('export-users-btn');
const adminModal = document.getElementById('admin-modal');
const closeModalBtn = document.getElementById('close-admin-modal');
const modalTitle = document.getElementById('admin-modal-title');
const userForm = document.getElementById('admin-user-form');
const submitBtn = document.getElementById('admin-user-submit-btn');

let currentEditUserId = null; // Cờ để biết đang Thêm hay Sửa
let adminCredentials = null; // Lưu trữ thông tin đăng nhập của admin (RỦI RO - Cần Cloud Function)

// --- Logic Tạo User (Workaround cho Client-side) ---
/**
 * LƯU Ý BẢO MẬT:
 * Việc Admin tạo user mới bằng (createUserWithEmailAndPassword) ở client-side
 * là một RỦI RO BẢO MẬT và UX RẤT TỆ.
 * Nó đòi hỏi phải đăng xuất admin và đăng nhập lại.
 * * GIẢI PHÁP TỐT NHẤT: Dùng Cloud Function với Admin SDK.
 * * GIẢI PHÁP "TẠM CHẤP NHẬN" (Đang dùng): Khởi tạo một app Firebase PHỤ
 * chỉ để tạo user, sau đó hủy app đó đi. Cách này TRÁNH việc đăng xuất admin.
 */
const createAuthUserClientSide = async (email, password) => {
    // Lấy config từ app chính (đã được load từ firebase-config.js)
    const config = app.options;
    const tempAppName = `temp-user-creation-${Date.now()}`;
    const tempApp = initializeApp(config, tempAppName);
    const tempAuth = getAuth(tempApp);
    
    try {
        const userCredential = await createUserWithEmailAndPassword(tempAuth, email, password);
        const newUserUid = userCredential.user.uid;
        
        // Hủy app phụ ngay lập tức
        await deleteApp(tempApp);
        
        return newUserUid;
    } catch (error) {
        // Hủy app phụ nếu có lỗi
        await deleteApp(tempApp);
        throw error; // Ném lỗi ra ngoài để handleAddUser xử lý
    }
};

// --- CRUD & Pagination ---

// 1. Tải danh sách User (Đơn giản, chưa có pagination)
const loadUsers = async () => {
    showLoader();
    try {
        const q = query(collection(db, 'users'), orderBy('profile.hoTen'), limit(20));
        const snapshot = await getDocs(q);
        
        usersTableBody.innerHTML = '';
        if (snapshot.empty) {
            usersTableBody.innerHTML = '<tr><td colspan="5">Không có CTV nào.</td></tr>';
        }
        
        snapshot.forEach(doc => {
            const user = doc.data();
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${user.profile.hoTen}</td>
                <td>${user.email}</td>
                <td>${user.profile.idTele}</td>
                <td><span class="status-badge ${user.role === 'admin' ? 'status-cancelled' : 'status-secondary'}">${user.role}</span></td>
                <td>
                    <button class="btn btn-sm" data-id="${doc.id}">Sửa</button>
                    <button class="btn btn-sm btn-danger" data-id="${doc.id}">Ban</button>
                </td>
            `;
            // Thêm sự kiện cho nút Sửa/Ban
            tr.querySelector('.btn-sm').addEventListener('click', () => openEditModal(doc));
            tr.querySelector('.btn-danger').addEventListener('click', () => handleBanUser(doc.id, user.profile.hoTen));
            
            usersTableBody.appendChild(tr);
        });
        
    } catch (error) {
        console.error("Lỗi tải danh sách user:", error);
        showToast("Lỗi tải danh sách CTV.", true);
    } finally {
        hideLoader();
    }
};

// 2. Mở Modal (Thêm / Sửa)
const openAddModal = () => {
    currentEditUserId = null; // Đang ở chế độ Thêm
    userForm.reset();
    modalTitle.textContent = "Thêm Thành viên mới";
    document.getElementById('admin-user-email').disabled = false;
    document.getElementById('admin-user-password').required = true;
    adminModal.classList.remove('hidden');
};

const openEditModal = (userDoc) => {
    currentEditUserId = userDoc.id; // Đang ở chế độ Sửa
    const user = userDoc.data();
    
    userForm.reset();
    modalTitle.textContent = `Sửa thông tin: ${user.profile.hoTen}`;
    
    // Đổ dữ liệu
    document.getElementById('admin-user-id').value = userDoc.id;
    document.getElementById('admin-user-email').value = user.email;
    document.getElementById('admin-user-email').disabled = true; // Không cho sửa email
    document.getElementById('admin-user-password').required = false; // Mật khẩu không bắt buộc khi sửa
    document.getElementById('admin-user-role').value = user.role;
    document.getElementById('admin-profile-hoTen').value = user.profile.hoTen;
    // ... (Đổ dữ liệu các trường profile khác) ...
    
    adminModal.classList.remove('hidden');
};

const closeModal = () => {
    adminModal.classList.add('hidden');
};

// 3. Xử lý Submit Form (Thêm hoặc Sửa)
const handleUserSubmit = async (e) => {
    e.preventDefault();
    showButtonSpinner(submitBtn);
    
    // Lấy dữ liệu từ form
    const email = document.getElementById('admin-user-email').value;
    const password = document.getElementById('admin-user-password').value;
    const role = document.getElementById('admin-user-role').value;
    const hoTen = document.getElementById('admin-profile-hoTen').value;
    // ... (Lấy các trường profile khác) ...

    const profileData = {
        hoTen: hoTen,
        // ... (các trường profile khác)
        idTele: document.getElementById('admin-profile-idTele')?.value || '', // Giả sử có trường này
        sdt: '', stk: '', tenChuTK: '', nganHang: '' // Bổ sung
    };

    try {
        if (currentEditUserId) {
            // --- Chế độ SỬA ---
            const userRef = doc(db, 'users', currentEditUserId);
            await updateDoc(userRef, {
                role: role,
                profile: profileData
            });
            // (Lưu ý: Đổi mật khẩu client-side cho user khác là KHÔNG THỂ. Cần Cloud Function)
            if (password) {
                showToast("Cập nhật thông tin thành công. (Không thể đổi mật khẩu từ đây)", true);
            } else {
                showToast("Cập nhật thành công!");
            }
            
        } else {
            // --- Chế độ THÊM ---
            if (!password) {
                throw new Error("Mật khẩu là bắt buộc khi thêm mới");
            }
            // Bước 1: Tạo user trong Auth (dùng app phụ)
            const newUid = await createAuthUserClientSide(email, password);
            
            // Bước 2: Tạo user trong Firestore
            const userRef = doc(db, 'users', newUid);
            await setDoc(userRef, {
                email: email,
                role: role,
                profile: profileData,
                createdAt: serverTimestamp() // Thêm dấu thời gian
            });
            
            showToast("Thêm thành viên mới thành công!");
        }
        
        closeModal();
        await loadUsers(); // Tải lại danh sách
        
    } catch (error) {
        console.error("Lỗi Thêm/Sửa user:", error);
        let msg = "Thao tác thất bại.";
        if (error.code === 'auth/email-already-in-use') msg = "Email này đã tồn tại.";
        if (error.code === 'auth/weak-password') msg = "Mật khẩu quá yếu (cần ít nhất 6 ký tự).";
        showToast(msg, true);
    } finally {
        hideButtonSpinner(submitBtn);
    }
};

// 4. Xử lý Ban User (Không thể Xóa Auth)
const handleBanUser = async (userId, name) => {
    if (!confirm(`Bạn có chắc muốn "Ban" tài khoản: ${name}? \n(Họ sẽ không thể đăng nhập. Dùng Cloud Function để xóa hoàn toàn)`)) {
        return;
    }
    
    // Client-side, chúng ta chỉ có thể "ban" bằng cách cập nhật Firestore
    // (Cần Security Rules hoặc Cloud Function để thực thi việc cấm đăng nhập)
    // Tạm thời, ta chỉ xóa họ khỏi collection 'users' (rất nguy hiểm)
    // -> An toàn hơn: Cập nhật một trường 'status'
    
    showLoader();
    try {
        // Cập nhật document
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
            role: 'banned', // Ví dụ
            status: 'banned'
        });
        
        // (Để "disable" tài khoản Auth, BẮT BUỘC dùng Admin SDK trong Cloud Function)
        
        showToast(`Đã ban tài khoản ${name}.`);
        await loadUsers(); // Tải lại
        
    } catch (error) {
        console.error("Lỗi ban user:", error);
        showToast("Lỗi: Không thể thực hiện thao tác.", true);
    } finally {
        hideLoader();
    }
};

// 5. Xuất Excel
const handleExportUsers = async () => {
    if (!window.XLSX) {
        showToast("Lỗi thư viện SheetJS.", true);
        return;
    }
    
    showLoader();
    try {
        const q = query(collection(db, 'users'), orderBy('profile.hoTen'));
        const snapshot = await getDocs(q);
        
        const dataToExport = [];
        snapshot.forEach(doc => {
            const user = doc.data();
            dataToExport.push({
                "Họ Tên": user.profile.hoTen,
                "Email": user.email,
                "ID Tele": user.profile.idTele,
                "Vai trò": user.role,
                "STK": user.profile.stk,
                "Chủ TK": user.profile.tenChuTK,
                "Ngân Hàng": user.profile.nganHang
            });
        });

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "DanhSachCTV");
        XLSX.writeFile(wb, "DanhSachCTV_SPAMTIKTOK.xlsx");
        
    } catch (error) {
        console.error("Lỗi xuất Excel:", error);
        showToast("Xuất Excel thất bại.", true);
    } finally {
        hideLoader();
    }
};


// --- Gắn sự kiện (Chỉ chạy khi tab 'users' được active) ---
// (Cách làm đơn giản: Gắn luôn khi DOM load)
document.addEventListener('DOMContentLoaded', () => {
    // Chỉ chạy nếu chúng ta ở trang admin
    if (!usersTableBody) return;
    
    loadUsers(); // Tải lần đầu
    
    addUserBtn.addEventListener('click', openAddModal);
    closeModalBtn.addEventListener('click', closeModal);
    userForm.addEventListener('submit', handleUserSubmit);
    exportUsersBtn.addEventListener('click', handleExportUsers);

    adminModal.addEventListener('click', (e) => {
        if (e.target === adminModal) closeModal();
    });
});
