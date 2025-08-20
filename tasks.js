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
  apiKey: "AIzaSyBw3hWbWLvr2W2pdPL8_wKNB5x_BcnwrOI",
  authDomain: "task-806e4.firebaseapp.com",
  projectId: "task-806e4",
  storageBucket: "task-806e4.firebasestorage.app",
  messagingSenderId: "638366751634",
  appId: "1:638366751634:web:1cff140df54007edecff4b",
  measurementId: "G-TLJSXWQBZD"
};

// ===== Khởi tạo Firebase =====
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Biến lưu trữ người dùng hiện tại và trạng thái đăng nhập
let currentUser = null;
let isAuthReady = false;

// Đảm bảo các hoạt động Firestore chỉ chạy sau khi xác thực xong
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  isAuthReady = true;
});

// ===== Helper cho Modal (Popup) =====
function openModal(title, fields, onSave) {
  let modal = document.getElementById("popupModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "popupModal";
    modal.className = "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 hidden";
    modal.innerHTML = `
      <div class="bg-white rounded-lg p-4 w-96 shadow-lg">
        <h3 id="modalTitle" class="font-semibold text-lg mb-2"></h3>
        <div id="modalFields" class="space-y-2"></div>
        <div class="flex justify-end space-x-2 mt-4">
          <button id="modalCancel" class="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors">Hủy</button>
          <button id="modalSave" class="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors">Lưu</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }

  document.getElementById("modalTitle").textContent = title;
  const fieldsDiv = document.getElementById("modalFields");
  fieldsDiv.innerHTML = "";
  fields.forEach(f => {
    if (f.type === "textarea") {
      fieldsDiv.innerHTML += `<textarea id="${f.id}" placeholder="${f.placeholder}" class="border p-2 w-full rounded-md">${f.value || ""}</textarea>`;
    } else if (f.type === "color") {
      fieldsDiv.innerHTML += `
        <div class="flex items-center space-x-2">
          <label for="${f.id}" class="text-gray-700 w-20">Màu:</label>
          <input id="${f.id}" type="color" class="border p-1 w-full rounded-md" value="${f.value || "#000000"}">
        </div>`;
    } else if (f.type === "range") {
      fieldsDiv.innerHTML += `
        <div class="flex flex-col">
          <label for="${f.id}" class="text-gray-700">Tiến độ (<span id="progress-value-${f.id}">${f.value || 0}</span>%)</label>
          <input id="${f.id}" type="range" min="0" max="100" value="${f.value || 0}" class="w-full">
        </div>`;
} else if (f.type === "date") {
  fieldsDiv.innerHTML += `
    <div class="flex flex-col">
      <label for="${f.id}" class="text-gray-700">${f.label || 'Hạn Chót'}:</label>
      <div class="flex items-center gap-2">
        <input id="${f.id}" type="date" class="border p-2 w-full rounded-md" value="${f.value || ""}">
        <button type="button" id="clear-${f.id}" class="px-2 py-1 bg-red-100 text-red-600 rounded hover:bg-red-200">Xóa</button>
      </div>
    </div>`;
    } else {
      fieldsDiv.innerHTML += `<input id="${f.id}" type="text" placeholder="${f.placeholder}" class="border p-2 w-full rounded-md" value="${f.value || ""}">`;
    }
  });
// Gắn sự kiện cho nút "Xóa deadline"
fields.forEach(f => {
  if (f.type === "date") {
    const clearBtn = document.getElementById(`clear-${f.id}`);
    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        document.getElementById(f.id).value = "";
      });
    }
  }
});
  modal.classList.remove("hidden");

  const progressInput = document.getElementById("progress");
  if (progressInput) {
    const progressValueSpan = document.getElementById("progress-value-progress");
    progressInput.addEventListener("input", (e) => {
      progressValueSpan.textContent = e.target.value;
    });
  }

  document.getElementById("modalCancel").onclick = () => modal.classList.add("hidden");
  document.getElementById("modalSave").onclick = () => {
    const values = {};
    fields.forEach(f => values[f.id] = document.getElementById(f.id).value);
    onSave(values);
    modal.classList.add("hidden");
  };
}

// ===== Các hàm tiện ích chung =====
function getUserDisplayName(email) {
  if (!email) return "Ẩn danh";
  return email.split('@')[0];
}

function showToast(message) {
  let toastContainer = document.getElementById("toastContainer");
  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.id = "toastContainer";
    toastContainer.className = "fixed bottom-4 right-4 z-50 flex flex-col-reverse space-y-2";
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement("div");
  toast.className = "bg-blue-600 text-white px-4 py-2 rounded-lg shadow-xl animate-fade-in-up transition-opacity duration-500 ease-in-out";
  toast.textContent = message;

  const style = document.createElement("style");
  style.innerHTML = `
    @keyframes fadeInUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    .animate-fade-in-up { animation: fadeInUp 0.5s ease-in-out; }`;
  document.head.appendChild(style);

  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 500);
  }, 5000);
}

function formatDateVN(yyyy_mm_dd) {
  if (!yyyy_mm_dd) return "";
  const [y, m, d] = yyyy_mm_dd.split("-");
  return `${d}/${m}/${y}`;
}

// ===== Nhật ký hoạt động (Logs) =====
async function logAction(projectId, action, groupId = null) {
  if (!isAuthReady) return; // Đảm bảo người dùng đã xác thực

  const user = currentUser?.email || "Ẩn danh";
  let logMessage = action;

  // Lấy thông tin group nếu có
  if (groupId) {
    const groupSnap = await getDoc(doc(db, "groups", groupId));
    if (groupSnap.exists()) {
      const groupData = groupSnap.data();
      logMessage += ` trong group "${groupData.title}"`;
    }
  }

  await addDoc(collection(db, "logs"), {
    projectId,
    action: logMessage,
    user,
    timestamp: serverTimestamp()
  });
}

// Biến lưu trữ listener logs để có thể hủy khi đổi dự án
// Biến lưu trữ listener logs để có thể hủy khi đổi dự án
let logsUnsub = null;

function listenForLogs(projectId) {
  // Hủy listener cũ để không bị nhận thông báo từ dự án khác
  if (logsUnsub) {
    logsUnsub();
    logsUnsub = null;
  }

  const logsCol = collection(db, "logs");
  const q = query(logsCol, where("projectId", "==", projectId));

  let initial = true;

  logsUnsub = onSnapshot(q, (snapshot) => {
    const logEntries = document.getElementById("logEntries");
    const logs = [];

    snapshot.forEach((doc) => logs.push(doc.data()));
    logs.sort((a, b) => b.timestamp - a.timestamp);

    // Render bảng log
    if (logEntries) {
      logEntries.innerHTML = "";
      logs.forEach((data) => {
        const timestamp = data.timestamp?.toDate ? data.timestamp.toDate().toLocaleString() : "-";
        const userDisplayName = getUserDisplayName(data.user);
        const logItem = document.createElement("div");
        logItem.textContent = `[${timestamp}] ${userDisplayName} đã ${data.action}.`;
        logEntries.appendChild(logItem);
      });
    }

    // 🔹 Lần đầu vào: chỉ toast log mới nhất
    if (initial) {
      initial = false;
      if (logs.length > 0) {
        const newest = logs[0];
        const userDisplayName = getUserDisplayName(newest.user);
        showToast(`${userDisplayName} đã ${newest.action}.`);
      }
      return;
    }

    // 🔹 Sau đó: chỉ toast log mới được thêm
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added") {
        const data = change.doc.data();
        const userDisplayName = getUserDisplayName(data.user);
        showToast(`${userDisplayName} đã ${data.action}.`);
      }
    });
  });
}


// ===== Cấu hình và Helpers cho Deadline =====
const DEADLINE_CFG = {
  thresholds: [14, 7, 3], // <=14 cam, <=7 vàng, <=3 đỏ
  classes: ["bg-orange-100", "bg-yellow-300", "bg-red-400"],
};

function daysUntil(dateStr) {
  if (!dateStr) return Infinity;
  const today = new Date();
  const d = new Date(dateStr + "T23:59:59");
  return Math.floor((d - today) / (1000 * 60 * 60 * 24));
}

function colorClassByDaysLeft(days, cfg = DEADLINE_CFG) {
  const { thresholds, classes } = cfg;
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (days <= thresholds[i]) return classes[i];
  }
  return "";
}

function getGroupWarnClass(g) {
  if (!g || !g.deadline) return "";
  const left = daysUntil(g.deadline);
  if (g.status === "todo" || g.status === "inprogress") {
    return colorClassByDaysLeft(left);
  }
  return "";
}

function removeWarnClasses(el) {
  if (!el) return;
  [...el.classList].forEach(c => {
    if (c.startsWith("bg-")) el.classList.remove(c);
  });
}

function applyGroupColor(gid, g) {
  const cls = getGroupWarnClass(g);

  // Thẻ Group (To Do)
  const todoCard = document.getElementById(`group-${gid}`);
  if (todoCard) {
    removeWarnClasses(todoCard);
    if (g.status === "todo" && cls) {
      todoCard.classList.add(...cls.split(" "));
    }
  }

  // Khung In Progress
  const ipWrapper = document.getElementById(`inprogress-${gid}`)?.parentElement;
  if (ipWrapper) {
    removeWarnClasses(ipWrapper);
    if (g.status === "inprogress" && cls) {
      ipWrapper.classList.add(...cls.split(" "));
    }
  }

  // Khung Done (luôn bỏ cảnh báo)
  const doneWrapper = document.getElementById(`done-${gid}`)?.parentElement;
  if (doneWrapper) removeWarnClasses(doneWrapper);
}

// ===== Render Bảng Công Việc (Project View) =====
// Đây là hàm chính để hiển thị giao diện bảng công việc
// Nó nhận projectId, do đó mỗi lần gọi sẽ chỉ hiển thị đúng dự án đó
export function showTaskBoard(projectId, projectTitle) {
  const taskBoard = document.getElementById("taskBoard");

  taskBoard.innerHTML = `
    <h2 class="text-xl font-bold mb-4">Bạn đang ở dự án: ${projectTitle}</h2>

    <div id="logArea" class="mt-4 bg-gray-100 p-4 rounded-lg">
      <div class="flex justify-between items-center mb-2">
        <h4 class="font-semibold text-gray-700">Nhật ký hoạt động</h4>
        <button id="toggleLogBtn" class="bg-gray-300 text-gray-700 px-2 py-1 rounded text-xs hover:bg-gray-400 transition-colors">Hiện log</button>
      </div>
      <div id="logEntries" class="space-y-2 text-sm text-gray-600 hidden"></div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 w-full mt-4">
      <div class="bg-white p-3 rounded-2xl shadow flex flex-col border-4 border-teal-200">
        <div class="flex justify-between items-center mb-2">
          <h3 class="font-bold text-red-600">To Do</h3>
          <button id="addGroupBtn" class="bg-blue-500 text-white px-2 py-1 rounded text-xs hover:bg-blue-600 transition-colors">
            + Group
          </button>
        </div>
        <div id="groupContainer" class="space-y-3 mt-2 h-[20cm] overflow-y-auto"></div>
      </div>
      <div class="bg-white p-3 rounded-2xl shadow flex flex-col border-4 border-blue-200">
        <h3 class="font-bold text-yellow-600 mb-2">In Progress</h3>
        <div id="inprogressCol" class="space-y-3 mt-2 h-[20cm] overflow-y-auto"></div>
      </div>
      <div class="bg-white p-3 rounded-2xl shadow flex flex-col border-4 border-green-400">
        <h3 class="font-bold text-green-600 mb-2">Done</h3>
        <div id="doneCol" class="space-y-3 mt-2 h-[20cm] overflow-y-auto"></div>
      </div>
    </div>

    <div id="project-progress-chart-container" class="mt-8 bg-white p-4 rounded shadow">
        <h3 class="font-bold text-gray-800 mb-2">Tiến độ tổng thể dự án</h3>
        <canvas id="project-progress-chart" class="w-full h-64"></canvas>
    </div>
  `;

  // Thêm Chart.js CDN
  const chartJsScript = document.createElement("script");
  chartJsScript.src = "https://cdn.jsdelivr.net/npm/chart.js";
  document.head.appendChild(chartJsScript);
  
  // Sửa lỗi biểu đồ kéo dài
  const style = document.createElement("style");
  style.textContent = `
    #project-progress-chart-container {
      width: 100%;
      max-width: 100%;
      height: 300px;
    }
  `;
  document.head.appendChild(style);

  document.getElementById("toggleLogBtn").addEventListener("click", () => {
    const logEntries = document.getElementById("logEntries");
    const button = document.getElementById("toggleLogBtn");
    if (logEntries.classList.contains("hidden")) {
      logEntries.classList.remove("hidden");
      button.textContent = "Ẩn log";
    } else {
      logEntries.classList.add("hidden");
      button.textContent = "Hiện log";
    }
  });

  // Gọi các hàm tải dữ liệu và thiết lập listener với projectId cụ thể
  loadGroups(projectId);
  setupGroupListeners(projectId);
  setupDragDrop();
  listenForLogs(projectId);
  listenForProjectProgress(projectId); // Thêm listener cho tiến độ tổng dự án
}

// ===== Biểu đồ tổng tiến độ dự án =====
let projectChart = null;
let progressUnsub = null; // Thêm biến để lưu listener của biểu đồ

function listenForProjectProgress(projectId) {
    // Hủy listener cũ để tránh lỗi dữ liệu
    if (progressUnsub) {
        progressUnsub();
        progressUnsub = null;
    }

    // Hủy biểu đồ cũ để tránh lỗi
    if (projectChart) {
      projectChart.destroy();
      projectChart = null;
    }

    // Lắng nghe dữ liệu lịch sử tiến độ từ Firestore
    const historyCol = collection(db, "progress_history");
    const qHistory = query(historyCol, where("projectId", "==", projectId));
    
    progressUnsub = onSnapshot(qHistory, (snapshot) => {
        let projectHistory = [];
        snapshot.forEach(doc => {
            projectHistory.push(doc.data());
        });
        
        projectHistory.sort((a, b) => {
            // Sắp xếp theo timestamp, kiểm tra tính hợp lệ của đối tượng timestamp
            const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(0);
            const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(0);
            return dateA - dateB;
        });
        
        updateProjectChart(projectHistory);
    });

    // Lắng nghe thay đổi tiến độ của các task và cập nhật lịch sử
    const tasksCol = collection(db, "tasks");
    const qTasks = query(tasksCol, where("projectId", "==", projectId));

    onSnapshot(qTasks, async (snapshot) => {
        let totalProgress = 0;
        let totalTasks = 0;
        snapshot.forEach(doc => {
            const task = doc.data();
            totalProgress += task.progress || 0;
            totalTasks++;
        });

        const currentProgress = totalTasks > 0 ? Math.round(totalProgress / totalTasks) : 0;
        
        // Ghi lại tiến độ vào Firestore
        await addDoc(collection(db, "progress_history"), {
            projectId,
            progress: currentProgress,
            timestamp: serverTimestamp()
        });
    });
}

function updateProjectChart(projectHistory) {
    const ctx = document.getElementById('project-progress-chart').getContext('2d');
    
    const labels = projectHistory.map(h => {
        // Kiểm tra đối tượng timestamp trước khi gọi toDate()
        const date = h.timestamp?.toDate ? h.timestamp.toDate() : new Date();
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    });
    const data = projectHistory.map(h => h.progress);
    
    if (projectChart) {
        projectChart.data.labels = labels;
        projectChart.data.datasets[0].data = data;
        projectChart.update();
    } else {
        projectChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Tiến độ dự án',
                    data: data,
                    borderColor: 'rgb(59, 130, 246)',
                    backgroundColor: 'rgba(59, 130, 246, 0.2)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        title: {
                            display: true,
                            text: 'Tiến độ (%)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Thời gian'
                        }
                    }
                }
            }
        });
    }
}


// ===== Tải Groups theo thời gian thực (Realtime Groups) =====
// Tải các group có projectId khớp với projectId hiện tại
// Đây là logic quan trọng để đảm bảo dữ liệu không bị trộn lẫn
let groupsUnsub = null; // Biến lưu listener để có thể hủy khi đổi dự án
function loadGroups(projectId) {
  // Hủy listener cũ trước khi tạo listener mới
  if (groupsUnsub) {
    groupsUnsub();
    groupsUnsub = null;
  }

  const groupsCol = collection(db, "groups");
  const qGroups = query(groupsCol, where("projectId", "==", projectId));

  groupsUnsub = onSnapshot(qGroups, (snapshot) => {
    const groupContainer = document.getElementById("groupContainer");
    const inprogressCol = document.getElementById("inprogressCol");
    const doneCol = document.getElementById("doneCol");

    // Xóa toàn bộ nội dung cũ để render lại từ đầu
    groupContainer.innerHTML = "";
    inprogressCol.innerHTML = "";
    doneCol.innerHTML = "";

    snapshot.forEach((docSnap) => {
      const gid = docSnap.id;
      const g = docSnap.data();

      // Hiển thị phần "In Progress"
      const ipSection = document.createElement("div");
      ipSection.className = "border rounded p-2 bg-gray-50 shadow";
      ipSection.innerHTML = `
        <div class="flex justify-between items-center">
          <span class="font-semibold text-yellow-700">${g.title}</span>
        </div>
        <div id="inprogress-${gid}" class="space-y-1 mt-2 min-h-[30px]"></div>
      `;
      inprogressCol.appendChild(ipSection);

      // Hiển thị phần "Done"
      const doneSection = document.createElement("div");
      doneSection.className = "border rounded p-2 bg-gray-50 shadow";
      doneSection.innerHTML = `
        <div class="flex justify-between items-center">
          <span class="font-semibold text-green-700">${g.title}</span>
        </div>
        <div id="done-${gid}" class="space-y-1 mt-2 min-h-[30px]"></div>
      `;
      doneCol.appendChild(doneSection);

      // Hiển thị thẻ Group ở cột To Do
      renderGroup(docSnap);

      // Áp màu cảnh báo dựa trên deadline và trạng thái
      applyGroupColor(gid, g);
    });
  });
}

// ===== Render Group (Cột To Do) =====
function renderGroup(docSnap) {
  const g = docSnap.data();
  const gid = docSnap.id;

  const div = document.createElement("div");
  div.className = "border rounded p-2 bg-gray-50 shadow";
  div.id = `group-${gid}`;

  const deadlineText = g.deadline ? `<span class="text-xs text-gray-500 ml-2">⏰ ${formatDateVN(g.deadline)}</span>` : "";

  div.innerHTML = `
    <div class="flex justify-between items-center">
      <span class="font-semibold text-blue-700">${g.title}${deadlineText}</span>
      <div class="space-x-1">
        <button class="edit-group text-yellow-600 hover:text-yellow-700" title="Sửa group">✏️</button>
        <button class="delete-group text-red-600 hover:text-red-700" title="Xóa group">🗑️</button>
      </div>
    </div>
    <button class="add-task text-green-600 text-xs mt-1 hover:text-green-700">+ Task</button>
    <div id="tasks-${gid}" class="space-y-1 mt-2"></div>
    
    <div class="progress-bar-container mt-4" id="group-progress-container-${gid}">
      <div class="flex items-center mb-1">
        <span class="text-sm font-semibold text-gray-700 mr-2">Tiến độ nhóm:</span>
        <span id="group-progress-value-${gid}" class="text-sm font-medium text-blue-500">0%</span>
      </div>
      <div class="w-full bg-gray-200 rounded-full h-2">
        <div id="group-progress-bar-${gid}" class="bg-blue-600 h-2 rounded-full transition-all duration-300" style="width: 0%;"></div>
      </div>
    </div>
  `;

  document.getElementById("groupContainer").appendChild(div);

  // Tải các task con của group này
  loadTasks(gid);

  // Thêm sự kiện cho các nút
  div.querySelector(".add-task").addEventListener("click", () => openTaskModal(gid, g.projectId));
  div.querySelector(".edit-group").addEventListener("click", () => editGroup(gid, g));
  div.querySelector(".delete-group").addEventListener("click", () => deleteGroup(gid, g));
}

// ===== Tải Tasks theo thời gian thực (Realtime Tasks) =====
// Tải các task có groupId khớp với groupId hiện tại
function loadTasks(groupId) {
  const tasksCol = collection(db, "tasks");
  const qTasks = query(tasksCol, where("groupId", "==", groupId));

  onSnapshot(qTasks, async (snapshot) => {
    const tasks = [];
    let totalProgress = 0;
    
    snapshot.forEach((d) => {
      const taskData = d.data();
      tasks.push({ id: d.id, ...taskData });
      totalProgress += taskData.progress || 0;
    });
    
    const groupProgress = tasks.length > 0 ? Math.round(totalProgress / tasks.length) : 0;
    
    // Cập nhật biểu đồ tiến độ nhóm
    const groupProgressBar = document.getElementById(`group-progress-bar-${groupId}`);
    const groupProgressValue = document.getElementById(`group-progress-value-${groupId}`);
    
    if (groupProgressBar && groupProgressValue) {
      groupProgressBar.style.width = `${groupProgress}%`;
      groupProgressValue.textContent = `${groupProgress}%`;
    }

    // Duyệt qua các thay đổi để cập nhật giao diện
    snapshot.docChanges().forEach((change) => {
      const docSnap = change.doc;
      const tid = docSnap.id;

      const oldElement = document.getElementById(`task-${tid}`);
      if (oldElement) oldElement.remove();

      if (change.type === "added" || change.type === "modified") {
        renderTask(docSnap);
      }
    });

    // Cập nhật trạng thái của Group dựa trên trạng thái của các Task
    let newStatus = "todo";
    const hasAny = tasks.length > 0;
    if (hasAny && tasks.some(t => t.status === "inprogress")) newStatus = "inprogress";
    else if (hasAny && tasks.every(t => t.status === "done")) newStatus = "done";

    const gRef = doc(db, "groups", groupId);
    const gSnap = await getDoc(gRef);
    const gData = gSnap.exists() ? gSnap.data() : {};

    if (gData.status !== newStatus) {
      await updateDoc(gRef, { status: newStatus, updatedAt: serverTimestamp() });
    }

    // Áp dụng lại màu cảnh báo sau khi trạng thái thay đổi
    applyGroupColor(groupId, { ...gData, status: newStatus });
  });
}

// ===== Render task row (từng thẻ task) =====
function renderTask(docSnap) {
  const t = docSnap.data();
  const tid = docSnap.id;

  // Xác định cột để đặt task dựa trên trạng thái của nó
  let colId;
  if (t.status === "todo") colId = `tasks-${t.groupId}`;
  else if (t.status === "inprogress") colId = `inprogress-${t.groupId}`;
  else if (t.status === "done") colId = `done-${t.groupId}`;

  const col = document.getElementById(colId);
  if (!col) return;

  let row = document.getElementById(`task-${tid}`);
  if (!row) {
    row = document.createElement("div");
    row.id = `task-${tid}`;
    row.className = "flex flex-col bg-gray-100 p-2 rounded-md text-sm cursor-move shadow-sm hover:shadow transition-shadow";
    row.style.borderLeft = `4px solid ${t.color || '#e5e7eb'}`;
    row.draggable = true;

    row.innerHTML = `
      <div class="flex justify-between items-center w-full">
        <div class="flex items-center">
            <span class="truncate font-medium">${t.title}</span>
            <span id="task-emoji-${tid}" class="ml-1">${t.emoji || ''}</span>
        </div>
        <div class="space-x-1 flex-shrink-0">
          <button class="emoji-picker-btn text-gray-400 hover:text-yellow-600" title="Chọn cảm xúc">🙂</button>
          <button class="edit-task text-yellow-600 hover:text-yellow-700" title="Sửa">✏️</button>
          <button class="comment-task text-gray-400 hover:text-blue-600" title="Comment">💬</button>
          <button class="delete-task text-red-600 hover:text-red-700" title="Xóa">🗑️</button>
        </div>
      </div>
      <div id="task-info-${tid}" class="flex items-center text-xs text-gray-500 mt-1">
          </div>
      <div id="progress-container-${tid}" class="mt-1 w-full bg-gray-200 rounded-full h-2">
        <div class="bg-green-600 h-2 rounded-full transition-all duration-300" style="width: ${t.progress || 0}%;"></div>
      </div>`;

    col.appendChild(row);

    // Sự kiện kéo thả
    row.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("type", "task");
      e.dataTransfer.setData("taskId", tid);
    });
    
// Sự kiện chọn emoji
row.querySelector(".emoji-picker-btn").addEventListener("click", (e) => {
  e.stopPropagation(); // Ngăn sự kiện drag

  // Danh sách emoji
  const emojiList = ["👍", "🎉", "🔥", "🤔", "👀", "🚀", "❤️", "💯", "✅", "⚠️"];

  const picker = document.createElement('div');
  picker.className = 'absolute z-10 bg-white shadow-lg rounded p-2 flex flex-wrap gap-1';

  // Lấy vị trí của nút emoji-picker-btn để đặt pop-up
  const rect = e.target.getBoundingClientRect();
  picker.style.top = `${rect.bottom + window.scrollY + 5}px`;
  picker.style.left = `${rect.left + window.scrollX}px`;

  // 🔹 Render danh sách emoji
  emojiList.forEach(emoji => {
    const btn = document.createElement('button');
    btn.textContent = emoji;
    btn.className = 'hover:bg-gray-200 p-1 rounded';
    btn.onclick = async () => {
      const userEmail = currentUser?.email || "Ẩn danh";

      // Lấy dữ liệu task hiện tại
      const taskRef = doc(db, "tasks", tid);
      const taskSnap = await getDoc(taskRef);
      const taskData = taskSnap.exists() ? taskSnap.data() : {};

      // Reactions hiện có
      let reactions = taskData.emoji || {};

      // Ghi đè reaction của user hiện tại
      reactions[userEmail] = emoji;

      // Cập nhật Firestore
      await updateDoc(taskRef, { emoji: reactions });
      picker.remove();

      // Ghi log
      await logAction(t.projectId, `thêm cảm xúc ${emoji} vào task "${t.title}"`, t.groupId);
    };
    picker.appendChild(btn);
  });

  // 🔹 Thêm nút "Bỏ cảm xúc"
  const removeBtn = document.createElement('button');
  removeBtn.textContent = "Bỏ cảm xúc";
  removeBtn.className = 'bg-red-100 hover:bg-red-200 text-red-600 px-2 py-1 rounded mt-2 w-full';
  removeBtn.onclick = async () => {
    const userEmail = currentUser?.email || "Ẩn danh";

    const taskRef = doc(db, "tasks", tid);
    const taskSnap = await getDoc(taskRef);
    const taskData = taskSnap.exists() ? taskSnap.data() : {};

    let reactions = taskData.emoji || {};

    // ❌ Xoá cảm xúc của user
    delete reactions[userEmail];

    await updateDoc(taskRef, { emoji: reactions });
    picker.remove();

    await logAction(t.projectId, `bỏ cảm xúc khỏi task "${t.title}"`, t.groupId);
  };
  picker.appendChild(removeBtn);

  document.body.appendChild(picker);

  // 🔹 Đóng picker khi click ra ngoài
  const outsideClick = (event) => {
    if (!picker.contains(event.target) && event.target !== row.querySelector(".emoji-picker-btn")) {
      picker.remove();
      document.removeEventListener('click', outsideClick);
    }
  };
  document.addEventListener('click', outsideClick);
});




    // Sự kiện click nút sửa
    row.querySelector(".edit-task").addEventListener("click", () => {
      openModal("Sửa Task", [
        { id: "title", placeholder: "Task title", type: "text", value: t.title },
        { id: "progress", label: "Tiến độ", type: "range", value: t.progress || 0 },
        { id: "deadline", label: "Hạn chót", type: "date", value: t.deadline || "" }, // Thêm trường deadline
        { id: "color", label: "Màu", type: "color", value: t.color || "#e5e7eb" }
      ], async (vals) => {
        const oldTitle = t.title;
        const oldProgress = t.progress;
        const oldDeadline = t.deadline || null;
        const newDeadline = (vals.deadline && vals.deadline.trim()) ? vals.deadline.trim() : null;

        const updatePayload = {
            title: vals.title,
            color: vals.color,
            progress: parseInt(vals.progress),
            updatedAt: serverTimestamp(),
            updatedBy: currentUser?.email || "Ẩn danh",
        };
        // Cập nhật deadline nếu có
        if (newDeadline) {
            updatePayload.deadline = newDeadline;
        } else {
            updatePayload.deadline = deleteField();
        }
        // Check deadline Task <= Group
const gRef = doc(db, "groups", t.groupId);
const gSnap = await getDoc(gRef);
const gDeadline = gSnap.exists() ? gSnap.data().deadline : null;

if (gDeadline && newDeadline && newDeadline > gDeadline) {
  alert("❌ Deadline của Task không thể vượt quá deadline của Group!");
  return;
}

        await updateDoc(doc(db, "tasks", tid), updatePayload);

        if (oldTitle !== vals.title) {
          await logAction(t.projectId, `cập nhật task "${oldTitle}" thành "${vals.title}"`, t.groupId);
        }
        if (oldProgress !== parseInt(vals.progress)) {
          await logAction(t.projectId, `cập nhật tiến độ task "${vals.title}" từ ${oldProgress || 0}% lên ${parseInt(vals.progress)}%`, t.groupId);
        }
        if (!oldDeadline && newDeadline) {
            await logAction(t.projectId, `đặt deadline cho task "${vals.title}" là ${formatDateVN(newDeadline)}`, t.groupId);
        } else if (oldDeadline && newDeadline && oldDeadline !== newDeadline) {
            await logAction(t.projectId, `đổi deadline task "${vals.title}" từ ${formatDateVN(oldDeadline)} sang ${formatDateVN(newDeadline)}`, t.groupId);
        } else if (oldDeadline && !newDeadline) {
            await logAction(t.projectId, `xóa deadline của task "${vals.title}"`, t.groupId);
        }
      });
    });

    // Sự kiện click nút comment
    row.querySelector(".comment-task").addEventListener("click", () => {
      openModal("Comment Task", [
        { id: "comment", placeholder: "Nhập comment", type: "textarea", value: t.comment || "" }
      ], async (vals) => {
        if (vals.comment && vals.comment.trim().length > 0) {
          await updateDoc(doc(db, "tasks", tid), {
            comment: vals.comment.trim(),
            updatedAt: serverTimestamp(),
            updatedBy: currentUser?.email || "Ẩn danh"
          });
          await logAction(t.projectId, `thêm comment vào task "${t.title}"`, t.groupId);
        } else {
          await updateDoc(doc(db, "tasks", tid), {
            comment: deleteField(),
            updatedAt: serverTimestamp(),
            updatedBy: currentUser?.email || "Ẩn danh"
          });
          await logAction(t.projectId, `xóa comment của task "${t.title}"`, t.groupId);
        }
      });
    });

    // Sự kiện click nút xóa
    row.querySelector(".delete-task").addEventListener("click", async () => {
      if (confirm("Bạn có chắc muốn xóa task này?")) {
        await deleteDoc(doc(db, "tasks", tid));
        await logAction(t.projectId, `xóa task "${t.title}"`, t.groupId);
      }
    });
  }

  // Cập nhật trạng thái nút comment, thanh tiến độ và deadline
  const hasComment = t.comment && t.comment.trim().length > 0;
  const commentBtn = row.querySelector(".comment-task");
  if (hasComment) {
    commentBtn.classList.add("text-blue-600", "font-bold");
  } else {
    commentBtn.classList.remove("text-blue-600", "font-bold");
  }
  
  // Cập nhật emoji
const emojiSpan = row.querySelector(`#task-emoji-${tid}`);
if (emojiSpan) {
  if (t.emoji && typeof t.emoji === "object") {
    // Hiển thị tất cả emoji của mọi user
    emojiSpan.textContent = Object.values(t.emoji).join(" ");
  } else {
    emojiSpan.textContent = t.emoji || '';
  }
}


  const progressBar = row.querySelector(`#progress-container-${tid} div`);
  if (progressBar) {
    progressBar.style.width = `${t.progress || 0}%;`;
  }

  // Thêm class màu nền cho task nếu có deadline gần kề
if (t.deadline) {
    const daysLeft = daysUntil(t.deadline);
    const deadlineClass = colorClassByDaysLeft(daysLeft);

    // luôn bỏ màu trước khi xử lý
    row.classList.remove("bg-red-100", "bg-yellow-200", "bg-orange-300");

    // 🚫 Không áp màu nếu task đã Done
    if (deadlineClass && t.status !== "done") {
        row.classList.add(deadlineClass);
    }
} else {
    row.classList.remove("bg-red-100", "bg-yellow-200", "bg-orange-300");
}


  const taskInfo = row.querySelector(`#task-info-${tid}`);
  if (taskInfo) {
      taskInfo.innerHTML = '';
      if (t.deadline) {
          const deadlineSpan = document.createElement('span');
          deadlineSpan.className = "ml-1 text-gray-700";
          deadlineSpan.innerHTML = `⏰ ${formatDateVN(t.deadline)}`;
          taskInfo.appendChild(deadlineSpan);
      }
  }
}

