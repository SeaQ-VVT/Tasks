// ===== Firebase SDKs =====
import {
  getFirestore, collection, addDoc, doc,
  updateDoc, deleteDoc, query, onSnapshot,
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

// ===== Init Firebase =====
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// ===== Hiển thị Kanban =====
window.showTaskBoard = function (projectId) {
  const taskBoard = document.getElementById("taskBoard");
  taskBoard.innerHTML = `
    <div class="grid grid-cols-3 gap-4">
      <div id="todoCol" class="p-4 bg-gray-50 rounded-lg border">
        <h3 class="font-bold text-red-600 mb-2">To Do</h3>
        <button id="addTodoBtn" class="bg-blue-500 text-white px-3 py-1 rounded text-sm mb-3">+ Thêm</button>
      </div>
      <div id="inprogressCol" class="p-4 bg-gray-50 rounded-lg border">
        <h3 class="font-bold text-yellow-600 mb-2">In Progress</h3>
      </div>
      <div id="doneCol" class="p-4 bg-gray-50 rounded-lg border">
        <h3 class="font-bold text-green-600 mb-2">Done</h3>
      </div>
    </div>
  `;

  // === Realtime load groups ===
  const q = query(collection(db, "projects", projectId, "groups"));
  onSnapshot(q, (snapshot) => {
    ["todoCol", "inprogressCol", "doneCol"].forEach(id => {
      document.getElementById(id).querySelectorAll(".group-card").forEach(e => e.remove());
    });

    snapshot.forEach((docSnap) => {
      renderGroup(projectId, docSnap);
    });
  });

  // === Thêm group mới vào ToDo ===
  document.getElementById("addTodoBtn").addEventListener("click", async () => {
    const title = prompt("Tên group:");
    if (!title) return;
    await addDoc(collection(db, "projects", projectId, "groups"), {
      title,
      status: "todo",
      createdAt: serverTimestamp(),
      createdBy: auth.currentUser ? auth.currentUser.email : "Ẩn danh"
    });
  });
};

// ===== Render Group Card =====
function renderGroup(projectId, docSnap) {
  const data = docSnap.data();
  const id = docSnap.id;

  const card = document.createElement("div");
  card.className = "group-card p-3 border rounded-md shadow mb-3 bg-white";
  card.draggable = true;
  card.dataset.id = id;

  card.innerHTML = `
    <div class="flex justify-between items-center mb-2">
      <h4 class="font-semibold">${data.title}</h4>
      <div class="space-x-1">
        <button class="edit-btn bg-yellow-500 text-white px-2 py-1 rounded text-xs">Sửa</button>
        <button class="comment-btn bg-blue-500 text-white px-2 py-1 rounded text-xs">Cmt</button>
        <button class="delete-btn bg-red-500 text-white px-2 py-1 rounded text-xs">Xóa</button>
      </div>
    </div>
    ${data.deadline ? `<p class="text-xs text-gray-500 mb-1">Deadline: ${data.deadline.toDate().toLocaleDateString()}</p>` : ""}
    <div>
      <p class="text-sm font-medium mb-1">Subtasks:</p>
      <div id="subtasks-${id}" class="space-y-1"></div>
      <button data-id="${id}" class="add-subtask bg-green-500 text-white px-2 py-1 rounded text-xs mt-2">+ Subtask</button>
    </div>
  `;

  document.getElementById(`${data.status}Col`).appendChild(card);

  // === Subtasks realtime ===
  const subtasksCol = collection(db, "projects", projectId, "groups", id, "subtasks");
  onSnapshot(subtasksCol, (snapshot) => {
    const container = document.getElementById(`subtasks-${id}`);
    container.innerHTML = "";
    snapshot.forEach(subDoc => {
      const subData = subDoc.data();
      const subId = subDoc.id;

      const row = document.createElement("div");
      row.className = "flex justify-between items-center bg-gray-100 p-1 rounded";
      row.innerHTML = `
        <label class="flex items-center space-x-2">
          <input type="checkbox" ${subData.done ? "checked" : ""}/>
          <span class="${subData.done ? 'line-through text-gray-400' : ''}">${subData.title}</span>
        </label>
        <div class="space-x-1">
          <button class="edit-sub bg-yellow-400 text-xs px-1 rounded">✎</button>
          <button class="del-sub bg-red-400 text-xs px-1 rounded">🗑</button>
        </div>
      `;

      // Toggle done
      row.querySelector("input").addEventListener("change", async (e) => {
        await updateDoc(doc(db, "projects", projectId, "groups", id, "subtasks", subId), {
          done: e.target.checked
        });
      });

      // Edit subtask
      row.querySelector(".edit-sub").addEventListener("click", async () => {
        const newTitle = prompt("Sửa subtask:", subData.title);
        if (!newTitle) return;
        await updateDoc(doc(db, "projects", projectId, "groups", id, "subtasks", subId), {
          title: newTitle
        });
      });

      // Delete subtask
      row.querySelector(".del-sub").addEventListener("click", async () => {
        await deleteDoc(doc(db, "projects", projectId, "groups", id, "subtasks", subId));
      });

      container.appendChild(row);
    });
  });

  // Add subtask
  card.querySelector(".add-subtask").addEventListener("click", async () => {
    const sTitle = prompt("Tên subtask:");
    if (!sTitle) return;
    await addDoc(collection(db, "projects", projectId, "groups", id, "subtasks"), {
      title: sTitle,
      done: false,
      createdAt: serverTimestamp()
    });
  });

  // Edit group
  card.querySelector(".edit-btn").addEventListener("click", async () => {
    const newTitle = prompt("Sửa group:", data.title);
    if (!newTitle) return;
    await updateDoc(doc(db, "projects", projectId, "groups", id), {
      title: newTitle
    });
  });

  // Delete group
  card.querySelector(".delete-btn").addEventListener("click", async () => {
    if (confirm("Xóa group này?")) {
      await deleteDoc(doc(db, "projects", projectId, "groups", id));
    }
  });

  // Comment group
  card.querySelector(".comment-btn").addEventListener("click", async () => {
    const text = prompt("Nhập comment:");
    if (!text) return;
    await addDoc(collection(db, "projects", projectId, "groups", id, "comments"), {
      text,
      createdBy: auth.currentUser ? auth.currentUser.email : "Ẩn danh",
      createdAt: serverTimestamp()
    });
    alert("Đã lưu comment!");
  });

  // Drag & Drop
  card.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("groupId", id);
  });
  ["todoCol", "inprogressCol", "doneCol"].forEach(colId => {
    const col = document.getElementById(colId);
    col.ondragover = (e) => e.preventDefault();
    col.ondrop = async (e) => {
      const gId = e.dataTransfer.getData("groupId");
      let newStatus = colId.replace("Col", "");
      await updateDoc(doc(db, "projects", projectId, "groups", gId), {
        status: newStatus
      });
    };
  });
}
