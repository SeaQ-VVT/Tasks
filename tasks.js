// ===== Firebase SDKs =====
import {
  getFirestore,
  collection,
  addDoc,
  query,
  onSnapshot,
  updateDoc,
  doc,
  deleteDoc,
  orderBy,
  serverTimestamp
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

// Init Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ===== Hiển thị Task Board =====
export function showTaskBoard(projectId) {
  const board = document.getElementById("taskBoard");
  board.innerHTML = `
    <h3 class="text-2xl font-bold mb-4">Công việc cho dự án</h3>
    <div class="grid grid-cols-3 gap-4">
      <div id="todoCol" class="bg-gray-100 p-4 rounded">
        <h4 class="font-semibold mb-2">To Do</h4>
        <div class="task-list space-y-2"></div>
        <button class="add-task-btn bg-blue-500 text-white px-2 py-1 rounded" data-status="todo">+ Thêm</button>
      </div>
      <div id="progressCol" class="bg-gray-100 p-4 rounded">
        <h4 class="font-semibold mb-2">In Progress</h4>
        <div class="task-list space-y-2"></div>
        <button class="add-task-btn bg-blue-500 text-white px-2 py-1 rounded" data-status="inprogress">+ Thêm</button>
      </div>
      <div id="doneCol" class="bg-gray-100 p-4 rounded">
        <h4 class="font-semibold mb-2">Done</h4>
        <div class="task-list space-y-2"></div>
        <button class="add-task-btn bg-blue-500 text-white px-2 py-1 rounded" data-status="done">+ Thêm</button>
      </div>
    </div>
  `;

  // Nghe realtime Firestore
  const q = query(
    collection(db, "projects", projectId, "tasks"),
    orderBy("createdAt", "asc")
  );

  onSnapshot(q, (snapshot) => {
    board.querySelectorAll(".task-list").forEach((c) => (c.innerHTML = ""));
    snapshot.forEach((docSnap) => {
      const t = docSnap.data();
      const el = document.createElement("div");
      el.className =
        "bg-white shadow px-2 py-1 rounded flex justify-between items-center";
      el.innerHTML = `
        <span>${t.title}</span>
        <button class="delete-task bg-red-500 text-white px-2 rounded" data-id="${docSnap.id}">X</button>
      `;
      board.querySelector(`#${t.status}Col .task-list`).appendChild(el);
    });

    // Delete
    board.querySelectorAll(".delete-task").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const id = e.target.dataset.id;
        await deleteDoc(doc(db, "projects", projectId, "tasks", id));
      });
    });
  });

  // Add task
  board.querySelectorAll(".add-task-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const title = prompt("Nhập tên công việc:");
      if (!title) return;
      await addDoc(collection(db, "projects", projectId, "tasks"), {
        title,
        status: btn.dataset.status,
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser ? auth.currentUser.email : "Ẩn danh",
      });
    });
  });
}
