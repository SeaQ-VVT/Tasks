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
    serverTimestamp
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

// ===== Init =====
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// ===== Show task board =====
export function showTaskBoard(projectId) {
    const taskBoard = document.getElementById("taskBoard");

    taskBoard.innerHTML = `
        <div class="grid grid-cols-3 gap-4 w-full">
            <!-- To Do -->
            <div class="bg-white p-4 rounded shadow" id="todoArea">
                <h3 class="font-bold text-lg text-red-600 mb-2">To Do</h3>
                <button id="addGroupBtn" class="bg-blue-500 text-white px-3 py-1 rounded text-sm">+ Thêm Group</button>
                <div id="groupContainer" class="space-y-4 mt-2 min-h-[100px]"></div>
            </div>

            <!-- In Progress -->
            <div class="bg-white p-4 rounded shadow" id="inprogressArea">
                <h3 class="font-bold text-lg text-yellow-600 mb-2">In Progress</h3>
                <div id="inprogressCol" class="space-y-2 mt-2 min-h-[100px]"></div>
            </div>

            <!-- Done -->
            <div class="bg-white p-4 rounded shadow" id="doneArea">
                <h3 class="font-bold text-lg text-green-600 mb-2">Done</h3>
                <div id="doneCol" class="space-y-2 mt-2 min-h-[100px]"></div>
            </div>
        </div>
    `;

    loadGroups(projectId);
    setupGroupListeners(projectId);
    setupDragDrop(projectId);
}

// ===== Load Groups realtime =====
function loadGroups(projectId) {
    const groupsCol = collection(db, "groups");
    const q = query(groupsCol, where("projectId", "==", projectId));

    onSnapshot(q, (snapshot) => {
        const groupContainer = document.getElementById("groupContainer");
        groupContainer.innerHTML = "";
        snapshot.forEach((docSnap) => {
            renderGroup(docSnap);
        });
    });
}

// ===== Render Group =====
function renderGroup(docSnap) {
    const groupData = docSnap.data();
    const groupId = docSnap.id;

    const groupDiv = document.createElement("div");
    groupDiv.className = "border rounded-lg p-3 bg-gray-50 shadow";
    groupDiv.id = `group-${groupId}`;

    groupDiv.innerHTML = `
        <h4 class="font-semibold text-blue-700 mb-2">${groupData.title}</h4>
        <button data-id="${groupId}" class="add-task bg-green-500 text-white px-2 py-1 rounded text-xs">+ Thêm Task</button>
        <div id="tasks-${groupId}" class="space-y-2 mt-2 min-h-[50px]"></div>
        <div id="logs-${groupId}" class="mt-3 text-xs text-gray-600 bg-white p-2 rounded border">
            <p class="font-semibold">Lịch sử thao tác:</p>
        </div>
    `;

    document.getElementById("groupContainer").appendChild(groupDiv);

    loadTasks(groupId);
    loadLogs(groupId);

    groupDiv.querySelector(".add-task").addEventListener("click", () => addTask("todo", groupId, groupData.projectId));
}

// ===== Load tasks realtime =====
function loadTasks(groupId) {
    const tasksCol = collection(db, "tasks");
    const q = query(tasksCol, where("groupId", "==", groupId));

    onSnapshot(q, (snapshot) => {
        const taskDiv = document.getElementById(`tasks-${groupId}`);
        if (taskDiv) taskDiv.innerHTML = "";

        snapshot.forEach((docSnap) => {
            renderTask(docSnap);
        });
    });
}

