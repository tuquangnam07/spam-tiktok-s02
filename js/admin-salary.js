import { db, auth, serverTimestamp, Timestamp } from './firebase-config.js';
import { collection, getDocs, doc, addDoc, query, where, limit, writeBatch } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import { showToast, showButtonSpinner, hideButtonSpinner } from './main.js';

// DOM Elements
const userSelect = document.getElementById('salary-user-select');
const manualForm = document.getElementById('manual-salary-form');
const manualBtn = document.getElementById('manual-salary-btn');
const fileInput = document.getElementById('excel-file-input');
const processBtn = document.getElementById('process-excel-btn');
const summaryEl = document.getElementById('excel-summary');

let ctvList = []; // Cache danh sách CTV

// --- Phần 1: Thêm Lương Thủ Công ---

// 1. Tải danh sách CTV vào dropdown
const loadCtvDropdown = async () => {
    try {
        const q = query(collection(db, 'users'), where('role', '==', 'user'));
        const snapshot = await getDocs(q);
        
        ctvList = []; // Xóa cache cũ
        userSelect.innerHTML = '<option value="">-- Chọn CTV --</option>';
        
        snapshot.forEach(doc => {
            const user = doc.data();
            const userData = {
                id: doc.id,
                hoTen: user.profile.hoTen,
                idTele: user.profile.idTele
            };
            ctvList.push(userData);
            
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = `${user.profile.hoTen} (${user.profile.idTele || 'chưa có tele'})`;
            userSelect.appendChild(option);
        });
        
    } catch (error) {
        console.error("Lỗi tải danh sách CTV:", error);
        userSelect.innerHTML = '<option value="">Lỗi tải danh sách</option>';
    }
};

// 2. Xử lý submit form thủ công
const handleManualAddSalary = async (e) => {
    e.preventDefault();
    showButtonSpinner(manualBtn);

    try {
        const userId = userSelect.value;
        const amount = parseFloat(document.getElementById('salary-amount').value);
        const date = document.getElementById('salary-date').value;
        const status = document.getElementById('salary-status').value;
        
        if (!userId || isNaN(amount) || !date || !status) {
            throw new Error("Vui lòng điền đầy đủ thông tin.");
        }

        // Lấy thông tin CTV từ cache
        const selectedCtv = ctvList.find(ctv => ctv.id === userId);
        if (!selectedCtv) {
            throw new Error("Không tìm thấy thông tin CTV.");
        }

        const adminId = auth.currentUser.uid;

        // Tạo document mới
        await addDoc(collection(db, 'salaries'), {
            userId: userId,
            hoTen: selectedCtv.hoTen,
            idTele: selectedCtv.idTele,
            amount: amount,
            date: date,
            status: status,
            addedBy: adminId,
            method: 'manual',
            createdAt: serverTimestamp()
        });
        
        showToast("Thêm lương thủ công thành công!");
        manualForm.reset();
        
    } catch (error) {
        console.error("Lỗi thêm lương thủ công:", error);
        showToast(error.message || "Thêm lương thất bại.", true);
    } finally {
        hideButtonSpinner(manualBtn);
    }
};

// --- Phần 2: Xử lý Upload Excel ---

// 1. Hàm đọc file (dùng SheetJS)
const readExcelFile = (file) => {
    return new Promise((resolve, reject) => {
        if (!window.XLSX) {
            reject(new Error("Thư viện SheetJS chưa sẵn sàng."));
            return;
        }
        
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const data = e.target.result;
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(worksheet);
                resolve(json);
            } catch (err) {
                reject(err);
            }
        };
        
        reader.onerror = (err) => {
            reject(err);
        };
        
        reader.readAsArrayBuffer(file);
    });
};

// 2. Hàm tìm User trong Firestore bằng idTele (Yêu cầu Index)
const findUserByTele = async (idTele) => {
    // Tối ưu: Thay vì query liên tục, ta có thể cache
    // Nhưng để đảm bảo dữ liệu mới nhất, ta query
    const usersCollection = collection(db, 'users');
    const q = query(usersCollection, where('profile.idTele', '==', idTele), limit(1));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
        return null;
    }
    
    const doc = snapshot.docs[0];
    return {
        id: doc.id,
        ...doc.data()
    };
};

