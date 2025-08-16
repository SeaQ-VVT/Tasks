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

    <!-- Popup comment -->
    <div id="commentPopup" class="fixed inset-0 bg-black bg-opacity-50 hidden items-center justify-center">
      <div class="bg-white p-4 rounded shadow-lg w-96">
        <h3 class="font-bold mb-2">Bình luận</h3>
        <div id="commentList" class="mb-3 max-h-60 overflow-y-auto"></div>
        <textarea id="commentInput" class="w-full border rounded p-2 mb-2" placeholder="Viết bình luận..."></textarea>
        <div class="flex justify-end gap-2">
          <button id="closeComment" class="px-3 py-1 bg-gray-400 text-white rounded">Đóng</button>
          <button id="sendComment" class="px-3 py-1 bg-blue-500 text-white rounded">Gửi</button>
        </div>
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
          <button data-id="${docSnap.id}" class="comment-task-btn text-green-500 text-xs">Comment</button>
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

    // Thêm Task
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

    // Bình luận Task
    document.querySelectorAll(".comment-task-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const taskId = e.target.dataset.id;
        openCommentPopup(projectId, taskId);
      });
    });

    // Kéo thả
    setupDragDrop(projectId);
  });
};

// ===== Drag & Drop =====
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

// ===== Comment Popup =====
function openCommentPopup(projectId, taskId) {
  const popup = document.getElementById("commentPopup");
  popup.classList.remove("hidden");
  popup.classList.add("flex");

  const commentList = document.getElementById("commentList");
  const commentInput = document.getElementById("commentInput");

  const commentsRef = collection(db, "projects", projectId, "tasks", taskId, "comments");
  const q = query(commentsRef, orderBy("createdAt", "asc"));

  onSnapshot(q, (snapshot) => {
    commentList.innerHTML = "";
    snapshot.forEach((docSnap) => {
      const c = docSnap.data();
      const p = document.createElement("p");
      p.className = "text-sm border-b py-1";
      p.innerText = `${c.createdBy || "Ẩn danh"}: ${c.text}`;
      commentList.appendChild(p);
    });
  });

  document.getElementById("sendComment").onclick = async () => {
    const text = commentInput.value.trim();
    if (!text) return;
    await addDoc(commentsRef, {
      text,
      createdAt: serverTimestamp(),
      createdBy: auth.currentUser ? auth.currentUser.email : "Ẩn danh"
    });
    commentInput.value = "";
  };

  document.getElementById("closeComment").onclick = () => {
    popup.classList.add("hidden");
    popup.classList.remove("flex");
  };
}