// ===== Render task card =====
function renderTask(docSnap) {
    const data = docSnap.data();
    const id = docSnap.id;

    // Task chỉ hiển thị trong cột theo status
    let colId = data.status === "todo" ? `tasks-${data.groupId}` : `${data.status}Col`;

    const taskCard = document.createElement("div");
    taskCard.className = "bg-gray-100 p-3 rounded border shadow-sm text-sm cursor-move";
    taskCard.draggable = true;
    taskCard.dataset.id = id;
    taskCard.dataset.group = data.groupId;

    taskCard.innerHTML = `
        <p class="font-semibold">${data.title}</p>
        <p class="text-gray-600 text-xs">Người tạo: ${data.createdBy || "-"}</p>
        <p class="text-gray-500 text-xs">Trạng thái: ${data.status}</p>
        <p class="text-gray-500 text-xs">Ghi chú: ${data.comment || "-"}</p>
        <div class="flex space-x-2 mt-2">
            <button data-id="${id}" class="edit-task bg-yellow-500 hover:bg-yellow-600 text-white px-2 py-1 rounded">Sửa</button>
            <button data-id="${id}" class="delete-task bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded">Xóa</button>
        </div>
    `;

    // Drag event
    taskCard.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", id);
    });

    const col = document.getElementById(colId);
    if (col) col.appendChild(taskCard);

    // Edit
    taskCard.querySelector(".edit-task").addEventListener("click", async () => {
        const newTitle = prompt("Sửa tên công việc:", data.title);
        if (!newTitle) return;
        const newComment = prompt("Sửa comment:", data.comment || "");
        await updateDoc(doc(db, "tasks", id), {
            title: newTitle,
            comment: newComment,
            updatedAt: serverTimestamp(),
            updatedBy: auth.currentUser ? auth.currentUser.email : "Ẩn danh"
        });
    });

    // Delete
    taskCard.querySelector(".delete-task").addEventListener("click", async () => {
        if (confirm("Xóa công việc này?")) {
            const groupId = data.groupId;
            await deleteDoc(doc(db, "tasks", id));
            await addDoc(collection(db, "groups", groupId, "logs"), {
                action: "delete",
                taskTitle: data.title,
                user: auth.currentUser ? auth.currentUser.email : "Ẩn danh",
                time: serverTimestamp()
            });
        }
    });
}

// ===== Load Logs realtime =====
function loadLogs(groupId) {
    const logsCol = collection(db, "groups", groupId, "logs");
    onSnapshot(logsCol, (snapshot) => {
        const logDiv = document.getElementById(`logs-${groupId}`);
        if (!logDiv) return;
        logDiv.innerHTML = `<p class="font-semibold">Lịch sử thao tác:</p>`;
        snapshot.forEach((logSnap) => {
            const log = logSnap.data();
            const p = document.createElement("p");
            p.textContent = `${log.taskTitle} bị ${log.action} bởi ${log.user}`;
            logDiv.appendChild(p);
        });
    });
}

// ===== Setup listeners =====
function setupGroupListeners(projectId) {
    document.getElementById("addGroupBtn").addEventListener("click", () => addGroup(projectId));
}

async function addGroup(projectId) {
    const title = prompt("Nhập tên Group:");
    if (!title) return;

    await addDoc(collection(db, "groups"), {
        title,
        projectId,
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser ? auth.currentUser.email : "Ẩn danh"
    });
}

async function addTask(status, groupId, projectId) {
    const title = prompt("Nhập tên công việc:");
    if (!title) return;
    const comment = prompt("Nhập comment cho công việc (tuỳ chọn):");

    await addDoc(collection(db, "tasks"), {
        title,
        comment: comment || "",
        projectId,
        groupId,
        status,
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser ? auth.currentUser.email : "Ẩn danh"
    });
}

// ===== Drag & Drop setup =====
function setupDragDrop(projectId) {
    ["inprogressCol", "doneCol"].forEach((colId) => {
        const col = document.getElementById(colId);
        col.addEventListener("dragover", (e) => e.preventDefault());
        col.addEventListener("drop", async (e) => {
            e.preventDefault();
            const taskId = e.dataTransfer.getData("text/plain");
            if (!taskId) return;

            let newStatus = colId === "inprogressCol" ? "inprogress" : "done";

            await updateDoc(doc(db, "tasks", taskId), {
                status: newStatus,
                updatedAt: serverTimestamp(),
                updatedBy: auth.currentUser ? auth.currentUser.email : "Ẩn danh"
            });
        });
    });
}

