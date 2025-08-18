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
import { getAuth, signInWithCustomToken, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

// Import showTaskBoard
import { showTaskBoard } from "./tasks.js"; // Giả định file tasks.js tồn tại và có hàm này

// ===== Firebase config and Init Firebase =====
const firebaseConfig = {
  apiKey: "AIzaSyCW49METqezYoUKSC1N0Pi3J83Ptsf9hA8",
  authDomain: "task-manager-d18aa.firebaseapp.com",
  projectId: "task-manager-d18aa",
  storageBucket: "task-manager-d18aa.appspot.com",
  messagingSenderId: "1080268498085",
  appId: "1:1080268498085:web:767434c6a2c013b961d94c"
};

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

// ===== State =====
let isEditing = false;
let currentProjectId = null;
let openedProjectId = null;

// Lấy appId từ biến toàn cục
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// Sử dụng đường dẫn collection đúng
const projectsCollection = `artifacts/${appId}/public/data/projects`;
const logsCollection = `artifacts/${appId}/public/data/project_logs`;

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

// ===== LOG SYSTEM =====
async function addProjectLog(projectId, action, details = "") {
  const user = auth.currentUser;
  try {
    await addDoc(collection(db, logsCollection), {
      projectId,
      action,
      details,
      user: user ? user.email : "Ẩn danh",
      createdAt: serverTimestamp()
    });
  } catch (e) {
    console.error("Error adding log:", e);
  }
}

// Hàm renderLogs đã được sửa lại để lắng nghe một cách hiệu quả hơn
function renderLogs(projectId, container, isAdmin) {
  const logWrapper = document.createElement("div");
  logWrapper.className = "border p-2 mb-2 rounded bg-gray-50";
  logWrapper.innerHTML = `
    <button class="toggle-log-btn bg-gray-200 px-2 py-1 rounded text-sm">📜 Hiện log</button>
    <div class="logs hidden mt-2"></div>
  `;
  container.prepend(logWrapper);

  const logsDiv = logWrapper.querySelector(".logs");
  const toggleBtn = logWrapper.querySelector(".toggle-log-btn");

  toggleBtn.addEventListener("click", () => {
    logsDiv.classList.toggle("hidden");
    toggleBtn.textContent = logsDiv.classList.contains("hidden") ? "📜 Hiện log" : "📜 Ẩn log";
  });

  const q = query(
    collection(db, logsCollection),
    where("projectId", "==", projectId),
    orderBy("createdAt", "desc")
  );

  onSnapshot(q, (snap) => {
    logsDiv.innerHTML = "";
    snap.forEach((docu) => {
      const log = docu.data();
      const time = log.createdAt?.toDate ? log.createdAt.toDate().toLocaleString('vi-VN') : "-";
      const item = document.createElement("div");
      item.className = "text-sm border-b py-1 flex justify-between";
      item.innerHTML = `
        <span><b>${displayName(log.user)}</b> ${log.action} ${log.details || ""} (${time})</span>
        ${isAdmin ? `<button class="delete-log-btn text-red-500" data-id="${docu.id}">❌</button>` : ""}
      `;
      logsDiv.appendChild(item);
    });
  }, (error) => {
      console.error("Error getting project logs:", error);
      logsDiv.innerHTML = `<p class="text-red-500 text-sm">Lỗi khi tải lịch sử hoạt động.</p>`;
  });
  
  // SỬA: Gắn sự kiện ủy quyền cho các nút xóa log chỉ một lần
  if (isAdmin) {
    logWrapper.addEventListener("click", async (e) => {
      const targetBtn = e.target.closest(".delete-log-btn");
      if (!targetBtn) return;
      const logId = targetBtn.dataset.id;
      try {
          await deleteDoc(doc(db, logsCollection, logId));
      } catch (error) {
          console.error("Lỗi khi xóa log:", error);
      }
    });
  }
}

// ===== Render project card =====
function renderProject(docSnap) {
  const data = docSnap.data();
  const id = docSnap.id;
  const user = auth.currentUser;
  const isAdmin = user && user.email === "admin@gmail.com";
  const isOwner = user && data.createdBy === user.email;

  const projectCard = document.createElement("div");
  projectCard.className = "bg-white p-6 rounded-lg shadow-md border mb-4";
  projectCard.dataset.projectId = id;

  const createdAt = data.createdAt?.toDate ? data.createdAt.toDate().toLocaleString('vi-VN') : "-";
  const updatedAt = data.updatedAt?.toDate ? data.updatedAt.toDate().toLocaleString('vi-VN') : "-";
  
  projectCard.innerHTML = `
    <h4 class="text-xl font-semibold text-blue-700 mb-2">${data.title}</h4>
    <p class="text-gray-600 mb-2">${data.description || "Chưa có mô tả."}</p>
    <div class="text-gray-500 text-sm grid grid-cols-2 gap-2">
        <p><b>Bắt đầu:</b> ${data.startDate || "-"}</p>
        <p><b>Kết thúc:</b> ${data.endDate || "-"}</p>
        <p class="col-span-2"><b>Ghi chú:</b> ${data.comment || "-"}</p>
        <p><b>Người tạo:</b> ${displayName(data.createdBy)}</p>
        <p><b>Ngày tạo:</b> ${createdAt}</p>
        ${updatedAt !== createdAt ? `<p class="col-span-2"><b>Cập nhật:</b> ${updatedAt}</p>` : ""}
    </div>
    <div class="flex space-x-2 mt-4">
        <button class="view-tasks-btn bg-blue-500 text-white px-3 py-1 rounded-md text-sm hover:bg-blue-600 transition duration-300">👁️ Chi tiết</button>
        ${isOwner || isAdmin ? `<button class="edit-btn bg-yellow-500 text-white px-3 py-1 rounded-md text-sm hover:bg-yellow-600 transition duration-300">✏️ Sửa</button>` : ""}
        ${isOwner || isAdmin ? `<button class="delete-btn bg-red-500 text-white px-3 py-1 rounded-md text-sm hover:bg-red-600 transition duration-300">🗑️ Xóa</button>` : ""}
    </div>
  `;
  
  renderLogs(id, projectCard, isAdmin);
  projectArea.appendChild(projectCard);
}

// ===== Real-time listener for projects =====
function setupProjectListener() {
  const projectsCol = collection(db, projectsCollection);
  const q = query(projectsCol, orderBy("createdAt", "desc"));
  onSnapshot(q, (snapshot) => {
    projectArea.innerHTML = "";
    if (snapshot.empty) {
        projectArea.innerHTML = `<div class="text-center p-8 text-gray-500">Chưa có dự án nào được tạo.</div>`;
    }
    snapshot.forEach((doc) => renderProject(doc));
  }, (error) => {
    console.error("Error setting up project listener:", error);
    projectArea.innerHTML = `<div class="text-center p-8 text-red-500">Lỗi khi tải dự án. Vui lòng thử lại.</div>`;
  });
}

// ===== Event Delegation for Project Actions =====
projectArea.addEventListener('click', async (e) => {
    const targetBtn = e.target.closest('.edit-btn, .delete-btn, .view-tasks-btn');
    if (!targetBtn) return;

    const card = targetBtn.closest('[data-project-id]');
    const id = card.dataset.projectId;

    if (targetBtn.classList.contains('edit-btn')) {
        const docRef = doc(db, projectsCollection, id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            editProject(id, docSnap.data());
        }
    } else if (targetBtn.classList.contains('delete-btn')) {
        showDeleteConfirmation(id);
    } else if (targetBtn.classList.contains('view-tasks-btn')) {
        const docRef = doc(db, projectsCollection, id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const projectTitle = docSnap.data().title;
            openedProjectId = id;
            // Placeholder for task board logic, assuming tasks.js exists and is handled.
            showTaskBoard(id, projectTitle);
        }
    }
});

// ===== Add / Update project =====
saveProjectBtn.addEventListener("click", async () => {
    const title = projectTitleInput.value.trim();
    const description = projectDescriptionInput.value.trim();
    const startDate = projectStartInput.value;
    const endDate = projectEndInput.value;
    const comment = projectCommentInput.value.trim();
    if (!title) {
        console.error("Tiêu đề dự án không được để trống!");
        return;
    }
    
    const user = auth.currentUser;
    if (!user) {
        console.error("User not authenticated.");
        return;
    }

    try {
        if (isEditing) {
            const projectDocRef = doc(db, projectsCollection, currentProjectId);
            await updateDoc(projectDocRef, {
                title,
                description,
                startDate,
                endDate,
                comment,
                updatedAt: serverTimestamp()
            });
            await addProjectLog(currentProjectId, "cập nhật dự án", `(${title})`);
        } else {
            const newProject = await addDoc(collection(db, projectsCollection), {
                title,
                description,
                startDate,
                endDate,
                comment,
                createdBy: user.email,
                createdAt: serverTimestamp()
            });
            await addProjectLog(newProject.id, "tạo dự án", `(${title})`);
        }
        hideModal("projectModal");
    } catch (e) {
        console.error("Error add/update:", e);
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
async function copyProject(id, data) {
    const user = auth.currentUser;
    const newTitle = `${data.title} (Copy)`;
    if (!user) {
        console.error("User not authenticated.");
        return;
    }

    try {
        const { createdAt, updatedAt, createdBy, ...rest } = data;
        const newProjectRef = await addDoc(collection(db, projectsCollection), {
            ...rest,
            title: newTitle,
            createdAt: serverTimestamp(),
            createdBy: user.email
        });

        await addProjectLog(newProjectRef.id, "sao chép dự án", `từ (${data.title}) sang (${newTitle})`);
    } catch (e) {
        console.error("Lỗi khi sao chép dự án:", e);
    }
}

// ===== Delete project =====
function showDeleteConfirmation(id) {
    currentProjectId = id;
    showModal("deleteModal");
}

confirmDeleteBtn.addEventListener("click", async () => {
    try {
        const docRef = doc(db, projectsCollection, currentProjectId);
        const docSnap = await getDoc(docRef);
        const projectData = docSnap.data();

        const user = auth.currentUser;
        const isAdmin = user && user.email === "admin@gmail.com";
        const isOwner = user && projectData.createdBy === user.email;

        if (!isAdmin && !isOwner) {
            console.error("Permission denied. User is not the owner or an admin.");
            hideModal("deleteModal");
            return;
        }

        await deleteDoc(doc(db, projectsCollection, currentProjectId));
        await addProjectLog(currentProjectId, "xóa dự án");
        
        // Also delete all associated logs
        const logsToDelete = await getDocs(query(collection(db, logsCollection), where("projectId", "==", currentProjectId)));
        logsToDelete.forEach(async (logDoc) => {
            await deleteDoc(doc(db, logsCollection, logDoc.id));
        });
        
        // Close task board if the deleted project was open
        if (openedProjectId === currentProjectId) {
            // Placeholder for task board logic
            const taskBoard = document.getElementById("taskBoard");
            if (taskBoard) taskBoard.innerHTML = "";
            openedProjectId = null;
        }

        hideModal("deleteModal");
    } catch (e) {
        console.error("Error deleting project:", e);
    }
});

cancelDeleteBtn.addEventListener("click", () => hideModal("deleteModal"));
cancelProjectBtn.addEventListener("click", () => hideModal("projectModal"));

// ===== Add project modal =====
addProjectBtn.addEventListener("click", () => {
  isEditing = false;
  currentProjectId = null;
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

const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
if (initialAuthToken) {
    signInWithCustomToken(auth, initialAuthToken).catch((error) => {
        console.error("Error signing in with custom token:", error);
        signInAnonymously(auth);
    });
} else {
    signInAnonymously(auth).catch((error) => {
        console.error("Error signing in anonymously:", error);
    });
}
