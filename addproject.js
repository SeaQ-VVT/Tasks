// ===== Firebase SDKs =====
import {
  getFirestore,
  collection,
  query,
  onSnapshot,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  orderBy,
  where,
  getDocs,
  getDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { getAuth, signInWithCustomToken, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

// Giả định file tasks.js tồn tại và có hàm này
// Assumption: tasks.js exists and has this function
import { showTaskBoard } from "./tasks.js"; 

// ===== Firebase config and Init Firebase =====
const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ===== DOM elements =====
const projectArea = document.getElementById("projectArea");
const addProjectBtn = document.getElementById("addProjectBtn");
const projectModal = document.getElementById("projectModal");
const projectModalTitle = document.getElementById("projectModalTitle");
const projectTitleInput = document.getElementById("projectTitle");
const projectDescriptionInput = document.getElementById("projectDescription");
const projectStartInput = document.getElementById("projectStartDate");
const projectEndInput = document.getElementById("projectEndDate");
const projectCommentInput = document.getElementById("projectComment");
const saveProjectBtn = document.getElementById("saveProjectBtn");
const cancelProjectBtn = document.getElementById("cancelProjectBtn");
const deleteModal = document.getElementById("deleteModal");
const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");
const taskBoard = document.getElementById("taskBoard");

// ===== State =====
let isEditing = false;
let currentProjectId = null;
let openedProjectId = null;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const projectsCollection = `artifacts/${appId}/public/data/projects`;
const logsCollection = `artifacts/${appId}/public/data/project_logs`;

// ===== Utility =====
function showModal(modalEl) {
    if (!modalEl) return;
    modalEl.classList.remove("hidden");
    modalEl.classList.add("flex");
}
function hideModal(modalEl) {
    if (!modalEl) return;
    modalEl.classList.add("hidden");
    modalEl.classList.remove("flex");
}
function displayName(email) {
    if (!email) return "Ẩn danh";
    return String(email).split("@")[0];
}

// ===== Custom Message Modal (replacement for alert) =====
function showInfoMessage(message) {
    const existingModal = document.getElementById("infoModal");
    if (existingModal) existingModal.remove();

    const modalHtml = `
        <div id="infoModal" class="modal-overlay fixed inset-0 z-[100] flex items-center justify-center">
            <div class="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full text-center">
                <p class="text-gray-700 mb-6">${message}</p>
                <button onclick="closeInfoMessage()" class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition duration-300">Đóng</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    showModal(document.getElementById("infoModal"));
}

window.closeInfoMessage = () => {
    const modal = document.getElementById("infoModal");
    if (modal) modal.remove();
};


// ===== LOG SYSTEM =====
async function addProjectLog(projectId, action, details = "") {
    const user = auth.currentUser;
    if (!user) {
        console.error("User not authenticated for logging.");
        return;
    }
    try {
        await addDoc(collection(db, logsCollection), {
            projectId,
            action,
            details,
            user: user.email,
            userId: user.uid,
            createdAt: serverTimestamp()
        });
    } catch (e) {
        console.error("Error adding log:", e);
    }
}

function renderLogs(projectId, container, isAdmin) {
    const logWrapper = document.createElement("div");
    logWrapper.className = "border p-2 mt-4 rounded bg-gray-50";
    logWrapper.innerHTML = `
        <button class="toggle-log-btn text-blue-500 font-semibold text-sm">📜 Hiện lịch sử hoạt động</button>
        <div class="logs hidden mt-2"></div>
    `;
    container.appendChild(logWrapper);

    const logsDiv = logWrapper.querySelector(".logs");
    const toggleBtn = logWrapper.querySelector(".toggle-log-btn");

    toggleBtn.addEventListener("click", () => {
        logsDiv.classList.toggle("hidden");
        toggleBtn.textContent = logsDiv.classList.contains("hidden") ? "📜 Hiện lịch sử hoạt động" : "📜 Ẩn lịch sử hoạt động";
    });

    const q = query(
        collection(db, logsCollection),
        where("projectId", "==", projectId),
        orderBy("createdAt", "desc")
    );

    onSnapshot(q, (snapshot) => {
        logsDiv.innerHTML = "";
        if (snapshot.empty) {
            logsDiv.innerHTML = `<p class="text-gray-500 text-sm italic">Chưa có lịch sử hoạt động nào.</p>`;
            return;
        }
        snapshot.forEach((docu) => {
            const log = docu.data();
            const time = log.createdAt?.toDate ? log.createdAt.toDate().toLocaleString('vi-VN') : "-";
            const item = document.createElement("div");
            item.className = "text-sm border-b py-1 flex justify-between items-center";
            item.innerHTML = `
                <span class="text-gray-700"><b>${displayName(log.user)}</b> ${log.action} ${log.details || ""} (${time})</span>
                ${isAdmin ? `<button class="delete-log-btn text-red-500 hover:text-red-700" data-id="${docu.id}">❌</button>` : ""}
            `;
            logsDiv.appendChild(item);
        });

        if (isAdmin) {
            logsDiv.querySelectorAll(".delete-log-btn").forEach((btn) => {
                btn.addEventListener("click", async (e) => {
                    const logId = e.currentTarget.dataset.id;
                    try {
                        await deleteDoc(doc(db, logsCollection, logId));
                    } catch (error) {
                        console.error("Error deleting log:", error);
                    }
                });
            });
        }
    });
}

// ===== Render project card =====
function renderProject(docSnap) {
    const data = docSnap.data();
    const id = docSnap.id;
    const user = auth.currentUser;
    const isAdmin = user && user.email === "admin@gmail.com";
    const isOwner = user && data.createdBy === user.email;

    const projectCard = document.createElement("div");
    projectCard.className = "bg-white p-6 rounded-lg shadow-md border mb-4";
    
    const createdAt = data.createdAt?.toDate ? data.createdAt.toDate().toLocaleString('vi-VN') : "-";
    const updatedAt = data.updatedAt?.toDate ? data.updatedAt.toDate().toLocaleString('vi-VN') : "-";

    projectCard.innerHTML = `
        <h4 class="text-xl font-semibold text-blue-700 mb-2">${data.title}</h4>
        <p class="text-gray-600 mb-2">${data.description || "Chưa có mô tả."}</p>
        <div class="text-gray-500 text-sm grid grid-cols-2 gap-2">
            <p><b>Bắt đầu:</b> ${data.startDate || "-"}</p>
            <p><b>Kết thúc:</b> ${data.endDate || "-"}</p>
            <p class="col-span-2"><b>Ghi chú:</b> ${data.comment || "-"}</p>
            <p><b>Người tạo:</b> ${displayName(data.createdBy)}</p>
            <p><b>Ngày tạo:</b> ${createdAt}</p>
            ${updatedAt !== createdAt ? `<p class="col-span-2"><b>Cập nhật:</b> ${updatedAt}</p>` : ""}
        </div>
    `;
    
    const btns = document.createElement("div");
    btns.className = "flex space-x-2 mt-4";
    btns.innerHTML = `
        <button data-id="${id}" class="view-tasks-btn bg-blue-500 text-white px-3 py-1 rounded-md text-sm hover:bg-blue-600 transition duration-300">👁️ Chi tiết</button>
        ${isOwner || isAdmin ? `<button data-id="${id}" class="edit-btn bg-yellow-500 text-white px-3 py-1 rounded-md text-sm hover:bg-yellow-600 transition duration-300">✏️ Sửa</button>` : ""}
        ${isOwner || isAdmin ? `<button data-id="${id}" class="delete-btn bg-red-500 text-white px-3 py-1 rounded-md text-sm hover:bg-red-600 transition duration-300">🗑️ Xóa</button>` : ""}
    `;
    projectCard.appendChild(btns);
    renderLogs(id, projectCard, isAdmin);
    projectArea.appendChild(projectCard);
}

// ===== Real-time listener for projects =====
function setupProjectListener() {
    const q = query(collection(db, projectsCollection), orderBy("createdAt", "desc"));

    onSnapshot(q, (snapshot) => {
        projectArea.innerHTML = "";
        if (snapshot.empty) {
            projectArea.innerHTML = `<div class="text-center p-8 text-gray-500">Chưa có dự án nào được tạo.</div>`;
        }
        const docs = snapshot.docs;
        docs.forEach((doc) => renderProject(doc));
        attachEventListeners(docs);
    }, (error) => {
        console.error("Error setting up project listener:", error);
        projectArea.innerHTML = `<div class="text-center p-8 text-red-500">Lỗi khi tải dự án. Vui lòng thử lại.</div>`;
    });
}

function attachEventListeners(docs) {
    document.querySelectorAll(".edit-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            const id = e.currentTarget.dataset.id;
            const docToEdit = docs.find((d) => d.id === id);
            if (docToEdit) editProject(id, docToEdit.data());
        });
    });

    document.querySelectorAll(".delete-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            const id = e.currentTarget.dataset.id;
            showDeleteConfirmation(id);
        });
    });
    
    document.querySelectorAll(".view-tasks-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            const id = e.currentTarget.dataset.id;
            const docToView = docs.find((d) => d.id === id);
            if (docToView) {
                const projectTitle = docToView.data().title;
                openedProjectId = id;
                showTaskBoard(id, projectTitle);
            }
        });
    });
}

// ===== Add / Update project =====
saveProjectBtn.addEventListener("click", async () => {
    const title = projectTitleInput.value.trim();
    const description = projectDescriptionInput.value.trim();
    const startDate = projectStartInput.value;
    const endDate = projectEndInput.value;
    const comment = projectCommentInput.value.trim();
    if (!title) {
        showInfoMessage("Tiêu đề dự án không được để trống!");
        return;
    }
    
    const user = auth.currentUser;
    if (!user) {
        console.error("User not authenticated.");
        return;
    }

    try {
        if (isEditing) {
            const projectDocRef = doc(db, projectsCollection, currentProjectId);
            await updateDoc(projectDocRef, {
                title,
                description,
                startDate,
                endDate,
                comment,
                updatedAt: serverTimestamp()
            });
            await addProjectLog(currentProjectId, "cập nhật dự án", `(${title})`);
        } else {
            const newProject = await addDoc(collection(db, projectsCollection), {
                title,
                description,
                startDate,
                endDate,
                comment,
                createdBy: user.email,
                createdAt: serverTimestamp()
            });
            await addProjectLog(newProject.id, "tạo dự án", `(${title})`);
        }
        hideModal(projectModal);
    } catch (e) {
        console.error("Error add/update:", e);
        showInfoMessage("Đã xảy ra lỗi khi lưu dự án. Vui lòng thử lại.");
    }
});

// ===== Edit project =====
function editProject(id, data) {
    isEditing = true;
    currentProjectId = id;
    projectModalTitle.textContent = "Cập nhật dự án";
    projectTitleInput.value = data.title || "";
    projectDescriptionInput.value = data.description || "";
    projectStartInput.value = data.startDate || "";
    projectEndInput.value = data.endDate || "";
    projectCommentInput.value = data.comment || "";
    showModal(projectModal);
}

// ===== Delete project =====
function showDeleteConfirmation(id) {
    currentProjectId = id;
    showModal(deleteModal);
}

confirmDeleteBtn.addEventListener("click", async () => {
    try {
        const docRef = doc(db, projectsCollection, currentProjectId);
        const docSnap = await getDoc(docRef);
        const projectData = docSnap.data();

        const user = auth.currentUser;
        const isAdmin = user && user.email === "admin@gmail.com";
        const isOwner = user && projectData.createdBy === user.email;

        if (!isAdmin && !isOwner) {
            console.error("Permission denied. User is not the owner or an admin.");
            showInfoMessage("Bạn không có quyền xóa dự án này.");
            hideModal(deleteModal);
            return;
        }

        await deleteDoc(doc(db, projectsCollection, currentProjectId));
        await addProjectLog(currentProjectId, "xóa dự án");
        
        const logsToDelete = await getDocs(query(collection(db, logsCollection), where("projectId", "==", currentProjectId)));
        logsToDelete.forEach(async (logDoc) => {
            await deleteDoc(doc(db, logsCollection, logDoc.id));
        });
        
        if (openedProjectId === currentProjectId) {
            // Placeholder for task board logic
            // taskBoard.classList.add("hidden");
            // taskBoard.innerHTML = "";
            openedProjectId = null;
        }

        hideModal(deleteModal);
    } catch (e) {
        console.error("Error deleting project:", e);
        showInfoMessage("Đã xảy ra lỗi khi xóa dự án. Vui lòng thử lại.");
    }
});

cancelDeleteBtn.addEventListener("click", () => hideModal(deleteModal));
cancelProjectBtn.addEventListener("click", () => hideModal(projectModal));

// ===== Add project modal =====
addProjectBtn.addEventListener("click", () => {
    isEditing = false;
    currentProjectId = null;
    projectModalTitle.textContent = "Tạo dự án mới";
    projectTitleInput.value = "";
    projectDescriptionInput.value = "";
    projectStartInput.value = "";
    projectEndInput.value = "";
    projectCommentInput.value = "";
    showModal(projectModal);
});

// ===== Auth listener for UI =====
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
if (initialAuthToken) {
    signInWithCustomToken(auth, initialAuthToken).catch((error) => {
        console.error("Error signing in with custom token:", error);
    });
} else {
    signInAnonymously(auth).catch((error) => {
        console.error("Error signing in anonymously:", error);
    });
}

onAuthStateChanged(auth, (user) => {
    if (user) {
        addProjectBtn.classList.remove("hidden");
        setupProjectListener();
    } else {
        projectArea.innerHTML = `<div class="text-center p-8 text-gray-500">Bạn cần đăng nhập để xem và quản lý dự án.</div>`;
        addProjectBtn.classList.add("hidden");
    }
});
