// ===== Firebase SDKs =====
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

// ===== Init Firebase =====
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// ===== Modal helper (textarea/color/range/date) =====
function openModal(title, fields, onSave) {
  let modal = document.getElementById("popupModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "popupModal";
    modal.className = "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 hidden";
    modal.innerHTML = `
      <div class="bg-white rounded-lg p-4 w-96">
        <h3 id="modalTitle" class="font-semibold mb-2"></h3>
        <div id="modalFields" class="space-y-2"></div>
        <div class="flex justify-end space-x-2 mt-3">
          <button id="modalCancel" class="px-3 py-1 bg-gray-200 rounded">Hủy</button>
          <button id="modalSave" class="px-3 py-1 bg-green-500 text-white rounded">Lưu</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }

  document.getElementById("modalTitle").textContent = title;
  const fieldsDiv = document.getElementById("modalFields");
  fieldsDiv.innerHTML = "";
  fields.forEach(f => {
    if (f.type === "textarea") {
      fieldsDiv.innerHTML += `<textarea id="${f.id}" placeholder="${f.placeholder}" class="border p-2 w-full">${f.value || ""}</textarea>`;
    } else if (f.type === "color") {
      fieldsDiv.innerHTML += `
        <div class="flex items-center space-x-2">
          <label for="${f.id}" class="text-gray-700 w-20">${f.label || "Màu"}:</label>
          <input id="${f.id}" type="color" class="border p-1 w-full" value="${f.value || "#000000"}">
        </div>`;
    } else if (f.type === "range") {
      fieldsDiv.innerHTML += `
        <div class="flex flex-col">
          <label for="${f.id}" class="text-gray-700">${f.label || "Tiến độ"} (<span id="progress-value">${f.value || 0}</span>%)</label>
          <input id="${f.id}" type="range" min="0" max="100" value="${f.value || 0}" class="w-full">
        </div>`;
    } else if (f.type === "date") {
      fieldsDiv.innerHTML += `<input id="${f.id}" type="date" class="border p-2 w-full" value="${f.value || ""}">`;
    } else {
      fieldsDiv.innerHTML += `<input id="${f.id}" type="text" placeholder="${f.placeholder}" class="border p-2 w-full" value="${f.value || ""}">`;
    }
  });

  modal.classList.remove("hidden");

  const progressInput = document.getElementById("progress");
  if (progressInput) {
    const progressValueSpan = document.getElementById("progress-value");
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

// ===== Helpers =====
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
    @keyframes fadeInUp {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
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

// ===== Logs =====
async function logAction(projectId, action) {
  const user = auth.currentUser?.email || "Ẩn danh";
  await addDoc(collection(db, "logs"), {
    projectId,
    action,
    user,
    timestamp: serverTimestamp()
  });
}

function listenForLogs(projectId) {
  const logsCol = collection(db, "logs");
  const q = query(logsCol, where("projectId", "==", projectId));

  onSnapshot(q, (snapshot) => {
    const logEntries = document.getElementById("logEntries");
    if (!logEntries) return;

    const logs = [];
    snapshot.forEach((doc) => logs.push(doc.data()));
    logs.sort((a, b) => b.timestamp - a.timestamp);

    logEntries.innerHTML = "";
    logs.forEach((data) => {
      const timestamp = data.timestamp?.toDate ? data.timestamp.toDate().toLocaleString() : "-";
      const userDisplayName = getUserDisplayName(data.user);
      const logItem = document.createElement("div");
      logItem.textContent = `[${timestamp}] ${userDisplayName} đã ${data.action}.`;
      logEntries.appendChild(logItem);
    });

    snapshot.docChanges().forEach((change) => {
      if (change.type === "added") {
        const data = change.doc.data();
        const userDisplayName = getUserDisplayName(data.user);
        showToast(`${userDisplayName} đã ${data.action}.`);
      }
    });
  });
}

// ===== DEADLINE CONFIG (đổi 1 chỗ là xong) =====
const DEADLINE_CFG = {
  thresholds: [14, 7, 3], // <=14 cam, <=7 vàng, <=3 đỏ
  classes: ["ring-2 ring-orange-300", "ring-2 ring-yellow-400", "ring-2 ring-red-500"],
};

// ===== Deadline helpers & màu cảnh báo =====
function daysUntil(dateStr) {
  if (!dateStr) return Infinity;
  const today = new Date();
  const d = new Date(dateStr + "T23:59:59");
  return Math.floor((d - today) / (1000 * 60 * 60 * 24));
}

// ✅ Duyệt NGƯỢC để map đúng khi thresholds là [14,7,3]
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
  if (g.status === "todo")       return colorClassByDaysLeft(left);
  if (g.status === "inprogress") return colorClassByDaysLeft(left);
  return ""; // done => không cảnh báo
}

// ✅ Gỡ sạch MỌI class bắt đầu bằng "ring-" trước khi tô
function removeWarnClasses(el) {
  if (!el) return;
  [...el.classList].forEach(c => {
    if (c.startsWith("ring-")) el.classList.remove(c);
  });
}

function applyGroupColor(gid, g) {
  const cls = getGroupWarnClass(g);

  // To Do card
  const todoCard = document.getElementById(`group-${gid}`);
  if (todoCard) {
    if (g.status === "todo") {
      removeWarnClasses(todoCard);
      if (cls) todoCard.classList.add(...cls.split(" "));
    } else {
      removeWarnClasses(todoCard);
    }
  }

  // In Progress section
  const ipWrapper = document.getElementById(`inprogress-${gid}`)?.parentElement;
  if (ipWrapper) {
    if (g.status === "inprogress") {
      removeWarnClasses(ipWrapper);
      if (cls) ipWrapper.classList.add(...cls.split(" "));
    } else {
      removeWarnClasses(ipWrapper);
    }
  }

  // Done: luôn bỏ cảnh báo
  const doneWrapper = document.getElementById(`done-${gid}`)?.parentElement;
  if (doneWrapper) removeWarnClasses(doneWrapper);
}

// ===== Render Task Board =====
export function showTaskBoard(projectId, projectTitle) {
  const taskBoard = document.getElementById("taskBoard");

  taskBoard.innerHTML = `
    <h2 class="text-xl font-bold mb-4">Bạn đang ở dự án: ${projectTitle}</h2>

    <div id="logArea" class="mt-4 bg-gray-100 p-4 rounded-lg">
      <div class="flex justify-between items-center mb-2">
        <h4 class="font-semibold text-gray-700">Nhật ký hoạt động</h4>
        <button id="toggleLogBtn" class="bg-gray-300 text-gray-700 px-2 py-1 rounded text-xs">Hiện log</button>
      </div>
      <div id="logEntries" class="space-y-2 text-sm text-gray-600 hidden"></div>
    </div>

    <div class="grid grid-cols-3 gap-4 w-full mt-4">
      <div class="bg-white p-3 rounded shadow min-h-[400px]" id="todoArea">
        <h3 class="font-bold text-red-600 mb-2">To Do</h3>
        <button id="addGroupBtn" class="bg-blue-500 text-white px-2 py-1 rounded text-xs">+ Group</button>
        <div id="groupContainer" class="space-y-3 mt-2"></div>
      </div>
      <div class="bg-white p-3 rounded shadow min-h-[400px]" id="inprogressArea">
        <h3 class="font-bold text-yellow-600 mb-2">In Progress</h3>
        <div id="inprogressCol" class="space-y-3 mt-2 min-h-[200px]"></div>
      </div>
      <div class="bg-white p-3 rounded shadow min-h-[400px]" id="doneArea">
        <h3 class="font-bold text-green-600 mb-2">Done</h3>
        <div id="doneCol" class="space-y-3 mt-2 min-h-[200px]"></div>
      </div>
    </div>
  `;

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

  loadGroups(projectId);
  setupGroupListeners(projectId);
  setupDragDrop();
  listenForLogs(projectId);
}

// ===== Load Groups realtime (tạo section cho 3 cột & áp màu) =====
function loadGroups(projectId) {
  const groupsCol = collection(db, "groups");
  const qGroups = query(groupsCol, where("projectId", "==", projectId));

  onSnapshot(qGroups, (snapshot) => {
    const groupContainer = document.getElementById("groupContainer");
    const inprogressCol = document.getElementById("inprogressCol");
    const doneCol = document.getElementById("doneCol");

    // Clear
    groupContainer.innerHTML = "";
    inprogressCol.innerHTML = "";
    doneCol.innerHTML = "";

    snapshot.forEach((docSnap) => {
      const gid = docSnap.id;
      const g = docSnap.data();

      // In Progress section
      const ipSection = document.createElement("div");
      ipSection.className = "border rounded p-2 bg-gray-50 shadow";
      ipSection.innerHTML = `
        <div class="flex justify-between items-center">
          <span class="font-semibold text-yellow-700">${g.title}</span>
        </div>
        <div id="inprogress-${gid}" class="space-y-1 mt-2"></div>
      `;
      inprogressCol.appendChild(ipSection);

      // Done section
      const doneSection = document.createElement("div");
      doneSection.className = "border rounded p-2 bg-gray-50 shadow";
      doneSection.innerHTML = `
        <div class="flex justify-between items-center">
          <span class="font-semibold text-green-700">${g.title}</span>
        </div>
        <div id="done-${gid}" class="space-y-1 mt-2"></div>
      `;
      doneCol.appendChild(doneSection);

      // To Do card
      renderGroup(docSnap);

      // Áp màu cảnh báo
      applyGroupColor(gid, g);
    });
  });
}

// ===== Render Group (TO DO) =====
function renderGroup(docSnap) {
  const g = docSnap.data();
  const gid = docSnap.id;

  const div = document.createElement("div");
  div.className = "border rounded p-2 bg-gray-50 shadow";
  div.id = `group-${gid}`;

  const deadlineText = g.deadline ? `<span class="text-xs text-gray-500 ml-2">⏰ ${g.deadline}</span>` : "";

  div.innerHTML = `
    <div class="flex justify-between items-center">
      <span class="font-semibold text-blue-700">${g.title}${deadlineText}</span>
      <div class="space-x-1">
        <button class="edit-group text-yellow-600" title="Sửa group">✏️</button>
        <button class="delete-group text-red-600" title="Xóa group">🗑️</button>
      </div>
    </div>
    <button class="add-task text-green-600 text-xs mt-1">+ Task</button>
    <div id="tasks-${gid}" class="space-y-1 mt-2"></div>
  `;

  document.getElementById("groupContainer").appendChild(div);

  loadTasks(gid);

  div.querySelector(".add-task").addEventListener("click", () => openTaskModal(gid, g.projectId));
  div.querySelector(".edit-group").addEventListener("click", () => editGroup(gid, g));
  div.querySelector(".delete-group").addEventListener("click", () => deleteGroup(gid, g));
}

// ===== Load tasks realtime (theo group) & auto cập nhật group.status =====
function loadTasks(groupId) {
  const tasksCol = collection(db, "tasks");
  const qTasks = query(tasksCol, where("groupId", "==", groupId));

  onSnapshot(qTasks, async (snapshot) => {
    const tasks = [];
    snapshot.forEach((d) => tasks.push({ id: d.id, ...d.data() }));

    // Render từng thay đổi
    snapshot.docChanges().forEach((change) => {
      const docSnap = change.doc;
      const tid = docSnap.id;

      const oldElement = document.getElementById(`task-${tid}`);
      if (oldElement) oldElement.remove();

      if (change.type === "added" || change.type === "modified") {
        renderTask(docSnap);
      }
    });

    // === TÍNH TRẠNG THÁI GROUP ===
    let newStatus = "todo";
    if (tasks.some(t => t.status === "inprogress")) newStatus = "inprogress";

    const hasAny = tasks.length > 0;
    const allDone = hasAny && tasks.every(t => t.status === "done");
    if (allDone) newStatus = "done";

    // Lấy group hiện tại
    const gRef = doc(db, "groups", groupId);
    const gSnap = await getDoc(gRef);
    const gData = gSnap.exists() ? gSnap.data() : {};

    if (gData.status !== newStatus) {
      await updateDoc(gRef, { status: newStatus, updatedAt: serverTimestamp() });
    }

    // Áp lại màu cảnh báo theo status + deadline
    applyGroupColor(groupId, { ...gData, status: newStatus });
  });
}

// ===== Render task row (map theo group ở mỗi cột) =====
function renderTask(docSnap) {
  const t = docSnap.data();
  const tid = docSnap.id;

  // Map đúng container theo status + groupId
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
    row.className = "flex flex-col bg-gray-100 px-2 py-1 rounded text-sm cursor-move";
    row.style.borderLeft = `4px solid ${t.color || '#e5e7eb'}`;
    row.draggable = true;

    row.innerHTML = `
      <div class="flex justify-between items-center w-full">
        <span class="truncate">${t.title}</span>
        <div class="space-x-1">
          <button class="edit-task" title="Sửa">✏️</button>
          <button class="comment-task" title="Comment">💬</button>
          <button class="delete-task" title="Xóa">🗑️</button>
        </div>
      </div>
      <div id="progress-container-${tid}" class="mt-1 w-full bg-gray-200 rounded-full h-2.5">
        <div class="bg-green-600 h-2.5 rounded-full" style="width: ${t.progress || 0}%;"></div>
      </div>`;

    col.appendChild(row);

    row.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("type", "task");
      e.dataTransfer.setData("taskId", tid);
      e.dataTransfer.setData("groupId", t.groupId);
    });

    row.querySelector(".edit-task").addEventListener("click", () => {
      openModal("Edit Task", [
        { id: "title", placeholder: "Task title", type: "text", value: t.title },
        { id: "progress", label: "Tiến độ", type: "range", value: t.progress || 0 },
        { id: "color", label: "Màu", type: "color", value: t.color || "#000000" }
      ], async (vals) => {
        const oldTitle = t.title;
        const oldProgress = t.progress;

        await updateDoc(doc(db, "tasks", tid), {
          title: vals.title,
          color: vals.color,
          progress: parseInt(vals.progress),
          updatedAt: serverTimestamp(),
          updatedBy: auth.currentUser?.email || "Ẩn danh"
        });

        if (oldTitle !== vals.title) {
          await logAction(t.projectId, `cập nhật task "${oldTitle}" thành "${vals.title}"`);
        }
        if (oldProgress !== parseInt(vals.progress)) {
          await logAction(t.projectId, `cập nhật tiến độ task "${vals.title}" từ ${oldProgress || 0}% lên ${parseInt(vals.progress)}%`);
        }
      });
    });

    row.querySelector(".comment-task").addEventListener("click", () => {
      openModal("Comment Task", [
        { id: "comment", placeholder: "Nhập comment", type: "textarea", value: t.comment || "" }
      ], async (vals) => {
        if (vals.comment && vals.comment.trim().length > 0) {
          await updateDoc(doc(db, "tasks", tid), {
            comment: vals.comment.trim(),
            updatedAt: serverTimestamp(),
            updatedBy: auth.currentUser?.email || "Ẩn danh"
          });
          await logAction(t.projectId, `thêm comment vào task "${t.title}"`);
        } else {
          await updateDoc(doc(db, "tasks", tid), {
            comment: deleteField(),
            updatedAt: serverTimestamp(),
            updatedBy: auth.currentUser?.email || "Ẩn danh"
          });
          await logAction(t.projectId, `xóa comment của task "${t.title}"`);
        }
      });
    });

    row.querySelector(".delete-task").addEventListener("click", async () => {
      if (confirm("Xóa task này?")) {
        await deleteDoc(doc(db, "tasks", tid));
        await logAction(t.projectId, `xóa task "${t.title}"`);
      }
    });
  }

  const hasComment = t.comment && t.comment.trim().length > 0;
  const commentBtn = row.querySelector(".comment-task");
  if (hasComment) {
    commentBtn.classList.remove("text-gray-400");
    commentBtn.classList.add("text-blue-600", "font-bold");
  } else {
    commentBtn.classList.remove("text-blue-600", "font-bold");
    commentBtn.classList.add("text-gray-400");
  }

  const progressBar = row.querySelector(`#progress-container-${tid} div`);
  if (progressBar) {
    progressBar.style.width = `${t.progress || 0}%`;
  }
}

// ===== Group CRUD (Add/ Edit/ Delete) =====
async function addGroup(projectId) {
  openModal("Thêm Group", [
    { id: "title", placeholder: "Tên Group" },
    { id: "deadline", placeholder: "Deadline", type: "date" }
  ], async (vals) => {
    const deadline = vals.deadline && vals.deadline.trim() ? vals.deadline.trim() : null;
    await addDoc(collection(db, "groups"), {
      title: vals.title,
      projectId,
      status: "todo",
      deadline,
      createdAt: serverTimestamp(),
      createdBy: auth.currentUser?.email || "Ẩn danh"
    });

    // Log có deadline
    await logAction(projectId,
      `thêm group mới "${vals.title}"` +
      (deadline ? ` (deadline ${formatDateVN(deadline)})` : ` (không đặt deadline)`)
    );
  });
}

async function editGroup(groupId, g) {
  openModal("Sửa Group", [
    { id: "title", placeholder: "Tên", value: g.title },
    { id: "deadline", placeholder: "Deadline", type: "date", value: g.deadline || "" }
  ], async (vals) => {
    const oldDeadline = g.deadline || null;
    const newDeadline = (vals.deadline && vals.deadline.trim()) ? vals.deadline.trim() : null;

    const payload = {
      title: vals.title,
      updatedAt: serverTimestamp(),
      updatedBy: auth.currentUser?.email || "Ẩn danh",
      ...(newDeadline ? { deadline: newDeadline } : { deadline: deleteField() })
    };

    await updateDoc(doc(db, "groups", groupId), payload);

    // Log đổi tên
    if (g.title !== vals.title) {
      await logAction(g.projectId, `cập nhật group "${g.title}" thành "${vals.title}"`);
    }
    // Log deadline
    if (!oldDeadline && newDeadline) {
      await logAction(g.projectId, `đặt deadline cho group "${vals.title}" là ${formatDateVN(newDeadline)}`);
    } else if (oldDeadline && newDeadline && oldDeadline !== newDeadline) {
      await logAction(g.projectId, `đổi deadline group "${vals.title}" từ ${formatDateVN(oldDeadline)} sang ${formatDateVN(newDeadline)}`);
    } else if (oldDeadline && !newDeadline) {
      await logAction(g.projectId, `xóa deadline của group "${vals.title}"`);
    }

    // cập nhật màu ngay sau khi sửa
    const newData = { ...g, ...payload };
    applyGroupColor(groupId, newData);
  });
}

async function deleteGroup(groupId, g) {
  if (!confirm("Xóa group này và tất cả task bên trong?")) return;

  const taskSnap = await getDocs(query(collection(db, "tasks"), where("groupId", "==", groupId)));
  const tasksToDelete = taskSnap.docs.map(t => t.id);
  await logAction(g.projectId, `xóa group "${g.title}" và ${tasksToDelete.length} task bên trong`);

  taskSnap.forEach(async (t) => await deleteDoc(doc(db, "tasks", t.id)));
  await deleteDoc(doc(db, "groups", groupId));
}

// ===== Task add =====
function openTaskModal(groupId, projectId) {
  openModal("Thêm Task", [
    { id: "title", placeholder: "Tên Task" },
    { id: "comment", placeholder: "Comment (tùy chọn)", type: "textarea" },
    { id: "color", label: "Màu", type: "color" },
    { id: "progress", label: "Tiến độ", type: "range", value: 0 }
  ], async (vals) => {
    await addDoc(collection(db, "tasks"), {
      title: vals.title,
      comment: vals.comment || "",
      color: vals.color || null,
      progress: parseInt(vals.progress),
      projectId, groupId, status: "todo",
      createdAt: serverTimestamp(),
      createdBy: auth.currentUser?.email || "Ẩn danh"
    });
    await logAction(projectId, `thêm task mới "${vals.title}" vào group`);
  });
}

// ===== Drag & Drop (đổi status, group giữ nguyên) =====
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

      await updateDoc(taskRef, {
        status: newStatus,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.email || "Ẩn danh"
      });

      await logAction(taskData.projectId, `chuyển task "${taskData.title}" sang trạng thái "${newStatus}"`);
    });
  });
}

// ===== Listeners =====
function setupGroupListeners(projectId) {
  document.getElementById("addGroupBtn").addEventListener("click", () => addGroup(projectId));
}
