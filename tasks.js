// ========================================================================
// === Đây là toàn bộ code cho file tasks.js. Bạn có thể thay thế hoàn  ===
// === toàn file cũ của mình bằng đoạn code này.                          ===
// ========================================================================

// ===== Firebase SDKs (vui lòng sử dụng phiên bản này để đảm bảo ổn định) =====
import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  serverTimestamp,
  deleteField,
  getAuth,
  onAuthStateChanged,
  signInAnonymously
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

// ===== Firebase Config (Sử dụng config từ file của bạn) =====
const firebaseConfig = {
  apiKey: "AIzaSyCW49METqezYoUKSC1N0Pi3J83Ptsf9hA8",
  authDomain: "task-manager-d18aa.firebaseapp.com",
  projectId: "task-manager-d18aa",
  storageBucket: "task-manager-d18aa.appspot.com",
  messagingSenderId: "10...",
};


// ===== Khởi tạo Firebase và Firestore =====
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
let currentUser = null;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// ========================================================================
// === HTML Structure
// ========================================================================
const appContainer = document.getElementById("app");
appContainer.innerHTML = `
  <style>
    body {
      font-family: 'Inter', sans-serif;
      background-color: #f3f4f6;
    }
    .main-container {
      display: flex;
      flex-direction: column;
      height: 100vh;
      width: 100%;
      padding: 1rem;
      box-sizing: border-box;
      max-width: 1400px;
      margin: 0 auto;
    }
    .header {
      padding: 1rem;
      text-align: center;
      background: white;
      border-radius: 0.75rem;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      margin-bottom: 1rem;
    }
    .boards-container {
      display: grid;
      grid-template-columns: repeat(1, 1fr);
      gap: 1rem;
      flex-grow: 1;
      width: 100%;
    }
    @media (min-width: 768px) {
      .boards-container {
        grid-template-columns: repeat(3, 1fr);
      }
    }
    .board-column {
      background-color: #f9fafb;
      padding: 1rem;
      border-radius: 0.75rem;
      box-shadow: 0 4px 6px rgba(0,0,0,0.05);
      display: flex;
      flex-direction: column;
      min-height: 400px;
    }
    .board-title {
      font-size: 1.25rem;
      font-weight: 700;
      margin-bottom: 0.75rem;
    }
    .group-container {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      flex-grow: 1;
    }
    .group-item {
      background-color: #fff;
      padding: 0.75rem;
      border-radius: 0.5rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      border: 1px solid #e5e7eb;
    }
    .group-title {
      font-weight: 600;
      margin-bottom: 0.5rem;
    }
    .task-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .task-item {
      background-color: #fff;
      padding: 0.5rem;
      border-radius: 0.5rem;
      border: 1px solid #d1d5db;
      box-shadow: 0 1px 2px rgba(0,0,0,0.05);
      cursor: grab;
    }
    .task-item:active {
      cursor: grabbing;
    }
    .alert-dialog {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background-color: white;
      padding: 2rem;
      border-radius: 1rem;
      box-shadow: 0 10px 20px rgba(0,0,0,0.2);
      z-index: 1000;
      display: none;
      text-align: center;
    }
    .overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0,0,0,0.5);
      z-index: 999;
      display: none;
    }
  </style>

  <div class="main-container">
    <div class="header">
      <h1 class="text-3xl font-bold text-gray-800">Task Manager</h1>
      <p id="user-info" class="text-sm text-gray-500 mt-1"></p>
    </div>

    <div class="boards-container" id="board-columns">
      <!-- Cột To Do -->
      <div class="board-column" id="todo-column">
        <h3 class="board-title text-red-600">To Do</h3>
        <button id="addGroupBtn" class="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600 transition-colors self-start mb-3">+ Group</button>
        <div id="todo-groups-container" class="group-container"></div>
      </div>

      <!-- Cột In Progress -->
      <div class="board-column" id="inprogress-column">
        <h3 class="board-title text-yellow-600">In Progress</h3>
        <div id="inprogress-groups-container" class="group-container"></div>
      </div>

      <!-- Cột Done -->
      <div class="board-column" id="done-column">
        <h3 class="board-title text-green-600">Done</h3>
        <div id="done-groups-container" class="group-container"></div>
      </div>
    </div>
  </div>

  <!-- Dialog box -->
  <div id="dialog-overlay" class="overlay"></div>
  <div id="alert-dialog" class="alert-dialog">
    <div id="dialog-message" class="text-gray-800 mb-4"></div>
    <button id="dialog-ok-btn" class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors">OK</button>
  </div>
`;

