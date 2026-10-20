import assert from "node:assert/strict";
import test from "node:test";

const hooks = new Map();
globalThis.Hooks = {
  once: (key, fn) => hooks.set(key, [...(hooks.get(key) ?? []), fn]),
  on: (key, fn) => hooks.set(key, [...(hooks.get(key) ?? []), fn])
};
const broadcasts = [];
const socketHandlers = new Map();
const notices = [];
globalThis.CONST = { DOCUMENT_OWNERSHIP_LEVELS: { OWNER: 3 } };

class FakeEl {
  constructor(tag = "div") {
    this.tagName = tag;
    this.parentElement = null;
    this.ownerDocument = doc;
    this.children = [];
    this.dataset = {};
    this.style = {};
    this.attributes = {};
    this.listeners = new Map();
    this.className = "";
    this.id = "";
    this.textContent = "";
    this.disabled = false;
    this.draggable = false;
    this._classes = new Set();
    this.classList = {
      add: (...vals) => vals.forEach(x => this._classes.add(x)),
      remove: (...vals) => vals.forEach(x => this._classes.delete(x)),
      contains: x => this._classes.has(x)
    };
  }
  append(...els) {for(const el of els) {el.parentElement = this;this.children.push(el);}}
  insertBefore(el, other) {
    el.parentElement = this;
    const index = this.children.indexOf(other);
    this.children.splice(index < 0 ? 0 : index, 0, el);
  }
  remove() {
    if(!this.parentElement)return;
    this.parentElement.children = this.parentElement.children.filter(x => x!==this);
    this.parentElement = null;
  }
  replaceChildren(...els) {this.children=[];this.textContent = els.map(x=>x.textContent??"").join("");for(const e of els) this.append(e);}
  setAttribute(k,v){this.attributes[k] = String(v);}
  addEventListener(k,fn){this.listeners.set(k,fn);}
  closest(sel){for(let x=this;x;x=x.parentElement) if(x.matches(sel)) return x;return null;}
  matches(sel){
    if (sel.startsWith("."))return (this.className.split(" ").includes(sel.slice(1)) || this._classes.has(sel.slice(1)));
    if (sel.startsWith("#"))return this.id===sel.slice(1);
    if (sel.startsWith("li.combatant"))return this.tagName==="li"&&this.className.split(" ").includes("combatant")&&this.dataset.combatantId;
    return sel.toLowerCase() === this.tagName.toLowerCase();
  }
  querySelectorAll(query){
    const sels=query.split(",").map(x=>x.trim());
    const all=[];
    const walk=x=>{for(const child of x.children??[]){all.push(child);walk(child);}};
    walk(this);
    return all.filter(x=>typeof x.matches === "function" && sels.some(s=>x.matches(s)));
  }
  querySelector(query){return this.querySelectorAll(query)[0]??null;}
  getBoundingClientRect(){return{top:0,height:100};}
}
const doc = {createElement:tag=>new FakeEl(tag), createTextNode:text=>({textContent:text}), querySelectorAll:()=>[]};
globalThis.document=doc;
globalThis.game={
  ready:true, user:{id:"gm",isGM:true,active:true},
  settings:{register(){},get(){return true;}},
  socket:{on(k,fn){socketHandlers.set(k,fn);},emit(...args){broadcasts.push(args);}},
  users:[], combats:{viewed:null,get(){return null;}}
};
game.users.push(game.user);
globalThis.ui={combat:{rendered:false,popout:null},notifications:{info:x=>notices.push(x),warn:x=>notices.push(x),error:x=>notices.push(x)}};
class CombatTracker {constructor(viewed){this.viewed=viewed;}}
globalThis.foundry={applications:{sidebar:{tabs:{CombatTracker}},api:{DialogV2:{confirm:async()=>true}}}};
await import("../scripts/main.mjs");
for(const fn of hooks.get("init")??[])fn();
for(const fn of hooks.get("ready")??[])fn();

