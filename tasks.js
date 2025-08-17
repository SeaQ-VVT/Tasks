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
  where,
  getDocs,
  deleteField,
  getDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { showTaskBoard } from "./tasks.js";

console.log("addproject.js loaded OK (stable list, no auto-switch)");

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

// Copy modal elements (tạo nếu chưa có)
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

// Giữ dự án user đang xem (để không bị “tự nhảy”)
let activeProjectId = null;
let activeProjectTitle = null;
// Chặn gọi showTaskBoard lặp lại
window.__currentTaskBoardProjectId = null;

// ===== Utility =====
function showModal(modalId) {
  const el = document.getElementById(modalId);
  if (!el) return;
  el.classList.remove("hidden");
  el.classList.add("flex");
}
function hideModal(modalId) {
  const el = document.getElementById(modalId);
  if (!el) return;
  el.classList.add("hidden");
  el.classList.remove("flex");
}
function displayName(email) {
  if (!email) return "Ẩn danh";
  return String(email).split("@")[0];
}
function safeShowTaskBoard(id, title) {
  if (!id) return;
  if (window.__currentTaskBoardProjectId === id) return;
  showTaskBoard(id, title);
  window.__currentTaskBoardProjectId = id;
}

// ===== Render project card =====
function renderProject(docSnap) {
  const data = docSnap.data();
  const id = docSnap.id;

  const projectCard = document.createElement("div");
  projectCard.className =
    "bg-white p-6 rounded-lg shadow-md border border-gray-200 transition-transform transform hover:scale-105 mb-4";

  let createdAt = "-";
  const ca = data.createdAt;
  if (ca?.toDate) createdAt = ca.toDate().toLocaleString();

  projectCard.innerHTML = `
    <h4 class="text-xl font-semibold text-blue-700 mb-2">${data.title || "(Không tên)"}</h4>
    <p class="text-gray-600 mb-2">${data.description || "Chưa có mô tả."}</p>
    <p class="text-gray-500 text-sm"><b>Bắt đầu:</b> ${data.startDate || "-"}</p>
    <p class="text-gray-500 text-sm"><b>Kết thúc:</b> ${data.endDate || "-"}</p>
    <p class="text-gray-500 text-sm"><b>Ghi chú:</b> ${data.comment || "-"}</p>
    <p class="text-gray-500 text-sm"><b>Người tạo:</b> ${displayName(data.createdBy)}</p>
    <p class="text-gray-500 text-sm mb-4"><b>Ngày tạo:</b> ${createdAt}</p>
    <div class="flex space-x-2 mt-2">
      <button data-id="${id}" class="view-tasks-btn bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-md text-sm">👁️</button>
      <button data-id="${id}" class="copy-btn bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-md text-sm">📋</button>
      <button data-id="${id}" class="edit-btn bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded-md text-sm">✏️</button>
      <button data-id="${id}" class="delete-btn bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-md text-sm">🗑️</button>
    </div>
  `;
  projectArea.appendChild(projectCard);
}

