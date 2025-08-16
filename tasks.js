// ================= Firebase =================
import {
  getFirestore, collection, addDoc, query, where, onSnapshot,
  doc, deleteDoc, updateDoc, serverTimestamp, getDocs,
  deleteField, orderBy, limit
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

const app = initializeApp({
  apiKey: "AIzaSyCW49METqezYoUKSC1N0Pi3J83Ptsf9hA8",
  authDomain: "task-manager-d18aa.firebaseapp.com",
  projectId: "task-manager-d18aa",
  storageBucket: "task-manager-d18aa.appspot.com",
  messagingSenderId: "1080268498085",
  appId: "1:1080268498085:web:767434c6a2c013b961d94c",
});
const db = getFirestore(app);
const auth = getAuth(app);

// ============== State (KHÔNG hardcode) ==============
let CURRENT_PROJECT_ID = null;
const unsubs = {
  logs: null,
  tasksToast: null,
  groups: null,
  groupTasks: new Map(), // groupId -> unsub
};

// ============== Auth ==============
onAuthStateChanged(auth, (user) => {
  if (!user) return console.log("Chưa đăng nhập");
  // bạn tự gọi openProject(pid) khi bấm “Xem công việc”
});

// ============== API: Chọn dự án ==============
export function openProject(projectId) {
  if (!projectId) return;
  // Hủy mọi listener cũ
  cleanupListeners();

  CURRENT_PROJECT_ID = projectId;
  renderBoard();          // chỉ render UI
  mountForCurrentProject(); // gắn realtime đúng dự án đang chọn
}

function cleanupListeners() {
  if (unsubs.logs) { try { unsubs.logs(); } catch {} unsubs.logs = null; }
  if (unsubs.tasksToast) { try { unsubs.tasksToast(); } catch {} unsubs.tasksToast = null; }
  if (unsubs.groups) { try { unsubs.groups(); } catch {} unsubs.groups = null; }
  for (const [gid, u] of unsubs.groupTasks.entries()) { try { u(); } catch {} }
  unsubs.groupTasks.clear();
}

// ============== UI ==============
function renderBoard() {
  const root = document.getElementById("taskBoard");
  if (!root) return console.error("Thiếu #taskBoard");
  root.innerHTML = `
    <div class="w-full bg-gray-100 p-4 rounded shadow mb-4">
      <div class="flex justify-between items-center">
        <h3 class="font-bold text-lg">Lịch sử hoạt động</h3>
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
}

function mountForCurrentProject() {
  if (!CURRENT_PROJECT_ID) return;

  // Groups + tasks (realtime)
  const qGroups = query(collection(db, "groups"), where("projectId", "==", CURRENT_PROJECT_ID));
  unsubs.groups = onSnapshot(qGroups, (snap) => {
    const host = document.getElementById("groupContainer");
    if (!host) return;
    host.innerHTML = "";
    snap.forEach((d) => renderGroup(d));
  });

  // Logs (realtime, prepend)
  watchLogsRealtime();

  // Toast thay đổi task (tùy thích)
  watchTasksToast();
}

// ============== Log ghi đúng dự án đang chọn ==============
async function logActivity(action, targetType, targetId, description, oldValue = null, newValue = null) {
  const user = auth.currentUser;
  if (!user || !CURRENT_PROJECT_ID) return;
  await addDoc(collection(db, "activity_logs"), {
    projectId: CURRENT_PROJECT_ID, // ← dự án hiện tại
    actor: user.email,
    action, targetType, targetId, description, oldValue, newValue,
    timestamp: serverTimestamp(),
    clientTsMs: Date.now(),
  });
}

function buildLogEl(id, data) {
  const p = document.createElement("p");
  p.id = `log-${id}`;
  p.className = "text-gray-600 my-1";
  const t = data?.timestamp?.toDate
    ? new Date(data.timestamp.toDate())
    : (typeof data?.clientTsMs === "number" ? new Date(data.clientTsMs) : null);
  p.innerHTML = `<span class="font-semibold text-blue-700">${data.actor || "unknown"}</span>: ${data.description || ""} <span class="text-gray-400">(${t ? t.toLocaleTimeString() : "..."})</span>`;
  return p;
}

function watchLogsRealtime() {
  const box = document.getElementById("projectLog");
  if (!box) return;

  if (unsubs.logs) { try { unsubs.logs(); } catch {} unsubs.logs = null; }

  const qLogs = query(
    collection(db, "activity_logs"),
    where("projectId", "==", CURRENT_PROJECT_ID),
    orderBy("clientTsMs", "desc"),
    limit(100)
  );

  const prepend = (id, d) => {
    const old = document.getElementById(`log-${id}`);
    const node = buildLogEl(id, d);
    if (old) return old.replaceWith(node);
    if (box.firstChild) box.insertBefore(node, box.firstChild);
    else box.appendChild(node);
  };

  unsubs.logs = onSnapshot(qLogs, (snap) => {
    if (!box.dataset.init) {
      box.innerHTML = "";
      const items = [];
      snap.forEach((doc) => items.push({ id: doc.id, data: doc.data() }));
      if (!items.length) box.innerHTML = `<p class="text-gray-400 italic">Chưa có log nào cho dự án này.</p>`;
      items.forEach(({ id, data }) => prepend(id, data));
      box.dataset.init = "1";
      return;
    }
    snap.docChanges().forEach((chg) => {
      const id = chg.doc.id, d = chg.doc.data();
      if (chg.type === "added" || chg.type === "modified") prepend(id, d);
      else if (chg.type === "removed") document.getElementById(`log-${id}`)?.remove();
    });
  }, (err) => console.error("logs error:", err));
}

async function refreshLogs() {
  const box = document.getElementById("projectLog");
  if (!box || !CURRENT_PROJECT_ID) return;
  const qLogs = query(
    collection(db, "activity_logs"),
    where("projectId", "==", CURRENT_PROJECT_ID),
    orderBy("clientTsMs", "desc"),
    limit(100)
  );
  const snap = await getDocs(qLogs);
  box.innerHTML = "";
  snap.forEach((d) => box.appendChild(buildLogEl(d.id, d.data())));
}

// ============== Groups/Tasks ==============
function renderGroup(docSnap) {
  const g = docSnap.data(); const gid = docSnap.id;
  const el = document.createElement("div");
  el.className = "border rounded p-2 bg-gray-50 shadow";
  el.id = `group-${gid}`;
  el.innerHTML = `
    <div class="flex justify-between items-center">
      <span class="font-semibold text-blue-700">${g.title}</span>
      <div class="space-x-1">
        <button class="edit-group text-yellow-600">✏️</button>
        <button class="delete-group text-red-600">🗑️</button>
      </div>
    </div>
    <button class="add-task text-green-600 text-xs mt-1">+ Task</button>
    <div id="tasks-${gid}" class="space-y-1 mt-2 min-h-[40px] border-dashed border border-gray-200 rounded p-1" data-drop-todo-for="${gid}"></div>
  `;
  document.getElementById("groupContainer")?.appendChild(el);

  el.querySelector(".add-task").addEventListener("click", () => openTaskModal(gid));
  el.querySelector(".edit-group").addEventListener("click", () => editGroup(gid, g));
  el.querySelector(".delete-group").addEventListener("click", () => deleteGroup(gid, g));

  // tasks realtime theo group
  if (unsubs.groupTasks.has(gid)) { try { unsubs.groupTasks.get(gid)(); } catch {} unsubs.groupTasks.delete(gid); }
  const qTasks = query(collection(db, "tasks"), where("groupId", "==", gid));
  const unsub = onSnapshot(qTasks, (snap) => {
    snap.docChanges().forEach((chg) => {
      const tid = chg.doc.id;
      const old = document.getElementById(`task-${tid}`);
      if (chg.type === "removed") return old?.remove();
      if (old) old.remove();
      renderTask(chg.doc);
    });
  });
  unsubs.groupTasks.set(gid, unsub);
}

function renderTask(docSnap) {
  const t = docSnap.data(); const tid = docSnap.id;
  const colId = t.status === "todo" ? `tasks-${t.groupId}` : `${t.status}Col`;
  const col = document.getElementById(colId);
  if (!col) return;

  const hasCmt = t.comment && String(t.comment).trim().length > 0;
  const row = document.createElement("div");
  row.id = `task-${tid}`;
  row.className = "flex justify-between items-center bg-gray-100 px-2 py-1 rounded border text-sm cursor-move";
  row.innerHTML = `
    <span class="truncate max-w-[200px]" title="${t.title}">${t.title}</span>
    <div class="space-x-1">
      <button class="edit-task">✏️</button>
      <button class="comment-task ${hasCmt ? "text-blue-600 font-bold" : "text-gray-400"}">💬</button>
      <button class="delete-task text-red-600">🗑️</button>
    </div>
  `;

  row.draggable = true;
  row.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("type", "task");
    e.dataTransfer.setData("taskId", tid);
    e.dataTransfer.setData("groupId", t.groupId);
    e.dataTransfer.setData("status", t.status);
  });

  row.querySelector(".edit-task").addEventListener("click", async () => {
    const newTitle = prompt("Tên mới", t.title)?.trim();
    if (!newTitle || newTitle === t.title) return;
    await updateDoc(doc(db, "tasks", tid), {
      title: newTitle,
      updatedAt: serverTimestamp(),
      updatedBy: auth.currentUser.email,
    });
    logActivity("edit_task", "task", tid, `Đổi tên task từ "${t.title}" thành "${newTitle}"`, t.title, newTitle);
  });

  row.querySelector(".comment-task").addEventListener("click", async () => {
    const newComment = prompt("Comment", t.comment || "")?.trim() ?? "";
    if (newComment === (t.comment || "")) return;
    if (newComment) {
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
  });

  row.querySelector(".delete-task").addEventListener("click", async () => {
    if (!confirm("Xóa task này?")) return;
    await deleteDoc(doc(db, "tasks", tid));
    logActivity("delete_task", "task", tid, `Đã xóa task: "${t.title}"`);
  });

  document.getElementById(`task-${tid}`)?.remove();
  col.appendChild(row);
}

// ============== CRUD Groups ==============
async function addGroup() {
  if (!CURRENT_PROJECT_ID) return;
  const title = prompt("Tên Group")?.trim();
  if (!title) return;
  const ref = await addDoc(collection(db, "groups"), {
    title, projectId: CURRENT_PROJECT_ID, status: "todo",
    createdAt: serverTimestamp(), createdBy: auth.currentUser.email,
  });
  logActivity("create_group", "group", ref.id, `Đã tạo group: "${title}"`);
}

async function editGroup(groupId, g) {
  const newTitle = prompt("Tên mới", g.title)?.trim();
  if (!newTitle || newTitle === g.title) return;
  await updateDoc(doc(db, "groups", groupId), {
    title: newTitle, updatedAt: serverTimestamp(), updatedBy: auth.currentUser.email,
  });
  logActivity("edit_group", "group", groupId, `Đổi tên group từ "${g.title}" thành "${newTitle}"`, g.title, newTitle);
}

async function deleteGroup(groupId, g) {
  if (!confirm("Xóa group này và tất cả task bên trong?")) return;
  const snap = await getDocs(query(collection(db, "tasks"), where("groupId", "==", groupId)));
  for (const d of snap.docs) await deleteDoc(doc(db, "tasks", d.id));
  await deleteDoc(doc(db, "groups", groupId));
  logActivity("delete_group", "group", groupId, `Đã xóa group: "${g.title}"`);
}

// ============== Drag & Drop ==============
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
        status: newStatus, updatedAt: serverTimestamp(), updatedBy: auth.currentUser.email,
      });
      logActivity("move_task", "task", taskId, `Di chuyển task "${taskId}" từ "${oldStatus}" sang "${newStatus}"`, oldStatus, newStatus);
    });
  });

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

// ============== Toast thay đổi task (tùy chọn) ==============
function watchTasksToast() {
  if (unsubs.tasksToast) { try { unsubs.tasksToast(); } catch {} unsubs.tasksToast = null; }
  const qTasks = query(collection(db, "tasks"), where("projectId", "==", CURRENT_PROJECT_ID));
  unsubs.tasksToast = onSnapshot(qTasks, (snap) => {
    snap.docChanges().forEach((chg) => {
      const t = chg.doc.data() || {};
      const msg = chg.type === "added" ? `Task mới: "${t.title || chg.doc.id}"`
        : chg.type === "modified" ? `Task cập nhật: "${t.title || chg.doc.id}"`
        : `Task đã xóa: "${t.title || chg.doc.id}"`;
      tinyToast(msg);
    });
  });
}
function tinyToast(text) {
  const id = "tiny-toast";
  let div = document.getElementById(id);
  if (!div) {
    div = document.createElement("div");
    div.id = id;
    div.className = "fixed bottom-4 right-4 bg-black text-white text-sm px-3 py-2 rounded shadow transition-opacity";
    document.body.appendChild(div);
  }
  div.style.opacity = "1";
  div.textContent = text;
  setTimeout(() => div.style.opacity = "0", 1500);
}
