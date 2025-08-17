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
    orderBy
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
// Thêm import showTaskBoard
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

let isEditing = false;
let currentProjectId = null;

// ===== Utility =====
function showModal(modalId) {
    document.getElementById(modalId).classList.remove('hidden');
    document.getElementById(modalId).classList.add('flex');
}

function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

// ===== Render project card =====
function renderProject(doc) {
    const data = doc.data();
    const id = doc.id;

    const projectCard = document.createElement("div");
    projectCard.className =
        "bg-white p-6 rounded-lg shadow-md border border-gray-200 transition-transform transform hover:scale-105 mb-4";

    const createdAt = data.createdAt?.toDate
        ? data.createdAt.toDate().toLocaleString()
        : "-";

    projectCard.innerHTML = `
        <h4 class="text-xl font-semibold text-blue-700 mb-2">${data.title}</h4>
        <p class="text-gray-600 mb-2">${data.description || "Chưa có mô tả."}</p>
        <p class="text-gray-500 text-sm"><b>Bắt đầu:</b> ${data.startDate || "-"}</p>
        <p class="text-gray-500 text-sm"><b>Kết thúc:</b> ${data.endDate || "-"}</p>
        <p class="text-gray-500 text-sm"><b>Ghi chú:</b> ${data.comment || "-"}</p>
        <p class="text-gray-500 text-sm"><b>Người tạo:</b> ${data.createdBy || "Không rõ"}</p>
        <p class="text-gray-500 text-sm mb-4"><b>Ngày tạo:</b> ${createdAt}</p>
        <div class="flex space-x-2 mt-2">
            <button data-id="${id}" class="view-tasks-btn bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-md text-sm">Xem công việc</button>
            <button data-id="${id}" class="edit-btn bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded-md text-sm">Sửa</button>
            <button data-id="${id}" class="delete-btn bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-md text-sm">Xóa</button>
        </div>
    `;
    projectArea.appendChild(projectCard);
}

// ===== Real-time listener =====
function setupProjectListener() {
    const projectsCol = collection(db, "projects");
    const q = query(projectsCol, orderBy("createdAt", "desc"));

    onSnapshot(q, (snapshot) => {
        projectArea.innerHTML = ""; // Xóa danh sách cũ
        snapshot.forEach((doc) => {
            renderProject(doc);
        });

        // Thêm sự kiện cho các nút
        document.querySelectorAll(".edit-btn").forEach((btn) => {
            btn.addEventListener("click", (e) => {
                const id = e.target.dataset.id;
                const docToEdit = snapshot.docs.find((d) => d.id === id);
                if (docToEdit) {
                    editProject(id, docToEdit.data());
                }
            });
        });

        document.querySelectorAll(".delete-btn").forEach((btn) => {
            btn.addEventListener("click", (e) => {
                const id = e.target.dataset.id;
                showDeleteConfirmation(id);
            });
        });

        // Sửa đoạn code này để truyền tên dự án
        document.querySelectorAll(".view-tasks-btn").forEach((btn) => {
            btn.addEventListener("click", (e) => {
                const id = e.target.dataset.id;
                const docToView = snapshot.docs.find((d) => d.id === id);
                if (docToView) {
                    const projectTitle = docToView.data().title;
                    console.log("Xem công việc cho project:", id);
                    showTaskBoard(id, projectTitle); // Truyền thêm tiêu đề
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
        alert("Vui lòng nhập tên dự án.");
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
        } else {
            await addDoc(collection(db, "projects"), {
                title,
                description,
                startDate,
                endDate,
                comment,
                createdAt: new Date(),
                createdBy: user ? user.email : "Ẩn danh",
            });
        }

        // Reset & close modal
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
        await deleteDoc(doc(db, "projects", currentProjectId));
        hideModal("deleteModal");
    } catch (e) {
        console.error("Error deleting project: ", e);
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