// ========================================================================
// === Firebase and DOM Elements
// ========================================================================
let currentProjectId = "main";
let currentUserEmail = "Ẩn danh";
let currentUserId = "";

// Lắng nghe trạng thái đăng nhập
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    currentUserId = user.uid;
    currentUserEmail = user.email || "Ẩn danh";
    document.getElementById("user-info").textContent = `Người dùng: ${currentUserEmail} | User ID: ${currentUserId}`;
  } else {
    // Đăng nhập ẩn danh nếu không có người dùng
    await signInAnonymously(auth);
  }
});

// ========================================================================
// === Helper Functions
// ========================================================================
function showAlert(message) {
  const overlay = document.getElementById("dialog-overlay");
  const dialog = document.getElementById("alert-dialog");
  const dialogMessage = document.getElementById("dialog-message");
  const okBtn = document.getElementById("dialog-ok-btn");

  dialogMessage.textContent = message;
  overlay.style.display = "block";
  dialog.style.display = "block";

  okBtn.onclick = () => {
    overlay.style.display = "none";
    dialog.style.display = "none";
  };
}

async function logAction(projectId, message) {
  try {
    const logsCol = collection(db, "artifacts", appId, "public/data", "logs");
    await addDoc(logsCol, {
      projectId: projectId,
      action: message,
      timestamp: serverTimestamp(),
      user: currentUserEmail,
    });
  } catch (e) {
    console.error("Lỗi khi ghi log:", e);
  }
}

// ========================================================================
// === Group Logic
// ========================================================================
const addGroupBtn = document.getElementById("addGroupBtn");
addGroupBtn.addEventListener("click", async () => {
  const groupTitle = prompt("Nhập tên nhóm mới:");
  if (groupTitle) {
    try {
      const groupsCol = collection(db, "artifacts", appId, "users", currentUserId, "groups");
      await addDoc(groupsCol, {
        projectId: currentProjectId,
        title: groupTitle,
        createdAt: serverTimestamp(),
      });
      await logAction(currentProjectId, `tạo nhóm mới "${groupTitle}"`);
    } catch (e) {
      showAlert("Lỗi khi thêm nhóm: " + e.message);
    }
  }
});

function createGroupElement(groupId, groupData, status) {
  const containerId = `${status}-groups-container`;
  const container = document.getElementById(containerId);
  if (!container) return;

  const groupItem = document.createElement("div");
  groupItem.className = "group-item";
  groupItem.id = `group-${status}-${groupId}`;
  groupItem.innerHTML = `
    <div class="flex justify-between items-center mb-2">
      <span class="group-title">${groupData.title}</span>
      ${status === 'todo' ? `
        <div class="flex items-center space-x-1">
          <button class="add-task-btn bg-green-500 text-white px-2 py-0.5 rounded text-xs hover:bg-green-600 transition-colors" data-group-id="${groupId}">+ Task</button>
          <button class="delete-group-btn text-gray-400 hover:text-red-500 transition-colors" data-group-id="${groupId}">&times;</button>
        </div>
      ` : ''}
    </div>
    <div id="tasks-${status}-${groupId}" class="task-list min-h-[50px]"></div>
  `;
  container.appendChild(groupItem);
  
  // Áp dụng Drag and Drop cho các cột
  const taskList = document.getElementById(`tasks-${status}-${groupId}`);
  if (taskList) {
    taskList.addEventListener("dragover", (e) => e.preventDefault());
    taskList.addEventListener("drop", handleTaskDrop);
  }
}

function handleTaskDrop(e) {
  e.preventDefault();
  const draggedTaskId = e.dataTransfer.getData("taskId");
  const targetTaskListId = e.currentTarget.id;

  const newStatus = targetTaskListId.includes("tasks-inprogress") ? "inprogress" : "done";
  const newGroupId = targetTaskListId.split('-').pop();

  if (draggedTaskId) {
    updateTaskStatusAndGroup(draggedTaskId, newStatus, newGroupId);
  }
}

async function updateTaskStatusAndGroup(taskId, newStatus, newGroupId) {
  try {
    const taskRef = doc(db, "artifacts", appId, "users", currentUserId, "tasks", taskId);
    const taskSnap = await getDoc(taskRef);
    if (!taskSnap.exists()) return;

    const taskData = taskSnap.data();
    let updatePayload = {
      status: newStatus,
      updatedAt: serverTimestamp(),
      updatedBy: currentUserEmail,
      groupId: newGroupId
    };

    if (newStatus === "done") {
      updatePayload.progress = 100;
    }

    await updateDoc(taskRef, updatePayload);
    await logAction(currentProjectId, `chuyển task "${taskData.title}" sang trạng thái "${newStatus}"`);
  } catch (e) {
    showAlert("Lỗi khi cập nhật task: " + e.message);
  }
}


