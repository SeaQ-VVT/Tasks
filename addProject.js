// extra.js
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

const auth = getAuth();

onAuthStateChanged(auth, (user) => {
  if (user) {
    const main = document.getElementById("mainContent");
    main.innerHTML = "";

    // --- Nút thêm dự án ---
    const addBtn = document.createElement("button");
    addBtn.textContent = "➕ Thêm dự án";
    addBtn.className = "mb-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700";
    main.appendChild(addBtn);

    // --- Khu vực hiển thị danh sách dự án ---
    const projectList = document.createElement("div");
    projectList.className = "space-y-4";
    main.appendChild(projectList);

    // --- Modal thêm dự án ---
    const modal = document.createElement("div");
    modal.className = "fixed inset-0 bg-black bg-opacity-50 hidden items-center justify-center z-50";
    modal.innerHTML = `
      <div class="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
        <h2 class="text-xl font-bold mb-4">Thêm dự án mới</h2>
        <input id="projName" type="text" placeholder="Tên dự án" class="w-full mb-2 p-2 border rounded">
        <input id="projOwner" type="text" placeholder="Người phụ trách" class="w-full mb-2 p-2 border rounded">
        <label class="text-sm">Ngày bắt đầu</label>
        <input id="projStart" type="date" class="w-full mb-2 p-2 border rounded">
        <label class="text-sm">Ngày kết thúc</label>
        <input id="projEnd" type="date" class="w-full mb-2 p-2 border rounded">
        <label class="text-sm">Màu sắc</label>
        <input id="projColor" type="color" value="#3b82f6" class="w-full mb-4 p-2 border rounded">
        <div class="flex justify-end space-x-2">
          <button id="cancelBtn" class="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400">Hủy</button>
          <button id="saveBtn" class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">Lưu</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // --- Sự kiện mở/đóng modal ---
    addBtn.addEventListener("click", () => {
      modal.classList.remove("hidden");
      modal.classList.add("flex");
    });
    modal.querySelector("#cancelBtn").addEventListener("click", () => {
      modal.classList.add("hidden");
      modal.classList.remove("flex");
    });

    // --- Lưu dự án ---
    modal.querySelector("#saveBtn").addEventListener("click", () => {
      const name = modal.querySelector("#projName").value.trim();
      const owner = modal.querySelector("#projOwner").value.trim();
      const start = modal.querySelector("#projStart").value;
      const end = modal.querySelector("#projEnd").value;
      const color = modal.querySelector("#projColor").value;

      if (!name || !owner || !start || !end) {
        alert("Vui lòng điền đầy đủ thông tin!");
        return;
      }

      // Tạo card dự án
      const card = document.createElement("div");
      card.className = "p-4 rounded shadow text-white";
      card.style.backgroundColor = color;
      card.innerHTML = `
        <h3 class="text-lg font-bold">${name}</h3>
        <p>👤 ${owner}</p>
        <p>📅 ${start} → ${end}</p>
      `;
      projectList.appendChild(card);

      // Reset form + đóng modal
      modal.querySelector("#projName").value = "";
      modal.querySelector("#projOwner").value = "";
      modal.querySelector("#projStart").value = "";
      modal.querySelector("#projEnd").value = "";
      modal.classList.add("hidden");
      modal.classList.remove("flex");
    });
  }
});
