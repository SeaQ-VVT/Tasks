// ===== Firebase SDKs =====
import {
  getFirestore, collection, addDoc, query, onSnapshot,
  doc, deleteDoc, updateDoc, orderBy, serverTimestamp, arrayUnion
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

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// ===== Show Task Board =====
window.showTaskBoard = function (projectId) {
  document.getElementById("taskBoard").innerHTML = `
    <div class="grid grid-cols-3 gap-4 mt-4">
      <div id="todoCol" class="p-3 bg-gray-50 rounded shadow">
        <h3 class="font-bold text-red-600 mb-2">To Do</h3>
        <button id="addTodoBtn" class="bg-blue-500 text-white px-2 py-1 rounded text-sm mb-2">+ Thêm</button>
      </div>
      <div id="inprogressCol" class="p-3 bg-gray-50 rounded shadow">
        <h3 class="font-bold text-yellow-600 mb-2">In Progress</h3>
      </div>
      <div id="doneCol" class="p-3 bg-gray-50 rounded shadow">
        <h3 class="font-bold text-green-600 mb-2">Done</h3>
      </div>
    </div>
  `;

  // Load groups realtime
  const groupsCol = collection(db, "projects", projectId, "groups");
  const q = query(groupsCol, orderBy("createdAt", "desc"));
  onSnapshot(q, (snapshot) => {
    ["todoCol", "inprogressCol", "doneCol"].forEach(id => {
      document.getElementById(id).querySelectorAll(".group-card").forEach(el => el.remove());
    });

    snapshot.forEach(docSnap => renderGroup(docSnap, projectId));
  });

  // Add group
  document.getElementById("addTodoBtn").addEventListener("click", async () => {
    const title = prompt("Tên group:");
    if (!title) return;
    await addDoc(groupsCol, {
      title,
      status: "todo",
      projectId,
      createdAt: serverTimestamp(),
      createdBy: auth.currentUser ? auth.currentUser.email : "Ẩn danh"
    });
  });
};

// ===== Render Group (card) =====
function renderGroup(docSnap, projectId) {
  const data = docSnap.data();
  const id = docSnap.id;

  const groupDiv = document.createElement("div");
  groupDiv.className = "group-card p-3 border rounded-md shadow mb-3 bg-white";
  groupDiv.setAttribute("draggable", true);
  groupDiv.dataset.id = id;

  groupDiv.innerHTML = `
    <h4 class="font-semibold">${data.title}</h4>
    ${data.deadline ? `<p class="text-xs text-gray-500">Deadline: ${data.deadline.toDate().toLocaleDateString()}</p>` : ""}
    <div>
      <p class="text-sm font-medium mb-1">Subtasks:</p>
      <div id="subtasks-${id}" class="space-y-1"></div>
      <button data-id="${id}" class="add-subtask bg-blue-500 text-white px-2 py-1 rounded text-xs mt-2">+ Tệp</button>
    </div>
  `;

  document.getElementById(`${data.status}Col`).appendChild(groupDiv);
  enableDragAndDrop(groupDiv, projectId, id);

  // Load subtasks realtime
  const subtasksCol = collection(db, "projects", projectId, "groups", id, "subtasks");
  onSnapshot(subtasksCol, (snapshot) => {
    const container = document.getElementById(`subtasks-${id}`);
    container.innerHTML = "";
    snapshot.forEach(stDoc => renderSubtask(stDoc, projectId, id, container));
  });

  // Add subtask
  groupDiv.querySelector(".add-subtask").addEventListener("click", async () => {
    const title = prompt("Tên subtask:");
    if (!title) return;
    await addDoc(collection(db, "projects", projectId, "groups", id, "subtasks"), {
      title,
      done: false,
      comments: [],
      createdAt: serverTimestamp(),
      createdBy: auth.currentUser ? auth.currentUser.email : "Ẩn danh"
    });
  });
}

// ===== Render Subtask =====
function renderSubtask(docSnap, projectId, groupId, container) {
  const data = docSnap.data();
  const subId = docSnap.id;

  const div = document.createElement("div");
  div.className = "flex justify-between items-center bg-gray-50 p-2 rounded";

  div.innerHTML = `
    <label class="flex items-center space-x-2 flex-1">
      <input type="checkbox" ${data.done ? "checked" : ""}/>
      <span class="${data.done ? 'line-through text-gray-400' : ''}">${data.title}</span>
    </label>
    <div class="space-x-1">
      <button class="edit-sub bg-yellow-500 text-white px-2 py-1 text-xs rounded">Sửa</button>
      <button class="del-sub bg-red-500 text-white px-2 py-1 text-xs rounded">Xóa</button>
      <button class="comment-sub bg-green-500 text-white px-2 py-1 text-xs rounded">💬</button>
    </div>
  `;

  // Toggle done
  div.querySelector("input").addEventListener("change", async (e) => {
    await updateDoc(doc(db, "projects", projectId, "groups", groupId, "subtasks", subId), {
      done: e.target.checked
    });
  });

  // Edit
  div.querySelector(".edit-sub").addEventListener("click", async () => {
    const newTitle = prompt("Tên mới:", data.title);
    if (!newTitle) return;
    await updateDoc(doc(db, "projects", projectId, "groups", groupId, "subtasks", subId), {
      title: newTitle
    });
  });

  // Delete
  div.querySelector(".del-sub").addEventListener("click", async () => {
    if (confirm("Xóa subtask này?")) {
      await deleteDoc(doc(db, "projects", projectId, "groups", groupId, "subtasks", subId));
    }
  });

  // Comment
  div.querySelector(".comment-sub").addEventListener("click", async () => {
    const cmt = prompt("Nhập comment:");
    if (!cmt) return;
    await updateDoc(doc(db, "projects", projectId, "groups", groupId, "subtasks", subId), {
      comments: arrayUnion({
        user: auth.currentUser ? auth.currentUser.email : "Ẩn danh",
        text: cmt,
        createdAt: new Date()
      })
    });
  });

  container.appendChild(div);
}

// ===== Drag & Drop =====
function enableDragAndDrop(groupDiv, projectId, groupId) {
  groupDiv.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("groupId", groupId);
  });

  ["todoCol", "inprogressCol", "doneCol"].forEach(colId => {
    const col = document.getElementById(colId);
    col.addEventListener("dragover", (e) => e.preventDefault());
    col.addEventListener("drop", async () => {
      const id = e.dataTransfer.getData("groupId");
      const newStatus = colId.replace("Col", "");
      await updateDoc(doc(db, "projects", projectId, "groups", id), { status: newStatus });
    });
  });
}
