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
    deleteField
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
const copyModal = document.getElementById("copyModal");
const newProjectTitleInput = document.getElementById("newProjectTitle");
const confirmCopyBtn = document.getElementById("confirmCopyBtn");
const cancelCopyBtn = document.getElementById("cancelCopyBtn");

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
        projectArea.innerHTML = ""; // Clear the old list
        snapshot.forEach((doc) => {
            renderProject(doc);
        });

        // Add event listeners for the buttons
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

        document.querySelectorAll(".copy-btn").forEach((btn) => {
            btn.addEventListener("click", (e) => {
                const id = e.target.dataset.id;
                const docToCopy = snapshot.docs.find((d) => d.id === id);
                if (docToCopy) {
                    copyProject(id, docToCopy.data());
                }
            });
        });

        document.querySelectorAll(".view-tasks-btn").forEach((btn) => {
            btn.addEventListener("click", (e) => {
                const id = e.target.dataset.id;
                const docToView = snapshot.docs.find((d) => d.id === id);
                if (docToView) {
                    const projectTitle = docToView.data().title;
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
        // Use a more friendly UI instead of alert
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

        hideModal("projectModal");
        projectTitleInput.value = "";
        projectDescriptionInput.value = "";
        projectStartInput.value = "";
        projectEndInput.value = "";
        projectCommentInput.value = "";
        isEditing = false;
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
    currentProjectId = id;
    newProjectTitleInput.value = `${data.title} (Bản sao)`;
    showModal("copyModal");
}

confirmCopyBtn.addEventListener("click", async () => {
    const newTitle = newProjectTitleInput.value.trim();
    if (!newTitle) {
        console.error("Vui lòng nhập tên cho dự án mới.");
        return;
    }

    try {
        const user = auth.currentUser;
        const projectDoc = await getDoc(doc(db, "projects", currentProjectId));
        const projectData = projectDoc.data();
        
        // Step 1: Create a new project document with the new title
        const newProjectRef = await addDoc(collection(db, "projects"), {
            ...projectData,
            title: newTitle,
            createdAt: new Date(),
            createdBy: user ? user.email : "Ẩn danh",
        });
        const newProjectId = newProjectRef.id;

        // Step 2: Find and copy all tasks associated with the old project
        const tasksQuery = query(collection(db, "tasks"), where("projectId", "==", currentProjectId));
        const tasksSnapshot = await getDocs(tasksQuery);
        const tasksToCopy = tasksSnapshot.docs.map(taskDoc => {
            const data = taskDoc.data();
            return addDoc(collection(db, "tasks"), { ...data, projectId: newProjectId });
        });
        await Promise.all(tasksToCopy);

        // Step 3: Find and copy all logs associated with the old project
        const logsQuery = query(collection(db, "logs"), where("projectId", "==", currentProjectId));
        const logsSnapshot = await getDocs(logsQuery);
        const logsToCopy = logsSnapshot.docs.map(logDoc => {
            const data = logDoc.data();
            return addDoc(collection(db, "logs"), { ...data, projectId: newProjectId });
        });
        await Promise.all(logsToCopy);

        // Step 4: Find and copy all groups associated with the old project
        const groupsQuery = query(collection(db, "groups"), where("projectId", "==", currentProjectId));
        const groupsSnapshot = await getDocs(groupsQuery);
        const groupsToCopy = groupsSnapshot.docs.map(groupDoc => {
            const data = groupDoc.data();
            return addDoc(collection(db, "groups"), { ...data, projectId: newProjectId });
        });
        await Promise.all(groupsToCopy);

        hideModal("copyModal");
        console.log("Project and all associated data copied successfully!");

    } catch (e) {
        console.error("Error copying project: ", e);
    }
});

cancelCopyBtn.addEventListener("click", () => hideModal("copyModal"));


// ===== Delete project and associated data =====
function showDeleteConfirmation(id) {
    currentProjectId = id;
    showModal("deleteModal");
}

confirmDeleteBtn.addEventListener("click", async () => {
    try {
        // Find and delete all tasks associated with the project
        const tasksQuery = query(collection(db, "tasks"), where("projectId", "==", currentProjectId));
        const tasksSnapshot = await getDocs(tasksQuery);
        const tasksToDelete = tasksSnapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(tasksToDelete);

        // Find and delete all groups associated with the project
        const groupsQuery = query(collection(db, "groups"), where("projectId", "==", currentProjectId));
        const groupsSnapshot = await getDocs(groupsQuery);
        const groupsToDelete = groupsSnapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(groupsToDelete);

        // Find and delete all logs associated with the project
        const logsQuery = query(collection(db, "logs"), where("projectId", "==", currentProjectId));
        const logsSnapshot = await getDocs(logsQuery);
        const logsToDelete = logsSnapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(logsToDelete);
        
        // Finally, delete the project document itself
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
        addProjectBtn.classList.remove("hidden");
        setupProjectListener();
    } else {
        projectArea.innerHTML = "";
        addProjectBtn.classList.add("hidden");
    }
});