// ===== Group CRUD (Thêm/Sửa/Xóa) =====
async function addGroup(projectId) {
  openModal("Thêm Group", [
    { id: "title", placeholder: "Tên Group" },
    { id: "deadline", placeholder: "Deadline", type: "date" }
  ], async (vals) => {
    if (!isAuthReady) return;
    const deadline = vals.deadline && vals.deadline.trim() ? vals.deadline.trim() : null;
        // 🔽 Check deadline Group <= Project
    const pRef = doc(db, "projects", projectId);
    const pSnap = await getDoc(pRef);
    const pEnd = pSnap.exists() ? pSnap.data().endDate : null;

    if (pEnd && deadline && deadline > pEnd) {
      alert("❌ Deadline của Group không thể vượt quá deadline của Project!");
      return;
    }

    const newDocRef = await addDoc(collection(db, "groups"), {
      title: vals.title,
      projectId,
      status: "todo",
      deadline,
      createdAt: serverTimestamp(),
      createdBy: currentUser?.email || "Ẩn danh"
    });

    await logAction(projectId,
      `thêm group mới "${vals.title}"` +
      (deadline ? ` (deadline ${formatDateVN(deadline)})` : ``), newDocRef.id
    );
  });
}

async function editGroup(groupId, g) {
  openModal("Sửa Group", [
    { id: "title", placeholder: "Tên", value: g.title },
    { id: "deadline", placeholder: "Deadline", type: "date", value: g.deadline || "" }
  ], async (vals) => {
    if (!isAuthReady) return;
    const oldDeadline = g.deadline || null;
    const newDeadline = (vals.deadline && vals.deadline.trim()) ? vals.deadline.trim() : null;

    const payload = {
      title: vals.title,
      updatedAt: serverTimestamp(),
      updatedBy: currentUser?.email || "Ẩn danh",
      ...(newDeadline ? { deadline: newDeadline } : { deadline: deleteField() })
    };
const pRef = doc(db, "projects", g.projectId);
const pSnap = await getDoc(pRef);
const pEnd = pSnap.exists() ? pSnap.data().endDate : null;

if (pEnd && newDeadline && newDeadline > pEnd) {
  alert("❌ Deadline của Group không thể vượt quá deadline của Project!");
  return;
}
    await updateDoc(doc(db, "groups", groupId), payload);

    if (g.title !== vals.title) {
      await logAction(g.projectId, `cập nhật group "${g.title}" thành "${vals.title}"`, groupId);
    }
    if (!oldDeadline && newDeadline) {
      await logAction(g.projectId, `đặt deadline cho group "${vals.title}" là ${formatDateVN(newDeadline)}`, groupId);
    } else if (oldDeadline && newDeadline && oldDeadline !== newDeadline) {
      await logAction(g.projectId, `đổi deadline group "${vals.title}" từ ${formatDateVN(oldDeadline)} sang ${formatDateVN(newDeadline)}`, groupId);
    } else if (oldDeadline && !newDeadline) {
      await logAction(g.projectId, `xóa deadline của group "${vals.title}"`, groupId);
    }

    const newData = { ...g, ...payload };
    applyGroupColor(groupId, newData);
  });
}

