// Melvor Idle console helpers: inject via evaluate_script at the start of a session.
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
      const label = { Quiver: 'Ammo', Summon1: 'Familiar', Summon2: 'Familiar' }[slot] || slot;
      notes.push(`${label}: ${e.item} · about ${eta} (${e.quantity.toLocaleString('en-US')} ${unit})`);
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
      if (p.food.currentSlot?.quantity) notes.push(`Food: ${p.food.currentSlot.item.name} x${p.food.currentSlot.quantity.toLocaleString('en-US')}`);
    } else {
      const interval = game.activeAction?.actionInterval ?? game.activeAction?.currentActionInteral ?? null;
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
  // Into the Abyss content only counts once the character is actually in the Abyss: an abyssal level above 1,
  // Into the Abyss cleared, or abyssal Slayer coins. Owning the expansion is not enough.
  mh.abyssOpen = () => {
    try {
      if (game.skills.allObjects.some(s => (s.abyssalLevel ?? 0) > 1)) return true;
      const ita = game.dungeons.getObjectByID('melvorItA:Into_the_Abyss');
      if (ita && (game.combat.getDungeonCompleteCount?.(ita) ?? 0) > 0) return true;
      return (game.abyssalSlayerCoins?.amount ?? 0) > 0;
    } catch { return true; }
  };
  const isAbyssal = thing => /^melvorItA:/.test(thing?.id || '') || thing?.realm?.id === 'melvorItA:Abyssal';
  const GATHERING = ['Woodcutting', 'Fishing', 'Mining', 'Thieving', 'Astrology', 'Harvesting'];
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
      if (!unlocked || (!inputs.length && !GATHERING.includes(skillName)) || ((abyssalLevel > 0 || isAbyssal(action)) && !mh.abyssOpen())) return [];
      // gathering actions (trees, fish, rocks...) cost nothing: unlimited runway
      const maxActions = inputs.length ? Math.min(...inputs.map(c => Math.floor(c.owned / c.perAction))) : Infinity;
      const avgInterval = action.baseMinInterval && action.baseMaxInterval ? (action.baseMinInterval + action.baseMaxInterval) / 2 : null;
      const intervalMs = (() => { try { return skill.getActionInterval?.(action) ?? action.baseInterval ?? avgInterval ?? skill.baseInterval ?? null; } catch { return action.baseInterval ?? avgInterval ?? skill.baseInterval ?? null; } })();
      const xp = (() => { try { return skill.getXPForAction?.(action) ?? action.baseExperience ?? null; } catch { return action.baseExperience ?? null; } })();
      const runwayHours = intervalMs ? maxActions * intervalMs / 3600000 : null;
      return [{
        recipe: action.name ?? action.product?.name ?? action.id?.split(':').pop() ?? 'unknown recipe',
        level, abyssalLevel, inputs, maxActions: Number.isFinite(maxActions) ? maxActions : null, intervalMs, runwayHours: Number.isFinite(runwayHours) ? runwayHours : null, gathering: !inputs.length,
        xpPerHour: xp && intervalMs ? xp * 3600000 / intervalMs : null,
      }];
    }).sort((a, b) => (b.xpPerHour ?? 0) - (a.xpPerHour ?? 0) || (b.runwayHours ?? 0) - (a.runwayHours ?? 0))
      .map((option, index) => index < 5 ? withEtaRate(skill, actions, option) : option);
  };
  // The ETA mod (gmiclotte) computes XP/h with every modifier; refine the top options with it when it is installed.
  const withEtaRate = (skill, actions, option) => {
    try {
      const calc = mod.api.ETA?.ETA?.skillCalculators?.get(skill.id)?.get(actions.find(a => (a.name ?? a.product?.name) === option.recipe)?.id);
      if (!calc) return option;
      calc.iterate(game);
      const xp = calc.currentRates?.hourlyRates?.xp;
      return Number.isFinite(xp) && xp > 0 ? { ...option, xpPerHour: xp, rateSource: 'ETA' } : option;
    } catch { return option; }
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
  // (passives often flip the verdict of raw stats; never conclude without them).
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
      r.type === 'AbyssalLevel' ? `Abyssal ${r.skill?.name || 'skill'} ${r.level}` :
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
    // Resistance only counts for the realm being fought (normal vs abyssal) and weighs x10: it is a % next to bonuses in the hundreds.
    const realmResistance = 'resistance' + (p.damageType?.localID && p.damageType.localID !== 'Normal' ? ':' + p.damageType.localID : '');
    // a slower attack outweighs raw bonuses: such items never count as upgrades
    const slows = item => passivesOf(item).some(text => /\+[\d.]+s Attack Interval|\+[\d.]+% Attack Interval/i.test(text));
    const score = item => { if (slows(item)) return -Infinity; const stats = statsOf(item); return prefixes.reduce((sum, key) => sum + (key === 'resistance' ? 10 * Math.max(0, stats[realmResistance] ?? 0) : Math.max(0, ...Object.entries(stats).filter(([name]) => name.startsWith(key)).map(([, value]) => value))), 0); };
    const meets = r => r.type === 'SkillLevel' ? r.skill?.level >= r.level : r.type === 'AbyssalLevel' ? (r.skill?.abyssalLevel ?? 0) >= r.level : r.type === 'DungeonCompletion' ? (combat.getDungeonCompleteCount?.(r.dungeon) ?? 0) >= r.count : r.type === 'AbyssDepthCompletion' ? false : r.type === 'ShopPurchase' ? false : false;
    const requirement = r => r.type === 'SkillLevel' ? `${r.skill?.name || 'skill'} ${r.level}` : r.type === 'AbyssalLevel' ? `Abyssal ${r.skill?.name || 'skill'} ${r.level}` : r.type === 'DungeonCompletion' ? `${r.dungeon?.name || 'dungeon'} x${r.count ?? 1}` : r.type === 'AbyssDepthCompletion' ? `${r.depth?.name || r.abyssDepth?.name || 'Abyss depth'} completion` : r.type === 'ShopPurchase' ? `purchase ${r.purchase?.name || 'required'}` : r.type || 'unknown requirement';
    const craft = new Map();
    for (const skill of values(game.skills)) for (const action of values(skill.actions).length ? values(skill.actions) : values(skill.recipes)) {
      const item = action.product ?? action.item ?? action.outputs?.[0]?.item;
      if (item?.id) craft.set(item.id, { skill: skill.name, recipe: action.name ?? item.name });
    }
    // the monster with the best chance per kill, not the first one found
    const drops = new Map();
    for (const monster of values(game.monsters)) {
      const table = values(monster.lootTable?.drops ?? monster.lootTable);
      const total = table.reduce((sum, drop) => sum + (drop.weight ?? 0), 0);
      for (const drop of table) {
        const item = drop.item ?? drop.drop ?? drop.itemToDrop;
        if (!item?.id) continue;
        const chance = total && drop.weight ? (drop.weight / total) * ((monster.lootChance ?? 100) / 100) * 100 : null;
        const known = drops.get(item.id);
        if (!known || (chance ?? 0) > (known.chance ?? 0)) drops.set(item.id, { monster: monster.name, chance });
      }
    }
    const equipped = Object.fromEntries(p.equipment.equippedArray.filter(slot => !slot.isEmpty).map(slot => [slot.slot.localID, slot.item]));
    const damageType = equipped.Weapon?.damageType?.name ?? null;
    const itemView = item => ({ name: item.name, id: item.id, realm: String(item.id || '').split(':')[0] || null, score: score(item), damageType: item.damageType?.name ?? null, craft: craft.get(item.id) ?? null, loot: drops.get(item.id)?.monster ?? null, lootChance: drops.get(item.id)?.chance ?? null, owned: game.bank.items.get(item)?.quantity ?? 0, passives: passivesOf(item).filter(Boolean).slice(0, 2), blocked: (item.equipRequirements ?? []).filter(r => !meets(r)).map(requirement) });
    const abyss = mh.abyssOpen();
    const compatible = (item, slot) => (abyss || !isAbyssal(item)) && item.validSlots?.[0]?.localID === slot && (!item.attackType || item.attackType === attackType) && !(slot === 'Weapon' && damageType && damageType !== 'Normal' && item.damageType?.name !== damageType);
    const activeSkill = game.activeAction?.name ?? null;
    if (activeSkill && activeSkill !== 'Combat') {
      const skillScore = item => {
        const text = passivesOf(item).join(' ');
        const globalBonus = [...text.matchAll(/\+(\d+(?:\.\d+)?)% (?:Skill XP for all|Mastery XP in all Skills)/gi)].reduce((sum, match) => sum + Number(match[1]), 0);
        return (new RegExp(activeSkill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(text) ? 100 : 0) + globalBonus - (/-\d+% (?:Chance to Preserve Resources|Skill XP|Mastery XP)|\+\d+% Skill Interval/i.test(text) ? 100 : 0);
      };
      const skilling = {};
      for (const [slot, current] of Object.entries(equipped)) {
        const candidates = [...game.bank.items]
          .filter(([item]) => item !== current && item.validSlots?.some(s => s.localID === slot) && skillScore(item) > skillScore(current))
          .map(([item, entry]) => ({ name: item.name, available: entry.quantity, passives: passivesOf(item).slice(0, 2), score: skillScore(item) }))
          .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)).slice(0, 3);
        if (candidates.length) skilling[slot] = { current: current.name, candidates };
      }
      return { context: { kind: 'non_combat_skill', target: activeSkill, refresh: 'refresh when the active skill changes' }, attackType, damageType, slots: {}, skilling };
    }
    const slots = {};
    for (const [slot, current] of Object.entries(equipped)) {
      const candidates = values(game.items).filter(item => item !== current && compatible(item, slot) && score(item) > score(current)).map(itemView).sort((a, b) => a.blocked.length - b.blocked.length || b.score - a.score || a.name.localeCompare(b.name));
      // an equippable item already in the bank beats anything to loot or craft
      const inBank = candidates.filter(item => item.owned && !item.blocked.length).slice(0, 4).map(item => ({ ...item, source: `in bank x${item.owned}` }));
      const pick = kind => candidates.filter(item => item[kind] && !(item.owned && !item.blocked.length)).slice(0, 4).map(item => ({ ...item, source: kind === 'craft' ? `craft: ${item.craft.skill} / ${item.craft.recipe}` : `loot: ${item.loot}` }));
      const loot = pick('loot'), crafting = pick('craft');
      const lane = list => list[0] ? { primary: list[0], alternatives: list.slice(1, 4) } : null;
      if (inBank.length || loot.length || crafting.length) slots[slot] = { current: itemView(current), bank: lane(inBank), loot: lane(loot), craft: lane(crafting) };
    }
    const area = combat.selectedArea;
    const dungeon = values(game.dungeons).find(entry => entry === area);
    const task = combat.slayerTask?.active ? { monster: combat.slayerTask.monster?.name ?? null, remaining: combat.slayerTask.killsLeft ?? null } : null;
    return { context: task ? { kind: 'slayer_task', target: task.monster, remaining: task.remaining, refresh: 'refresh when the Slayer task changes' } : dungeon ? { kind: 'dungeon', target: dungeon.name, guide: `https://wiki.melvoridle.com/w/${encodeURIComponent(dungeon.name.replace(/ /g, '_'))}/Guide` } : { kind: 'activity', target: activeSkill }, attackType, damageType, slots };
  };

  // Simulate the current target with each upgrade candidate swapped in, using [Myth] Combat Simulator.
  // Needs the simulator in debug mode (self.mcs.global), set by a document-start script; read-only, the sim runs on its own copy.
  // One simulator session: the selected set imported, a runner for any monster (optionally inside a dungeon).
  const simSession = async () => {
    const G = self.mcs?.global, api = typeof mod !== 'undefined' ? mod.api?.mythCombatSimulator : null;
    if (!G?.simulation || !api) return { error: 'combat simulator not available' };
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const set = game.combat.player.selectedEquipmentSet;
    const button = [...document.querySelectorAll('mcs-equipment-page button.mcs-button')].find(b => b.textContent.trim() === String(set + 1));
    if (!button) return { error: 'combat simulator UI not ready' };
    button.click(); await sleep(300);
    const exported = api.export();
    const runFor = async (monster, settings, entityId) => {
      const task = game.combat.slayerTask;
      api.import({ ...settings, isSlayerTask: Boolean(task?.active && task.monster === monster) }); await sleep(50);
      const r = (await mh.simulateFull(G, monster.id, entityId));
      return r.simSuccess ? { xpPerHour: Math.max(r.xpPerSecondAbyssal || 0, r.xpPerSecondMelvor || 0) * 3600, killTimeS: r.killTimeS, deathRate: r.deathRate, killsPerHour: (r.killsPerSecond || 0) * 3600, gpPerHour: Math.max(r.gpPerSecondMelvor || 0, r.gpPerSecondAbyssal || 0) * 3600, atePerHour: (r.atePerSecond || 0) * 3600 } : { failed: r.reason || 'simulation failed' };
    };
    return { api, exported, runFor };
  };

  // Simulate a list of { monsterId, entityId } with the current gear (dungeon bosses, never-killed monsters, farm spots).
  mh.simTargets = async targets => {
    const session = await simSession(); if (session.error) return { error: session.error };
    const out = {};
    for (const t of (targets || []).slice(0, 12)) {
      const monster = game.monsters.getObjectByID(t.monsterId); if (!monster) continue;
      out[t.key || t.monsterId] = await session.runFor(monster, session.exported, t.entityId);
    }
    session.api.import(session.exported);
    return out;
  };

  // Read-only readiness check for one dungeon: requirements, special prerequisites of event dungeons, and a simulation
  // of the hardest fights with each style's equipment set (set roles: S1 melee, S2 ranged, S3 magic, S5-S7 abyssal).
  mh.dungeonCheck = async (dungeonName, roles = ['melee', 'ranged', 'magic', 'skill', 'melee', 'ranged', 'magic']) => {
    const values = v => v instanceof Map || v instanceof Set ? [...v.values()] : Array.isArray(v) ? v : v?.allObjects ?? [];
    const lower = String(dungeonName).toLowerCase();
    const area = [...values(game.dungeons), ...values(game.abyssDepths), ...values(game.strongholds)].find(a => a.name.toLowerCase() === lower);
    if (!area) return { error: 'unknown dungeon: ' + dungeonName };
    const met = reqs => { try { return game.checkRequirements(reqs || [], false); } catch { return false; } };
    const owned = item => item ? (game.bank.items.get(item)?.quantity ?? 0) > 0 || game.combat.player.equipmentSets.some(set => set.equipment.equippedArray.some(s => s.item === item)) : false;
    const itemNamed = name => values(game.items).find(i => i.name === name);
    const purchased = name => { const p = values(game.shop.purchases).find(x => x.name === name); try { return p ? game.shop.isUpgradePurchased(p) || game.shop.getPurchaseCount?.(p) > 0 : null; } catch { return null; } };
    const clears = a => { for (const f of ['getDungeonCompleteCount', 'getAbyssDepthCompleteCount', 'getStrongholdCompleteCount']) { try { const n = game.combat[f]?.(a); if (Number.isFinite(n)) return n; } catch {} } return null; };
    const abyssal = /^melvorItA:/.test(area.id);
    const checks = [];
    const check = (label, ok, detail) => checks.push({ label, ok, detail: detail || null });
    check('Entry requirements met', met(area.entryRequirements));
    // event dungeons: what the wiki guide makes mandatory
    const fights = []; // { key, label, monster, entityId, style (forced or null) }
    let forcedCape = null;
    if (area.id === 'melvorF:Impending_Darkness') {
      check('Into the Mist cleared', (clears(game.dungeons.getObjectByID('melvorF:Into_the_Mist')) ?? 0) > 0);
      const capes = ['Slayer Skillcape', 'Superior Slayer Skillcape', 'Maximum Skillcape', 'Superior Max Skillcape', 'Cape of Completion', 'Superior Cape Of Completion'];
      check('Slayer Skillcape (or a max cape) owned', capes.some(n => owned(itemNamed(n))), capes.filter(n => owned(itemNamed(n))).join(', ') || 'none owned');
      // the guide makes the cape mandatory in every area: simulate with the best owned one in the cape slot
      forcedCape = [...capes].reverse().map(itemNamed).find(owned) || null;
      check('Map to the Unhallowed Wasteland bought', purchased('Map to the Unhallowed Wasteland') === true);
      for (const name of ['Unhallowed Wasteland', 'Dark Waters', 'Shrouded Badlands', 'Perilous Peaks']) {
        const sa = values(game.slayerAreas).find(a => a.name === name); if (!sa) continue;
        const hardest = values(sa.monsters).sort((a, b) => (b.combatLevel ?? 0) - (a.combatLevel ?? 0))[0];
        if (hardest) fights.push({ key: name, label: name + ' (hardest: ' + hardest.name + ')', monster: hardest, entityId: undefined });
      }
      // the simulator registers style-locked copies of Bane (<id>_melee/_ranged/_magic) inside this dungeon; the plain
      // monster rolls a random style, so 2 trials in 3 face a style the set cannot damage
      for (const style of ['melee', 'ranged', 'magic']) {
        fights.push({ key: 'Bane ' + style, label: 'Bane (rounds 1-4, ' + style + ')', monsterId: 'melvorF:Bane_' + style, entityId: area.id, style });
        fights.push({ key: 'Bane IoF ' + style, label: 'Bane, Instrument of Fear (' + style + ')', monsterId: 'melvorF:BaneInstrumentOfFear_' + style, entityId: area.id, style });
      }
    } else {
      if (area.id === 'melvorF:Into_the_Mist') check('Dungeon Equipment Swapping bought', purchased('Dungeon Equipment Swapping') === true);
      const seen = new Set();
      for (const m of values(area.monsters)) { if (seen.has(m.id)) continue; seen.add(m.id); fights.push({ key: m.name, label: m.name, monster: m, entityId: area.id }); }
      fights.sort((a, b) => (b.monster.combatLevel ?? 0) - (a.monster.combatLevel ?? 0)); fights.splice(6);
    }
    // simulations: each fight against each combat set of the right realm
    await mh.waitSimulator();
    const G = self.mcs?.global, api = typeof mod !== 'undefined' ? mod.api?.mythCombatSimulator : null;
    const sims = [];
    if (G?.simulation && api) {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const buttons = [...document.querySelectorAll('mcs-equipment-page button.mcs-button')].filter(b => /^[0-9]+$/.test(b.textContent.trim()));
      const sets = roles.map((role, i) => ({ index: i + 1, role, abyssal: i >= 4 })).filter(x => x.role !== 'skill' && x.abyssal === abyssal && buttons[x.index - 1]);
      for (const set of sets) {
        buttons[set.index - 1].click(); await sleep(300);
        let exported = api.export();
        if (forcedCape) { const equipment = new Map(exported.equipment); equipment.set([...equipment.keys()].find(k => k.endsWith(':Cape')) || 'melvorD:Cape', forcedCape.id); exported = { ...exported, equipment }; api.import(exported); await sleep(100); }
        const weapon = [...exported.equipment].find(([k]) => k.endsWith(':Weapon'))?.[1] ?? null;
        for (const f of fights) {
          if (f.style && f.style !== set.role) continue; // style-locked fight (Bane): only the matching set can hurt him
          let r; try { r = (await mh.simulateFull(G, f.monsterId ?? f.monster.id, f.entityId)); } catch (e) { r = { simSuccess: false, reason: String(e.message || e) }; }
          sims.push({ fight: f.key, label: f.label, set: set.index, role: set.role, weapon, ok: r.simSuccess, reason: r.simSuccess ? null : r.reason, deathRate: r.deathRate ?? null, killTimeS: Number.isFinite(r.killTimeS) ? r.killTimeS : null, trials: r.trials ?? null });
        }
      }
    }
    return { cape: forcedCape?.name ?? null, dungeon: area.name, id: area.id, abyssal, mode: game.currentGamemode?.id, hardcore: /Hardcore/i.test(game.currentGamemode?.name || ''), clears: clears(area), checks, fights: fights.map(f => ({ key: f.key, label: f.label, style: f.style || null })), sims, simulated: Boolean(G?.simulation && api),
      // why the fights were not simulated: each step the simulator needs, first missing one wins
      simMissing: G?.simulation && api ? null : typeof mod === 'undefined' ? 'mod manager not loaded' : !mod.api?.mythCombatSimulator ? 'Combat Simulator mod not loaded for this character' : !self.mcs ? 'simulator global missing (document-start script not run)' : !self.mcs.global ? 'simulator not in debug mode' : 'simulator not initialised (simulation missing)' };
  };

  // Greedy search, by simulation, of the set that survives one fight best: owned gear slot by slot, then the combat
  // potion and prayers. Read-only: everything happens in the simulator's copy. Returns the changes to apply.
  // The simulator gives each trial a tick budget and stops when the total runs out: long fights (Bane) ended at 300-400
  // of 1000 trials, too few to call a death rate 0%. Rerun once with the budget scaled to what was missing.
  mh.simulateFull = async (G, monsterId, entityId) => {
    const st = G.stores.simulator.state, run = maxTicks => G.simulation.simulate({ monsterId, entityId, saveString: G.game.generateSaveStringSimple(), trials: st.trials, maxTicks });
    let r = (await run(st.ticks)).result;
    const short = /Simulated (\d+)\/(\d+) trials/.exec(r.reason || '');
    if (r.simSuccess && short && +short[1] > 0) r = (await run(Math.ceil(st.ticks * Math.min(20, +short[2] / +short[1] * 1.2)))).result;
    const done = /Simulated (\d+)\/(\d+) trials/.exec(r.reason || '');
    return { ...r, trials: done ? +done[1] : st.trials };
  };

  // the simulator builds its engine after the game loads, later on a large save: wait for it before calling it missing
  mh.waitSimulator = async (ms = 60000) => {
    for (const end = Date.now() + ms; self.mcs?.global && !self.mcs.global.simulation && Date.now() < end;) await new Promise(r => setTimeout(r, 500));
  };

  mh.optimizeFight = async ({ monsterId, entityId, setIndex, style, cape = null, maxSims = 70 }) => {
    await mh.waitSimulator();
    const G = self.mcs?.global, api = typeof mod !== 'undefined' ? mod.api?.mythCombatSimulator : null;
    if (!G?.simulation || !api) return { error: 'combat simulator not available' };
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const button = [...document.querySelectorAll('mcs-equipment-page button.mcs-button')].filter(b => /^[0-9]+$/.test(b.textContent.trim()))[setIndex - 1];
    if (!button) return { error: 'no equipment set ' + setIndex };
    button.click(); await sleep(300);
    let base = api.export();
    const keyOf = slot => [...base.equipment.keys()].find(k => k.endsWith(':' + slot)) || 'melvorD:' + slot;
    if (cape) { const equipment = new Map(base.equipment); equipment.set(keyOf('Cape'), cape); base = { ...base, equipment }; }
    let sims = 0;
    const run = async settings => {
      sims++; api.import(settings); await sleep(40);
      const r = (await mh.simulateFull(G, monsterId, entityId));
      return r.simSuccess ? { death: r.deathRate ?? 1, kill: Number.isFinite(r.killTimeS) ? r.killTimeS : 1e9, trials: r.trials } : { death: 1, kill: 1e9, trials: 0, failed: r.reason };
    };
    // a change must beat the simulation noise (two standard errors of the difference; a 0% rate counts as 1/trials),
    // or tie on deaths and kill 3% faster: otherwise it is chance (crossbow bolts in a magic set)
    const se = x => { const n = Math.max(x.trials || 0, 1), q = Math.max(x.death, 1 / n); return Math.sqrt(q * (1 - Math.min(q, 1)) / n); };
    const better = (a, b) => { const noise = 2 * Math.hypot(se(a), se(b)); return a.death < b.death - noise || (a.death <= b.death && b.death - a.death <= noise && a.kill < b.kill * 0.97); };
    const start = await run(base); let best = start, current = base;
    const abyss = mh.abyssOpen();
    const meets = item => { try { return game.checkRequirements(item.equipRequirements || [], false); } catch { return false; } };
    const defensive = item => Object.entries(statsOf(item)).reduce((sum, [k, v]) => sum + (/Defence|resistance|damageReduction/i.test(k) ? v * (/resistance|damageReduction/i.test(k) ? 10 : 1) : /Attack|Strength|Damage/i.test(k) ? v / 2 : 0), 0);
    const bank = [...game.bank.items.keys()].filter(item => item.validSlots?.length && meets(item) && (abyss || !/^melvorItA:/.test(item.id)) && (!item.attackType || item.attackType === style));
    const changes = [];
    for (const slot of ['Weapon', 'Shield', 'Helmet', 'Platebody', 'Platelegs', 'Boots', 'Gloves', 'Amulet', 'Ring', 'Passive', 'Gem', 'Quiver', 'Consumable', 'Summon1', 'Summon2']) {
      if (sims >= maxSims) break;
      const key = keyOf(slot); const now = current.equipment.get(key);
      const candidates = bank.filter(item => item.validSlots.some(v => v.localID === slot) && item.id !== now).sort((a, b) => defensive(b) - defensive(a)).slice(0, slot === 'Weapon' ? 4 : 3);
      for (const item of candidates) {
        if (sims >= maxSims) break;
        // one bank copy fills one slot: count the other slots already taking this item from the bank
        const taken = [...current.equipment].filter(([k, v]) => k !== key && v === item.id && base.equipment.get(k) !== v).length;
        if ((game.bank.items.get(item)?.quantity ?? 0) <= taken) continue;
        const equipment = new Map(current.equipment); equipment.set(key, item.id);
        const trial = { ...current, equipment }; const r = await run(trial);
        if (better(r, best)) { best = r; current = trial; changes.push({ slot, from: game.items.getObjectByID(now)?.name ?? 'empty', to: item.name, death: r.death, kill: r.kill }); }
      }
    }
    // combat potions owned
    const potions = [...game.bank.items.keys()].filter(item => item.action?.localID === 'Combat' && item.constructor?.name === 'PotionItem');
    for (const potion of potions.slice(0, 8)) {
      if (sims >= maxSims || current.potionID === potion.id) continue;
      const trial = { ...current, potionID: potion.id }; const r = await run(trial);
      if (better(r, best)) { best = r; current = trial; changes.push({ slot: 'Potion', from: '', to: potion.name, death: r.death, kill: r.kill }); }
    }
    // prayers: protect from the fight's style, alone or with the strongest general prayer the character can use
    const protect = { melee: 'Protect from Melee', ranged: 'Protect from Ranged', magic: 'Protect from Magic' }[style];
    const usable = p => (p.level ?? 0) <= (game.prayer?.level ?? 0) && (p.abyssalLevel ?? 0) <= (game.prayer?.abyssalLevel ?? 0) && (abyss || !/^melvorItA:/.test(p.id));
    const prayer = name => game.prayers.allObjects.find(p => p.name === name && usable(p));
    const combos = [[protect], [protect, 'Battleborn'], [protect, 'Battleheart'], [protect, { melee: 'Valor', ranged: 'Avidity', magic: 'Divination' }[style]], [protect, { melee: 'Piety', ranged: 'Rigour', magic: 'Augury' }[style]]]
      .map(c => c.map(prayer)).filter(c => c.every(Boolean)).map(c => c.map(p => p.id));
    for (const ids of combos) {
      if (sims >= maxSims) break;
      const trial = { ...current, prayerSelected: ids }; const r = await run(trial);
      if (better(r, best)) { best = r; current = trial; changes.push({ slot: 'Prayers', from: '', to: ids.map(id => game.prayers.getObjectByID(id)?.name).join(' + '), death: r.death, kill: r.kill }); }
    }
    api.import(base);
    return { setIndex, style, monsterId, start, best, changes, sims, equipment: [...current.equipment].map(([k, v]) => [k.split(':').pop(), game.items.getObjectByID(v)?.name ?? null]), potion: game.items.getObjectByID(current.potionID)?.name ?? null, prayers: (current.prayerSelected || []).map(id => game.prayers.getObjectByID(id)?.name) };
  };

  // Read-only preview of dungeon-optimize plans against the sets they target (plan.setIndex), not the selected set.
  // Several plans may want the same item: copies are counted across sets (bank + items the plans take out of a set).
  mh.dungeonSetupPreview = (plans) => {
    const sets = game.combat.player.equipmentSets;
    const nameIn = (set, slot) => { const e = set.equipment.equippedArray.find(x => x.slot.localID === slot); return e && e.item !== game.emptyEquipmentItem ? e.item.name : null; };
    const bankQty = name => { const item = game.items.allObjects.find(i => i.name === name); return item ? game.bank.items.get(item)?.quantity ?? 0 : 0; };
    const out = plans.map(p => {
      const set = sets[p.setIndex - 1];
      if (!set) return { setIndex: p.setIndex, style: p.style, error: 'no equipment set ' + p.setIndex };
      const swaps = p.equipment.filter(([slot, name]) => name && nameIn(set, slot) !== name).map(([slot, name]) => ({ slot, from: nameIn(set, slot), to: name }));
      const prayers = [...set.prayerSelection].map(x => x.name);
      return { setIndex: p.setIndex, style: p.style, swaps, prayersNow: prayers, prayers: p.prayers, potion: p.potion };
    });
    // copies needed per item vs bank + copies freed by the swaps; stackable slots (tablets, ammo) share one stack
    const need = {}, freed = {};
    for (const s of out) for (const w of s.swaps || []) { need[w.to] = (need[w.to] || 0) + 1; if (w.from) freed[w.from] = (freed[w.from] || 0) + 1; }
    const shortages = Object.entries(need).map(([name, n]) => ({ name, need: n, have: bankQty(name) + (freed[name] || 0) })).filter(x => x.have < x.need);
    return { name: game.characterName, sets: out, shortages, potionOwned: Object.fromEntries([...new Set(out.map(s => s.potion).filter(Boolean))].map(n => [n, bankQty(n)])) };
  };

  // Equip the plans into their own sets, then go back to the set in use. Refuses on any shortage. The combat potion
  // is shared by every set, so it is left to the run. Two passes: an item another set frees later in the loop.
  mh.dungeonSetupApply = async (plans) => {
    const preview = mh.dungeonSetupPreview(plans);
    if (preview.shortages.length) return { ...preview, error: 'not enough copies: ' + preview.shortages.map(x => x.name).join(', ') };
    // what the plans replace, so --restore can put the daily (Slayer) gear back; an empty slot is not restored
    const before = preview.sets.map(s => ({ setIndex: s.setIndex, style: s.style, equipment: (s.swaps || []).filter(w => w.from).map(w => [w.slot, w.from]), prayers: s.prayersNow }));
    const p = game.combat.player, original = p.selectedEquipmentSet, log = [];
    // gear and set changes are refused in a dungeon and in areas that reject a set's damage type: leave the fight first
    // and say so (the caller restarts the activity: dungeon-clear does, by hand it is slayer-start)
    let stoppedCombat = false;
    if (game.combat.isActive) { game.combat.stop(); await new Promise(r => setTimeout(r, 1000)); stoppedCombat = !game.combat.isActive; log.push('left the fight to change gear'); }
    const nameIn = (slot) => { const e = p.equipment.equippedArray.find(x => x.slot.localID === slot); return e && e.item !== game.emptyEquipmentItem ? e.item.name : null; };
    for (let pass = 0; pass < 2; pass++) {
      for (const plan of plans) {
        p.changeEquipmentSet(plan.setIndex - 1);
        // the game can refuse the switch (an area that rejects the set's damage type, a dungeon): never equip into the
        // set that happens to be active instead (GrifhinZ's S6 got the S2 helmet that way)
        if (p.selectedEquipmentSet !== plan.setIndex - 1) { p.changeEquipmentSet(original); return { name: game.characterName, applied: false, log, left: ['could not switch to S' + plan.setIndex + ' (in combat in an area or dungeon that refuses it): leave the fight first'], before, backTo: original + 1, error: 'set switch refused' }; }
        const todo = plan.equipment.filter(([slot, name]) => name && nameIn(slot) !== name);
        for (const [slot, name] of todo) {
          // a stack (tablets, ammo, scrolls) wanted by several sets is split between them
          const sharing = plans.filter(o => o.setIndex >= plan.setIndex && o.equipment.some(([s, n]) => s === slot && n === name)).length;
          const qty = /^Summon[12]$|^Quiver$|^Consumable$/.test(slot) ? Math.max(1, Math.floor((game.bank.items.get(game.items.allObjects.find(i => i.name === name))?.quantity ?? 0) / sharing)) : undefined;
          log.push('S' + plan.setIndex + ' ' + mh.equipSlot(name, slot, qty));
        }
        if (plan.prayers?.length) {
          const wanted = plan.prayers.map(n => game.prayers.allObjects.find(x => x.name === n)).filter(Boolean);
          for (const x of [...p.activePrayers]) if (!wanted.includes(x)) p.togglePrayer(x);
          for (const x of wanted) if (!p.activePrayers.has(x)) p.togglePrayer(x);
        }
      }
    }
    p.changeEquipmentSet(original);
    const after = mh.dungeonSetupPreview(plans);
    const left = after.sets.flatMap(s => (s.swaps || []).map(w => 'S' + s.setIndex + ' ' + w.slot + ' is ' + (w.from || 'empty') + ', not ' + w.to)
      .concat(s.prayers?.length && s.prayers.join() !== s.prayersNow.join() ? ['S' + s.setIndex + ' prayers are ' + (s.prayersNow.join(' + ') || 'none')] : []));
    return { name: game.characterName, applied: !left.length, log, left, before, backTo: original + 1, stoppedCombat, error: left.length ? 'not fully applied' : null };
  };

  mh.simUpgrades = async (plan, maxSims = 30) => {
    const session = await simSession(); if (session.error) return { error: session.error };
    const monster = game.combat.enemy?.monster ?? game.combat.selectedMonster;
    if (!monster) return { error: 'no combat target' };
    const api = session.api, base = session.exported;
    const run = settings => session.runFor(monster, settings);
    const baseline = await run(base);
    const results = {}; let sims = 0;
    for (const [slot, entry] of Object.entries(plan?.slots || {})) {
      const key = [...base.equipment.keys()].find(k => k.endsWith(':' + slot)) || 'melvorD:' + slot;
      for (const lane of ['bank', 'loot', 'craft']) {
        const choice = entry[lane]; if (!choice) continue;
        for (const item of lane === 'bank' ? [choice.primary, ...choice.alternatives] : [choice.primary]) {
          if (sims >= maxSims || !item?.id) continue;
          const equipment = new Map(base.equipment); equipment.set(key, item.id);
          (results[slot] ??= {})[item.name] = await run({ ...base, equipment }); sims++;
        }
      }
    }
    api.import(base);
    return { monster: monster.name, baseline, results, sims };
  };

  // XP/h per skill without waiting for two scans: the action being trained, else the best one you can run
  // (ETA mod rates when installed). Standard XP until the level cap, then abyssal XP once in the Abyss.
  mh.skillRates = () => {
    const out = {};
    const active = game.activeAction;
    for (const skill of game.skills.allObjects) {
      const capped = skill.level >= (skill.levelCap ?? 120);
      const wantAbyssal = capped && mh.abyssOpen() && (skill.abyssalLevel ?? 0) < (skill.currentAbyssalLevelCap ?? skill.abyssalLevelCap ?? 0);
      if (capped && !wantAbyssal) continue;
      let options = [];
      try { options = (mh.skillingOptions(skill.name) || []).filter(o => Boolean(o.abyssalLevel) === wantAbyssal && o.xpPerHour > 0 && (o.gathering || o.runwayHours > 0)); } catch {}
      if (!options.length) continue;
      // some getters throw when nothing is selected (Cooking.activeRecipe): only ask the skill being trained
      let selected = null; if (active === skill) { try { selected = skill.activeTrees ? [...skill.activeTrees][0] ?? null : null; } catch {} for (const key of selected ? [] : ['selectedRecipe', 'activeRecipe', 'selectedAction']) { try { selected = skill[key] ?? null; } catch { selected = null; } if (selected) break; } }
      const current = active === skill ? options.find(o => o.recipe === (selected?.name ?? selected?.product?.name)) : null;
      const pick = current || options[0];
      out[skill.name] = { xpPerHour: pick.xpPerHour, action: pick.recipe, abyssal: wantAbyssal, current: Boolean(current), source: pick.rateSource || 'base' };
    }
    return out;
  };

  // Raw data for the Plans goals (dungeon path, completion, target item, mastery, profit, slayer, capes, shop, quick wins).
  mh.goalData = (targetName = null) => {
    const abyss = mh.abyssOpen();
    const values = v => v instanceof Map || v instanceof Set ? [...v.values()] : Array.isArray(v) ? v : v?.allObjects ?? [];
    const owned = item => item ? game.bank.items.get(item)?.quantity ?? 0 : 0;
    const equipped = new Set(game.combat.player.equipmentSets.flatMap(set => set.equipment.equippedArray.filter(s => !s.isEmpty).map(s => s.item)));
    const has = item => owned(item) > 0 || equipped.has(item);
    const reqText = r => r.type === 'SkillLevel' ? `${r.skill?.name} ${r.level}` : r.type === 'AbyssalLevel' ? `Abyssal ${r.skill?.name} ${r.level}` : r.type === 'DungeonCompletion' ? `clear ${r.dungeon?.name}${(r.count ?? 1) > 1 ? ' x' + r.count : ''}` : r.type === 'AbyssDepthCompletion' ? `clear ${r.depth?.name || r.abyssDepth?.name || 'an Abyss depth'}` : r.type === 'ShopPurchase' ? `buy ${r.purchase?.name || 'a shop upgrade'}` : r.type === 'ItemFound' ? `find ${r.item?.name}` : r.type === 'MonsterKilled' ? `kill ${r.monster?.name}` : r.type === 'SlayerItem' ? `wear ${r.item?.name}` : r.type === 'CartographyPOIDiscovery' ? `discover ${(r.pois || []).map(p => p.name).join(', ') || 'a map location'} (Cartography)` : r.type === 'CartographyHexDiscovery' ? 'survey more Cartography hexes' : r.type || 'requirement';
    const met = reqs => { try { return game.checkRequirements(reqs || [], false); } catch { return null; } };
    const missing = reqs => (reqs || []).filter(r => { try { return !game.checkRequirements([r], false); } catch { return true; } }).map(reqText);
    const clears = area => { const c = game.combat; for (const f of ['getDungeonCompleteCount', 'getAbyssDepthCompleteCount', 'getStrongholdCompleteCount']) { try { const n = c[f]?.(area); if (Number.isFinite(n)) return n; } catch {} } return null; };
    const areaView = (area, kind) => ({ id: area.id, name: area.name, kind, realm: area.realm?.id?.split(':').pop() ?? null, clears: clears(area), unlocked: met(area.entryRequirements), missing: missing(area.entryRequirements), boss: values(area.monsters).at(-1)?.id ?? null, bossName: values(area.monsters).at(-1)?.name ?? null });
    const dungeons = [...values(game.dungeons).map(d => areaView(d, 'dungeon')), ...values(game.abyssDepths).map(d => areaView(d, 'depth')), ...values(game.strongholds).map(d => areaView(d, 'stronghold'))];
    const slayerAreas = values(game.slayerAreas).filter(a => abyss || !isAbyssal(a)).map(a => ({ ...areaView(a, 'slayer area'), slayerLevel: a.slayerLevelRequired ?? null }));

    // completion quick wins
    const craftMap = new Map();
    for (const skill of values(game.skills)) for (const action of values(skill.actions).length ? values(skill.actions) : values(skill.recipes)) {
      const item = action.product ?? action.item; if (!item?.id || craftMap.has(item.id)) continue;
      const costs = action.itemCosts ?? action.costs?.items ?? [];
      const unlocked = (skill.level ?? 0) >= (action.level ?? 1) && (skill.abyssalLevel ?? 0) >= (action.abyssalLevel ?? 0);
      craftMap.set(item.id, { skill: skill.name, unlocked, affordable: costs.every(c => owned(c.item) >= (c.quantity ?? 0)) });
    }
    const findCount = item => { try { return game.stats.itemFindCount(item); } catch { return null; } };
    const unfoundCraftable = values(game.items).filter(item => !item.ignoreCompletion && (abyss || !isAbyssal(item)) && findCount(item) === 0).map(item => ({ item, craft: craftMap.get(item.id) })).filter(x => x.craft?.unlocked && x.craft.affordable).slice(0, 15).map(x => ({ name: x.item.name, skill: x.craft.skill }));
    const killCount = m => { try { return game.stats.monsterKillCount(m); } catch { return null; } };
    const areaOf = new Map(); for (const a of [...values(game.combatAreas), ...values(game.slayerAreas)]) for (const m of values(a.monsters)) if (!areaOf.has(m.id)) areaOf.set(m.id, a);
    const unkilled = values(game.monsters).filter(m => !m.ignoreCompletion && (abyss || !isAbyssal(m)) && killCount(m) === 0 && areaOf.has(m.id)).map(m => ({ id: m.id, name: m.name, area: areaOf.get(m.id).name, unlocked: met(areaOf.get(m.id).entryRequirements), combatLevel: m.combatLevel ?? null })).filter(m => m.unlocked).sort((a, b) => (a.combatLevel ?? 0) - (b.combatLevel ?? 0)).slice(0, 10);
    const nearMastery = values(game.skills).filter(sk => sk.hasMastery).flatMap(sk => values(sk.actions).filter(a => abyss || !isAbyssal(a)).map(a => { let lvl = null; try { lvl = sk.getMasteryLevel(a); } catch {} return { skill: sk.name, action: a.name ?? a.product?.name, level: lvl, cap: sk.masteryLevelCap ?? 99 }; })).filter(x => x.level != null && x.level >= 90 && x.level < x.cap).sort((a, b) => b.level - a.level).slice(0, 10);
    const petsMissing = values(game.pets).filter(p => !p.ignoreCompletion && (abyss || !isAbyssal(p)) && !game.petManager.isPetUnlocked(p)).map(p => ({ name: p.name, skill: p.skill?.name ?? null, how: (p.acquiredBy || p.description || '').toString().replace(/<[^>]+>/g, '').slice(0, 90) }));

    // target item
    let target = null;
    if (targetName) {
      const item = values(game.items).find(i => i.name.toLowerCase() === String(targetName).toLowerCase());
      if (!item) target = { name: targetName, error: 'unknown item' };
      else {
        const sources = [];
        for (const monster of values(game.monsters)) {
          const table = values(monster.lootTable?.drops ?? monster.lootTable); const total = table.reduce((s, d) => s + (d.weight ?? 0), 0);
          for (const d of table) if ((d.item ?? d.drop) === item && total) sources.push({ monsterId: monster.id, monster: monster.name, chance: (d.weight / total) * ((monster.lootChance ?? 100) / 100) * 100, area: areaOf.get(monster.id)?.name ?? null, unlocked: areaOf.has(monster.id) ? met(areaOf.get(monster.id).entryRequirements) : null });
        }
        sources.sort((a, b) => (b.unlocked === true) - (a.unlocked === true) || b.chance - a.chance);
        const shop = values(game.shop.purchases).find(p => values(p.contains?.items).some(e => (e.item ?? e) === item));
        target = { name: item.name, id: item.id, needsAbyss: isAbyssal(item) && !abyss, owned: owned(item), equipped: equipped.has(item), equipMissing: missing(item.equipRequirements), craft: craftMap.get(item.id) ?? null, monsters: sources.slice(0, 4), shop: shop ? { name: shop.name, missing: missing(shop.purchaseRequirements ?? shop.unlockRequirements) } : null };
      }
    }

    // mastery pools: distance to the next checkpoint (10/25/50/95%)
    const pools = values(game.skills).filter(sk => sk.hasMastery).flatMap(sk => values(game.realms).filter(realm => realm.id === 'melvorD:Melvor' || (abyss && realm.id === 'melvorItA:Abyssal')).map(realm => { let xp = null, cap = null; try { xp = sk.getMasteryPoolXP(realm); cap = sk.getMasteryPoolCap(realm); } catch {} return { skill: sk.name, realm: realm.name, xp, cap }; })).filter(p => p.cap > 0 && p.xp < p.cap).map(p => { const pct = p.xp / p.cap * 100; const next = [10, 25, 50, 95].find(c => c > pct); return next ? { ...p, pct, next, missing: p.cap * next / 100 - p.xp } : null; }).filter(Boolean).sort((a, b) => (a.next - a.pct) - (b.next - b.pct)).slice(0, 8);

    // profit: sell value per hour of artisan and gathering actions you can run 8 h or more
    const sell = item => item?.sellsFor?.currency?.id === 'melvorD:GP' ? item.sellsFor.quantity : 0;
    const profit = [];
    for (const name of ['Woodcutting', 'Fishing', 'Mining', 'Smithing', 'Fletching', 'Crafting', 'Cooking', 'Herblore', 'Runecrafting', 'Summoning', 'Firemaking']) {
      for (const o of (mh.skillingOptions?.(name) || []).slice(0, 40)) {
        if (!(o.gathering || o.runwayHours >= 8) || !o.intervalMs) continue;
        const skill = game.skills.find(s => s.name === name); const action = values(skill.actions).find(a => (a.name ?? a.product?.name) === o.recipe);
        const product = action?.product ?? action?.item; const qty = action?.baseQuantity ?? 1;
        const inputCost = (o.inputs || []).reduce((sum, i) => sum + sell(values(game.items).find(x => x.name === i.item)) * i.perAction, 0);
        const gph = (sell(product) * qty - inputCost) * 3600000 / o.intervalMs;
        if (gph > 0) profit.push({ skill: name, recipe: o.recipe, gpPerHour: gph, runwayHours: o.runwayHours, gathering: o.gathering });
      }
    }
    profit.sort((a, b) => b.gpPerHour - a.gpPerHour);

    // capes and shop
    const capes = values(game.items).filter(i => /Skillcape|Max Skillcape|Cape of Completion/i.test(i.name) && (abyss || !isAbyssal(i)) && !has(i)).map(i => { const p = values(game.shop.purchases).find(pp => values(pp.contains?.items).some(e => (e.item ?? e) === i)); return { name: i.name, missing: p ? missing(p.purchaseRequirements ?? p.unlockRequirements) : ['not sold in the shop'], gp: p?.costs?.currencies ? values(p.costs.currencies).find(c => c.currency?.id === 'melvorD:GP')?.quantity ?? null : null }; }).sort((a, b) => a.missing.length - b.missing.length).slice(0, 12);
    const gp = game.gp.amount;
    const shop = values(game.shop.purchases).filter(p => !values(p.contains?.items).length && !game.shop.isPurchaseAtBuyLimit?.(p) && met(p.unlockRequirements) !== false && met(p.purchaseRequirements) !== false).map(p => { const gpCost = values(p.costs?.currencies).find(c => c.currency?.id === 'melvorD:GP')?.quantity ?? 0; const items = values(p.costs?.items); return { name: p.name, gp: gpCost, items: items.map(e => (e.item?.name ?? '?') + ' x' + (e.quantity ?? 1)), affordable: gpCost <= gp && items.every(e => owned(e.item) >= (e.quantity ?? 1)) }; }).filter(p => p.affordable).sort((a, b) => a.gp - b.gp).slice(0, 10);

    // slayer and quick wins
    const task = game.combat.slayerTask;
    const slayer = { active: Boolean(task?.active), monster: task?.monster?.name ?? null, killsLeft: task?.killsLeft ?? null, coins: game.slayerCoins?.amount ?? null, abyssalCoins: game.abyssalSlayerCoins?.amount ?? null, locked: slayerAreas.filter(a => !a.unlocked).slice(0, 6) };
    let grown = null; try { grown = game.farming.isAnyPlotGrown; if (typeof grown === 'function') grown = grown.call(game.farming); } catch {}
    return { abyss, dungeons, slayer, completion: { unfoundCraftable, unkilled, nearMastery, petsMissing: petsMissing.slice(0, 12), petsMissingCount: petsMissing.length }, target, pools, profit: profit.slice(0, 8), capes, shop, quick: { farmingReady: Boolean(grown), slayerTaskDone: game.activeAction?.name === 'Combat' && !task?.active } };
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

  // An item's passives (modifiers) from the bank, equipped items or the global registry.
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
