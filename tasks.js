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
  deleteField
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

// ===== Firebase Config (Sử dụng config từ file của bạn) =====
const firebaseConfig = {
  apiKey: "AIzaSyCW49METqezYoUKSC1N0Pi3J83Ptsf9hA8",
  authDomain: "task-manager-d18aa.firebaseapp.com",
  projectId: "task-manager-d18aa",
  storageBucket: "task-manager-d18aa.appspot.com",
  messagingSenderId: "1080268498085",
  appId: "1:1080268498085:web:767434c6a2c0"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth();

// ===== DOM Elements =====
const projectTitleDisplay = document.getElementById("projectTitleDisplay");
const taskBoard = document.getElementById("taskBoard");
const addTaskBtn = document.getElementById("addTaskBtn");
const taskModal = document.getElementById("taskModal");
const taskModalTitle = document.getElementById("taskModalTitle");
const taskForm = document.getElementById("taskForm");
const taskTitleInput = document.getElementById("taskTitle");
const taskDescriptionInput = document.getElementById("taskDescription");
const taskAssigneeInput = document.getElementById("taskAssignee");
const taskPriorityInput = document.getElementById("taskPriority");
const taskStatusInput = document.getElementById("taskStatus");
const cancelTaskBtn = document.getElementById("cancelTaskBtn");
const backToProjectsBtn = document.getElementById("backToProjectsBtn");
const progressChartCanvas = document.getElementById("progressChart");
const taskListContainer = document.getElementById("taskListContainer");
const chartContainer = document.getElementById("chartContainer");
const logList = document.getElementById("logList");

let currentProjectId = null;
let currentProjectTitle = null;
let isEditingTask = false;
let currentTaskId = null;
let progressChartInstance = null;
let currentUser = null;
let usersCache = {}; // Cache người dùng để tránh gọi Firebase nhiều lần

// ===== Helper functions =====
const showModal = (modalId) => {
  document.getElementById(modalId).classList.remove("hidden");
  document.getElementById(modalId).classList.add("flex");
};

const hideModal = (modalId) => {
  document.getElementById(modalId).classList.add("hidden");
  document.getElementById(modalId).classList.remove("flex");
};

const showMainContent = (elementId) => {
  document.querySelectorAll(".main-content").forEach(el => el.classList.add("hidden"));
  document.getElementById(elementId).classList.remove("hidden");
};

const logAction = async (projectId, message) => {
  try {
    await addDoc(collection(db, "logs"), {
      projectId: projectId,
      message: message,
      timestamp: serverTimestamp(),
      user: currentUser?.email || "Ẩn danh"
    });
  } catch (e) {
    console.error("Error writing log: ", e);
  }
};

// ===== Show task board (called from addproject.js) =====
export const showTaskBoard = (projectId, projectTitle) => {
  currentProjectId = projectId;
  currentProjectTitle = projectTitle;
  projectTitleDisplay.textContent = projectTitle;
  showMainContent("taskBoardContainer");
  listenToTasks();
  listenToLogs();
  updateProgressChart();
};

// ===== Listen to tasks changes in real-time =====
const listenToTasks = () => {
  const q = query(collection(db, "tasks"), where("projectId", "==", currentProjectId));
  onSnapshot(q, (snapshot) => {
    let tasks = {
      todo: [],
      inprogress: [],
      done: []
    };
    snapshot.forEach((doc) => {
      const task = { ...doc.data(), id: doc.id };
      if (tasks[task.status]) {
        tasks[task.status].push(task);
      }
    });
    renderTasks(tasks);
    updateProgressChart();
  });
};

// ===== Render tasks to UI =====
const renderTasks = (tasks) => {
  document.getElementById("todoCol").innerHTML = "";
  document.getElementById("inprogressCol").innerHTML = "";
  document.getElementById("doneCol").innerHTML = "";

  const renderTask = (task) => {
    const taskItem = document.createElement("div");
    taskItem.className = "task-item bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 mb-4 cursor-grab";
    taskItem.setAttribute("draggable", true);
    taskItem.setAttribute("data-task-id", task.id);
    taskItem.innerHTML = `
      <h4 class="font-bold text-gray-900 dark:text-white">${task.title}</h4>
      <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">${task.description}</p>
      <div class="mt-2 text-xs text-gray-500 dark:text-gray-400">
        <p>Phân công: ${task.assignee || "Chưa phân công"}</p>
        <p>Ưu tiên: ${task.priority || "Thấp"}</p>
      </div>
      <div class="flex justify-between items-center mt-3">
        <div class="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
          <div class="bg-blue-600 h-2.5 rounded-full" style="width: ${task.progress || 0}%"></div>
        </div>
        <span class="ml-2 text-sm text-gray-700 dark:text-gray-300">${task.progress || 0}%</span>
      </div>
      <div class="flex justify-end space-x-2 mt-3">
        <button class="edit-task-btn text-blue-500 hover:text-blue-700" data-id="${task.id}">
          <i class="fas fa-edit"></i>
        </button>
        <button class="delete-task-btn text-red-500 hover:text-red-700" data-id="${task.id}">
          <i class="fas fa-trash-alt"></i>
        </button>
      </div>
    `;

    taskItem.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("type", "task");
      e.dataTransfer.setData("taskId", task.id);
    });

    taskItem.querySelector(".edit-task-btn").addEventListener("click", () => editTask(task));
    taskItem.querySelector(".delete-task-btn").addEventListener("click", () => deleteTask(task));

    return taskItem;
  };

  tasks.todo.forEach(task => document.getElementById("todoCol").appendChild(renderTask(task)));
  tasks.inprogress.forEach(task => document.getElementById("inprogressCol").appendChild(renderTask(task)));
  tasks.done.forEach(task => document.getElementById("doneCol").appendChild(renderTask(task)));

  setupDragAndDrop();
};