const flagsKey = "wod20-initiative-tool";
function actor(owner) {
  return {id:owner,system:{attributes:{hp:{value:5,max:8}}},testUserPermission(user){return user.id===owner;}};
}
function makeCombat() {
  const entries=[{id:"A",name:"Alice",initiative:20,actor:actor("owner-A")},{id:"B",name:"Bob",initiative:15,actor:actor("owner-B")},{id:"C",name:"Carl",initiative:10,actor:actor("owner-C")}];
  const combat = {
    id:"encounter-1",round:1,turn:0,started:true,turns:entries,
    combatants:{contents:entries,get(id){return entries.find(c=>c.id===id)??null;}},
    _flags:{},
    getFlag(scope,key){return this._flags[key]??null;},
    async setFlag(scope,key,value){this._flags[key]=value;return value;},
    async update(changed){
      for(const fn of hooks.get("preUpdateCombat")??[])if(fn(this,changed,{})===false) return false;
      for(const [k,v] of Object.entries(changed)){
        if(k.startsWith(`flags.${flagsKey}.`))this._flags[k.split(".").at(-1)] = v;
        else this[k]=v;
      }
      return this;
    },
    async updateEmbeddedDocuments(type,updates){
      for(const u of updates){
        const c=this.combatants.get(u._id);
        for(const fn of hooks.get("preUpdateCombatant")??[])if(fn(c,u,{wod20InitiativeToolBypass:true})===false)return[];
        c.initiative=u.initiative;
      }
      this.turns=this.combatants.contents.slice().sort((a,b)=>b.initiative-a.initiative);
      return updates;
    },
    async nextTurn(){
      let changed={turn:this.turn+1};
      if(changed.turn>=this.turns.length)changed={round:this.round+1,turn:0};
      await this.update(changed);
    },
    async nextRound(){await this.update({round:this.round+1,turn:0});},
    async previousTurn(){await this.update({turn:Math.max(0,this.turn-1)});}
  };
  Object.defineProperty(combat,"combatant",{get(){return this.turns[this.turn]??null;}});
  return combat;
}
function setup() {
  const combat = makeCombat();
  game.combats.viewed=combat;game.combats.get=id=>id===combat.id?combat:null;
  game.combat=combat;
  const root=new FakeEl("section");
  const list=new FakeEl("ol");list.id="combat-tracker";list.className="combatants";
  root.append(list);
  for(const c of combat.turns){
    const row=new FakeEl("li");row.className="combatant";row.dataset.combatantId=c.id;
    const name=new FakeEl("h4");name.className="token-name";name.textContent=c.name;
    row.append(name);list.append(row);
  }
  doc.querySelectorAll = query=>root.querySelectorAll(query);
  const app=new CombatTracker(combat);
  function render(){for(const fn of hooks.get("renderCombatTracker")??[])fn(app,root);}
  async function click(el){assert.ok(el,"button should be present");await el.listeners.get("click")({preventDefault(){},stopPropagation(){}});}
  function row(id){return list.children.find(x=>x.dataset.combatantId===id);}
  function button(id,cls){return row(id).querySelector(`.wod20-initiative-tool-${cls}`);}
  return {combat,root,list,app,render,click,row,button};
}

test("Lock label changes immediately and survives repeated CombatTracker renders",async()=>{
  const x=setup();x.render();
  const first=x.root.querySelector(".wod20-initiative-tool-lock");
  assert.equal(first.textContent,"Lock Initiative");
  await x.click(first);
  assert.equal(x.combat.getFlag(flagsKey,"locked"),true);
  assert.equal(first.textContent,"Unlock Initiative");
  x.render();
  assert.equal(x.root.querySelectorAll(".wod20-initiative-tool-toolbar").length,1);
  assert.equal(x.root.querySelector(".wod20-initiative-tool-lock").textContent,"Unlock Initiative");
  await x.click(x.root.querySelector(".wod20-initiative-tool-lock"));
  assert.equal(x.combat.getFlag(flagsKey,"locked"),false);
  x.render();
  assert.equal(x.root.querySelector(".wod20-initiative-tool-lock").textContent,"Lock Initiative");
});

test("Delay ends active turn, Rejoin adds new spot after current actor",async()=>{
  const x=setup();x.render();
  assert.ok(x.button("A","delay"));
  assert.equal(x.button("B","delay"),null);
  await x.click(x.button("A","delay"));
  assert.equal(x.combat.combatant.id,"B");
  assert.equal(x.combat.getFlag(flagsKey,"delayed").A,1);
  x.render();
  assert.ok(x.button("A","rejoin"));
  await x.click(x.button("A","rejoin"));
  assert.equal(x.combat.getFlag(flagsKey,"delayed").A,undefined);
  assert.deepEqual(x.combat.turns.map(c=>c.id),["B","A","C"]);
  assert.equal(x.combat.combatant.id,"B");
  await x.combat.nextTurn();
  assert.equal(x.combat.combatant.id,"A");
});

test("GM health indicators appear without changing actors or showing elsewhere",()=>{
  const x=setup();x.render();
  for(const id of ["A","B","C"]) {
    const h=x.row(id).querySelector(".wod20-initiative-tool-health");
    assert.ok(h);
    assert.match(h.title, /5\/8/);
  }
  x.render();
  assert.equal(x.row("A").querySelectorAll(".wod20-initiative-tool-health").length,1);
});

