import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// --- Configuration ---
const firebaseConfig = {
    apiKey: "AIzaSyAmt2szWOjQBPfzfs7QfQVysgfaRzHyPa0",
    authDomain: "up-med-online.firebaseapp.com",
    databaseURL: "https://up-med-online-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "up-med-online",
    storageBucket: "up-med-online.appspot.com",
    messagingSenderId: "381838942970",
    appId: "1:381838942970:web:8f83a02ba1544d54a95f43"
};

const SHEET_URL = "https://script.google.com/macros/s/AKfycbyzy3SZE39oWym54ELtB6TsBEboayqkjhkSgZoWtGWxYTCjC0NLejZ-AAy4QraA_7zdPQ/exec";

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Global Variables
window.sheetMeds = [];
window.sheetWithdrawals = [];
window.firebaseMeds = [];
window.currentFilter = 'all';

// --- Utility Functions ---

window.parseDate = (dateVal) => {
    if (!dateVal) return null;
    let d = new Date(dateVal);
    if (d.getFullYear() > 2500) d.setFullYear(d.getFullYear() - 543);
    return isNaN(d.getTime()) ? null : d;
};

const isWithinLast3Months = (dateVal) => {
    const d = window.parseDate(dateVal);
    if (!d) return false;
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    return d >= threeMonthsAgo;
};

// --- UI Navigation ---

window.toggleMenu = () => {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    if (sidebar) sidebar.classList.toggle('active');
    if (overlay) overlay.classList.toggle('active');
};

window.changePage = (p) => {
    const pageDb = document.getElementById('page-db');
    const pageIn = document.getElementById('page-in');
    const btnDb = document.getElementById('btn-db');
    const btnIn = document.getElementById('btn-in');

    if (pageDb) pageDb.classList.toggle('hidden-page', p !== 'db');
    if (pageIn) pageIn.classList.toggle('hidden-page', p !== 'in');
    
    // ปรับสถานะปุ่มเมนู (Active/Inactive)
    if (btnDb) btnDb.classList.toggle('opacity-100', p === 'db');
    if (btnDb) btnDb.classList.toggle('bg-white/20', p === 'db');
    if (btnIn) btnIn.classList.toggle('opacity-100', p === 'in');
    if (btnIn) btnIn.classList.toggle('bg-white/20', p === 'in');

    if (window.innerWidth < 1024) window.toggleMenu();
    window.render();
};

window.goToFilter = (f) => {
    window.currentFilter = f;
    window.changePage('in');
};

// --- Data Fetching ---

async function fetchData() {
    try {
        console.log("🔄 กำลังดึงข้อมูลจาก Sheets...");
        const res = await fetch(`${SHEET_URL}?action=dashboard_data&t=${Date.now()}`);
        if (!res.ok) throw new Error('Network response was not ok');
        const data = await res.json();

        const getVal = (obj, keys) => {
            if (!obj) return null;
            const targetKey = Object.keys(obj).find(k => 
                keys.includes(k.trim()) || keys.map(x => x.toLowerCase()).includes(k.trim().toLowerCase())
            );
            return targetKey ? obj[targetKey] : null;
        };

        if (data.inventory) {
            window.sheetMeds = data.inventory.map(item => ({
                name: getVal(item, ["ชื่อสินค้า", "รายการ", "ชื่อ", "item_name"]) || "ไม่ระบุชื่อ",
                stock: parseFloat(getVal(item, ["จำนวนสินค้าคงเหลือ", "คงเหลือ", "จำนวน", "stock"])) || 0,
                minStock: parseFloat(getVal(item, ["จำนวนขั้นต่ำ", "ขั้นต่ำ", "Min", "min_stock"])) || 0,
                lot: getVal(item, ["LOT", "เลขล็อต", "ล็อต", "lot_no"]) || "-",
                expiry: getVal(item, ["วันหมดอายุ", "หมดอายุ", "EXP", "expiry_date"]) || "",
                category: getVal(item, ["กลุ่มสินค้า", "หมวดหมู่", "ประเภท", "category"]) || "ทั่วไป"
            }));
        }

        if (data.withdrawals) {
            window.sheetWithdrawals = data.withdrawals.map(item => ({
                name: getVal(item, ["ชื่อสินค้า", "รายการ", "item_name"]) || "ไม่ระบุชื่อ",
                qty: parseFloat(getVal(item, ["จำนวนที่เบิก", "จำนวน", "Qty", "amount"])) || 0,
                unit: getVal(item, ["หน่วยนับ", "หน่วย", "unit"]) || "หน่วย",
                timestamp: getVal(item, ["วันที่บันทึก", "Timestamp", "วันที่", "date"]) || ""
            }));
        }
        window.render();
    } catch (e) { 
        console.error("❌ Fetch Data Error:", e); 
    }
}

onValue(ref(db, 'meds'), (snap) => {
    const data = snap.val();
    window.firebaseMeds = data ? Object.keys(data).map(k => ({ ...data[k], id: k })) : [];
    window.render();
});

// --- Render Logic ---

