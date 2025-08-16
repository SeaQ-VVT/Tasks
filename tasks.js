// tasks.js
import {
    getFirestore, collection, addDoc, query, onSnapshot, doc, deleteDoc, updateDoc, orderBy
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

const firebaseConfig = {
  apiKey: "AIzaSyCW49METqezYoUKSC1N0Pi3J83Ptsf9hA8",
  authDomain: "task-manager-d18aa.firebaseapp.com",
  projectId: "task-manager-d18aa",
  storageBucket: "task-manager-d18aa.appspot.com",
  messagingSenderId: "1080268498085",
  appId: "1:1080268498085:web:767434c6a2c013b961d94c"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Lấy chỗ hiển thị taskBoard
const taskBoard = document.getElementById("taskBoard");

// ===== Hàm showTaskBoard =====
window.showTaskBoard = function (projectId) {
    taskBoard.innerHTML = ""; // Clear cũ

    const colRef = collection(db, "projects", projectId, "tasks");
    const q = query(colRef, orderBy("createdAt", "desc"));

    onSnapshot(q, (snapshot) => {
        taskBoard.innerHTML = `
            <h3 class="text-lg font-semibold mb-2">Danh sách công việc</h3>
            <button id="addTaskBtn" class="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-md text-sm mb-3">Thêm công việc</button>
            <div id="taskList"></div>
        `;

        const taskList = document.getElementById("taskList");
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const div = document.createElement("div");
            div.className = "p-3 border rounded mb-2 flex justify-between items-center bg-white shadow-sm";
            div.innerHTML = `
                <div>
                    <p class="font-medium">${data.title}</p>
                    <p class="text-sm text-gray-500">${data.status || "Chưa làm"}</p>
                </div>
                <div class="space-x-2">
                    <button data-id="${docSnap.id}" class="delete-task-btn bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-xs">Xóa</button>
                </div>
            `;
            taskList.appendChild(div);
        });

        // Thêm sự kiện thêm Task
        document.getElementById("addTaskBtn").onclick = async () => {
            const title = prompt("Nhập tên công việc:");
            if (!title) return;
            await addDoc(colRef, {
                title,
                status: "Chưa làm",
                createdAt: new Date(),
                createdBy: auth.currentUser ? auth.currentUser.email : "Ẩn danh"
            });
        };

        // Xóa Task
        document.querySelectorAll(".delete-task-btn").forEach((btn) => {
            btn.addEventListener("click", async (e) => {
                const id = e.target.dataset.id;
                await deleteDoc(doc(db, "projects", projectId, "tasks", id));
            });
        });
    });
};
