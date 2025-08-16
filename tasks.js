// ===== Firebase SDKs =====
import { 
    initializeApp 
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";

import { 
    getFirestore, collection, doc, addDoc, getDocs, onSnapshot,
    updateDoc, deleteDoc, query, where, serverTimestamp, arrayUnion
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

import { getAuth } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";


// ===== Firebase Config =====
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_MSG_ID",
    appId: "YOUR_APP_ID"
};

// ===== Init =====
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);


// ===== Show Task Board =====
export function showTaskBoard(projectId) {
    const taskBoard = document.getElementById("taskBoard");

    taskBoard.innerHTML = `
        <div class="grid grid-cols-3 gap-4 w-full">
            <!-- To Do -->
            <div class="bg-white p-4 rounded shadow" id="todoArea">
                <h3 class="font-bold text-lg text-red-600 mb-2">To Do</h3>
                <button id="addGroupBtn" class="px-2">➕</button>
                <div id="groupContainer" class="space-y-4 min-h-[200px]"></div>
            </div>

            <!-- In Progress -->
            <div class="bg-white p-4 rounded shadow" id="inprogressArea">
                <h3 class="font-bold text-lg text-yellow-600 mb-2">In Progress</h3>
                <div id="inprogressCol" class="space-y-4 min-h-[200px]"></div>
            </div>

            <!-- Done -->
            <div class="bg-white p-4 rounded shadow" id="doneArea">
                <h3 class="font-bold text-lg text-green-600 mb-2">Done</h3>
                <div id="doneCol" class="space-y-4 min-h-[200px]"></div>
            </div>
        </div>
    `;

    // Drag & drop zones
    ["todoArea","inprogressArea","doneArea"].forEach(areaId=>{
        const area = document.getElementById(areaId);
        area.addEventListener("dragover",(e)=>e.preventDefault());
        area.addEventListener("drop",(e)=>handleDrop(e,projectId,areaId));
    });

    // Add group
    document.getElementById("addGroupBtn").addEventListener("click",()=>addGroup(projectId));

    // Realtime groups
    const groupQ = query(collection(db,"groups"),where("projectId","==",projectId));
    onSnapshot(groupQ,(snap)=>{
        const groupContainer = document.getElementById("groupContainer");
        groupContainer.innerHTML = "";
        snap.forEach(docSnap=>{
            renderGroup(docSnap.id,docSnap.data());
        });
    });

    // Realtime tasks
    const taskQ = query(collection(db,"tasks"),where("projectId","==",projectId));
    onSnapshot(taskQ,(snap)=>{
        document.getElementById("inprogressCol").innerHTML = "";
        document.getElementById("doneCol").innerHTML = "";
        snap.forEach(docSnap=>{
            renderTask(docSnap.id,docSnap.data());
        });
    });
}


// ===== Handle Drop =====
async function handleDrop(e,projectId,newStatus){
    e.preventDefault();
    const type = e.dataTransfer.getData("type");

    if(type==="task"){
        const taskId = e.dataTransfer.getData("taskId");
        await updateDoc(doc(db,"tasks",taskId),{
            status:newStatus.replace("Area",""),
            updatedAt:serverTimestamp(),
            updatedBy:auth.currentUser?auth.currentUser.email:"Ẩn danh"
        });
    }

    if(type==="group"){
        const groupId = e.dataTransfer.getData("groupId");
        const q = query(collection(db,"tasks"),where("groupId","==",groupId));
        const snap = await getDocs(q);
        snap.forEach(async(t)=>{
            await updateDoc(doc(db,"tasks",t.id),{
                status:newStatus.replace("Area",""),
                updatedAt:serverTimestamp(),
                updatedBy:auth.currentUser?auth.currentUser.email:"Ẩn danh"
            });
        });
        await updateDoc(doc(db,"groups",groupId),{
            status:newStatus.replace("Area",""),
            updatedAt:serverTimestamp(),
            updatedBy:auth.currentUser?auth.currentUser.email:"Ẩn danh",
            logs: arrayUnion({
                action:"move-group",
                user:auth.currentUser?auth.currentUser.email:"Ẩn danh",
                time:Date.now()
            })
        });
    }
}


// ===== Render Group =====
function renderGroup(groupId,groupData){
    const groupDiv = document.createElement("div");
    groupDiv.className="bg-gray-100 p-3 rounded shadow";
    groupDiv.draggable=true;
    groupDiv.addEventListener("dragstart",(e)=>{
        e.dataTransfer.setData("type","group");
        e.dataTransfer.setData("groupId",groupId);
    });

    groupDiv.innerHTML=`
        <div class="flex justify-between items-center mb-2">
            <h4 class="font-semibold text-blue-700">${groupData.title}</h4>
            <div class="flex space-x-2">
                <button data-id="${groupId}" class="edit-group">✏️</button>
                <button data-id="${groupId}" class="delete-group">❌</button>
            </div>
        </div>
        <button data-id="${groupId}" class="add-task mb-2">➕</button>
        <div id="tasks-${groupId}" class="space-y-2"></div>
        <button class="toggle-log mt-2" data-id="${groupId}">📜</button>
        <div id="logBox-${groupId}" class="hidden bg-gray-50 p-2 rounded text-xs mt-2"></div>
    `;

    // toggle log
    groupDiv.querySelector(".toggle-log").addEventListener("click",()=>{
        const logBox=groupDiv.querySelector(`#logBox-${groupId}`);
        logBox.classList.toggle("hidden");
        if(!logBox.classList.contains("hidden")){
            renderLogs(groupId,groupData.logs||[],logBox);
        }
    });

    groupDiv.querySelector(".edit-group").addEventListener("click",()=>editGroup(groupId,groupData));
    groupDiv.querySelector(".delete-group").addEventListener("click",()=>deleteGroup(groupId,groupData));
    groupDiv.querySelector(".add-task").addEventListener("click",()=>addTask(groupId,groupData.projectId));

    document.getElementById("groupContainer").appendChild(groupDiv);
}