async function deleteGroup(groupId, g) {
  if (!isAuthReady) return;
  if (!confirm("Bạn có chắc muốn xóa group này?")) return;

  const taskSnap = await getDocs(query(collection(db, "tasks"), where("groupId", "==", groupId)));
  const tasksToDelete = taskSnap.docs.map(t => t.id);
  await logAction(g.projectId, `xóa group "${g.title}" và ${tasksToDelete.length} task bên trong`, groupId);

  taskSnap.forEach(async (t) => await deleteDoc(doc(db, "tasks", t.id)));
  await deleteDoc(doc(db, "groups", groupId));
}

// ===== Task CRUD (Thêm) =====
function openTaskModal(groupId, projectId) {
  openModal("Thêm Task", [
    { id: "title", placeholder: "Tên Task" },
    { id: "comment", placeholder: "Comment (tùy chọn)", type: "textarea" },
    { id: "deadline", label: "Hạn chót", type: "date" }, // Thêm trường deadline
    { id: "color", label: "Màu", type: "color" },
    { id: "progress", label: "Tiến độ", type: "range", value: 0 }
  ], async (vals) => {
    if (!isAuthReady) return;
    const deadline = (vals.deadline && vals.deadline.trim()) ? vals.deadline.trim() : null;
    // 🔽 Thêm đoạn check ở đây
const gRef = doc(db, "groups", groupId);
const gSnap = await getDoc(gRef);
const gDeadline = gSnap.exists() ? gSnap.data().deadline : null;

if (gDeadline && deadline && deadline > gDeadline) {
  alert("❌ Deadline của Task không thể vượt quá deadline của Group!");
  return;
}

    const newDocRef = await addDoc(collection(db, "tasks"), {
      title: vals.title,
      comment: vals.comment || "",
      deadline, // Lưu deadline vào task
      color: vals.color || null,
      progress: parseInt(vals.progress),
      projectId,
      groupId,
      status: "todo",
      createdAt: serverTimestamp(),
      createdBy: currentUser?.email || "Ẩn danh"
    });
    await logAction(projectId, `thêm task mới "${vals.title}"` + (deadline ? ` (hạn chót ${formatDateVN(deadline)})` : ''), groupId);
  });
}

