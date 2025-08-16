// ===== Firebase Config =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

// TODO: thay config bằng của bạn
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_MSG_ID",
  appId: "YOUR_APP_ID"
};

// Init
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

document.addEventListener("DOMContentLoaded", async () => {
  const projectControls = document.getElementById("projectControls");
  const projectArea = document.getElementById("projectArea");

  // ===== 1. Nút Thêm dự án =====
  const addBtn = document.createElement("button");
  addBtn.textContent = "➕ Thêm dự án";
  addBtn.className =
    "px-4 py-2 bg-blue-600 text-white rounded shadow hover:bg-blue-700";
  projectControls.appendChild(addBtn);

  // ===== 2. Modal nhập thông tin =====
  const modal = document.createElement("div");
  modal.className =
    "fixed inset-0 hidden bg-black bg-opacity-50 flex items-center justify-center z-50";
  modal.innerHTML = `
    <div class="bg-white p-6 rounded shadow-lg w-96">
      <h2 class="text-lg font-bold mb-4">Thêm dự án mới</h2>
      <input id="projName" type="text" placeholder="Tên dự án"
        class="w-full mb-2 p-2 border rounded" />
      <input id="projOwner" type="text" placeholder="Người phụ trách"
        class="w-full mb-2 p-2 border rounded" />
      <input id="projStart" type="date"
        class="w-full mb-2 p-2 border rounded" />
      <input id="projEnd" type="date"
        class="w-full mb-2 p-2 border rounded" />
      <input id="projColor" type="color" value="#3b82f6"
        class="w-full mb-4 p-1 border rounded" />
      <div class="flex justify-end gap-2">
        <button id="cancelAdd" class="px-3 py-1 bg-gray-300 rounded">Hủy</button>
        <button id="saveAdd" class="px-3 py-1 bg-blue-600 text-white rounded">Lưu</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // ===== 3. Mở / Đóng modal =====
  addBtn.addEventListener("click", () => modal.classList.remove("hidden"));
  modal.querySelector("#cancelAdd").addEventListener("click", () =>
    modal.classList.add("hidden")
  );

  // ===== 4. Hàm render dự án =====
  function renderProject(docData) {
    const card = document.createElement("div");
    card.className = "p-4 rounded shadow text-white";
    card.style.backgroundColor = docData.color || "#3b82f6";
    card.innerHTML = `
      <h3 class="text-lg font-bold">${docData.name}</h3>
      <p>Phụ trách: ${docData.owner}</p>
      <p>Bắt đầu: ${docData.start}</p>
      <p>Kết thúc: ${docData.end}</p>
    `;
    projectArea.appendChild(card);
  }

  // ===== 5. Lưu dữ liệu =====
  modal.querySelector("#saveAdd").addEventListener("click", async () => {
    const name = document.getElementById("projName").value;
    const owner = document.getElementById("projOwner").value;
    const start = document.getElementById("projStart").value;
    const end = document.getElementById("projEnd").value;
    const color = document.getElementById("projColor").value;

    if (!name || !owner) {
      alert("Nhập đầy đủ thông tin!");
      return;
    }

    try {
      const docRef = await addDoc(collection(db, "projects"), {
        name,
        owner,
        start,
        end,
        color
      });

      renderProject({ name, owner, start, end, color });
      modal.classList.add("hidden");
    } catch (err) {
      console.error("Lỗi lưu:", err);
    }
  });

  // ===== 6. Load lại danh sách dự án khi vào trang =====
  const querySnapshot = await getDocs(collection(db, "projects"));
  querySnapshot.forEach((doc) => {
    renderProject(doc.data());
  });
});
