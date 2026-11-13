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
let rootBranch;
let activeBranch;
let reviewBranch;
let selectedCard = "";
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
  rootBranch = newBranch(batch);
  activateBranch(batch.length ? rootBranch : null);
  reviewBranch = null;
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
      ${button("go","按我進行二分法",{value:"tree",style:"primary start-tree"})}</div></section>`;
}

const sideLabel = { yes: "是", no: "否" };
function branchLabel(side, question) {
  return questionLabel(question).startsWith("有") ? (side === "yes" ? "有" : "沒有") : sideLabel[side];
}
function newBranch(cards, path = []) {
  return {cards, path, question: "", placements: new Map(), children: []};
}

function nextBranch(node) {
  if (node.cards.length <= 1) return null;
  if (!node.children.length) return node;
  return node.children.map(nextBranch).find(Boolean) || null;
}

function leafCount(node) {
  if (!node.children.length) return Number(node.cards.length === 1);
  return node.children.reduce((count, child) => count + leafCount(child), 0);
}

function firstError(node) {
  if (!node.children.length) return null;
  if (node.cards.some(animal => node.placements.get(animal.id) !== answer(animal,node.question))) return node;
  return node.children.map(firstError).find(Boolean) || null;
}

function reviewTree(node) {
  const members = node.path.length
    ? '<div class="tree-members">' + node.cards.map(animal =>
      '<span><img src="assets/' + animal.id + '.svg" alt="">' + animal.name + '</span>').join("") + '</div>'
    : '<p>全部 ' + node.cards.length + ' 張圖卡</p>';
  const marker = node === activeBranch ? '<strong class="active-branch">目前分類</strong>' : "";
  const children = node.children.length
    ? '<ul>' + node.children.map((child,i) => '<li><strong>' +
      branchLabel(i === 0 ? "yes" : "no",node.question) + '</strong>' + reviewTree(child) + '</li>').join('') + '</ul>'
    : "";
  return '<div class="tree-node">' + marker +
    (node.question ? '<strong>' + questionLabel(node.question) + '</strong>' : "") +
    members + '</div>' + children;
}

function tree() {
  if (!batch.length) return '<section class="screen"><h2>二分法</h2><div class="intro"><p>先抽一組動物圖卡。</p>' +
    button("go","前往抽圖卡",{value:"deck",style:"primary"}) + '</div></section>';
  if (!activeBranch) {
    const message = sorted ? "全部正確！每隻動物都沿著符合特徵的路徑分類。"
      : reviewBranch ? "請修正第一個有錯的分支，然後繼續完成分類。"
      : "每個末端都剩一張圖卡。現在可以核對整棵樹。";
    return '<section class="screen"><h2>分類樹總覽</h2><div class="tree-review">' + reviewTree(rootBranch) +
      '</div><div class="bar tree-footer"><p>' + message + '</p>' +
      (sorted ? button("go","前往維恩圖",{value:"venn",style:"primary"}) :
        reviewBranch ? button("retry","修正分支",{style:"primary"}) :
        button("check","檢查整棵樹",{style:"primary"})) + '</div></section>';
  }
  const {cards,path,placements,question} = activeBranch;
  const options = availableQuestions(cards);
  const pending = cards.filter(animal => !placements.has(animal.id));
  const ready = Boolean(question);
  const emptySide = ready && !pending.length && new Set(placements.values()).size < 2;
  const bucket = side => {
    const assigned = cards.filter(animal => placements.get(animal.id) === side);
    return '<section class="branch-bin" data-bin="' + side + '"><h3>' +
      button("place",branchLabel(side,question || questionId) + ' · ' + assigned.length + ' 張',{value:side,disabled:!ready || !selectedCard,style:"bucket"}) +
      '</h3><div class="branch-cards">' + assigned.map(cardTile).join("") + '</div></section>';
  };
  return '<section class="screen tree"><div class="tree-heading"><div><h2>' +
    (ready ? "沿著分支放圖卡" : "設定這一組的分類條件") + '</h2><p>' +
    (path.length ? path.join(" → ") : "起點 · 全部圖卡") + '</p></div>' +
    (ready ? button("edit-tree","重設這組條件") :
      select("question","分類條件",options.map(id=>[id,questionLabel(id)]),questionId)) + '</div>' +
    '<div class="tree-board' + (rootBranch.children.length ? ' with-history' : '') + '">' +
    (rootBranch.children.length ? '<aside class="tree-review branch-history" aria-label="已完成的分支" tabindex="0"><h3>分類樹進度</h3>' + reviewTree(rootBranch) + '</aside>' : '') +
    '<section class="card-tray"><h3>待分類 · ' + pending.length + ' 張</h3>' +
    '<div class="tray-cards">' + pending.map(animal=>cardTile(animal,true)).join("") + '</div></section>' +
    '<div class="branch-tree" role="group" aria-label="二分分類樹"><p class="branch-root">' + questionLabel(question || questionId) + '</p>' +
    '<svg class="branch-lines" viewBox="0 0 400 48" preserveAspectRatio="none" aria-hidden="true"><path d="M200 0V10Q200 24 184 24H116Q100 24 100 38V48M200 10Q200 24 216 24H284Q300 24 300 38V48"/></svg>' +
    '<div class="buckets">' + bucket("yes") + bucket("no") + '</div></div></div>' +
    '<div class="bar tree-footer"><p>' + (emptySide ? "兩個分支都要有卡片。選一張卡重新放置。" :
      ready ? "點圖卡下方的答案，圖卡就會移到對應的分支。" : "選好條件後，可直接點圖卡下方的答案。") +
    ' <strong>已分到末端 ' + leafCount(rootBranch) + ' / ' + batch.length + ' 張</strong></p>' +
    (ready ? button("next-branch","完成這組",{disabled:pending.length>0 || emptySide,style:"primary"}) :
      button("confirm-tree","開始放圖卡",{style:"primary"})) + '</div></section>';
}

function cardTile(animal, inTray = false) {
  const ready = Boolean(activeBranch.question);
  const card = button("card",'<img src="assets/' + animal.id + '.svg" alt="" draggable="false"><span>' +
    animal.name + '</span>',{value:animal.id,disabled:!ready,pressed:selectedCard===animal.id,style:"tree-card"})
    .replace('type="button"', 'type="button" draggable="' + ready + '"');
  if (!inTray) return card;
  const choices = ["yes","no"].map(side => button("answer-card",
    branchLabel(side,activeBranch.question || questionId) + '<span class="sr-only">，' + animal.name + '</span>',
    {value:animal.id + ":" + side})).join("");
  return '<div class="tray-tile">' + card + '<div class="card-choices">' + choices + '</div></div>';
}

function questionLabel(id) {
  return (features[id]?.label || animals.find(animal=>animal.id===id)?.clue || "") + "嗎？";
}

function answer(animal,id) {
  const match = features[id] ? features[id].test(animal) : animal.id === id;
  return match ? "yes" : "no";
}

function availableQuestions(cards) {
  const shared = featureList.map(feature=>feature.id).filter(id=>
    cards.some(animal=>answer(animal,id)==="yes") && cards.some(animal=>answer(animal,id)==="no"));
  // A card-specific observation can separate animals with identical shared flags.
  return shared.length ? shared : cards.map(animal=>animal.id);
}

function activateBranch(node) {
  activeBranch = node;
  selectedCard = "";
  if (node) questionId = node.question || availableQuestions(node.cards)[0];
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
      <svg viewBox="0 0 600 280" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="venn-amber" x2="0" y2="1"><stop stop-color="#a46940"/><stop offset="1" stop-color="#503c30"/></linearGradient>
          <linearGradient id="venn-jade" x2="0" y2="1"><stop stop-color="#488872"/><stop offset="1" stop-color="#254d46"/></linearGradient>
          <clipPath id="venn-intersection"><ellipse cx="200" cy="140" rx="193" ry="131"/></clipPath>
        </defs>
        <ellipse cx="200" cy="140" rx="193" ry="131" class="venn-left"/>
        <ellipse cx="400" cy="140" rx="193" ry="131" class="venn-right"/>
        <ellipse cx="400" cy="140" rx="193" ry="131" fill="#345b51" clip-path="url(#venn-intersection)"/>
        <g fill="none" stroke-width="2" vector-effect="non-scaling-stroke">
          <ellipse cx="200" cy="140" rx="193" ry="131" stroke="#ffc388"/>
          <ellipse cx="400" cy="140" rx="193" ry="131" stroke="#aee6bf"/>
        </g>
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

function place(side, id) {
  if (!activeBranch?.question || !activeBranch.cards.some(animal=>animal.id===id)) return;
  activeBranch.placements.set(id,side);
  selectedCard = "";
  say(animals.find(animal=>animal.id===id).name + "已放到「" + branchLabel(side,activeBranch.question) + "」。");
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
    case "confirm-tree":
      activeBranch.question = questionId;
      focus = {action:"card",value:activeBranch.cards[0].id};
      break;
    case "edit-tree":
      activeBranch.question = "";
      activeBranch.placements.clear();
      selectedCard = "";
      focus = {id:"question"};
      say("已清空這一組的放置。");
      break;
    case "card":
      selectedCard = selectedCard === value ? "" : value;
      break;
    case "place":
      place(value,selectedCard);
      focus = afterPlacement();
      break;
    case "answer-card": {
      const [id,side] = value.split(":");
      activeBranch.question ||= questionId;
      place(side,id);
      focus = afterPlacement();
      if (focus.action === "card") focus = {action:"answer-card",value:focus.value + ":" + side};
      break;
    }
    case "next-branch": {
      const {cards,path,placements,question} = activeBranch;
      activeBranch.children = ["yes","no"].map(side =>
        newBranch(cards.filter(animal=>placements.get(animal.id)===side),[...path,questionLabel(question)+" "+branchLabel(side,question)]));
      activateBranch(nextBranch(rootBranch));
      focus = activeBranch ? {id:"question"} : {action:"check",value:""};
      break;
    }
    case "check":
      reviewBranch = firstError(rootBranch);
      sorted = !reviewBranch;
      if (reviewBranch) {
        const wrong = reviewBranch.cards.filter(animal=>reviewBranch.placements.get(animal.id)!==answer(animal,reviewBranch.question));
        say(questionLabel(reviewBranch.question) + " " + wrong.map(animal=>animal.name+"應放「"+branchLabel(answer(animal,reviewBranch.question),reviewBranch.question)+"」").join("、"));
      } else say("全部正確！");
      focus = {action:sorted ? "go" : "retry",value:sorted ? "venn" : ""};
      break;
    case "retry":
      reviewBranch.children = [];
      for (const animal of reviewBranch.cards) {
        if (reviewBranch.placements.get(animal.id)!==answer(animal,reviewBranch.question)) reviewBranch.placements.delete(animal.id);
      }
      activateBranch(reviewBranch);
      reviewBranch = null;
      focus = afterPlacement();
      say("已保留這組分對的卡。修正後，重新細分受影響的分支。");
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
    say();
  }
  if (id === "left" || id === "right") {
    vennGuess = null;
    pair[id === "left" ? 0 : 1] = value;
    say(`已更新${pair.map(id=>animals.find(a=>a.id===id).name).join("和")}的維恩圖。`);
  }
  render({id});
});

function afterPlacement() {
  const pending = activeBranch.cards.find(animal=>!activeBranch.placements.has(animal.id));
  return pending ? {action:"card",value:pending.id} : {action:"next-branch",value:""};
}

activity.addEventListener("dragstart", event => {
  const card = event.target.closest('.tree-card[draggable="true"]');
  if (!card) return;
  event.dataTransfer.setData("text/plain",card.dataset.value);
  event.dataTransfer.effectAllowed = "move";
});
activity.addEventListener("dragover", event => {
  if (activeBranch?.question && event.target.closest("[data-bin]")) event.preventDefault();
});
activity.addEventListener("drop", event => {
  const bin = event.target.closest("[data-bin]");
  if (!bin || !activeBranch?.question) return;
  event.preventDefault();
  place(bin.dataset.bin,event.dataTransfer.getData("text/plain"));
  render(afterPlacement());
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
