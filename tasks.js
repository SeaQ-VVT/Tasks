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
            <div class="bg-white p-4 rounded shadow min-h-[400px]" id="todoArea">
                <h3 class="font-bold text-lg text-red-600 mb-2">To Do</h3>
                <button id="addGroupBtn" class="bg-blue-500 text-white px-3 py-1 rounded text-sm">+ Thêm Group</button>
                <div id="groupContainer" class="space-y-4 mt-2 min-h-[100px]"></div>
            </div>

            <!-- In Progress -->
            <div class="bg-white p-4 rounded shadow min-h-[400px]" id="inprogressArea">
                <h3 class="font-bold text-lg text-yellow-600 mb-2">In Progress</h3>
                <div id="inprogressCol" class="space-y-2 mt-2 min-h-[100px]"></div>
            </div>

            <!-- Done -->
            <div class="bg-white p-4 rounded shadow min-h-[400px]" id="doneArea">
                <h3 class="font-bold text-lg text-green-600 mb-2">Done</h3>
                <div id="doneCol" class="space-y-2 mt-2 min-h-[100px]"></div>
            </div>
        </div>
    `;

    loadGroups(projectId);
    setupGroupListeners(projectId);
    setupDragDrop();
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
    groupDiv.draggable = true;

    groupDiv.innerHTML = `
        <div class="flex justify-between items-center mb-2">
            <h4 class="font-semibold text-blue-700">${groupData.title}</h4>
            <div class="flex space-x-2">
                <button data-id="${groupId}" class="edit-group bg-yellow-500 text-white px-2 py-1 rounded text-xs">Sửa</button>
                <button data-id="${groupId}" class="delete-group bg-red-500 text-white px-2 py-1 rounded text-xs">Xóa</button>
            </div>
        </div>
        <button data-id="${groupId}" class="add-task bg-green-500 text-white px-2 py-1 rounded text-xs">+ Thêm Task</button>
        <div id="tasks-${groupId}" class="space-y-2 mt-2 min-h-[50px]"></div>
        <div id="logs-${groupId}" class="mt-3 text-xs text-gray-600 bg-white p-2 rounded border">
            <p class="font-semibold">Lịch sử thao tác:</p>
        </div>
    `;

    document.getElementById("groupContainer").appendChild(groupDiv);

    // drag group
    groupDiv.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("type", "group");
        e.dataTransfer.setData("groupId", groupId);
    });

    loadTasks(groupId);
    loadLogs(groupId);

    groupDiv.querySelector(".add-task").addEventListener("click", () => addTask("todo", groupId, groupData.projectId));
    groupDiv.querySelector(".edit-group").addEventListener("click", () => editGroup(groupId, groupData));
    groupDiv.querySelector(".delete-group").addEventListener("click", () => deleteGroup(groupId, groupData));
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

    taskCard.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("type", "task");
        e.dataTransfer.setData("taskId", id);
        e.dataTransfer.setData("groupId", data.groupId);
    });

    const col = document.getElementById(colId);
    if (col) col.appendChild(taskCard);

    // Edit Task
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
        await addDoc(collection(db, "groups", data.groupId, "logs"), {
            action: "update-task",
            taskTitle: newTitle,
            user: auth.currentUser ? auth.currentUser.email : "Ẩn danh",
            time: serverTimestamp()
        });
    });

    // Delete Task
    taskCard.querySelector(".delete-task").addEventListener("click", async () => {
        if (confirm("Xóa công việc này?")) {
            await deleteDoc(doc(db, "tasks", id));
            await addDoc(collection(db, "groups", data.groupId, "logs"), {
                action: "delete-task",
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
            p.textContent = `${log.action} - ${log.taskTitle || log.groupTitle || ""} bởi ${log.user}`;
            logDiv.appendChild(p);
        });
    });
}

// ===== Group actions =====
async function addGroup(projectId) {
    const title = prompt("Nhập tên Group:");
    if (!title) return;

    await addDoc(collection(db, "groups"), {
        title,
        projectId,
        status: "todo",
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser ? auth.currentUser.email : "Ẩn danh"
    });
}

async function editGroup(groupId, groupData) {
    const newTitle = prompt("Sửa tên Group:", groupData.title);
    if (!newTitle) return;
    await updateDoc(doc(db, "groups", groupId), {
        title: newTitle,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser ? auth.currentUser.email : "Ẩn danh"
    });
    await addDoc(collection(db, "groups", groupId, "logs"), {
        action: "update-group",
        oldTitle: groupData.title,
        newTitle: newTitle,
        user: auth.currentUser ? auth.currentUser.email : "Ẩn danh",
        time: serverTimestamp()
    });
}

async function deleteGroup(groupId, groupData) {
    if (!confirm("Xóa group này và tất cả task bên trong?")) return;

    const taskSnap = await getDocs(query(collection(db, "tasks"), where("groupId", "==", groupId)));
    taskSnap.forEach(async (t) => {
        await deleteDoc(doc(db, "tasks", t.id));
    });

    await deleteDoc(doc(db, "groups", groupId));

    await addDoc(collection(db, "groups", groupId, "logs"), {
        action: "delete-group",
        groupTitle: groupData.title,
        user: auth.currentUser ? auth.currentUser.email : "Ẩn danh",
        time: serverTimestamp()
    });
}

// ===== Task actions =====
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

// ===== Listeners =====
function setupGroupListeners(projectId) {
    document.getElementById("addGroupBtn").addEventListener("click", () => addGroup(projectId));
}

// ===== Drag & Drop setup =====
function setupDragDrop() {
    ["inprogressCol", "doneCol"].forEach((colId) => {
        const col = document.getElementById(colId);
        col.addEventListener("dragover", (e) => e.preventDefault());
        col.addEventListener("drop", async (e) => {
            e.preventDefault();
            const type = e.dataTransfer.getData("type");

            let newStatus = colId === "inprogressCol" ? "inprogress" : "done";

            if (type === "task") {
                const taskId = e.dataTransfer.getData("taskId");
                const groupId = e.dataTransfer.getData("groupId");
                await updateDoc(doc(db, "tasks", taskId), {
                    status: newStatus,
                    updatedAt: serverTimestamp(),
                    updatedBy: auth.currentUser ? auth.currentUser.email : "Ẩn danh"
                });
                await addDoc(collection(db, "groups", groupId, "logs"), {
                    action: "move-task",
                    taskTitle: taskId,
                    user: auth.currentUser ? auth.currentUser.email : "Ẩn danh",
                    time: serverTimestamp()
                });
            }

            if (type === "group") {
                const groupId = e.dataTransfer.getData("groupId");
                const taskSnap = await getDocs(query(collection(db, "tasks"), where("groupId", "==", groupId)));
                taskSnap.forEach(async (t) => {
                    await updateDoc(doc(db, "tasks", t.id), {
                        status: newStatus,
                        updatedAt: serverTimestamp(),
                        updatedBy: auth.currentUser ? auth.currentUser.email : "Ẩn danh"
                    });
                });
                await updateDoc(doc(db, "groups", groupId), {
                    status: newStatus,
                    updatedAt: serverTimestamp(),
                    updatedBy: auth.currentUser ? auth.currentUser.email : "Ẩn danh"
                });
                await addDoc(collection(db, "groups", groupId, "logs"), {
                    action: "move-group",
                    groupTitle: groupId,
                    user: auth.currentUser ? auth.currentUser.email : "Ẩn danh",
                    time: serverTimestamp()
                });
            }
        });
    });
}
