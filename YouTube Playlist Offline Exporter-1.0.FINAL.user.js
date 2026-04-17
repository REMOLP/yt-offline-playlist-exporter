// ==UserScript==
// @name         YouTube Playlist Offline Exporter
// @namespace    https://github.com/REMOLP/yt-offline-playlist-exporter
// @supportURL   https://github.com/REMOLP/yt-offline-playlist-exporter/issues
// @version      1.0.FINAL
// @description  YouTube any playlist exporter with smart random and original UI. Keep the bloat away 😎
// @author       REMOLP
// @license      MIT
// @match        https://www.youtube.com/playlist?*
// @grant        none
// ==/UserScript==

(function () {
    "use strict";

    const MAX_DURATION_SECONDS = 0;

    const btn = document.createElement("button");
    btn.innerText = "⬇ Export Offline HTML";

    Object.assign(btn.style, {
        position: "fixed",
        bottom: "20px",
        right: "20px",
        zIndex: "99999",
        padding: "12px 16px",
        borderRadius: "12px",
        border: "none",
        cursor: "pointer",
        background: "#222",
        color: "#fff",
        fontSize: "14px",
        boxShadow: "0 0 12px rgba(0,0,0,0.4)"
    });

    btn.onmouseenter = () => btn.style.background = "#444";
    btn.onmouseleave = () => btn.style.background = "#222";

    document.body.appendChild(btn);

    function parseDuration(text) {
        if (!text) return 0;
        const p = text.split(":").map(Number);
        if (p.length === 3) return p[0]*3600 + p[1]*60 + p[2];
        if (p.length === 2) return p[0]*60 + p[1];
        return 0;
    }

    async function exportPlaylist() {
        const items = document.querySelectorAll("ytd-playlist-video-renderer");

        if (!items.length) {
            alert("Scroll first!");
            return;
        }

        const results = [];

        items.forEach(el => {
            const titleEl = el.querySelector("#video-title");
            const durationEl = el.querySelector("ytd-thumbnail-overlay-time-status-renderer span");

            if (!titleEl) return;

            const rawHref = titleEl.getAttribute("href");
            const match = rawHref.match(/v=([^&]+)/);
            if (!match) return;

            const durationText = durationEl ? durationEl.innerText.trim() : null;
            const durationSec = parseDuration(durationText);

            if (MAX_DURATION_SECONDS > 0 && durationSec > MAX_DURATION_SECONDS) return;

            const videoId = match[1];

            results.push({
                title: titleEl.innerText.trim(),
                cleanUrl: `https://www.youtube.com/watch?v=${videoId}`,
                thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                duration: durationText
            });
        });

        const htmlContent = `
<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<title>Offline Playlist Export</title>
<style>
body {
    font-family: sans-serif;
    background: #111;
    color: #eee;
    padding: 20px;
}
.top-panel {
    background: #1a1a1a;
    padding: 15px;
    border-radius: 12px;
    margin-bottom: 20px;
}
textarea {
    width: 100%;
    height: 100px;
    background: #000;
    color: #0f0;
    border: none;
    padding: 10px;
    border-radius: 8px;
}
.item {
    display: flex;
    gap: 15px;
    padding: 10px;
    margin-bottom: 10px;
    border-radius: 12px;
    background: #1c1c1c;
    align-items: center;
}
img {
    width: 120px;
    border-radius: 8px;
}
a {
    color: #4fc3ff;
    font-size: 18px;
    text-decoration: none;
}
button {
    margin-left: 10px;
    padding: 6px 10px;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    background: #333;
    color: #eee;
}
button:hover {
    background: #555;
}

input {
    background: #222;
    color: #eee;
    border: 1px solid #444;
    border-radius: 8px;
    padding: 5px 8px;
    margin-left: 5px;
    outline: none;
    transition: 0.2s;
}

input:hover {
    border-color: #666;
}

input:focus {
    border-color: #4fc3ff;
    box-shadow: 0 0 5px rgba(79,195,255,0.5);
}

input[type="checkbox"] {
    accent-color: #4fc3ff;
    transform: scale(1.1);
    cursor: pointer;
}
</style>
</head>
<body>

<h1>🎶 Offline Playlist Export</h1>
<p>Saved: ${results.length} videos</p>

<div class="top-panel">
    <h3>🎲 Smart Random</h3>

    Count: <input id="count" type="number" value="5" style="width:60px">
    Max sec: <input id="maxDur" type="number" value="0" style="width:80px">
    <label><input type="checkbox" id="weighted"> Prefer short</label>

    <br><br>

    <button onclick="generate()">Generate</button>
    <button onclick="copyMPV()">📋 mpv</button>
    <button onclick="copyMusic()">🎧 music</button>
    <button onclick="resetUsed()">Reset</button>

    <p id="stats"></p>
    <textarea id="output"></textarea>

    <br><br>

Min sec: <input id="minDur" type="number" value="0" style="width:80px">

Index range: <input id="range" type="text" placeholder="e.g. 1-50" style="width:100px">

<label>
    <input type="checkbox" id="lastPercentToggle">
    Last %
</label>
<input id="lastPercent" type="number" value="33" style="width:60px">

<br><br>

<button onclick="exportMPVAll()">📦 All → mpv</button>
<button onclick="exportM3U()">📦 Export .m3u</button>
</div>

<hr>

<script>
const ALL = ${JSON.stringify(results)};
let USED = new Set();

function toSec(t){
 if(!t) return 0;
 let p=t.split(":").map(Number);
 return p.length===3?p[0]*3600+p[1]*60+p[2]:p[0]*60+p[1];
}

function weightedPick(arr){
 let weights = arr.map(v=>{
   let d = toSec(v.duration)||1;
   return 1/(d+1);
 });

 let sum = weights.reduce((a,b)=>a+b,0);
 let r = Math.random()*sum;

 for(let i=0;i<arr.length;i++){
   if((r-=weights[i])<=0) return arr[i];
 }
 return arr[0];
}

function generate(){
 let count = +document.getElementById("count").value || 5;
 let maxDur = +document.getElementById("maxDur").value || 0;
 let weighted = document.getElementById("weighted").checked;

let pool = applyAdvancedFilters(ALL).filter(v=>{
   if(USED.has(v.cleanUrl)) return false;
   return true;
});

 let selected = [];

 while(selected.length < count && pool.length){
   let pick = weighted ? weightedPick(pool) : pool[Math.floor(Math.random()*pool.length)];
   selected.push(pick);
   USED.add(pick.cleanUrl);
   pool = pool.filter(v=>v.cleanUrl !== pick.cleanUrl);
 }

 document.getElementById("output").value =
   selected.map(v=>v.cleanUrl).join("\\n");

 document.getElementById("stats").innerText =
   "Remaining: " + (ALL.length - USED.size);
}

function copyMPV(){
 let links = document.getElementById("output").value.split("\\n").filter(Boolean);
 navigator.clipboard.writeText("mpv " + links.join(" "));
}

function copyMusic(){
 let links = document.getElementById("output").value.split("\\n").filter(Boolean);
 navigator.clipboard.writeText("mpv --no-video --volume=68 " + links.join(" "));
}

function resetUsed(){
 USED.clear();
 document.getElementById("stats").innerText = "History reset";
}

function copyText(text) {
    navigator.clipboard.writeText(text);
}

function applyAdvancedFilters(list){
    let minDur = +document.getElementById("minDur").value || 0;
    let maxDur = +document.getElementById("maxDur").value || 0;
    let range = document.getElementById("range").value.trim();
    let lastToggle = document.getElementById("lastPercentToggle").checked;
    let lastPercent = +document.getElementById("lastPercent").value || 0;

    let filtered = [...list];

    // Index range filter
    if(range.match(/^\\d+-\\d+$/)){
        let [start, end] = range.split("-").map(n=>parseInt(n)-1);
        filtered = filtered.slice(start, end+1);
    }

    // Last % filter
    if(lastToggle && lastPercent > 0){
        let startIndex = Math.floor(filtered.length * (1 - lastPercent/100));
        filtered = filtered.slice(startIndex);
    }

    // Duration filters
    filtered = filtered.filter(v=>{
        let d = toSec(v.duration);
        if(minDur > 0 && d < minDur) return false;
        if(maxDur > 0 && d > maxDur) return false;
        return true;
    });

    return filtered;
}

function exportMPVAll(){
    let list = applyAdvancedFilters(ALL);
    let cmd = "mpv " + list.map(v=>v.cleanUrl).join(" ");
    navigator.clipboard.writeText(cmd);
}

function exportM3U(){
    let list = applyAdvancedFilters(ALL);

    let content = "#EXTM3U\\n" +
        list.map(v=>"#EXTINF:-1," + v.title + "\\n" + v.cleanUrl).join("\\n");

    let blob = new Blob([content], {type: "audio/x-mpegurl"});
    let a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "playlist.m3u";
    a.click();
}
</script>

${results.map(r => `
<div class="item">
    <img src="${r.thumbnail}">
    <div>
        <a href="${r.cleanUrl}" target="_blank">${r.title}</a>

        <button onclick="copyText('${r.cleanUrl}')">
            📋 Copy
        </button>

        <button onclick="copyText('mpv --vid=no --volume=68 ${r.cleanUrl}')">
            🎧 mpv
        </button>
    </div>
</div>
`).join("")}

</body>
</html>
        `;

        const blob = new Blob([htmlContent], { type: "text/html" });
        const link = document.createElement("a");

        link.href = URL.createObjectURL(blob);
        link.download = "playlist_export.html";
        link.click();
    }

    btn.onclick = exportPlaylist;

})();