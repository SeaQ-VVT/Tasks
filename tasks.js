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
                <div id="inprogressCol" class="space-y-2 mt-2 min-h-[200px]"></div>
            </div>
            <div class="bg-white p-3 rounded shadow min-h-[400px]" id="doneArea">
                <h3 class="font-bold text-green-600 mb-2">Done</h3>
                <div id="doneCol" class="space-y-2 mt-2 min-h-[200px]"></div>
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

    const hasComment = t.comment && t.comment.trim() !== "";

    const row = document.createElement("div");
    row.id = `task-${tid}`;
    row.className = "flex justify-between items-center bg-gray-100 px-2 py-1 rounded border text-sm cursor-move";
    row.draggable = true;
    row.dataset.id = tid;
    row.dataset.group = t.groupId;

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

    row.querySelector(".edit-task").addEventListener("click", () => {
        openModal("Sửa Task", [
            { id: "title", placeholder: "Tên", value: t.title },
            { id: "comment", placeholder: "Comment", type: "textarea", value: t.comment || "" }
        ], async (vals) => {
            await updateDoc(doc(db, "tasks", tid), {
                title: vals.title, comment: vals.comment,
                updatedAt: serverTimestamp(), updatedBy: auth.currentUser?.email || "Ẩn danh"
            });
        });
    });

    row.querySelector(".comment-task").addEventListener("click", () => {
        openModal("Thêm/Sửa Comment", [
            { id: "comment", placeholder: "Comment", type: "textarea", value: t.comment || "" }
        ], async (vals) => {
            await updateDoc(doc(db, "tasks", tid), {
                comment: vals.comment, updatedAt: serverTimestamp(),
                updatedBy: auth.currentUser?.email || "Ẩn danh"
            });
        });
    });

    row.querySelector(".delete-task").addEventListener("click", async () => {
        if (confirm("Xóa task này?")) {
            await deleteDoc(doc(db, "tasks", tid));
        }
    });

    col.appendChild(row);
}

// ===== Group actions =====
async function addGroup(projectId) {
    openModal("Thêm Group", [{ id: "title", placeholder: "Tên Group" }], async (vals) => {
        await addDoc(collection(db, "groups"), {
            title: vals.title, projectId, status: "todo",
            createdAt: serverTimestamp(), createdBy: auth.currentUser?.email || "Ẩn danh"
        });
    });
}

async function editGroup(groupId, g) {
    openModal("Sửa Group", [{ id: "title", placeholder: "Tên", value: g.title }], async (vals) => {
        await updateDoc(doc(db, "groups", groupId), {
            title: vals.title, updatedAt: serverTimestamp(),
            updatedBy: auth.currentUser?.email || "Ẩn danh"
        });
    });
}

async function deleteGroup(groupId, g) {
    if (!confirm("Xóa group này và tất cả task bên trong?")) return;

    const taskSnap = await getDocs(query(collection(db, "tasks"), where("groupId", "==", groupId)));
    taskSnap.forEach(async (t) => await deleteDoc(doc(db, "tasks", t.id)));

    await deleteDoc(doc(db, "groups", groupId));
}

// ===== Task actions =====
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
    });
}

// ===== Listeners =====
function setupGroupListeners(projectId) {
    document.getElementById("addGroupBtn").addEventListener("click", () => addGroup(projectId));
}

// ===== Drag & Drop (fix) =====
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
            const groupId = e.dataTransfer.getData("groupId");
            if (!taskId || !groupId) return;

            const newStatus = colId === "inprogressCol" ? "inprogress" : "done";

            await updateDoc(doc(db, "tasks", taskId), {
                status: newStatus,
                updatedAt: serverTimestamp(),
                updatedBy: auth.currentUser?.email || "Ẩn danh"
            });
        });
    });
}
