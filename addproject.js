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
      <b>${d.user}</b> đã <i>${d.action}</i> lúc ${time}: ${d.detail}
      ${auth.currentUser?.email === "admin@gmail.com" ? 
        `<button data-logid="${docu.id}" class="delete-project-log text-red-500 ml-2">❌</button>` : ""}
    </li>`;
  });
  html += "</ul>";
  logDiv.innerHTML = html;

  // bind delete log
  logDiv.querySelectorAll(".delete-project-log").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const logId = e.currentTarget.dataset.logid;
      await deleteDoc(doc(db, "project_logs", logId));
      loadProjectLogs();
    });
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

    document.querySelectorAll(".view-tasks-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const id = e.currentTarget.dataset.id;
        const docToView = snapshot.docs.find((d) => d.id === id);
        if (docToView) {
          const projectTitle = docToView.data().title;
          openedProjectId = id;
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
    const user = auth.currentUser;

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
      await addProjectLog(currentProjectId, "update", `Cập nhật dự án: ${title}`);
    } else {
      const ref = await addDoc(collection(db, "projects"), {
        title,
        description,
        startDate,
        endDate,
        comment,
        createdAt: new Date(),
        createdBy: user ? user.email : "Ẩn danh"
      });
      await addProjectLog(ref.id, "create", `Tạo dự án: ${title}`);
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

// ===== Delete project =====
function showDeleteConfirmation(id) {
  currentProjectId = id;
  showModal("deleteModal");
}

confirmDeleteBtn.addEventListener("click", async () => {
  try {
    await addProjectLog(currentProjectId, "delete", "Xóa dự án");
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

// ===== Toggle logs =====
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