// 3. Hàm xử lý chính khi nhấn nút
const handleExcelUpload = async () => {
    const file = fileInput.files[0];
    if (!file) {
        showToast("Vui lòng chọn một file Excel.", true);
        return;
    }
    
    showButtonSpinner(processBtn);
    summaryEl.classList.add('hidden');
    summaryEl.innerHTML = '';
    
    let successCount = 0;
    let failCount = 0;
    const errorDetails = [];
    const adminId = auth.currentUser.uid;
    const today = new Date().toISOString().split('T')[0]; // Lấy ngày hôm nay
    
    try {
        // Bước 1: Đọc file
        const rows = await readExcelFile(file);
        if (!rows || rows.length === 0) {
            throw new Error("File Excel rỗng hoặc không đọc được.");
        }

        // Bước 2: Chuẩn bị Batch Write
        const batch = writeBatch(db);
        const salariesCol = collection(db, 'salaries');

        // Bước 3: Lặp qua từng hàng
        for (const row of rows) {
            const idTele = row['Row Labels']?.trim();
            const luongString = row['Sum of LƯƠNG'];
            
            // 3.1: Validate dữ liệu hàng
            if (!idTele || luongString === undefined || luongString === null) {
                failCount++;
                errorDetails.push(`Hàng rỗng (Thiếu ID Tele hoặc Lương)`);
                continue;
            }

            // 3.2: Chuẩn hóa Lương
            const luongNumber = parseFloat(String(luongString).replace(',', '.')) * 1000;
            if (isNaN(luongNumber)) {
                failCount++;
                errorDetails.push(`Lương không hợp lệ (${luongString}) cho ${idTele}`);
                continue;
            }

            // 3.3: Đối chiếu CTV
            const user = await findUserByTele(idTele);
            if (!user) {
                failCount++;
                errorDetails.push(`Không tìm thấy CTV có ID Tele: ${idTele}`);
                continue;
            }
            
            // 3.4: Thêm vào Batch
            const newSalaryRef = doc(salariesCol); // Tạo ID mới
            batch.set(newSalaryRef, {
                userId: user.id,
                hoTen: user.profile.hoTen,
                idTele: idTele,
                amount: luongNumber,
                date: today, // Mặc định là ngày hôm nay
                status: 'chờ xử lý',
                addedBy: adminId,
                method: 'excel',
                createdAt: serverTimestamp()
            });
            
            successCount++;
        }
        
        // Bước 4: Thực thi Batch
        if (successCount > 0) {
            await batch.commit();
        }
        
        // Bước 5: Hiển thị Tổng kết
        showToast(`Tải lên hoàn tất! Thành công: ${successCount}. Thất bại: ${failCount}.`, failCount > 0);
        summaryEl.classList.remove('hidden');
        summaryEl.innerHTML = `<strong>Tổng kết:</strong> ${successCount}/${rows.length} mục lương đã được tải lên.<br>`;
        if (failCount > 0) {
            summaryEl.innerHTML += `<strong>Chi tiết lỗi (${failCount}):</strong><br>` + errorDetails.join('<br>');
            console.error("Lỗi xử lý Excel:", errorDetails);
        }

    } catch (error) {
        console.error("Lỗi nghiêm trọng khi xử lý Excel:", error);
        showToast(error.message || "Xử lý file thất bại.", true);
    } finally {
        hideButtonSpinner(processBtn);
        fileInput.value = ''; // Reset input
    }
};


// --- Khởi chạy ---
document.addEventListener('DOMContentLoaded', () => {
    // Chỉ chạy nếu chúng ta ở trang admin
    if (!manualForm) return;

    // Tải ds CTV cho tab Lương
    loadCtvDropdown();

    // Gắn sự kiện
    manualForm.addEventListener('submit', handleManualAddSalary);
    processBtn.addEventListener('click', handleExcelUpload);
});
