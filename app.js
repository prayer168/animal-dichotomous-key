const activity = document.querySelector("#activity");
const status = document.querySelector("#status");
const lookup = Object.fromEntries(animals.map(animal => [animal.id, animal]));
const questionById = Object.fromEntries(questions.map(question => [question.id, question]));
const sharedQuestions = questions.filter(question => Object.hasOwn(traits, question.id));
const tabButtons = [...document.querySelectorAll("[data-tab]")];
const size = matchMedia("(max-width: 690px)");
const short = matchMedia("(max-height: 650px)");
const escape = value => String(value).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll('"',"&quot;");
const questionText = question => question.label + "嗎？";
const animalNames = ids => ids.map(id => lookup[id].name).join("、");

let selected = [...presets[0][1]];
let tab = "deck";
let filter = "all";
let page = 0;
let root;
let activePath;
let history;
let draft;
let mapView;
let venn;
let quiz;
let teacher = false;

function resetActivities() {
  root = { ids: [...selected] };
  activePath = [];
  history = [];
  draft = null;
  mapView = false;
  venn = { a: "wings", b: "six", entries: {}, review: false, pending: false };
  quiz = null;
}

resetActivities();

function say(message = "", error = false) {
  status.textContent = message;
  status.dataset.error = error;
}
function action(name, label, options = {}) {
  const { value, disabled, primary, pressed, className = "", title } = options;
  return `<button type="button" data-action="${name}" ${value !== undefined ? `data-value="${escape(value)}"` : ""}
    ${disabled ? "disabled" : ""} ${pressed !== undefined ? `aria-pressed="${pressed}"` : ""}
    ${title ? `aria-label="${escape(title)}"` : ""} class="${className} ${primary ? "primary" : ""}">${label}</button>`;
}
function image(id, mystery = false) {
  const animal = lookup[id];
  return `<img src="assets/${id}.svg" width="240" height="160" alt="${mystery ? escape(animal.clue) : ""}">`;
}
function figure(id, mystery = false, draggable = false) {
  return `<figure class="panel focus-animal" ${draggable ? 'draggable="true"' : ""}>${image(id, mystery)}<figcaption>${mystery ? "觀察未知動物" : escape(lookup[id].name)}</figcaption></figure>`;
}
function options(items, current) {
  return items.map(([id, label]) => `<option value="${escape(id)}" ${String(id) === String(current) ? "selected" : ""}>${escape(label)}</option>`).join("");
}
function picker(id, label, items, current) {
  return `<select id="${id}" aria-label="${label}">${options(items, current)}</select>`;
}
function shell(title, body, controls = "", type = "") {
  return `<section class="screen ${type}"><h2>${title}</h2>${body}<div class="actions">${controls}</div></section>`;
}

function deck() {
  const columns = size.matches ? 2 : 4;
  const limit = columns * (short.matches ? 1 : 2);
  const visible = animals.filter(animal => filter === "all" || (filter === "selected" ? selected.includes(animal.id) : animal.group === Number(filter)));
  const pages = Math.max(1, Math.ceil(visible.length / limit));
  page = Math.min(page, pages - 1);
  const cards = visible.slice(page * limit, (page + 1) * limit);
  return `<section class="screen deck">
    <div class="deck-head"><h2>選擇 2～8 張圖卡</h2><div class="tools">
      ${picker("group","依移動情境篩選",[["all","全部 40 種"],...groups.map((group,i)=>[i,group]),["selected","已選圖卡"]],filter)}
      ${picker("preset","使用現成題組",[["","載入題組"],...presets.map(([label],i)=>[i,label])],"")}
    </div></div>
    <div class="deck-grid" style="--columns:${columns}">${cards.length ? cards.map(animal =>
      action("card",image(animal.id) + `<span>${escape(animal.name)}</span>`,{value:animal.id,pressed:selected.includes(animal.id),className:"animal"})
    ).join("") : "<p>目前沒有選取圖卡。可切換上方分類或載入題組。</p>"}</div>
    <div class="pager">
      ${action("page","上一頁",{value:-1,disabled:page===0})}
      <span aria-label="目前頁碼">${page+1} / ${pages}</span>
      ${action("page","下一頁",{value:1,disabled:page+1===pages})}
      <div class="tools">${action("clear","清空",{disabled:!selected.length})}
      ${action("start",`開始（${selected.length}）`,{disabled:selected.length<2,primary:true})}</div>
    </div>
  </section>`;
}

