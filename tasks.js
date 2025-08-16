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
            <div class="bg-white p-3 rounded shadow min-h-[400px]" id="todoArea">
                <h3 class="font-bold text-red-600 mb-2">To Do</h3>
                <button id="addGroupBtn" class="bg-blue-500 text-white px-2 py-1 rounded text-xs">+ Group</button>
                <div id="groupContainer" class="space-y-3 mt-2"></div>
            </div>
            <div class="bg-white p-3 rounded shadow min-h-[400px]" id="inprogressArea">
                <h3 class="font-bold text-yellow-600 mb-2">In Progress</h3>
                <div id="inprogressCol" class="space-y-2 mt-2"></div>
            </div>
            <div class="bg-white p-3 rounded shadow min-h-[400px]" id="doneArea">
                <h3 class="font-bold text-green-600 mb-2">Done</h3>
                <div id="doneCol" class="space-y-2 mt-2"></div>
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
        snapshot.forEach((docSnap) => renderGroup(docSnap));
    });
}

// ===== Render Group =====
function renderGroup(docSnap) {
    const g = docSnap.data();
    const gid = docSnap.id;

    const div = document.createElement("div");
    div.className = "border rounded p-2 bg-gray-50 shadow";
    div.id = `group-${gid}`;
    div.draggable = true;

    div.innerHTML = `
        <div class="flex justify-between items-center">
            <span class="font-semibold text-blue-700">${g.title}</span>
            <div class="space-x-1">
                <button class="edit-group text-yellow-600">✏️</button>
                <button class="delete-group text-red-600">🗑️</button>
            </div>
        </div>
        <button class="add-task text-green-600 text-xs mt-1">+ Task</button>
        <div id="tasks-${gid}" class="space-y-1 mt-2"></div>
    `;

    document.getElementById("groupContainer").appendChild(div);

    div.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("type", "group");
        e.dataTransfer.setData("groupId", gid);
    });

    loadTasks(gid);

    div.querySelector(".add-task").addEventListener("click", () => addTask("todo", gid, g.projectId));
    div.querySelector(".edit-group").addEventListener("click", () => editGroup(gid, g));
    div.querySelector(".delete-group").addEventListener("click", () => deleteGroup(gid, g));
}

// ===== Load tasks realtime =====
function loadTasks(groupId) {
    const tasksCol = collection(db, "tasks");
    const q = query(tasksCol, where("groupId", "==", groupId));

    onSnapshot(q, (snapshot) => {
        const taskDiv = document.getElementById(`tasks-${groupId}`);
        if (!taskDiv) return;
        taskDiv.innerHTML = "";

        snapshot.forEach((docSnap) => renderTask(docSnap));
    });
}

// ===== Render task row =====
function renderTask(docSnap) {
    const t = docSnap.data();
    const tid = docSnap.id;

    let colId = t.status === "todo" ? `tasks-${t.groupId}` : `${t.status}Col`;
    const col = document.getElementById(colId);
    if (!col) return;

    const row = document.createElement("div");
    row.id = `task-${tid}`;
    row.className = "flex justify-between items-center bg-gray-100 px-2 py-1 rounded border text-sm cursor-move";
    row.draggable = true;
    row.dataset.id = tid;
    row.dataset.group = t.groupId;

    row.innerHTML = `
        <span class="truncate">${t.title}</span>
        <div class="space-x-1">
            <button class="edit-task" title="Sửa">✏️</button>
            <button class="comment-task" title="Comment">💬</button>
            <button class="delete-task" title="Xóa">🗑️</button>
        </div>
    `;

    row.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("type", "task");
        e.dataTransfer.setData("taskId", tid);
        e.dataTransfer.setData("groupId", t.groupId);
    });

    row.querySelector(".edit-task").addEventListener("click", async () => {
        const newTitle = prompt("Tên mới:", t.title);
        if (!newTitle) return;
        await updateDoc(doc(db, "tasks", tid), { title: newTitle, updatedAt: serverTimestamp() });
    });

    row.querySelector(".comment-task").addEventListener("click", async () => {
        const newComment = prompt("Comment:", t.comment || "");
        await updateDoc(doc(db, "tasks", tid), { comment: newComment, updatedAt: serverTimestamp() });
    });

    row.querySelector(".delete-task").addEventListener("click", async () => {
        if (confirm("Xóa task này?")) await deleteDoc(doc(db, "tasks", tid));
    });

    col.appendChild(row);
}

// ===== Group actions =====
async function addGroup(projectId) {
    const title = prompt("Tên Group:");
    if (!title) return;
    await addDoc(collection(db, "groups"), {
        title, projectId, status: "todo",
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser?.email || "Ẩn danh"
    });
}

async function editGroup(groupId, g) {
    const newTitle = prompt("Tên mới:", g.title);
    if (!newTitle) return;
    await updateDoc(doc(db, "groups", groupId), {
        title: newTitle, updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.email || "Ẩn danh"
    });
}

async function deleteGroup(groupId, g) {
    if (!confirm("Xóa group này và task trong nó?")) return;

    const taskSnap = await getDocs(query(collection(db, "tasks"), where("groupId", "==", groupId)));
    taskSnap.forEach(async (t) => await deleteDoc(doc(db, "tasks", t.id)));

    await deleteDoc(doc(db, "groups", groupId));
}

// ===== Task actions =====
async function addTask(status, groupId, projectId) {
    const title = prompt("Tên Task:");
    if (!title) return;
    await addDoc(collection(db, "tasks"), {
        title,
        projectId,
        groupId,
        status,
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser?.email || "Ẩn danh"
    });
}

// ===== Listeners =====
function setupGroupListeners(projectId) {
    document.getElementById("addGroupBtn").addEventListener("click", () => addGroup(projectId));
}

// ===== Drag & Drop =====
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
                await updateDoc(doc(db, "tasks", taskId), {
                    status: newStatus,
                    updatedAt: serverTimestamp(),
                    updatedBy: auth.currentUser?.email || "Ẩn danh"
                });
            }

            if (type === "group") {
                const groupId = e.dataTransfer.getData("groupId");
                const taskSnap = await getDocs(query(collection(db, "tasks"), where("groupId", "==", groupId)));
                taskSnap.forEach(async (t) => {
                    await updateDoc(doc(db, "tasks", t.id), { status: newStatus, updatedAt: serverTimestamp() });
                });
                await updateDoc(doc(db, "groups", groupId), { status: newStatus, updatedAt: serverTimestamp() });
            }
        });
    });
}
