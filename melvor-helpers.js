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

  // Local save + immediate cloud push.
  mh.save = async () => {
    saveData();
    await cloudManager.forceUpdatePlayFabSave();
    return 'saved (local + cloud)';
  };

  // Close any swal2 popup (confirm by default, cancel with accept=false).
  mh.dismissModal = (accept = true) => {
    const re = accept ? /confirm|ok|yes/i : /cancel|no/i;
    const btn = [...document.querySelectorAll('.swal2-popup button')].find(b => re.test(b.innerText));
    if (btn) { btn.click(); return btn.innerText; }
    return 'no modal';
  };

  // Compact character overview.
  mh.snapshot = () => ({
    character: game.characterName,
    gp: game.gp.amount,
    activeAction: game.activeAction?.name ?? null,
    combatLevel: game.playerCombatLevel,
    hp: game.combat.player.hitpoints,
    prayerPoints: game.combat.player.prayerPoints,
    food: game.combat.player.food.currentSlot?.item?.name ?? null,
    foodQty: game.combat.player.food.currentSlot?.quantity ?? 0,
    equipment: Object.fromEntries(
      game.combat.player.equipment.equippedArray
        .filter(s => !s.isEmpty)
        .map(s => [s.slot.localID, s.item.name])
    ),
  });

  // Bank search by substring (case-insensitive).
  mh.bankFind = (q) => {
    const re = new RegExp(q, 'i');
    const out = [];
    for (const [item, bankItem] of game.bank.items)
      if (re.test(item.name)) out.push({ name: item.name, qty: bankItem.quantity, id: item.id });
    return out;
  };

  // Skill state by name ("Fishing", "Herblore"...).
  mh.skillInfo = (name) => {
    const s = game.skills.find(s => s.name.toLowerCase() === name.toLowerCase());
    if (!s) return `unknown skill "${name}"`;
    return {
      name: s.name, level: s.level, virtualLevel: s.virtualLevel, xp: Math.floor(s.xp),
      isActive: game.activeAction === s,
    };
  };

  // All skills, one line each.
  mh.skills = () =>
    game.skills.allObjects.map(s => ({ name: s.name, level: s.level, xp: Math.floor(s.xp) }));

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
    const candidates = {};
    for (const [item] of game.bank.items) {
      if (!item.validSlots?.length) continue;
      if (item.attackType && item.attackType !== attackType) continue;
      const st = statsOf(item);
      if (scoreOf(st) === 0) continue;
      (candidates[item.validSlots[0].localID] ??= []).push({ name: item.name, stats: st, passives: passivesOf(item), damageType: item.damageType?.name });
    }
    for (const k in candidates) candidates[k] = candidates[k].sort((a,b)=>scoreOf(b.stats)-scoreOf(a.stats)).slice(0, topN);
    return { context: { attackType, hitChance: p.stats.hitChance, maxHit: p.stats.maxHit, attackInterval: p.stats.attackInterval }, equipped, candidates };
  };

  mh.equipSlot = (name, slotName) => {
    const p = game.combat.player;
    const item = findBank(name);
    if (!item) return name + ': not in bank';
    if (!item.validSlots?.length) return name + ': not equipment';
    const slot = p.equipment.equippedArray.find(s => s.slot.localID === slotName)?.slot;
    if (!slot) return slotName + ': unknown slot';
    if (!item.validSlots.some(s => s.localID === slotName))
      return name + ': invalid slot "' + slotName + '" (valid: ' + item.validSlots.map(s => s.localID).join(', ') + ')';
    p.equipItem(item, p.selectedEquipmentSet, slot, 1);
    return name + ': equipped in ' + slotName;
  };

  // Explicit slot required; avoids accidental passive/summon/offhand swaps.
  mh.equip = (names) => {
    const list = Array.isArray(names) ? names : [names];
    return list.map(name => name + ': use mh.equipSlot(name, slotName)');
  };

  // Current combat: area, monster, hit chance, slayer task.
  mh.combatInfo = () => {
    const c = game.combat, p = c.player, e = c.enemy;
    return {
      area: c.selectedArea?.name ?? null,
      monster: e?.monster?.name ?? null,
      monsterAttackType: e?.monster?.attackType ?? null,
      enemyHP: e?.hitpoints ?? null,
      hitChance: p.stats.hitChance,
      maxHit: p.stats.maxHit,
      slayerTask: c.slayerTask?.active ? { monster: c.slayerTask.monster?.name, left: c.slayerTask.killsLeft } : null,
    };
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
      combat: mh.combatInfo(),
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
