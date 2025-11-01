document.addEventListener('DOMContentLoaded', () => {
    const tabLinks = document.querySelectorAll('.admin-tabs .tab-link');
    const tabContents = document.querySelectorAll('.tab-content');

    tabLinks.forEach(link => {
        link.addEventListener('click', () => {
            const tabId = link.dataset.tab;

            // Xóa active khỏi tất cả link
            tabLinks.forEach(item => item.classList.remove('active'));
            // Thêm active vào link được click
            link.classList.add('active');

            // Ẩn tất cả content
            tabContents.forEach(content => content.classList.add('hidden'));
            // Hiển thị content tương ứng
            document.getElementById(tabId).classList.remove('hidden');
            
            // Đẩy lên URL (tùy chọn)
            // history.pushState(null, null, `#${tabId}`);
        });
    });

    // (Tùy chọn: Kiểm tra hash # trên URL để active tab khi tải trang)
});
