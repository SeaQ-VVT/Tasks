// ===== Firebase SDKs =====
import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  doc,
  deleteDoc,
  updateDoc,
  serverTimestamp,
  getDocs,
  deleteField,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

// ===== Firebase Config =====
const firebaseConfig = {
  apiKey: "AIzaSyCW49METqezYoUKSC1N0Pi3J83Ptsf9hA8",
  authDomain: "task-manager-d18aa.firebaseapp.com",
  projectId: "task-manager-d18aa",
  storageBucket: "task-manager-d18aa.appspot.com",
  messagingSenderId: "1080268498085",
  appId: "1:1080268498085:web:767434c6a2c013b961d94c",
};

// ===== Init =====
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// ===== Project scope =====
const projectId = "project123";

// ===== Global unsub/interval guards =====
let unsubscribeLogs = null;
let logsIntervalId = null;
const unsubscribeGroups = new Map(); // groupId -> unsubscribe tasks listener

// ===== Auth state =====
onAuthStateChanged(auth, (user) => {
  if (user) {
    showTaskBoard(projectId);
  } else {
    console.log("Người dùng chưa đăng nhập. Chuyển hướng...");
  }
});

// ===== Ghi log hoạt động (có clientTsMs để hiển thị ngay) =====
async function logActivity(action, targetType, targetId, description, oldValue = null, newValue = null) {
  const user = auth.currentUser;
  if (!user) {
    console.error("Lỗi: Không thể ghi log. Người dùng chưa đăng nhập.");
    return;
  }
  try {
    await addDoc(collection(db, "activity_logs"), {
      projectId,
      actor: user.email,
      action,
      targetType,
      targetId,
      description,
      oldValue,
      newValue,
      timestamp: serverTimestamp(),  // giờ server (về sau)
      clientTsMs: Date.now(),        // giờ client (có ngay để order UI)
    });
    // console.log("Log đã được ghi thành công.");
  } catch (e) {
    console.error("Lỗi khi ghi log hoạt động:", e);
  }
}

