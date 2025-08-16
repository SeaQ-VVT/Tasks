// ===== Firebase SDKs =====
import {
  getFirestore, collection, addDoc, doc,
  updateDoc, deleteDoc, query, onSnapshot,
  orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

// ===== Firebase config =====
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

// ===== Hiển thị TaskBoard =====
window.showTaskBoard = function (projectId) {
  if (!projectId) return;

  const taskBoard = document.getElementById("taskBoard");
  taskBoard.innerHTML = `
    <div class="grid grid-cols-3 gap-4">
      <div id="todoCol" class="p-3 bg-gray-50 rounded-lg border">
        <h3 class="font-bold text-red-600 mb-2">To Do</h3>
        <button id="addTodoBtn" class="bg-blue-500 text-white px-3 py-1 rounded text-sm mb-3">+ Thêm</button>
        <div id="todoList"></div>
      </div>
      <div id="progressCol" class="p-3 bg-gray-50 rounded-lg border">
        <h3 class="font-bold text-yellow-600 mb-2">In Progress</h3>
        <div id="progressList"></div>
      </div>
      <div id="doneCol" class="p-3 bg-gray-50 rounded-lg border">
        <h3 class="font-bold text-green-600 mb-2">Done</h3>
        <div id="doneList"></div>
      </div>
    </div>
  `;

  const colRef = collection(db, "projects", projectId, "tasks");
  const q = query(colRef, orderBy("createdAt", "desc"));

  onSnapshot(q, (snapshot) => {
    document.getElementById("todoList").innerHTML = "";
    document.getElementById("progressList").innerHTML = "";
    document.getElementById("doneList").innerHTML = "";

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const div = document.createElement("div");
      div.className = "p-2 border rounded mb-2 bg-white shadow-sm cursor-move";
      div.draggable = true;
      div.dataset.id = docSnap.id;

      div.innerHTML = `
        <p class="font-medium">${data.title}</p>
        <p class="text-sm text-gray-500">${data.status || "todo"}</p>
        <div class="flex gap-2 mt-1">
          <button data-id="${docSnap.id}" class="edit-task-btn text-blue-500 text-xs">Sửa</button>
          <button data-id="${docSnap.id}" class="delete-task-btn text-red-500 text-xs">Xóa</button>
        </div>
      `;

      if (data.status === "todo") {
        document.getElementById("todoList").appendChild(div);
      } else if (data.status === "progress") {
        document.getElementById("progressList").appendChild(div);
      } else if (data.status === "done") {
        document.getElementById("doneList").appendChild(div);
      }
    });

    // Thêm Task mới vào ToDo
    document.getElementById("addTodoBtn").onclick = async () => {
      const title = prompt("Nhập tên công việc:");
      if (!title) return;
      await addDoc(colRef, {
        title,
        status: "todo",
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser ? auth.currentUser.email : "Ẩn danh"
      });
    };

    // Xóa Task
    document.querySelectorAll(".delete-task-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const id = e.target.dataset.id;
        await deleteDoc(doc(db, "projects", projectId, "tasks", id));
      });
    });

    // Sửa Task
    document.querySelectorAll(".edit-task-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const id = e.target.dataset.id;
        const newTitle = prompt("Sửa tên công việc:");
        if (!newTitle) return;
        await updateDoc(doc(db, "projects", projectId, "tasks", id), {
          title: newTitle,
          updatedAt: serverTimestamp(),
          updatedBy: auth.currentUser ? auth.currentUser.email : "Ẩn danh"
        });
      });
    });

    // Kéo thả Task qua cột khác
    setupDragDrop(projectId);
  });
};

// ===== Setup Drag Drop =====
function setupDragDrop(projectId) {
  document.querySelectorAll("#todoList div, #progressList div, #doneList div")
    .forEach(taskEl => {
      taskEl.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("taskId", e.target.dataset.id);
      });
    });

  ["todo", "progress", "done"].forEach(status => {
    const col = document.getElementById(status + "List");
    col.ondragover = (e) => e.preventDefault();
    col.ondrop = async (e) => {
      const taskId = e.dataTransfer.getData("taskId");
      await updateDoc(doc(db, "projects", projectId, "tasks", taskId), {
        status,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser ? auth.currentUser.email : "Ẩn danh"
      });
    };
  });
}
