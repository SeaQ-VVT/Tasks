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

// ===== LOG SYSTEM =====
async function addProjectLog(projectId, action, details = "") {
  const user = auth.currentUser;
  await addDoc(collection(db, "project_logs"), {
    projectId,
    action,
    details,
    user: user ? user.email : "Ẩn danh",
    createdAt: serverTimestamp()
  });
}

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
    collection(db, "project_logs"),
    where("projectId", "==", projectId),
    orderBy("createdAt", "desc")
  );

  onSnapshot(q, (snap) => {
    logsDiv.innerHTML = "";
    snap.forEach((docu) => {
      const log = docu.data();
      const time = log.createdAt?.toDate ? log.createdAt.toDate().toLocaleString() : "-";
      const item = document.createElement("div");
      item.className = "text-sm border-b py-1 flex justify-between";
      item.innerHTML = `
        <span><b>${displayName(log.user)}</b> ${log.action} ${log.details || ""} (${time})</span>
        ${isAdmin ? `<button class="delete-log-btn text-red-500" data-id="${docu.id}">❌</button>` : ""}
      `;
      logsDiv.appendChild(item);
    });

    if (isAdmin) {
      logsDiv.querySelectorAll(".delete-log-btn").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          const logId = e.currentTarget.dataset.id;
          await deleteDoc(doc(db, "project_logs", logId));
        });
      });
    }
  });
}

// ===== Render project card =====
function renderProject(docSnap) {
  const data = docSnap.data();
  const id = docSnap.id;

  const projectCard = document.createElement("div");
  projectCard.className = "bg-white p-6 rounded-lg shadow-md border mb-4";

  const createdAt = data.createdAt?.toDate ? data.createdAt.toDate().toLocaleString() : "-";

  projectCard.innerHTML = `
    <h4 class="text-xl font-semibold text-blue-700 mb-2">${data.title}</h4>
    <p class="text-gray-600 mb-2">${data.description || "Chưa có mô tả."}</p>
    <p class="text-gray-500 text-sm"><b>Bắt đầu:</b> ${data.startDate || "-"}</p>
    <p class="text-gray-500 text-sm"><b>Kết thúc:</b> ${data.endDate || "-"}</p>
    <p class="text-gray-500 text-sm"><b>Ghi chú:</b> ${data.comment || "-"}</p>
    <p class="text-gray-500 text-sm"><b>Người tạo:</b> ${displayName(data.createdBy)}</p>
    <p class="text-gray-500 text-sm"><b>Ngày tạo:</b> ${createdAt}</p>
  `;
  projectArea.appendChild(projectCard);

  // render log riêng trên cùng
  const isAdmin = auth.currentUser?.email === "admin@gmail.com"; // check admin
  renderLogs(id, projectCard, isAdmin);

  // buttons
  const btns = document.createElement("div");
  btns.className = "flex space-x-2 mt-2";
  btns.innerHTML = `
    <button data-id="${id}" class="view-tasks-btn bg-blue-500 text-white px-3 py-1 rounded-md text-sm">👁️</button>
    <button data-id="${id}" class="copy-btn bg-green-500 text-white px-3 py-1 rounded-md text-sm">📋</button>
    <button data-id="${id}" class="edit-btn bg-yellow-500 text-white px-3 py-1 rounded-md text-sm">✏️</button>
    <button data-id="${id}" class="delete-btn bg-red-500 text-white px-3 py-1 rounded-md text-sm">🗑️</button>
  `;
  projectCard.appendChild(btns);
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
        const id = e.currentTarget.dataset.id;
        showDeleteConfirmation(id);
      });
    });

    document.querySelectorAll(".copy-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const id = e.currentTarget.dataset.id;
        const docToCopy = snapshot.docs.find((d) => d.id === id);
        if (docToCopy) {
          await copyProject(id, docToCopy.data());
        }
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
  if (!title) return;

  try {
    const user = auth.currentUser;
    if (isEditing) {
      const projectDocRef = doc(db, "projects", currentProjectId);
      await updateDoc(projectDocRef, { title, description, startDate, endDate, comment, updatedAt: new Date() });
      await addProjectLog(currentProjectId, "cập nhật dự án", `(${title})`);
    } else {
      const newProject = await addDoc(collection(db, "projects"), {
        title,
        description,
        startDate,
        endDate,
        comment,
        createdAt: new Date(),
        createdBy: user ? user.email : "Ẩn danh"
      });
      await addProjectLog(newProject.id, "tạo dự án", `(${title})`);
    }
    hideModal("projectModal");
  } catch (e) { console.error("Error add/update:", e); }
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

  try {
    const { createdAt, updatedAt, createdBy, ...rest } = data;
    const newProjectRef = await addDoc(collection(db, "projects"), {
      ...rest,
      title: newTitle,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: user ? user.email : "Ẩn danh"
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
    await deleteDoc(doc(db, "projects", currentProjectId));
    await addProjectLog(currentProjectId, "xóa dự án");
    if (openedProjectId === currentProjectId) {
      const taskBoard = document.getElementById("taskBoard");
      if (taskBoard) taskBoard.innerHTML = "";
      openedProjectId = null;
    }
    hideModal("deleteModal");
  } catch (e) { console.error("Error deleting project:", e); }
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
