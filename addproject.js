// ===== Firebase SDKs =====
import {
  getFirestore,
  collection,
  query,
  onSnapshot,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  orderBy,
  where,
  getDocs,
  getDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { showTaskBoard } from "./tasks.js";

// ===== Firebase config =====
const firebaseConfig = {
  apiKey: "AIzaSyCW49METqezYoUKSC1N0Pi3J83Ptsf9hA8",
  authDomain: "task-manager-d18aa.firebaseapp.com",
  projectId: "task-manager-d18aa",
  storageBucket: "task-manager-d18aa.appspot.com",
  messagingSenderId: "1080268498085",
  appId: "1:1080268498085:web:767434c6a2c013b961d94c"
};

// ===== Init Firebase =====
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ===== DOM elements =====
const projectArea = document.getElementById("projectArea");
const addProjectBtn = document.getElementById("addProjectBtn");
const projectModal = document.getElementById("projectModal");
const projectModalTitle = document.getElementById("projectModalTitle");
const projectTitleInput = document.getElementById("projectTitle");
const projectDescriptionInput = document.getElementById("projectDescription");
const projectStartInput = document.getElementById("projectStartDate");
const projectEndInput = document.getElementById("projectEndDate");
const projectCommentInput = document.getElementById("projectComment");
const saveProjectBtn = document.getElementById("saveProjectBtn");
const cancelProjectBtn = document.getElementById("cancelProjectBtn");
const deleteModal = document.getElementById("deleteModal");
const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");

// Copy modal elements
let copyModal = document.getElementById("copyModal");
let newProjectTitleInput = document.getElementById("newProjectTitle");
let confirmCopyBtn = document.getElementById("confirmCopyBtn");
let cancelCopyBtn = document.getElementById("cancelCopyBtn");

function ensureCopyModal() {
  if (copyModal && newProjectTitleInput && confirmCopyBtn && cancelCopyBtn) return;
  const wrapper = document.createElement("div");
  wrapper.innerHTML = `
    <div id="copyModal" class="hidden fixed inset-0 z-50 items-center justify-center bg-black bg-opacity-40">
      <div class="bg-white w-full max-w-md mx-4 rounded-lg shadow-lg p-5">
        <h3 class="text-lg font-semibold mb-3">Sao chép dự án</h3>
        <label class="block text-sm text-gray-600 mb-1">Tên dự án mới</label>
        <input id="newProjectTitle" class="w-full border rounded px-3 py-2 mb-4" placeholder="Nhập tên dự án mới" />
        <div class="flex justify-end gap-2">
          <button id="cancelCopyBtn" class="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300">Hủy</button>
          <button id="confirmCopyBtn" class="px-3 py-2 rounded bg-green-600 hover:bg-green-700 text-white">Sao chép</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(wrapper);
  copyModal = document.getElementById("copyModal");
  newProjectTitleInput = document.getElementById("newProjectTitle");
  confirmCopyBtn = document.getElementById("confirmCopyBtn");
  cancelCopyBtn = document.getElementById("cancelCopyBtn");
  cancelCopyBtn.addEventListener("click", () => hideModal("copyModal"));
}

// ===== State =====
let isEditing = false;
let currentProjectId = null;
let openedProjectId = null;

// ===== Utility =====
function showModal(modalId) {
  const el = document.getElementById(modalId);
  if (!el) return;
  el.classList.remove("hidden");
  el.classList.add("flex");
}
function hideModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.add("hidden");
  modal.classList.remove("flex");
}
function displayName(email) {
  if (!email) return "Ẩn danh";
  return String(email).split("@")[0];
}

// ===== LOGGING =====
async function addProjectLog(projectId, action, detail) {
  const user = auth.currentUser;
  await addDoc(collection(db, "project_logs"), {
    projectId,
    action,
    detail,
    user: user ? user.email : "Ẩn danh",
    createdAt: serverTimestamp()
  });
}
async function loadProjectLogs() {
  const logDiv = document.getElementById("projectLogsArea");
  if (!logDiv) return;
  logDiv.innerHTML = "";
  const q = query(collection(db, "project_logs"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  let html = "<ul class='text-sm text-gray-700'>";
  snap.forEach((docu) => {
    const d = docu.data();
    const time = d.createdAt?.toDate().toLocaleString() || "-";
    html += `<li class="mb-1 border-b pb-1">
      <b>${d.user}</b> ➝ ${d.action} lúc ${time} <br>
      <i>${d.detail}</i>
      ${auth.currentUser?.email === "admin@gmail.com" 
        ? `<button data-logid="${docu.id}" class="delete-project-log text-red-500 ml-2">❌</button>` : ""}
    </li>`;
  });
  html += "</ul>";
  logDiv.innerHTML = html;
  logDiv.querySelectorAll(".delete-project-log").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const logId = e.currentTarget.dataset.logid;
      await deleteDoc(doc(db, "project_logs", logId));
      loadProjectLogs();
    });
  });
}
const toggleBtn = document.getElementById("toggleLogsBtn");
if (toggleBtn) {
  toggleBtn.addEventListener("click", () => {
    const logDiv = document.getElementById("projectLogsArea");
    if (logDiv.classList.contains("hidden")) {
      loadProjectLogs();
      logDiv.classList.remove("hidden");
    } else {
      logDiv.classList.add("hidden");
    }
  });
}

// ===== Render project card =====
function renderProject(docSnap) {
  const data = docSnap.data();
  const id = docSnap.id;
  const projectCard = document.createElement("div");
  projectCard.className = "bg-white p-6 rounded-lg shadow-md border border-gray-200 hover:scale-105 mb-4";
  const createdAt = data.createdAt?.toDate ? data.createdAt.toDate().toLocaleString() : "-";
  projectCard.innerHTML = `
    <h4 class="text-xl font-semibold text-blue-700 mb-2">${data.title}</h4>
    <p class="text-gray-600 mb-2">${data.description || "Chưa có mô tả."}</p>
    <p class="text-gray-500 text-sm"><b>Bắt đầu:</b> ${data.startDate || "-"}</p>
    <p class="text-gray-500 text-sm"><b>Kết thúc:</b> ${data.endDate || "-"}</p>
    <p class="text-gray-500 text-sm"><b>Ghi chú:</b> ${data.comment || "-"}</p>
    <p class="text-gray-500 text-sm"><b>Người tạo:</b> ${displayName(data.createdBy)}</p>
    <p class="text-gray-500 text-sm mb-4"><b>Ngày tạo:</b> ${createdAt}</p>
    <div class="flex space-x-2 mt-2">
      <button data-id="${id}" class="view-tasks-btn bg-blue-500 text-white px-3 py-1 rounded-md text-sm">👁️</button>
      <button data-id="${id}" class="copy-btn bg-green-500 text-white px-3 py-1 rounded-md text-sm">📋</button>
      <button data-id="${id}" class="edit-btn bg-yellow-500 text-white px-3 py-1 rounded-md text-sm">✏️</button>
      <button data-id="${id}" class="delete-btn bg-red-500 text-white px-3 py-1 rounded-md text-sm">🗑️</button>
    </div>
  `;
  projectArea.appendChild(projectCard);
}

// ===== Real-time listener =====
function setupProjectListener() {
  const projectsCol = collection(db, "projects");
  const q = query(projectsCol, orderBy("createdAt", "desc"));
  onSnapshot(q, (snapshot) => {
    projectArea.innerHTML = "";
    snapshot.forEach((doc) => renderProject(doc));
    document.querySelectorAll(".edit-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const id = e.currentTarget.dataset.id;
        const docToEdit = snapshot.docs.find((d) => d.id === id);
        if (docToEdit) editProject(id, docToEdit.data());
      });
    });
    document.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        showDeleteConfirmation(e.currentTarget.dataset.id);
      });
    });
    document.querySelectorAll(".copy-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const id = e.currentTarget.dataset.id;
        const docToCopy = snapshot.docs.find((d) => d.id === id);
        if (docToCopy) copyProject(id, docToCopy.data());
      });
    });
    document.querySelectorAll(".view-tasks-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const id = e.currentTarget.dataset.id;
        const docToView = snapshot.docs.find((d) => d.id === id);
        if (docToView) {
          openedProjectId = id;
          showTaskBoard(id, docToView.data().title);
        }
      });
    });
  });
}

// ===== Add / Update project =====
saveProjectBtn.addEventListener("click", async () => {
  const title = projectTitleInput.value.trim();
  const description = projectDescriptionInput.value.trim();
  const startDate = projectStartInput.value;
  const endDate = projectEndInput.value;
  const comment = projectCommentInput.value.trim();
  if (!title) return;
  try {
    const user = auth.currentUser;
    if (isEditing) {
      await updateDoc(doc(db, "projects", currentProjectId), {
        title, description, startDate, endDate, comment, updatedAt: new Date()
      });
      await addProjectLog(currentProjectId, "Cập nhật", `Sửa dự án: ${title}`);
    } else {
      const ref = await addDoc(collection(db, "projects"), {
        title, description, startDate, endDate, comment,
        createdAt: new Date(),
        createdBy: user ? user.email : "Ẩn danh"
      });
      await addProjectLog(ref.id, "Tạo", `Tạo dự án: ${title}`);
    }
    hideModal("projectModal");
    projectTitleInput.value = projectDescriptionInput.value = projectStartInput.value = projectEndInput.value = projectCommentInput.value = "";
  } catch (e) { console.error("Error:", e); }
});

// ===== Edit project =====
function editProject(id, data) {
  isEditing = true;
  currentProjectId = id;
  projectModalTitle.textContent = "Cập nhật dự án";
  projectTitleInput.value = data.title || "";
  projectDescriptionInput.value = data.description || "";
  projectStartInput.value = data.startDate || "";
  projectEndInput.value = data.endDate || "";
  projectCommentInput.value = data.comment || "";
  showModal("projectModal");
}

// ===== Copy project =====
function copyProject(id, data) {
  ensureCopyModal();
  currentProjectId = id;
  newProjectTitleInput.value = `${data.title} (Bản sao)`;
  showModal("copyModal");
}
if (confirmCopyBtn) {
  confirmCopyBtn.addEventListener("click", async () => {
    const newTitle = (newProjectTitleInput?.value || "").trim();
    if (!newTitle) return;
    confirmCopyBtn.disabled = true;
    try {
      const user = auth.currentUser;
      const srcDoc = await getDoc(doc(db, "projects", currentProjectId));
      if (!srcDoc.exists()) throw new Error("Không tìm thấy dự án gốc");
      const src = srcDoc.data() || {};
      const { createdAt, updatedAt, createdBy, ...rest } = src;
      const newProjectRef = await addDoc(collection(db, "projects"), {
        ...rest,
        title: newTitle,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: user ? user.email : "Ẩn danh"
      });
      await addProjectLog(newProjectRef.id, "Copy", `Sao chép dự án từ "${src.title}"`);
      hideModal("copyModal");
    } catch (e) { console.error("Copy error:", e); }
    finally { confirmCopyBtn.disabled = false; }
  });
}

// ===== Delete project =====
function showDeleteConfirmation(id) { currentProjectId = id; showModal("deleteModal"); }
confirmDeleteBtn.addEventListener("click", async () => {
  try {
    await addProjectLog(currentProjectId, "Xóa", "Đã xóa dự án");
    await deleteDoc(doc(db, "projects", currentProjectId));
    if (openedProjectId === currentProjectId) {
      const taskBoard = document.getElementById("taskBoard");
      if (taskBoard) taskBoard.innerHTML = "";
      openedProjectId = null;
    }
    hideModal("deleteModal");
  } catch (e) { console.error("Delete error:", e); }
});

// ===== Auth listener =====
auth.onAuthStateChanged((user) => {
  if (user) { addProjectBtn.classList.remove("hidden"); setupProjectListener(); }
  else { projectArea.innerHTML = ""; addProjectBtn.classList.add("hidden"); }
});
