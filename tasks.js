// Import Firebase
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import { getAuth } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyCW49METqezYoUKSC1N0Pi3J83Ptsf9hA8",
  authDomain: "task-manager-d18aa.firebaseapp.com",
  projectId: "task-manager-d18aa",
  storageBucket: "task-manager-d18aa.appspot.com",
  messagingSenderId: "1080268498085",
  appId: "1:1080268498085:web:767434c6a2c013b961d94c"
};

// Init Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let currentProjectId = null;

// ==========================
// Render Task Board
// ==========================
function renderTaskBoard(projectId) {
  currentProjectId = projectId;

  const board = document.getElementById("taskBoard");
  board.innerHTML = `
    <h3 class="text-2xl font-bold mb-4">Task Board</h3>
    <div class="grid grid-cols-3 gap-4">
      <div class="task-col bg-gray-100 p-4 rounded-lg" data-status="todo">
        <h4 class="font-semibold mb-2">To Do</h4>
        <div class="task-list min-h-[200px]" id="todoList"></div>
        <button id="addTaskBtn" class="mt-2 bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded">+ Thêm task</button>
      </div>
      <div class="task-col bg-gray-100 p-4 rounded-lg" data-status="inprogress">
        <h4 class="font-semibold mb-2">In Progress</h4>
        <div class="task-list min-h-[200px]" id="inprogressList"></div>
      </div>
      <div class="task-col bg-gray-100 p-4 rounded-lg" data-status="done">
        <h4 class="font-semibold mb-2">Done</h4>
        <div class="task-list min-h-[200px]" id="doneList"></div>
      </div>
    </div>
  `;

  // Load tasks
  listenTasks(projectId);

  // Add task
  document.getElementById("addTaskBtn").addEventListener("click", async () => {
    const title = prompt("Nhập tên task:");
    if (!title) return;

    const user = auth.currentUser;
    await addDoc(collection(db, "tasks"), {
      title,
      status: "todo",
      projectId: currentProjectId,
      createdAt: new Date(),
      createdBy: user ? user.email : "Ẩn danh"
    });
  });

  enableDragDrop();
}

// ==========================
// Listen for tasks
// ==========================
function listenTasks(projectId) {
  const q = query(collection(db, "tasks"), where("projectId", "==", projectId));

  onSnapshot(q, (snapshot) => {
    document.getElementById("todoList").innerHTML = "";
    document.getElementById("inprogressList").innerHTML = "";
    document.getElementById("doneList").innerHTML = "";

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const taskEl = document.createElement("div");
      taskEl.className = "bg-white p-2 rounded shadow mb-2 cursor-move";
      taskEl.draggable = true;
      taskEl.dataset.id = docSnap.id;
      taskEl.dataset.status = data.status;

      taskEl.innerHTML = `
        <p class="font-medium">${data.title}</p>
        <p class="text-xs text-gray-500">By: ${data.createdBy || "-"}</p>
        <div class="flex space-x-2 mt-1">
          <button class="editTask text-blue-500 text-sm">Sửa</button>
          <button class="deleteTask text-red-500 text-sm">Xóa</button>
        </div>
      `;

      document.getElementById(data.status + "List").appendChild(taskEl);

      // Edit task
      taskEl.querySelector(".editTask").addEventListener("click", async () => {
        const newTitle = prompt("Tên mới:", data.title);
        if (newTitle) {
          await updateDoc(doc(db, "tasks", docSnap.id), { title: newTitle });
        }
      });

      // Delete task
      taskEl.querySelector(".deleteTask").addEventListener("click", async () => {
        if (confirm("Xóa task này?")) {
          await deleteDoc(doc(db, "tasks", docSnap.id));
        }
      });
    });
  });
}

// ==========================
// Drag & Drop
// ==========================
function enableDragDrop() {
  document.querySelectorAll(".task-list").forEach(list => {
    list.addEventListener("dragover", (e) => {
      e.preventDefault();
    });

    list.addEventListener("drop", async (e) => {
      e.preventDefault();
      const taskId = e.dataTransfer.getData("text/plain");
      const newStatus = list.id.replace("List", "");

      await updateDoc(doc(db, "tasks", taskId), { status: newStatus });
    });
  });

  document.addEventListener("dragstart", (e) => {
    if (e.target.classList.contains("bg-white")) {
      e.dataTransfer.setData("text/plain", e.target.dataset.id);
    }
  });
}

// ==========================
// Export (để gọi từ ngoài)
// ==========================
export { renderTaskBoard };
