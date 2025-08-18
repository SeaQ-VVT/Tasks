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
  appId: "1:1080268498085:web:767434c6a2c013b961d94c",
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
// ===== NEW: Log elements =====
const toggleLogBtn = document.getElementById("toggleLogBtn");
const logContent = document.getElementById("logContent");
const deleteLogsBtn = document.getElementById("deleteLogsBtn");
// ===== END NEW: Log elements =====

// Copy modal elements (tạo nếu chưa có)
let copyModal = document.getElementById("copyModal");
let newProjectTitleInput = document.getElementById("newProjectTitle");
let confirmCopyBtn = document.getElementById("confirmCopyBtn");
let cancelCopyBtn = document.getElementById("cancelCopyBtn");

function ensureCopyModal() {
  if (copyModal && newProjectTitleInput && confirmCopyBtn && cancelCopyBtn)
    return;

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
// >>> NEW: nhớ dự án đang mở để không bị nhảy sang dự án khác khi realtime update
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

// ===== NEW: Log activity function =====
async function logActivity(projectId, action, details) {
  const user = auth.currentUser;
  const logData = {
    projectId,
    action,
    details,
    userEmail: user ? user.email : "Ẩn danh", // Cập nhật để ghi lại email người dùng
    timestamp: serverTimestamp(),
  };

  try {
    await addDoc(collection(db, "logs"), logData);
  } catch (e) {
    console.error("Error writing log: ", e);
  }
}

// ===== NEW: Render log entry =====
function renderLog(log) {
  const li = document.createElement("div");
  li.className = "log-entry p-4 flex flex-col sm:flex-row sm:items-center justify-between";
  const user = displayName(log.userEmail);
  const time = log.timestamp?.toDate ? log.timestamp.toDate().toLocaleString("vi-VN") : "Đang cập nhật...";

  li.innerHTML = `
    <div class="flex items-center space-x-2 mb-2 sm:mb-0">
      <span class="font-bold text-gray-800">${user}</span>
      <span class="text-gray-500 text-sm">đã ${log.action}</span>
      <span class="text-sm font-medium text-gray-700">${log.details}</span>
    </div>
    <span class="text-xs text-gray-400 mt-1 sm:mt-0">${time}</span>
  `;
  return li;
}

// ===== NEW: Log listener =====
function setupLogListener() {
  if (!openedProjectId) {
    logContent.innerHTML =
      '<p class="text-gray-500 text-center py-4">Chưa có dự án nào được chọn.</p>';
    return;
  }

  const logsCol = collection(db, "logs");
  const q = query(
    logsCol,
    where("projectId", "==", openedProjectId),
    orderBy("timestamp", "desc")
  );

  onSnapshot(q, (snapshot) => {
    logContent.innerHTML = "";
    if (snapshot.empty) {
      logContent.innerHTML =
        '<p class="text-gray-500 text-center py-4">Chưa có hoạt động nào được ghi lại.</p>';
    } else {
      snapshot.forEach((doc) => {
        logContent.appendChild(renderLog(doc.data()));
      });
    }

    // Check for admin to show delete button
    const user = auth.currentUser;
    // NOTE: Cần thay 'admin@example.com' bằng email admin thực tế
    // Đây là cách đơn giản, trong thực tế nên dùng Role-Based Access Control (RBAC)
    if (user && user.email === 'admin@example.com') {
        deleteLogsBtn.classList.remove('hidden');
    } else {
        deleteLogsBtn.classList.add('hidden');
    }
  });
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
    // Chỉ render lại danh sách thẻ dự án, KHÔNG đụng taskBoard
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
          // NEW: Cập nhật logs khi chuyển dự án
          setupLogListener(); 
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
    const user = auth.currentUser;

    if (isEditing) {
      const projectDocRef = doc(db, "projects", currentProjectId);
      await updateDoc(projectDocRef, {
        title,
        description,
        startDate,
        endDate,
        comment,
        updatedAt: new Date(),
      });
      // NEW: Ghi log khi cập nhật dự án
      await logActivity(currentProjectId, "cập nhật dự án", `Tiêu đề: ${title}`);
    } else {
      const newProjectRef = await addDoc(collection(db, "projects"), {
        title,
        description,
        startDate,
        endDate,
        comment,
        createdAt: new Date(),
        createdBy: user ? user.email : "Ẩn danh",
      });
      // NEW: Ghi log khi tạo dự án mới
      await logActivity(newProjectRef.id, "tạo dự án mới", `Tiêu đề: ${title}`);
    }

    hideModal("projectModal");
    projectTitleInput.value = "";
    projectDescriptionInput.value = "";
    projectStartInput.value = "";
    projectEndInput.value = "";
    projectCommentInput.value = "";
    // giữ nguyên isEditing theo flow hiện tại
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
  // Nếu không dùng subcollection cho task, bạn có thể bỏ qua function này.
  // Ví dụ các subcollection phổ biến: ["subtasks", "comments", "files"]
  const subs = []; // để trống để không ảnh hưởng logic hiện tại
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
        updatedAt: serverTimestamp(),
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
        createdBy: user ? user.email : "Ẩn danh",
      });
      const newProjectId = newProjectRef.id;
      // NEW: Ghi log khi sao chép dự án
      await logActivity(
        newProjectId,
        "sao chép dự án",
        `Từ '${src.title}' thành '${newTitle}'`
      );

      // 2) Copy GROUPS trước, tạo map oldGroupId -> newGroupId
      const groupsQ = query(
        collection(db, "groups"),
        where("projectId", "==", currentProjectId)
      );
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
            updatedAt: serverTimestamp(),
          });
          groupIdMap.set(g.id, newGRef.id);
        })
      );

      // 3) Copy TASKS (remap projectId & groupId nếu có)
      const tasksQ = query(
        collection(db, "tasks"),
        where("projectId", "==", currentProjectId)
      );
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
            updatedAt: serverTimestamp(),
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
    const projectDoc = await getDoc(doc(db, "projects", currentProjectId));
    const projectData = projectDoc.data();
    const projectName = projectData ? projectData.title : "dự án không xác định";

    // NEW: Ghi log trước khi xóa
    await logActivity(currentProjectId, "xóa dự án", `Tiêu đề: ${projectName}`);

    // Find and delete all tasks associated with the project
    const tasksQuery = query(
      collection(db, "tasks"),
      where("projectId", "==", currentProjectId)
    );
    const tasksSnapshot = await getDocs(tasksQuery);
    const tasksToDelete = tasksSnapshot.docs.map((docu) => deleteDoc(docu.ref));
    await Promise.all(tasksToDelete);

    // Find and delete all groups associated with the project
    const groupsQuery = query(
      collection(db, "groups"),
      where("projectId", "==", currentProjectId)
    );
    const groupsSnapshot = await getDocs(groupsQuery);
    const groupsToDelete = groupsSnapshot.docs.map((docu) => deleteDoc(docu.ref));
    await Promise.all(groupsToDelete);

    // ✅ Delete all progress_history
    const progressQuery = query(
      collection(db, "progress_history"),
      where("projectId", "==", currentProjectId)
    );
    const progressSnapshot = await getDocs(progressQuery);
    await Promise.all(progressSnapshot.docs.map((docu) => deleteDoc(docu.ref)));

    // ✅ NEW: Delete all logs associated with the project
    const logsQuery = query(
      collection(db, "logs"),
      where("projectId", "==", currentProjectId)
    );
    const logsSnapshot = await getDocs(logsQuery);
    const logsToDelete = logsSnapshot.docs.map((docu) => deleteDoc(docu.ref));
    await Promise.all(logsToDelete);
    // Finally, delete the project document itself
    await deleteDoc(doc(db, "projects", currentProjectId));
    // 🔻 THÊM 4 DÒNG NÀY Ở ĐÂY
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
  } else {
    projectArea.innerHTML = "";
    addProjectBtn.classList.add("hidden");
  }
});

