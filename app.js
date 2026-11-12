const activity = document.querySelector("#activity");
const status = document.querySelector("#status");
const tabs = [...document.querySelectorAll("[data-tab]")];
const compact = matchMedia("(max-width: 660px), (max-height: 500px)");
const pools = [animals.filter(a => a.group === 0), animals.filter(a => a.group === 1 || a.group === 2), animals.filter(a => a.group === 3)];
const landMovements = [
  pools[1].filter(a => a.group === 1),
  pools[1].filter(a => ["elephant", "giraffe", "panda", "camel", "rhino", "hippo"].includes(a.id)),
  pools[1].filter(a => ["zebra", "tiger", "goat", "ostrich"].includes(a.id))
];
const featureList = Object.entries(traits).map(([id, label]) => ({
  id, label, test: animal => id === "legs" ? !animal.flags.includes("zero") : animal.flags.includes(id)
}));
const features = Object.fromEntries(featureList.map(feature => [feature.id, feature]));

let tab = "deck";
let drawCount = 9;
let batch = [];
let deckPage = 0;
let questionId = "wings";
let placements = new Map();
let current = 0;
let checked = false;
let sorted = false;
let vennGuess = null;
let vennChallenge = false;
const pair = ["butterfly", "spider"];

function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function sample(count) {
  const extra = shuffle([0, 1, 2]).slice(0, count % 3);
  return shuffle(pools.flatMap((pool, index) => {
    const quantity = Math.floor(count / 3) + Number(extra.includes(index));
    if (index !== 1) return shuffle(pool).slice(0, quantity);
    const required = shuffle(landMovements).map(group => shuffle(group)[0]).slice(0, quantity);
    return [...required, ...shuffle(pool.filter(animal => !required.includes(animal))).slice(0, quantity - required.length)];
  }));
}

function say(message = "") {
  status.textContent = message;
}

function resetRound() {
  placements = new Map();
  current = 0;
  checked = false;
  sorted = false;
  vennGuess = null;
  vennChallenge = false;
}

function button(action, label, { value = "", disabled = false, style = "", pressed } = {}) {
  return `<button type="button" data-action="${action}" data-value="${value}" class="${style}" ${disabled ? "disabled" : ""}
    ${pressed === undefined ? "" : `aria-pressed="${pressed}"`}>${label}</button>`;
}

function select(id, label, choices, selected) {
  return `<label for="${id}">${label}<select id="${id}">${choices.map(([value, text]) =>
    `<option value="${value}" ${String(value) === String(selected) ? "selected" : ""}>${text}</option>`).join("")}</select></label>`;
}

function picture(animal, draggable = false) {
  return `<figure class="picture" ${draggable ? 'draggable="true"' : ""}>
    <img src="assets/${animal.id}.svg" width="240" height="160" alt="" draggable="false">
    <figcaption>${animal.name}</figcaption>
  </figure>`;
}

function deck() {
  const counts = select("draw-count", "圖卡張數", [8,9,10,11,12].map(n => [n, n + " 張"]), drawCount);
  const controls = `<div class="bar"><h2>抽取動物圖卡</h2><div class="tools">${counts}
    ${button("draw", "隨機抽圖卡", {style: "primary"})}</div></div>`;
  if (!batch.length) return `<section class="screen opening">
    <div class="opening-copy"><h2>找出動物的特徵</h2>
      <p>抽出一隊動物，用線索分類，再找出牠們的共同特徵。</p>
      <div class="tools">${counts}${button("draw","隨機抽圖卡",{style:"primary"})}</div></div>
    <div class="opening-art" aria-hidden="true">
      <div class="moon"></div>
      <img class="hero-bird" src="assets/swallow.svg" alt="">
      <img class="hero-zebra" src="assets/zebra.svg" alt="">
      <img class="hero-turtle" src="assets/turtle.svg" alt="">
    </div></section>`;
  const pageSize = compact.matches ? 4 : 12;
  const pages = Math.ceil(batch.length / pageSize);
  deckPage = Math.min(deckPage, pages - 1);
  const groupCounts = pools.map(pool => batch.filter(animal => pool.includes(animal)).length);
  return `<section class="screen">${controls}
    <div class="gallery">${batch.slice(deckPage * pageSize, (deckPage + 1) * pageSize).map(a=>picture(a)).join("")}</div>
    <div class="bar deck-footer"><p>空中 ${groupCounts[0]} ・陸地 ${groupCounts[1]} ・水中 ${groupCounts[2]}</p>
      ${pages > 1 ? `<div class="tools">${button("deck-page","上一頁",{value:-1,disabled:deckPage===0})}
      <span>${deckPage+1} / ${pages}</span>${button("deck-page","下一頁",{value:1,disabled:deckPage===pages-1})}</div>` : ""}
      ${button("go","開始二分法",{value:"tree",style:"primary"})}</div></section>`;
}

