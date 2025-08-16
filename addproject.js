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
// Test log để biết file đã load chưa
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
const projectModal = document.getElementById("projectModal");
const projectModalTitle = document.getElementById("projectModalTitle");
const projectTitleInput = document.getElementById("projectTitle");
const projectDescriptionInput = document.getElementById("projectDescription");
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

// Function to render a single project card
function renderProject(doc) {
    const data = doc.data();
    const id = doc.id;
    const projectCard = document.createElement("div");
    projectCard.className = "bg-white p-6 rounded-lg shadow-md border border-gray-200 transition-transform transform hover:scale-105";

    projectCard.innerHTML = `
        <h4 class="text-xl font-semibold text-blue-700 mb-2">${data.title}</h4>
        <p class="text-gray-600 mb-4">${data.description || "Chưa có mô tả."}</p>
        <div class="flex space-x-2">
            <button data-id="${id}" class="edit-btn bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded-md text-sm font-medium transition-colors">Sửa</button>
            <button data-id="${id}" class="delete-btn bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-md text-sm font-medium transition-colors">Xóa</button>
        </div>
    `;
    projectArea.appendChild(projectCard);
}

// Real-time listener for projects
function setupProjectListener() {
    const projectsCol = collection(db, "projects");
    const q = query(projectsCol, orderBy("createdAt", "desc"));

    onSnapshot(q, (snapshot) => {
        projectArea.innerHTML = ""; // Clear existing projects
        snapshot.forEach((doc) => {
            renderProject(doc);
        });

        // Add event listeners to buttons
        document.querySelectorAll(".edit-btn").forEach((button) => {
            button.addEventListener("click", (e) => {
                const id = e.target.dataset.id;
                const docToEdit = snapshot.docs.find(d => d.id === id);
                if (docToEdit) {
                    editProject(id, docToEdit.data());
                }
            });
        });

        document.querySelectorAll(".delete-btn").forEach((button) => {
            button.addEventListener("click", (e) => {
                const id = e.target.dataset.id;
                showDeleteConfirmation(id);
            });
        });
    });
}

// Add/Update Project logic
saveProjectBtn.addEventListener("click", async () => {
    const title = projectTitleInput.value.trim();
    const description = projectDescriptionInput.value.trim();

    if (!title) {
        alert("Vui lòng nhập tên dự án.");
        return;
    }

    try {
        if (isEditing) {
            const projectDocRef = doc(db, "projects", currentProjectId);
            await updateDoc(projectDocRef, {
                title,
                description,
                updatedAt: new Date(),
            });
        } else {
            await addDoc(collection(db, "projects"), {
                title,
                description,
                createdAt: new Date(),
            });
        }
        hideModal("projectModal");
        projectTitleInput.value = "";
        projectDescriptionInput.value = "";
    } catch (e) {
        console.error("Error adding/updating document: ", e);
    }
});

// Show modal for adding a new project
addProjectBtn.addEventListener("click", () => {
    isEditing = false;
    projectModalTitle.textContent = "Tạo dự án mới";
    projectTitleInput.value = "";
    projectDescriptionInput.value = "";
    showModal("projectModal");
});

// Show modal for editing a project
function editProject(id, data) {
    isEditing = true;
    currentProjectId = id;
    projectModalTitle.textContent = "Cập nhật dự án";
    projectTitleInput.value = data.title;
    projectDescriptionInput.value = data.description;
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