// ===== Real-time listener =====
function setupProjectListener() {
  const projectsCol = collection(db, "projects");

  // ⚠️ BỎ orderBy để tránh loại rớt doc khi thiếu createdAt
  const q = query(projectsCol);

  onSnapshot(q, (snapshot) => {
    // Gom docs -> sort trên client theo createdAt (nếu có), sau đó theo title
    const docs = [];
    snapshot.forEach((d) => docs.push(d));

    docs.sort((a, b) => {
      const ad = a.data(), bd = b.data();
      const aT = ad.createdAt?.toMillis ? ad.createdAt.toMillis() : 0;
      const bT = bd.createdAt?.toMillis ? bd.createdAt.toMillis() : 0;
      if (aT !== bT) return bT - aT; // desc
      const at = (ad.title || "").toLowerCase();
      const bt = (bd.title || "").toLowerCase();
      return at.localeCompare(bt);
    });

    projectArea.innerHTML = "";
    if (docs.length === 0) {
      const empty = document.createElement("div");
      empty.className = "text-gray-500 italic";
      empty.textContent = "Chưa có dự án nào.";
      projectArea.appendChild(empty);
    } else {
      docs.forEach((doc) => renderProject(doc));
    }

    // Bind: Edit/Delete/Copy/View
    document.querySelectorAll(".edit-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const id = e.currentTarget.dataset.id;
        const docToEdit = docs.find((d) => d.id === id);
        if (docToEdit) editProject(id, docToEdit.data());
      });
    });
    document.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const id = e.currentTarget.dataset.id;
        showDeleteConfirmation(id);
      });
    });
    document.querySelectorAll(".copy-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const id = e.currentTarget.dataset.id;
        const docToCopy = docs.find((d) => d.id === id);
        if (docToCopy) copyProject(id, docToCopy.data());
      });
    });
    document.querySelectorAll(".view-tasks-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const id = e.currentTarget.dataset.id;
        const docToView = docs.find((d) => d.id === id);
        if (docToView) {
          activeProjectId = id;
          activeProjectTitle = docToView.data().title || "(Không tên)";
          safeShowTaskBoard(activeProjectId, activeProjectTitle);
        }
      });
    });

    // Khôi phục project đang mở (nếu có)
    if (activeProjectId) {
      const docToView = docs.find((d) => d.id === activeProjectId);
      if (docToView) {
        safeShowTaskBoard(activeProjectId, activeProjectTitle);
      } else {
        const board = document.getElementById("taskBoard");
        if (board) board.innerHTML = "";
        window.__currentTaskBoardProjectId = null;
        activeProjectId = null;
        activeProjectTitle = null;
      }
    }
  }, (err) => {
    console.error("onSnapshot projects error:", err);
    projectArea.innerHTML = `<div class="text-red-600">Lỗi tải dự án: ${err?.message || err}</div>`;
  });
}

