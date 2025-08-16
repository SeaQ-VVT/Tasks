// ===================== Firebase SDKs =====================
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
  limit,
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

// ===================== Config & Init =====================
const firebaseConfig = {
  apiKey: "AIzaSyCW49METqezYoUKSC1N0Pi3J83Ptsf9hA8",
  authDomain: "task-manager-d18aa.firebaseapp.com",
  projectId: "task-manager-d18aa",
  storageBucket: "task-manager-d18aa.appspot.com",
  messagingSenderId: "1080268498085",
  appId: "1:1080268498085:web:767434c6a2c013b961d94c",
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// ===================== State =====================
let CURRENT_PROJECT_ID = null;          // <-- dự án đang mở (động)
const unsubs = {
  logs: null,
  tasksToast: null,
  groupTasks: new Map(),                // groupId -> unsub
};

// Lấy projectId từ URL hoặc từ data attribute nếu bạn không truyền tay
function resolveProjectIdFallback() {
  const fromQS = new URLSearchParams(location.search).get("projectId");
  if (fromQS) return fromQS;
  const el = document.getElementById("taskBoard");
  if (el?.dataset?.projectId) return el.dataset.projectId;
  return null;
}

// ===================== Auth =====================
onAuthStateChanged(auth, (user) => {
  if (!user) return console.log("Chưa đăng nhập");
  // Nếu bạn không tự gọi showTaskBoard(projectId) từ nút “Xem công việc”,
  // mình lấy tạm từ URL/data-attr.
  const pid = resolveProjectIdFallback();
  if (pid) showTaskBoard(pid);
});

// ===================== UI: Render =====================
export function showTaskBoard(projectId) {
  if (!projectId) {
    console.error("Thiếu projectId. Truyền showTaskBoard(projectId) hoặc đặt ?projectId=...");
    return;
  }
  CURRENT_PROJECT_ID = projectId; // <-- gắn dự án đang làm

  const root = document.getElementById("taskBoard");
  if (!root) return console.error("Thiếu #taskBoard trong HTML");

  root.innerHTML = `
    <div class="w-full bg-gray-100 p-4 rounded shadow mb-4">
      <div class="flex justify-between items-center">
        <h3 class="font-bold text-lg">Lịch sử hoạt động của dự án</h3>
        <button id="refreshLogsBtn" class="bg-blue-500 text-white px-2 py-1 rounded text-xs">Làm mới</button>
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

      <div class="bg-white p-3 rounded shadow min-h-[400px]">
        <h3 class="font-bold text-yellow-600 mb-2">In Progress</h3>
        <div id="inprogressCol" class="space-y-2 mt-2 min-h-[200px] border-dashed border-2 border-yellow-200 rounded p-2"></div>
      </div>

      <div class="bg-white p-3 rounded shadow min-h-[400px]">
        <h3 class="font-bold text-green-600 mb-2">Done</h3>
        <div id="doneCol" class="space-y-2 mt-2 min-h-[200px] border-dashed border-2 border-green-200 rounded p-2"></div>
      </div>
    </div>
  `;

  document.getElementById("addGroupBtn")?.addEventListener("click", () => addGroup());
  document.getElementById("refreshLogsBtn")?.addEventListener("click", () => refreshLogs());

  setupDragDrop();
  loadGroups();             // theo CURRENT_PROJECT_ID
  watchLogsRealtime();      // logs realtime prepend
  watchTasksToast();        // toast khi task thay đổi
}

// ===================== Toast =====================
function toast(msg) {
  const id = "tiny-toast";
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement("div");
    el.id = id;
    el.className = "fixed bottom-4 right-4 bg-black text-white text-sm px-3 py-2 rounded shadow transition-opacity";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = "1";
  setTimeout(() => (el.style.opacity = "0"), 1600);
}

// ===================== Logging =====================
async function logActivity(action, targetType, targetId, description, oldValue = null, newValue = null) {
  const user = auth.currentUser;
  if (!user) return;
  if (!CURRENT_PROJECT_ID) return console.warn("logActivity: thiếu CURRENT_PROJECT_ID");
  try {
    await addDoc(collection(db, "activity_logs"), {
      projectId: CURRENT_PROJECT_ID,   // <-- dự án đang mở
      actor: user.email,
      action,
      targetType,
      targetId,
      description,
      oldValue,
      newValue,
      timestamp: serverTimestamp(),    // giờ server
      clientTsMs: Date.now(),          // hiển thị/sort ngay
    });
  } catch (e) {
    console.error("logActivity error:", e);
  }
}

function buildLogEl(id, data) {
  const p = document.createElement("p");
  p.id = `log-${id}`;
  p.className = "text-gray-600 my-1";
  const timeText = data?.timestamp?.toDate
    ? new Date(data.timestamp.toDate()).toLocaleTimeString()
    : typeof data?.clientTsMs === "number"
      ? new Date(data.clientTsMs).toLocaleTimeString() + " (đang đồng bộ)"
      : "...";
  p.innerHTML = `<span class="font-semibold text-blue-700">${data.actor || "unknown"}</span>: ${data.description || ""} <span class="text-gray-400">(${timeText})</span>`;
  return p;
}

function watchLogsRealtime() {
  const container = document.getElementById("projectLog");
  if (!container) return;
  if (!CURRENT_PROJECT_ID) return;

  if (unsubs.logs) { try { unsubs.logs(); } catch {} unsubs.logs = null; }

  const qLogs = query(
    collection(db, "activity_logs"),
    where("projectId", "==", CURRENT_PROJECT_ID),
    orderBy("clientTsMs", "desc"),
    limit(100)
  );

  const upsertOnTop = (id, data) => {
    const exist = document.getElementById(`log-${id}`);
    if (exist) return exist.replaceWith(buildLogEl(id, data));
    const node = buildLogEl(id, data);
    if (container.firstChild) container.insertBefore(node, container.firstChild);
    else container.appendChild(node);
  };

  unsubs.logs = onSnapshot(
    qLogs,
    (snap) => {
      if (!container.dataset._init) {
        container.innerHTML = "";
        const items = [];
        snap.forEach((d) => items.push({ id: d.id, data: d.data() }));
        items.forEach(({ id, data }) => upsertOnTop(id, data));
        container.dataset._init = "1";
        return;
      }
      snap.docChanges().forEach((chg) => {
        const id = chg.doc.id;
        const data = chg.doc.data();
        if (chg.type === "added" || chg.type === "modified") upsertOnTop(id, data);
        else if (chg.type === "removed") document.getElementById(`log-${id}`)?.remove();
      });
    },
    (err) => console.error("logs onSnapshot error:", err)
  );
}

async function refreshLogs() {
  if (!CURRENT_PROJECT_ID) return;
  const container = document.getElementById("projectLog");
  if (!container) return;
  const qLogs = query(
    collection(db, "activity_logs"),
    where("projectId", "==", CURRENT_PROJECT_ID),
    orderBy("clientTsMs", "desc"),
    limit(100)
  );
  const snap = await getDocs(qLogs);
  container.innerHTML = "";
  snap.forEach((d) => container.appendChild(buildLogEl(d.id, d.data())));
}

// ===================== Modal Helper =====================
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
  fieldsDiv.innerHTML = fields.map((f) =>
    f.type === "textarea"
      ? `<textarea id="${f.id}" placeholder="${f.placeholder}" class="border p-2 w-full">${f.value || ""}</textarea>`
      : `<input id="${f.id}" type="text" placeholder="${f.placeholder}" class="border p-2 w-full" value="${f.value || ""}">`
  ).join("");
  modal.classList.remove("hidden");
  document.getElementById("modalCancel").onclick = () => modal.classList.add("hidden");
  document.getElementById("modalSave").onclick = () => {
    const values = {};
    fields.forEach((f) => (values[f.id] = document.getElementById(f.id).value));
    onSave(values);
    modal.classList.add("hidden");
  };
}