// ===== Render Task =====
function renderTask(taskId,taskData){
    if(taskData.status==="todo"){
        const container=document.getElementById(`tasks-${taskData.groupId}`);
        if(container){
            container.appendChild(makeTaskBox(taskId,taskData));
        }
    } else if(taskData.status==="inprogress"){
        document.getElementById("inprogressCol").appendChild(makeTaskBox(taskId,taskData));
    } else if(taskData.status==="done"){
        document.getElementById("doneCol").appendChild(makeTaskBox(taskId,taskData));
    }
}

function makeTaskBox(taskId,taskData){
    const div=document.createElement("div");
    div.className="bg-white p-2 rounded shadow";
    div.draggable=true;
    div.addEventListener("dragstart",(e)=>{
        e.dataTransfer.setData("type","task");
        e.dataTransfer.setData("taskId",taskId);
    });
    div.innerHTML=`
        <div><strong>${taskData.title}</strong></div>
        <div class="flex space-x-2 mt-1">
            <button data-id="${taskId}" class="edit-task">✏️</button>
            <button data-id="${taskId}" class="delete-task">❌</button>
        </div>
    `;
    div.querySelector(".edit-task").addEventListener("click",()=>editTask(taskId,taskData));
    div.querySelector(".delete-task").addEventListener("click",()=>deleteTask(taskId,taskData));
    return div;
}


// ===== Render Logs =====
function renderLogs(groupId,logs,logBox){
    logBox.innerHTML = logs.map(l=>`
        <div>- ${l.user} ${l.action} (${new Date(l.time).toLocaleString()})</div>
    `).join("");
}


// ===== Group CRUD =====
async function addGroup(projectId){
    const title=prompt("Tên Group:");
    if(!title) return;
    await addDoc(collection(db,"groups"),{
        title,projectId,status:"todo",createdAt:serverTimestamp(),
        createdBy:auth.currentUser?auth.currentUser.email:"Ẩn danh",
        logs: []   // ❗ bắt buộc có để arrayUnion hoạt động
    });
}

async function editGroup(groupId,groupData){
    const title=prompt("Sửa tên Group:",groupData.title);
    if(!title) return;
    await updateDoc(doc(db,"groups",groupId),{
        title,updatedAt:serverTimestamp(),
        updatedBy:auth.currentUser?auth.currentUser.email:"Ẩn danh",
        logs: arrayUnion({
            action:"edit-group",
            user:auth.currentUser?auth.currentUser.email:"Ẩn danh",
            time:Date.now()
        })
    });
}

async function deleteGroup(groupId,groupData){
    if(!confirm("Xóa group này?")) return;
    const q=query(collection(db,"tasks"),where("groupId","==",groupId));
    const snap=await getDocs(q);
    snap.forEach(async(t)=>await deleteDoc(doc(db,"tasks",t.id)));
    await deleteDoc(doc(db,"groups",groupId));
}


// ===== Task CRUD =====
async function addTask(groupId,projectId){
    const title=prompt("Tên Task:");
    if(!title) return;
    await addDoc(collection(db,"tasks"),{
        title,groupId,projectId,status:"todo",createdAt:serverTimestamp(),
        createdBy:auth.currentUser?auth.currentUser.email:"Ẩn danh"
    });
    await updateDoc(doc(db,"groups",groupId),{
        logs: arrayUnion({
            action:"add-task",
            user:auth.currentUser?auth.currentUser.email:"Ẩn danh",
            time:Date.now()
        })
    });
}

async function editTask(taskId,taskData){
    const title=prompt("Sửa Task:",taskData.title);
    if(!title) return;
    await updateDoc(doc(db,"tasks",taskId),{
        title,updatedAt:serverTimestamp(),
        updatedBy:auth.currentUser?auth.currentUser.email:"Ẩn danh"
    });
    await updateDoc(doc(db,"groups",taskData.groupId),{
        logs: arrayUnion({
            action:"edit-task",
            user:auth.currentUser?auth.currentUser.email:"Ẩn danh",
            time:Date.now()
        })
    });
}

async function deleteTask(taskId,taskData){
    if(!confirm("Xóa task này?")) return;
    await deleteDoc(doc(db,"tasks",taskId));
    await updateDoc(doc(db,"groups",taskData.groupId),{
        logs: arrayUnion({
            action:"delete-task",
            user:auth.currentUser?auth.currentUser.email:"Ẩn danh",
            time:Date.now()
        })
    });
}