const getNode = path => path.reduce((node, side) => node[side], root);
const splitIds = (ids, question) => ({
  yes: ids.filter(id => question.test(lookup[id])),
  no: ids.filter(id => !question.test(lookup[id]))
});
const firstOpen = (node, path = []) => node.ids.length === 1 ? null :
  node.question ? firstOpen(node.yes,[...path,"yes"]) ?? firstOpen(node.no,[...path,"no"]) : path;
const ancestors = path => path.map((side,i) => ({ side, node: getNode(path.slice(0,i)) }));
function workingDraft(node) {
  if (!draft) {
    const candidate = questions.find(question => {
      const split = splitIds(node.ids, question);
      return split.yes.length && split.no.length;
    });
    draft = { id: candidate.id, answers: {}, checked: false };
  }
  return draft;
}
function tree() {
  if (compareTree) return comparison();
  if (selected.length < 2) return empty("二分法","先在圖卡庫選至少兩種動物。");
  const node = getNode(activePath);
  const trail = ancestors(activePath);
  const parent = action("parent","上層分支",{disabled:!activePath.length});
  const next = firstOpen(root);
  const undo = action("undo","撤銷分組",{disabled:!history.length});
  const toggle = action("map",mapView ? "回到分組" : "查看分支");
  if (mapView || node.question || node.ids.length === 1) {
    const example = node.ids[0];
    const last = trail.at(-1);
    const branch = node.question ? `<h3>${escape(questionText(questionById[node.question]))}</h3>
      <div class="branch-lines" aria-hidden="true"></div><div class="branches">${["yes","no"].map(side => action("branch",
        `${side === "yes" ? "是" : "否"} · ${node[side].ids.length} 張`,{value:side})).join("")}</div>
      <p class="branch-meta">${escape(animalNames(node.ids))}</p>`
      : `<h3>${node.ids.length === 1 ? "辨認結果" : "這組還能繼續分"}</h3><p>${escape(animalNames(node.ids))}</p>`;
    return shell("沿著二分樹查看分支",`<div class="workspace tree-map">${figure(example)}<div class="panel trail">
      <p class="branch-meta">${last ? `第 ${activePath.length} 層 · ${escape(last.node.question ? questionById[last.node.question].label : "")} → ${last.side === "yes" ? "是" : "否"}` : "起點 · 全部所選圖卡"}</p>
      ${branch}</div></div>`,
      parent + undo + (node.question || node.ids.length === 1
        ? next ? action("next-open","下一個待分組",{primary:true}) : action("quiz","開始辨認",{primary:true})
        : toggle));
  }
  const current = workingDraft(node);
  const unanswered = node.ids.find(id => !(id in current.answers));
  const question = questionById[current.id];
  const split = splitIds(node.ids,question);
  const answerCount = Object.keys(current.answers).length;
  const picture = unanswered || node.ids[0];
  const manual = `<h3>${escape(questionText(question))}</h3>
    <div class="answers">${action("classify","是",{value:"yes",disabled:!unanswered})}
    ${action("classify","否",{value:"no",disabled:!unanswered})}</div>
    <p class="branch-meta">已分 ${answerCount} / ${node.ids.length} 張</p>`;
  const revealed = `<div class="branches"><div><strong>是 · ${split.yes.length} 張</strong><p>${escape(animalNames(split.yes) || "空組")}</p></div>
    <div><strong>否 · ${split.no.length} 張</strong><p>${escape(animalNames(split.no) || "空組")}</p></div></div>
    ${split.yes.length && split.no.length ? action("save-split","加入二分樹",{primary:true}) :
      '<p class="branch-meta">這個問題沒把動物分成兩組。換一個條件試試。</p>'}`;
  return shell("用一個問題分成兩組",`<div class="workspace">${figure(picture)}
    <div class="panel controls"><label for="question">選擇特徵問題</label>
    ${picker("question","選擇特徵問題",questions.filter(q => Object.hasOwn(traits,q.id) || node.ids.includes(q.id)).map(q=>[q.id,questionText(q)]),current.id)}
    ${current.checked ? revealed : manual}</div></div>`,
    parent + undo + toggle +
    (current.checked ? "" : teacher ? action("reveal","揭曉分組",{primary:true}) : action("reveal",unanswered ? "查看正確分組" : "核對分組",{primary:!unanswered})));
}
function empty(title, description, button = "前往選圖卡", destination = "deck") {
  return shell(title,`<div class="panel result"><p>${description}</p><div>${action("navigate",button,{value:destination,primary:true})}</div></div>`);
}

