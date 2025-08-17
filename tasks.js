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
  getDoc,
  orderBy,
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

// ===== Init =====
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// ===== Modal helper =====
function openModal(title, fields, onSave) {
  let modal = document.getElementById("popupModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "popupModal";
    modal.className =
      "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 hidden";
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
  document.getElementById("modalCancel").onclick = () =>
    modal.classList.add("hidden");
  document.getElementById("modalSave").onclick = () => {
    const values = {};
    fields.forEach((f) => (values[f.id] = document.getElementById(f.id).value));
    onSave(values);
    modal.classList.add("hidden");
  };
}

// ===== Log helper (export) =====
export async function addProjectLog(projectId, action, section, detail) {
  await addDoc(collection(db, "projectLogs"), {
    projectId,
    action, // create | update | delete | status ...
    section, // Project | Group | Task | Comment
    detail, // nội dung thay đổi
    by: auth.currentUser?.email || "Ẩn danh",
    at: serverTimestamp()
  });
}

// ===== Show task board (export) =====
export async function showTaskBoard(projectId) {
  const taskBoard = document.getElementById("taskBoard");

  // Lấy tên dự án để hiển thị banner
  let projTitle = projectId;
  try {
    const p = await getDoc(doc(db, "projects", projectId));
    if (p.exists()) projTitle = p.data().title || projectId;
  } catch (e) {
    console.warn("get project title failed", e);
  }

  taskBoard.innerHTML = `
    <div class="mb-3 px-3 py-2 rounded bg-slate-100 border text-sm">
      Bạn đang ở dự án: <span class="font-semibold text-blue-700">${projTitle}</span>
    </div>

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

    <div class="mt-6 bg-white p-3 rounded shadow">
      <h3 class="font-bold mb-2">Lịch sử thay đổi</h3>
      <div id="logList" class="space-y-2 text-sm"></div>
    </div>
  `;

  loadGroups(projectId);
  setupGroupListeners(projectId);
  setupDragDrop();

  // Realtime log
  const qLog = query(
    collection(db, "projectLogs"),
    where("projectId", "==", projectId),
    orderBy("at", "desc")
  );
  onSnapshot(qLog, (snap) => {
    const box = document.getElementById("logList");
    box.innerHTML = "";
    snap.forEach((d) => {
      const x = d.data();
      const when = x.at?.toDate ? x.at.toDate().toLocaleString() : "-";
      const row = document.createElement("div");
      row.className = "border rounded p-2 bg-gray-50";
      row.innerHTML = `
        <div><b>${x.section}</b> • ${x.action}</div>
        <div class="text-gray-600">${x.detail || ""}</div>
        <div class="text-xs text-gray-500">${when} • ${x.by || "-"}</div>
      `;
      box.appendChild(row);
    });
  });
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

  const div = document.createElement("div");
  div.className = "border rounded p-2 bg-gray-50 shadow";
  div.id = `group-${gid}`;

  div.innerHTML = `
    <div class="flex justify-between items-center">
      <span class="font-semibold text-blue-700">${g.title}</span>
      <div class="space-x-1">
        <button class="edit-group text-yellow-600">✏️</button>
        <button class="delete-group text-red-600">🗑️</button>
      </div>
    </div>
    <button class="add-task text-green-600 text-xs mt-1">+ Task</button>
    <div id="tasks-${gid}" class="space-y-1 mt-2"></div>
  `;

  document.getElementById("groupContainer").appendChild(div);

  loadTasks(gid);

  div.querySelector(".add-task").addEventListener("click", () =>
    openTaskModal(gid, g.projectId)
  );
  div.querySelector(".edit-group").addEventListener("click", () =>
    editGroup(gid, g)
  );
  div.querySelector(".delete-group").addEventListener("click", () =>
    deleteGroup(gid, g)
  );
}

// ===== Load tasks realtime =====
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

  const colId = t.status === "todo" ? `tasks-${t.groupId}` : `${t.status}Col`;
  const col = document.getElementById(colId);
  if (!col) return;

  // Xóa bản cũ
  const old = document.getElementById(`task-${tid}`);
  if (old) old.remove();

  const hasComment = t.comment && String(t.comment).trim().length > 0;

  const row = document.createElement("div");
  row.id = `task-${tid}`;
  row.className =
    "flex justify-between items-center bg-gray-100 px-2 py-1 rounded border text-sm cursor-move";
  row.draggable = true;

  row.innerHTML = `
    <span class="truncate">${t.title}</span>
    <div class="space-x-1">
      <button class="edit-task">✏️</button>
      <button class="comment-task ${hasComment ? "text-blue-600 font-bold" : "text-gray-400"}">💬</button>
      <button class="delete-task">🗑️</button>
    </div>
  `;

  // drag event
  row.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("type", "task");
    e.dataTransfer.setData("taskId", tid);
    e.dataTransfer.setData("groupId", t.groupId);
    e.dataTransfer.setData("projectId", t.projectId); // để log khi drop
  });

  // edit task title
  row.querySelector(".edit-task").addEventListener("click", () => {
    openModal(
      "Edit Task",
      [{ id: "title", placeholder: "Task title", type: "text", value: t.title }],
      async (vals) => {
        await updateDoc(doc(db, "tasks", tid), {
          title: vals.title,
          updatedAt: serverTimestamp(),
          updatedBy: auth.currentUser?.email || "Ẩn danh"
        });
        if (vals.title !== t.title) {
          await addProjectLog(
            t.projectId,
            "update",
            "Task",
            `Đổi tiêu đề task #${tid}: "${t.title}" → "${vals.title}"`
          );
        }
      }
    );
  });

  // comment task
  row.querySelector(".comment-task").addEventListener("click", () => {
    openModal(
      "Comment Task",
      [
        {
          id: "comment",
          placeholder: "Nhập comment",
          type: "textarea",
          value: t.comment || ""
        }
      ],
      async (vals) => {
        const newCmt = (vals.comment || "").trim();
        if (newCmt.length > 0) {
          await updateDoc(doc(db, "tasks", tid), {
            comment: newCmt,
            updatedAt: serverTimestamp(),
            updatedBy: auth.currentUser?.email || "Ẩn danh"
          });
          await addProjectLog(
            t.projectId,
            "update",
            "Comment",
            `Cập nhật comment cho task #${tid}`
          );
        } else {
          await updateDoc(doc(db, "tasks", tid), {
            comment: deleteField(),
            updatedAt: serverTimestamp(),
            updatedBy: auth.currentUser?.email || "Ẩn danh"
          });
          await addProjectLog(
            t.projectId,
            "delete",
            "Comment",
            `Xóa comment của task #${tid}`
          );
        }
      }
    );
  });

  // delete task
  row.querySelector(".delete-task").addEventListener("click", async () => {
    if (confirm("Xóa task này?")) {
      await deleteDoc(doc(db, "tasks", tid));
      await addProjectLog(
        t.projectId,
        "delete",
        "Task",
        `Xóa task "${t.title}" (#${tid})`
      );
    }
  });

  col.appendChild(row);
}

