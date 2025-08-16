// addProject.js
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp, query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const auth = getAuth();
const db = getFirestore();

// Vùng controls + list
const projectControls = document.getElementById("projectControls");
const projectArea = document.getElementById("projectArea");

// Render nút thêm dự án
projectControls.innerHTML = `
  <button id="btnAddProject" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
    ➕ Thêm dự án
  </button>
`;

// Modal popup
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

// Nút mở modal
document.getElementById("btnAddProject").addEventListener("click", () => {
  modal.classList.remove("hidden");
  modal.classList.add("flex");
});

// Nút hủy
modal.querySelector("#cancelBtn").addEventListener("click", () => {
  modal.classList.add("hidden");
  modal.classList.remove("flex");
});

// Lưu dự án vào Firestore
modal.querySelector("#saveBtn").addEventListener("click", async () => {
  const name = modal.querySelector("#projName").value.trim();
  const owner = modal.querySelector("#projOwner").value.trim();
  const start = modal.querySelector("#projStart").value;
  const end = modal.querySelector("#projEnd").value;
  const color = modal.querySelector("#projColor").value;

  if (!name || !owner || !start || !end) {
    alert("Vui lòng nhập đầy đủ thông tin!");
    return;
  }

  const user = auth.currentUser;
  if (!user) {
    alert("Bạn phải đăng nhập trước!");
    return;
  }

  try {
    await addDoc(collection(db, "projects"), {
      name,
      owner,
      start,
      end,
      color,
      createdBy: user.email,
      createdAt: serverTimestamp()
    });

    // Reset form
    modal.querySelector("#projName").value = "";
    modal.querySelector("#projOwner").value = "";
    modal.querySelector("#projStart").value = "";
    modal.querySelector("#projEnd").value = "";
    modal.classList.add("hidden");
    modal.classList.remove("flex");

  } catch (err) {
    alert("Lỗi khi lưu: " + err.message);
  }
});

// Lắng nghe realtime Firestore để render danh sách
const q = query(collection(db, "projects"), orderBy("createdAt", "desc"));
onSnapshot(q, (snapshot) => {
  projectArea.innerHTML = "";
  snapshot.forEach((doc) => {
    const p = doc.data();
    const card = document.createElement("div");
    card.className = "p-4 rounded shadow text-white mb-2";
    card.style.backgroundColor = p.color || "#3b82f6";
    card.innerHTML = `
      <h3 class="text-lg font-bold">${p.name}</h3>
      <p>👤 ${p.owner}</p>
      <p>📅 ${p.start} → ${p.end}</p>
      <p class="text-sm">Người tạo: ${p.createdBy || "?"}</p>
    `;
    projectArea.appendChild(card);
  });
});