// ===== Setup Drag and Drop =====
const setupDragAndDrop = () => {
  const columns = ["todoCol", "inprogressCol", "doneCol"];
  columns.forEach(colId => {
    const col = document.getElementById(colId);
    if (!col) return;

    col.addEventListener("dragover", (e) => e.preventDefault());

    col.addEventListener("drop", async (e) => {
      e.preventDefault();

      const type = e.dataTransfer.getData("type");
      if (type !== "task") return;

      const taskId = e.dataTransfer.getData("taskId");
      if (!taskId) return;

      const newStatus = colId === "inprogressCol" ? "inprogress" : colId === "doneCol" ? "done" : "todo";

      const taskRef = doc(db, "tasks", taskId);
      const taskSnap = await getDoc(taskRef);
      if (!taskSnap.exists()) return;
      const taskData = taskSnap.data();

      // Cập nhật trạng thái và tiến độ
      const updatePayload = {
        status: newStatus,
        updatedAt: serverTimestamp(),
        updatedBy: currentUser?.email || "Ẩn danh"
      };

      if (newStatus === "done") {
        updatePayload.progress = 100;
      } else if (newStatus === "todo") {
        updatePayload.progress = 0;
      }

      await updateDoc(taskRef, updatePayload);

      // Ghi log hoạt động
      let logMessage = `chuyển task "${taskData.title}" sang trạng thái "${newStatus}"`;
      if (newStatus === "done") {
        logMessage += ` và hoàn thành 100%`;
      } else if (newStatus === "todo") {
        logMessage += ` và đặt lại tiến độ 0%`;
      }
      await logAction(taskData.projectId, logMessage);

      // Lưu lịch sử tiến độ
      await addDoc(collection(db, "progress_history"), {
        projectId: taskData.projectId,
        taskId: taskId,
        progress: updatePayload.progress,
        timestamp: serverTimestamp()
      });
    });
  });
};

// ===== Listen to logs changes in real-time =====
const listenToLogs = () => {
  const q = query(collection(db, "logs"), where("projectId", "==", currentProjectId), orderBy("timestamp", "desc"));
  onSnapshot(q, (snapshot) => {
    logList.innerHTML = "";
    snapshot.forEach((doc) => {
      const log = doc.data();
      const logItem = document.createElement("div");
      logItem.className = "p-2 border-b border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200";
      const date = log.timestamp ? new Date(log.timestamp.toDate()).toLocaleString() : "Đang cập nhật...";
      logItem.textContent = `[${date}] ${log.user}: ${log.message}`;
      logList.appendChild(logItem);
    });
  });
};