// ===== Add / Update project =====
saveProjectBtn.addEventListener("click", async () => {
  const title = projectTitleInput.value.trim();
  const description = projectDescriptionInput.value.trim();
  const startDate = projectStartInput.value;
  const endDate = projectEndInput.value;
  const comment = projectCommentInput.value.trim();

  if (!title) { console.error("Please enter a project title."); return; }

  try {
    const user = auth.currentUser;

    if (isEditing) {
      const projectDocRef = doc(db, "projects", currentProjectId);
      await updateDoc(projectDocRef, {
        title, description, startDate, endDate, comment,
        updatedAt: serverTimestamp()
      });
    } else {
      await addDoc(collection(db, "projects"), {
        title, description, startDate, endDate, comment,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: user ? user.email : "Ẩn danh"
      });
    }

    hideModal("projectModal");
    projectTitleInput.value = "";
    projectDescriptionInput.value = "";
    projectStartInput.value = "";
    projectEndInput.value = "";
    projectCommentInput.value = "";

  } catch (e) {
    console.error("Error adding/updating project: ", e);
  }
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
  newProjectTitleInput.value = `${data.title || "(Không tên)"} (Bản sao)`;
  showModal("copyModal");
}

// (tuỳ chọn) copy subcollections của task
async function copyTaskSubcollections(oldTaskId, newTaskId) {
  const subs = []; // để trống => không ảnh hưởng hiện tại
  for (const sub of subs) {
    const q = query(collection(db, `tasks/${oldTaskId}/${sub}`));
    const snap = await getDocs(q);
    if (snap.empty) continue;
    const ops = snap.docs.map((d) => {
      const data = d.data();
      delete data.createdAt;
      delete data.updatedAt;
      return addDoc(collection(db, `tasks/${newTaskId}/${sub}`), {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    });
    await Promise.all(ops);
  }
}

ensureCopyModal();

if (confirmCopyBtn) {
  confirmCopyBtn.addEventListener("click", async () => {
    const newTitle = (newProjectTitleInput?.value || "").trim();
    if (!newTitle) { console.error("Vui lòng nhập tên cho dự án mới."); return; }

    confirmCopyBtn.disabled = true;
    try {
      const user = auth.currentUser;
      const srcDoc = await getDoc(doc(db, "projects", currentProjectId));
      if (!srcDoc.exists()) throw new Error("Dự án gốc không tồn tại.");
      const src = srcDoc.data() || {};

      const { createdAt, updatedAt, createdBy, ...rest } = src;
      const newProjectRef = await addDoc(collection(db, "projects"), {
        ...rest,
        title: newTitle,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: user ? user.email : "Ẩn danh"
      });
      const newProjectId = newProjectRef.id;

      const groupsQ = query(collection(db, "groups"), where("projectId", "==", currentProjectId));
      const groupsSnap = await getDocs(groupsQ);

      const groupIdMap = new Map();
      await Promise.all(
        groupsSnap.docs.map(async (g) => {
          const gData = g.data();
          const { createdAt, updatedAt, projectId, ...gRest } = gData;
          const newGRef = await addDoc(collection(db, "groups"), {
            ...gRest,
            projectId: newProjectId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          groupIdMap.set(g.id, newGRef.id);
        })
      );

      const tasksQ = query(collection(db, "tasks"), where("projectId", "==", currentProjectId));
      const tasksSnap = await getDocs(tasksQ);

      await Promise.all(
        tasksSnap.docs.map(async (t) => {
          const tData = t.data();
          const { createdAt, updatedAt, projectId, groupId, ...tRest } = tData;

          const newTaskRef = await addDoc(collection(db, "tasks"), {
            ...tRest,
            projectId: newProjectId,
            groupId: groupId ? groupIdMap.get(groupId) || null : null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });

          await copyTaskSubcollections(t.id, newTaskRef.id);
        })
      );

      hideModal("copyModal");
      console.log("Đã sao chép dự án và toàn bộ dữ liệu liên quan thành công!");
    } catch (e) {
      console.error("Lỗi khi sao chép dự án:", e);
    } finally {
      confirmCopyBtn.disabled = false;
    }
  });
}

if (cancelCopyBtn) {
  cancelCopyBtn.addEventListener("click", () => hideModal("copyModal"));
}

// ===== Delete project and associated data =====
function showDeleteConfirmation(id) {
  currentProjectId = id;
  showModal("deleteModal");
}

confirmDeleteBtn.addEventListener("click", async () => {
  try {
    const tasksQuery = query(collection(db, "tasks"), where("projectId", "==", currentProjectId));
    const tasksSnapshot = await getDocs(tasksQuery);
    await Promise.all(tasksSnapshot.docs.map((d) => deleteDoc(d.ref)));

    const groupsQuery = query(collection(db, "groups"), where("projectId", "==", currentProjectId));
    const groupsSnapshot = await getDocs(groupsQuery);
    await Promise.all(groupsSnapshot.docs.map((d) => deleteDoc(d.ref)));

    const logsQuery = query(collection(db, "logs"), where("projectId", "==", currentProjectId));
    const logsSnapshot = await getDocs(logsQuery);
    await Promise.all(logsSnapshot.docs.map((d) => deleteDoc(d.ref)));

    await deleteDoc(doc(db, "projects", currentProjectId));

    if (currentProjectId === activeProjectId) {
      const board = document.getElementById("taskBoard");
      if (board) board.innerHTML = "";
      window.__currentTaskBoardProjectId = null;
      activeProjectId = null;
      activeProjectTitle = null;
    }

    hideModal("deleteModal");
  } catch (e) {
    console.error("Error deleting project and associated data: ", e);
  }
});

cancelDeleteBtn.addEventListener("click", () => hideModal("deleteModal"));
cancelProjectBtn.addEventListener("click", () => hideModal("projectModal"));

// ===== Add project modal =====
addProjectBtn.addEventListener("click", () => {
  isEditing = false;
  projectModalTitle.textContent = "Tạo dự án mới";
  projectTitleInput.value = "";
  projectDescriptionInput.value = "";
  projectStartInput.value = "";
  projectEndInput.value = "";
  projectCommentInput.value = "";
  showModal("projectModal");
});

// ===== Auth listener =====
auth.onAuthStateChanged((user) => {
  if (user) {
    addProjectBtn.classList.remove("hidden");
    setupProjectListener();
  } else {
    projectArea.innerHTML = "";
    addProjectBtn.classList.add("hidden");
    const board = document.getElementById("taskBoard");
    if (board) board.innerHTML = "";
    window.__currentTaskBoardProjectId = null;
    activeProjectId = null;
    activeProjectTitle = null;
  }
});