function answer(animal) {
  return features[questionId].test(animal) ? "yes" : "no";
}

const sideLabel = { yes: "是", no: "否" };
const clues = {
  wings: "觀察身體兩側有沒有翅膀。",
  legs: "看牠有沒有用來在地面移動的腳。",
  six: "數一數牠的腳，觸角和翅膀不算在內。",
  feather: "觀察翅膀、尾巴或體表有沒有羽毛。",
  four: "數一數牠用來步行的腳。",
  shell: "觀察背上有沒有明顯的硬殼。",
  fin: "觀察是否有魚類的鰭。",
  eight: "數一數步足，靠近嘴巴的觸肢不算在內。",
  two: "數一數牠用來步行的腳。"
};

function tree() {
  if (!batch.length) return `<section class="screen"><h2>二分法</h2><div class="intro">
    <p>先抽一組動物圖卡，再用一個條件分成兩組。</p>
    <div>${button("go","前往抽圖卡",{value:"deck",style:"primary"})}</div></div></section>`;
  const animal = batch[current];
  const currentSide = placements.get(animal.id);
  const yesTotal = batch.filter(a=>answer(a)==="yes").length;
  const canSplit = yesTotal > 0 && yesTotal < batch.length;
  const mistakes = checked ? batch.filter(a=>placements.get(a.id)!==answer(a)) : [];
  const wrong = checked && currentSide !== answer(animal);
  const bucket = side => {
    const count = batch.filter(a => (checked ? answer(a) : placements.get(a.id)) === side).length;
    return button("place",`<strong>${sideLabel[side]}</strong><span>${side === "yes" ? "符合條件" : "不符合條件"}</span><small>${count} 張</small>`,
      {value:side, disabled:!canSplit || checked, pressed:checked ? answer(animal)===side : currentSide===side, style:"bucket"});
  };
  const prompt = checked
    ? mistakes.length ? `答對 ${batch.length - mistakes.length} / ${batch.length} 張。看看線索，再修正放錯的圖卡。` : `你用同一個條件，正確分完了 ${batch.length} 張圖卡！`
    : canSplit ? "把圖卡拖到「是」或「否」，也可以直接點選放置區。" : "這個條件會把所有圖卡放在同一邊，請換一個條件。";
  const detail = checked
    ? `${wrong ? "再觀察。你放在「" + sideLabel[currentSide] + "」，正確是「" + sideLabel[answer(animal)] + "」。" : "放對了。"}${clues[questionId]}`
    : currentSide ? `已放在「${sideLabel[currentSide]}」，可點另一側改放。` : "";
  return `<section class="screen tree">
    <div class="bar"><div><h2>用一個條件分成兩組</h2><p class="definition">符合條件的分一組，其餘分另一組。</p></div>
    ${select("question","分類條件",featureList.map(f=>[f.id,f.label+"嗎？"]),questionId)}</div>
    <div class="sort-area">
      <p class="prompt">${prompt}</p>
      <div class="sort-card"><span class="card-position">第 ${current + 1} / ${batch.length} 張</span>${picture(animal,canSplit && !checked)}</div>
      <div class="buckets">${bucket("yes")}${bucket("no")}</div>
      <p class="card-feedback" aria-live="polite">${detail}</p>
    </div>
    <div class="round-footer"><div class="card-index" aria-label="切換圖卡">${batch.map((a,i)=>{
      const placed = placements.get(a.id);
      const mark = checked ? (placed===answer(a) ? " ✓" : " ↺") : placed ? " ·" : "";
      const info = checked ? (placed===answer(a) ? "，正確" : "，需修正") : placed ? "，已放置" : "，待分類";
      return button("card",`<span aria-hidden="true">${i+1}${mark}</span><span class="sr-only">第 ${i+1} 張，${a.name}${info}</span>`,
      {value:i,pressed:i===current,style:checked && placed!==answer(a) ? "needs-review" : placed ? "placed" : ""});
    }).join("")}</div>
    <div class="bar"><div class="round-progress"><strong>已放 ${placements.size} / ${batch.length} 張</strong>
      <progress aria-label="圖卡分類進度" max="${batch.length}" value="${placements.size}"></progress></div>
      ${checked ? mistakes.length ? button("retry","修正錯卡",{style:"primary"}) :
        button("go","前往維恩圖",{value:"venn",style:"primary"}) :
        button("check","檢查答案",{disabled:placements.size!==batch.length,style:"primary"})}</div></div>
  </section>`;
}

