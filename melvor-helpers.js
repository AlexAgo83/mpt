// Melvor Idle console helpers — inject via evaluate_script at the start of a session.
// Everything hangs off window.mh to avoid polluting the game's global scope.
(() => {
  const mh = {};

  // Multi-tab: every in-game tab answers the ping with its character name.
  // Multiple characters are allowed, the same character in two tabs is not.
  mh._bc = new BroadcastChannel('mh-active-chars');
  mh._bc.onmessage = (e) => {
    if (e.data === 'who?' && typeof game !== 'undefined' && game.loopStarted)
      mh._bc.postMessage({ loaded: game.characterName });
  };
  mh.activeCharacters = () => new Promise(res => {
    const found = [];
    const h = (e) => { if (e.data?.loaded) found.push(e.data.loaded); };
    mh._bc.addEventListener('message', h);
    mh._bc.postMessage('who?');
    setTimeout(() => { mh._bc.removeEventListener('message', h); res(found); }, 600);
  });

  // Selection screen: load a cloud character by name (handles the local/cloud toggle,
  // the async slot list, and the confirmation popup).
  // Refuses if the character is already open in another tab.
  mh.loadCharacter = async (name) => {
    const open = await mh.activeCharacters();
    if (open.includes(name)) return `refused: "${name}" already open in another tab`;
    if (/DEMO VERSION|Buy the Full Game or Sign in/i.test(document.body.innerText))
      return 'refused: not signed in to cloud';
    let btn = null;
    for (let i = 0; i < 30 && !btn; i++) {
      // the toggle can appear late: retry it on every iteration
      const toggle = [...document.querySelectorAll('button')].find(b => /Show Cloud Saves/i.test(b.innerText));
      if (toggle) { toggle.click(); await new Promise(r => setTimeout(r, 1000)); }
      // not .btn-gamemode-standard: the class varies with the character's game mode
      btn = [...document.querySelectorAll('button[class*="btn-gamemode"]')]
        .find(b => b.innerText.includes(name));
      if (!btn) await new Promise(r => setTimeout(r, 1000));
    }
    if (!btn) return `no save button for "${name}"`;
    if (/Local Save/i.test(btn.innerText)) return `refused: "${name}" is only visible as a local save`;
    btn.click();
    await new Promise(r => setTimeout(r, 800));
    const confirm = [...document.querySelectorAll('.swal2-popup button')]
      .find(b => /confirm/i.test(b.innerText));
    if (confirm) confirm.click();
    return `loading ${name}...`;
  };

  mh.loadLocalCharacter = async (name) => {
    const open = await mh.activeCharacters();
    if (open.includes(name)) return `refused: "${name}" already open in another tab`;
    const toggle = [...document.querySelectorAll('button')].find(b => /Show Local Saves/i.test(b.innerText));
    if (toggle) {
      toggle.click();
      await new Promise(r => setTimeout(r, 5000));
    }
    let btn = null;
    for (let i = 0; i < 30 && !btn; i++) {
      btn = [...document.querySelectorAll('button[class*="btn-gamemode"]')]
        .find(b => /Local Save/i.test(b.innerText) && b.innerText.includes(name));
      if (!btn) await new Promise(r => setTimeout(r, 1000));
    }
    if (!btn) return `no local save button for "${name}"`;
    btn.click();
    await new Promise(r => setTimeout(r, 800));
    const confirm = [...document.querySelectorAll('.swal2-popup button')]
      .find(b => /confirm/i.test(b.innerText));
    if (confirm) confirm.click();
    return `loading local ${name}...`;
  };

  // Local save + immediate cloud push.
  mh.save = async () => {
    saveData();
    await cloudManager.forceUpdatePlayFabSave();
    return 'saved (local + cloud)';
  };

  mh.exportSaveString = () => {
    const calls = [
      ['game.generateSaveString', () => game.generateSaveString()],
      ['game.getSaveString', () => game.getSaveString()],
      ['getSaveString', () => getSaveString()],
    ];
    for (const [name, call] of calls) {
      try {
        const value = call();
        if (typeof value === 'string' && value.length > 1000) return value;
      } catch {}
    }
    throw Error('no Melvor save export function found');
  };

  // Close any swal2 popup (confirm by default, cancel with accept=false).
  mh.dismissModal = (accept = true) => {
    const re = accept ? /confirm|ok|yes/i : /cancel|no/i;
    const btn = [...document.querySelectorAll('.swal2-popup button')].find(b => re.test(b.innerText));
    if (btn) { btn.click(); return btn.innerText; }
    return 'no modal';
  };

  const equippedSlots = () => game.combat.player.equipment.equippedArray.filter(s => !s.isEmpty);
  const slotQty = s => s.quantity ?? s.qty ?? s.item?.quantity ?? null;
  const fmtMs = ms => {
    if (!Number.isFinite(ms) || ms <= 0) return null;
    if (ms < 60000) return `${Math.max(1, Math.round(ms / 1000))} s`;
    const min = Math.round(ms / 60000);
    if (min < 90) return `${min} min`;
    const h = Math.round(min / 60);
    if (h < 48) return `${h} h`;
    return `${Math.round(h / 24)} d`;
  };
  const currentActionEstimate = () => {
    const action = game.activeAction?.name ?? null;
    if (!action) return { name: 'idle', notes: ['no task is running'] };
    const p = game.combat.player;
    const equipped = Object.fromEntries(equippedSlots().map(s => [s.slot.localID, { item: s.item.name, quantity: slotQty(s) }]));
    const notes = [];
    const runways = [];
    const addRunway = (slot, interval, unit) => {
      const e = equipped[slot];
      if (!e?.quantity || !interval) return;
      const eta = fmtMs(e.quantity * interval);
      runways.push({ slot, item: e.item, quantity: e.quantity, unit, eta });
      notes.push(`${slot} ${e.item}: about ${eta} (${e.quantity} ${unit})`);
    };
    if (action === 'Combat') {
      const attackInterval = p.stats.attackInterval;
      const slayerLeft = game.combat.slayerTask?.active ? game.combat.slayerTask.killsLeft : null;
      const enemyHP = game.combat.enemy?.monster?.hitpoints ?? game.combat.enemy?.hitpoints ?? null;
      const expectedHit = (p.stats.hitChance / 100) * (p.stats.maxHit / 2);
      if (slayerLeft && enemyHP && expectedHit > 0) {
        const attacks = Math.ceil((slayerLeft * enemyHP) / expectedHit);
        notes.push(`Slayer task ETA about ${fmtMs(attacks * attackInterval)} (${slayerLeft} kills left)`);
      }
      if (p.attackType === 'ranged') addRunway('Quiver', attackInterval, 'attacks if every attack consumes ammo');
      const consumable = equipped.Consumable?.item || '';
      if (p.attackType === 'ranged' || !/^Ranged /i.test(consumable)) addRunway('Consumable', attackInterval, 'combat charges at 1/attack');
      addRunway('Summon1', attackInterval, 'combat charges at 1/attack');
      addRunway('Summon2', attackInterval, 'combat charges at 1/attack');
      if (p.food.currentSlot?.quantity) notes.push(`${p.food.currentSlot.item.name}: ${p.food.currentSlot.quantity} food equipped; runway depends on damage taken`);
    } else {
      const interval = game.activeAction?.actionInterval ?? game.activeAction?.currentActionInteral ?? null;
      if (interval) notes.push(`current interval about ${fmtMs(interval)}`);
      if (interval) {
        addRunway('Consumable', interval, 'skilling charges at 1/action');
        addRunway('Summon1', interval, 'skilling charges at 1/action');
        addRunway('Summon2', interval, 'skilling charges at 1/action');
      }
    }
    return { name: action, notes: notes.filter(Boolean), equipment: equipped, runways };
  };

  // Compact character overview.
  mh.snapshot = () => {
    const slots = equippedSlots();
    return {
      character: game.characterName,
      gp: game.gp.amount,
      activeAction: game.activeAction?.name ?? null,
      combatLevel: game.playerCombatLevel,
      hp: game.combat.player.hitpoints,
      prayerPoints: game.combat.player.prayerPoints,
      food: game.combat.player.food.currentSlot?.item?.name ?? null,
      foodQty: game.combat.player.food.currentSlot?.quantity ?? 0,
      equipment: Object.fromEntries(slots.map(s => [s.slot.localID, s.item.name])),
      equipmentQuantities: Object.fromEntries(slots.map(s => [s.slot.localID, slotQty(s)]).filter(([, q]) => q !== null)),
      actionEstimate: currentActionEstimate(),
    };
  };

  // Bank search by substring (case-insensitive).
  mh.bankFind = (q) => {
    const re = new RegExp(q, 'i');
    const out = [];
    for (const [item, bankItem] of game.bank.items)
      if (re.test(item.name)) out.push({ name: item.name, qty: bankItem.quantity, id: item.id });
    return out;
  };

  // Unlocked artisan recipes with enough information to prove their resource runway.
  mh.skillingOptions = (skillName) => {
    const skill = game.skills.find(s => s.name === skillName);
    const actions = skill?.actions?.allObjects ?? skill?.recipes?.allObjects ?? [];
    const owned = item => game.bank.items.get(item)?.quantity ?? 0;
    return actions.flatMap(action => {
      const costs = action.itemCosts ?? action.costs?.items ?? [];
      const inputs = costs.map(c => ({ item: c.item?.name, owned: owned(c.item), perAction: c.quantity ?? c.qty ?? 0 }))
        .filter(c => c.item && c.perAction > 0);
      const level = action.level ?? 1;
      const abyssalLevel = action.abyssalLevel ?? 0;
      const unlocked = skill.level >= level && (skill.abyssalLevel ?? 0) >= abyssalLevel;
      if (!unlocked || !inputs.length) return [];
      const maxActions = Math.min(...inputs.map(c => Math.floor(c.owned / c.perAction)));
      const intervalMs = (() => { try { return skill.getActionInterval?.(action) ?? action.baseInterval ?? skill.baseInterval ?? null; } catch { return action.baseInterval ?? skill.baseInterval ?? null; } })();
      const xp = (() => { try { return skill.getXPForAction?.(action) ?? action.baseExperience ?? null; } catch { return action.baseExperience ?? null; } })();
      const runwayHours = intervalMs ? maxActions * intervalMs / 3600000 : null;
      return [{
        recipe: action.name ?? action.product?.name ?? action.id?.split(':').pop() ?? 'unknown recipe',
        level, abyssalLevel, inputs, maxActions, intervalMs, runwayHours,
        xpPerHour: xp && intervalMs ? xp * 3600000 / intervalMs : null,
      }];
    }).sort((a, b) => (b.xpPerHour ?? 0) - (a.xpPerHour ?? 0) || (b.runwayHours ?? 0) - (a.runwayHours ?? 0));
  };

  // Skill state by name ("Fishing", "Herblore"...).
  const abyssalTargets = s => {
    const level = s.abyssalLevel ?? null;
    const cap = s.currentAbyssalLevelCap ?? null;
    if (level === null || cap === null || typeof abyssalExp === 'undefined') return {};
    const xpAt = target => target >= 1 && target <= cap ? Math.floor(abyssalExp.levelToXP(target)) : null;
    const nextTen = Math.min(cap, Math.ceil((level + 1) / 10) * 10);
    return {
      abyssalXPLevelStart: xpAt(level),
      abyssalXPNextLevel: level < cap ? xpAt(level + 1) : null,
      abyssalXPNextTen: xpAt(nextTen),
      abyssalXPCap: xpAt(cap),
    };
  };
  const standardTargets = s => {
    const xpAt = level => {
      let points = 0;
      for (let current = 1; current < level; current++) points += Math.floor(current + 300 * Math.pow(2, current / 7));
      return Math.floor(points / 4);
    };
    const level = s.level ?? 1;
    const cap = s.currentLevelCap ?? level;
    return { xpLevelStart: xpAt(level), xpNextLevel: level < cap ? xpAt(level + 1) : null };
  };
  const masteryPools = s => {
    const pools = s._masteryPoolXP?.data;
    const actions = s.totalMasteryActionsInRealm?.data;
    if (!(pools instanceof Map) || !(actions instanceof Map)) return [];
    return [...pools].map(([realm, xp]) => ({
      realm: realm.name,
      xp: Math.floor(xp),
      cap: Math.floor((actions.get(realm) ?? 0) * 500000),
      totalLevel: s._totalCurrentMasteryLevelInRealm?.data?.get(realm) ?? null,
    }));
  };
  mh.skillInfo = (name) => {
    const s = game.skills.find(s => s.name.toLowerCase() === name.toLowerCase());
    if (!s) return `unknown skill "${name}"`;
    return {
      name: s.name,
      id: s.id,
      level: s.level,
      virtualLevel: s.virtualLevel,
      xp: Math.floor(s.xp),
      levelCap: s.currentLevelCap ?? null,
      abyssalLevel: s.abyssalLevel ?? null,
      abyssalXP: Math.floor(s.abyssalXP ?? 0),
      abyssalCap: s.currentAbyssalLevelCap ?? null,
      masteryPools: masteryPools(s),
      ...standardTargets(s),
      ...abyssalTargets(s),
      isActive: game.activeAction === s,
    };
  };

  // All skills, one line each.
  mh.skills = () =>
    game.skills.allObjects.map(s => ({
      name: s.name,
      id: s.id,
      level: s.level,
      xp: Math.floor(s.xp),
      levelCap: s.currentLevelCap ?? null,
      abyssalLevel: s.abyssalLevel ?? null,
      abyssalXP: Math.floor(s.abyssalXP ?? 0),
      abyssalCap: s.currentAbyssalLevelCap ?? null,
      masteryPools: masteryPools(s),
      ...standardTargets(s),
      ...abyssalTargets(s),
    }));

  const findBank = (name) => { for (const [item] of game.bank.items) if (item.name === name) return item; return null; };
  const passivesOf = (item) => (item.modifiers?.map(m => m.print?.().text ?? '') ?? [])
    .concat(item.conditionalModifiers?.map(c => c.modifiers?.map(m => m.print?.().text).join('; ')) ?? [])
    .filter(Boolean);
  const statsOf = (item) => {
    const stats = {};
    (item.equipmentStats ?? []).forEach(s => {
      const k = s.key + (s.damageType && s.damageType.localID !== 'Normal' ? ':' + s.damageType.localID : '');
      stats[k] = (stats[k] ?? 0) + s.value;
    });
    return stats;
  };

  // Gear audit: equipped gear + top bank candidates per slot, stats AND passives
  // (passives often flip the verdict of raw stats — never conclude without them).
  mh.gearAudit = (attackType = game.combat.player.attackType, topN = 5) => {
    const prefix = { melee: ['stabAttackBonus','slashAttackBonus','blockAttackBonus','meleeStrengthBonus','meleeDefenceBonus','resistance'],
                     ranged: ['rangedAttackBonus','rangedStrengthBonus','rangedDefenceBonus','resistance'],
                     magic: ['magicAttackBonus','magicDamageBonus','magicDefenceBonus','resistance'] }[attackType];
    const scoreOf = (st) => prefix.reduce((a,k) => a + Math.max(0, ...Object.entries(st).filter(([kk])=>kk.startsWith(k)).map(([,v])=>v)), 0);
    const p = game.combat.player;
    const equipped = {};
    p.equipment.equippedArray.filter(s => !s.isEmpty).forEach(s => {
      equipped[s.slot.localID] = { name: s.item.name, stats: statsOf(s.item), passives: passivesOf(s.item), damageType: s.item.damageType?.name };
    });
    const meetsRequirement = r => {
      if (r.type === 'SkillLevel' && r.skill && r.level !== undefined) return r.skill.level >= r.level;
      if (r.type === 'AbyssalLevel' && r.skill && r.level !== undefined) return (r.skill.abyssalLevel ?? 0) >= r.level;
      if (r.type === 'DungeonCompletion' && r.dungeon && r.count !== undefined)
        return (game.combat.getDungeonCompleteCount?.(r.dungeon) ?? 0) >= r.count;
      if (r.type === 'ShopPurchase') return false;
      return false;
    };
    const canEquip = item => (item.equipRequirements ?? []).every(meetsRequirement);
    const requirementText = r =>
      r.type === 'SkillLevel' ? `${r.skill?.name || 'skill'} ${r.level}` :
      r.type === 'AbyssalLevel' ? `${r.skill?.name || 'abyssal skill'} ${r.level}` :
      r.type === 'DungeonCompletion' ? `${r.dungeon?.name || 'dungeon'} x${r.count ?? 1}` :
      r.type === 'AbyssDepthCompletion' ? `${r.depth?.name || r.abyssDepth?.name || 'Abyss depth'} completion` :
      r.type === 'ShopPurchase' ? `purchase ${r.purchase?.name || 'required'}` :
      r.type || r.constructor?.name || 'unknown requirement';
    const equippedNames = new Set(Object.values(equipped).map(item => item.name));
    const candidates = {}, blocked = {};
    for (const [item] of game.bank.items) {
      if (!item.validSlots?.length) continue;
      if (equippedNames.has(item.name)) continue;
      if (item.attackType && item.attackType !== attackType) continue;
      const slot = item.validSlots[0];
      const st = statsOf(item);
      if (scoreOf(st) === 0) continue;
      const view = { name: item.name, stats: st, passives: passivesOf(item), damageType: item.damageType?.name };
      if (canEquip(item)) (candidates[slot.localID] ??= []).push(view);
      else (blocked[slot.localID] ??= []).push({ ...view, missingRequirements: (item.equipRequirements ?? []).filter(r => !meetsRequirement(r)).map(requirementText) });
    }
    for (const k in candidates) candidates[k] = candidates[k].sort((a,b)=>scoreOf(b.stats)-scoreOf(a.stats)).slice(0, topN);
    for (const k in blocked) blocked[k] = blocked[k].sort((a,b)=>scoreOf(b.stats)-scoreOf(a.stats)).slice(0, topN);
    return { context: { attackType, hitChance: p.stats.hitChance, maxHit: p.stats.maxHit, attackInterval: p.stats.attackInterval }, equipped, candidates, blocked };
  };

  // Read-only per-slot acquisition plan. Game registry requirements are authoritative;
  // wiki guidance is advisory and added by the journal renderer only for fixed dungeons.
  mh.upgradePlan = () => {
    const values = value => value instanceof Map || value instanceof Set ? [...value.values()] : Array.isArray(value) ? value : value?.allObjects ?? [];
    const p = game.combat.player, combat = game.combat, attackType = p.attackType;
    const prefixes = { melee: ['stabAttackBonus','slashAttackBonus','blockAttackBonus','meleeStrengthBonus','meleeDefenceBonus','resistance'], ranged: ['rangedAttackBonus','rangedStrengthBonus','rangedDefenceBonus','resistance'], magic: ['magicAttackBonus','magicDamageBonus','magicDefenceBonus','resistance'] }[attackType] || [];
    const score = item => prefixes.reduce((sum, key) => sum + Math.max(0, ...Object.entries(statsOf(item)).filter(([name]) => name.startsWith(key)).map(([, value]) => value)), 0);
    const meets = r => r.type === 'SkillLevel' ? r.skill?.level >= r.level : r.type === 'AbyssalLevel' ? (r.skill?.abyssalLevel ?? 0) >= r.level : r.type === 'DungeonCompletion' ? (combat.getDungeonCompleteCount?.(r.dungeon) ?? 0) >= r.count : r.type === 'AbyssDepthCompletion' ? false : r.type === 'ShopPurchase' ? false : false;
    const requirement = r => r.type === 'SkillLevel' ? `${r.skill?.name || 'skill'} ${r.level}` : r.type === 'AbyssalLevel' ? `${r.skill?.name || 'abyssal skill'} ${r.level}` : r.type === 'DungeonCompletion' ? `${r.dungeon?.name || 'dungeon'} x${r.count ?? 1}` : r.type === 'AbyssDepthCompletion' ? `${r.depth?.name || r.abyssDepth?.name || 'Abyss depth'} completion` : r.type === 'ShopPurchase' ? `purchase ${r.purchase?.name || 'required'}` : r.type || 'unknown requirement';
    const craft = new Map();
    for (const skill of values(game.skills)) for (const action of values(skill.actions).length ? values(skill.actions) : values(skill.recipes)) {
      const item = action.product ?? action.item ?? action.outputs?.[0]?.item;
      if (item?.id) craft.set(item.id, { skill: skill.name, recipe: action.name ?? item.name });
    }
    const drops = new Map();
    for (const monster of values(game.monsters)) for (const drop of values(monster.lootTable?.drops ?? monster.lootTable)) {
      const item = drop.item ?? drop.drop ?? drop.itemToDrop;
      if (item?.id && !drops.has(item.id)) drops.set(item.id, monster.name);
    }
    const equipped = Object.fromEntries(p.equipment.equippedArray.filter(slot => !slot.isEmpty).map(slot => [slot.slot.localID, slot.item]));
    const damageType = equipped.Weapon?.damageType?.name ?? null;
    const itemView = item => ({ name: item.name, id: item.id, realm: String(item.id || '').split(':')[0] || null, score: score(item), damageType: item.damageType?.name ?? null, craft: craft.get(item.id) ?? null, loot: drops.get(item.id) ?? null, blocked: (item.equipRequirements ?? []).filter(r => !meets(r)).map(requirement) });
    const compatible = (item, slot) => item.validSlots?.[0]?.localID === slot && (!item.attackType || item.attackType === attackType) && !(slot === 'Weapon' && damageType && damageType !== 'Normal' && item.damageType?.name !== damageType);
    const slots = {};
    for (const [slot, current] of Object.entries(equipped)) {
      const candidates = values(game.items).filter(item => item !== current && compatible(item, slot) && score(item) > score(current)).map(itemView).sort((a, b) => a.blocked.length - b.blocked.length || b.score - a.score || a.name.localeCompare(b.name));
      const pick = kind => candidates.filter(item => item[kind]).slice(0, 4).map(item => ({ ...item, source: kind === 'craft' ? `craft: ${item.craft.skill} / ${item.craft.recipe}` : `loot: ${item.loot}` }));
      const loot = pick('loot'), crafting = pick('craft');
      if (loot.length || crafting.length) slots[slot] = { current: itemView(current), loot: loot[0] ? { primary: loot[0], alternatives: loot.slice(1, 4) } : null, craft: crafting[0] ? { primary: crafting[0], alternatives: crafting.slice(1, 4) } : null };
    }
    const area = combat.selectedArea;
    const dungeon = values(game.dungeons).find(entry => entry === area);
    const task = combat.slayerTask?.active ? { monster: combat.slayerTask.monster?.name ?? null, remaining: combat.slayerTask.killsLeft ?? null } : null;
    return { context: task ? { kind: 'slayer_task', target: task.monster, remaining: task.remaining, refresh: 'refresh when the Slayer task changes' } : dungeon ? { kind: 'dungeon', target: dungeon.name, guide: `https://wiki.melvoridle.com/w/${encodeURIComponent(dungeon.name.replace(/ /g, '_'))}/Guide` } : { kind: 'activity', target: game.activeAction?.name ?? null }, attackType, damageType, slots };
  };

  mh.equipSlot = (name, slotName, quantity) => {
    const p = game.combat.player;
    const item = findBank(name);
    if (!item) return name + ': not in bank';
    if (!item.validSlots?.length) return name + ': not equipment';
    const slot = p.equipment.equippedArray.find(s => s.slot.localID === slotName)?.slot;
    if (!slot) return slotName + ': unknown slot';
    if (!item.validSlots.some(s => s.localID === slotName))
      return name + ': invalid slot "' + slotName + '" (valid: ' + item.validSlots.map(s => s.localID).join(', ') + ')';
    const bankQty = game.bank.items.get(item)?.quantity ?? 1;
    const stackSlot = /^Summon[12]$|^Quiver$|^Consumable$/.test(slotName);
    const qty = quantity ?? (stackSlot ? bankQty : 1);
    p.equipItem(item, p.selectedEquipmentSet, slot, qty);
    const equipped = p.equipment.equippedArray.find(s => s.slot.localID === slotName)?.item;
    if (equipped !== item) return name + ': Melvor did not equip it in ' + slotName;
    return name + ': equipped x' + qty + ' in ' + slotName;
  };

  // Explicit slot required; avoids accidental passive/summon/offhand swaps.
  mh.equip = (names) => {
    const list = Array.isArray(names) ? names : [names];
    return list.map(name => name + ': use mh.equipSlot(name, slotName)');
  };

  // Current combat: area, monster, hit chance, slayer task.
  mh.combatInfo = () => {
    const c = game.combat, p = c.player, e = c.enemy;
    const area = c.selectedArea;
    const monsters = area?.monsters ?? [];
    const boss = monsters[monsters.length - 1];
    const weapon = p.equipment.equippedArray.find(slot => slot.slot.localID === 'Weapon' && !slot.isEmpty)?.item;
    return {
      area: area?.name ?? null,
      dungeonBoss: boss ? { name: boss.name, attackType: boss.attackType } : null,
      playerAttackType: p.attackType ?? null,
      playerDamageType: weapon?.damageType?.name ?? null,
      monster: e?.monster?.name ?? null,
      monsterAttackType: e?.monster?.attackType ?? null,
      enemyHP: e?.hitpoints ?? null,
      hitChance: p.stats.hitChance,
      maxHit: p.stats.maxHit,
      slayerTask: c.slayerTask?.active ? { monster: c.slayerTask.monster?.name, left: c.slayerTask.killsLeft } : null,
    };
  };

  mh.combatGoals = () => {
    const completeCount = d => game.combat.getDungeonCompleteCount?.(d) ?? 0;
    const values = value => value instanceof Map || value instanceof Set ? [...value.values()] : value?.allObjects ?? value ?? [];
    const reqMet = r => {
      if (r.dungeon && r.count !== undefined) return completeCount(r.dungeon) >= r.count;
      if (r.type === 'AbyssalLevel' && r.skill && r.level !== undefined) return (r.skill.abyssalLevel ?? 0) >= r.level;
      if (r.skill && r.level !== undefined) return r.skill.level >= r.level;
      if (r.purchase) return false;
      return true;
    };
    const reqInfo = r => ({
      type: r.type ?? r.constructor?.name ?? null,
      dungeon: r.dungeon?.name ?? null,
      skill: r.skill?.name ?? null,
      level: r.level ?? null,
      purchase: r.purchase?.name ?? null,
      count: r.count ?? null,
      met: reqMet(r),
    });
    const dungeons = game.dungeons.allObjects.map(d => {
      const monsters = d.monsters ?? [];
      const boss = monsters[monsters.length - 1];
      return {
        name: d.name,
        id: d.id,
        kind: /^melvorItA:/.test(d.id || '') ? 'abyssal' : 'standard',
        completeCount: completeCount(d),
        maxCombatLevel: Math.max(0, ...monsters.map(m => m.combatLevel ?? 0)),
        boss: boss?.name ?? null,
        bossAttackType: boss?.attackType ?? null,
        requirements: (d.entryRequirements ?? d.unlockRequirements ?? d.requirements ?? []).map(reqInfo),
      };
    });
    const goals = {
      cappedSkills: game.skills.allObjects
        .filter(s => s.level >= s.currentLevelCap || (s.abyssalLevel ?? 0) >= (s.currentAbyssalLevelCap ?? Infinity))
        .map(s => ({
          name: s.name,
          level: s.level,
          cap: s.currentLevelCap,
          abyssalLevel: s.abyssalLevel ?? null,
          abyssalCap: s.currentAbyssalLevelCap ?? null,
        })),
      unclearedDungeons: dungeons
        .filter(d => d.completeCount === 0)
        .filter(d => d.requirements.every(r => r.met))
        .sort((a, b) => a.maxCombatLevel - b.maxCombatLevel),
      completedDungeons: dungeons.filter(d => d.completeCount > 0),
      abyssalDepths: values(game.abyssDepths ?? game.abyssalDepths).map(depth => ({ name: depth.name, id: depth.id })),
    };
    const beats = { melee: 'magic', ranged: 'melee', magic: 'ranged' };
    const next = goals.unclearedDungeons[0] ?? null;
    const style = next ? beats[next.bossAttackType] ?? null : null;
    const p = game.combat.player;
    const setInfo = (set, index) => {
      const equipped = set.equipment.equippedArray.filter(s => !s.isEmpty);
      const item = slot => equipped.find(s => s.slot.localID === slot)?.item;
      return {
        index,
        attackType: item('Weapon')?.attackType ?? null,
        weapon: item('Weapon')?.name ?? null,
        cape: item('Cape')?.name ?? null,
        consumable: item('Consumable')?.name ?? null,
      };
    };
    const set = next ? p.equipmentSets.map(setInfo).find(s => style && s.attackType === style) ?? null : null;
    const bankQty = name => { const item = findBank(name); return item ? game.bank.items.get(item).quantity : 0; };
    const available = names => names.filter(name => bankQty(name) > 0);
    goals.nextSetup = next ? {
      dungeon: next.name,
      boss: next.boss,
      bossAttackType: next.bossAttackType,
      set,
      prayers: [
        style === 'ranged' ? 'Rigour' : style === 'melee' ? 'Piety' : style === 'magic' ? 'Augury' : null,
        next.bossAttackType === 'magic' ? 'Protect from Magic' : next.bossAttackType === 'ranged' ? 'Protect from Ranged' : next.bossAttackType === 'melee' ? 'Protect from Melee' : null,
      ].filter(Boolean),
      gearNotes: [
        set?.cape !== 'Maximum Skillcape' && bankQty('Maximum Skillcape') > 0 ? `Cape: ${set?.cape || 'empty'} -> Maximum Skillcape` : null,
      ].filter(Boolean),
      summons: style === 'ranged'
        ? available(['Centaur', 'Yak', 'Wolf', 'Occultist']).slice(0, 2)
        : style === 'melee'
          ? available(['Minotaur', 'Yak', 'Wolf', 'Occultist']).slice(0, 2)
          : style === 'magic'
            ? available(['Witch', 'Yak', 'Wolf', 'Occultist']).slice(0, 2)
            : [],
      potions: [
        bankQty('Damage Reduction Potion IV') > 0 ? 'Damage Reduction Potion IV for first clear safety' : null,
        bankQty('Diamond Luck Potion IV') > 0 ? 'Diamond Luck Potion IV for DPS/farming' : null,
        style === 'ranged' && bankQty('Ranged Strength Potion IV') > 0 ? 'Ranged Strength Potion IV if spending limited stock is OK' : null,
        style === 'ranged' && bankQty('Ranged Assistance Potion IV') > 0 ? 'Ranged Assistance Potion IV if accuracy is the bottleneck' : null,
      ].filter(Boolean),
    } : null;
    return goals;
  };

  // An item's passives (modifiers) — bank, equipped, or global registry.
  mh.itemPassives = (name) => {
    const item = findBank(name)
      ?? game.combat.player.equipment.equippedArray.find(s => !s.isEmpty && s.item.name === name)?.item
      ?? game.items.allObjects.find(i => i.name === name);
    return item ? passivesOf(item) : `"${name}" not found`;
  };

  // Read-only rollup for CLI reports. Do not call saveData/cloudManager here.
  mh.readOnlyReport = () => {
    const skills = mh.skills();
    const snap = mh.snapshot();
    return {
      name: snap.character,
      mode: game.currentGamemode?.name ?? null,
      gp: snap.gp,
      action: snap.activeAction,
      combatLevel: snap.combatLevel,
      totalLevel: skills.reduce((a, s) => a + s.level, 0),
      maxedSkills: skills.filter(s => s.level >= 120).length + '/' + skills.length,
      lowSkills: skills.filter(s => s.level < 120).sort((a, b) => a.level - b.level || a.xp - b.xp),
      hp: snap.hp,
      prayer: snap.prayerPoints,
      food: snap.food,
      foodQty: snap.foodQty,
      bankSlots: game.bank.items.size,
      equipment: snap.equipment,
      equipmentQuantities: snap.equipmentQuantities,
      actionEstimate: snap.actionEstimate,
      combat: mh.combatInfo(),
      combatGoals: mh.combatGoals(),
    };
  };

  mh.skillingAudit = () => {
    const eq = mh.snapshot().equipment;
    const wanted = ['Ancient Ring of Skills', 'Ancient Ring of Mastery', 'Book of Scholars', 'Golden Wreath'];
    const bankQty = (name) => { const item = findBank(name); return item ? game.bank.items.get(item).quantity : 0; };
    return {
      action: game.activeAction?.name ?? null,
      equipment: eq,
      available: Object.fromEntries(wanted.map(name => [name, bankQty(name)])),
      notes: [
        eq.Amulet === 'Amulet of Fishing' && eq.Weapon !== 'Potion Stirrer' ? 'Amulet of Fishing is only useful for Fishing' : null,
        eq.Weapon === 'Grappling Hook' && eq.Summon2 !== 'Eagle' ? 'Grappling Hook is a Thieving item; Eagle is the Agility summon' : null,
        eq.Ring === 'Ancient Ring of Mastery' ? 'Mastery ring favors mastery XP over skill XP' : null,
        eq.Ring === 'Ancient Ring of Skills' ? 'Skills ring favors level XP over mastery XP' : null,
      ].filter(Boolean),
    };
  };

  window.mh = mh;

  // Auto-load: if window.__autoLoadChar is set (by navigate_page's initScript BEFORE
  // this file), load that character as soon as the page is ready.
  if (window.__autoLoadChar) {
    const name = window.__autoLoadChar;
    delete window.__autoLoadChar;
    const start = () => setTimeout(() => mh.loadCharacter(name), 2000);
    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start);
  }

  return 'mh helpers loaded: ' + Object.keys(mh).join(', ');
})()