function loadGroups() {
  const groupsCol = collection(db, "artifacts", appId, "users", currentUserId, "groups");
  const q = query(groupsCol, where("projectId", "==", currentProjectId));

  onSnapshot(q, (snapshot) => {
    // Xóa các group cũ để render lại
    document.getElementById("todo-groups-container").innerHTML = '';
    document.getElementById("inprogress-groups-container").innerHTML = '';
    document.getElementById("done-groups-container").innerHTML = '';

    snapshot.forEach((docSnap) => {
      const gid = docSnap.id;
      const g = docSnap.data();
      
      // Tạo group element cho cả 3 cột
      createGroupElement(gid, g, 'todo');
      createGroupElement(gid, g, 'inprogress');
      createGroupElement(gid, g, 'done');
    });

    // Sau khi render xong các group, tải các task
    loadTasks();
  });
}

// ========================================================================
// === Task Logic
// ========================================================================
function renderTask(docSnap) {
  const t = docSnap.data();
  const tid = docSnap.id;

  // Xác định vị trí group để đặt task
  const taskListId = `tasks-${t.status}-${t.groupId}`;
  const taskList = document.getElementById(taskListId);
  if (!taskList) return;

  const taskElement = document.getElementById(`task-${tid}`) || document.createElement("div");
  taskElement.id = `task-${tid}`;
  taskElement.className = "task-item";
  taskElement.draggable = true;
  taskElement.innerHTML = `
    <h4 class="font-medium">${t.title}</h4>
    <p class="text-sm text-gray-500">Tiến độ: ${t.progress || 0}%</p>
  `;

  // Áp dụng Drag and Drop
  taskElement.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("taskId", tid);
  });
  
  taskList.appendChild(taskElement);
}

function loadTasks() {
  const tasksCol = collection(db, "artifacts", appId, "users", currentUserId, "tasks");
  const q = query(tasksCol, where("projectId", "==", currentProjectId));

  onSnapshot(q, (snapshot) => {
    // Xóa tất cả tasks để render lại
    document.querySelectorAll('.task-list').forEach(list => list.innerHTML = '');

    snapshot.forEach((docSnap) => {
      renderTask(docSnap);
    });
  });
}

// ========================================================================
// === Event Listeners
// ========================================================================
document.addEventListener('click', async (e) => {
  if (e.target.matches('.add-task-btn')) {
    const groupId = e.target.dataset.groupId;
    const taskTitle = prompt("Nhập tên công việc mới:");
    if (taskTitle) {
      try {
        const tasksCol = collection(db, "artifacts", appId, "users", currentUserId, "tasks");
        await addDoc(tasksCol, {
          projectId: currentProjectId,
          groupId: groupId,
          title: taskTitle,
          status: "todo",
          progress: 0,
          createdAt: serverTimestamp(),
        });
        await logAction(currentProjectId, `tạo công việc "${taskTitle}" trong nhóm "${groupId}"`);
      } catch (error) {
        showAlert("Lỗi khi thêm công việc: " + error.message);
      }
    }
  } else if (e.target.matches('.delete-group-btn')) {
    const groupId = e.target.dataset.groupId;
    if (confirm("Bạn có chắc chắn muốn xóa nhóm này và tất cả công việc bên trong không?")) {
      try {
        const groupsCol = collection(db, "artifacts", appId, "users", currentUserId, "groups");
        await deleteDoc(doc(groupsCol, groupId));
        
        // Xóa tất cả các tasks thuộc nhóm này
        const tasksCol = collection(db, "artifacts", appId, "users", currentUserId, "tasks");
        const q = query(tasksCol, where("groupId", "==", groupId));
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach(async (taskDoc) => {
          await deleteDoc(doc(tasksCol, taskDoc.id));
        });
        
        await logAction(currentProjectId, `đã xóa nhóm "${groupId}" và các công việc liên quan`);
      } catch (error) {
        showAlert("Lỗi khi xóa nhóm: " + error.message);
      }
    }
  }
});

// ========================================================================
// === Initialization
// ========================================================================
window.onload = () => {
  // Đợi xác thực hoàn tất trước khi tải dữ liệu
  onAuthStateChanged(auth, (user) => {
    if (user) {
      loadGroups();
    }
  });
};
