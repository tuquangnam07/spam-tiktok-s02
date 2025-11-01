// Import các hàm và dịch vụ cần thiết
import { auth, db } from './firebase-config.js';
import { signOut } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { doc, getDoc, updateDoc, collection, query, orderBy, limit, onSnapshot } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

// --- Biến toàn cục (Cache DOM) ---
const loader = document.getElementById('loader-overlay');
const profileName = document.getElementById('profile-name');
const adminNav = document.getElementById('admin-nav');
const notificationDot = document.getElementById('notification-dot');
const profileDropdown = document.getElementById('profile-dropdown');
const profileMenu = document.getElementById('profile-menu');
const logoutButton = document.getElementById('logout-button');
const profileModalTrigger = document.getElementById('profile-modal-trigger');
const profileModal = document.getElementById('profile-modal');
const closeProfileModal = document.getElementById('close-profile-modal');
const profileUpdateForm = document.getElementById('profile-update-form');
const profileUpdateButton = document.getElementById('profile-update-button');
const welcomeMessage = document.getElementById('welcome-message'); // Cho dashboard

// Biến lưu trữ thông tin user
let currentUserProfile = null;

// --- Helper Functions ---

// Hiển thị Toast (Yêu cầu Toastify.js)
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

// Hiển thị/Ẩn Loader toàn trang
const showLoader = () => loader.classList.remove('hidden');
const hideLoader = () => loader.classList.add('hidden');

// Hiển thị/Ẩn Spinner trên nút
const showButtonSpinner = (button) => {
    button.disabled = true;
    button.querySelector('.btn-text').classList.add('hidden');
    button.querySelector('.spinner').classList.remove('hidden');
};
const hideButtonSpinner = (button) => {
    button.disabled = false;
    button.querySelector('.btn-text').classList.remove('hidden');
    button.querySelector('.spinner').classList.add('hidden');
};

// --- Logic Chính ---

// 1. Lấy và hiển thị thông tin Profile User
const fetchUserProfile = async () => {
    try {
        const user = auth.currentUser;
        if (!user) throw new Error("Không tìm thấy user");

        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
            currentUserProfile = userDocSnap.data();
            
            // Cập nhật UI
            profileName.textContent = currentUserProfile.profile.hoTen || "Chưa cập nhật";
            if (welcomeMessage) {
                welcomeMessage.textContent = `Chào mừng, ${currentUserProfile.profile.hoTen || "bạn"}!`;
            }

            // Hiển thị menu Admin nếu là admin
            if (currentUserProfile.role === 'admin') {
                adminNav.classList.remove('hidden');
            }

            // Tạo event để báo cho các script khác (dashboard.js) là profile đã sẵn sàng
            const event = new CustomEvent('profileLoaded', { detail: currentUserProfile });
            document.dispatchEvent(event);

        } else {
            // Trường hợp user có trong Auth nhưng không có trong Firestore
            showToast("Lỗi: Không tìm thấy hồ sơ người dùng.", true);
            await handleLogout(); // Đăng xuất bắt buộc
        }
    } catch (error) {
        console.error("Lỗi lấy thông tin user:", error);
        showToast("Có lỗi xảy ra khi tải dữ liệu. Vui lòng F5.", true);
    }
};

// 2. Xử lý Đăng xuất
const handleLogout = async () => {
    showLoader();
    try {
        await signOut(auth);
        showToast("Đăng xuất thành công!");
        window.location.href = '/login/';
    } catch (error) {
        console.error("Lỗi đăng xuất:", error);
        showToast("Đăng xuất thất bại.", true);
        hideLoader();
    }
};

// 3. Xử lý Menu Profile (Dropdown)
profileDropdown.addEventListener('click', (e) => {
    // Ngăn chặn event click lan ra 'document' ngay lập tức
    e.stopPropagation();
    profileMenu.classList.toggle('hidden');
});
// Ẩn menu nếu click ra ngoài
document.addEventListener('click', (e) => {
    if (!profileDropdown.contains(e.target)) {
        profileMenu.classList.add('hidden');
    }
});

