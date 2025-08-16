// Import necessary Firebase SDKs
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

console.log("addproject.js loaded OK");

// Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyCW49METqezYoUKSC1N0Pi3J83Ptsf9hA8",
    authDomain: "task-manager-d18aa.firebaseapp.com",
    projectId: "task-manager-d18aa",
    storageBucket: "task-manager-d18aa.appspot.com",
    messagingSenderId: "1080268498085",
    appId: "1:1080268498085:web:767434c6a2c013b961d94c"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM elements
const projectArea = document.getElementById("projectArea");
const addProjectBtn = document.getElementById("addProjectBtn");
const projectModalTitle = document.getElementById("projectModalTitle");
const projectTitleInput = document.getElementById("projectTitle");
const projectDescriptionInput = document.getElementById("projectDescription");

// Thêm các input mới (ngày + comment)
const projectStartInput = document.getElementById("projectStart");
const projectEndInput = document.getElementById("projectEnd");
const projectCommentInput = document.getElementById("projectComment");

const saveProjectBtn = document.getElementById("saveProjectBtn");
const cancelProjectBtn = document.getElementById("cancelProjectBtn");
const deleteModal = document.getElementById("deleteModal");
const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");

let isEditing = false;
let currentProjectId = null;

// Utility to show/hide modal
function showModal(modalId) {
    document.getElementById(modalId).classList.remove('hidden');
    document.getElementById(modalId).classList.add('flex');
}

function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

// Render project card
function renderProject(doc) {
    const data = doc.data();
    const id = doc.id;
    const projectCard = document.createElement("div");
    projectCard.className = "bg-white p-6 rounded-lg shadow-md border border-gray-200";

    projectCard.innerHTML = `
        <h4 class="text-xl font-semibold text-blue-700 mb-2">${data.title}</h4>
        <p class="text-gray-600 mb-1"><b>Mô tả:</b> ${data.description || "Chưa có mô tả."}</p>
        <p class="text-gray-600 mb-1"><b>Bắt đầu:</b> ${data.startDate || "-"}</p>
        <p class="text-gray-600 mb-1"><b>Kết thúc:</b> ${data.endDate || "-"}</p>
        <p class="text-gray-600 mb-1"><b>Comment:</b> ${data.comment || "-"}</p>
        <p class="text-gray-500 text-sm italic mb-4">Người tạo: ${data.createdBy || "Không rõ"}</p>
        <div class="flex space-x-2">
            <button data-id="${id}" class="edit-btn bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded-md text-sm">Sửa</button>
            <button data-id="${id}" class="delete-btn bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-md text-sm">Xóa</button>
        </div>
    `;
    projectArea.appendChild(projectCard);
}

// Save project
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
                createdBy: user ? user.email : "Ẩn danh",
                createdAt: new Date(),
            });
        }

        // ✅ Reset & đóng popup ngay sau khi lưu
        hideModal("projectModal");
        projectTitleInput.value = "";
        projectDescriptionInput.value = "";
        projectStartInput.value = "";
        projectEndInput.value = "";
        projectCommentInput.value = "";

    } catch (e) {
        console.error("Error adding/updating document: ", e);
    }
});

addProjectBtn.addEventListener("click", () => {
    isEditing = false;
    projectModalTitle.textContent = "Tạo dự án mới";
    projectTitleInput.value = "";
    projectDescriptionInput.value = "";
    projectStartInput.value = "";   // ✅ reset ngày bắt đầu
    projectEndInput.value = "";     // ✅ reset ngày kết thúc
    projectCommentInput.value = ""; // ✅ reset comment
    showModal("projectModal");
});

// Show modal for editing a project
function editProject(id, data) {
    isEditing = true;
    currentProjectId = id;
    projectModalTitle.textContent = "Cập nhật dự án";
    projectTitleInput.value = data.title;
    projectDescriptionInput.value = data.description;
    projectStartInput.value = data.startDate || "";   // ✅
    projectEndInput.value = data.endDate || "";       // ✅
    projectCommentInput.value = data.comment || "";   // ✅
    showModal("projectModal");
}


// Show delete confirmation modal
function showDeleteConfirmation(id) {
    currentProjectId = id;
    showModal("deleteModal");
}

// Delete project logic
confirmDeleteBtn.addEventListener("click", async () => {
    try {
        await deleteDoc(doc(db, "projects", currentProjectId));
        hideModal("deleteModal");
    } catch (e) {
        console.error("Error deleting document: ", e);
    }
});

// Cancel delete
cancelDeleteBtn.addEventListener("click", () => {
    hideModal("deleteModal");
});

// Cancel add/update
cancelProjectBtn.addEventListener("click", () => {
    hideModal("projectModal");
});

// Listener to check user authentication and set up Firestore listener
auth.onAuthStateChanged(user => {
    if (user) {
        // Ai login cũng thấy nút Add project
        addProjectBtn.classList.remove('hidden');
        setupProjectListener();
    } else {
        // Clear projects if user logs out
        projectArea.innerHTML = "";
        addProjectBtn.classList.add('hidden');
    }
});