window.render = () => {
    const q = (document.getElementById('search')?.value || "").toLowerCase();
    const allInventory = [...(window.sheetMeds || []), ...(window.firebaseMeds || [])];
    const limitDate = new Date();
    limitDate.setMonth(limitDate.getMonth() + 3);

    let filteredInv = allInventory.filter(m => 
        (m.name || "").toLowerCase().includes(q) || (m.lot || "").toLowerCase().includes(q)
    );

    // กรองตามสถานะที่เลือกจาก Dashboard
    if (window.currentFilter === 'out') {
        filteredInv = filteredInv.filter(i => i.stock <= 0);
    } 
    else if (window.currentFilter === 'low') {
        filteredInv = filteredInv.filter(i => i.stock > 0 && i.stock < i.minStock);
    }
    else if (window.currentFilter === 'expired') {
        filteredInv = filteredInv.filter(i => {
            const d = window.parseDate(i.expiry);
            return d && d < limitDate;
        });
    }

    // อัปเดตตัวเลขบน Card Dashboard
    const totalEl = document.getElementById('stat-total');
    const outEl = document.getElementById('stat-out');
    const lowEl = document.getElementById('stat-low'); 
    const expEl = document.getElementById('stat-expired');

    if (totalEl) totalEl.innerText = allInventory.length.toLocaleString();
    if (outEl) outEl.innerText = allInventory.filter(i => i.stock <= 0).length.toLocaleString();
    if (lowEl) {
        const lowCount = allInventory.filter(i => i.stock > 0 && i.stock < i.minStock).length;
        lowEl.innerText = lowCount.toLocaleString();
    }
    if (expEl) {
        expEl.innerText = allInventory.filter(i => {
            const d = window.parseDate(i.expiry);
            return d && d < limitDate;
        }).length.toLocaleString();
    }

    renderTables(filteredInv, allInventory, limitDate);
};

function renderTables(filteredInv, allInventory, limitDate) {
    // 1. Inventory Table
    const tableInBody = document.getElementById('table-in-body');
    if (tableInBody) {
        tableInBody.innerHTML = filteredInv.map(m => {
            const expDate = window.parseDate(m.expiry);
            const expText = expDate ? expDate.toLocaleDateString('th-TH') : (m.expiry || '-');
            const isExpired = expDate && expDate < new Date();
            const stockClass = m.stock <= 0 ? 'text-red-500' : (m.stock < m.minStock ? 'text-orange-500' : 'text-slate-700');
            
            return `
            <tr onclick="window.showMedDetail('${encodeURIComponent(JSON.stringify(m))}')" class="border-b border-slate-50 hover:bg-slate-50 cursor-pointer">
                <td class="px-6 py-4">
                    <div class="font-bold text-slate-800">${m.name}</div>
                    <div class="text-[10px] text-up-purple font-black uppercase">LOT: ${m.lot || '-'}</div>
                </td>
                <td class="px-6 py-4 text-center">
                    <div class="text-lg font-black ${stockClass}">${m.stock}</div>
                    <div class="text-[9px] text-slate-400">ขั้นต่ำ: ${m.minStock}</div>
                </td>
                <td class="px-6 py-4 font-bold ${isExpired ? 'text-red-500' : 'text-slate-600'}">${expText}</td>
                <td class="px-6 py-4">
                    <span class="status-pill ${m.stock <= 0 ? 'bg-red-100 text-red-600' : (m.stock < m.minStock ? 'bg-orange-100 text-orange-600' : 'bg-emerald-100 text-emerald-600')}">
                        ${m.stock <= 0 ? 'สินค้าหมด' : (m.stock < m.minStock ? 'ควรเติมสินค้า' : 'มีสินค้า')}
                    </span>
                </td>
            </tr>`;
        }).join('');
    }

    // 2. Dashboard Tables (Top Withdrawals)
    const withdrawSummary = (window.sheetWithdrawals || []).reduce((acc, curr) => {
        if (isWithinLast3Months(curr.timestamp)) {
            if (!acc[curr.name]) acc[curr.name] = { name: curr.name, total: 0, unit: curr.unit };
            acc[curr.name].total += curr.qty;
        }
        return acc;
    }, {});
    
    const sortedWithdraw = Object.values(withdrawSummary).sort((a, b) => b.total - a.total).slice(0, 8);
    const withdrawBody = document.getElementById('withdraw-table-body');
    if (withdrawBody) {
        withdrawBody.innerHTML = sortedWithdraw.map(w => {
            const invItem = allInventory.find(i => i.name === w.name);
            const currentStock = invItem ? invItem.stock : 0;
            const stockColor = currentStock <= 0 ? 'text-red-500' : (invItem && currentStock < invItem.minStock ? 'text-orange-500' : 'text-slate-700');
            return `
            <tr class="bg-slate-50/50 hover:bg-orange-50 transition-all">
                <td class="px-4 py-3 rounded-l-xl font-bold text-slate-700">${w.name}</td>
                <td class="px-4 py-3 text-center"><span class="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-black">${w.total.toLocaleString()}</span></td>
                <td class="px-4 py-3 text-center font-black ${stockColor}">${currentStock.toLocaleString()}</td>
                <td class="px-4 py-3 text-right rounded-r-xl text-[10px] font-bold text-slate-400">${w.unit}</td>
            </tr>`;
        }).join('');
    }

    // 3. Recent Transactions
    const recentBody = document.getElementById('recent-table-body');
    if (recentBody) {
        recentBody.innerHTML = (window.sheetWithdrawals || []).slice(0, 5).map(r => `
            <tr class="bg-slate-50/50">
                <td class="px-4 py-3 rounded-l-xl text-[10px] font-bold text-slate-400">${r.timestamp || '-'}</td>
                <td class="px-4 py-3 font-bold text-slate-700">${r.name}</td>
                <td class="px-4 py-3 text-center rounded-r-xl font-black text-emerald-600">+${r.qty}</td>
            </tr>`).join('');
    }
}

// --- Start App ---
fetchData();
setInterval(fetchData, 60000); // อัปเดตข้อมูลอัตโนมัติทุก 1 นาที