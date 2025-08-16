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
  orderBy,
  limit,
  deleteField,
  getDoc
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

// ===== Init =====
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// ===== Utils =====
const me = () => auth.currentUser?.email || "Ẩn danh";

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstChild;
}

function showToast(text) {
  const box = el(`<div class="fixed top-4 right-4 bg-black text-white text-sm px-3 py-2 rounded shadow z-[9999] opacity-90">${text}</div>`);
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 3000);
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
      </div>`;
    document.body.appendChild(modal);
  }

  document.getElementById("modalTitle").textContent = title;
  const fieldsDiv = document.getElementById("modalFields");
  fieldsDiv.innerHTML = "";
  fields.forEach(f => {
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
    fields.forEach(f => values[f.id] = document.getElementById(f.id).value);
    onSave(values);
    modal.classList.add("hidden");
  };
}

// ===== Activity / Log =====
async function logActivity({ projectId, actor, action, entity, entityId, message, extra = {} }) {
  await addDoc(collection(db, "activity"), {
    projectId,
    actor,
    action,      // create | update | delete | move | comment
    entity,      // task | group | project
    entityId,
    message,     // text hiển thị
    at: serverTimestamp(),
    ...extra
  });
}

function loadActivity(projectId) {
  const feed = document.getElementById("activityFeed");
  const qAct = query(
    collection(db, "activity"),
    where("projectId", "==", projectId),
    orderBy("at", "desc"),
    limit(50)
  );

  // Render feed
  onSnapshot(qAct, (snap) => {
    feed.innerHTML = "";
    snap.forEach((d) => {
      const a = d.data();
      const row = el(`
        <div class="flex items-start gap-2">
          <div class="shrink-0 mt-1">📝</div>
          <div class="flex-1">
            <div class="text-gray-800">${a.message || ""}</div>
            <div class="text-xs text-gray-500">by <span class="font-medium">${a.actor || "Ẩn danh"}</span></div>
          </div>
        </div>`);
      feed.appendChild(row);
    });
  });

  // Thông báo realtime cho thiết bị khác
  onSnapshot(qAct, (snap) => {
    snap.docChanges().forEach((c) => {
      if (c.type === "added") {
        const a = c.doc.data();
        if ((auth.currentUser?.email || "Ẩn danh") !== (a.actor || "Ẩn danh")) {
          showToast(a.message || "Có cập nhật mới");
        }
      }
    });
  });
}

async function clearActivity(projectId) {
  const qAct = query(collection(db, "activity"), where("projectId", "==", projectId));
  const ss = await getDocs(qAct);
  for (const d of ss.docs) await deleteDoc(doc(db, "activity", d.id));
}

// ===== Show task board =====
export function showTaskBoard(projectId) {
  const taskBoard = document.getElementById("taskBoard");

  taskBoard.innerHTML = `
    <!-- Activity / Log -->
    <div class="bg-white p-3 rounded shadow w-full mb-4">
      <div class="flex items-center justify-between">
        <h3 class="font-bold text-gray-700">Activity</h3>
        <button id="clearLogBtn" class="text-xs px-2 py-1 rounded bg-gray-100">Clear (dev)</button>
      </div>
      <div id="activityFeed" class="mt-2 max-h-64 overflow-auto space-y-2 text-sm"></div>
    </div>

    <!-- 3 cột -->
    <div class="grid grid-cols-3 gap-4 w-full">
      <div class="bg-white p-3 rounded shadow min-h-[400px]" id="todoArea">
        <h3 class="font-bold text-red-600 mb-2">To Do</h3>
        <button id="addGroupBtn" class="bg-blue-500 text-white px-2 py-1 rounded text-xs">+ Group</button>
        <div id="groupContainer" class="space-y-3 mt-2"></div>
      </div>
      <div class="bg-white p-3 rounded shadow min-h-[400px]" id="inprogressArea">
        <h3 class="font-bold text-yellow-600 mb-2">In Progress</h3>
        <div id="inprogressCol" class="space-y-2 mt-2 min-h-[200px]"></div>
      </div>
      <div class="bg-white p-3 rounded shadow min-h-[400px]" id="doneArea">
        <h3 class="font-bold text-green-600 mb-2">Done</h3>
        <div id="doneCol" class="space-y-2 mt-2 min-h-[200px]"></div>
      </div>
    </div>
  `;

  // Load phần dữ liệu
  loadActivity(projectId);
  document.getElementById("clearLogBtn").onclick = () => clearActivity(projectId);

  loadGroups(projectId);
  setupGroupListeners(projectId);
  setupDragDrop();
}

// ===== Load Groups realtime =====
function loadGroups(projectId) {
  const groupsCol = collection(db, "groups");
  const qg = query(groupsCol, where("projectId", "==", projectId));

  onSnapshot(qg, (snapshot) => {
    const groupContainer = document.getElementById("groupContainer");
    groupContainer.innerHTML = "";
    snapshot.forEach((docSnap) => renderGroup(docSnap));
  });
}

// ===== Render Group =====
function renderGroup(docSnap) {
  const g = docSnap.data();
  const gid = docSnap.id;

  const div = el(`<div class="border rounded p-2 bg-gray-50 shadow" id="group-${gid}">
    <div class="flex justify-between items-center">
      <span class="font-semibold text-blue-700">${g.title}</span>
      <div class="space-x-1">
        <button class="edit-group text-yellow-600">✏️</button>
        <button class="delete-group text-red-600">🗑️</button>
      </div>
    </div>
    <button class="add-task text-green-600 text-xs mt-1">+ Task</button>
    <div id="tasks-${gid}" class="space-y-1 mt-2"></div>
  </div>`);

  document.getElementById("groupContainer").appendChild(div);

  loadTasks(gid);

  div.querySelector(".add-task").addEventListener("click", () => openTaskModal(gid, g.projectId));
  div.querySelector(".edit-group").addEventListener("click", () => editGroup(gid, g));
  div.querySelector(".delete-group").addEventListener("click", () => deleteGroup(gid, g));
}

// ===== Load tasks realtime (tối ưu thay đổi) =====
function loadTasks(groupId) {
  const tasksCol = collection(db, "tasks");
  const qt = query(tasksCol, where("groupId", "==", groupId));

  onSnapshot(qt, (snapshot) => {
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
}

// ===== Render task row =====
function renderTask(docSnap) {
  const t = docSnap.data();
  const tid = docSnap.id;

  let colId = t.status === "todo" ? `tasks-${t.groupId}` : `${t.status}Col`;
  const col = document.getElementById(colId);
  if (!col) return;

  const old = document.getElementById(`task-${tid}`);
  if (old) old.remove();

  const hasComment = (t.comment && String(t.comment).trim().length > 0);

  const row = el(`<div id="task-${tid}" class="flex justify-between items-center bg-gray-100 px-2 py-1 rounded border text-sm cursor-move">
    <span class="truncate">${t.title}</span>
    <div class="space-x-1">
      <button class="edit-task">✏️</button>
      <button class="comment-task ${hasComment ? 'text-blue-600 font-bold' : 'text-gray-400'}">💬</button>
      <button class="delete-task">🗑️</button>
    </div>
  </div>`);

  // drag meta
  row.draggable = true;
  row.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("type", "task");
    e.dataTransfer.setData("taskId", tid);
    e.dataTransfer.setData("groupId", t.groupId);
    e.dataTransfer.setData("projectId", t.projectId || "");
  });

  // edit task
  row.querySelector(".edit-task").addEventListener("click", () => {
    openModal("Edit Task", [
      { id: "title", placeholder: "Task title", type: "text", value: t.title }
    ], async (vals) => {
      const oldTitle = t.title;
      await updateDoc(doc(db, "tasks", tid), {
        title: vals.title,
        updatedAt: serverTimestamp(),
        updatedBy: me()
      });
      await logActivity({
        projectId: t.projectId,
        actor: me(),
        action: "update",
        entity: "task",
        entityId: tid,
        message: `Đổi tiêu đề task **${oldTitle}** → **${vals.title}**`
      });
    });
  });

  // comment task
  row.querySelector(".comment-task").addEventListener("click", () => {
    openModal("Comment Task", [
      { id: "comment", placeholder: "Nhập comment", type: "textarea", value: t.comment || "" }
    ], async (vals) => {
      if (vals.comment && vals.comment.trim().length > 0) {
        await updateDoc(doc(db, "tasks", tid), {
          comment: vals.comment.trim(),
          updatedAt: serverTimestamp(),
          updatedBy: me()
        });
        await logActivity({
          projectId: t.projectId,
          actor: me(),
          action: "comment",
          entity: "task",
          entityId: tid,
          message: `Comment task **${t.title}**: “${vals.comment.trim()}”`
        });
      } else {
        await updateDoc(doc(db, "tasks", tid), {
          comment: deleteField(),
          updatedAt: serverTimestamp(),
          updatedBy: me()
        });
        await logActivity({
          projectId: t.projectId,
          actor: me(),
          action: "comment",
          entity: "task",
          entityId: tid,
          message: `Xoá comment của task **${t.title}**`
        });
      }
    });
  });

  // delete task
  row.querySelector(".delete-task").addEventListener("click", async () => {
    if (confirm("Xóa task này?")) {
      await deleteDoc(doc(db, "tasks", tid));
      await logActivity({
        projectId: t.projectId,
        actor: me(),
        action: "delete",
        entity: "task",
        entityId: tid,
        message: `Xoá task **${t.title}**`
      });
    }
  });

  col.appendChild(row);
}

// ===== Group actions =====
async function addGroup(projectId) {
  openModal("Thêm Group", [{ id: "title", placeholder: "Tên Group" }], async (vals) => {
    const ref = await addDoc(collection(db, "groups"), {
      title: vals.title, projectId, status: "todo",
      createdAt: serverTimestamp(), createdBy: me()
    });
    await logActivity({
      projectId,
      actor: me(),
      action: "create",
      entity: "group",
      entityId: ref.id,
      message: `Tạo group **${vals.title}**`
    });
  });
}

async function editGroup(groupId, g) {
  openModal("Sửa Group", [{ id: "title", placeholder: "Tên", value: g.title }], async (vals) => {
    await updateDoc(doc(db, "groups", groupId), {
      title: vals.title, updatedAt: serverTimestamp(),
      updatedBy: me()
    });
    await logActivity({
      projectId: g.projectId,
      actor: me(),
      action: "update",
      entity: "group",
      entityId: groupId,
      message: `Đổi tên group **${g.title}** → **${vals.title}**`
    });
  });
}

async function deleteGroup(groupId, g) {
  if (!confirm("Xóa group này và tất cả task bên trong?")) return;

  const taskSnap = await getDocs(query(collection(db, "tasks"), where("groupId", "==", groupId)));
  taskSnap.forEach(async (t) => await deleteDoc(doc(db, "tasks", t.id)));

  await deleteDoc(doc(db, "groups", groupId));
  await logActivity({
    projectId: g.projectId,
    actor: me(),
    action: "delete",
    entity: "group",
    entityId: groupId,
    message: `Xoá group **${g.title}** cùng các task`
  });
}

// ===== Task actions =====
function openTaskModal(groupId, projectId) {
  openModal("Thêm Task", [
    { id: "title", placeholder: "Tên Task" },
    { id: "comment", placeholder: "Comment (tùy chọn)", type: "textarea" }
  ], async (vals) => {
    const ref = await addDoc(collection(db, "tasks"), {
      title: vals.title, comment: vals.comment || "",
      projectId, groupId, status: "todo",
      createdAt: serverTimestamp(), createdBy: me()
    });
    await logActivity({
      projectId,
      actor: me(),
      action: "create",
      entity: "task",
      entityId: ref.id,
      message: `Tạo task **${vals.title}** trong group`
    });
  });
}

// ===== Listeners =====
function setupGroupListeners(projectId) {
  document.getElementById("addGroupBtn").addEventListener("click", () => addGroup(projectId));
}

// ===== Drag & Drop =====
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

      await updateDoc(doc(db, "tasks", taskId), {
        status: newStatus,
        updatedAt: serverTimestamp(),
        updatedBy: me()
      });

      // Lấy projectId để log
      let projectId = e.dataTransfer.getData("projectId");
      if (!projectId) {
        // fallback: đọc task
        const snap = await getDoc(doc(db, "tasks", taskId));
        projectId = snap.data()?.projectId || "";
      }
      await logActivity({
        projectId,
        actor: me(),
        action: "move",
        entity: "task",
        entityId: taskId,
        message: `Chuyển trạng thái task #${taskId.slice(0,6)} → **${newStatus.toUpperCase()}**`
      });
    });
  });
}
