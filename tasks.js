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
    getDoc,
    deleteField,
    orderBy,
    limit
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
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

const projectId = "project123";

// Lắng nghe trạng thái đăng nhập
onAuthStateChanged(auth, (user) => {
    if (user) {
        showTaskBoard(projectId);
    } else {
        console.log("Người dùng chưa đăng nhập. Chuyển hướng...");
    }
});

// ===== Hàm ghi log hoạt động =====
async function logActivity(action, targetType, targetId, description, oldValue = null, newValue = null) {
    const user = auth.currentUser;
    if (!user) {
        console.error("Lỗi: Không thể ghi log. Người dùng chưa đăng nhập.");
        return;
    }
    
    try {
        await addDoc(collection(db, "activity_logs"), {
            projectId: projectId,
            actor: user.email,
            action,
            targetType,
            targetId,
            description,
            oldValue,
            newValue,
            timestamp: serverTimestamp(),
        });
        console.log("Log đã được ghi thành công.");
    } catch (e) {
        console.error("Lỗi khi ghi log hoạt động:", e);
    }
}

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

// ===== Hiển thị bảng công việc và log =====
export function showTaskBoard(projectId) {
    const taskBoard = document.getElementById("taskBoard");
    if (!taskBoard) {
        console.error("Không tìm thấy phần tử 'taskBoard'. Vui lòng kiểm tra HTML.");
        return;
    }

    taskBoard.innerHTML = `
        <div class="w-full bg-gray-100 p-4 rounded shadow mb-4">
            <div class="flex justify-between items-center">
                <h3 class="font-bold text-lg">Lịch sử hoạt động của dự án</h3>
                <button id="refreshLogsBtn" class="bg-blue-500 text-white px-2 py-1 rounded text-xs">Làm mới</button>
            </div>
            <div id="projectLog" class="max-h-64 overflow-y-auto space-y-1 text-sm mt-2"></div>
        </div>
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
    setupDragDrop(projectId);
    setupLogDisplay(projectId);
    setupLogRefresh(projectId);
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
        e.dataTransfer.setData("projectId", t.projectId);
        e.dataTransfer.setData("status", t.status);
    });
    row.querySelector(".edit-task").addEventListener("click", () => {
        openModal("Edit Task", [
            { id: "title", placeholder: "Task title", type: "text", value: t.title }
        ], async (vals) => {
            const newTitle = vals.title.trim();
            if (t.title !== newTitle) {
                await updateDoc(doc(db, "tasks", tid), {
                    title: newTitle,
                    updatedAt: serverTimestamp(),
                    updatedBy: auth.currentUser.email
                });
                logActivity("edit_task", "task", tid, `Đổi tên task từ "${t.title}" thành "${newTitle}"`, t.title, newTitle);
            }
        });
    });
    row.querySelector(".comment-task").addEventListener("click", () => {
        openModal("Comment Task", [
            { id: "comment", placeholder: "Nhập comment", type: "textarea", value: t.comment || "" }
        ], async (vals) => {
            const newComment = vals.comment.trim();
            if (t.comment !== newComment) {
                if (newComment.length > 0) {
                    await updateDoc(doc(db, "tasks", tid), {
                        comment: newComment,
                        updatedAt: serverTimestamp(),
                        updatedBy: auth.currentUser.email
                    });
                    logActivity("edit_comment", "task", tid, `Cập nhật comment cho task "${t.title}"`);
                } else {
                    await updateDoc(doc(db, "tasks", tid), {
                        comment: deleteField(),
                        updatedAt: serverTimestamp(),
                        updatedBy: auth.currentUser.email
                    });
                    logActivity("delete_comment", "task", tid, `Xóa comment của task "${t.title}"`);
                }
            }
        });
    });
    row.querySelector(".delete-task").addEventListener("click", async () => {
        if (confirm("Xóa task này?")) {
            await deleteDoc(doc(db, "tasks", tid));
            logActivity("delete_task", "task", tid, `Đã xóa task: "${t.title}"`);
        }
    });
    col.appendChild(row);
}

// ===== Group actions =====
async function addGroup(projectId) {
    openModal("Thêm Group", [{ id: "title", placeholder: "Tên Group" }], async (vals) => {
        const docRef = await addDoc(collection(db, "groups"), {
            title: vals.title, projectId, status: "todo",
            createdAt: serverTimestamp(), createdBy: auth.currentUser.email
        });
        logActivity("create_group", "group", docRef.id, `Đã tạo group: "${vals.title}"`);
    });
}

async function editGroup(groupId, g) {
    openModal("Sửa Group", [{ id: "title", placeholder: "Tên", value: g.title }], async (vals) => {
        const newTitle = vals.title.trim();
        if (g.title !== newTitle) {
            await updateDoc(doc(db, "groups", groupId), {
                title: newTitle, updatedAt: serverTimestamp(),
                updatedBy: auth.currentUser.email
            });
            logActivity("edit_group", "group", groupId, `Đổi tên group từ "${g.title}" thành "${newTitle}"`, g.title, newTitle);
        }
    });
}

async function deleteGroup(groupId, g) {
    if (!confirm("Xóa group này và tất cả task bên trong?")) return;
    const taskSnap = await getDocs(query(collection(db, "tasks"), where("groupId", "==", groupId)));
    const tasksDeleted = taskSnap.docs.map(t => t.data().title);
    taskSnap.forEach(async (t) => await deleteDoc(doc(db, "tasks", t.id)));
    await deleteDoc(doc(db, "groups", groupId));
    logActivity("delete_group", "group", groupId, `Đã xóa group: "${g.title}" và các task: ${tasksDeleted.join(", ")}`);
}

// ===== Task actions =====
function openTaskModal(groupId, projectId) {
    openModal("Thêm Task", [
        { id: "title", placeholder: "Tên Task" },
        { id: "comment", placeholder: "Comment (tùy chọn)", type: "textarea" }
    ], async (vals) => {
        const docRef = await addDoc(collection(db, "tasks"), {
            title: vals.title, comment: vals.comment || "",
            projectId, groupId, status: "todo",
            createdAt: serverTimestamp(), createdBy: auth.currentUser.email
        });
        logActivity("create_task", "task", docRef.id, `Đã tạo task: "${vals.title}"`);
    });
}

// ===== Listeners =====
function setupGroupListeners(projectId) {
    document.getElementById("addGroupBtn").addEventListener("click", () => addGroup(projectId));
}

// ===== Drag & Drop =====
function setupDragDrop(projectId) {
    ["inprogressCol", "doneCol"].forEach((colId) => {
        const col = document.getElementById(colId);
        if (!col) return;
        col.addEventListener("dragover", (e) => e.preventDefault());
        col.addEventListener("drop", async (e) => {
            e.preventDefault();
            const type = e.dataTransfer.getData("type");
            if (type !== "task") return;
            const taskId = e.dataTransfer.getData("taskId");
            const oldStatus = e.dataTransfer.getData("status");
            const newStatus = colId === "inprogressCol" ? "inprogress" : "done";
            if (oldStatus !== newStatus) {
                await updateDoc(doc(db, "tasks", taskId), {
                    status: newStatus,
                    updatedAt: serverTimestamp(),
                    updatedBy: auth.currentUser.email
                });
                logActivity("move_task", "task", taskId, `Đã di chuyển task "${taskId}" từ "${oldStatus}" sang "${newStatus}"`, oldStatus, newStatus);
            }
        });
    });
}

// ===== Hiển thị Log =====
function renderLogs(logs) {
    const logContainer = document.getElementById("projectLog");
    if (!logContainer) return;

    logContainer.innerHTML = "";
    logs.forEach((log) => {
        const logItem = document.createElement("p");
        logItem.className = "text-gray-600 my-1";
        const formattedTime = log.timestamp ? new Date(log.timestamp.toDate()).toLocaleTimeString() : '...';
        logItem.innerHTML = `<span class="font-semibold text-blue-700">${log.actor}</span>: ${log.description} <span class="text-gray-400">(${formattedTime})</span>`;
        logContainer.appendChild(logItem);
    });
}

// ===== Tải Log từ Firestore (một lần) =====
function setupLogDisplay(projectId) {
    const logsQuery = query(
        collection(db, "activity_logs"),
        where("projectId", "==", projectId),
        orderBy("timestamp", "desc"),
        limit(20)
    );
    try {
        onSnapshot(logsQuery, (snapshot) => {
            const logs = [];
            snapshot.forEach((docSnap) => logs.push(docSnap.data()));
            renderLogs(logs);
            console.log("Log đã được tải thành công bằng onSnapshot.");
        }, (error) => {
            console.error("Lỗi khi tải log bằng onSnapshot:", error);
        });
    } catch (e) {
        console.error("Lỗi khi thiết lập onSnapshot:", e);
    }
}

function setupLogRefresh(projectId) {
    const refreshBtn = document.getElementById("refreshLogsBtn");
    if (refreshBtn) {
        refreshBtn.addEventListener("click", async () => {
            try {
                const logsQuery = query(
                    collection(db, "activity_logs"),
                    where("projectId", "==", projectId),
                    orderBy("timestamp", "desc"),
                    limit(20)
                );
                const snapshot = await getDocs(logsQuery);
                const logs = [];
                snapshot.forEach((docSnap) => logs.push(docSnap.data()));
                renderLogs(logs);
                console.log("Log đã được tải thủ công.");
            } catch (e) {
                console.error("Lỗi khi tải log thủ công:", e);
            }
        });
    }
}