// ===== Update Progress Chart =====
const updateProgressChart = async () => {
  const q = query(collection(db, "tasks"), where("projectId", "==", currentProjectId));
  const snapshot = await getDocs(q);
  let doneCount = 0;
  let inProgressCount = 0;
  let todoCount = 0;
  let totalTasks = 0;

  snapshot.forEach(doc => {
    totalTasks++;
    const task = doc.data();
    if (task.status === "done") doneCount++;
    if (task.status === "inprogress") inProgressCount++;
    if (task.status === "todo") todoCount++;
  });

  if (progressChartInstance) {
    progressChartInstance.destroy();
  }

  const ctx = progressChartCanvas.getContext('2d');
  progressChartInstance = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: [`Hoàn thành (${doneCount})`, `Đang thực hiện (${inProgressCount})`, `Chưa làm (${todoCount})`],
      datasets: [{
        data: [doneCount, inProgressCount, todoCount],
        backgroundColor: [
          'rgb(59, 130, 246)',
          'rgb(251, 191, 36)',
          'rgb(156, 163, 175)'
        ],
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
        },
        title: {
          display: true,
          text: 'Tiến độ dự án',
          color: document.documentElement.classList.contains("dark") ? "#fff" : "#000"
        }
      }
    }
  });
};

// ===== Add/Update task =====
taskForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = taskTitleInput.value;
  const description = taskDescriptionInput.value;
  const assignee = taskAssigneeInput.value;
  const priority = taskPriorityInput.value;
  const status = taskStatusInput.value;
  const progress = status === "done" ? 100 : 0;

  if (isEditingTask) {
    const taskRef = doc(db, "tasks", currentTaskId);
    await updateDoc(taskRef, {
      title,
      description,
      assignee,
      priority,
      status,
      progress,
      updatedAt: serverTimestamp(),
      updatedBy: currentUser?.email || "Ẩn danh"
    });
    await logAction(currentProjectId, `cập nhật task "${title}"`);
    // Lưu lịch sử tiến độ nếu trạng thái thay đổi
    await addDoc(collection(db, "progress_history"), {
      projectId: currentProjectId,
      taskId: currentTaskId,
      progress: progress,
      timestamp: serverTimestamp()
    });
    isEditingTask = false;
  } else {
    const newTask = {
      projectId: currentProjectId,
      title,
      description,
      assignee,
      priority,
      status,
      progress,
      createdAt: serverTimestamp(),
      createdBy: currentUser?.email || "Ẩn danh"
    };
    const docRef = await addDoc(collection(db, "tasks"), newTask);
    await logAction(currentProjectId, `tạo task mới "${title}"`);
    // Lưu lịch sử tiến độ ban đầu
    await addDoc(collection(db, "progress_history"), {
      projectId: currentProjectId,
      taskId: docRef.id,
      progress: progress,
      timestamp: serverTimestamp()
    });
  }
  hideModal("taskModal");
  taskForm.reset();
});

// ===== Edit task modal =====
const editTask = (task) => {
  isEditingTask = true;
  currentTaskId = task.id;
  taskModalTitle.textContent = "Chỉnh sửa task";
  taskTitleInput.value = task.title;
  taskDescriptionInput.value = task.description;
  taskAssigneeInput.value = task.assignee;
  taskPriorityInput.value = task.priority;
  taskStatusInput.value = task.status;
  showModal("taskModal");
};

// ===== Delete task =====
const deleteTask = async (task) => {
  if (confirm(`Bạn có chắc muốn xóa task "${task.title}"?`)) {
    const taskRef = doc(db, "tasks", task.id);
    await deleteDoc(taskRef);
    await logAction(currentProjectId, `đã xóa task "${task.title}"`);
  }
};

// ===== Event listeners =====
addTaskBtn.addEventListener("click", () => {
  isEditingTask = false;
  taskModalTitle.textContent = "Tạo task mới";
  taskForm.reset();
  showModal("taskModal");
});

cancelTaskBtn.addEventListener("click", () => hideModal("taskModal"));
backToProjectsBtn.addEventListener("click", () => showMainContent("projectBoardContainer"));

// ===== Auth listener =====
onAuthStateChanged(auth, (user) => {
  currentUser = user;
});

// Load Chart.js library
const chartScript = document.createElement('script');
chartScript.src = "https://cdn.jsdelivr.net/npm/chart.js";
document.head.appendChild(chartScript);
