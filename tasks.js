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
    serverTimestamp
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

// ===== Show task board =====
export function showTaskBoard(projectId) {
    const taskBoard = document.getElementById("taskBoard");

    taskBoard.innerHTML = `
        <div class="grid grid-cols-3 gap-4">
            <!-- To Do -->
            <div class="bg-white p-4 rounded shadow">
                <h3 class="font-bold text-lg text-red-600 mb-2">To Do</h3>
                <button id="addTodoBtn" class="bg-blue-500 text-white px-3 py-1 rounded text-sm">+ Thêm Group</button>
                <div id="todoCol" class="space-y-2 mt-2"></div>
            </div>

            <!-- In Progress -->
            <div class="bg-white p-4 rounded shadow">
                <h3 class="font-bold text-lg text-yellow-600 mb-2">In Progress</h3>
                <div id="inprogressCol" class="space-y-2 mt-2"></div>
            </div>

            <!-- Done -->
            <div class="bg-white p-4 rounded shadow">
                <h3 class="font-bold text-lg text-green-600 mb-2">Done</h3>
                <div id="doneCol" class="space-y-2 mt-2"></div>
            </div>
        </div>
    `;

    // Thêm group mới (chỉ To Do)
    document.getElementById("addTodoBtn").addEventListener("click", async () => {
        const title = prompt("Tên group:");
        if (!title) return;

        await addDoc(collection(db, "groups"), {
            title,
            status: "todo",
            projectId,
            createdAt: serverTimestamp(),
            createdBy: auth.currentUser ? auth.currentUser.email : "Ẩn danh"
        });
    });

    loadGroups(projectId);
}

// ===== Load groups realtime =====
function loadGroups(projectId) {
    const groupsCol = collection(db, "groups");
    const q = query(groupsCol, where("projectId", "==", projectId));

    onSnapshot(q, (snapshot) => {
        document.getElementById("todoCol").innerHTML = "";
        document.getElementById("inprogressCol").innerHTML = "";
        document.getElementById("doneCol").innerHTML = "";

        snapshot.forEach((docSnap) => {
            renderGroup(docSnap);
        });
    });
}

// ===== Render group panel =====
function renderGroup(docSnap) {
    const data = docSnap.data();
    const id = docSnap.id;

    const groupDiv = document.createElement("div");
    groupDiv.className = "p-4 border rounded bg-gray-50 shadow-sm";

    groupDiv.innerHTML = `
        <div class="flex justify-between items-center mb-2">
            <p class="font-semibold">${data.title}</p>
            <div class="space-x-2">
                <button data-id="${id}" class="edit-group bg-yellow-500 text-white px-2 py-1 rounded text-xs">Sửa</button>
                <button data-id="${id}" class="delete-group bg-red-500 text-white px-2 py-1 rounded text-xs">Xóa</button>
            </div>
        </div>
        <div id="files-${id}" class="flex flex-wrap gap-2 mb-2"></div>
        <button data-id="${id}" class="add-file bg-blue-500 text-white px-2 py-1 rounded text-xs">+ Tệp</button>
    `;

    document.getElementById(`${data.status}Col`).appendChild(groupDiv);

    // Load files realtime
    const filesCol = collection(db, "groups", id, "files");
    onSnapshot(filesCol, (snapshot) => {
        const container = document.getElementById(`files-${id}`);
        container.innerHTML = "";
        snapshot.forEach(fileDoc => {
            const fileData = fileDoc.data();
            const span = document.createElement("span");
            span.className = "bg-gray-200 px-2 py-1 rounded text-xs";
            span.textContent = fileData.title;
            container.appendChild(span);
        });
    });

    // Add file
    groupDiv.querySelector(".add-file").addEventListener("click", async () => {
        const fTitle = prompt("Tên tệp:");
        if (!fTitle) return;
        await addDoc(collection(db, "groups", id, "files"), {
            title: fTitle,
            createdAt: serverTimestamp(),
            createdBy: auth.currentUser ? auth.currentUser.email : "Ẩn danh"
        });
    });

    // Edit group
    groupDiv.querySelector(".edit-group").addEventListener("click", async () => {
        const newTitle = prompt("Tên mới cho group:", data.title);
        if (!newTitle) return;
        await updateDoc(doc(db, "groups", id), { title: newTitle });
    });

    // Delete group
    groupDiv.querySelector(".delete-group").addEventListener("click", async () => {
        if (confirm("Xóa group này?")) {
            await deleteDoc(doc(db, "groups", id));
        }
    });
}