// ===== Kéo & Thả (Drag & Drop) =====
function setupDragDrop() {
  ["inprogressCol", "doneCol"].forEach((colId) => {
    const col = document.getElementById(colId);
    if (!col) return;

    col.addEventListener("dragover", (e) => e.preventDefault());

    col.addEventListener("drop", async (e) => {
      e.preventDefault();

      const type = e.dataTransfer.getData("type");
      if (type !== "task") return;

      const taskId = e.dataTransfer.getData("taskId");
      if (!taskId) return;

      const newStatus = colId === "inprogressCol" ? "inprogress" : "done";

      const taskRef = doc(db, "tasks", taskId);
      const taskSnap = await getDoc(taskRef);
      if (!taskSnap.exists()) return;
      const taskData = taskSnap.data();
      const groupData = (await getDoc(doc(db, "groups", taskData.groupId))).data();

      // Cập nhật trạng thái và tiến độ
      const updatePayload = {
        status: newStatus,
        updatedAt: serverTimestamp(),
        updatedBy: currentUser?.email || "Ẩn danh"
      };

      if (newStatus === "done") {
        updatePayload.progress = 100;
      }

      await updateDoc(taskRef, updatePayload);

      // Ghi log hoạt động
      let logMessage = `chuyển task "${taskData.title}" sang trạng thái "${newStatus}"`;
      if (newStatus === "done") {
        logMessage += ` và hoàn thành 100%`;
      }
      logMessage += ` trong group "${groupData.title}"`;
      await logAction(taskData.projectId, logMessage);
    });
  });
}

// ===== Listener cho các nút chức năng chính =====
function setupGroupListeners(projectId) {
  const addGroupBtn = document.getElementById("addGroupBtn");
  if (addGroupBtn) {
    addGroupBtn.addEventListener("click", () => addGroup(projectId));
  }
}










