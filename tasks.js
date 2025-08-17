// ===== Firebase SDKs =====
import {
    getFirestore,
    collection,
    addDoc,
    query,
    where,
    onSnapshot,
    doc,
    deleteDoc,
    updateDoc,
    serverTimestamp,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

// ===== Firebase Config =====
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
const db = getFirestore(app);
const auth = getAuth(app);

// ===== DOM elements =====
const taskBoard = document.getElementById("taskBoard");
const projectTitleDisplay = document.getElementById("projectTitleDisplay");
const taskProgressContainer = document.getElementById("taskProgressContainer");
const taskProgressBar = document.getElementById("taskProgressBar");
const taskProgressText = document.getElementById("taskProgressText");
const groupList = document.getElementById("groupList");
const addGroupBtn = document.getElementById("addGroupBtn");

// ===== Global state variables =====
let currentProjectId = null;
let currentProjectTitle = null;
let groupsUnsubscribe = null;

// ===== Main function to show the task board =====
export function showTaskBoard(projectId, projectTitle) {
    if (!projectId || !projectTitle) {
        console.error("Project ID or Title is missing!");
        return;
    }
    
    currentProjectId = projectId;
    currentProjectTitle = projectTitle;

    projectTitleDisplay.textContent = projectTitle;
    taskBoard.classList.remove("hidden");
    document.getElementById("projectArea").classList.add("hidden");

    setupGroupListeners(projectId);
    listenForGroups(projectId);
    setupDragDrop();
}

// ===== Show / Hide UI =====
function showModal(modalId) {
    document.getElementById(modalId).classList.remove('hidden');
    document.getElementById(modalId).classList.add('flex');
}

function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

// ===== Firestore Listeners =====
function listenForGroups(projectId) {
    const groupsCol = collection(db, "groups");
    const q = query(groupsCol, where("projectId", "==", projectId));

    if (groupsUnsubscribe) groupsUnsubscribe();

    groupsUnsubscribe = onSnapshot(q, (snapshot) => {
        groupList.innerHTML = "";
        snapshot.forEach((groupDoc) => {
            renderGroup(groupDoc.id, groupDoc.data());
        });
    });

    // We also need a listener for all tasks in the project to calculate progress
    listenForTasks(projectId);
}

function listenForTasks(projectId) {
    const tasksCol = collection(db, "tasks");
    const q = query(tasksCol, where("projectId", "==", projectId));

    onSnapshot(q, (snapshot) => {
        let totalTasks = 0;
        let doneTasks = 0;

        snapshot.forEach((taskDoc) => {
            totalTasks++;
            if (taskDoc.data().status === "done") {
                doneTasks++;
            }
        });

        const progress = totalTasks > 0 ? (doneTasks / totalTasks) * 100 : 0;
        updateProgress(progress);
    });
}

function updateProgress(percentage) {
    taskProgressContainer.classList.remove("hidden");
    taskProgressBar.style.width = `${percentage}%`;
    taskProgressText.textContent = `${Math.round(percentage)}% Hoàn thành`;
    
    // Change color based on progress
    if (percentage === 100) {
        taskProgressBar.classList.remove("bg-blue-500", "bg-yellow-500");
        taskProgressBar.classList.add("bg-green-500");
    } else if (percentage > 0) {
        taskProgressBar.classList.remove("bg-green-500");
        taskProgressBar.classList.add("bg-yellow-500");
    } else {
        taskProgressBar.classList.remove("bg-green-500", "bg-yellow-500");
        taskProgressBar.classList.add("bg-blue-500");
    }
}

function renderGroup(groupId, groupData) {
    const groupCard = document.createElement("div");
    groupCard.className = "bg-gray-100 p-4 rounded-lg shadow-md w-80 flex-shrink-0";
    groupCard.innerHTML = `
        <h3 class="text-lg font-semibold text-gray-800 mb-4 flex justify-between items-center">
            ${groupData.name}
            <div class="flex space-x-2">
                <button class="add-task-btn text-blue-500 hover:text-blue-700 text-xl" data-group-id="${groupId}">+</button>
                <button class="delete-group-btn text-red-500 hover:text-red-700 text-sm" data-group-id="${groupId}">&times;</button>
            </div>
        </h3>
        <div id="tasks-${groupId}" class="task-list space-y-2 min-h-[50px]"></div>
    `;
    groupList.appendChild(groupCard);

    // Listen for tasks within this group
    const tasksQuery = query(collection(db, "tasks"), where("groupId", "==", groupId));
    onSnapshot(tasksQuery, (snapshot) => {
        const taskList = document.getElementById(`tasks-${groupId}`);
        taskList.innerHTML = "";
        snapshot.forEach((taskDoc) => {
            renderTask(taskList, taskDoc.id, taskDoc.data());
        });
    });

    // Add event listeners for new buttons
    groupCard.querySelector(".add-task-btn").addEventListener("click", () => {
        showAddTaskModal(currentProjectId, groupId);
    });

    groupCard.querySelector(".delete-group-btn").addEventListener("click", async () => {
        // Find and delete all tasks in this group before deleting the group
        const tasksQuery = query(collection(db, "tasks"), where("groupId", "==", groupId));
        const tasksSnapshot = await getDocs(tasksQuery);
        const taskDeletions = tasksSnapshot.docs.map(taskDoc => deleteDoc(doc(db, "tasks", taskDoc.id)));
        await Promise.all(taskDeletions);
        
        // Now delete the group
        await deleteDoc(doc(db, "groups", groupId));
    });
}

function renderTask(taskList, taskId, taskData) {
    const taskCard = document.createElement("div");
    taskCard.className = "bg-white p-3 rounded-md shadow-sm border border-gray-200 text-sm cursor-grab";
    taskCard.draggable = true;
    taskCard.id = `task-${taskId}`; // Unique ID for drag/drop
    taskCard.innerHTML = `
        <p class="font-medium text-gray-700">${taskData.title}</p>
        <p class="text-gray-500 text-xs">${taskData.comment || "Không có ghi chú"}</p>
        <div class="flex justify-end space-x-2 mt-2">
             <button class="edit-task-btn text-yellow-500 hover:text-yellow-700 text-xs" data-id="${taskId}">Sửa</button>
             <button class="delete-task-btn text-red-500 hover:text-red-700 text-xs" data-id="${taskId}">Xóa</button>
        </div>
    `;
    taskList.appendChild(taskCard);

    // Add drag event listener
    taskCard.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", taskId);
        e.dataTransfer.setData("type", "task");
    });
    
    // Add edit/delete listeners
    taskCard.querySelector(".edit-task-btn").addEventListener("click", () => {
        showEditTaskModal(taskId, taskData);
    });
    taskCard.querySelector(".delete-task-btn").addEventListener("click", () => {
        deleteDoc(doc(db, "tasks", taskId));
    });
}