// ===== Modal helper =====
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
      </div>
    `;
    document.body.appendChild(modal);
  }

  document.getElementById("modalTitle").textContent = title;
  const fieldsDiv = document.getElementById("modalFields");
  fieldsDiv.innerHTML = "";
  fields.forEach((f) => {
    if (f.type === "textarea") {
      fieldsDiv.innerHTML += `<textarea id="${f.id}" placeholder="${f.placeholder}" class="border p-2 w-full">${f.value || ""}</textarea>`;
    } else {
      fieldsDiv.innerHTML += `<input id="${f.id}" type="text" placeholder="${f.placeholder}" class="border p-2 w-full" value="${f.value || ""}">`;
    }
  });

  modal.classList.remove("hidden");

  document.getElementById("modalCancel").onclick = () => modal.classList.add("hidden");
  document.getElementById("modalSave").onclick = () => {
    const values = {};
    fields.forEach((f) => (values[f.id] = document.getElementById(f.id).value));
    onSave(values);
    modal.classList.add("hidden");
  };
}

// ===== Toast nhỏ =====
function showTinyToast(text) {
  const id = "tiny-toast";
  let div = document.getElementById(id);
  if (!div) {
    div = document.createElement("div");
    div.id = id;
    div.className =
      "fixed bottom-4 right-4 bg-black text-white text-sm px-3 py-2 rounded shadow transition-opacity";
    document.body.appendChild(div);
  }
  div.style.opacity = "1";
  div.textContent = text;
  setTimeout(() => {
    div.style.opacity = "0";
  }, 1600);
}

// ===== Hiển thị bảng công việc và log =====
export function showTaskBoard(projectId) {
  const taskBoard = document.getElementById("taskBoard");
  if (!taskBoard) {
    console.error("Không tìm thấy phần tử 'taskBoard'. Vui lòng kiểm tra HTML.");
    return;
  }

  taskBoard.innerHTML = `
    <div class="w-full bg-gray-100 p-4 rounded shadow mb-4">
      <div class="flex justify-between items-center">
        <h3 class="font-bold text-lg">Lịch sử hoạt động của dự án</h3>
        <div class="space-x-2">
          <button id="refreshLogsBtn" class="bg-blue-500 text-white px-2 py-1 rounded text-xs">Làm mới</button>
        </div>
      </div>
      <div id="projectLog" class="max-h-64 overflow-y-auto space-y-1 text-sm mt-2"></div>
    </div>

    <div class="grid grid-cols-3 gap-4 w-full">
      <div class="bg-white p-3 rounded shadow min-h-[400px]" id="todoArea">
        <div class="flex justify-between items-center mb-2">
          <h3 class="font-bold text-red-600">To Do</h3>
          <button id="addGroupBtn" class="bg-blue-500 text-white px-2 py-1 rounded text-xs">+ Group</button>
        </div>
        <div id="groupContainer" class="space-y-3 mt-2"></div>
      </div>

      <div class="bg-white p-3 rounded shadow min-h-[400px]" id="inprogressArea">
        <h3 class="font-bold text-yellow-600 mb-2">In Progress</h3>
        <div id="inprogressCol" class="space-y-2 mt-2 min-h-[200px] border-dashed border-2 border-yellow-200 rounded p-2"></div>
      </div>

      <div class="bg-white p-3 rounded shadow min-h-[400px]" id="doneArea">
        <h3 class="font-bold text-green-600 mb-2">Done</h3>
        <div id="doneCol" class="space-y-2 mt-2 min-h-[200px] border-dashed border-2 border-green-200 rounded p-2"></div>
      </div>
    </div>
  `;

  loadGroups(projectId);
  setupGroupListeners(projectId);
  setupDragDrop(projectId);
  setupLogDisplay(projectId);
  setupLogRefresh(projectId);
  listenProjectChanges(projectId); // toast thông báo nhỏ
}

// ===== Load Groups realtime =====
function loadGroups(projectId) {
  // clear listeners tasks cũ (nếu có)
  for (const [gid, unsub] of unsubscribeGroups.entries()) {
    try { unsub(); } catch {}
    unsubscribeGroups.delete(gid);
  }

  const groupsCol = collection(db, "groups");
  const qGroups = query(groupsCol, where("projectId", "==", projectId));
  onSnapshot(qGroups, (snapshot) => {
    const groupContainer = document.getElementById("groupContainer");
    if (!groupContainer) return;
    groupContainer.innerHTML = "";
    snapshot.forEach((docSnap) => renderGroup(docSnap));
  });
}

// ===== Render Group =====
function renderGroup(docSnap) {
  const g = docSnap.data();
  const gid = docSnap.id;

  const div = document.createElement("div");
  div.className = "border rounded p-2 bg-gray-50 shadow";
  div.id = `group-${gid}`;
  div.innerHTML = `
    <div class="flex justify-between items-center">
      <span class="font-semibold text-blue-700">${g.title}</span>
      <div class="space-x-1">
        <button class="edit-group text-yellow-600" title="Sửa group">✏️</button>
        <button class="delete-group text-red-600" title="Xóa group">🗑️</button>
      </div>
    </div>
    <button class="add-task text-green-600 text-xs mt-1">+ Task</button>
    <div id="tasks-${gid}" class="space-y-1 mt-2 min-h-[40px] border-dashed border border-gray-200 rounded p-1" data-drop-todo-for="${gid}"></div>
  `;

  const container = document.getElementById("groupContainer");
  if (container) container.appendChild(div);

  // Task realtime for this group
  if (unsubscribeGroups.has(gid)) {
    try { unsubscribeGroups.get(gid)(); } catch {}
    unsubscribeGroups.delete(gid);
  }
  const tasksCol = collection(db, "tasks");
  const qTasks = query(tasksCol, where("groupId", "==", gid));
  const unsub = onSnapshot(qTasks, (snapshot) => {
    // dùng docChanges để tránh render lại toàn bộ
    snapshot.docChanges().forEach((change) => {
      const tid = change.doc.id;
      const oldElement = document.getElementById(`task-${tid}`);
      if (change.type === "added" || change.type === "modified") {
        if (oldElement) oldElement.remove();
        renderTask(change.doc);
      } else if (change.type === "removed") {
        if (oldElement) oldElement.remove();
      }
    });
  });
  unsubscribeGroups.set(gid, unsub);

  // Bind actions
  div.querySelector(".add-task").addEventListener("click", () => openTaskModal(gid, g.projectId));
  div.querySelector(".edit-group").addEventListener("click", () => editGroup(gid, g));
  div.querySelector(".delete-group").addEventListener("click", () => deleteGroup(gid, g));
}

// ===== Render task row =====
function renderTask(docSnap) {
  const t = docSnap.data();
  const tid = docSnap.id;

  const colId = t.status === "todo" ? `tasks-${t.groupId}` : `${t.status}Col`;
  const col = document.getElementById(colId);
  if (!col) return;

  const old = document.getElementById(`task-${tid}`);
  if (old) old.remove();

  const hasComment = t.comment && String(t.comment).trim().length > 0;
  const row = document.createElement("div");
  row.id = `task-${tid}`;
  row.className = "flex justify-between items-center bg-gray-100 px-2 py-1 rounded border text-sm cursor-move";
  row.draggable = true;
  row.innerHTML = `
    <span class="truncate max-w-[200px]" title="${t.title}">${t.title}</span>
    <div class="space-x-1">
      <button class="edit-task" title="Sửa">✏️</button>
      <button class="comment-task ${hasComment ? "text-blue-600 font-bold" : "text-gray-400"}" title="Comment">💬</button>
      <button class="delete-task text-red-600" title="Xóa">🗑️</button>
    </div>
  `;

  // Drag data
  row.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("type", "task");
    e.dataTransfer.setData("taskId", tid);
    e.dataTransfer.setData("groupId", t.groupId);
    e.dataTransfer.setData("projectId", t.projectId);
    e.dataTransfer.setData("status", t.status);
  });

  // Actions
  row.querySelector(".edit-task").addEventListener("click", () => {
    openModal(
      "Edit Task",
      [{ id: "title", placeholder: "Task title", type: "text", value: t.title }],
      async (vals) => {
        const newTitle = vals.title.trim();
        if (newTitle && t.title !== newTitle) {
          await updateDoc(doc(db, "tasks", tid), {
            title: newTitle,
            updatedAt: serverTimestamp(),
            updatedBy: auth.currentUser.email,
          });
          logActivity("edit_task", "task", tid, `Đổi tên task từ "${t.title}" thành "${newTitle}"`, t.title, newTitle);
        }
      }
    );
  });

  row.querySelector(".comment-task").addEventListener("click", () => {
    openModal(
      "Comment Task",
      [{ id: "comment", placeholder: "Nhập comment", type: "textarea", value: t.comment || "" }],
      async (vals) => {
        const newComment = (vals.comment || "").trim();
        if (t.comment !== newComment) {
          if (newComment.length > 0) {
            await updateDoc(doc(db, "tasks", tid), {
              comment: newComment,
              updatedAt: serverTimestamp(),
              updatedBy: auth.currentUser.email,
            });
            logActivity("edit_comment", "task", tid, `Cập nhật comment cho task "${t.title}"`);
          } else {
            await updateDoc(doc(db, "tasks", tid), {
              comment: deleteField(),
              updatedAt: serverTimestamp(),
              updatedBy: auth.currentUser.email,
            });
            logActivity("delete_comment", "task", tid, `Xóa comment của task "${t.title}"`);
          }
        }
      }
    );
  });

  row.querySelector(".delete-task").addEventListener("click", async () => {
    if (confirm("Xóa task này?")) {
      await deleteDoc(doc(db, "tasks", tid));
      logActivity("delete_task", "task", tid, `Đã xóa task: "${t.title}"`);
    }
  });

  col.appendChild(row);
}

// ===== Group actions =====
async function addGroup(projectId) {
  openModal("Thêm Group", [{ id: "title", placeholder: "Tên Group" }], async (vals) => {
    const title = (vals.title || "").trim();
    if (!title) return;
    const docRef = await addDoc(collection(db, "groups"), {
      title,
      projectId,
      status: "todo",
      createdAt: serverTimestamp(),
      createdBy: auth.currentUser.email,
    });
    logActivity("create_group", "group", docRef.id, `Đã tạo group: "${title}"`);
  });
}

async function editGroup(groupId, g) {
  openModal("Sửa Group", [{ id: "title", placeholder: "Tên", value: g.title }], async (vals) => {
    const newTitle = (vals.title || "").trim();
    if (newTitle && g.title !== newTitle) {
      await updateDoc(doc(db, "groups", groupId), {
        title: newTitle,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser.email,
      });
      logActivity("edit_group", "group", groupId, `Đổi tên group từ "${g.title}" thành "${newTitle}"`, g.title, newTitle);
    }
  });
}

async function deleteGroup(groupId, g) {
  if (!confirm("Xóa group này và tất cả task bên trong?")) return;
  // Xóa tasks trong group
  const taskSnap = await getDocs(query(collection(db, "tasks"), where("groupId", "==", groupId)));
  const tasksDeleted = taskSnap.docs.map((t) => t.data().title || t.id);
  for (const t of taskSnap.docs) {
    await deleteDoc(doc(db, "tasks", t.id));
  }
  // Xóa group
  await deleteDoc(doc(db, "groups", groupId));
  logActivity("delete_group", "group", groupId, `Đã xóa group: "${g.title}" và các task: ${tasksDeleted.join(", ")}`);
}

// ===== Task actions =====
function openTaskModal(groupId, projectId) {
  openModal(
    "Thêm Task",
    [
      { id: "title", placeholder: "Tên Task" },
      { id: "comment", placeholder: "Comment (tùy chọn)", type: "textarea" },
    ],
    async (vals) => {
      const title = (vals.title || "").trim();
      const comment = (vals.comment || "").trim();
      if (!title) return;

      const docRef = await addDoc(collection(db, "tasks"), {
        title,
        comment: comment || "",
        projectId,
        groupId,
        status: "todo",
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser.email,
      });
      logActivity("create_task", "task", docRef.id, `Đã tạo task: "${title}"`);
    }
  );
}

// ===== Listeners =====
function setupGroupListeners(projectId) {
  const btn = document.getElementById("addGroupBtn");
  if (btn) btn.addEventListener("click", () => addGroup(projectId));
}

// ===== Drag & Drop =====
function setupDragDrop(projectId) {
  // In Progress & Done columns
  ["inprogressCol", "doneCol"].forEach((colId) => {
    const col = document.getElementById(colId);
    if (!col) return;
    col.addEventListener("dragover", (e) => e.preventDefault());
    col.addEventListener("drop", async (e) => {
      e.preventDefault();
      const type = e.dataTransfer.getData("type");
      if (type !== "task") return;
      const taskId = e.dataTransfer.getData("taskId");
      const oldStatus = e.dataTransfer.getData("status");
      const newStatus = colId === "inprogressCol" ? "inprogress" : "done";
      if (oldStatus !== newStatus) {
        await updateDoc(doc(db, "tasks", taskId), {
          status: newStatus,
          updatedAt: serverTimestamp(),
          updatedBy: auth.currentUser.email,
        });
        logActivity(
          "move_task",
          "task",
          taskId,
          `Di chuyển task "${taskId}" từ "${oldStatus}" sang "${newStatus}"`,
          oldStatus,
          newStatus
        );
      }
    });
  });

  // Kéo về lại To Do: thả lên bất kỳ khung tasks-{groupId}
  document.addEventListener("dragover", (e) => {
    const target = e.target.closest("[data-drop-todo-for]");
    if (target) e.preventDefault();
  });
  document.addEventListener("drop", async (e) => {
    const target = e.target.closest("[data-drop-todo-for]");
    if (!target) return;
    e.preventDefault();
    const type = e.dataTransfer.getData("type");
    if (type !== "task") return;
    const taskId = e.dataTransfer.getData("taskId");
    const oldStatus = e.dataTransfer.getData("status");
    const taskGroupId = e.dataTransfer.getData("groupId"); // group hiện tại của task
    const dropGroupId = target.getAttribute("data-drop-todo-for");

    // Nếu thả vào group khác, đổi groupId; nếu khác status, đổi về todo
    const updatePayload = {
      updatedAt: serverTimestamp(),
      updatedBy: auth.currentUser.email,
    };
    let moved = false;

    if (oldStatus !== "todo") {
      updatePayload.status = "todo";
      moved = true;
    }
    if (taskGroupId !== dropGroupId) {
      updatePayload.groupId = dropGroupId;
      moved = true;
    }

    if (moved) {
      await updateDoc(doc(db, "tasks", taskId), updatePayload);
      logActivity(
        "move_task",
        "task",
        taskId,
        `Di chuyển task "${taskId}" về To Do${taskGroupId !== dropGroupId ? ` (sang group ${dropGroupId})` : ""}`,
        oldStatus,
        "todo"
      );
    }
  });
}

// ===== Logs: render =====
function renderLogs(logs) {
  const logContainer = document.getElementById("projectLog");
  if (!logContainer) return;

  logContainer.innerHTML = "";
  logs.forEach((log) => {
    const p = document.createElement("p");
    p.className = "text-gray-600 my-1";

    let timeText = "...";
    if (log?.timestamp?.toDate) {
      timeText = new Date(log.timestamp.toDate()).toLocaleTimeString();
    } else if (typeof log?.clientTsMs === "number") {
      timeText = new Date(log.clientTsMs).toLocaleTimeString() + " (đang đồng bộ)";
    }

    const actor = log.actor || "unknown";
    const desc = log.description || `${log.action || "activity"} (${log.targetType || ""} ${log.targetId || ""})`;
    p.innerHTML = `<span class="font-semibold text-blue-700">${actor}</span>: ${desc} <span class="text-gray-400">(${timeText})</span>`;
    logContainer.appendChild(p);
  });
}

// ===== Logs: fetch (1 lần) =====
async function fetchLogs(projectId) {
  try {
    const logsQuery = query(
      collection(db, "activity_logs"),
      where("projectId", "==", projectId),
      orderBy("clientTsMs", "desc"),
      limit(50)
    );
    const snapshot = await getDocs(logsQuery);
    const logs = snapshot.docs.map((d) => d.data());
    renderLogs(logs);
  } catch (e) {
    console.warn("fetchLogs(orderBy clientTsMs) lỗi, thử fallback no-order:", e);
    try {
      const q2 = query(collection(db, "activity_logs"), where("projectId", "==", projectId), limit(50));
      const snap2 = await getDocs(q2);
      const logs2 = snap2.docs
        .map((d) => d.data())
        .sort((a, b) => (b.clientTsMs || 0) - (a.clientTsMs || 0));
      renderLogs(logs2);
    } catch (e2) {
      console.error("fetchLogs fallback lỗi:", e2);
    }
  }
}

// ===== Logs: thiết lập realtime (có fallback polling) =====
function setupLogDisplay(projectId) {
  // Hủy listener/interval cũ nếu có
  if (unsubscribeLogs) {
    try { unsubscribeLogs(); } catch {}
    unsubscribeLogs = null;
  }
  if (logsIntervalId) {
    clearInterval(logsIntervalId);
    logsIntervalId = null;
  }

  // Dùng clientTsMs để log hiện ngay
  const logsQ = query(
    collection(db, "activity_logs"),
    where("projectId", "==", projectId),
    orderBy("clientTsMs", "desc"),
    limit(50)
  );

  unsubscribeLogs = onSnapshot(
    logsQ,
    (snap) => {
      const logs = [];
      snap.forEach((docSnap) => logs.push(docSnap.data()));
      renderLogs(logs);
    },
    (err) => {
      console.error("onSnapshot(activity_logs) lỗi, chuyển sang polling:", err);
      logsIntervalId = setInterval(() => fetchLogs(projectId), 3000);
    }
  );

  // Tải phát đầu (phòng mạng chậm)
  fetchLogs(projectId);
}

// ===== Logs: nút làm mới =====
function setupLogRefresh(projectId) {
  const refreshBtn = document.getElementById("refreshLogsBtn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => fetchLogs(projectId));
  }
}

// ===== Toast realtime theo thay đổi tasks =====
let unsubTaskChanges = null;
function listenProjectChanges(projectId) {
  if (unsubTaskChanges) {
    try { unsubTaskChanges(); } catch {}
    unsubTaskChanges = null;
  }
  const q = query(collection(db, "tasks"), where("projectId", "==", projectId));
  unsubTaskChanges = onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      const t = change.doc.data() || {};
      // Có thể bỏ qua event do chính mình nếu muốn:
      // if (t.updatedBy && t.updatedBy === auth.currentUser?.email) return;

      let msg = "";
      if (change.type === "added") msg = `Task mới: "${t.title || change.doc.id}"`;
      if (change.type === "modified") msg = `Task cập nhật: "${t.title || change.doc.id}"`;
      if (change.type === "removed") msg = `Task đã xóa: "${t.title || change.doc.id}"`;

      if (msg) showTinyToast(msg);
    });
  });
}
