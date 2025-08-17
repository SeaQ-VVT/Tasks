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
    getDocs,
    deleteField
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

// ===== Modal helper =====
function openModal(title, fields, onSave) {
    let modal = document.getElementById("popupModal");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "popupModal";
        modal.className = "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 hidden";
        modal.innerHTML = `
            <div class="bg-white rounded-lg p-4 w-96">
                <h3 id="modalTitle" class="font-semibold mb-2"></h3>
                <div id="modalFields" class="space-y-2"></div>
                <div class="flex justify-end space-x-2 mt-3">
                    <button id="modalCancel" class="px-3 py-1 bg-gray-200 rounded">Hủy</button>
                    <button id="modalSave" class="px-3 py-1 bg-green-500 text-white rounded">Lưu</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    document.getElementById("modalTitle").textContent = title;
    const fieldsDiv = document.getElementById("modalFields");
    fieldsDiv.innerHTML = "";
    fields.forEach(f => {
        if (f.type === "textarea") {
            fieldsDiv.innerHTML += `<textarea id="${f.id}" placeholder="${f.placeholder}" class="border p-2 w-full">${f.value || ""}</textarea>`;
        } else {
            fieldsDiv.innerHTML += `<input id="${f.id}" type="text" placeholder="${f.placeholder}" class="border p-2 w-full" value="${f.value || ""}">`;
        }
    });

    modal.classList.remove("hidden");

    document.getElementById("modalCancel").onclick = () => modal.classList.add("hidden");
    document.getElementById("modalSave").onclick = () => {
        const values = {};
        fields.forEach(f => values[f.id] = document.getElementById(f.id).value);
        onSave(values);
        modal.classList.add("hidden");
    };
}

// ===== LOGGING FUNCTION =====
async function logAction(projectId, action) {
    const user = auth.currentUser?.email || "Ẩn danh";
    await addDoc(collection(db, "logs"), {
        projectId,
        action,
        user,
        timestamp: serverTimestamp()
    });
}

// ===== LISTEN AND DISPLAY LOGS FUNCTION =====
function listenForLogs(projectId) {
    const logsCol = collection(db, "logs");
    const q = query(logsCol, where("projectId", "==", projectId));

    onSnapshot(q, (snapshot) => {
        const logEntries = document.getElementById("logEntries");
        if (!logEntries) return;
        
        // Sort the logs by timestamp in descending order using JavaScript
        const logs = [];
        snapshot.forEach((doc) => {
            logs.push(doc.data());
        });

        logs.sort((a, b) => b.timestamp - a.timestamp);
        
        logEntries.innerHTML = "";
        logs.forEach((data) => {
            const timestamp = data.timestamp?.toDate ? data.timestamp.toDate().toLocaleString() : "-";
            const logItem = document.createElement("div");
            logItem.textContent = `[${timestamp}] ${data.user} đã ${data.action}.`;
            logEntries.appendChild(logItem);
        });
    });
}

// ===== RENDER TASK BOARD (UPDATED WITH LOG AREA AND TOGGLE BUTTON) =====
export function showTaskBoard(projectId, projectTitle) {
    const taskBoard = document.getElementById("taskBoard");

    taskBoard.innerHTML = `
        <h2 class="text-xl font-bold mb-4">Bạn đang ở dự án: ${projectTitle}</h2>
        
        <div id="logArea" class="mt-4 bg-gray-100 p-4 rounded-lg">
            <div class="flex justify-between items-center mb-2">
                <h4 class="font-semibold text-gray-700">Nhật ký hoạt động</h4>
                <button id="toggleLogBtn" class="bg-gray-300 text-gray-700 px-2 py-1 rounded text-xs">Ẩn log</button>
            </div>
            <div id="logEntries" class="space-y-2 text-sm text-gray-600"></div>
        </div>

        <div class="grid grid-cols-3 gap-4 w-full mt-4">
            <div class="bg-white p-3 rounded shadow min-h-[400px]" id="todoArea">
                <h3 class="font-bold text-red-600 mb-2">To Do</h3>
                <button id="addGroupBtn" class="bg-blue-500 text-white px-2 py-1 rounded text-xs">+ Group</button>
                <div id="groupContainer" class="space-y-3 mt-2"></div>
            </div>
            <div class="bg-white p-3 rounded shadow min-h-[400px]" id="inprogressArea">
                <h3 class="font-bold text-yellow-600 mb-2">In Progress</h3>
                <div id="inprogressCol" class="space-y-2 mt-2 min-h-[200px]"></div>
            </div>
            <div class="bg-white p-3 rounded shadow min-h-[400px]" id="doneArea">
                <h3 class="font-bold text-green-600 mb-2">Done</h3>
                <div id="doneCol" class="space-y-2 mt-2 min-h-[200px]"></div>
            </div>
        </div>
    `;

    // Add event listener for the log toggle button
    document.getElementById("toggleLogBtn").addEventListener("click", () => {
        const logEntries = document.getElementById("logEntries");
        const button = document.getElementById("toggleLogBtn");
        if (logEntries.style.display === "none") {
            logEntries.style.display = "block";
            button.textContent = "Ẩn log";
        } else {
            logEntries.style.display = "none";
            button.textContent = "Hiện log";
        }
    });

    loadGroups(projectId);
    setupGroupListeners(projectId);
    setupDragDrop();
    listenForLogs(projectId);
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

    loadTasks(gid);

    div.querySelector(".add-task").addEventListener("click", () => openTaskModal(gid, g.projectId));
    div.querySelector(".edit-group").addEventListener("click", () => editGroup(gid, g));
    div.querySelector(".delete-group").addEventListener("click", () => deleteGroup(gid, g));
}

// ===== Load tasks realtime (improved) =====
function loadTasks(groupId) {
    const tasksCol = collection(db, "tasks");
    const q = query(tasksCol, where("groupId", "==", groupId));

    onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            const tid = change.doc.id;
            const oldElement = document.getElementById(`task-${tid}`);

            if (change.type === "added" || change.type === "modified") {
                if (oldElement) oldElement.remove();
                renderTask(change.doc);
            } else if (change.type === "removed") {
                if (oldElement) oldElement.remove();
            }
        });
    });
}

// ===== Render task row =====
function renderTask(docSnap) {
    const t = docSnap.data();
    const tid = docSnap.id;

    let colId = t.status === "todo" ? `tasks-${t.groupId}` : `${t.status}Col`;
    const col = document.getElementById(colId);
    if (!col) return;

    const old = document.getElementById(`task-${tid}`);
    if (old) old.remove();

    const hasComment = (t.comment && String(t.comment).trim().length > 0);

    const row = document.createElement("div");
    row.id = `task-${tid}`;
    row.className = "flex justify-between items-center bg-gray-100 px-2 py-1 rounded border text-sm cursor-move";
    row.draggable = true;

    row.innerHTML = `
        <span class="truncate">${t.title}</span>
        <div class="space-x-1">
            <button class="edit-task">✏️</button>
            <button class="comment-task ${hasComment ? 'text-blue-600 font-bold' : 'text-gray-400'}">💬</button>
            <button class="delete-task">🗑️</button>
        </div>
    `;

    row.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("type", "task");
        e.dataTransfer.setData("taskId", tid);
        e.dataTransfer.setData("groupId", t.groupId);
    });

    // MODIFIED TO ADD LOGGING
    row.querySelector(".edit-task").addEventListener("click", () => {
        openModal("Edit Task", [
            { id: "title", placeholder: "Task title", type: "text", value: t.title }
        ], async (vals) => {
            const oldTitle = t.title;
            await updateDoc(doc(db, "tasks", tid), {
                title: vals.title,
                updatedAt: serverTimestamp(),
                updatedBy: auth.currentUser?.email || "Ẩn danh"
            });
            await logAction(t.projectId, `cập nhật task "${oldTitle}" thành "${vals.title}"`);
        });
    });

    // MODIFIED TO ADD LOGGING
    row.querySelector(".comment-task").addEventListener("click", () => {
        openModal("Comment Task", [
            { id: "comment", placeholder: "Nhập comment", type: "textarea", value: t.comment || "" }
        ], async (vals) => {
            if (vals.comment && vals.comment.trim().length > 0) {
                await updateDoc(doc(db, "tasks", tid), {
                    comment: vals.comment.trim(),
                    updatedAt: serverTimestamp(),
                    updatedBy: auth.currentUser?.email || "Ẩn danh"
                });
                await logAction(t.projectId, `thêm comment vào task "${t.title}"`);
            } else {
                await updateDoc(doc(db, "tasks", tid), {
                    comment: deleteField(),
                    updatedAt: serverTimestamp(),
                    updatedBy: auth.currentUser?.email || "Ẩn danh"
                });
                await logAction(t.projectId, `xóa comment của task "${t.title}"`);
            }
        });
    });

    // MODIFIED TO ADD LOGGING
    row.querySelector(".delete-task").addEventListener("click", async () => {
        if (confirm("Xóa task này?")) {
            await deleteDoc(doc(db, "tasks", tid));
            await logAction(t.projectId, `xóa task "${t.title}"`);
        }
    });

    col.appendChild(row);
}


// MODIFIED TO ADD LOGGING
async function addGroup(projectId) {
    openModal("Thêm Group", [{ id: "title", placeholder: "Tên Group" }], async (vals) => {
        await addDoc(collection(db, "groups"), {
            title: vals.title, projectId, status: "todo",
            createdAt: serverTimestamp(), createdBy: auth.currentUser?.email || "Ẩn danh"
        });
        await logAction(projectId, `thêm group mới "${vals.title}"`);
    });
}

async function editGroup(groupId, g) {
    openModal("Sửa Group", [{ id: "title", placeholder: "Tên", value: g.title }], async (vals) => {
        await updateDoc(doc(db, "groups", groupId), {
            title: vals.title, updatedAt: serverTimestamp(),
            updatedBy: auth.currentUser?.email || "Ẩn danh"
        });
        await logAction(g.projectId, `cập nhật group "${g.title}" thành "${vals.title}"`);
    });
}

async function deleteGroup(groupId, g) {
    if (!confirm("Xóa group này và tất cả task bên trong?")) return;

    const taskSnap = await getDocs(query(collection(db, "tasks"), where("groupId", "==", groupId)));
    const tasksToDelete = taskSnap.docs.map(t => t.id);
    await logAction(g.projectId, `xóa group "${g.title}" và ${tasksToDelete.length} task bên trong`);

    taskSnap.forEach(async (t) => await deleteDoc(doc(db, "tasks", t.id)));
    await deleteDoc(doc(db, "groups", groupId));
}

function openTaskModal(groupId, projectId) {
    openModal("Thêm Task", [
        { id: "title", placeholder: "Tên Task" },
        { id: "comment", placeholder: "Comment (tùy chọn)", type: "textarea" }
    ], async (vals) => {
        await addDoc(collection(db, "tasks"), {
            title: vals.title, comment: vals.comment || "",
            projectId, groupId, status: "todo",
            createdAt: serverTimestamp(), createdBy: auth.currentUser?.email || "Ẩn danh"
        });
        await logAction(projectId, `thêm task mới "${vals.title}" vào group`);
    });
}

// MODIFIED TO ADD LOGGING
function setupDragDrop() {
    ["inprogressCol", "doneCol"].forEach((colId) => {
        const col = document.getElementById(colId);
        if (!col) return;

        col.addEventListener("dragover", (e) => e.preventDefault());

        col.addEventListener("drop", async (e) => {
            e.preventDefault();

            const type = e.dataTransfer.getData("type");
            if (type !== "task") return;

            const taskId = e.dataTransfer.getData("taskId");
            if (!taskId) return;

            const newStatus = colId === "inprogressCol" ? "inprogress" : "done";
            
            // Fixed the query to get the document by ID.
            const taskDoc = await getDocs(query(collection(db, "tasks"), where("__name__", "==", taskId)));
            if (taskDoc.empty) return;
            const taskData = taskDoc.docs[0].data();

            await updateDoc(doc(db, "tasks", taskId), {
                status: newStatus,
                updatedAt: serverTimestamp(),
                updatedBy: auth.currentUser?.email || "Ẩn danh"
            });

            await logAction(taskData.projectId, `chuyển task "${taskData.title}" sang trạng thái "${newStatus}"`);
        });
    });
}

// ===== Listeners =====
function setupGroupListeners(projectId) {
    document.getElementById("addGroupBtn").addEventListener("click", () => addGroup(projectId));
}
