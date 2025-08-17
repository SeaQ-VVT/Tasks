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
    getDocs,
    where
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { showTaskBoard } from "./tasks.js";

// Debug log
console.log("addproject.js loaded OK");

// ===== Firebase config (Auto-provided by Canvas) =====
const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// ===== Init Firebase =====
let app, db, auth;
let currentProjectId = null;
let isEditing = false;
let projectsUnsubscribe = null;

// DOM elements
const projectList = document.getElementById("projectList");
const addProjectBtn = document.getElementById("addProjectBtn");
const projectModal = document.getElementById("projectModal");
const deleteModal = document.getElementById("deleteModal");
const projectModalTitle = document.getElementById("projectModalTitle");
const projectTitleInput = document.getElementById("projectTitle");
const projectDescriptionInput = document.getElementById("projectDescription");
const projectStartInput = document.getElementById("projectStartDate");
const projectEndInput = document.getElementById("projectEndDate");
const projectCommentInput = document.getElementById("projectComment");
const saveProjectBtn = document.getElementById("saveProjectBtn");
const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");
const cancelProjectBtn = document.getElementById("cancelProjectBtn");

// Initialize Firebase and Auth
async function initFirebase() {
    try {
        // Prevent multiple app initializations
        if (!getApps().length) {
            app = initializeApp(firebaseConfig);
        } else {
            app = getApps()[0];
        }
        db = getFirestore(app);
        auth = getAuth(app);
        
        // Listen for auth state changes to handle UI and data loading
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                console.log("User is authenticated:", user.uid);
                addProjectBtn.classList.remove("hidden");
                listenForProjects();
            } else {
                console.log("User is not authenticated. Signing in anonymously...");
                // Attempt to sign in anonymously if not already signed in
                if (!auth.currentUser) {
                    try {
                        await signInAnonymously(auth);
                    } catch (e) {
                        console.error("Error signing in anonymously: ", e);
                    }
                }
                addProjectBtn.classList.add("hidden");
                // Stop listening for projects if user logs out
                if (projectsUnsubscribe) {
                    projectsUnsubscribe();
                    projectsUnsubscribe = null;
                }
                projectList.innerHTML = "<li>Vui lòng đăng nhập để xem dự án.</li>";
            }
        });
        
        // Use custom token if available and no user is currently signed in
        if (initialAuthToken && !auth.currentUser) {
            await signInWithCustomToken(auth, initialAuthToken);
        }

    } catch (e) {
        console.error("Error initializing Firebase: ", e);
    }
}

// ===== Modal helper =====
function showModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.remove("hidden");
    }
}

function hideModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.add("hidden");
    }
}

// ===== Firestore functions =====
function listenForProjects() {
    const projectsCol = collection(db, "projects");
    const q = query(projectsCol); // You can add orderBy here if needed

    // Unsubscribe from previous listener if it exists
    if (projectsUnsubscribe) {
        projectsUnsubscribe();
    }

    projectsUnsubscribe = onSnapshot(q, (snapshot) => {
        projectList.innerHTML = "";
        if (snapshot.empty) {
            projectList.innerHTML = "<li>Không có dự án nào. Vui lòng thêm một dự án mới.</li>";
        }
        snapshot.forEach((doc) => {
            renderProject(doc);
        });
    });
}

function renderProject(doc) {
    const project = doc.data();
    const li = document.createElement("li");
    li.className = "p-4 bg-white rounded shadow-md mb-2 flex justify-between items-center";
    li.innerHTML = `
        <div>
            <h3 class="font-bold text-lg text-blue-600">${project.title}</h3>
            <p class="text-sm text-gray-600">${project.description}</p>
        </div>
        <div class="flex items-center space-x-2">
            <button class="view-btn bg-blue-500 text-white px-2 py-1 rounded text-xs" data-id="${doc.id}">Xem</button>
            <button class="edit-btn bg-yellow-500 text-white px-2 py-1 rounded text-xs" data-id="${doc.id}">Sửa</button>
            <button class="delete-btn bg-red-500 text-white px-2 py-1 rounded text-xs" data-id="${doc.id}">Xóa</button>
        </div>
    `;
    projectList.appendChild(li);

    // Add event listeners for buttons
    li.querySelector(".view-btn").addEventListener("click", () => {
        showTaskBoard(doc.id, project.title);
    });
    li.querySelector(".edit-btn").addEventListener("click", () => {
        editProject(doc.id, project);
    });
    li.querySelector(".delete-btn").addEventListener("click", () => {
        showDeleteConfirmation(doc.id);
    });
}

// ===== CRUD operations =====
async function saveProject() {
    const projectData = {
        title: projectTitleInput.value,
        description: projectDescriptionInput.value,
        startDate: projectStartInput.value,
        endDate: projectEndInput.value,
        comment: projectCommentInput.value
    };

    try {
        if (isEditing) {
            await updateDoc(doc(db, "projects", currentProjectId), projectData);
        } else {
            await addDoc(collection(db, "projects"), projectData);
        }
        hideModal("projectModal");
    } catch (e) {
        console.error("Error saving project: ", e);
    }
}

function editProject(id, data) {
    isEditing = true;
    currentProjectId = id;
    projectModalTitle.textContent = "Sửa dự án";
    projectTitleInput.value = data.title || "";
    projectDescriptionInput.value = data.description || "";
    projectStartInput.value = data.startDate || "";
    projectEndInput.value = data.endDate || "";
    projectCommentInput.value = data.comment || "";

    showModal("projectModal");
}

// ===== Delete project (UPDATED to delete related data) =====
function showDeleteConfirmation(id) {
    currentProjectId = id;
    showModal("deleteModal");
}

confirmDeleteBtn.addEventListener("click", async () => {
    try {
        if (currentProjectId) {
            // Step 1: Find and delete all tasks for this project
            const tasksQuery = query(collection(db, "tasks"), where("projectId", "==", currentProjectId));
            const tasksSnapshot = await getDocs(tasksQuery);
            const tasksToDelete = tasksSnapshot.docs.map(d => deleteDoc(doc(db, "tasks", d.id)));
            await Promise.all(tasksToDelete);
            console.log(`Deleted ${tasksToDelete.length} tasks.`);

            // Step 2: Find and delete all groups for this project
            const groupsQuery = query(collection(db, "groups"), where("projectId", "==", currentProjectId));
            const groupsSnapshot = await getDocs(groupsQuery);
            const groupsToDelete = groupsSnapshot.docs.map(d => deleteDoc(doc(db, "groups", d.id)));
            await Promise.all(groupsToDelete);
            console.log(`Deleted ${groupsToDelete.length} groups.`);
            
            // Step 3: Delete the project document itself
            await deleteDoc(doc(db, "projects", currentProjectId));
            console.log(`Deleted project: ${currentProjectId}`);
        }
        
        hideModal("deleteModal");
    } catch (e) {
        console.error("Error deleting project and related data: ", e);
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

// ===== Listeners =====
saveProjectBtn.addEventListener("click", saveProject);
projectModal.addEventListener("click", (e) => {
    if (e.target === projectModal) hideModal("projectModal");
});
deleteModal.addEventListener("click", (e) => {
    if (e.target === deleteModal) hideModal("deleteModal");
});

// Initialize the app
initFirebase();