const zoneNames = ["只符合甲","甲乙都符合","只符合乙","都不符合"];
const vennZone = id => {
  const a = questionById[venn.a].test(lookup[id]);
  const b = questionById[venn.b].test(lookup[id]);
  return a ? (b ? 1 : 0) : (b ? 2 : 3);
};
function vennScreen() {
  if (selected.length < 2) return empty("維恩圖","先在圖卡庫選至少兩種動物。");
  const current = selected.find(id => !(id in venn.entries));
  const assigned = Object.keys(venn.entries).length;
  const count = zone => Object.values(venn.entries).filter(value => value === zone).length;
  const zoneButton = zone => action("zone",`${zoneNames[zone]}<span class="zone-count">${count(zone)} 張</span>`,
    {value:zone, title:`${zoneNames[zone]}，${count(zone)} 張`,className:zone===3?"outside":"",disabled:venn.pending});
  const board = `<div class="panel venn-board" aria-label="維恩圖">
    <div class="venn-zones">
      <svg viewBox="0 0 410 220" preserveAspectRatio="none" aria-hidden="true">
        <ellipse cx="139" cy="110" rx="134" ry="102" fill="#f2dacb"/>
        <ellipse cx="271" cy="110" rx="134" ry="102" fill="#dce8e4" style="mix-blend-mode:multiply"/>
        <ellipse cx="139" cy="110" rx="134" ry="102" fill="none" stroke="#8c3d2e" stroke-width="2.5"/>
        <ellipse cx="271" cy="110" rx="134" ry="102" fill="none" stroke="#295844" stroke-width="2.5"/>
      </svg>${[0,1,2].map(zoneButton).join("")}
    </div>${zoneButton(3)}</div>`;
  const review = venn.review !== false && `<div class="panel result"><h3>${zoneNames[venn.review]}</h3>
    <p>${escape(animalNames(selected.filter(id=>venn.entries[id]===venn.review)) || "這區目前是空的。")}</p>
    <p>分別問一次甲和乙，二分樹的兩次答案會對應到這個區域。</p>
    <div>${action("venn-back","返回維恩圖")}</div></div>`;
  const lead = `<div class="venn-select">
    <label for="venn-a">條件甲${picker("venn-a","條件甲",sharedQuestions.filter(q=>q.id!==venn.b).map(q=>[q.id,q.label]),venn.a)}</label>
    <label for="venn-b">條件乙${picker("venn-b","條件乙",sharedQuestions.filter(q=>q.id!==venn.a).map(q=>[q.id,q.label]),venn.b)}</label>
    </div>`;
  return `<section class="screen"><div>${lead}</div>
    <div class="workspace venn-workspace">
      ${current && !review ? figure(current,false,true) : `<div class="panel result"><h2>${review ? "查看區域" : venn.pending ? "預測完成" : "完成維恩圖"}</h2><p>${review ? "查看這個區域的動物。" : venn.pending ? "按「揭曉位置」和全班一起核對。" : "點選各區域查看動物，或把同樣兩個條件轉成二分樹。"}</p></div>`}
      ${review || board}
    </div>
    <div class="actions">
      <strong>已放 ${assigned} / ${selected.length} 張</strong>
      ${action("venn-reset","重放",{disabled:!assigned})}
      ${teacher && (assigned < selected.length || venn.pending) ? action("venn-reveal","揭曉位置",{primary:true}) : ""}
      ${assigned === selected.length && !venn.pending ? action("compare","對照二分樹",{primary:true}) : ""}
    </div>
  </section>`;
}

function initializeQuiz() {
  const previous = quiz?.id;
  const choices = selected.filter(id => id !== previous);
  quiz = { id: choices[Math.floor(Math.random()*choices.length)], path: [], done: false };
}
function quizScreen() {
  if (selected.length < 2 || firstOpen(root)) return empty("辨認挑戰","完成二分樹，才能沿著問題辨認未知動物。","前往二分法","tree");
  if (!quiz) initializeQuiz();
  const node = getNode(quiz.path);
  return shell(quiz.done ? "辨認成功" : "沿著二分樹找出牠",
    `<div class="workspace">${figure(quiz.id,!quiz.done)}<div class="panel controls">
      ${quiz.done ? `<h3>${escape(lookup[quiz.id].name)}</h3><p>你回答了 ${quiz.path.length} 個特徵問題。</p>` :
        `<h3>${escape(questionText(questionById[node.question]))}</h3>
        <div class="answers">${action("guess","是",{value:"yes"})}${action("guess","否",{value:"no"})}</div>`}
    </div></div>`,
    quiz.done ? action("another","再辨認一隻",{primary:true}) :
    `<strong>第 ${quiz.path.length+1} 個問題</strong>` + action("hint","給我提示"));
}

