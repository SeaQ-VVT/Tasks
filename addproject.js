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
  deleteField,
  getDoc,
  serverTimestamp,
  writeBatch
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { showTaskBoard } from "./tasks.js";

// Debug log
console.log("addproject.js loaded OK");

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

// Biến lưu trữ người dùng hiện tại và trạng thái đăng nhập
let currentUser = null;
let isAuthReady = false;

// Đảm bảo các hoạt động Firestore chỉ chạy sau khi xác thực xong
auth.onAuthStateChanged((user) => {
  currentUser = user;
  isAuthReady = true;
  if (user) {
    setupProjectListener();
    // Khởi tạo các event listeners sau khi đã xác thực người dùng
    setupLogListeners();
  }
});

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
const logArea = document.getElementById("projectLogArea"); // Log area
const logEntries = document.getElementById("projectLogEntries");
const toggleLogBtn = document.getElementById("toggleProjectLogBtn");
const clearLogBtn = document.getElementById("clearProjectLogBtn");

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
let openedProjectId = null;
let currentProjectLogUnsub = null;

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

// ===== Nhật ký hoạt động (Project Logs) =====
async function logProjectAction(action) {
  if (!isAuthReady) return;
  const user = currentUser?.email || "Ẩn danh";
  const userRole = (currentUser?.email === 'admin@gmail.com') ? 'admin' : 'user';

  await addDoc(collection(db, "project_logs"), {
    action,
    user,
    userRole,
    timestamp: serverTimestamp()
  });
}

function listenForProjectLogs() {
  if (currentProjectLogUnsub) {
    currentProjectLogUnsub();
  }

  const logsCol = collection(db, "project_logs");
  const q = query(logsCol, orderBy("timestamp", "desc"));

  currentProjectLogUnsub = onSnapshot(q, (snapshot) => {
    if (logEntries) {
      logEntries.innerHTML = "";
      snapshot.forEach((doc) => {
        const data = doc.data();
        const timestamp = data.timestamp?.toDate ? data.timestamp.toDate().toLocaleString() : "-";
        const userDisplayName = displayName(data.user);
        const logItem = document.createElement("div");
        logItem.textContent = `[${timestamp}] ${userDisplayName} đã ${data.action}.`;
        logEntries.appendChild(logItem);
      });
    }
  });
}

function setupLogListeners() {
  if (toggleLogBtn && logArea && clearLogBtn) {
    toggleLogBtn.addEventListener("click", () => {
      if (logArea.classList.contains("hidden")) {
        logArea.classList.remove("hidden");
        toggleLogBtn.textContent = "Ẩn nhật ký";
      } else {
        logArea.classList.add("hidden");
        toggleLogBtn.textContent = "Hiện nhật ký";
      }
    });

    // Chỉ hiển thị nút xóa log cho admin
    if (currentUser?.email === 'admin@gmail.com') {
      clearLogBtn.classList.remove("hidden");
      clearLogBtn.addEventListener("click", async () => {
        if (confirm("Bạn có chắc chắn muốn xóa toàn bộ nhật ký dự án?")) {
          try {
            const logsRef = collection(db, "project_logs");
            const logsSnapshot = await getDocs(logsRef);
            const batch = writeBatch(db);
            logsSnapshot.docs.forEach(docu => {
              batch.delete(docu.ref);
            });
            await batch.commit();
            alert("Đã xóa toàn bộ nhật ký thành công.");
          } catch (e) {
            console.error("Lỗi khi xóa log: ", e);
            alert("Lỗi khi xóa nhật ký.");
          }
        }
      });
    } else {
      clearLogBtn.classList.add("hidden");
    }
  }

  listenForProjectLogs();
}

// ===== Render project card =====
function renderProject(docSnap) {
  const data = docSnap.data();
  const id = docSnap.id;

  const projectCard = document.createElement("div");
  projectCard.className =
    "bg-white p-6 rounded-lg shadow-md border border-gray-200 transition-transform transform hover:scale-105 mb-4";

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
  const q = query(projectsCol, orderBy("createdAt", "desc"));

  onSnapshot(q, (snapshot) => {
    projectArea.innerHTML = "";
    snapshot.forEach((doc) => renderProject(doc));

    // Thêm event listeners sau khi render xong
    document.querySelectorAll(".view-tasks-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const id = e.target.dataset.id;
        openedProjectId = id;
        showTaskBoard(id, "Dự án");
      });
    });

    document.querySelectorAll(".edit-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const id = e.target.dataset.id;
        currentProjectId = id;
        isEditing = true;
        projectModalTitle.textContent = "Chỉnh sửa dự án";
        const docRef = doc(db, "projects", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          projectTitleInput.value = data.title;
          projectDescriptionInput.value = data.description;
          projectStartInput.value = data.startDate;
          projectEndInput.value = data.endDate;
          projectCommentInput.value = data.comment;
          showModal("projectModal");
        }
      });
    });

    document.querySelectorAll(".copy-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        currentProjectId = e.target.dataset.id;
        ensureCopyModal();
        showModal("copyModal");
      });
    });

    document.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        currentProjectId = e.target.dataset.id;
        showModal("deleteModal");
      });
    });
  });
}