// ===== Group actions =====
async function addGroup(projectId) {
  openModal("Thêm Group", [{ id: "title", placeholder: "Tên Group" }], async (vals) => {
    const ref = await addDoc(collection(db, "groups"), {
      title: vals.title,
      projectId,
      status: "todo",
      createdAt: serverTimestamp(),
      createdBy: auth.currentUser?.email || "Ẩn danh"
    });
    await addProjectLog(
      projectId,
      "create",
      "Group",
      `Tạo group "${vals.title}" (#${ref.id})`
    );
  });
}

async function editGroup(groupId, g) {
  openModal(
    "Sửa Group",
    [{ id: "title", placeholder: "Tên", value: g.title }],
    async (vals) => {
      await updateDoc(doc(db, "groups", groupId), {
        title: vals.title,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.email || "Ẩn danh"
      });
      if (vals.title !== g.title) {
        await addProjectLog(
          g.projectId,
          "update",
          "Group",
          `Đổi tên group "${g.title}" → "${vals.title}"`
        );
      }
    }
  );
}

async function deleteGroup(groupId, g) {
  if (!confirm("Xóa group này và tất cả task bên trong?")) return;

  const taskSnap = await getDocs(
    query(collection(db, "tasks"), where("groupId", "==", groupId))
  );
  taskSnap.forEach(async (t) => await deleteDoc(doc(db, "tasks", t.id)));

  await deleteDoc(doc(db, "groups", groupId));
  await addProjectLog(g.projectId, "delete", "Group", `Xóa group "${g.title}" (#${groupId})`);
}

// ===== Task actions =====
function openTaskModal(groupId, projectId) {
  openModal(
    "Thêm Task",
    [
      { id: "title", placeholder: "Tên Task" },
      { id: "comment", placeholder: "Comment (tùy chọn)", type: "textarea" }
    ],
    async (vals) => {
      const ref = await addDoc(collection(db, "tasks"), {
        title: vals.title,
        comment: vals.comment || "",
        projectId,
        groupId,
        status: "todo",
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser?.email || "Ẩn danh"
      });
      await addProjectLog(
        projectId,
        "create",
        "Task",
        `Tạo task "${vals.title}" (#${ref.id}) trong group #${groupId}`
      );
    }
  );
}

// ===== Listeners =====
function setupGroupListeners(projectId) {
  document
    .getElementById("addGroupBtn")
    .addEventListener("click", () => addGroup(projectId));
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
      const projectId = e.dataTransfer.getData("projectId");
      if (!taskId) return;

      const newStatus = colId === "inprogressCol" ? "inprogress" : "done";

      await updateDoc(doc(db, "tasks", taskId), {
        status: newStatus,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.email || "Ẩn danh"
      });

      await addProjectLog(
        projectId || "",
        "status",
        "Task",
        `Đổi trạng thái task #${taskId} → ${newStatus.toUpperCase()}`
      );
    });
  });
}