// ===================== Groups =====================
function loadGroups() {
  if (!CURRENT_PROJECT_ID) return;
  // clear task listeners cũ
  for (const [gid, u] of unsubs.groupTasks.entries()) { try { u(); } catch {} unsubs.groupTasks.delete(gid); }

  const qGroups = query(collection(db, "groups"), where("projectId", "==", CURRENT_PROJECT_ID));
  onSnapshot(qGroups, (snap) => {
    const host = document.getElementById("groupContainer");
    if (!host) return;
    host.innerHTML = "";
    snap.forEach((d) => renderGroup(d));
  });
}

function renderGroup(docSnap) {
  const g = docSnap.data(); const gid = docSnap.id;
  const wrapper = document.createElement("div");
  wrapper.id = `group-${gid}`;
  wrapper.className = "border rounded p-2 bg-gray-50 shadow";
  wrapper.innerHTML = `
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
  document.getElementById("groupContainer")?.appendChild(wrapper);

  // events
  wrapper.querySelector(".add-task").addEventListener("click", () => openTaskModal(gid));
  wrapper.querySelector(".edit-group").addEventListener("click", () => editGroup(gid, g));
  wrapper.querySelector(".delete-group").addEventListener("click", () => deleteGroup(gid, g));

  // tasks realtime
  if (unsubs.groupTasks.has(gid)) { try { unsubs.groupTasks.get(gid)(); } catch {} unsubs.groupTasks.delete(gid); }
  const qTasks = query(collection(db, "tasks"), where("groupId", "==", gid));
  const unsub = onSnapshot(qTasks, (snap) => {
    snap.docChanges().forEach((chg) => {
      const tid = chg.doc.id;
      const oldEl = document.getElementById(`task-${tid}`);
      if (chg.type === "removed") return oldEl?.remove();
      if (oldEl) oldEl.remove();
      renderTask(chg.doc);
    });
  });
  unsubs.groupTasks.set(gid, unsub);
}

// ===================== Tasks =====================
function renderTask(docSnap) {
  const t = docSnap.data(); const tid = docSnap.id;
  const colId = t.status === "todo" ? `tasks-${t.groupId}` : `${t.status}Col`;
  const col = document.getElementById(colId);
  if (!col) return;

  const row = document.createElement("div");
  row.id = `task-${tid}`;
  row.className = "flex justify-between items-center bg-gray-100 px-2 py-1 rounded border text-sm cursor-move";
  const hasCmt = t.comment && String(t.comment).trim().length > 0;
  row.innerHTML = `
    <span class="truncate max-w-[200px]" title="${t.title}">${t.title}</span>
    <div class="space-x-1">
      <button class="edit-task" title="Sửa">✏️</button>
      <button class="comment-task ${hasCmt ? "text-blue-600 font-bold" : "text-gray-400"}" title="Comment">💬</button>
      <button class="delete-task text-red-600" title="Xóa">🗑️</button>
    </div>`;

  row.draggable = true;
  row.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("type", "task");
    e.dataTransfer.setData("taskId", tid);
    e.dataTransfer.setData("groupId", t.groupId);
    e.dataTransfer.setData("projectId", CURRENT_PROJECT_ID);
    e.dataTransfer.setData("status", t.status);
  });

  row.querySelector(".edit-task").addEventListener("click", () => {
    openModal("Edit Task", [{ id: "title", placeholder: "Task title", type: "text", value: t.title }], async (v) => {
      const newTitle = (v.title || "").trim();
      if (!newTitle || newTitle === t.title) return;
      await updateDoc(doc(db, "tasks", tid), {
        title: newTitle,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser.email,
      });
      logActivity("edit_task", "task", tid, `Đổi tên task từ "${t.title}" thành "${newTitle}"`, t.title, newTitle);
    });
  });

  row.querySelector(".comment-task").addEventListener("click", () => {
    openModal("Comment Task", [{ id: "comment", placeholder: "Nhập comment", type: "textarea", value: t.comment || "" }], async (v) => {
      const c = (v.comment || "").trim();
      if (c === (t.comment || "")) return;
      if (c) {
        await updateDoc(doc(db, "tasks", tid), { comment: c, updatedAt: serverTimestamp(), updatedBy: auth.currentUser.email });
        logActivity("edit_comment", "task", tid, `Cập nhật comment cho task "${t.title}"`);
      } else {
        await updateDoc(doc(db, "tasks", tid), { comment: deleteField(), updatedAt: serverTimestamp(), updatedBy: auth.currentUser.email });
        logActivity("delete_comment", "task", tid, `Xóa comment của task "${t.title}"`);
      }
    });
  });

  row.querySelector(".delete-task").addEventListener("click", async () => {
    if (!confirm("Xóa task này?")) return;
    await deleteDoc(doc(db, "tasks", tid));
    logActivity("delete_task", "task", tid, `Đã xóa task: "${t.title}"`);
  });

  document.getElementById(`task-${tid}`)?.remove();
  col.appendChild(row);
}

function openTaskModal(groupId) {
  openModal("Thêm Task", [
    { id: "title", placeholder: "Tên Task" },
    { id: "comment", placeholder: "Comment (tùy chọn)", type: "textarea" },
  ], async (v) => {
    if (!CURRENT_PROJECT_ID) return;
    const title = (v.title || "").trim();
    const comment = (v.comment || "").trim();
    if (!title) return;
    const ref = await addDoc(collection(db, "tasks"), {
      title,
      comment: comment || "",
      projectId: CURRENT_PROJECT_ID,
      groupId,
      status: "todo",
      createdAt: serverTimestamp(),
      createdBy: auth.currentUser.email,
    });
    logActivity("create_task", "task", ref.id, `Đã tạo task: "${title}"`);
  });
}

async function addGroup() {
  openModal("Thêm Group", [{ id: "title", placeholder: "Tên Group" }], async (v) => {
    if (!CURRENT_PROJECT_ID) return;
    const title = (v.title || "").trim();
    if (!title) return;
    const ref = await addDoc(collection(db, "groups"), {
      title,
      projectId: CURRENT_PROJECT_ID,
      status: "todo",
      createdAt: serverTimestamp(),
      createdBy: auth.currentUser.email,
    });
    logActivity("create_group", "group", ref.id, `Đã tạo group: "${title}"`);
  });
}

async function editGroup(groupId, g) {
  openModal("Sửa Group", [{ id: "title", placeholder: "Tên", value: g.title }], async (v) => {
    const newTitle = (v.title || "").trim();
    if (!newTitle || newTitle === g.title) return;
    await updateDoc(doc(db, "groups", groupId), {
      title: newTitle,
      updatedAt: serverTimestamp(),
      updatedBy: auth.currentUser.email,
    });
    logActivity("edit_group", "group", groupId, `Đổi tên group từ "${g.title}" thành "${newTitle}"`, g.title, newTitle);
  });
}

async function deleteGroup(groupId, g) {
  if (!confirm("Xóa group này và tất cả task bên trong?")) return;
  const snap = await getDocs(query(collection(db, "tasks"), where("groupId", "==", groupId)));
  const titles = snap.docs.map((d) => d.data().title || d.id);
  for (const d of snap.docs) await deleteDoc(doc(db, "tasks", d.id));
  await deleteDoc(doc(db, "groups", groupId));
  logActivity("delete_group", "group", groupId, `Đã xóa group: "${g.title}" và các task: ${titles.join(", ")}`);
}

// ===================== Drag & Drop =====================
function setupDragDrop() {
  ["inprogressCol", "doneCol"].forEach((id) => {
    const col = document.getElementById(id);
    if (!col) return;
    col.addEventListener("dragover", (e) => e.preventDefault());
    col.addEventListener("drop", async (e) => {
      e.preventDefault();
      if (!CURRENT_PROJECT_ID) return;
      const type = e.dataTransfer.getData("type");
      if (type !== "task") return;
      const taskId = e.dataTransfer.getData("taskId");
      const oldStatus = e.dataTransfer.getData("status");
      const newStatus = id === "inprogressCol" ? "inprogress" : "done";
      if (oldStatus === newStatus) return;
      await updateDoc(doc(db, "tasks", taskId), {
        status: newStatus,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser.email,
      });
      logActivity("move_task", "task", taskId, `Di chuyển task "${taskId}" từ "${oldStatus}" sang "${newStatus}"`, oldStatus, newStatus);
    });
  });

  // thả về To Do (bất kỳ khung tasks-{groupId})
  document.addEventListener("dragover", (e) => {
    if (e.target.closest("[data-drop-todo-for]")) e.preventDefault();
  });
  document.addEventListener("drop", async (e) => {
    const target = e.target.closest("[data-drop-todo-for]");
    if (!target) return;
    e.preventDefault();
    if (!CURRENT_PROJECT_ID) return;

    const type = e.dataTransfer.getData("type");
    if (type !== "task") return;
    const taskId = e.dataTransfer.getData("taskId");
    const oldStatus = e.dataTransfer.getData("status");
    const fromGroup = e.dataTransfer.getData("groupId");
    const toGroup = target.getAttribute("data-drop-todo-for");

    const payload = { updatedAt: serverTimestamp(), updatedBy: auth.currentUser.email };
    let moved = false;
    if (oldStatus !== "todo") { payload.status = "todo"; moved = true; }
    if (fromGroup !== toGroup) { payload.groupId = toGroup; moved = true; }
    if (!moved) return;

    await updateDoc(doc(db, "tasks", taskId), payload);
    logActivity("move_task", "task", taskId, `Di chuyển task "${taskId}" về To Do${fromGroup !== toGroup ? ` (sang group ${toGroup})` : ""}`, oldStatus, "todo");
  });
}

// ===================== Task Toast (optional) =====================
function watchTasksToast() {
  if (!CURRENT_PROJECT_ID) return;
  if (unsubs.tasksToast) { try { unsubs.tasksToast(); } catch {} unsubs.tasksToast = null; }
  const qTasks = query(collection(db, "tasks"), where("projectId", "==", CURRENT_PROJECT_ID));
  unsubs.tasksToast = onSnapshot(qTasks, (snap) => {
    snap.docChanges().forEach((chg) => {
      const t = chg.doc.data() || {};
      if (chg.type === "added") toast(`Task mới: "${t.title || chg.doc.id}"`);
      if (chg.type === "modified") toast(`Task cập nhật: "${t.title || chg.doc.id}"`);
      if (chg.type === "removed") toast(`Task đã xóa: "${t.title || chg.doc.id}"`);
    });
  });
}