// ===== Save project =====
saveProjectBtn.addEventListener("click", async () => {
  const projectData = {
    title: projectTitleInput.value,
    description: projectDescriptionInput.value,
    startDate: projectStartInput.value,
    endDate: projectEndInput.value,
    comment: projectCommentInput.value,
  };

  try {
    if (isEditing) {
      const docRef = doc(db, "projects", currentProjectId);
      await updateDoc(docRef, { ...projectData, updatedAt: serverTimestamp(), updatedBy: currentUser?.email || "Ẩn danh" });
      await logProjectAction(`cập nhật dự án "${projectData.title}"`);
    } else {
      await addDoc(collection(db, "projects"), {
        ...projectData,
        createdAt: serverTimestamp(),
        createdBy: currentUser?.email || "Ẩn danh"
      });
      await logProjectAction(`thêm dự án mới "${projectData.title}"`);
    }
    hideModal("projectModal");
  } catch (e) {
    console.error("Error saving project: ", e);
  }
});

// ===== Copy project =====
confirmCopyBtn.addEventListener("click", async () => {
  const newTitle = newProjectTitleInput.value.trim();
  if (!newTitle) {
    alert("Vui lòng nhập tên dự án mới.");
    return;
  }

  try {
    // Lấy dữ liệu dự án gốc
    const originalDocRef = doc(db, "projects", currentProjectId);
    const originalDocSnap = await getDoc(originalDocRef);
    if (!originalDocSnap.exists()) {
      alert("Dự án gốc không tồn tại.");
      return;
    }
    const originalData = originalDocSnap.data();

    // Thêm dự án mới
    const newProjectRef = await addDoc(collection(db, "projects"), {
      ...originalData,
      title: newTitle,
      createdAt: serverTimestamp(),
      createdBy: currentUser?.email || "Ẩn danh"
    });

    // Sao chép các task liên quan
    const tasksQuery = query(collection(db, "tasks"), where("projectId", "==", currentProjectId));
    const tasksSnapshot = await getDocs(tasksQuery);

    const batch = writeBatch(db);
    tasksSnapshot.docs.forEach((taskDoc) => {
      const taskData = taskDoc.data();
      const newTaskRef = doc(collection(db, "tasks"));
      batch.set(newTaskRef, {
        ...taskData,
        projectId: newProjectRef.id,
        createdAt: serverTimestamp(),
        createdBy: currentUser?.email || "Ẩn danh"
      });
    });

    // Sao chép các progress history
    const progressQuery = query(collection(db, "progress_history"), where("projectId", "==", currentProjectId));
    const progressSnapshot = await getDocs(progressQuery);
    progressSnapshot.docs.forEach((progressDoc) => {
        const progressData = progressDoc.data();
        const newProgressRef = doc(collection(db, "progress_history"));
        batch.set(newProgressRef, {
            ...progressData,
            projectId: newProjectRef.id
        });
    });
    
    await batch.commit();

    await logProjectAction(`sao chép dự án "${originalData.title}" thành "${newTitle}"`);
    hideModal("copyModal");
  } catch (e) {
    console.error("Lỗi khi sao chép dự án: ", e);
    alert("Lỗi khi sao chép dự án.");
  }
});

// ===== Delete project =====
confirmDeleteBtn.addEventListener("click", async () => {
  try {
    // Bắt đầu xóa log trước để tránh bị lỗi khi user chưa kịp xóa log
    await logProjectAction(`xóa dự án`);

    // Xóa các task liên quan
    const tasksQuery = query(collection(db, "tasks"), where("projectId", "==", currentProjectId));
    const tasksSnapshot = await getDocs(tasksQuery);
    await Promise.all(tasksSnapshot.docs.map((docu) => deleteDoc(docu.ref)));

    // Xóa các log liên quan
    const progressQuery = query(collection(db, "progress_history"), where("projectId", "==", currentProjectId));
    const progressSnapshot = await getDocs(progressQuery);
    await Promise.all(progressSnapshot.docs.map((docu) => deleteDoc(docu.ref)));
    
    // Finally, delete the project document itself
    await deleteDoc(doc(db, "projects", currentProjectId));
    if (openedProjectId === currentProjectId) {
      const taskBoard = document.getElementById("taskBoard");
      if (taskBoard) taskBoard.innerHTML = "";
      openedProjectId = null;
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
