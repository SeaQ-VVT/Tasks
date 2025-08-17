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
  appId: "1:1080268498085:web:767434c6a2c0"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth();

// ===== DOM elements =====
const projectList = document.getElementById("projectList");
const addProjectBtn = document.getElementById("addProjectBtn");
const projectModal = document.getElementById("projectModal");
const projectModalTitle = document.getElementById("projectModalTitle");
const projectForm = document.getElementById("projectForm");
const projectTitleInput = document.getElementById("projectTitle");
const projectDescriptionInput = document.getElementById("projectDescription");
const projectStartInput = document.getElementById("projectStart");
const projectEndInput = document.getElementById("projectEnd");
const projectCommentInput = document.getElementById("projectComment");
const cancelProjectBtn = document.getElementById("cancelProjectBtn");
const deleteModal = document.getElementById("deleteModal");
const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");
const logoutBtn = document.getElementById("logoutBtn");
const toggleThemeBtn = document.getElementById("toggleThemeBtn");

let isEditing = false;
let currentProjectId = null;
let currentUser = null;

// ===== Helper functions =====
const showModal = (modalId) => {
  document.getElementById(modalId).classList.remove("hidden");
  document.getElementById(modalId).classList.add("flex");
};

const hideModal = (modalId) => {
  document.getElementById(modalId).classList.add("hidden");
  document.getElementById(modalId).classList.remove("flex");
};

const logAction = async (projectId, message) => {
  await addDoc(collection(db, "logs"), {
    projectId: projectId,
    message: message,
    timestamp: serverTimestamp(),
    user: currentUser?.email || "Ẩn danh"
  });
};

const deleteProject = (projectId) => {
  currentProjectId = projectId;
  showModal("deleteModal");
};

// ===== Show projects in UI =====
const renderProjects = (projects) => {
  projectList.innerHTML = "";
  if (projects.length === 0) {
    projectList.innerHTML = "<p class='text-center text-gray-500 dark:text-gray-400'>Không có dự án nào.</p>";
    return;
  }
  projects.forEach((project) => {
    const projectItem = document.createElement("div");
    projectItem.className = "bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow duration-300 cursor-pointer relative group";
    projectItem.innerHTML = `
      <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-2">${project.title}</h3>
      <p class="text-gray-600 dark:text-gray-400 mb-2">${project.description}</p>
      <div class="text-sm text-gray-500 dark:text-gray-400">
        <p>Bắt đầu: ${project.startDate || "N/A"}</p>
        <p>Kết thúc: ${project.endDate || "N/A"}</p>
      </div>
      <div class="absolute top-2 right-2 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <button class="edit-btn text-blue-500 hover:text-blue-700" data-id="${project.id}">
          <i class="fas fa-edit"></i>
        </button>
        <button class="delete-btn text-red-500 hover:text-red-700" data-id="${project.id}">
          <i class="fas fa-trash-alt"></i>
        </button>
      </div>
    `;
    projectItem.addEventListener("click", (e) => {
      if (!e.target.closest(".edit-btn") && !e.target.closest(".delete-btn")) {
        showTaskBoard(project.id, project.title);
      }
    });
    projectItem.querySelector(".edit-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      editProject(project);
    });
    projectItem.querySelector(".delete-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      deleteProject(project.id);
    });
    projectList.appendChild(projectItem);
  });
};

// ===== Add/Update project =====
projectForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = projectTitleInput.value;
  const description = projectDescriptionInput.value;
  const startDate = projectStartInput.value;
  const endDate = projectEndInput.value;
  const comment = projectCommentInput.value;

  if (isEditing) {
    const projectRef = doc(db, "projects", currentProjectId);
    await updateDoc(projectRef, {
      title,
      description,
      startDate,
      endDate,
      comment,
      updatedAt: serverTimestamp(),
      updatedBy: currentUser?.email || "Ẩn danh"
    });
    await logAction(currentProjectId, `cập nhật dự án "${title}"`);
    isEditing = false;
  } else {
    const newProject = {
      title,
      description,
      startDate,
      endDate,
      comment,
      createdAt: serverTimestamp(),
      createdBy: currentUser?.email || "Ẩn danh"
    };
    const docRef = await addDoc(collection(db, "projects"), newProject);
    await logAction(docRef.id, `tạo dự án mới "${title}"`);
  }
  hideModal("projectModal");
  projectForm.reset();
});

// ===== Edit project modal =====
const editProject = async (project) => {
  isEditing = true;
  currentProjectId = project.id;
  projectModalTitle.textContent = "Chỉnh sửa dự án";
  projectTitleInput.value = project.title;
  projectDescriptionInput.value = project.description;
  projectStartInput.value = project.startDate;
  projectEndInput.value = project.endDate;
  projectCommentInput.value = project.comment;
  showModal("projectModal");
};

// ===== Delete project and all associated data =====
confirmDeleteBtn.addEventListener("click", async () => {
  try {
    // Tìm và xóa tất cả tasks liên quan đến dự án
    const tasksQuery = query(collection(db, "tasks"), where("projectId", "==", currentProjectId));
    const tasksSnapshot = await getDocs(tasksQuery);
    const tasksToDelete = tasksSnapshot.docs.map((docu) => deleteDoc(docu.ref));
    await Promise.all(tasksToDelete);

    // Tìm và xóa tất cả groups liên quan đến dự án
    const groupsQuery = query(collection(db, "groups"), where("projectId", "==", currentProjectId));
    const groupsSnapshot = await getDocs(groupsQuery);
    const groupsToDelete = groupsSnapshot.docs.map((docu) => deleteDoc(docu.ref));
    await Promise.all(groupsToDelete);

    // Tìm và xóa tất cả logs liên quan đến dự án
    const logsQuery = query(collection(db, "logs"), where("projectId", "==", currentProjectId));
    const logsSnapshot = await getDocs(logsQuery);
    const logsToDelete = logsSnapshot.docs.map((docu) => deleteDoc(docu.ref));
    await Promise.all(logsToDelete);
    
    // Tìm và xóa tất cả lịch sử tiến độ liên quan đến dự án
    const progressQuery = query(collection(db, "progress_history"), where("projectId", "==", currentProjectId));
    const progressSnapshot = await getDocs(progressQuery);
    const progressToDelete = progressSnapshot.docs.map((docu) => deleteDoc(docu.ref));
    await Promise.all(progressToDelete);
    
    // Cuối cùng, xóa tài liệu dự án
    await deleteDoc(doc(db, "projects", currentProjectId));

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
    currentUser = user;
    const q = query(collection(db, "projects"), where("createdBy", "==", currentUser.email || "Ẩn danh"), orderBy("createdAt", "desc"));
    onSnapshot(q, (snapshot) => {
      let projects = [];
      snapshot.forEach((doc) => {
        projects.push({ ...doc.data(), id: doc.id });
      });
      renderProjects(projects);
    });
  } else {
    // Xử lý khi người dùng chưa đăng nhập, nếu cần
  }
});

// ===== Theme toggle =====
toggleThemeBtn.addEventListener("click", () => {
  document.documentElement.classList.toggle("dark");
});
