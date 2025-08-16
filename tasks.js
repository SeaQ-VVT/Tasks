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
        <div class="grid grid-cols-3 gap-4">
            <!-- To Do -->
            <div class="bg-white p-4 rounded shadow" id="todoArea">
                <h3 class="font-bold text-lg text-red-600 mb-2">To Do</h3>
                <button id="addTodoBtn" class="bg-blue-500 text-white px-3 py-1 rounded text-sm">+ Thêm</button>
                <div id="todoCol" class="space-y-2 mt-2 min-h-[100px]"></div>
            </div>

            <!-- In Progress -->
            <div class="bg-white p-4 rounded shadow" id="inprogressArea">
                <h3 class="font-bold text-lg text-yellow-600 mb-2">In Progress</h3>
                <button id="addInProgressBtn" class="bg-blue-500 text-white px-3 py-1 rounded text-sm">+ Thêm</button>
                <div id="inprogressCol" class="space-y-2 mt-2 min-h-[100px]"></div>
            </div>

            <!-- Done -->
            <div class="bg-white p-4 rounded shadow" id="doneArea">
                <h3 class="font-bold text-lg text-green-600 mb-2">Done</h3>
                <button id="addDoneBtn" class="bg-blue-500 text-white px-3 py-1 rounded text-sm">+ Thêm</button>
                <div id="doneCol" class="space-y-2 mt-2 min-h-[100px]"></div>
            </div>
        </div>
    `;

    loadTasks(projectId);
    setupTaskListeners(projectId);
    setupDragDrop(projectId);
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
    taskCard.className = "bg-gray-100 p-3 rounded border shadow-sm text-sm cursor-move";
    taskCard.draggable = true;
    taskCard.dataset.id = id;

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

    document.getElementById(`${data.status}Col`).appendChild(taskCard);

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
            await deleteDoc(doc(db, "tasks", id));
        }
    });
}

// ===== Setup listeners =====
function setupTaskListeners(projectId) {
    document.getElementById("addTodoBtn").addEventListener("click", () => addTask("todo", projectId));
    document.getElementById("addInProgressBtn").addEventListener("click", () => addTask("inprogress", projectId));
    document.getElementById("addDoneBtn").addEventListener("click", () => addTask("done", projectId));
}

async function addTask(status, projectId) {
    const title = prompt("Nhập tên công việc:");
    if (!title) return;
    const comment = prompt("Nhập comment cho công việc (tuỳ chọn):");

    await addDoc(collection(db, "tasks"), {
        title,
        comment: comment || "",
        projectId,
        status,
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser ? auth.currentUser.email : "Ẩn danh"
    });
}

// ===== Drag & Drop setup =====
function setupDragDrop(projectId) {
    ["todoCol", "inprogressCol", "doneCol"].forEach((colId) => {
        const col = document.getElementById(colId);
        col.addEventListener("dragover", (e) => e.preventDefault());
        col.addEventListener("drop", async (e) => {
            e.preventDefault();
            const taskId = e.dataTransfer.getData("text/plain");
            if (!taskId) return;

            let newStatus = "todo";
            if (colId === "inprogressCol") newStatus = "inprogress";
            if (colId === "doneCol") newStatus = "done";

            await updateDoc(doc(db, "tasks", taskId), {
                status: newStatus,
                updatedAt: serverTimestamp(),
                updatedBy: auth.currentUser ? auth.currentUser.email : "Ẩn danh"
            });
        });
    });
}