function render(focus = null) {
  tabButtons.forEach(button => {
    if (button.dataset.tab === tab) button.setAttribute("aria-current","page");
    else button.removeAttribute("aria-current");
  });
  activity.innerHTML = {deck,tree,venn:vennScreen,quiz:quizScreen}[tab]();
  if (focus) {
    const replacement = focus.id ? document.getElementById(focus.id) :
      [...activity.querySelectorAll("[data-action]")].find(button =>
        button.dataset.action === focus.dataset.action && button.dataset.value === focus.dataset.value && !button.disabled);
    (replacement || activity).focus({preventScroll:true});
  }
}
function navigate(destination) {
  tab = destination;
  say();
  render();
  activity.focus({preventScroll:true});
}
function changeSelection(ids) {
  selected = ids;
  resetActivities();
  say(`已選 ${selected.length} 張圖卡。`);
}
function selectNext() {
  activePath = firstOpen(root) ?? [];
  mapView = !firstOpen(root);
  draft = null;
  quiz = null;
}
function hintText(question) {
  return Object.hasOwn(traits,question.id) ? `再觀察圖上的線索，想想牠是否「${question.label}」。` :
    `仔細對照這個線索：${question.label}。`;
}

const handlers = {
  navigate: value => navigate(value),
  card: value => {
    if (selected.includes(value)) changeSelection(selected.filter(id=>id!==value));
    else if (selected.length < 8) changeSelection([...selected,value]);
    else say("一次最多選 8 張。取消一張後再加入。",true);
  },
  page: value => { page += Number(value); },
  clear: () => changeSelection([]),
  start: () => navigate("tree"),
  parent: () => { activePath.pop(); draft=null; mapView=true; },
  branch: value => { activePath.push(value); draft=null; mapView=true; },
  map: () => { mapView=!mapView; },
  "next-open": () => { selectNext(); },
  undo: () => {
    activePath = history.pop();
    const node = getNode(activePath);
    delete node.question;
    delete node.yes;
    delete node.no;
    draft=null; mapView=false; quiz=null;
    say("已撤銷最後一次分組。");
  },
  classify: value => {
    const node=getNode(activePath);
    const id=node.ids.find(animal=>!(animal in draft.answers));
    if (!id) return;
    draft.answers[id]=value;
    say(`已把${lookup[id].name}放到「${value==="yes"?"是":"否"}」。`);
  },
  reveal: () => {
    draft.checked=true;
    const question=questionById[draft.id];
    const errors=Object.entries(draft.answers).filter(([id,value])=>question.test(lookup[id])!==(value==="yes")).map(([id])=>id);
    say(errors.length ? `再觀察 ${errors.length} 張：${animalNames(errors)}。` : "已顯示正確分組。",Boolean(errors.length));
  },
  "save-split": () => {
    const node=getNode(activePath);
    const split=splitIds(node.ids,questionById[draft.id]);
    node.question=draft.id;
    node.yes={ids:split.yes};
    node.no={ids:split.no};
    history.push([...activePath]);
    selectNext();
    say(firstOpen(root) ? "已加入分支。繼續分下一組。" : "二分樹完成，可以開始辨認。");
  },
  zone: value => {
    if (venn.pending) return;
    const id=selected.find(animal=>!(animal in venn.entries));
    const zone=Number(value);
    if (!id) { venn.review=zone; return; }
    if (vennZone(id)!==zone && !teacher) {
      say("把甲、乙分開判斷，再選一次位置。",true);
      return;
    }
    venn.entries[id]=zone;
    venn.pending=teacher && Object.keys(venn.entries).length===selected.length;
    say(teacher ? "已記下預測。" : "放對了。");
  },
  "venn-back": () => { venn.review=false; },
  "venn-reset": () => { venn.entries={}; venn.review=false; venn.pending=false; },
  "venn-reveal": () => {
    venn.entries=Object.fromEntries(selected.map(id=>[id,vennZone(id)]));
    venn.pending=false;
    say("已揭曉各區正確位置。");
  },
  compare: () => {
    tab="tree";
    compareTree=true;
    compareSide=null;
    say("先看條件甲，再展開兩邊看條件乙。");
  },
  quiz: () => navigate("quiz"),
  guess: value => {
    const node=getNode(quiz.path);
    const question=questionById[node.question];
    if (question.test(lookup[quiz.id])!==(value==="yes")) {
      say(hintText(question),true);
      return;
    }
    quiz.path.push(value);
    quiz.done=getNode(quiz.path).ids.length===1;
    say(quiz.done ? "辨認成功！" : "這個特徵符合。繼續下一題。");
  },
  hint: () => say(hintText(questionById[getNode(quiz.path).question])),
  another: () => initializeQuiz(),
  teacher: () => {
    teacher=!teacher;
    if (!teacher && Object.entries(venn.entries).some(([id,zone])=>vennZone(id)!==zone)) {
      venn.entries={};
      venn.review=false;
    }
    if (!teacher) venn.pending=false;
    say(teacher?"教師示範模式已開啟。":"回到學生練習模式。");
  }
};

