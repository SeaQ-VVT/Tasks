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

// ===== DOM elements =====
// Thêm các DOM elements mới cho tính năng log
const logArea = document.getElementById("logArea");
const toggleLogBtn = document.getElementById("toggleLogBtn");
const clearLogsBtn = document.getElementById("clearLogsBtn");

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

// ===== Ghi log vào Firebase (mới) =====
async function addLogEntry(action, details, projectTitle) {
  const user = auth.currentUser;
  if (!user) return; // Không ghi log nếu không có người dùng

  try {
    await addDoc(collection(db, "history"), {
      timestamp: new Date(),
      action: action,
      user: displayName(user.email),
      userId: user.uid,
      projectTitle: projectTitle,
      details: details,
    });
  } catch (e) {
    console.error("Lỗi khi thêm log:", e);
  }
}

// ===== Render log entry (mới) =====
function renderLog(docSnap) {
  const logData = docSnap.data();
  const logDiv = document.createElement("div");
  logDiv.className = "p-2 mb-1 rounded-md text-sm";
  let color = "bg-gray-100";
  let icon = "📝";

  if (logData.action === "thêm") {
    color = "bg-green-100";
    icon = "➕";
  } else if (logData.action === "chỉnh sửa") {
    color = "bg-yellow-100";
    icon = "✏️";
  } else if (logData.action === "xóa") {
    color = "bg-red-100";
    icon = "🗑️";
  } else if (logData.action === "sao chép") {
    color = "bg-blue-100";
    icon = "�";
  }

  logDiv.classList.add(color);

  const timestamp = logData.timestamp?.toDate ? logData.timestamp.toDate().toLocaleString("vi-VN") : "không rõ";
  logDiv.innerHTML = `
    <span class="font-semibold text-gray-700">${icon} ${logData.user}</span>
    đã ${logData.action} dự án
    "<span class="font-semibold text-blue-700">${logData.projectTitle}</span>"
    vào lúc <span class="text-gray-500">${timestamp}</span>.
  `;
  logArea.prepend(logDiv); // Thêm vào đầu để log mới nhất ở trên cùng
}

// ===== Real-time listener cho log (mới) =====
function setupLogListener() {
  const logsCol = collection(db, "history");
  const q = query(logsCol, orderBy("timestamp", "desc"));

  onSnapshot(q, (snapshot) => {
    logArea.innerHTML = "";
    snapshot.forEach((doc) => {
      renderLog(doc);
    });
  });
}