// ===== NEW: Log section events =====
toggleLogBtn.addEventListener('click', () => {
  const isHidden = logContent.classList.contains('hidden');
  if (isHidden) {
    logContent.classList.remove('hidden');
    logContent.classList.add('flex', 'flex-col', 'gap-2');
    toggleLogBtn.textContent = 'Ẩn log';
    // Load logs for the currently opened project
    setupLogListener();
  } else {
    logContent.classList.add('hidden');
    logContent.classList.remove('flex', 'flex-col', 'gap-2');
    toggleLogBtn.textContent = 'Hiện log';
  }
});

deleteLogsBtn.addEventListener('click', async () => {
  if (!openedProjectId) return;
  
  // NOTE: Thay window.confirm bằng một modal tùy chỉnh để đảm bảo nó hoạt động trong mọi môi trường
  const confirmDelete = window.confirm("Bạn có chắc chắn muốn xóa tất cả log của dự án này không?");
  if (!confirmDelete) return;

  try {
    const logsQuery = query(collection(db, "logs"), where("projectId", "==", openedProjectId));
    const logsSnapshot = await getDocs(logsQuery);
    const deletePromises = logsSnapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
    console.log("All logs for this project have been deleted.");
  } catch (e) {
    console.error("Error deleting logs: ", e);
  }
});