test("Dragging the ACTIVE combatant continues to the old next participant",async()=>{
  const x=setup();x.render();
  const drag=x.row("A").querySelector(".wod20-initiative-tool-handle");
  assert.ok(drag);
  const dataTransfer={setData(){},effectAllowed:"",dropEffect:""};
  x.root.listeners.get("dragstart")({target:drag,dataTransfer,stopPropagation(){}});
  await x.root.listeners.get("drop")({
    target:x.row("C"),dataTransfer,clientY:95,preventDefault(){},stopPropagation(){}
  });
  assert.deepEqual(x.combat.turns.map(c=>c.id),["B","C","A"]);
  assert.equal(x.combat.combatant.id,"B");
  await x.combat.nextTurn();
  assert.equal(x.combat.combatant.id,"C");
});

test("Dragging a different combatant keeps current active actor",async()=>{
  const x=setup();x.render();
  const drag=x.row("B").querySelector(".wod20-initiative-tool-handle");
  const dt={setData(){}};
  x.root.listeners.get("dragstart")({target:drag,dataTransfer:dt,stopPropagation(){}});
  await x.root.listeners.get("drop")({target:x.row("C"),dataTransfer:dt,clientY:95,preventDefault(){},stopPropagation(){}});
  assert.deepEqual(x.combat.turns.map(c=>c.id),["A","C","B"]);
  assert.equal(x.combat.combatant.id,"A");
});

test("Player tracker only exposes health and Delay control for owned combatant",()=>{
  const oldUser=game.user;
  const x=setup();
  game.user={id:"owner-A",isGM:false,active:true};
  try{
    x.render();
    assert.ok(x.row("A").querySelector(".wod20-initiative-tool-health"));
    assert.equal(x.row("B").querySelector(".wod20-initiative-tool-health"),null);
    assert.equal(x.row("B").querySelector(".wod20-initiative-tool-delay"),null);
    assert.ok(x.row("A").querySelector(".wod20-initiative-tool-delay"));
    assert.equal(x.row("A").querySelector(".wod20-initiative-tool-handle"),null);
  }finally{game.user=oldUser;}
});


test("Owning player Delay request is executed once by GM over the module socket",async()=>{
  const x=setup();
  const gm=game.user;
  const player={id:"owner-A",isGM:false,active:true};
  game.users.push(player);
  game.users.get=id=>game.users.find(u=>u.id===id);
  const start=broadcasts.length;
  try {
    game.user=player;
    x.render();
    await x.click(x.button("A","delay"));
    const request=broadcasts[start]?.[1];
    assert.deepEqual([request.type,request.action,request.combatantId,request.userId],["request","delay","A","owner-A"]);
    game.user=gm;
    await socketHandlers.get("module.wod20-initiative-tool")(request);
    assert.equal(x.combat.combatant.id,"B");
    assert.equal(x.combat.getFlag(flagsKey,"delayed").A,1);
    const response=broadcasts.at(-1)?.[1];
    assert.equal(response.type,"result");
    assert.equal(response.ok,true);
    // A request to move someone else's combatant is rejected by the GM.
    const before=x.combat.turn;
    await socketHandlers.get("module.wod20-initiative-tool")({type:"request",action:"delay",combatId:x.combat.id,combatantId:"B",userId:"owner-A"});
    assert.equal(x.combat.turn,before);
  }finally {
    game.user=gm;
    game.users.splice(game.users.indexOf(player),1);
  }
});


test("GM drag with consecutive integers keeps whole scores and prior next turn", async () => {
  const x = setup();
  x.combat.combatants.contents[0].initiative = 12;
  x.combat.combatants.contents[1].initiative = 11;
  x.combat.combatants.contents[2].initiative = 10;
  x.render();
  const drag = x.row("A").querySelector(".wod20-initiative-tool-handle");
  const dataTransfer = {setData(){},effectAllowed:"",dropEffect:""};
  x.root.listeners.get("dragstart")({target:drag,dataTransfer,stopPropagation(){}});
  await x.root.listeners.get("drop")({target:x.row("C"),dataTransfer,clientY:95,preventDefault(){},stopPropagation(){}});
  assert.deepEqual(x.combat.turns.map(c=>c.id),["B","C","A"]);
  assert.deepEqual(x.combat.turns.map(c=>c.initiative),[11,10,9]);
  assert.equal(x.combat.combatant.id,"B");
});

test("Rejoin between consecutive scores preserves integers and current turn", async () => {
  const x = setup();
  x.combat.combatants.contents[0].initiative = 12;
  x.combat.combatants.contents[1].initiative = 11;
  x.combat.combatants.contents[2].initiative = 10;
  x.render();
  await x.click(x.button("A", "delay"));
  assert.equal(x.combat.combatant.id, "B");
  x.render();
  await x.click(x.button("A", "rejoin"));
  assert.deepEqual(x.combat.turns.map(c=>c.id),["B","A","C"]);
  assert.ok(x.combat.turns.every(c=>Number.isInteger(c.initiative)));
  assert.equal(x.combat.combatant.id,"B");
  await x.combat.nextTurn();
  assert.equal(x.combat.combatant.id,"A");
});
