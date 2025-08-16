// ===== Firebase SDKs =====
import {
    getFirestore,
    collection,
    addDoc,
    query,
    where,
    onSnapshot,
    doc,
    updateDoc,
    deleteDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

const db = getFirestore();
const auth = getAuth();

let currentProjectId = null;
const taskBoard = document.getElementById("taskBoard");

// ===== Show task board =====
export function showTaskBoard(projectId) {
    currentProjectId = projectId;

    taskBoard.innerHTML = `
        <div class="grid grid-cols-3 gap-4">
            <!-- To Do -->
            <div class="bg-white p-4 rounded shadow">
                <h3 class="font-bold text-lg text-red-600 mb-2">To Do</h3>
                <button id="addTodoBtn" class="bg-blue-500 text-white px-3 py-1 rounded text-sm">+ Thêm</button>
                <div id="todoCol" class="space-y-2 mt-2"></div>
            </div>

            <!-- In Progress -->
            <div class="bg-white p-4 rounded shadow">
                <h3 class="font-bold text-lg text-yellow-600 mb-2">In Progress</h3>
                <button id="addInProgressBtn" class="bg-blue-500 text-white px-3 py-1 rounded text-sm">+ Thêm</button>
                <div id="inprogressCol" class="space-y-2 mt-2"></div>
            </div>

            <!-- Done -->
            <div class="bg-white p-4 rounded shadow">
                <h3 class="font-bold text-lg text-green-600 mb-2">Done</h3>
                <button id="addDoneBtn" class="bg-blue-500 text-white px-3 py-1 rounded text-sm">+ Thêm</button>
                <div id="doneCol" class="space-y-2 mt-2"></div>
            </div>
        </div>
    `;

    setupTaskListeners(projectId);
    loadTasks(projectId);
}

// ===== Load tasks realtime =====
function loadTasks(projectId) {
    const tasksCol = collection(db, "tasks");
    const q = query(tasksCol, where("projectId", "==", projectId));

    onSnapshot(q, (snapshot) => {
        document.getElementById("todoCol").innerHTML = "";
        document.getElementById("inprogressCol").innerHTML = "";
        document.getElementById("doneCol").innerHTML = "";

        snapshot.forEach((docSnap) => {
            renderTask(docSnap);
        });
    });
}

// ===== Render task card =====
function renderTask(docSnap) {
    const data = docSnap.data();
    const id = docSnap.id;

    const taskCard = document.createElement("div");
    taskCard.className =
        "bg-gray-100 p-3 rounded border shadow-sm text-sm";

    taskCard.innerHTML = `
        <p class="font-semibold">${data.title}</p>
        <p class="text-gray-600 text-xs">Người tạo: ${data.createdBy || "-"}</p>
        <p class="text-gray-500 text-xs">Trạng thái: ${data.status}</p>
        <div class="flex space-x-2 mt-2">
            <button data-id="${id}" class="edit-task bg-yellow-500 hover:bg-yellow-600 text-white px-2 py-1 rounded">Sửa</button>
            <button data-id="${id}" class="delete-task bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded">Xóa</button>
        </div>
    `;

    document.getElementById(`${data.status}Col`).appendChild(taskCard);

    // Event edit/delete
    taskCard.querySelector(".edit-task").addEventListener("click", () => {
        editTask(id, data);
    });

    taskCard.querySelector(".delete-task").addEventListener("click", () => {
        deleteTask(id);
    });
}

// ===== Add new task =====
function setupTaskListeners(projectId) {
    document.getElementById("addTodoBtn").addEventListener("click", () => addTask("todo", projectId));
    document.getElementById("addInProgressBtn").addEventListener("click", () => addTask("inprogress", projectId));
    document.getElementById("addDoneBtn").addEventListener("click", () => addTask("done", projectId));
}

async function addTask(status, projectId) {
    const title = prompt("Nhập tên công việc:");
    if (!title) return;

    const user = auth.currentUser;

    await addDoc(collection(db, "tasks"), {
        title,
        projectId,
        status,
        createdAt: serverTimestamp(),
        createdBy: user ? user.email : "Ẩn danh"
    });
}

// ===== Edit task =====
async function editTask(id, oldData) {
    const newTitle = prompt("Sửa tên công việc:", oldData.title);
    if (!newTitle) return;

    await updateDoc(doc(db, "tasks", id), {
        title: newTitle,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser ? auth.currentUser.email : "Ẩn danh"
    });
}

// ===== Delete task =====
async function deleteTask(id) {
    if (confirm("Xóa công việc này?")) {
        await deleteDoc(doc(db, "tasks", id));
    }
}