let compareTree=false;
let compareSide=null;
function comparison() {
  const conditionA=questionById[venn.a];
  const conditionB=questionById[venn.b];
  const zoneInfo=zone=>`<div><h3>${zoneNames[zone]}</h3><p>${escape(animalNames(selected.filter(id=>vennZone(id)===zone)) || "空組")}</p></div>`;
  const content=compareSide===null
    ? `<h3>甲 · ${escape(questionText(conditionA))}</h3><div class="branches">
      ${action("compare-side","是",{value:"yes"})}${action("compare-side","否",{value:"no"})}</div>`
    : `<p>條件甲的答案是「${compareSide==="yes"?"是":"否"}」</p>
      <h3>乙 · ${escape(questionText(conditionB))}</h3><div class="branches">
      ${compareSide==="yes" ? zoneInfo(1)+zoneInfo(0) : zoneInfo(2)+zoneInfo(3)}</div>`;
  return shell("同一組條件的二分樹",`<div class="panel result">${content}</div>`,
    (compareSide===null?"":action("compare-root","回到條件甲")) + action("exit-compare","返回維恩圖",{primary:true}));
}
handlers["compare-side"]=value=>{compareSide=value;};
handlers["compare-root"]=()=>{compareSide=null;};
handlers["exit-compare"]=()=>{
  compareTree=false; compareSide=null; navigate("venn");
};

activity.addEventListener("click",event=>{
  const button=event.target.closest("[data-action]");
  if (!button) return;
  say();
  handlers[button.dataset.action](button.dataset.value);
  if (!["navigate","start","quiz","exit-compare"].includes(button.dataset.action)) render(button);
});
activity.addEventListener("dragstart",event=>{
  if (tab!=="venn" || !event.target.closest("figure[draggable=true]")) return;
  event.dataTransfer.setData("text/plain","animal-card");
  event.dataTransfer.effectAllowed="move";
});
activity.addEventListener("dragover",event=>{
  if (event.target.closest('button[data-action="zone"]:enabled')) event.preventDefault();
});
activity.addEventListener("drop",event=>{
  const target=event.target.closest('button[data-action="zone"]:enabled');
  if (!target || event.dataTransfer.getData("text/plain")!=="animal-card") return;
  event.preventDefault();
  target.click();
});
activity.addEventListener("change",event=>{
  const control=event.target;
  if (control.id==="group") { filter=control.value; page=0; }
  if (control.id==="preset" && control.value!=="") {
    changeSelection([...presets[Number(control.value)][1]]);
    filter="selected"; page=0;
  }
  if (control.id==="question") draft={id:control.value,answers:{},checked:false};
  if (control.id==="venn-a" || control.id==="venn-b") {
    venn[control.id.at(-1)]=control.value;
    venn.entries={};
    venn.review=false;
    venn.pending=false;
    say("已換條件，請重新放置圖卡。");
  }
  render(control);
});
tabButtons.forEach(button=>button.addEventListener("click",()=>{
  compareTree=false; compareSide=null;
  navigate(button.dataset.tab);
}));

const fullscreen=document.querySelector("#fullscreen");
const teacherButton=document.createElement("button");
teacherButton.type="button";
teacherButton.className="quiet";
teacherButton.textContent="教師示範";
teacherButton.setAttribute("aria-pressed","false");
const headerControls=document.createElement("div");
headerControls.className="tools";
fullscreen.before(headerControls);
headerControls.append(teacherButton,fullscreen);
teacherButton.addEventListener("click",()=>{
  handlers.teacher();
  teacherButton.setAttribute("aria-pressed",String(teacher));
  render();
});
fullscreen.addEventListener("click",async()=>{
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
    else say("此瀏覽器可使用自己的全螢幕或隱藏工具列功能。",true);
  } catch { say("無法進入全螢幕，請使用瀏覽器的全螢幕功能。",true); }
});
document.addEventListener("fullscreenchange",()=>{
  const label=document.fullscreenElement?"離開全螢幕":"全螢幕";
  fullscreen.querySelector("span").textContent=label;
  fullscreen.setAttribute("aria-label",label);
});
size.addEventListener("change",()=>render());
short.addEventListener("change",()=>render());
render();