// ===== Modals for adding/editing =====
function showAddTaskModal(projectId, groupId) {
    const modal = document.getElementById("taskModal");
    document.getElementById("taskModalTitle").textContent = "Tạo công việc mới";
    document.getElementById("taskIdInput").value = "";
    document.getElementById("taskTitleInput").value = "";
    document.getElementById("taskCommentInput").value = "";
    document.getElementById("taskProjectIdInput").value = projectId;
    document.getElementById("taskGroupIdInput").value = groupId;

    showModal("taskModal");
}

function showEditTaskModal(taskId, taskData) {
    const modal = document.getElementById("taskModal");
    document.getElementById("taskModalTitle").textContent = "Sửa công việc";
    document.getElementById("taskIdInput").value = taskId;
    document.getElementById("taskTitleInput").value = taskData.title;
    document.getElementById("taskCommentInput").value = taskData.comment;
    document.getElementById("taskProjectIdInput").value = taskData.projectId;
    document.getElementById("taskGroupIdInput").value = taskData.groupId;
    
    showModal("taskModal");
}

async function saveTask() {
    const taskId = document.getElementById("taskIdInput").value;
    const title = document.getElementById("taskTitleInput").value;
    const comment = document.getElementById("taskCommentInput").value;
    const projectId = document.getElementById("taskProjectIdInput").value;
    const groupId = document.getElementById("taskGroupIdInput").value;

    if (!title) {
        alert("Vui lòng nhập tên công việc.");
        return;
    }

    try {
        if (taskId) {
            // Update existing task
            await updateDoc(doc(db, "tasks", taskId), {
                title, comment
            });
        } else {
            // Add new task
            await addDoc(collection(db, "tasks"), {
                title, comment,
                projectId, groupId, status: "todo",
                createdAt: serverTimestamp(), createdBy: auth.currentUser?.email || "Ẩn danh"
            });
        }
        hideModal("taskModal");
    } catch (e) {
        console.error("Error saving task: ", e);
    }
}

// ===== Drag & Drop =====
function setupDragDrop() {
    const todoCol = document.getElementById("todoCol");
    const inprogressCol = document.getElementById("inprogressCol");
    const doneCol = document.getElementById("doneCol");

    const columns = [todoCol, inprogressCol, doneCol];

    columns.forEach(col => {
        col.addEventListener("dragover", (e) => e.preventDefault());
        col.addEventListener("drop", async (e) => {
            e.preventDefault();

            const taskId = e.dataTransfer.getData("text/plain");
            const newStatus = col.dataset.status;

            if (!taskId || !newStatus) return;

            await updateDoc(doc(db, "tasks", taskId), {
                status: newStatus
            });
        });
    });
}