function comparison() {
  const [left, right] = pair.map(id=>animals.find(a=>a.id===id));
  const labels = [[],[],[]];
  for (const feature of featureList) {
    const inLeft = feature.test(left);
    const inRight = feature.test(right);
    if (inLeft || inRight) labels[inLeft ? Number(inRight) : 2].push(feature.label);
  }
  if (!features.legs.test(left) && !features.legs.test(right)) labels[1].push("沒有步行用的腳");
  const correctZone = labels[1].length ? 1 : labels[0].length ? 0 : 2;
  return {left,right,labels,correctZone,challenge:labels[correctZone][0]};
}

function vennSolved() {
  const {challenge,correctZone} = comparison();
  return Boolean(challenge) && vennGuess === correctZone;
}

function venn() {
  const {left,right,labels,challenge} = comparison();
  const choices = animal => animals.filter(a=>a!==animal).map(a=>[a.id,a.name]);
  const solved = vennSolved();
  const showFeatures = !vennChallenge || solved;
  const question = showFeatures && solved
    ? vennChallenge ? "任務完成！你找對了特徵所在的區域。" : "答對了！試著換一種動物比較。"
    : `「${challenge}」應放在哪一區？${vennGuess===null ? "" : " 先判斷左邊有沒有這項特徵，再判斷右邊。"}`;
  return `<section class="screen compare">
    <div><h2>比較兩種動物</h2>
      <div class="pair-select">${select("left","左圈",choices(right),left.id)}${select("right","右圈",choices(left),right.id)}</div>
    </div>
    <div class="pair-pictures">${picture(left)}${picture(right)}</div>
    <div class="venn" role="group" aria-label="兩種動物的維恩圖" aria-describedby="venn-question">
      <svg viewBox="0 0 600 220" preserveAspectRatio="none" aria-hidden="true">
        <ellipse cx="205" cy="110" rx="199" ry="105" class="venn-left"/>
        <ellipse cx="395" cy="110" rx="199" ry="105" class="venn-right"/>
      </svg>
      ${["左邊獨有","共同特徵","右邊獨有"].map((label,i)=>`<section><h3>${button("zone",label,{value:i,pressed:vennGuess===i})}</h3>
        ${showFeatures ? (labels[i].length ? `<ul>${labels[i].map(item=>`<li>${item}</li>`).join("")}</ul>` : "<p>無列出的特徵</p>") : ""}</section>`).join("")}
    </div><div class="bar venn-footer ${solved ? "solved" : ""}"><p id="venn-question">${question}</p>
      ${solved && vennChallenge ? button("restart","再玩一輪",{style:"primary"}) : ""}</div></section>`;
}

function render(focus) {
  for (const button of tabs) {
    const stage = button.dataset.tab;
    const complete = {deck:batch.length>0,tree:sorted,venn:vennSolved()}[stage];
    button.classList.toggle("complete",complete);
    if (button.dataset.tab === tab) button.setAttribute("aria-current","page");
    else button.removeAttribute("aria-current");
  }
  activity.innerHTML = {deck,tree,venn}[tab]();
  if (!focus) return;
  const element = focus.id ? document.getElementById(focus.id) :
    [...activity.querySelectorAll("[data-action]:enabled")].find(button =>
      button.dataset.action === focus.action && button.dataset.value === focus.value);
  (element || activity).focus({preventScroll:true});
}