// 4. Xử lý Modal Hồ Sơ (Profile)
const openProfileModal = () => {
    if (!currentUserProfile) return;
    
    // Đổ dữ liệu vào form
    document.getElementById('profile-email').value = currentUserProfile.email;
    document.getElementById('profile-hoTen').value = currentUserProfile.profile.hoTen || '';
    document.getElementById('profile-sdt').value = currentUserProfile.profile.sdt || '';
    document.getElementById('profile-idTele').value = currentUserProfile.profile.idTele || '';
    document.getElementById('profile-stk').value = currentUserProfile.profile.stk || '';
    document.getElementById('profile-tenChuTK').value = currentUserProfile.profile.tenChuTK || '';
    document.getElementById('profile-nganHang').value = currentUserProfile.profile.nganHang || '';
    
    profileModal.classList.remove('hidden');
};

const closeProfileModalFunc = () => {
    profileModal.classList.add('hidden');
};

// 5. Xử lý Cập nhật Profile
const handleProfileUpdate = async (e) => {
    e.preventDefault();
    showButtonSpinner(profileUpdateButton);

    try {
        const updatedProfile = {
            hoTen: document.getElementById('profile-hoTen').value,
            sdt: document.getElementById('profile-sdt').value,
            idTele: document.getElementById('profile-idTele').value,
            stk: document.getElementById('profile-stk').value,
            tenChuTK: document.getElementById('profile-tenChuTK').value,
            nganHang: document.getElementById('profile-nganHang').value,
        };

        const userDocRef = doc(db, 'users', auth.currentUser.uid);
        
        // Chỉ cập nhật trường 'profile' theo đúng Security Rules
        await updateDoc(userDocRef, {
            profile: updatedProfile
        });

        showToast("Cập nhật hồ sơ thành công!");
        closeProfileModalFunc();
        // Tải lại thông tin user để cập nhật UI
        await fetchUserProfile(); 

    } catch (error) {
        console.error("Lỗi cập nhật profile:", error);
        showToast("Cập nhật thất bại. Vui lòng thử lại.", true);
    } finally {
        hideButtonSpinner(profileUpdateButton);
    }
};

// 6. Lắng nghe Thông báo (Real-time)
const listenForAnnouncements = () => {
    const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'), limit(1));

    onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
            // Giả sử ta lưu 'lastSeenAnnoucementId' vào localStorage
            const latestAnnoucement = snapshot.docs[0].data();
            const latestId = snapshot.docs[0].id;
            
            const lastSeenId = localStorage.getItem('lastSeenAnnouncementId');
            
            if (latestId !== lastSeenId) {
                // Hiển thị chấm đỏ
                notificationDot.classList.remove('hidden');
            }
            // (Thêm logic: Khi click vào chuông, ẩn chấm đỏ và lưu latestId vào localStorage)
        }
    }, (error) => {
        console.error("Lỗi lắng nghe thông báo:", error);
    });
    
    // Tạm thời: cứ có là hiện
    // onSnapshot(q, (snapshot) => {
    //     if (!snapshot.empty) {
    //         notificationDot.classList.remove('hidden');
    //     }
    // }, (error) => {
    //     console.error("Lỗi lắng nghe thông báo:", error);
    // });
};


// --- Chạy khi DOM đã tải xong ---
document.addEventListener('DOMContentLoaded', () => {
    // Gắn sự kiện
    logoutButton.addEventListener('click', handleLogout);
    profileModalTrigger.addEventListener('click', openProfileModal);
    closeProfileModal.addEventListener('click', closeProfileModalFunc);
    profileUpdateForm.addEventListener('submit', handleProfileUpdate);

    // Đóng modal khi click ra ngoài
    profileModal.addEventListener('click', (e) => {
        if (e.target === profileModal) {
            closeProfileModalFunc();
        }
    });

    // Tải dữ liệu chính
    fetchUserProfile();
    listenForAnnouncements();
});

// Export các hàm helper để các script khác (admin.js) dùng chung
export { showToast, showLoader, hideLoader, showButtonSpinner, hideButtonSpinner };