// ===== Xóa toàn bộ log (chỉ Admin) (mới) =====
async function deleteAllLogs() {
  const user = auth.currentUser;
  const adminEmail = "admin@example.com"; // Thay đổi email này thành email admin của bạn
  if (!user || user.email !== adminEmail) {
    alert("Bạn không có quyền thực hiện chức năng này.");
    return;
  }

  if (!confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử thay đổi dự án? Hành động này không thể hoàn tác.")) {
    return;
  }

  try {
    const logsQuery = query(collection(db, "history"));
    const snapshot = await getDocs(logsQuery);
    const batch = writeBatch(db);

    snapshot.docs.forEach((d) => {
      batch.delete(d.ref);
    });

    await batch.commit();
    console.log("Đã xóa toàn bộ lịch sử thay đổi.");
  } catch (e) {
    console.error("Lỗi khi xóa toàn bộ lịch sử:", e);
  }
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
    snapshot.forEach((doc) => {
      renderProject(doc);
    });

    // Events
    document.querySelectorAll(".edit-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const id = e.currentTarget.dataset.id;
        const docToEdit = snapshot.docs.find((d) => d.id === id);
        if (docToEdit) {
          editProject(id, docToEdit.data());
        }
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
        const docToCopy = snapshot.docs.find((d) => d.id === id);
        if (docToCopy) {
          copyProject(id, docToCopy.data());
        }
      });
    });

    document.querySelectorAll(".view-tasks-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const id = e.currentTarget.dataset.id;
        const docToView = snapshot.docs.find((d) => d.id === id);
        if (docToView) {
          const projectTitle = docToView.data().title;
          openedProjectId = id; // nhớ dự án đang mở
          console.log("Viewing tasks for project:", id);
          showTaskBoard(id, projectTitle);
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

  if (!title) {
    console.error("Please enter a project title.");
    return;
  }

  try {
    if (isEditing) {
      const projectDocRef = doc(db, "projects", currentProjectId);
      await updateDoc(projectDocRef, {
        title,
        description,
        startDate,
        endDate,
        comment,
        updatedAt: new Date()
      });
      // Ghi log chỉnh sửa
      addLogEntry("chỉnh sửa", `Cập nhật dự án`, title);
    } else {
      await addDoc(collection(db, "projects"), {
        title,
        description,
        startDate,
        endDate,
        comment,
        createdAt: new Date(),
        createdBy: auth.currentUser ? auth.currentUser.email : "Ẩn danh"
      });
      // Ghi log thêm mới
      addLogEntry("thêm", `Tạo dự án mới`, title);
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
  newProjectTitleInput.value = `${data.title} (Bản sao)`;
  showModal("copyModal");
}

// Helper: (tuỳ chọn) copy subcollections của task nếu bạn có dùng
async function copyTaskSubcollections(oldTaskId, newTaskId) {
  const subs = [];
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
    if (!newTitle) {
      console.error("Vui lòng nhập tên cho dự án mới.");
      return;
    }

    confirmCopyBtn.disabled = true;

    try {
      const user = auth.currentUser;
      const srcDoc = await getDoc(doc(db, "projects", currentProjectId));
      if (!srcDoc.exists()) throw new Error("Dự án gốc không tồn tại.");
      const src = srcDoc.data() || {};

      // 1) Tạo project mới (làm sạch metadata cũ)
      const { createdAt, updatedAt, createdBy, ...rest } = src;
      const newProjectRef = await addDoc(collection(db, "projects"), {
        ...rest,
        title: newTitle,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: user ? user.email : "Ẩn danh"
      });
      const newProjectId = newProjectRef.id;

      // 2) Copy GROUPS trước, tạo map oldGroupId -> newGroupId
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

      // 3) Copy TASKS (remap projectId & groupId nếu có)
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
      
      // Ghi log sao chép
      addLogEntry("sao chép", `Sao chép dự án "${src.title}" thành`, newTitle);

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
    const projectDoc = await getDoc(doc(db, "projects", currentProjectId));
    const projectTitle = projectDoc.exists() ? projectDoc.data().title : "Không rõ";

    // Find and delete all tasks associated with the project
    const tasksQuery = query(collection(db, "tasks"), where("projectId", "==", currentProjectId));
    const tasksSnapshot = await getDocs(tasksQuery);
    const tasksToDelete = tasksSnapshot.docs.map((docu) => deleteDoc(docu.ref));
    await Promise.all(tasksToDelete);

    // Find and delete all groups associated with the project
    const groupsQuery = query(collection(db, "groups"), where("projectId", "==", currentProjectId));
    const groupsSnapshot = await getDocs(groupsQuery);
    const groupsToDelete = groupsSnapshot.docs.map((docu) => deleteDoc(docu.ref));
    await Promise.all(groupsToDelete);

    // Find and delete all logs associated with the project
    const logsQuery = query(collection(db, "logs"), where("projectId", "==", currentProjectId));
    const logsSnapshot = await getDocs(logsQuery);
    const logsToDelete = logsSnapshot.docs.map((docu) => deleteDoc(docu.ref));
    await Promise.all(logsToDelete);
    // ✅ Delete all progress_history
    const progressQuery = query(collection(db, "progress_history"), where("projectId", "==", currentProjectId));
    const progressSnapshot = await getDocs(progressQuery);
    await Promise.all(progressSnapshot.docs.map((docu) => deleteDoc(docu.ref)));
    // Finally, delete the project document itself
    await deleteDoc(doc(db, "projects", currentProjectId));
    // Ghi log xóa
    addLogEntry("xóa", `Xóa dự án và toàn bộ dữ liệu liên quan`, projectTitle);

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

// ===== Auth listener =====
auth.onAuthStateChanged((user) => {
  if (user) {
    addProjectBtn.classList.remove("hidden");
    setupProjectListener();
    setupLogListener();
    // Ẩn/hiện nút xóa log
    const adminEmail = "admin@example.com";
    if (user.email === adminEmail) {
      clearLogsBtn.classList.remove("hidden");
    } else {
      clearLogsBtn.classList.add("hidden");
    }
  } else {
    projectArea.innerHTML = "";
    addProjectBtn.classList.add("hidden");
  }
});

// ===== Thêm các sự kiện cho log (mới) =====
toggleLogBtn.addEventListener("click", () => {
  logArea.classList.toggle("hidden");
  if (logArea.classList.contains("hidden")) {
    toggleLogBtn.textContent = "Hiện lịch sử";
  } else {
    toggleLogBtn.textContent = "Ẩn lịch sử";
  }
});

clearLogsBtn.addEventListener("click", deleteAllLogs);
�
