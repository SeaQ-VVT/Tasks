// extra.js
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

const auth = getAuth();

// Khi trạng thái đăng nhập thay đổi
onAuthStateChanged(auth, (user) => {
  if (user) {
    const main = document.getElementById("mainContent");

    // Xoá nội dung placeholder cũ
    main.innerHTML = "";

    // Thêm tiêu đề chào mừng
    const title = document.createElement("h2");
    title.textContent = `Xin chào ${user.email}`;
    title.className = "text-2xl font-bold mb-4";
    main.appendChild(title);

    // Thêm mô tả
    const desc = document.createElement("p");
    desc.textContent = "Đây là khu vực sau khi bạn đăng nhập. Bạn có thể thêm bất kỳ nội dung nào ở đây.";
    desc.className = "text-gray-600 mb-6";
    main.appendChild(desc);

    // Nút hiển thị thông tin tài khoản
    const infoBtn = document.createElement("button");
    infoBtn.textContent = "Xem thông tin tài khoản";
    infoBtn.className = "px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600";
    infoBtn.addEventListener("click", () => {
      alert(`UID: ${user.uid}\nEmail: ${user.email}`);
    });
    main.appendChild(infoBtn);
  }
});