function navigate(destination, challenge = false) {
  if (destination === "venn" && challenge !== vennChallenge) {
    vennChallenge = challenge;
    vennGuess = null;
  }
  tab = destination;
  say();
  render();
  activity.focus({preventScroll:true});
}

function place(side) {
  placements.set(batch[current].id, side);
  const next = batch.findIndex((animal,index)=>index>current && !placements.has(animal.id));
  const first = batch.findIndex(animal=>!placements.has(animal.id));
  if (next !== -1 || first !== -1) current = next !== -1 ? next : first;
}

activity.addEventListener("click", event => {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const { action, value } = target.dataset;
  if (action === "go") { navigate(value, value === "venn" && sorted); return; }
  say();
  let focus = {action,value};
  switch (action) {
    case "draw":
      batch = sample(drawCount);
      deckPage = 0;
      questionId = "wings";
      resetRound();
      say(`已抽出 ${batch.length} 張圖卡。`);
      break;
    case "deck-page": deckPage += Number(value); break;
    case "card": current = Number(value); break;
    case "place":
      say(`${batch[current].name}已放在「${sideLabel[value]}」。`);
      place(value);
      if (placements.size === batch.length) focus = {action:"check",value:""};
      break;
    case "check": {
      checked = true;
      const firstWrong = batch.findIndex(animal=>placements.get(animal.id)!==answer(animal));
      sorted = firstWrong === -1;
      if (firstWrong !== -1) current = firstWrong;
      say(firstWrong === -1 ? "全部正確！" : "已顯示正確分組。");
      focus = {action:"card",value:String(current)};
      break;
    }
    case "retry":
      for (const animal of batch) {
        if (placements.get(animal.id) !== answer(animal)) placements.delete(animal.id);
      }
      current = batch.findIndex(animal=>!placements.has(animal.id));
      checked = false;
      focus = {action:"place",value:"yes"};
      say("已保留分對的卡，請重新分類剩下的圖卡。");
      break;
    case "zone":
      vennGuess = Number(value);
      say(vennSolved() ? "答對了！" : "再比較兩種動物。");
      break;
    case "restart":
      batch = [];
      resetRound();
      navigate("deck");
      return;
      break;
  }
  render(focus);
});

activity.addEventListener("change", event => {
  const {id,value} = event.target;
  if (id === "draw-count") { drawCount = Number(value); return; }
  if (id === "question") {
    questionId = value;
    const hadPlacements = placements.size > 0;
    resetRound();
    say(hadPlacements ? "已更換條件，請用新條件重新分類。" : "");
  }
  if (id === "left" || id === "right") {
    vennGuess = null;
    pair[id === "left" ? 0 : 1] = value;
    say(`已更新${pair.map(id=>animals.find(a=>a.id===id).name).join("和")}的維恩圖。`);
  }
  render({id});
});

activity.addEventListener("dragstart", event => {
  if (!event.target.closest('.sort-card figure[draggable="true"]')) return;
  event.dataTransfer.setData("text/plain",batch[current].id);
  event.dataTransfer.effectAllowed = "move";
});
activity.addEventListener("dragover", event => {
  if (event.target.closest(".bucket:enabled")) event.preventDefault();
});
activity.addEventListener("drop", event => {
  const bucket = event.target.closest(".bucket:enabled");
  if (!bucket || event.dataTransfer.getData("text/plain") !== batch[current].id) return;
  event.preventDefault();
  bucket.click();
});

tabs.forEach(button=>button.addEventListener("click",()=>navigate(button.dataset.tab)));
compact.addEventListener("change",()=>render());

const fullscreen = document.querySelector("#fullscreen");
fullscreen.addEventListener("click", async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    say("請使用瀏覽器的全螢幕功能。");
  }
});
document.addEventListener("fullscreenchange",()=>{
  const label = document.fullscreenElement ? "離開全螢幕" : "全螢幕";
  fullscreen.querySelector("span").textContent = label;
  fullscreen.setAttribute("aria-label", label);
});
render();
